"""
ThreatLens Log Seeder — Simulated Attack Generator
Injects realistic multi-stage APT attack scenarios on first startup.
Proves the full pipeline works and populates the dashboard for investor demos.

Configurable via env: SEED_ON_STARTUP=true (default true)
"""
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from datetime import datetime, timedelta
from services.parser import parse_log
from services.detector import detect_threat
from services.risk_engine import calculate_risk
from services.alert_service import evaluate_alert_rules
from services.incident_ops import build_incident_summary, should_create_incident
from models.db_models import LogEntry, Incident, Blocklist
import logging
import os

logger = logging.getLogger("threatlens.seeder")

SEED_ENABLED = os.getenv("SEED_ON_STARTUP", "true").lower() == "true"


def seed_demo_attacks(db: Session):
    """If logs table is empty and seeding is enabled, inject a realistic attack scenario."""
    if not SEED_ENABLED:
        logger.info("[Seeder] Seeding disabled via env.")
        return

    count = db.query(sqlfunc.count(LogEntry.id)).scalar()
    if count > 0:
        logger.info(f"[Seeder] DB already has {count} logs. Skipping seed.")
        return

    logger.info("[Seeder] Empty database detected — injecting simulated attack scenario...")

    now = datetime.utcnow()
    raw_logs = _build_attack_scenario(now)

    injected = 0
    incidents_created = 0

    for ts, raw_log in raw_logs:
        try:
            parsed = parse_log(raw_log)
            detection = detect_threat(parsed, db=db)
            source_ip = parsed.get("source_ip")

            # Blocklist check
            blocklist_hit = False
            if source_ip:
                blocked = db.query(Blocklist).filter(Blocklist.ip_address == source_ip).first()
                if blocked:
                    blocklist_hit = True

            risk = calculate_risk(detection, None, None, db=db, source_ip=source_ip)

            if detection.get("severity_override"):
                risk["risk_level"] = detection["severity_override"]
                risk["risk_score"] = max(risk["risk_score"], 90)
            if blocklist_hit:
                risk["risk_level"] = "CRITICAL"
                risk["risk_score"] = max(risk["risk_score"], 95)

            # Persist log
            log_entry = LogEntry(
                source_ip=source_ip,
                event_id=parsed.get("event_id"),
                user=parsed.get("user"),
                status=parsed.get("status"),
                log_type=parsed.get("log_type"),
                raw_log=raw_log,
                timestamp=ts,
            )
            db.add(log_entry)

            # Persist incident
            if detection.get("threat_detected"):
                should_create, _ = should_create_incident(
                    db,
                    detection["threat_detected"],
                    source_ip,
                    risk["risk_level"],
                    "demo_seed",
                    dedup_minutes=1,
                )
                if should_create:
                    campaign = detection.get("campaign")
                    incident = Incident(
                        timestamp=ts,
                        threat_type=detection["threat_detected"],
                        risk_level=risk["risk_level"],
                        risk_score=risk["risk_score"],
                        source_ip=source_ip,
                        mitre_technique=detection.get("mitre_candidate"),
                        soc_summary=build_incident_summary(
                            "demo_seed",
                            detection,
                            {"seeded": True},
                        ),
                        status="Open",
                        campaign_id=campaign.get("campaign_id") if campaign else None,
                    )
                    db.add(incident)
                    db.flush()
                    evaluate_alert_rules(db, incident)
                    incidents_created += 1

            injected += 1

        except Exception as e:
            logger.warning(f"[Seeder] Error processing log: {e}")
            continue

    db.commit()
    logger.info(f"[Seeder] Done — {injected} logs ingested, {incidents_created} incidents created.")


