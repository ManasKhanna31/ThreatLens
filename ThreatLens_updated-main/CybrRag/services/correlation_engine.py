"""
ThreatLens Background Correlation Engine
Runs on a schedule to proactively hunt for threats that single-log analysis misses:
  - Slow brute force (spread over days)
  - Distributed attacks (multiple IPs targeting same user)
  - Dormant campaign reactivation
  - Auto-escalation of multi-stage incidents
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from models.database import SessionLocal
from models.db_models import IPState, Incident, LogEntry, AttackCampaign, Blocklist
import logging

logger = logging.getLogger("threatlens.correlation")


def run_correlation_sweep():
    """Main entry point — runs all correlation checks."""
    db = SessionLocal()
    try:
        logger.info("[Correlation Engine] Starting sweep...")
        findings = []

        findings += _detect_slow_brute_force(db)
        findings += _detect_distributed_attacks(db)
        findings += _escalate_multi_stage_campaigns(db)
        findings += _mark_dormant_campaigns(db)
        findings += _auto_block_repeat_offenders(db)

        db.commit()
        logger.info(f"[Correlation Engine] Sweep complete. {len(findings)} findings.")
        return findings
    except Exception as e:
        logger.error(f"[Correlation Engine] Error: {e}")
        db.rollback()
        return []
    finally:
        db.close()


def _detect_slow_brute_force(db: Session) -> list:
    """
    Detect IPs with failed logins spread across multiple days.
    A normal brute force happens in minutes — a slow one spreads over days to evade detection.
    """
    findings = []
    since = datetime.utcnow() - timedelta(days=7)

    # Find IPs with 5+ failed logins in the past week
    slow_ips = db.query(IPState).filter(
        IPState.failed_logins >= 5,
        IPState.last_seen >= since,
    ).all()

    for ip_state in slow_ips:
        if not ip_state.first_seen:
            continue
        duration = (ip_state.last_seen - ip_state.first_seen).total_seconds() / 3600

        # If the failures are spread over more than 12 hours, it's a slow brute force
        if duration > 12:
            existing = db.query(Incident).filter(
                Incident.source_ip == ip_state.ip_address,
                Incident.threat_type == "Slow Brute Force (Multi-Day)",
            ).first()

            if not existing:
                incident = Incident(
                    threat_type="Slow Brute Force (Multi-Day)",
                    risk_level="HIGH",
                    risk_score=70,
                    source_ip=ip_state.ip_address,
                    mitre_technique="T1110",
                    soc_summary={
                        "auto_detected": True,
                        "engine": "correlation",
                        "detail": f"{ip_state.failed_logins} failed logins over {round(duration, 1)} hours",
                    },
                    status="Open",
                )
                db.add(incident)
                findings.append(f"Slow brute force: {ip_state.ip_address} ({ip_state.failed_logins} failures over {round(duration)}h)")

    return findings


def _detect_distributed_attacks(db: Session) -> list:
    """
    Detect multiple IPs targeting the same user account — distributed brute force.
    """
    findings = []
    since = datetime.utcnow() - timedelta(days=3)

    # Find users targeted by 3+ different IPs with failed logins
    user_attacks = (
        db.query(
            LogEntry.user,
            func.count(distinct(LogEntry.source_ip)).label("ip_count"),
        )
        .filter(
            LogEntry.timestamp >= since,
            LogEntry.status == "Failed",
            LogEntry.user.isnot(None),
            LogEntry.source_ip.isnot(None),
        )
        .group_by(LogEntry.user)
        .having(func.count(distinct(LogEntry.source_ip)) >= 3)
        .all()
    )

    for user, ip_count in user_attacks:
        existing = db.query(Incident).filter(
            Incident.threat_type == "Distributed Brute Force",
            Incident.soc_summary.like(f'%"{user}"%'),
            Incident.timestamp >= since,
        ).first()

        if not existing:
            incident = Incident(
                threat_type="Distributed Brute Force",
                risk_level="CRITICAL",
                risk_score=85,
                source_ip=None,
                mitre_technique="T1110.004",
                soc_summary={
                    "auto_detected": True,
                    "engine": "correlation",
                    "target_user": user,
                    "unique_source_ips": ip_count,
                    "detail": f"User '{user}' targeted by {ip_count} different IPs in 3 days",
                },
                status="Open",
            )
            db.add(incident)
            findings.append(f"Distributed attack on user '{user}' from {ip_count} IPs")

    return findings


def _escalate_multi_stage_campaigns(db: Session) -> list:
    """
    Auto-escalate campaigns that have progressed through 2+ attack stages.
    """
    findings = []
    campaigns = db.query(AttackCampaign).filter(
        AttackCampaign.status == "Active"
    ).all()

    for camp in campaigns:
        stages = set()
        for entry in (camp.stages_progression or []):
            stages.add(entry.get("stage"))

        if len(stages) >= 3 and camp.risk_level != "CRITICAL":
            camp.risk_level = "CRITICAL"
            camp.risk_score = 95.0

            # Escalate all related open incidents
            related = db.query(Incident).filter(
                Incident.campaign_id == camp.id,
                Incident.status == "Open",
            ).all()
            for inc in related:
                inc.status = "Investigating"

            findings.append(f"Campaign '{camp.name}' escalated to CRITICAL ({len(stages)} stages)")

        elif len(stages) >= 2 and camp.risk_level == "LOW":
            camp.risk_level = "HIGH"
            camp.risk_score = 70.0
            findings.append(f"Campaign '{camp.name}' escalated to HIGH ({len(stages)} stages)")

    return findings


def _mark_dormant_campaigns(db: Session) -> list:
    """
    Mark campaigns as Dormant if no activity for 48 hours.
    They stay in the system (never deleted) and reactivate on new activity.
    """
    findings = []
    cutoff = datetime.utcnow() - timedelta(hours=48)

    dormant = db.query(AttackCampaign).filter(
        AttackCampaign.status == "Active",
        AttackCampaign.last_seen < cutoff,
    ).all()

    for camp in dormant:
        camp.status = "Dormant"
        findings.append(f"Campaign '{camp.name}' marked Dormant (no activity for 48h)")

    return findings


def _auto_block_repeat_offenders(db: Session) -> list:
    """
    Auto-add IPs to blocklist if they have 10+ failed logins and are involved
    in active campaigns with 2+ stages.
    """
    findings = []

    offenders = db.query(IPState).filter(IPState.failed_logins >= 10).all()

    for ip_state in offenders:
        # Check if already blocked
        existing = db.query(Blocklist).filter(
            Blocklist.ip_address == ip_state.ip_address
        ).first()

        if existing:
            continue

        stages = ip_state.stages_detected or []
        if len(stages) >= 2:
            block = Blocklist(
                ip_address=ip_state.ip_address,
                reason=f"Auto-blocked: {ip_state.failed_logins} failed logins, stages: {', '.join(stages)}",
                auto_blocked=True,
            )
            db.add(block)
            findings.append(f"Auto-blocked IP: {ip_state.ip_address}")

    return findings
