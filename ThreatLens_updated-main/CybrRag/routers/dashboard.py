from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from models.database import get_db
from models.db_models import AttackCampaign, Blocklist, Incident, IPState, LogEntry, MonitoredAsset, SourceHealth, ThreatIntelEntry
from services.app_settings import get_app_settings, update_app_settings
from services.incident_ops import run_incident_lifecycle_sweep
from services.log_collector import get_collector_status

router = APIRouter()


def _incident_source(summary: Optional[Dict[str, Any]], fallback: Optional[str] = None) -> str:
    summary = summary or {}
    if fallback:
        return fallback
    if summary.get("source"):
        return summary["source"]
    if summary.get("seeded"):
        return "demo_seed"
    if summary.get("auto_ingested"):
        return "bulk_ingest"
    return "other"


def _serialize_incident(incident: Incident) -> Dict[str, Any]:
    sla_remaining_minutes = None
    sla_breached = False
    if incident.sla_due_at:
        delta = incident.sla_due_at - datetime.utcnow()
        sla_remaining_minutes = int(delta.total_seconds() // 60)
        sla_breached = delta.total_seconds() < 0 and incident.status not in ("Resolved", "Closed")

    return {
        "id": incident.id,
        "timestamp": incident.timestamp.isoformat() if incident.timestamp else None,
        "first_seen": incident.first_seen.isoformat() if incident.first_seen else None,
        "last_seen": incident.last_seen.isoformat() if incident.last_seen else None,
        "opened_at": incident.opened_at.isoformat() if incident.opened_at else None,
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
        "sla_due_at": incident.sla_due_at.isoformat() if incident.sla_due_at else None,
        "sla_remaining_minutes": sla_remaining_minutes,
        "sla_breached": sla_breached,
        "threat_type": incident.threat_type,
        "risk_level": incident.risk_level,
        "risk_score": incident.risk_score,
        "source_ip": incident.source_ip,
        "mitre_technique": incident.mitre_technique,
        "status": incident.status,
        "workflow_state": incident.workflow_state or "New",
        "campaign_id": incident.campaign_id,
        "source": _incident_source(incident.soc_summary, incident.source),
        "asset_id": incident.asset_id,
        "asset": {
            "id": incident.asset_id,
            "name": (incident.soc_summary or {}).get("asset_name"),
            "target": (incident.soc_summary or {}).get("asset_target"),
            "type": (incident.soc_summary or {}).get("asset_type"),
            "type_label": (incident.soc_summary or {}).get("asset_type_label"),
        } if incident.asset_id else None,
        "owner": incident.owner or "Unassigned",
        "alert_count": incident.alert_count or 1,
        "analyst_notes": incident.analyst_notes,
        "status_history": incident.status_history or [],
        "evidence": incident.evidence or [],
        "explanation": incident.explanation or {},
        "recommended_actions": incident.recommended_actions or [],
        "tags": incident.tags or [],
        "soc_summary": incident.soc_summary or {},
    }


def _build_query(
    db: Session,
    *,
    status: Optional[str] = None,
    workflow_state: Optional[str] = None,
    risk_level: Optional[str] = None,
    source: Optional[str] = None,
    owner: Optional[str] = None,
    mitre_technique: Optional[str] = None,
    search: Optional[str] = None,
    hours: Optional[int] = None,
):
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    if workflow_state:
        query = query.filter(Incident.workflow_state == workflow_state)
    if risk_level:
        query = query.filter(Incident.risk_level == risk_level)
    if source:
        query = query.filter(Incident.source == source)
    if owner:
        query = query.filter(Incident.owner == owner)
    if mitre_technique:
        query = query.filter(Incident.mitre_technique == mitre_technique)
    if search:
        term = f"%{search}%"
        query = query.filter(or_(Incident.threat_type.ilike(term), Incident.source_ip.ilike(term), Incident.owner.ilike(term)))
    if hours:
        query = query.filter(Incident.last_seen >= datetime.utcnow() - timedelta(hours=hours))
    return query


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_logs = db.query(func.count(LogEntry.id)).scalar() or 0
    total_incidents = db.query(func.count(Incident.id)).scalar() or 0
    open_incidents = db.query(func.count(Incident.id)).filter(Incident.status == "Open").scalar() or 0
    investigating = db.query(func.count(Incident.id)).filter(Incident.status == "Investigating").scalar() or 0
    new_cases = db.query(func.count(Incident.id)).filter(Incident.workflow_state == "New").scalar() or 0
    triage_cases = db.query(func.count(Incident.id)).filter(Incident.workflow_state == "Triage").scalar() or 0
    breached_slas = db.query(func.count(Incident.id)).filter(Incident.sla_due_at.isnot(None), Incident.sla_due_at < datetime.utcnow(), Incident.status.in_(["Open", "Investigating"])).scalar() or 0

    critical_count = db.query(func.count(Incident.id)).filter(Incident.risk_level == "CRITICAL").scalar() or 0
    high_count = db.query(func.count(Incident.id)).filter(Incident.risk_level == "HIGH").scalar() or 0
    medium_count = db.query(func.count(Incident.id)).filter(Incident.risk_level == "MEDIUM").scalar() or 0
    low_count = db.query(func.count(Incident.id)).filter(Incident.risk_level == "LOW").scalar() or 0

    top_ips = (
        db.query(Incident.source_ip, func.count(Incident.id).label("count"))
        .filter(Incident.source_ip.isnot(None))
        .group_by(Incident.source_ip)
        .order_by(desc("count"))
        .limit(5)
        .all()
    )
    top_threats = (
        db.query(Incident.threat_type, func.count(Incident.id).label("count"))
        .filter(Incident.threat_type.isnot(None))
        .group_by(Incident.threat_type)
        .order_by(desc("count"))
        .limit(5)
        .all()
    )
    mitre_dist = (
        db.query(Incident.mitre_technique, func.count(Incident.id).label("count"))
        .filter(Incident.mitre_technique.isnot(None))
        .group_by(Incident.mitre_technique)
        .order_by(desc("count"))
        .limit(10)
        .all()
    )

    since_24h = datetime.utcnow() - timedelta(hours=24)
    recent_incidents = db.query(func.count(Incident.id)).filter(Incident.timestamp >= since_24h).scalar() or 0
    active_campaigns = db.query(func.count(AttackCampaign.id)).filter(AttackCampaign.status == "Active").scalar() or 0
    blocked_ips = db.query(func.count(Blocklist.id)).scalar() or 0
    total_iocs = db.query(func.count(ThreatIntelEntry.id)).scalar() or 0
    unique_attackers = db.query(func.count(func.distinct(Incident.source_ip))).filter(Incident.source_ip.isnot(None)).scalar() or 0
    monitored_assets = db.query(func.count(MonitoredAsset.id)).filter(MonitoredAsset.status == "Active").scalar() or 0

    incident_sources = {"demo_seed": 0, "manual_analysis": 0, "bulk_ingest": 0, "real_windows_event_log": 0, "webhook": 0, "asset_website": 0, "asset_github": 0, "asset_api": 0, "asset_cloud": 0, "asset_server": 0, "asset_saas": 0, "other": 0}
    for inc in db.query(Incident).all():
        source_key = _incident_source(inc.soc_summary, inc.source)
        if source_key not in incident_sources:
            source_key = "other"
        incident_sources[source_key] += 1

    log_sources = {"demo_seed": 0, "real_windows_event_log": 0, "manual_or_other": 0}
    for log in db.query(LogEntry).all():
        raw = log.raw_log or ""
        if "[REAL_LOG]" in raw:
            log_sources["real_windows_event_log"] += 1
        elif "sshd[" in raw or "WinEventLog:" in raw or "fw-main kernel" in raw or "proxy-server squid" in raw:
            log_sources["demo_seed"] += 1
        else:
            log_sources["manual_or_other"] += 1

    return {
        "total_logs_ingested": total_logs,
        "total_incidents": total_incidents,
        "open_incidents": open_incidents,
        "investigating_incidents": investigating,
        "new_cases": new_cases,
        "triage_cases": triage_cases,
        "sla_breaches": breached_slas,
        "incidents_last_24h": recent_incidents,
        "active_campaigns": active_campaigns,
        "blocked_ips": blocked_ips,
        "unique_attackers": unique_attackers,
        "threat_intel_iocs": total_iocs,
        "monitored_assets": monitored_assets,
        "severity_breakdown": {"CRITICAL": critical_count, "HIGH": high_count, "MEDIUM": medium_count, "LOW": low_count},
        "top_source_ips": [{"ip": ip, "incident_count": count} for ip, count in top_ips],
        "top_threat_types": [{"threat": threat, "count": count} for threat, count in top_threats],
        "mitre_technique_distribution": [{"technique": technique, "count": count} for technique, count in mitre_dist],
        "incident_sources": incident_sources,
        "log_sources": log_sources,
    }


@router.get("/incidents")
def list_incidents(
    status: Optional[str] = Query(None),
    workflow_state: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    mitre_technique: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    hours: Optional[int] = Query(None, ge=1, le=720),
    saved_view: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    if saved_view == "high_priority":
        risk_level = None
        query = _build_query(db, status="Open", hours=72)
        query = query.filter(Incident.risk_level.in_(["CRITICAL", "HIGH"]))
    elif saved_view == "sla_watch":
        query = _build_query(db, status="Open")
        query = query.filter(Incident.sla_due_at.isnot(None), Incident.sla_due_at < datetime.utcnow() + timedelta(minutes=30))
    elif saved_view == "real_telemetry":
        query = _build_query(db, source="real_windows_event_log", hours=72)
    else:
        query = _build_query(
            db,
            status=status,
            workflow_state=workflow_state,
            risk_level=risk_level,
            source=source,
            owner=owner,
            mitre_technique=mitre_technique,
            search=search,
            hours=hours,
        )

    total = query.count()
    incidents = query.order_by(desc(Incident.last_seen), desc(Incident.risk_score)).offset(offset).limit(limit).all()
    return {"total": total, "incidents": [_serialize_incident(incident) for incident in incidents]}


@router.get("/incidents/views")
def incident_saved_views():
    return {
        "views": [
            {"id": "high_priority", "label": "High Priority Queue", "description": "Open CRITICAL/HIGH cases from the last 72 hours."},
            {"id": "sla_watch", "label": "SLA Watch", "description": "Cases that are nearing or breaching analyst SLA."},
            {"id": "real_telemetry", "label": "Real Telemetry", "description": "Cases generated from local Windows event log collection."},
        ]
    }


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return {"error": "Incident not found"}
    return _serialize_incident(incident)


@router.get("/incidents/{incident_id}/detail")
def get_incident_detail(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return {"error": "Incident not found"}

    log_query = db.query(LogEntry)
    if incident.source_ip:
        log_query = log_query.filter(LogEntry.source_ip == incident.source_ip)
    related_logs = log_query.order_by(desc(LogEntry.timestamp)).limit(20).all()
    related_incidents = (
        db.query(Incident)
        .filter(Incident.case_key == incident.case_key, Incident.id != incident.id)
        .order_by(desc(Incident.last_seen))
        .limit(10)
        .all()
    )
    campaign = db.query(AttackCampaign).filter(AttackCampaign.id == incident.campaign_id).first() if incident.campaign_id else None

    detail = _serialize_incident(incident)
    detail.update({
        "related_logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "event_id": log.event_id,
                "user": log.user,
                "status": log.status,
                "log_type": log.log_type,
                "source_ip": log.source_ip,
                "raw_log": (log.raw_log or "")[:400],
            }
            for log in related_logs
        ],
        "related_incidents": [_serialize_incident(item) for item in related_incidents],
        "campaign": {
            "id": campaign.id,
            "name": campaign.name,
            "status": campaign.status,
            "risk_level": campaign.risk_level,
            "risk_score": campaign.risk_score,
            "summary": campaign.summary,
            "stages": [stage.get("stage") for stage in (campaign.stages_progression or [])],
        } if campaign else None,
    })
    return detail


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    workflow_state: Optional[str] = None
    owner: Optional[str] = None
    analyst_notes: Optional[str] = None


@router.put("/incidents/{incident_id}")
def update_incident(incident_id: int, update: IncidentUpdate, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return {"error": "Incident not found"}

    history = list(incident.status_history or [])
    if update.status:
        incident.status = update.status
        if update.status in ("Resolved", "Closed"):
            incident.resolved_at = datetime.utcnow()
            if not update.workflow_state:
                incident.workflow_state = "Resolve"
        elif update.status == "Investigating" and not update.workflow_state:
            incident.workflow_state = "Investigate"
    if update.workflow_state:
        incident.workflow_state = update.workflow_state
    if update.owner is not None:
        incident.owner = update.owner or "Unassigned"
    if update.analyst_notes is not None:
        incident.analyst_notes = update.analyst_notes

    history.append({
        "timestamp": datetime.utcnow().isoformat(),
        "workflow_state": incident.workflow_state,
        "status": incident.status,
        "owner": incident.owner,
        "note": "Analyst updated the case state.",
    })
    incident.status_history = history[-25:]
    db.commit()
    db.refresh(incident)
    return {"message": "Incident updated", "incident": _serialize_incident(incident)}


@router.get("/logs")
def list_logs(
    source_ip: Optional[str] = Query(None),
    log_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(LogEntry).order_by(desc(LogEntry.timestamp))
    if source_ip:
        query = query.filter(LogEntry.source_ip == source_ip)
    if log_type:
        query = query.filter(LogEntry.log_type == log_type)
    total = query.count()
    logs = query.offset(offset).limit(limit).all()
    return {
        "total": total,
        "logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "source_ip": log.source_ip,
                "event_id": log.event_id,
                "user": log.user,
                "status": log.status,
                "log_type": log.log_type,
                "raw_log": log.raw_log[:200] if log.raw_log else None,
            }
            for log in logs
        ],
    }


@router.get("/investigate/{ip_address}")
def investigate_ip(ip_address: str, db: Session = Depends(get_db)):
    ip_state = db.query(IPState).filter(IPState.ip_address == ip_address).first()
    related_incidents = db.query(Incident).filter(Incident.source_ip == ip_address).order_by(desc(Incident.last_seen)).limit(20).all()
    related_logs = db.query(LogEntry).filter(LogEntry.source_ip == ip_address).order_by(desc(LogEntry.timestamp)).limit(50).all()

    related_campaigns = []
    for campaign in db.query(AttackCampaign).filter(AttackCampaign.status.in_(["Active", "Dormant"])).all():
        if ip_address in (campaign.source_ips or []):
            related_campaigns.append({
                "id": campaign.id,
                "name": campaign.name,
                "status": campaign.status,
                "risk_level": campaign.risk_level,
                "stages": [stage.get("stage") for stage in (campaign.stages_progression or [])],
            })

    return {
        "ip_address": ip_address,
        "state": {
            "failed_logins": ip_state.failed_logins if ip_state else 0,
            "attack_stages": ip_state.stages_detected if ip_state else [],
            "first_seen": ip_state.first_seen.isoformat() if ip_state and ip_state.first_seen else None,
            "last_seen": ip_state.last_seen.isoformat() if ip_state and ip_state.last_seen else None,
            "total_events": ip_state.total_events if ip_state else 0,
        },
        "campaigns": related_campaigns,
        "incident_count": len(related_incidents),
        "incidents": [_serialize_incident(incident) for incident in related_incidents],
        "log_count": len(related_logs),
        "recent_logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "event_id": log.event_id,
                "status": log.status,
                "raw_log": log.raw_log[:150] if log.raw_log else None,
            }
            for log in related_logs[:10]
        ],
    }


