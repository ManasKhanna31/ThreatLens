from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json

from config import settings


SETTINGS_PATH = Path(settings.DATA_DIR) / "app_settings.json"

DEFAULT_SETTINGS = {
    "demo_mode": True,
    "collector": {
        "enabled": settings.ENABLE_REAL_LOG_COLLECTOR,
        "interval_seconds": settings.REAL_LOG_COLLECTOR_INTERVAL_SECONDS,
        "max_events_per_sweep": settings.REAL_LOG_MAX_EVENTS_PER_SWEEP,
        "bootstrap_minutes": settings.REAL_LOG_BOOTSTRAP_MINUTES,
    },
    "retention": {
        "max_logs": 2000,
        "max_incidents": 750,
        "max_chats": 200,
    },
    "feeds": {
        "threat_intel_auto_refresh": True,
        "sources": ["CISA KEV", "Abuse.ch Feodo", "URLhaus"],
    },
    "detection": {
        "dedup_window_minutes": 20,
        "group_window_hours": 24,
        "reopen_window_hours": 8,
        "sla_minutes": {
            "CRITICAL": 30,
            "HIGH": 120,
            "MEDIUM": 360,
            "LOW": 720,
        },
        "auto_close_hours": {
            "LOW": 24,
            "MEDIUM": 72,
        },
        "risk_thresholds": {
            "critical": 80,
            "high": 55,
            "medium": 30,
        },
    },
}


def _deep_merge(base: dict, incoming: dict) -> dict:
    merged = deepcopy(base)
    for key, value in incoming.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def get_app_settings() -> dict:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not SETTINGS_PATH.exists():
        SETTINGS_PATH.write_text(json.dumps(DEFAULT_SETTINGS, indent=2), encoding="utf-8")
        return deepcopy(DEFAULT_SETTINGS)
    try:
        raw = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except Exception:
        raw = {}
    merged = _deep_merge(DEFAULT_SETTINGS, raw)
    if merged != raw:
        SETTINGS_PATH.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    return merged


def update_app_settings(payload: dict) -> dict:
    current = get_app_settings()
    merged = _deep_merge(current, payload or {})
    SETTINGS_PATH.write_text(json.dumps(merged, indent=2), encoding="utf-8")
    return merged
