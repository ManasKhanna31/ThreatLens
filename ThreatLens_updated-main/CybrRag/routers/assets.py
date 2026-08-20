from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from models.database import get_db
from models.db_models import Incident, MonitoredAsset
from services.asset_monitor import (
    ASSET_TYPE_LABELS,
    ASSET_TYPE_PROFILES,
    build_asset_detail,
    infer_asset_name,
    normalize_asset_type,
    run_safe_asset_check,
    serialize_asset,
    simulate_asset_signals,
)

router = APIRouter()


class AssetCreate(BaseModel):
    target: str = Field(..., min_length=2)
    asset_type: str = "website"
    name: Optional[str] = None
    environment: str = "Demo"
    owner: str = "Unassigned"
    priority: str = "Medium"
    monitoring_mode: str = "Simulation"


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    target: Optional[str] = None
    environment: Optional[str] = None
    owner: Optional[str] = None
    priority: Optional[str] = None
    monitoring_mode: Optional[str] = None
    status: Optional[str] = None


def _asset_counts(db: Session, asset_id: int) -> tuple[int, int]:
    incident_count = db.query(func.count(Incident.id)).filter(Incident.asset_id == asset_id).scalar() or 0
    open_incidents = (
        db.query(func.count(Incident.id))
        .filter(Incident.asset_id == asset_id, Incident.status.in_(["Open", "Investigating"]))
        .scalar()
        or 0
    )
    return incident_count, open_incidents


@router.get("/types")
def asset_types():
    return {
        "types": [
            {"id": key, "label": label, "profile": ASSET_TYPE_PROFILES.get(key, {})}
            for key, label in ASSET_TYPE_LABELS.items()
        ]
    }


@router.get("")
def list_assets(
    asset_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(MonitoredAsset)
    if asset_type:
        query = query.filter(MonitoredAsset.asset_type == normalize_asset_type(asset_type))
    if status:
        query = query.filter(MonitoredAsset.status == status)
    assets = query.order_by(desc(MonitoredAsset.last_signal_at), desc(MonitoredAsset.created_at)).all()
    return {
        "total": len(assets),
        "assets": [
            serialize_asset(asset, *_asset_counts(db, asset.id))
            for asset in assets
        ],
    }


@router.post("")
def create_asset(payload: AssetCreate, db: Session = Depends(get_db)):
    asset_type = normalize_asset_type(payload.asset_type)
    existing = (
        db.query(MonitoredAsset)
        .filter(MonitoredAsset.asset_type == asset_type, MonitoredAsset.target == payload.target.strip())
        .first()
    )
    if existing:
        return {"message": "Asset already exists", "asset": serialize_asset(existing, *_asset_counts(db, existing.id))}

    asset = MonitoredAsset(
        name=payload.name or infer_asset_name(payload.target, asset_type),
        asset_type=asset_type,
        target=payload.target.strip(),
        environment=payload.environment,
        owner=payload.owner or "Unassigned",
        priority=payload.priority,
        monitoring_mode=payload.monitoring_mode,
        status="Active",
        metadata_json={"created_from": "asset_onboarding", "created_at": datetime.utcnow().isoformat()},
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return {"message": "Asset onboarded", "asset": serialize_asset(asset, *_asset_counts(db, asset.id))}


@router.get("/{asset_id}")
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(MonitoredAsset).filter(MonitoredAsset.id == asset_id).first()
    if not asset:
        return {"error": "Asset not found"}
    incidents = (
        db.query(Incident)
        .filter(Incident.asset_id == asset_id)
        .order_by(desc(Incident.last_seen))
        .limit(12)
        .all()
    )
    return {
        "asset": serialize_asset(asset, *_asset_counts(db, asset.id)),
        "detail": build_asset_detail(asset, incidents),
        "incidents": [
            {
                "id": incident.id,
                "threat_type": incident.threat_type,
                "risk_level": incident.risk_level,
                "risk_score": incident.risk_score,
                "status": incident.status,
                "workflow_state": incident.workflow_state,
                "source_ip": incident.source_ip,
                "last_seen": incident.last_seen.isoformat() if incident.last_seen else None,
                "alert_count": incident.alert_count or 1,
            }
            for incident in incidents
        ],
    }


@router.put("/{asset_id}")
def update_asset(asset_id: int, payload: AssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(MonitoredAsset).filter(MonitoredAsset.id == asset_id).first()
    if not asset:
        return {"error": "Asset not found"}
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return {"message": "Asset updated", "asset": serialize_asset(asset, *_asset_counts(db, asset.id))}


@router.post("/{asset_id}/check")
def check_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(MonitoredAsset).filter(MonitoredAsset.id == asset_id).first()
    if not asset:
        return {"error": "Asset not found"}
    result = run_safe_asset_check(asset)
    db.commit()
    db.refresh(asset)
    return {"message": "Asset check complete", "check": result, "asset": serialize_asset(asset, *_asset_counts(db, asset.id))}


@router.post("/{asset_id}/simulate")
def simulate_asset(asset_id: int, count: int = Query(3, ge=1, le=5), db: Session = Depends(get_db)):
    asset = db.query(MonitoredAsset).filter(MonitoredAsset.id == asset_id).first()
    if not asset:
        return {"error": "Asset not found"}
    result = simulate_asset_signals(db, asset, count=count)
    db.commit()
    db.refresh(asset)
    return {"message": "SOC signals generated", "result": result, "asset": serialize_asset(asset, *_asset_counts(db, asset.id))}
