"""
ThreatLens Detection Engine v2.1
- Campaign-based multi-stage tracking (no hard timeout)
- Time-decay scoring for historical correlation
- 11 detection rules covering the full MITRE kill chain
- Multi-rule detection: ALL matching rules fire, not just the first
- NEW: Successful Login After Brute Force (most dangerous signal)
"""
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models.db_models import IPState, AttackCampaign
import math
import json


# ========================
#  Time-Decay Scoring
# ========================
def _time_decay_weight(event_time: datetime) -> float:
    """
    Returns a weight between 0.1 and 1.0 based on how recent the event is.
    - 1 hour ago   -> 1.0
    - 1 day ago    -> 0.8
    - 1 week ago   -> 0.5
    - 1 month ago  -> 0.2
    - 3 months ago -> 0.1
    """
    if not event_time:
        return 0.1
    hours_ago = (datetime.utcnow() - event_time).total_seconds() / 3600
    weight = math.exp(-0.003 * hours_ago)
    return max(0.1, min(1.0, weight))


# ========================
#  IP State Management
# ========================
def _get_or_create_ip_state(db: Session, ip: str) -> IPState:
    """Retrieve or create IP state — never expires, just decays."""
    record = db.query(IPState).filter(IPState.ip_address == ip).first()
    if not record:
        record = IPState(
            ip_address=ip,
            failed_logins=0,
            stages_detected=[],
            first_seen=datetime.utcnow(),
            last_seen=datetime.utcnow(),
            total_events=0,
        )
        db.add(record)
        db.flush()
    return record


def _update_ip_state(db: Session, record: IPState, stages: List[str], failed: bool):
    """Update IP tracking state with all detected stages."""
    record.last_seen = datetime.utcnow()
    record.total_events = (record.total_events or 0) + 1

    if failed:
        record.failed_logins = (record.failed_logins or 0) + 1

    current_stages = list(record.stages_detected or [])
    changed = False
    for stage in stages:
        if stage and stage not in current_stages:
            current_stages.append(stage)
            changed = True
    if changed:
        record.stages_detected = current_stages

    db.flush()


# ========================
#  Campaign Management
# ========================
def _find_or_create_campaign(db: Session, ip: str, stages: List[str], user: str, mitre_ids: List[str], log_id: int = None) -> AttackCampaign:
    """
    Find an existing active campaign involving this IP, or create a new one.
    Campaigns never time out — they stay until manually closed.
    """
    campaigns = db.query(AttackCampaign).filter(
        AttackCampaign.status.in_(["Active", "Dormant"])
    ).all()

    for camp in campaigns:
        camp_ips = camp.source_ips or []
        if ip in camp_ips:
            if camp.status == "Dormant":
                camp.status = "Active"

            camp.last_seen = datetime.utcnow()

            # Add new stages
            progression = list(camp.stages_progression or [])
            for stage in stages:
                progression.append({
                    "stage": stage,
                    "timestamp": datetime.utcnow().isoformat(),
                    "ip": ip,
                    "log_id": log_id,
                })
            camp.stages_progression = progression

            # Add user and techniques
            users = list(camp.target_users or [])
            if user and user not in users:
                users.append(user)
                camp.target_users = users

            techniques = list(camp.mitre_techniques or [])
            for mid in mitre_ids:
                if mid and mid not in techniques:
                    techniques.append(mid)
            camp.mitre_techniques = techniques

            db.flush()
            return camp

    # Create new campaign
    new_campaign = AttackCampaign(
        name=f"Campaign-{ip[:8]}-{datetime.utcnow().strftime('%m%d')}",
        first_seen=datetime.utcnow(),
        last_seen=datetime.utcnow(),
        status="Active",
        source_ips=[ip],
        stages_progression=[
            {"stage": s, "timestamp": datetime.utcnow().isoformat(), "ip": ip, "log_id": log_id}
            for s in stages
        ],
        risk_score=0,
        risk_level="LOW",
        target_users=[user] if user else [],
        mitre_techniques=[m for m in mitre_ids if m],
    )
    db.add(new_campaign)
    db.flush()
    return new_campaign