@router.get("/timeline/{ip_address}")
def get_attack_timeline(ip_address: str, db: Session = Depends(get_db)):
    logs = db.query(LogEntry).filter(LogEntry.source_ip == ip_address).order_by(LogEntry.timestamp).all()
    incidents = db.query(Incident).filter(Incident.source_ip == ip_address).order_by(Incident.timestamp).all()
    timeline = []
    for log in logs:
        timeline.append({
            "type": "log",
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "event_id": log.event_id,
            "user": log.user,
            "status": log.status,
            "description": log.raw_log[:120] if log.raw_log else "Unknown event",
        })
    for incident in incidents:
        timeline.append({
            "type": "incident",
            "timestamp": incident.timestamp.isoformat() if incident.timestamp else None,
            "threat_type": incident.threat_type,
            "risk_level": incident.risk_level,
            "mitre_technique": incident.mitre_technique,
            "description": f"[{incident.risk_level}] {incident.threat_type}",
            "workflow_state": incident.workflow_state,
        })

    timeline.sort(key=lambda item: item.get("timestamp") or "")
    campaign_info = None
    for campaign in db.query(AttackCampaign).all():
        if ip_address in (campaign.source_ips or []):
            campaign_info = {
                "campaign_id": campaign.id,
                "campaign_name": campaign.name,
                "risk_level": campaign.risk_level,
                "stages_progression": [stage.get("stage") for stage in (campaign.stages_progression or [])],
                "duration_hours": round((campaign.last_seen - campaign.first_seen).total_seconds() / 3600, 1) if campaign.last_seen and campaign.first_seen else 0,
            }
            break
    return {"ip_address": ip_address, "total_events": len(timeline), "campaign": campaign_info, "timeline": timeline}


