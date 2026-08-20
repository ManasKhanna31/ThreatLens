from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse
import random

import httpx
from sqlalchemy.orm import Session

from models.db_models import Incident, LogEntry, MonitoredAsset
from services.alert_service import evaluate_alert_rules
from services.incident_ops import create_or_update_incident
from services.source_health import record_source_health


ASSET_TYPE_LABELS = {
    "website": "Website / Web App",
    "github": "GitHub Repository",
    "api": "API Endpoint",
    "cloud": "Cloud Account",
    "server": "Server / Endpoint",
    "saas": "SaaS Application",
}

ASSET_TYPE_PROFILES: Dict[str, Dict[str, Any]] = {
    "website": {
        "headline": "Watch external-facing web applications for hostile probing, exploit attempts, and persistence signals.",
        "checks": ["HTTP reachability", "TLS usage", "security headers", "response latency"],
        "focus": ["Path probing", "SQL injection", "web shell upload"],
    },
    "github": {
        "headline": "Treat code repositories and CI workflows as security signal sources for the SOC queue.",
        "checks": ["Repository posture", "workflow hygiene", "protection gaps"],
        "focus": ["Secret exposure", "workflow abuse", "branch protection drift"],
    },
    "api": {
        "headline": "Monitor authentication flows, unusual token use, and export patterns across API surfaces.",
        "checks": ["Auth surface", "request posture", "token context"],
        "focus": ["Credential stuffing", "token abuse"],
    },
    "cloud": {
        "headline": "Convert identity and control-plane changes into investigation-ready cloud security cases.",
        "checks": ["IAM posture", "privilege change review"],
        "focus": ["Privilege escalation", "role abuse"],
    },
    "server": {
        "headline": "Use server telemetry as a signal source for access anomalies and lateral movement review.",
        "checks": ["Remote access review", "service exposure"],
        "focus": ["Suspicious remote login"],
    },
    "saas": {
        "headline": "Watch administrative activity and tenant changes across business SaaS tools.",
        "checks": ["Admin action review", "configuration drift"],
        "focus": ["Unexpected admin grants"],
    },
}