def _build_attack_scenario(now: datetime) -> list:
    """
    Builds a realistic multi-stage APT attack scenario.
    Returns list of (timestamp, raw_log_string) tuples, sorted chronologically.
    
    Scenario 1: External Brute Force → Credential Dump → Lateral Movement → Exfiltration
    Scenario 2: Port Scanning → Blocked
    Scenario 3: C2 Beacon Activity
    Plus benign background noise
    """
    logs = []

    # ──────────────────────────────────────────────
    # SCENARIO 1: Full APT Kill Chain (attacker 45.133.1.22)
    # ──────────────────────────────────────────────
    atk1 = "45.133.1.22"
    user1 = "admin"

    # Phase 1: Reconnaissance (nmap scan — 72h ago)
    t = now - timedelta(hours=72)
    logs.append((t, f"{t.strftime('%b %d %H:%M:%S')} fw-main kernel: [DROP] IN=eth0 SRC={atk1} DST=10.0.0.5 PROTO=TCP DPT=22 nmap scan detected"))

    # Phase 2: Brute Force (spread across 48h — triggers "Slow Brute Force")
    for i in range(8):
        t = now - timedelta(hours=48 - (i * 5))
        logs.append((t, f"{t.strftime('%b %d %H:%M:%S')} auth-server sshd[{1000+i}]: Failed password for {user1} from {atk1} port 54322 ssh2"))

    # Phase 3: Successful Login After Brute Force (2h ago — CRITICAL)
    t = now - timedelta(hours=2)
    logs.append((t, f"{t.strftime('%b %d %H:%M:%S')} auth-server sshd[1200]: Accepted password for {user1} from {atk1} port 54322 ssh2"))

    # Phase 4: Credential Dumping (90 min ago)
    t = now - timedelta(minutes=90)
    logs.append((t, f'{t.strftime("%Y-%m-%d %H:%M:%S")} WinEventLog:Security: 4688: Process created by {user1}: "procdump.exe -ma lsass.exe lsass.dmp"'))

    # Phase 5: Lateral Movement (60 min ago)
    t = now - timedelta(minutes=60)
    logs.append((t, f'{t.strftime("%Y-%m-%d %H:%M:%S")} WinEventLog:Security: 4688: Process created by {user1}: "psexec.exe \\\\dc01 -u {user1} cmd"'))

    # Phase 6: Persistence (45 min ago)
    t = now - timedelta(minutes=45)
    logs.append((t, f'{t.strftime("%Y-%m-%d %H:%M:%S")} WinEventLog:Security: 4688: Process created: "schtasks /create /tn WindowsUpdate /tr C:\\Temp\\backdoor.exe /sc onlogon"'))

    # Phase 7: Defense Evasion — clearing logs (30 min ago)
    t = now - timedelta(minutes=30)
    logs.append((t, f'{t.strftime("%Y-%m-%d %H:%M:%S")} WinEventLog:Security: 1102: The audit log was cleared. Subject: {user1}'))

    # Phase 8: Data Exfiltration (15 min ago)
    t = now - timedelta(minutes=15)
    logs.append((t, f'{t.strftime("%b %d %H:%M:%S")} proxy-server squid[823]: {atk1} POST https://storage.external-cloud.io/upload - curl/7.68.0 send transfer'))

    # ──────────────────────────────────────────────
    # SCENARIO 2: High-Speed Port Scanning (blocked — 114.114.114.114)
    # ──────────────────────────────────────────────
    atk2 = "114.114.114.114"
    for i, port in enumerate([445, 3389]):  # 2 scans — enough to show detection, not flood
        t = now - timedelta(minutes=10) + timedelta(seconds=i)
        logs.append((t, f"{t.strftime('%b %d %H:%M:%S')} fw-main kernel: [DROP] IN=eth0 SRC={atk2} DST=10.0.0.5 PROTO=TCP DPT={port} BLOCKED"))

    # ──────────────────────────────────────────────
    # SCENARIO 3: C2 Beacon (internal compromised host)
    # ──────────────────────────────────────────────
    t = now - timedelta(minutes=20)
    logs.append((t, f'{t.strftime("%Y-%m-%d %H:%M:%S")} WinEventLog:Security: 4688: Process created: "rundll32.exe beacon.dll,Start" reverse shell callback C2'))

    # ──────────────────────────────────────────────
    # SCENARIO 4: Privilege Escalation Attempt (failed)
    # ──────────────────────────────────────────────
    t = now - timedelta(minutes=55)
    logs.append((t, f"{t.strftime('%b %d %H:%M:%S')} linux-ws1 sudo: user2: failed to sudo runas root - privilege escalation denied ; Status: Failed"))

    # ──────────────────────────────────────────────
    # BENIGN NOISE (normal operations — keeps ratios realistic)
    # ──────────────────────────────────────────────
    benign_users = ["jsmith", "mwilson", "kpatel", "agarcia"]
    benign_ips = ["192.168.1.10", "192.168.1.25", "10.0.0.50", "172.16.0.100"]
    for i in range(15):
        t = now - timedelta(hours=i * 3)
        u = benign_users[i % len(benign_users)]
        ip = benign_ips[i % len(benign_ips)]
        logs.append((t, f"{t.strftime('%b %d %H:%M:%S')} auth-server sshd[{2000+i}]: Accepted password for {u} from {ip} port {50000+i} ssh2"))

    # Sort chronologically
    logs.sort(key=lambda x: x[0])
    return logs
