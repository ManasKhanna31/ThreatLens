"""
Log Router — Parse + Webhook Receiver for external log forwarders.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from services.parser import parse_log
from services.detector import detect_threat
from services.risk_engine import calculate_risk
from services.alert_service import evaluate_alert_rules
from services.incident_ops import create_or_update_incident
from services.log_collector import get_collector_status, run_collection_cycle_now
from services.source_health import mark_source_error, record_source_health
from models.database import get_db
from models.db_models import LogEntry, Blocklist

logger = logging.getLogger("threatlens.logs")

router = APIRouter()


class LogInput(BaseModel):
    log: str


class WebhookPayload(BaseModel):
    """Accepts logs from external agents/forwarders (Filebeat, Fluentd, custom agents)."""
    logs: List[str]
    source: Optional[str] = "webhook"


@router.post("/parse")
def parse_log_endpoint(data: LogInput):
    """Parse a single log line without persisting or running detection."""
    parsed = parse_log(data.log)
    return {"parsed_log": parsed}


@router.post("/webhook")
def webhook_receiver(data: WebhookPayload, db: Session = Depends(get_db)):
    """
    Webhook endpoint for external log sources.
    Accepts an array of raw log strings, runs each through the full pipeline
    (parse → detect → risk → alert), and persists results.
    
    Use this to connect Filebeat, Fluentd, rsyslog, or any custom agent.
    Max 100 logs per request to prevent overload on free tier.
    """
    logs = data.logs[:100]  # Hard limit per request
    
    processed = 0
    incidents_created = 0
    errors = 0

    for raw_log in logs:
        try:
            parsed = parse_log(raw_log)
            detection = detect_threat(parsed, db=db)
            source_ip = parsed.get("source_ip")

            blocklist_hit = False
            if source_ip:
                blocked = db.query(Blocklist).filter(Blocklist.ip_address == source_ip).first()
                if blocked:
                    blocklist_hit = True

            risk = calculate_risk(detection, None, None, db=db, source_ip=source_ip)

            if detection.get("severity_override"):
                risk["risk_level"] = detection["severity_override"]
                risk["risk_score"] = max(risk["risk_score"], 90)
            if blocklist_hit:
                risk["risk_level"] = "CRITICAL"
                risk["risk_score"] = max(risk["risk_score"], 95)

            # Persist log
            log_entry = LogEntry(
                source_ip=source_ip,
                event_id=parsed.get("event_id"),
                user=parsed.get("user"),
                status=parsed.get("status"),
                log_type=parsed.get("log_type"),
                raw_log=raw_log,
            )
            db.add(log_entry)
            db.flush()
            record_source_health(
                db,
                data.source or "webhook",
                event_timestamp=log_entry.timestamp,
                ingested=1,
            )

            # Persist incident if threat detected
            if detection.get("threat_detected"):
                campaign = detection.get("campaign")
                incident, created, _ = create_or_update_incident(
                    db,
                    source=data.source or "webhook",
                    detection=detection,
                    risk=risk,
                    source_ip=source_ip,
                    parsed=parsed,
                    raw_log=raw_log,
                    log_id=log_entry.id,
                    event_timestamp=log_entry.timestamp,
                    blocklist_hit=blocklist_hit,
                    campaign_id=campaign.get("campaign_id") if campaign else None,
                    summary_extra={"ingest_mode": "webhook"},
                )
                if incident and created:
                    evaluate_alert_rules(db, incident)
                    incidents_created += 1
                    record_source_health(
                        db,
                        data.source or "webhook",
                        event_timestamp=log_entry.timestamp,
                        incidents_created=1,
                    )

            processed += 1
        except Exception as e:
            errors += 1
            mark_source_error(db, data.source or "webhook", str(e))
            record_source_health(db, data.source or "webhook", parse_failures=1)
            logger.warning(f"[Webhook] Error processing log: {e}")

    db.commit()

    return {
        "status": "accepted",
        "source": data.source,
        "logs_received": len(logs),
        "logs_processed": processed,
        "incidents_created": incidents_created,
        "errors": errors,
    }


@router.get("/collector/status")
def collector_status():
    """Status of the lightweight real-log collector used for local demos."""
    return get_collector_status()


@router.post("/collector/run")
def collector_run_now():
    """Trigger a collector sweep immediately."""
    try:
        result = run_collection_cycle_now()
        return {"status": "completed", **result}
    except Exception as exc:
        return {"status": "failed", "error": str(exc)}
