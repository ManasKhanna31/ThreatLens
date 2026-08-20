"""
ThreatLens Data Retention Manager
Ensures the database stays within free-tier limits (e.g., Render 512MB RAM / 1GB disk).
Can be scaled up later via environment variables.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import logging
import os
from models.db_models import LogEntry, Incident, ChatMessage
from services.app_settings import get_app_settings

logger = logging.getLogger("threatlens.retention")

# Configurable limits (small for prototype/free-tier, can increase later)
MAX_LOG_ENTRIES = int(os.getenv("MAX_LOG_ENTRIES", "2000"))
MAX_INCIDENTS = int(os.getenv("MAX_INCIDENTS", "750"))
MAX_CHAT_MESSAGES = int(os.getenv("MAX_CHAT_MESSAGES", "200"))

def enforce_retention_policies(db: Session):
    """Run all retention cleanup tasks to prevent DB bloating."""
    try:
        retention = get_app_settings().get("retention", {})
        cleaned_logs = _prune_table_by_count(db, LogEntry, retention.get("max_logs", MAX_LOG_ENTRIES))
        cleaned_inc = _prune_table_by_count(db, Incident, retention.get("max_incidents", MAX_INCIDENTS))
        cleaned_chat = _prune_table_by_count(db, ChatMessage, retention.get("max_chats", MAX_CHAT_MESSAGES))
        
        db.commit()
        
        total_cleaned = cleaned_logs + cleaned_inc + cleaned_chat
        if total_cleaned > 0:
            logger.info(f"[Retention] Pruned old records: {cleaned_logs} logs, {cleaned_inc} incidents, {cleaned_chat} chats.")
            
    except Exception as e:
        logger.error(f"[Retention] Error enforcing policies: {e}")
        db.rollback()

def _prune_table_by_count(db: Session, model, max_count: int) -> int:
    """Deletes oldest rows if the table exceeds max_count."""
    count = db.query(func.count(model.id)).scalar()
    if count <= max_count:
        return 0
        
    to_delete_count = count - max_count
    
    # Find the ID of the oldest record we want to KEEP
    # Order by ID descending, skip 'max_count', get the ID. Everything <= that ID gets deleted.
    oldest_kept = db.query(model.id).order_by(model.id.desc()).offset(max_count - 1).first()
    
    if oldest_kept:
        cutoff_id = oldest_kept[0]
        deleted = db.query(model).filter(model.id < cutoff_id).delete(synchronize_session=False)
        return deleted
    return 0