SIMULATION_LIBRARY: Dict[str, List[Dict[str, Any]]] = {
    "website": [
        {
            "threat": "Web Path Probing",
            "risk": "MEDIUM",
            "score": 42,
            "mitre": "T1595",
            "stage": "Reconnaissance",
            "source_ip": "198.51.100.44",
            "raw": "GET /admin/.env HTTP/1.1 status=404 user_agent=masscan asset={target} src=198.51.100.44",
            "actions": [
                "Review access logs for repeated sensitive path discovery.",
                "Confirm administrative routes are protected and not exposed publicly.",
                "Add WAF rules or rate limits if probing continues.",
            ],
        },
        {
            "threat": "SQL Injection Attempt",
            "risk": "HIGH",
            "score": 72,
            "mitre": "T1190",
            "stage": "Initial Access",
            "source_ip": "203.0.113.21",
            "raw": "POST /login username=admin' OR '1'='1 src=203.0.113.21 asset={target} status=blocked",
            "actions": [
                "Validate whether the request reached the application layer.",
                "Check WAF and application error logs for SQL parser errors.",
                "Review input validation on authentication and search endpoints.",
            ],
        },
        {
            "threat": "Web Shell Upload Attempt",
            "risk": "CRITICAL",
            "score": 88,
            "mitre": "T1505",
            "stage": "Persistence",
            "source_ip": "45.133.1.22",
            "raw": "POST /uploads file=shell.php src=45.133.1.22 asset={target} status=blocked webshell attempt",
            "actions": [
                "Inspect upload directories for unexpected executable files.",
                "Review file upload validation and storage permissions.",
                "Isolate the web tier if any artifact was written successfully.",
            ],
        },
    ],
    "github": [
        {
            "threat": "Possible Secret Exposure",
            "risk": "CRITICAL",
            "score": 90,
            "mitre": "T1552",
            "stage": "Credential Access",
            "source_ip": None,
            "raw": "github repository={target} commit=9f21a suspicious token pattern AWS_SECRET_ACCESS_KEY detected in .env",
            "actions": [
                "Rotate the exposed secret immediately and revoke old credentials.",
                "Review commit history and remove sensitive values from repository history.",
                "Check recent deployments and CI jobs that may have used the exposed secret.",
            ],
        },
        {
            "threat": "Suspicious GitHub Actions Workflow Change",
            "risk": "HIGH",
            "score": 76,
            "mitre": "T1059",
            "stage": "Execution",
            "source_ip": None,
            "raw": "github repository={target} workflow=deploy.yml changed permissions=write-all external curl | bash detected",
            "actions": [
                "Review workflow changes, author identity, and branch protection status.",
                "Temporarily disable the workflow if the change is not expected.",
                "Audit repository secrets accessed by recent workflow runs.",
            ],
        },
        {
            "threat": "Repository Protection Gap",
            "risk": "MEDIUM",
            "score": 48,
            "mitre": "T1195",
            "stage": "Initial Access",
            "source_ip": None,
            "raw": "github repository={target} branch=main protection=missing required_reviews=0 force_push_allowed=true",
            "actions": [
                "Enable branch protection and required reviews for default branches.",
                "Restrict force pushes and direct pushes to protected branches.",
                "Review collaborator permissions for least privilege.",
            ],
        },
    ],
    "api": [
        {
            "threat": "API Credential Stuffing Pattern",
            "risk": "HIGH",
            "score": 70,
            "mitre": "T1110",
            "stage": "Initial Access",
            "source_ip": "192.0.2.88",
            "raw": "POST /api/auth status=401 src=192.0.2.88 attempts=64 asset={target} credential stuffing",
            "actions": [
                "Review authentication rate limits and failed login distribution.",
                "Challenge or block the source if attempts continue.",
                "Check for successful login after the failed attempt window.",
            ],
        },
        {
            "threat": "API Token Abuse Signal",
            "risk": "HIGH",
            "score": 68,
            "mitre": "T1528",
            "stage": "Credential Access",
            "source_ip": "203.0.113.77",
            "raw": "GET /api/export token_age=2d unusual_geo=true src=203.0.113.77 asset={target}",
            "actions": [
                "Validate token owner, scope, and recent activity.",
                "Rotate the token if usage is not expected.",
                "Review API export volume and downstream data access.",
            ],
        },
    ],
    "cloud": [
        {
            "threat": "Cloud IAM Privilege Escalation Attempt",
            "risk": "CRITICAL",
            "score": 86,
            "mitre": "T1098",
            "stage": "Privilege Escalation",
            "source_ip": "203.0.113.12",
            "raw": "cloud account={target} action=AttachAdminPolicy principal=unknown src=203.0.113.12 status=denied privilege escalation",
            "actions": [
                "Review IAM change history and privileged role assumptions.",
                "Confirm whether the requesting principal is authorized.",
                "Rotate credentials for affected service accounts if compromise is suspected.",
            ],
        }
    ],
    "server": [
        {
            "threat": "Suspicious Remote Login Activity",
            "risk": "HIGH",
            "score": 66,
            "mitre": "T1021",
            "stage": "Lateral Movement",
            "source_ip": "198.51.100.90",
            "raw": "sshd[8842]: failed password for admin from 198.51.100.90 port=22 asset={target}",
            "actions": [
                "Review remote login attempts and successful sessions.",
                "Confirm admin account usage is expected.",
                "Apply source blocking or MFA challenge for repeated activity.",
            ],
        }
    ],
    "saas": [
        {
            "threat": "Suspicious SaaS Admin Activity",
            "risk": "HIGH",
            "score": 64,
            "mitre": "T1098",
            "stage": "Persistence",
            "source_ip": "203.0.113.34",
            "raw": "saas app={target} event=NewAdminRole user=external.contractor src=203.0.113.34 status=success",
            "actions": [
                "Review admin role assignment and approval trail.",
                "Validate whether the actor should have privileged access.",
                "Remove unexpected grants and audit recent configuration changes.",
            ],
        }
    ],
}


