"""
ThreatLens Risk Engine v2.0
Comprehensive risk scoring that factors in ALL available intelligence:
  - Detection confidence + time-decay weight
  - Campaign stage progression (multi-stage = higher risk)
  - CVSS scores from CVE matches
  - VirusTotal IP reputation
  - Blocklist status
  - Threat intel IOC matches
  - Failed login history
"""
from sqlalchemy.orm import Session
from models.db_models import Blocklist, ThreatIntelEntry
from services.app_settings import get_app_settings


def calculate_risk(detection, cves, ip_intel, db: Session = None, source_ip: str = None, threat_intel_matches: list = None):
    score = 0
    factors = []

    # 1. Detection confidence (0-50 points)
    confidence = detection.get("confidence", 0)
    base_score = confidence * 50
    score += base_score
    if confidence > 0:
        factors.append(f"Detection confidence: {confidence:.0%} (+{base_score:.0f})")

    # 2. Time-decay weight adjustment
    decay = detection.get("time_decay_weight", 1.0)
    if decay < 1.0:
        # Historical IP — slightly reduce but don't zero out
        adjustment = (1 - decay) * -5
        score += adjustment
        factors.append(f"Time decay (historical IP): weight={decay:.2f} ({adjustment:+.0f})")

    # 3. Multi-stage campaign escalation (0-30 points)
    campaign = detection.get("campaign")
    if campaign:
        stages = campaign.get("stages_in_campaign", [])
        stage_count = len(stages)
        campaign_bonus = min(stage_count * 10, 30)
        score += campaign_bonus
        factors.append(f"Campaign '{campaign.get('campaign_name')}': {stage_count} stages (+{campaign_bonus})")

        # Multi-stage correlation detected
        if detection.get("multi_stage_correlation"):
            score += 15
            factors.append(f"Multi-stage chain: {detection['multi_stage_correlation']} (+15)")

    # 4. CVSS contribution from CVE matches (0-20 points)
    if cves:
        max_cvss = 0
        for cve in cves:
            cvss = cve.get("cvss_score", 0)
            if cvss and cvss > max_cvss:
                max_cvss = cvss
        if max_cvss > 0:
            cvss_bonus = max_cvss * 2
            score += cvss_bonus
            factors.append(f"Highest CVSS: {max_cvss} (+{cvss_bonus:.0f})")

    # 5. VirusTotal IP reputation (0-30 points)
    if ip_intel and ip_intel.get("reputation"):
        rep = ip_intel["reputation"]
        malicious = rep.get("malicious", 0)
        suspicious = rep.get("suspicious", 0)
        vt_score = malicious * 5 + suspicious * 2
        if vt_score > 0:
            score += min(vt_score, 30)
            factors.append(f"VirusTotal: {malicious} malicious, {suspicious} suspicious (+{min(vt_score, 30)})")

    # 6. Blocklist check (0 or +25 points)
    if db and source_ip:
        blocked = db.query(Blocklist).filter(Blocklist.ip_address == source_ip).first()
        if blocked:
            score += 25
            factors.append(f"IP is on BLOCKLIST (+25)")

    # 7. Threat intel IOC matches (0-20 points)
    if threat_intel_matches:
        direct_matches = [m for m in threat_intel_matches if m.get("relevance") == "direct_match"]
        if direct_matches:
            score += 20
            factors.append(f"Direct IOC match in threat intel ({len(direct_matches)} hits) (+20)")
        elif threat_intel_matches:
            score += 5
            factors.append(f"Semantic threat intel match (+5)")

    # 8. Failed login history (0-15 points)
    failed = detection.get("failed_attempts_from_ip", 0)
    if failed >= 10:
        score += 15
        factors.append(f"High failure count: {failed} failed logins (+15)")
    elif failed >= 5:
        score += 8
        factors.append(f"Moderate failure count: {failed} failed logins (+8)")
    elif failed >= 3:
        score += 3
        factors.append(f"Brute force threshold: {failed} failed logins (+3)")

    # Cap at 100
    score = min(round(score, 2), 100)

    thresholds = get_app_settings().get("detection", {}).get("risk_thresholds", {})
    critical_threshold = thresholds.get("critical", 80)
    high_threshold = thresholds.get("high", 55)
    medium_threshold = thresholds.get("medium", 30)

    # Classification
    if score >= critical_threshold:
        level = "CRITICAL"
    elif score >= high_threshold:
        level = "HIGH"
    elif score >= medium_threshold:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "risk_score": score,
        "risk_level": level,
        "risk_factors": factors,
    }
