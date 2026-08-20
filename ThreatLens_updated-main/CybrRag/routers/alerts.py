from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models.database import get_db
from models.db_models import AlertRule, Blocklist
from services.threat_intel_ingestion import ingest_all, get_intel_stats

router = APIRouter()


# ========================
#  Alert Rules CRUD
# ========================
class AlertRuleCreate(BaseModel):
    name: str
    description: str = ""
    condition_type: str  # "risk_level", "risk_level_min", "threat_type", "multi_stage"
    condition_value: str
    action_type: str  # "webhook", "slack", "email", "block_ip", "escalate"
    action_config: dict = {}
    enabled: bool = True


@router.get("/rules")
def list_alert_rules(db: Session = Depends(get_db)):
    rules = db.query(AlertRule).all()
    return {
        "rules": [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "condition_type": r.condition_type,
                "condition_value": r.condition_value,
                "action_type": r.action_type,
                "action_config": r.action_config,
                "enabled": r.enabled,
                "times_triggered": r.times_triggered,
                "last_triggered": r.last_triggered.isoformat() if r.last_triggered else None,
            }
            for r in rules
        ]
    }


@router.post("/rules")
def create_alert_rule(data: AlertRuleCreate, db: Session = Depends(get_db)):
    rule = AlertRule(
        name=data.name,
        description=data.description,
        condition_type=data.condition_type,
        condition_value=data.condition_value,
        action_type=data.action_type,
        action_config=data.action_config,
        enabled=data.enabled,
    )
    db.add(rule)
    db.commit()
    return {"message": f"Alert rule '{data.name}' created", "id": rule.id}


@router.put("/rules/{rule_id}/toggle")
def toggle_alert_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        return {"error": "Rule not found"}
    rule.enabled = not rule.enabled
    db.commit()
    return {"message": f"Rule '{rule.name}' {'enabled' if rule.enabled else 'disabled'}"}


@router.delete("/rules/{rule_id}")
def delete_alert_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        return {"error": "Rule not found"}
    db.delete(rule)
    db.commit()
    return {"message": f"Rule '{rule.name}' deleted"}


# ========================
#  Blocklist
# ========================
class BlockIPInput(BaseModel):
    ip_address: str
    reason: str = "Manually blocked by analyst"


@router.get("/blocklist")
def get_blocklist(db: Session = Depends(get_db)):
    blocked = db.query(Blocklist).order_by(desc(Blocklist.blocked_at)).all()
    return {
        "total": len(blocked),
        "blocked_ips": [
            {
                "id": b.id,
                "ip_address": b.ip_address,
                "reason": b.reason,
                "blocked_at": b.blocked_at.isoformat() if b.blocked_at else None,
                "auto_blocked": b.auto_blocked,
            }
            for b in blocked
        ],
    }


@router.post("/blocklist")
def block_ip(data: BlockIPInput, db: Session = Depends(get_db)):
    existing = db.query(Blocklist).filter(Blocklist.ip_address == data.ip_address).first()
    if existing:
        return {"error": f"IP {data.ip_address} already blocked"}

    block = Blocklist(
        ip_address=data.ip_address,
        reason=data.reason,
        auto_blocked=False,
    )
    db.add(block)
    db.commit()
    return {"message": f"IP {data.ip_address} blocked", "id": block.id}


@router.delete("/blocklist/{block_id}")
def unblock_ip(block_id: int, db: Session = Depends(get_db)):
    block = db.query(Blocklist).filter(Blocklist.id == block_id).first()
    if not block:
        return {"error": "Entry not found"}
    ip = block.ip_address
    db.delete(block)
    db.commit()
    return {"message": f"IP {ip} unblocked"}


# ========================
#  Threat Intelligence
# ========================
@router.post("/intel/ingest")
def trigger_intel_ingestion():
    """Manually trigger threat intelligence ingestion from all feeds."""
    results = ingest_all()
    return {"message": "Ingestion complete", "results": results}


@router.get("/intel/stats")
def intel_statistics(db: Session = Depends(get_db)):
    """Get threat intelligence database statistics."""
    return get_intel_stats(db)


@router.get("/intel/iocs")
def get_intel_iocs(db: Session = Depends(get_db)):
    """Get list of recent IOCs."""
    from models.db_models import ThreatIntelEntry
    iocs = db.query(ThreatIntelEntry).order_by(desc(ThreatIntelEntry.ingested_at)).limit(200).all()
    return {
        "iocs": [
            {
                "id": i.id,
                "source": i.source,
                "threat_name": i.title,
                "ioc_type": i.ioc_type,
                "ioc_value": i.ioc_value,
                "severity": i.severity,
            }
            for i in iocs
        ]
    }