def serialize_asset(asset: MonitoredAsset, incident_count: int = 0, open_incidents: int = 0) -> Dict[str, Any]:
    profile = ASSET_TYPE_PROFILES.get(asset.asset_type, {})
    return {
        "id": asset.id,
        "name": asset.name,
        "asset_type": asset.asset_type,
        "asset_type_label": ASSET_TYPE_LABELS.get(asset.asset_type, asset.asset_type),
        "target": asset.target,
        "environment": asset.environment,
        "owner": asset.owner,
        "priority": asset.priority,
        "monitoring_mode": asset.monitoring_mode,
        "status": asset.status,
        "last_checked_at": asset.last_checked_at.isoformat() if asset.last_checked_at else None,
        "last_signal_at": asset.last_signal_at.isoformat() if asset.last_signal_at else None,
        "health_status": asset.health_status,
        "risk_score": asset.risk_score or 0,
        "metadata": asset.metadata_json or {},
        "incident_count": incident_count,
        "open_incidents": open_incidents,
        "profile": profile,
    }


def normalize_asset_type(value: str) -> str:
    normalized = (value or "website").strip().lower()
    return normalized if normalized in SIMULATION_LIBRARY else "website"


def run_safe_asset_check(asset: MonitoredAsset) -> Dict[str, Any]:
    now = datetime.utcnow()
    check = {
        "checked_at": now.isoformat(),
        "mode": "safe_monitor",
        "observations": [],
    }

    if asset.asset_type == "website":
        target = asset.target if asset.target.startswith(("http://", "https://")) else f"https://{asset.target}"
        try:
            started = datetime.utcnow()
            with httpx.Client(timeout=4, follow_redirects=True) as client:
                response = client.get(target)
            latency_ms = int((datetime.utcnow() - started).total_seconds() * 1000)
            check.update({
                "http_status": response.status_code,
                "latency_ms": latency_ms,
                "final_url": str(response.url),
                "tls_observed": str(response.url).startswith("https://"),
                "security_headers": {
                    "content_security_policy": bool(response.headers.get("content-security-policy")),
                    "strict_transport_security": bool(response.headers.get("strict-transport-security")),
                    "x_frame_options": bool(response.headers.get("x-frame-options")),
                },
            })
            missing_headers = [key for key, present in check["security_headers"].items() if not present]
            if missing_headers:
                check["observations"].append(f"Missing security headers: {', '.join(missing_headers)}")
            asset.health_status = "Reachable" if response.status_code < 500 else "Degraded"
            asset.risk_score = max(asset.risk_score or 0, 20 if missing_headers else 5)
        except Exception as exc:
            check["error"] = str(exc)
            asset.health_status = "Check Failed"
            asset.risk_score = max(asset.risk_score or 0, 35)
    else:
        check["observations"].append(f"{ASSET_TYPE_LABELS.get(asset.asset_type, asset.asset_type)} posture check is configured for simulation telemetry in this local prototype.")
        asset.health_status = "Monitoring"
        asset.risk_score = max(asset.risk_score or 0, 10)

    asset.last_checked_at = now
    metadata = dict(asset.metadata_json or {})
    metadata["last_check"] = check
    asset.metadata_json = metadata
    return check


