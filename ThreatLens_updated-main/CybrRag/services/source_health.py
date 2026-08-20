from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models.db_models import SourceHealth


DISPLAY_NAMES = {
    "manual_analysis": "Manual Analysis",
    "bulk_ingest": "Bulk Ingest",
    "webhook": "Webhook",
    "real_windows_event_log": "Windows Event Log Collector",
}


def record_source_health(
    db: Session,
    source_key: str,
    *,
    display_name: Optional[str] = None,
    event_timestamp: Optional[datetime] = None,
    ingested: int = 0,
    incidents_created: int = 0,
    parse_failures: int = 0,
    dropped_events: int = 0,
    error: Optional[str] = None,
    collector_interval_seconds: Optional[int] = None,
) -> SourceHealth:
    entry = db.query(SourceHealth).filter(SourceHealth.source_key == source_key).first()
    if not entry:
        entry = SourceHealth(
            source_key=source_key,
            display_name=display_name or DISPLAY_NAMES.get(source_key, source_key.replace("_", " ").title()),
            events_ingested=0,
            incidents_created=0,
            parse_failures=0,
            dropped_events=0,
        )
        db.add(entry)
        db.flush()

    now = datetime.utcnow()
    entry.display_name = display_name or DISPLAY_NAMES.get(source_key, entry.display_name or source_key.replace("_", " ").title())
    entry.events_ingested = (entry.events_ingested or 0) + ingested
    entry.incidents_created = (entry.incidents_created or 0) + incidents_created
    entry.parse_failures = (entry.parse_failures or 0) + parse_failures
    entry.dropped_events = (entry.dropped_events or 0) + dropped_events
    entry.last_success_at = now
    if event_timestamp:
        entry.last_event_at = event_timestamp
        entry.last_lag_seconds = max((now - event_timestamp).total_seconds(), 0)
    if collector_interval_seconds is not None:
        entry.collector_interval_seconds = collector_interval_seconds
    if error:
        entry.last_error = error
        entry.last_error_at = now
    return entry


def mark_source_error(db: Session, source_key: str, error: str) -> SourceHealth:
    entry = db.query(SourceHealth).filter(SourceHealth.source_key == source_key).first()
    if not entry:
        entry = SourceHealth(
            source_key=source_key,
            display_name=DISPLAY_NAMES.get(source_key, source_key.replace("_", " ").title()),
        )
        db.add(entry)
        db.flush()
    entry.last_error = error
    entry.last_error_at = datetime.utcnow()
    return entry