@router.get("/campaigns")
def list_campaigns(status: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(AttackCampaign).order_by(desc(AttackCampaign.last_seen))
    if status:
        query = query.filter(AttackCampaign.status == status)
    campaigns = query.all()
    return {
        "total": len(campaigns),
        "campaigns": [
            {
                "id": campaign.id,
                "name": campaign.name,
                "status": campaign.status,
                "risk_level": campaign.risk_level,
                "risk_score": campaign.risk_score,
                "source_ips": campaign.source_ips,
                "target_users": campaign.target_users,
                "mitre_techniques": campaign.mitre_techniques,
                "stages": [stage.get("stage") for stage in (campaign.stages_progression or [])],
                "first_seen": campaign.first_seen.isoformat() if campaign.first_seen else None,
                "last_seen": campaign.last_seen.isoformat() if campaign.last_seen else None,
                "duration_hours": round((campaign.last_seen - campaign.first_seen).total_seconds() / 3600, 1) if campaign.last_seen and campaign.first_seen else 0,
            }
            for campaign in campaigns
        ],
    }


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(AttackCampaign).filter(AttackCampaign.id == campaign_id).first()
    if not campaign:
        return {"error": "Campaign not found"}

    related_incidents = db.query(Incident).filter(Incident.campaign_id == campaign_id).order_by(Incident.timestamp).all()
    return {
        "id": campaign.id,
        "name": campaign.name,
        "status": campaign.status,
        "risk_level": campaign.risk_level,
        "risk_score": campaign.risk_score,
        "source_ips": campaign.source_ips,
        "target_users": campaign.target_users,
        "mitre_techniques": campaign.mitre_techniques,
        "stages_progression": campaign.stages_progression,
        "summary": campaign.summary,
        "first_seen": campaign.first_seen.isoformat() if campaign.first_seen else None,
        "last_seen": campaign.last_seen.isoformat() if campaign.last_seen else None,
        "incidents": [_serialize_incident(item) for item in related_incidents],
    }


@router.put("/campaigns/{campaign_id}/close")
def close_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.query(AttackCampaign).filter(AttackCampaign.id == campaign_id).first()
    if not campaign:
        return {"error": "Campaign not found"}
    campaign.status = "Closed"
    db.commit()
    return {"message": f"Campaign '{campaign.name}' closed"}


@router.get("/ingestion-health")
def get_ingestion_health(db: Session = Depends(get_db)):
    sources = db.query(SourceHealth).order_by(SourceHealth.source_key).all()
    collector = get_collector_status()
    return {
        "collector": collector,
        "sources": [
            {
                "source_key": source.source_key,
                "display_name": source.display_name,
                "last_event_at": source.last_event_at.isoformat() if source.last_event_at else None,
                "last_success_at": source.last_success_at.isoformat() if source.last_success_at else None,
                "last_error_at": source.last_error_at.isoformat() if source.last_error_at else None,
                "last_error": source.last_error,
                "events_ingested": source.events_ingested or 0,
                "incidents_created": source.incidents_created or 0,
                "parse_failures": source.parse_failures or 0,
                "dropped_events": source.dropped_events or 0,
                "collector_interval_seconds": source.collector_interval_seconds,
                "last_lag_seconds": source.last_lag_seconds,
            }
            for source in sources
        ],
    }


@router.get("/settings")
def settings_view():
    return get_app_settings()


class SettingsUpdate(BaseModel):
    demo_mode: Optional[bool] = None
    collector: Optional[dict] = None
    retention: Optional[dict] = None
    feeds: Optional[dict] = None
    detection: Optional[dict] = None


@router.put("/settings")
def settings_update(payload: SettingsUpdate):
    return update_app_settings(payload.model_dump(exclude_none=True))


@router.post("/lifecycle/sweep")
def lifecycle_sweep(db: Session = Depends(get_db)):
    return run_incident_lifecycle_sweep(db)


@router.post("/reset")
def reset_dashboard(db: Session = Depends(get_db)):
    from services.log_seed import seed_demo_attacks
    from models.db_models import ChatMessage

    try:
        db.query(LogEntry).delete()
        db.query(Incident).delete()
        db.query(AttackCampaign).delete()
        db.query(IPState).delete()
        db.query(SourceHealth).delete()
        db.query(Blocklist).filter(Blocklist.auto_blocked == True).delete()
        db.query(ChatMessage).delete()
        db.commit()
        seed_demo_attacks(db)
        return {"message": "System reset and simulation re-triggered successfully."}
    except Exception as exc:
        db.rollback()
        return {"error": f"Reset failed: {str(exc)}"}


@router.post("/correlate")
def trigger_correlation():
    from services.correlation_engine import run_correlation_sweep

    findings = run_correlation_sweep()
    return {"findings": findings, "total": len(findings)}
