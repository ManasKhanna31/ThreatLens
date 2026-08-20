from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from models.database import Base


class LogEntry(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    source_ip = Column(String(50), index=True)
    event_id = Column(String(50))
    user = Column(String(100), index=True)
    status = Column(String(50))
    log_type = Column(String(50))
    raw_log = Column(Text)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow, index=True)
    opened_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    sla_due_at = Column(DateTime, nullable=True)
    threat_type = Column(String(255))
    risk_level = Column(String(50), index=True)
    risk_score = Column(Float)
    source_ip = Column(String(50), index=True)
    mitre_technique = Column(String(50))
    source = Column(String(100), default="other", index=True)
    case_key = Column(String(255), index=True)
    workflow_state = Column(String(50), default="New", index=True)
    owner = Column(String(100), default="Unassigned", index=True)
    alert_count = Column(Integer, default=1)
    analyst_notes = Column(Text, nullable=True)
    status_history = Column(JSON)
    evidence = Column(JSON)
    explanation = Column(JSON)
    recommended_actions = Column(JSON)
    tags = Column(JSON)
    soc_summary = Column(JSON)
    status = Column(String(50), default="Open", index=True)
    campaign_id = Column(Integer, ForeignKey("attack_campaigns.id"), nullable=True)
    asset_id = Column(Integer, ForeignKey("monitored_assets.id"), nullable=True, index=True)


class MonitoredAsset(Base):
    """Business asset that produces SOC signals for the co-analyst workflow."""
    __tablename__ = "monitored_assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    asset_type = Column(String(50), default="website", index=True)
    target = Column(String(500), nullable=False)
    environment = Column(String(50), default="Demo")
    owner = Column(String(100), default="Unassigned")
    priority = Column(String(50), default="Medium")
    monitoring_mode = Column(String(50), default="Simulation")
    status = Column(String(50), default="Active", index=True)
    last_checked_at = Column(DateTime, nullable=True)
    last_signal_at = Column(DateTime, nullable=True)
    health_status = Column(String(50), default="Unknown")
    risk_score = Column(Float, default=0)
    metadata_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class IPState(Base):
    __tablename__ = "ip_states"

    ip_address = Column(String(50), primary_key=True, index=True)
    failed_logins = Column(Integer, default=0)
    stages_detected = Column(JSON)  # ["Initial Access", "Execution"]
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    total_events = Column(Integer, default=0)


class AttackCampaign(Base):
    """Groups related attack events across time — no hard timeout."""
    __tablename__ = "attack_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))  # AI-generated campaign name
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="Active")  # Active, Dormant, Closed
    source_ips = Column(JSON)  # ["203.55.77.99", "10.0.0.5"]
    stages_progression = Column(JSON)  # [{"stage": "Initial Access", "timestamp": "...", "log_id": 5}]
    risk_score = Column(Float, default=0)
    risk_level = Column(String(50), default="LOW")
    target_users = Column(JSON)  # ["admin", "root"]
    mitre_techniques = Column(JSON)  # ["T1110", "T1059"]
    summary = Column(Text)  # LLM-generated campaign summary


class ThreatIntelEntry(Base):
    """Stores real threat intelligence from external feeds."""
    __tablename__ = "threat_intel"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(100))  # "CISA_KEV", "ABUSE_CH", "MANUAL"
    title = Column(String(500))
    description = Column(Text)
    ioc_type = Column(String(50))  # "ip", "domain", "hash", "cve", "technique"
    ioc_value = Column(String(500), index=True)
    severity = Column(String(50))
    tags = Column(JSON)
    raw_data = Column(JSON)
    ingested_at = Column(DateTime, default=datetime.utcnow)


class AlertRule(Base):
    """Configurable alert rules for SOAR automation."""
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    description = Column(Text)
    condition_type = Column(String(50))  # "risk_level", "threat_type", "multi_stage", "ip_threshold"
    condition_value = Column(String(255))  # "CRITICAL", "Brute Force Attack", etc.
    action_type = Column(String(50))  # "email", "slack", "webhook", "block_ip"
    action_config = Column(JSON)  # {"webhook_url": "...", "email": "..."}
    enabled = Column(Boolean, default=True)
    times_triggered = Column(Integer, default=0)
    last_triggered = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Blocklist(Base):
    """Auto-populated blocklist for firewall export."""
    __tablename__ = "blocklist"

    id = Column(Integer, primary_key=True, index=True)
    ip_address = Column(String(50), unique=True, index=True)
    reason = Column(Text)
    blocked_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    auto_blocked = Column(Boolean, default=True)


class ChatMessage(Base):
    """SOC Copilot conversation history."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(20))  # "user" or "assistant"
    content = Column(Text)
    context_used = Column(JSON, nullable=True)  # DB query results injected into prompt
    session_id = Column(String(50), index=True, nullable=True)  # Groups multi-turn conversations
    timestamp = Column(DateTime, default=datetime.utcnow)


class User(Base):
    """Platform user accounts with role-based access control."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(20), default="analyst")  # admin, analyst, viewer
    organization = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class SourceHealth(Base):
    """Tracks ingestion health per source/collector for the operator console."""
    __tablename__ = "source_health"

    source_key = Column(String(100), primary_key=True, index=True)
    display_name = Column(String(255))
    last_event_at = Column(DateTime, nullable=True)
    last_success_at = Column(DateTime, nullable=True)
    last_error_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    events_ingested = Column(Integer, default=0)
    incidents_created = Column(Integer, default=0)
    parse_failures = Column(Integer, default=0)
    dropped_events = Column(Integer, default=0)
    collector_interval_seconds = Column(Integer, nullable=True)
    last_lag_seconds = Column(Float, nullable=True)