# ========================
#  Detection Rules
# ========================
DETECTION_RULES = [
    {
        "name": "Successful Login After Brute Force",
        "check": lambda parsed, ip_state: (
            parsed.get("status") == "Success"
            and ip_state
            and (ip_state.failed_logins or 0) >= 3
        ),
        "confidence": 0.95,
        "mitre": "T1110",
        "stage": "Initial Access",
        "severity_override": "CRITICAL",
    },
    {
        "name": "Brute Force Attack",
        "check": lambda parsed, ip_state: (
            (parsed.get("event_id") == "4625" or parsed.get("status") == "Failed")
            and ip_state
            and (ip_state.failed_logins or 0) >= 2
        ),
        "confidence": 0.85,
        "mitre": "T1110",
        "stage": "Initial Access",
    },
    {
        "name": "Suspicious PowerShell Execution",
        "check": lambda parsed, ip_state: "powershell" in parsed.get("raw", "").lower(),
        "confidence": 0.75,
        "mitre": "T1059",
        "stage": "Execution",
    },
    {
        "name": "Credential Dumping Attempt",
        "check": lambda parsed, ip_state: any(
            kw in parsed.get("raw", "").lower() for kw in ["lsass", "mimikatz", "procdump", "sekurlsa"]
        ),
        "confidence": 0.90,
        "mitre": "T1003",
        "stage": "Credential Access",
    },
    {
        "name": "Event Log Cleared",
        "check": lambda parsed, ip_state: (
            parsed.get("event_id") == "1102"
            or ("clear" in parsed.get("raw", "").lower() and "log" in parsed.get("raw", "").lower())
        ),
        "confidence": 0.95,
        "mitre": "T1070",
        "stage": "Defense Evasion",
    },
    {
        "name": "Lateral Movement Detected",
        "check": lambda parsed, ip_state: any(
            kw in parsed.get("raw", "").lower() for kw in ["psexec", "wmic", "winrm", "smbexec"]
        ),
        "confidence": 0.80,
        "mitre": "T1021",
        "stage": "Lateral Movement",
    },
    {
        "name": "Data Exfiltration Attempt",
        "check": lambda parsed, ip_state: (
            any(kw in parsed.get("raw", "").lower() for kw in ["curl", "wget", "ftp", "scp", "rsync"])
            and any(kw in parsed.get("raw", "").lower() for kw in ["upload", "exfil", "transfer", "send", "post"])
        ),
        "confidence": 0.70,
        "mitre": "T1041",
        "stage": "Exfiltration",
    },
    {
        "name": "Persistence Mechanism Detected",
        "check": lambda parsed, ip_state: any(
            kw in parsed.get("raw", "").lower() for kw in ["schtask", "crontab", "registry", "startup", "autorun"]
        ),
        "confidence": 0.75,
        "mitre": "T1053",
        "stage": "Persistence",
    },
    {
        "name": "Reconnaissance Activity",
        "check": lambda parsed, ip_state: any(
            kw in parsed.get("raw", "").lower() for kw in ["nmap", "masscan", "enum4linux", "nbtscan", "port scan"]
        ),
        "confidence": 0.65,
        "mitre": "T1046",
        "stage": "Reconnaissance",
    },
    {
        "name": "Privilege Escalation Attempt",
        "check": lambda parsed, ip_state: any(
            kw in parsed.get("raw", "").lower() for kw in ["sudo", "runas", "privilege escalat", "elevation", "uac bypass"]
        ) and parsed.get("status") == "Failed",
        "confidence": 0.70,
        "mitre": "T1068",
        "stage": "Privilege Escalation",
    },
    {
        "name": "Command and Control Communication",
        "check": lambda parsed, ip_state: any(
            kw in parsed.get("raw", "").lower() for kw in ["beacon", "c2", "cobalt", "reverse shell", "meterpreter", "callback"]
        ),
        "confidence": 0.90,
        "mitre": "T1071",
        "stage": "Command and Control",
    },
    {
        "name": "Suspicious Inbound Scanning",
        "check": lambda parsed, ip_state: (
            parsed.get("status") in ["BLOCKED", "REJECTED", "DENIED", "Failed"]
            and str(parsed.get("port")) in ["21", "22", "23", "445", "3389", "4444"]
        ),
        "confidence": 0.60,
        "mitre": "T1046",
        "stage": "Reconnaissance",
    },
]

