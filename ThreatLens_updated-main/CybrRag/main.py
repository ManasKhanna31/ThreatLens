"""
ThreatLens API — AI-Powered Security Intelligence Platform
v3.0: Full automation — threat intel, demo seeding, retention, all on startup.
"""
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from apscheduler.schedulers.background import BackgroundScheduler
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from datetime import datetime
import logging
import time

from routers import logs, analysis, mitre, cve, report, assets
from routers import dashboard, chat, alerts, auth
from models.database import engine, SessionLocal, ensure_runtime_schema
from models.db_models import Base
from services.correlation_engine import run_correlation_sweep
from services.alert_service import create_default_rules
from services.threat_intel_ingestion import ingest_all
from services.log_seed import seed_demo_attacks
from services.log_collector import get_collector_status, start_real_log_collector
from services.incident_ops import run_incident_lifecycle_sweep
from services.retention_manager import enforce_retention_policies
from dependencies.auth import get_current_user

# ── Logging ──────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("threatlens")

# ── Rate limiter ─────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Background Scheduler ─────────────────────────
scheduler = BackgroundScheduler()

# ── Metrics ──────────────────────────────────────
_metrics = {
    "start_time": None,
    "requests_total": 0,
    "requests_errors": 0,
    "last_correlation_sweep": None,
    "last_correlation_findings": 0,
    "last_intel_refresh": None,
    "last_retention_run": None,
    "last_incident_lifecycle_run": None,
}


# ── Scheduled Jobs ───────────────────────────────
def _correlation_with_metrics():
    """Correlation sweep — runs every 5 minutes."""
    findings = run_correlation_sweep()
    _metrics["last_correlation_sweep"] = datetime.utcnow().isoformat()
    _metrics["last_correlation_findings"] = len(findings)


def _intel_refresh():
    """Threat intel refresh — runs every 60 minutes."""
    try:
        results = ingest_all()
        _metrics["last_intel_refresh"] = datetime.utcnow().isoformat()
        logger.info(f"[Scheduler] Threat intel refreshed: {results}")
    except Exception as e:
        logger.error(f"[Scheduler] Intel refresh failed: {e}")


def _retention_sweep():
    """Retention cleanup — runs every 30 minutes."""
    db = SessionLocal()
    try:
        enforce_retention_policies(db)
        _metrics["last_retention_run"] = datetime.utcnow().isoformat()
    except Exception as e:
        logger.error(f"[Scheduler] Retention sweep failed: {e}")
    finally:
        db.close()


def _incident_lifecycle_job():
    db = SessionLocal()
    try:
        run_incident_lifecycle_sweep(db)
        _metrics["last_incident_lifecycle_run"] = datetime.utcnow().isoformat()
    except Exception as e:
        logger.error(f"[Scheduler] Incident lifecycle sweep failed: {e}")
    finally:
        db.close()


# ── Lifespan (Startup / Shutdown) ────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Full startup sequence — the platform initializes itself."""
    _metrics["start_time"] = datetime.utcnow()

    # 1. Create database tables
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()
    logger.info("[ThreatLens] Database tables initialized")

    db = SessionLocal()
    try:
        # 2. Seed default alert rules
        create_default_rules(db)

        # 3. Auto-ingest threat intelligence from external feeds
        logger.info("[ThreatLens] Ingesting threat intelligence feeds...")
        try:
            intel_results = ingest_all()
            _metrics["last_intel_refresh"] = datetime.utcnow().isoformat()
            logger.info(f"[ThreatLens] Threat intel loaded: {intel_results}")
        except Exception as e:
            logger.warning(f"[ThreatLens] Threat intel ingestion failed (non-fatal): {e}")

        # 4. Seed demo attack scenario (only if DB is empty)
        seed_demo_attacks(db)

    finally:
        db.close()

    # 5. Start background scheduler
    scheduler.add_job(_correlation_with_metrics, "interval", minutes=5, id="correlation_sweep")
    scheduler.add_job(_intel_refresh, "interval", minutes=60, id="intel_refresh")
    scheduler.add_job(_retention_sweep, "interval", minutes=30, id="retention_sweep")
    scheduler.add_job(_incident_lifecycle_job, "interval", minutes=20, id="incident_lifecycle")
    scheduler.start()
    start_real_log_collector()
    logger.info("[ThreatLens] Background scheduler started:")
    logger.info("  → Correlation engine: every 5 min")
    logger.info("  → Threat intel refresh: every 60 min")
    logger.info("  → Retention cleanup: every 30 min")
    logger.info("  → Real local log collector: enabled")

    yield

    scheduler.shutdown()
    logger.info("[ThreatLens] Scheduler stopped")


# ── App ──────────────────────────────────────────
app = FastAPI(
    title="ThreatLens API",
    version="3.0",
    description="AI-Powered Security Intelligence Platform — Automated SOC",
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Middleware ───────────────────────────────────
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    _metrics["requests_total"] += 1
    start = time.time()
    try:
        response = await call_next(request)
        return response
    except Exception:
        _metrics["requests_errors"] += 1
        raise
    finally:
        duration = time.time() - start
        if duration > 5:
            logger.warning(f"[Slow Request] {request.method} {request.url.path} took {duration:.1f}s")


# ── Routes ───────────────────────────────────────

# Public (no auth)
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])

