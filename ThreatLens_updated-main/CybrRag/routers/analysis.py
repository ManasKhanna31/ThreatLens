from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from services.parser import parse_log
from services.detector import detect_threat
from services.mitre_service import get_technique_by_id
from services.cve_service import search_cves
from services.ip_intel_service import enrich_ip
from services.risk_engine import calculate_risk
from services.llm_service import generate_soc_summary
from services.rag_service import retrieve_threat_intel, check_ioc_match
from services.alert_service import evaluate_alert_rules
from services.incident_ops import create_or_update_incident
from services.source_health import mark_source_error, record_source_health

from models.database import get_db, SessionLocal
from models.db_models import LogEntry, Blocklist

import threading

logger = logging.getLogger("threatlens.analysis")

router = APIRouter()


class LogInput(BaseModel):
    log: str


class BulkLogInput(BaseModel):
    logs: List[str]


# ========================
#  Single Log Analysis
# ========================
@router.post("/analyze")
def analyze_log(data: LogInput, db: Session = Depends(get_db)):
    parsed = parse_log(data.log)
    detection = detect_threat(parsed, db=db)

    source_ip = parsed.get("source_ip")

    # Blocklist Check
    blocklist_hit = False
    if source_ip:
        blocked = db.query(Blocklist).filter(Blocklist.ip_address == source_ip).first()
        if blocked:
            blocklist_hit = True

    # IOC Cross-Check
    ioc_matches = []
    if source_ip:
        ioc_matches = check_ioc_match(source_ip, db)
        if ioc_matches and not detection.get("threat_detected"):
            detection["threat_detected"] = f"Known Threat Intel IOC: {ioc_matches[0]['source']}"
            detection["confidence"] = 0.85
            detection["mitre_candidate"] = None
            detection["current_stage"] = "Initial Access"

    mitre_details = None
    cve_results = None
    ip_intel = None

    # MITRE + CVE
    if detection.get("mitre_candidate"):
        mitre_details = get_technique_by_id(detection["mitre_candidate"])
        if mitre_details:
            cve_results = search_cves(mitre_details["name"])

    # IP Enrichment
    if source_ip:
        ip_intel = enrich_ip(source_ip)

    # Threat Intel Retrieval (RAG)
    threat_intel = []
    if detection.get("threat_detected"):
        threat_intel = retrieve_threat_intel(detection["threat_detected"], db=db, top_k=3)

    # Enhanced Risk Engine
    risk = calculate_risk(
        detection, cve_results, ip_intel,
        db=db, source_ip=source_ip,
        threat_intel_matches=ioc_matches or threat_intel,
    )

    # Severity override
    if detection.get("severity_override"):
        risk["risk_level"] = detection["severity_override"]
        risk["risk_score"] = max(risk["risk_score"], 90)
        risk["risk_factors"].append(f"Severity override: {detection['severity_override']}")

    # Blocklist override
    if blocklist_hit:
        risk["risk_level"] = "CRITICAL"
        risk["risk_score"] = max(risk["risk_score"], 95)
        risk["risk_factors"].append("IP is on active BLOCKLIST")

    # IOC match override
    if ioc_matches:
        if risk["risk_level"] not in ("CRITICAL",):
            risk["risk_level"] = "HIGH"
            risk["risk_score"] = max(risk["risk_score"], 75)

    soc_summary = generate_soc_summary(
        parsed, detection, mitre_details, cve_results, ip_intel, risk, threat_intel
    )

    # Persist Log
    log_entry = LogEntry(
        source_ip=source_ip,
        event_id=parsed.get("event_id"),
        user=parsed.get("user"),
        status=parsed.get("status"),
        log_type=parsed.get("log_type"),
        raw_log=data.log,
    )
    db.add(log_entry)
    db.flush()

    record_source_health(
        db,
        "manual_analysis",
        event_timestamp=log_entry.timestamp,
        ingested=1,
    )

    # Persist Incident
    incident_id = None
    incident_deduplicated = False
    incident_reopened = False
    if detection.get("threat_detected"):
        campaign = detection.get("campaign")
        incident, created, reopened = create_or_update_incident(
            db,
            source="manual_analysis",
            detection=detection,
            risk=risk,
            source_ip=source_ip,
            parsed=parsed,
            raw_log=data.log,
            log_id=log_entry.id,
            event_timestamp=log_entry.timestamp,
            ioc_matches=ioc_matches,
            blocklist_hit=blocklist_hit,
            campaign_id=campaign.get("campaign_id") if campaign else None,
            summary_extra={
                "analysis_mode": "single_log",
                "llm_summary": soc_summary,
                "blocklist_hit": blocklist_hit,
                "ioc_matches": len(ioc_matches),
            },
        )
        if incident:
            incident_id = incident.id
            incident_deduplicated = not created
            incident_reopened = reopened
            if created:
                evaluate_alert_rules(db, incident)
                record_source_health(
                    db,
                    "manual_analysis",
                    event_timestamp=log_entry.timestamp,
                    incidents_created=1,
                )

    db.commit()

    return {
        "log_id": log_entry.id,
        "incident_id": incident_id,
        "parsed_log": parsed,
        "detection_result": detection,
        "blocklist_hit": blocklist_hit,
        "ioc_matches": ioc_matches,
        "mitre_details": mitre_details,
        "related_cves": cve_results,
        "ip_intelligence": ip_intel,
        "risk_assessment": risk,
        "threat_intelligence_rag": threat_intel,
        "soc_summary": soc_summary,
        "incident_deduplicated": incident_deduplicated,
        "incident_reopened": incident_reopened,
    }