# Multi-stage correlation chains
ATTACK_CHAINS = [
    ({"Initial Access", "Execution"}, "Brute Force -> Code Execution"),
    ({"Execution", "Credential Access"}, "Execution -> Credential Theft"),
    ({"Initial Access", "Lateral Movement"}, "Breach -> Lateral Movement"),
    ({"Credential Access", "Lateral Movement"}, "Credential Theft -> Lateral Spread"),
    ({"Lateral Movement", "Exfiltration"}, "Lateral Movement -> Data Theft"),
    ({"Execution", "Defense Evasion"}, "Execution -> Evidence Tampering"),
    ({"Initial Access", "Persistence"}, "Breach -> Persistence Established"),
    ({"Reconnaissance", "Initial Access"}, "Recon -> Exploitation"),
    ({"Privilege Escalation", "Credential Access"}, "PrivEsc -> Credential Dump"),
    ({"Initial Access", "Execution", "Credential Access"}, "Full Kill Chain: Access -> Exec -> Creds"),
    ({"Initial Access", "Execution", "Lateral Movement", "Exfiltration"}, "Complete APT Chain Detected"),
    ({"Command and Control", "Exfiltration"}, "C2 Active -> Data Exfiltration"),
]


# ========================
#  Main Detection Function
# ========================
def detect_threat(parsed_log: Dict, db: Session = None) -> Dict:
    ip = parsed_log.get("source_ip")
    user = parsed_log.get("user")
    is_failed = parsed_log.get("status") == "Failed" or parsed_log.get("event_id") == "4625"

    # Load IP state
    ip_state = None
    if ip and db:
        ip_state = _get_or_create_ip_state(db, ip)

    # Run ALL detection rules — collect every match
    matched_rules = []
    for rule in DETECTION_RULES:
        try:
            if rule["check"](parsed_log, ip_state):
                matched_rules.append(rule)
        except Exception:
            continue

    # Pick primary threat (highest confidence) for backward compat
    primary = None
    if matched_rules:
        primary = max(matched_rules, key=lambda r: r["confidence"])

    threat_type = primary["name"] if primary else None
    confidence = primary["confidence"] if primary else 0
    mitre_candidate = primary["mitre"] if primary else None
    severity_override = primary.get("severity_override") if primary else None

    # Collect ALL stages and MITRE IDs from all matched rules
    all_matched_stages = list(set(r["stage"] for r in matched_rules))
    all_matched_mitres = list(set(r["mitre"] for r in matched_rules))
    all_matched_threats = [r["name"] for r in matched_rules]

    # Update IP state with ALL detected stages
    if ip and ip_state and db:
        _update_ip_state(db, ip_state, all_matched_stages, is_failed)

    # Apply time-decay weighting
    decay_weight = 1.0
    if ip_state and ip_state.first_seen:
        decay_weight = _time_decay_weight(ip_state.first_seen)

    # Campaign correlation
    campaign_info = None
    multi_stage_warning = None

    if ip and all_matched_stages and db:
        campaign = _find_or_create_campaign(
            db, ip, all_matched_stages, user, all_matched_mitres
        )

        # Check all stages in this campaign
        campaign_stages = set()
        for entry in (campaign.stages_progression or []):
            campaign_stages.add(entry["stage"])

        # Find matching attack chain
        best_chain = None
        best_chain_len = 0
        for required_stages, warning_msg in ATTACK_CHAINS:
            if required_stages.issubset(campaign_stages) and len(required_stages) > best_chain_len:
                best_chain = warning_msg
                best_chain_len = len(required_stages)

        if best_chain:
            multi_stage_warning = best_chain
            confidence = min(confidence + 0.10 * best_chain_len, 1.0)

        # Update campaign risk
        campaign.risk_score = round(confidence * 100 * decay_weight, 1)
        campaign.risk_level = (
            "CRITICAL" if campaign.risk_score >= 80
            else "HIGH" if campaign.risk_score >= 60
            else "MEDIUM" if campaign.risk_score >= 30
            else "LOW"
        )
        db.flush()

        campaign_info = {
            "campaign_id": campaign.id,
            "campaign_name": campaign.name,
            "stages_in_campaign": list(campaign_stages),
            "campaign_duration_hours": round(
                (campaign.last_seen - campaign.first_seen).total_seconds() / 3600, 1
            ),
            "campaign_risk": campaign.risk_level,
        }

    # Reload IP state for response
    all_stages = list(ip_state.stages_detected or []) if ip_state else []
    failed = (ip_state.failed_logins or 0) if ip_state else 0

    return {
        "threat_detected": threat_type,
        "all_threats_detected": all_matched_threats,
        "confidence": round(confidence, 2),
        "mitre_candidate": mitre_candidate,
        "all_mitre_techniques": all_matched_mitres,
        "current_stage": primary["stage"] if primary else None,
        "all_stages_this_log": all_matched_stages,
        "multi_stage_correlation": multi_stage_warning,
        "attack_stages_observed": all_stages,
        "failed_attempts_from_ip": failed,
        "time_decay_weight": round(decay_weight, 2),
        "severity_override": severity_override,
        "campaign": campaign_info,
    }