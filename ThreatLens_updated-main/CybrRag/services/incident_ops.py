from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from sqlalchemy.orm import Session

from models.db_models import Incident
from services.app_settings import get_app_settings


SEVERITY_RANK = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


def _detection_settings() -> dict:
    return get_app_settings().get("detection", {})


def build_incident_summary(
    source: str,
    detection: Dict[str, Any],
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload = {
        "source": source,
        "threat": detection.get("threat_detected"),
        "all_threats": detection.get("all_threats_detected", []),
        "multi_stage_correlation": detection.get("multi_stage_correlation"),
        "confidence": detection.get("confidence"),
    }
    if extra:
        payload.update(extra)
    return payload


def build_case_key(source: str, threat_type: Optional[str], source_ip: Optional[str], mitre_technique: Optional[str]) -> str:
    threat = (threat_type or "unknown").strip().lower().replace(" ", "-")
    ip = (source_ip or "no-ip").strip().lower()
    mitre = (mitre_technique or "no-mitre").strip().lower()
    return f"{source}:{threat}:{ip}:{mitre}"


def compute_sla_due_at(risk_level: str, opened_at: datetime) -> datetime:
    sla_minutes = _detection_settings().get("sla_minutes", {})
    minutes = sla_minutes.get((risk_level or "LOW").upper(), 720)
    return opened_at + timedelta(minutes=minutes)


def _status_history_entry(state: str, note: str, owner: str = "system") -> Dict[str, str]:
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "workflow_state": state,
        "note": note,
        "owner": owner,
    }


def build_incident_explanation(
    detection: Dict[str, Any],
    risk: Dict[str, Any],
    *,
    parsed: Optional[Dict[str, Any]] = None,
    ioc_matches: Optional[list] = None,
    blocklist_hit: bool = False,
    source: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "why_detected": detection.get("all_threats_detected") or [detection.get("threat_detected")],
        "confidence": detection.get("confidence"),
        "mitre_mapping": detection.get("all_mitre_techniques") or ([detection.get("mitre_candidate")] if detection.get("mitre_candidate") else []),
        "ioc_match_count": len(ioc_matches or []),
        "risk_factors": risk.get("risk_factors", []),
        "blocklist_hit": blocklist_hit,
        "log_type": parsed.get("log_type") if parsed else None,
        "source": source,
    }


def build_evidence_item(
    *,
    event_timestamp: datetime,
    source: str,
    log_id: Optional[int],
    parsed: Optional[Dict[str, Any]],
    detection: Dict[str, Any],
    risk: Dict[str, Any],
    raw_log: Optional[str],
    ioc_matches: Optional[list],
) -> Dict[str, Any]:
    return {
        "timestamp": event_timestamp.isoformat(),
        "source": source,
        "log_id": log_id,
        "threat": detection.get("threat_detected"),
        "confidence": detection.get("confidence"),
        "mitre": detection.get("mitre_candidate"),
        "stage": detection.get("current_stage"),
        "risk_level": risk.get("risk_level"),
        "risk_score": risk.get("risk_score"),
        "ioc_matches": ioc_matches or [],
        "parsed": parsed or {},
        "raw_excerpt": (raw_log or "")[:260],
    }


def default_recommended_actions(threat_type: Optional[str], risk_level: str, source_ip: Optional[str]) -> list[str]:
    actions = ["Review evidence and confirm the triggering behavior."]
    low_threat = (threat_type or "").lower()
    if source_ip:
        actions.append(f"Investigate activity from {source_ip} across related logs and incidents.")
    if "brute" in low_threat or "login" in low_threat:
        actions.append("Check authentication logs for successful access after repeated failures.")
        actions.append("Reset or challenge the affected account if compromise is suspected.")
    if "powershell" in low_threat or "execution" in low_threat:
        actions.append("Review command-line execution and isolate the endpoint if malicious tooling is confirmed.")
    if "secret" in low_threat or "workflow" in low_threat:
        actions.append("Review repository permissions, recent commits, branch protection, and CI/CD secret exposure.")
    if "sql" in low_threat or "web" in low_threat or "path" in low_threat:
        actions.append("Review web access logs, WAF events, affected routes, and application error telemetry.")
    if risk_level in ("HIGH", "CRITICAL"):
        actions.append("Escalate to containment and consider blocking the source or isolating the host.")
    return actions