# Protected (JWT required)
_protected = [Depends(get_current_user)]
app.include_router(logs.router, prefix="/api/v1/logs", tags=["Log Ingestion"], dependencies=_protected)
app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["Threat Analysis"], dependencies=_protected)
app.include_router(mitre.router, prefix="/api/v1/mitre", tags=["MITRE ATT&CK"], dependencies=_protected)
app.include_router(cve.router, prefix="/api/v1/cve", tags=["CVE Lookup"], dependencies=_protected)
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard & Incidents"], dependencies=_protected)
app.include_router(chat.router, prefix="/api/v1/chat", tags=["AI Copilot"], dependencies=_protected)
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts & SOAR"], dependencies=_protected)
app.include_router(report.router, prefix="/api/v1/reports", tags=["SOC Reports"], dependencies=_protected)
app.include_router(assets.router, prefix="/api/v1/assets", tags=["Monitored Assets"], dependencies=_protected)


# ── Root ─────────────────────────────────────────
@app.get("/")
def root():
    return {
        "platform": "ThreatLens",
        "version": "3.0",
        "status": "operational",
        "architecture": {
            "ingestion": [
                "Webhook Receiver (POST /api/v1/logs/webhook)",
                "Single Log Analysis (POST /api/v1/analysis/analyze)",
                "Bulk Async Ingestion (POST /api/v1/analysis/ingest)",
            ],
            "detection": [
                "11 Rule-Based Detectors (all fire simultaneously)",
                "Campaign-Based Multi-Stage Tracking",
                "Time-Decay Threat Scoring",
                "Successful Login After Brute Force (CRITICAL)",
            ],
            "intelligence": [
                "Real Threat Intel Feeds (CISA KEV, Abuse.ch Feodo, URLhaus)",
                "Auto-refresh every 60 minutes",
                "IOC Cross-Referencing on ingestion",
                "RAG-Powered Context Retrieval",
            ],
            "automation": [
                "Background Correlation Engine (5-min sweep)",
                "SOAR Alert Rules (webhook, email, auto-block, escalate)",
                "Auto-Blocklist for repeat offenders",
                "Data Retention Manager (30-min sweep)",
            ],
            "enrichment": [
                "MITRE ATT&CK Mapping (offline cache)",
                "CVE Lookup (NVD API)",
                "IP Intelligence (VirusTotal, IPInfo, OpenCage)",
                "LLM-Generated SOC Summaries (Groq LLaMA)",
            ],
            "operations": [
                "JWT Authentication (signup/login/roles)",
                "AI SOC Copilot with conversation memory",
                "Campaign Management & Timeline",
                "IP Investigation & Forensics",
                "Automatic Real Windows Event Log Collection",
            ],
        },
        "auth": {
            "signup": "/api/v1/auth/signup",
            "login": "/api/v1/auth/login",
            "refresh": "/api/v1/auth/refresh",
            "profile": "/api/v1/auth/me",
        },
        "endpoints": {
            "analyze": "/api/v1/analysis/analyze",
            "bulk_ingest": "/api/v1/analysis/ingest",
            "webhook": "/api/v1/logs/webhook",
            "dashboard": "/api/v1/dashboard/stats",
            "incidents": "/api/v1/dashboard/incidents",
            "campaigns": "/api/v1/dashboard/campaigns",
            "timeline": "/api/v1/dashboard/timeline/{ip}",
            "investigate_ip": "/api/v1/dashboard/investigate/{ip}",
            "correlate": "/api/v1/dashboard/correlate",
            "mitre_search": "/api/v1/mitre/search?q=",
            "cve_search": "/api/v1/cve/search?q=",
            "chat": "/api/v1/chat/ask",
            "alert_rules": "/api/v1/alerts/rules",
            "blocklist": "/api/v1/alerts/blocklist",
            "intel_ingest": "/api/v1/alerts/intel/ingest",
            "intel_iocs": "/api/v1/alerts/intel/iocs",
            "health": "/health",
            "docs": "/docs",
        },
    }


# ── Health Check ─────────────────────────────────
import traceback
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {exc}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": traceback.format_exc()}
    )

@app.get("/health")
def health_check():
    """Detailed health check with operational metrics."""
    uptime = None
    if _metrics["start_time"]:
        uptime = str(datetime.utcnow() - _metrics["start_time"])

    return {
        "status": "healthy",
        "version": "3.0",
        "uptime": uptime,
        "scheduler_running": scheduler.running,
        "background_jobs": {
            "correlation_engine": "every 5 min",
            "threat_intel_refresh": "every 60 min",
            "retention_cleanup": "every 30 min",
        },
        "real_log_collector": get_collector_status(),
        "metrics": {
            "requests_total": _metrics["requests_total"],
            "requests_errors": _metrics["requests_errors"],
            "error_rate": f"{(_metrics['requests_errors'] / max(_metrics['requests_total'], 1)) * 100:.1f}%",
            "last_correlation_sweep": _metrics["last_correlation_sweep"],
            "last_correlation_findings": _metrics["last_correlation_findings"],
            "last_intel_refresh": _metrics["last_intel_refresh"],
            "last_retention_run": _metrics["last_retention_run"],
            "last_incident_lifecycle_run": _metrics["last_incident_lifecycle_run"],
        },
    }