def _incident_payload(asset: MonitoredAsset, template: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    detection = {
        "threat_detected": template["threat"],
        "all_threats_detected": [template["threat"]],
        "confidence": 0.9 if template["risk"] in ("CRITICAL", "HIGH") else 0.72,
        "mitre_candidate": template["mitre"],
        "all_mitre_techniques": [template["mitre"]],
        "current_stage": template["stage"],
        "all_stages_this_log": [template["stage"]],
        "multi_stage_correlation": None,
    }
    risk = {
        "risk_level": template["risk"],
        "risk_score": template["score"],
        "risk_factors": [
            f"Signal generated for monitored {ASSET_TYPE_LABELS.get(asset.asset_type, asset.asset_type)} asset.",
            f"Observed behavior maps to {template['mitre']} during {template['stage']}.",
            "ThreatLens co-analyst grouped the event into an asset-linked investigation.",
        ],
    }
    parsed = {
        "source_ip": template.get("source_ip"),
        "log_type": f"asset_{asset.asset_type}",
        "status": "Suspicious",
        "hostname": asset.target,
        "raw": template["raw"].format(target=asset.target),
    }
    return detection, risk, parsed


def simulate_asset_signals(db: Session, asset: MonitoredAsset, count: int = 3) -> Dict[str, Any]:
    library = SIMULATION_LIBRARY.get(asset.asset_type) or SIMULATION_LIBRARY["website"]
    selected = library[: max(1, min(count, len(library)))]
    if count < len(library):
        selected = random.sample(library, max(1, count))

    created_incidents = []
    now = datetime.utcnow()
    source_key = f"asset_{asset.asset_type}"

    for template in selected:
        raw_log = template["raw"].format(target=asset.target)
        detection, risk, parsed = _incident_payload(asset, template)
        log_entry = LogEntry(
            source_ip=template.get("source_ip"),
            event_id=f"ASSET-{asset.asset_type.upper()}",
            user=None,
            status="Suspicious",
            log_type=f"asset_{asset.asset_type}",
            raw_log=raw_log,
        )
        db.add(log_entry)
        db.flush()

        incident, created, _ = create_or_update_incident(
            db,
            source=source_key,
            detection=detection,
            risk=risk,
            source_ip=template.get("source_ip"),
            parsed=parsed,
            raw_log=raw_log,
            log_id=log_entry.id,
            event_timestamp=log_entry.timestamp,
            asset_id=asset.id,
            summary_extra={
                "asset_id": asset.id,
                "asset_name": asset.name,
                "asset_target": asset.target,
                "asset_type": asset.asset_type,
                "asset_type_label": ASSET_TYPE_LABELS.get(asset.asset_type, asset.asset_type),
                "coanalyst_summary": f"ThreatLens observed {template['threat']} affecting {asset.name}. The signal is tied to the monitored asset and has been converted into a SOC investigation case.",
            },
        )
        if incident:
            incident.recommended_actions = template["actions"]
            created_incidents.append(incident.id)
            if created:
                evaluate_alert_rules(db, incident)

        record_source_health(
            db,
            source_key,
            display_name=f"{ASSET_TYPE_LABELS.get(asset.asset_type, asset.asset_type)} Signals",
            event_timestamp=log_entry.timestamp,
            ingested=1,
            incidents_created=1 if incident and created else 0,
        )

    asset.last_signal_at = now
    asset.last_checked_at = now
    asset.health_status = "Signals Detected"
    asset.risk_score = max(asset.risk_score or 0, max(item["score"] for item in selected))
    metadata = dict(asset.metadata_json or {})
    metadata["last_simulation"] = {
        "ran_at": now.isoformat(),
        "signals": [item["threat"] for item in selected],
        "incident_ids": created_incidents,
    }
    asset.metadata_json = metadata
    db.flush()
    return {"asset_id": asset.id, "signals_generated": len(selected), "incident_ids": created_incidents}


def infer_asset_name(target: str, asset_type: str) -> str:
    if asset_type == "github":
        parts = target.rstrip("/").split("/")
        if len(parts) >= 2:
            return f"{parts[-2]}/{parts[-1]}"
    if asset_type == "website":
        parsed = urlparse(target if "://" in target else f"https://{target}")
        return parsed.netloc or target
    return target.strip()[:80] or "Monitored asset"


def build_asset_detail(asset: MonitoredAsset, incidents: List[Incident]) -> Dict[str, Any]:
    metadata = dict(asset.metadata_json or {})
    last_check = metadata.get("last_check") or {}
    last_simulation = metadata.get("last_simulation") or {}
    signals = [
        {
            "threat": item["threat"],
            "risk": item["risk"],
            "mitre": item["mitre"],
            "stage": item["stage"],
        }
        for item in (SIMULATION_LIBRARY.get(asset.asset_type) or [])
    ]
    incident_breakdown = {
        "open": len([item for item in incidents if item.status == "Open"]),
        "investigating": len([item for item in incidents if item.status == "Investigating"]),
        "resolved": len([item for item in incidents if item.status in ("Resolved", "Closed")]),
        "critical": len([item for item in incidents if item.risk_level == "CRITICAL"]),
        "high": len([item for item in incidents if item.risk_level == "HIGH"]),
    }
    recommendations = [
        f"Use {ASSET_TYPE_LABELS.get(asset.asset_type, asset.asset_type)} signals to create investigation-ready cases without losing the SOC co-analyst focus.",
        "Run a safe posture check first, then generate controlled signals for a realistic walkthrough.",
        "Open one resulting case and carry it through triage, response guidance, and report generation.",
    ]
    return {
        "profile": ASSET_TYPE_PROFILES.get(asset.asset_type, {}),
        "last_check": last_check,
        "last_simulation": last_simulation,
        "signal_catalog": signals,
        "incident_breakdown": incident_breakdown,
        "recommendations": recommendations,
    }