# ========================
#  Bulk Ingestion (Async)
# ========================
# In-memory job tracker for async bulk ingestion
_ingestion_jobs = {}


def _process_bulk_logs(job_id: str, logs: List[str]):
    """Background worker that processes logs in batches using its own DB session."""
    db = SessionLocal()
    job = _ingestion_jobs[job_id]
    try:
        BATCH_SIZE = 50
        for i in range(0, len(logs), BATCH_SIZE):
            batch = logs[i:i + BATCH_SIZE]
            for raw_log in batch:
                try:
                    parsed = parse_log(raw_log)
                    detection = detect_threat(parsed, db=db)
                    source_ip = parsed.get("source_ip")

                    blocklist_hit = False
                    if source_ip:
                        blocked = db.query(Blocklist).filter(Blocklist.ip_address == source_ip).first()
                        if blocked:
                            blocklist_hit = True
                            job["blocklist_hits"] += 1

                    ioc_matches = []
                    if source_ip:
                        ioc_matches = check_ioc_match(source_ip, db)
                        if ioc_matches:
                            job["ioc_hits"] += 1
                            if not detection.get("threat_detected"):
                                detection["threat_detected"] = f"Known IOC: {ioc_matches[0]['source']}"
                                detection["confidence"] = 0.85
                                detection["current_stage"] = "Initial Access"

                    risk = calculate_risk(detection, None, None, db=db, source_ip=source_ip, threat_intel_matches=ioc_matches)

                    if detection.get("severity_override"):
                        risk["risk_level"] = detection["severity_override"]
                        risk["risk_score"] = max(risk["risk_score"], 90)
                    if blocklist_hit:
                        risk["risk_level"] = "CRITICAL"
                        risk["risk_score"] = max(risk["risk_score"], 95)

                    log_entry = LogEntry(
                        source_ip=source_ip, event_id=parsed.get("event_id"),
                        user=parsed.get("user"), status=parsed.get("status"),
                        log_type=parsed.get("log_type"), raw_log=raw_log,
                    )
                    db.add(log_entry)
                    db.flush()
                    record_source_health(
                        db,
                        "bulk_ingest",
                        event_timestamp=log_entry.timestamp,
                        ingested=1,
                    )

                    if detection.get("threat_detected"):
                        campaign = detection.get("campaign")
                        incident, created, _ = create_or_update_incident(
                            db,
                            source="bulk_ingest",
                            detection=detection,
                            risk=risk,
                            source_ip=source_ip,
                            parsed=parsed,
                            raw_log=raw_log,
                            log_id=log_entry.id,
                            event_timestamp=log_entry.timestamp,
                            ioc_matches=ioc_matches,
                            blocklist_hit=blocklist_hit,
                            campaign_id=campaign.get("campaign_id") if campaign else None,
                            summary_extra={
                                "blocklist_hit": blocklist_hit,
                                "ioc_matches": len(ioc_matches),
                                "job_id": job_id,
                            },
                        )
                        if incident and created:
                            evaluate_alert_rules(db, incident)
                            job["incidents_created"] += 1
                            record_source_health(
                                db,
                                "bulk_ingest",
                                event_timestamp=log_entry.timestamp,
                                incidents_created=1,
                            )

                    job["logs_processed"] += 1
                except Exception as e:
                    job["errors"] += 1
                    mark_source_error(db, "bulk_ingest", str(e))
                    record_source_health(db, "bulk_ingest", parse_failures=1)
                    logger.warning(f"[Bulk] Error processing log: {e}")

            # Commit after each batch
            db.commit()

        job["status"] = "completed"
        job["completed_at"] = datetime.utcnow().isoformat()
        logger.info(f"[Bulk] Job {job_id} completed: {job['logs_processed']}/{job['total_logs']} logs")
    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
        logger.error(f"[Bulk] Job {job_id} failed: {e}")
        db.rollback()
    finally:
        db.close()


@router.post("/ingest")
def bulk_ingest(data: BulkLogInput):
    """
    Async bulk ingestion: returns immediately with a job_id.
    Logs are processed in a background thread in batches of 50.
    Check progress via GET /ingest/status/{job_id}.
    """
    import uuid
    job_id = str(uuid.uuid4())[:8]

    _ingestion_jobs[job_id] = {
        "status": "processing",
        "total_logs": len(data.logs),
        "logs_processed": 0,
        "incidents_created": 0,
        "blocklist_hits": 0,
        "ioc_hits": 0,
        "errors": 0,
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
    }

    # Fire background worker
    thread = threading.Thread(target=_process_bulk_logs, args=(job_id, data.logs), daemon=True)
    thread.start()

    return {
        "status": "accepted",
        "job_id": job_id,
        "total_logs": len(data.logs),
        "message": f"Processing {len(data.logs)} logs in background. Check GET /api/v1/analysis/ingest/status/{job_id}",
    }


@router.get("/ingest/status/{job_id}")
def get_ingestion_status(job_id: str):
    """Check the status of a bulk ingestion job."""
    job = _ingestion_jobs.get(job_id)
    if not job:
        return {"error": f"Job '{job_id}' not found"}
    return {"job_id": job_id, **job}