def create_or_update_incident(
    db: Session,
    *,
    source: str,
    detection: Dict[str, Any],
    risk: Dict[str, Any],
    source_ip: Optional[str],
    parsed: Optional[Dict[str, Any]] = None,
    raw_log: Optional[str] = None,
    log_id: Optional[int] = None,
    event_timestamp: Optional[datetime] = None,
    ioc_matches: Optional[list] = None,
    blocklist_hit: bool = False,
    campaign_id: Optional[int] = None,
    asset_id: Optional[int] = None,
    summary_extra: Optional[Dict[str, Any]] = None,
) -> Tuple[Optional[Incident], bool, bool]:
    threat_type = detection.get("threat_detected")
    if not threat_type:
        return None, False, False

    now = event_timestamp or datetime.utcnow()
    detection_settings = _detection_settings()
    group_window_hours = detection_settings.get("group_window_hours", 24)
    reopen_window_hours = detection_settings.get("reopen_window_hours", 8)

    case_key = build_case_key(source, threat_type, source_ip, detection.get("mitre_candidate"))
    cutoff = now - timedelta(hours=group_window_hours)
    incident = (
        db.query(Incident)
        .filter(Incident.case_key == case_key, Incident.last_seen >= cutoff)
        .order_by(Incident.last_seen.desc())
        .first()
    )

    recommended_actions = default_recommended_actions(threat_type, risk.get("risk_level", "LOW"), source_ip)
    evidence_item = build_evidence_item(
        event_timestamp=now,
        source=source,
        log_id=log_id,
        parsed=parsed,
        detection=detection,
        risk=risk,
        raw_log=raw_log,
        ioc_matches=ioc_matches,
    )
    explanation = build_incident_explanation(
        detection,
        risk,
        parsed=parsed,
        ioc_matches=ioc_matches,
        blocklist_hit=blocklist_hit,
        source=source,
    )
    summary = build_incident_summary(source, detection, summary_extra)

    if incident:
        reopened = False
        incident.alert_count = (incident.alert_count or 1) + 1
        incident.last_seen = now
        incident.risk_score = max(incident.risk_score or 0, risk.get("risk_score", 0))
        if SEVERITY_RANK.get(risk.get("risk_level", "LOW"), 0) >= SEVERITY_RANK.get(incident.risk_level or "LOW", 0):
            incident.risk_level = risk.get("risk_level", incident.risk_level)
        incident.source = source
        incident.mitre_technique = detection.get("mitre_candidate") or incident.mitre_technique
        incident.soc_summary = summary
        incident.explanation = explanation
        incident.recommended_actions = recommended_actions
        incident.campaign_id = campaign_id or incident.campaign_id
        incident.asset_id = asset_id or incident.asset_id

        evidence = list(incident.evidence or [])
        evidence.append(evidence_item)
        incident.evidence = evidence[-20:]

        history = list(incident.status_history or [])
        if incident.status in ("Resolved", "Closed") and incident.resolved_at and incident.resolved_at >= now - timedelta(hours=reopen_window_hours):
            incident.status = "Open"
            incident.workflow_state = "Triage"
            incident.resolved_at = None
            incident.sla_due_at = compute_sla_due_at(risk.get("risk_level", "LOW"), now)
            history.append(_status_history_entry("Triage", "Incident automatically reopened after repeat activity."))
            reopened = True
        else:
            history.append(_status_history_entry(incident.workflow_state or "Triage", "Grouped repeat alert into existing case."))
        incident.status_history = history[-25:]
        return incident, False, reopened

    incident = Incident(
        timestamp=now,
        first_seen=now,
        last_seen=now,
        opened_at=now,
        sla_due_at=compute_sla_due_at(risk.get("risk_level", "LOW"), now),
        threat_type=threat_type,
        risk_level=risk.get("risk_level", "LOW"),
        risk_score=risk.get("risk_score", 0),
        source_ip=source_ip,
        mitre_technique=detection.get("mitre_candidate"),
        source=source,
        case_key=case_key,
        workflow_state="New",
        owner="Unassigned",
        alert_count=1,
        evidence=[evidence_item],
        explanation=explanation,
        recommended_actions=recommended_actions,
        status_history=[_status_history_entry("New", "Case opened from detection pipeline.")],
        soc_summary=summary,
        status="Open",
        campaign_id=campaign_id,
        asset_id=asset_id,
    )
    db.add(incident)
    db.flush()
    return incident, True, False


def should_create_incident(
    db: Session,
    threat_type: Optional[str],
    source_ip: Optional[str],
    risk_level: str,
    source: str,
    dedup_minutes: Optional[int] = None,
) -> tuple[bool, Optional[Incident]]:
    if not threat_type:
        return False, None

    minutes = dedup_minutes or _detection_settings().get("dedup_window_minutes", 20)
    cutoff = datetime.utcnow() - timedelta(minutes=minutes)
    query = db.query(Incident).filter(
        Incident.threat_type == threat_type,
        Incident.timestamp >= cutoff,
        Incident.source == source,
    )
    if source_ip:
        query = query.filter(Incident.source_ip == source_ip)
    else:
        query = query.filter(Incident.source_ip.is_(None))
    recent = query.order_by(Incident.timestamp.desc()).first()
    if not recent:
        return True, None
    if SEVERITY_RANK.get(risk_level, 0) > SEVERITY_RANK.get(recent.risk_level or "LOW", 0):
        return True, recent
    return False, recent


def run_incident_lifecycle_sweep(db: Session) -> dict:
    settings = _detection_settings()
    auto_close_hours = settings.get("auto_close_hours", {"LOW": 24, "MEDIUM": 72})
    now = datetime.utcnow()
    closed = 0
    breached = 0

    for incident in db.query(Incident).filter(Incident.status.in_(["Open", "Investigating"])).all():
        if incident.sla_due_at and incident.sla_due_at < now:
            breached += 1

        close_after = auto_close_hours.get((incident.risk_level or "").upper())
        if close_after and incident.last_seen and incident.last_seen <= now - timedelta(hours=close_after):
            incident.status = "Resolved"
            incident.workflow_state = "Resolve"
            incident.resolved_at = now
            history = list(incident.status_history or [])
            history.append(_status_history_entry("Resolve", "Incident auto-resolved after inactivity window."))
            incident.status_history = history[-25:]
            closed += 1

    db.commit()
    return {"auto_closed": closed, "sla_breached_open": breached}
