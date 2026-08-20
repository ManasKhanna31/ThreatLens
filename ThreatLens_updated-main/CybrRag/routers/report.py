from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from models.database import get_db
from models.db_models import Incident
from services.report_service import build_incident_report, build_operational_report

router = APIRouter()


@router.get("/incident/{incident_id}")
def generate_incident_report(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return {"error": "Incident not found"}
    return build_incident_report(incident)


@router.get("/operations")
def generate_operations_report(
    hours: int = Query(168, ge=1, le=720),
    risk_level: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    query = db.query(Incident).filter(Incident.last_seen >= cutoff)
    if risk_level:
        query = query.filter(Incident.risk_level == risk_level)
    if status:
        query = query.filter(Incident.status == status)
    if source:
        query = query.filter(Incident.source == source)
    incidents = query.order_by(Incident.last_seen.desc()).limit(limit).all()
    title = f"SOC Operations Report - last {hours}h"
    return build_operational_report(incidents, title=title)
