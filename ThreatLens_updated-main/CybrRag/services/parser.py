import re
from typing import Dict
from services.llm_service import llm_parse_log


def extract_ip(text: str):
    explicit_patterns = [
        r"(?:SRC|SourceIP|Source|ClientIP|src)[:=\s]+((?:\d{1,3}\.){3}\d{1,3})",
        r"from\s+((?:\d{1,3}\.){3}\d{1,3})",
        r"Source Network Address[:=\s]+((?:\d{1,3}\.){3}\d{1,3})",
    ]
    for pattern in explicit_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)

    pattern = r"(?:\d{1,3}\.){3}\d{1,3}"
    match = re.search(pattern, text)
    return match.group(0) if match else None


def extract_event_id(text: str):
    match = re.search(r"(?:EventID|ID)[:=\s]+(\d+)", text, re.IGNORECASE)
    return match.group(1) if match else None


def extract_user(text: str):
    patterns = [
        r"User[:=\s]+([A-Za-z0-9_.\\-]+)",
        r"for\s+([A-Za-z0-9_.\\-]+)\s+from",
        r"Account Name[:=\s]+([A-Za-z0-9_.\\$-]+)",
        r"by\s+([A-Za-z0-9_.\\-]+)[:\s]",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def extract_status(text: str):
    text_lower = text.lower()
    if any(token in text_lower for token in ["failed", "failure", "invalid password", "authentication failure"]):
        return "Failed"
    if any(token in text_lower for token in ["success", "accepted password", "login succeeded", "successful"]):
        return "Success"
    if "blocked" in text_lower or "[drop]" in text_lower or " drop " in text_lower:
        return "BLOCKED"
    if "rejected" in text_lower:
        return "REJECTED"
    if "denied" in text_lower or "deny" in text_lower:
        return "DENIED"
    return None


# Expanded log type detection with support for cloud and network logs
LOG_TYPE_PATTERNS = [
    # Windows
    (r"EventID|EventLog|Security\sLog|Windows\sEvent|Microsoft-Windows", "windows"),
    # Linux / Unix
    (r"sshd|pam_unix|sudo\[|systemd|cron\[|kernel:|auditd|auth\.log", "linux"),
    # Cisco ASA / IOS (must come before generic firewall)
    (r"%ASA-|%FWSM-|%PIX-|Cisco|ASA-\d-\d+", "cisco"),
    # Palo Alto (must come before generic firewall)
    (r"TRAFFIC|THREAT|paloalto|pan_", "palo_alto"),
    # IDS/IPS (Snort, Suricata)
    (r"snort|suricata|\[\*\*\].*\[\d+:\d+:\d+\]|ET\s(POLICY|TROJAN|MALWARE)", "ids_ips"),
    # Firewall / Network (generic — after vendor-specific)
    (r"iptables|netfilter|pf\.log|ufw\s|DENY\sIN=|ACCEPT\sIN=", "firewall"),
    # AWS CloudTrail
    (r"CloudTrail|aws\.source|userIdentity|eventSource.*amazonaws", "aws_cloudtrail"),
    # Azure Activity
    (r"Azure|AzureAD|SignInLogs|AuditLogs|microsoft\.aad", "azure"),
    # GCP
    (r"gcloud|projects/.*logs|google\.cloud", "gcp"),
    # Web Server (Apache / Nginx)
    (r"GET /|POST /|HTTP/\d\.\d|nginx|apache|\d{3}\s\d+\s\"", "web_server"),
    # DNS
    (r"query\[|NXDOMAIN|dns|named\[|dnsmasq", "dns"),
    # Syslog generic
    (r"<\d+>|syslog|rsyslog|facility|severity", "syslog"),
]


def detect_log_type(text: str):
    """Detect log type using expanded pattern matching across 12+ log formats."""
    for pattern, log_type in LOG_TYPE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return log_type
    return "unknown"


def extract_process(text: str):
    """Extract process name from log entry."""
    match = re.search(r"Process[:\s=]+([^\s,;]+)", text, re.IGNORECASE)
    if match:
        return match.group(1)
    created_match = re.search(r'Process created(?: by [^:]+)?:\s*"([^"]+)"', text, re.IGNORECASE)
    if created_match:
        return created_match.group(1)
    exe_match = re.search(r"(\w+\.exe)", text, re.IGNORECASE)
    if exe_match:
        return exe_match.group(1)
    return None


def extract_port(text: str):
    """Extract destination port from log entry."""
    match = re.search(r"(?:Port|port|dst_port|DstPort|DPT)[:=\s]+(\d+)", text, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def extract_hostname(text: str):
    """Extract hostname from log entry."""
    match = re.search(r"(?:Host|Hostname|Computer|Workstation|MachineName)[:=\s]+([^\s,;]+)", text, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def extract_dest_ip(text: str, source_ip: str = None):
    """Extract destination IP."""
    match = re.search(r"(?:DstIP|DestIP|Destination|dst|DST)[:=\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", text, re.IGNORECASE)
    if match:
        return match.group(1)
    all_ips = re.findall(r"(?:\d{1,3}\.){3}\d{1,3}", text)
    for ip in all_ips:
        if ip != source_ip:
            return ip
    return None


def parse_log(raw_log: str) -> Dict:
    source_ip = extract_ip(raw_log)
    parsed = {
        "event_id": extract_event_id(raw_log),
        "user": extract_user(raw_log),
        "source_ip": source_ip,
        "dest_ip": extract_dest_ip(raw_log, source_ip),
        "status": extract_status(raw_log),
        "log_type": detect_log_type(raw_log),
        "process": extract_process(raw_log),
        "port": extract_port(raw_log),
        "hostname": extract_hostname(raw_log),
        "raw": raw_log
    }

    # If critical fields are missing, try LLM for dynamic understanding
    if not parsed.get("source_ip") and not parsed.get("event_id"):
        try:
            llm_parsed = llm_parse_log(raw_log)
            if llm_parsed and isinstance(llm_parsed, dict) and "raw_response" not in llm_parsed:
                for key, value in llm_parsed.items():
                    if value and not parsed.get(key):
                        parsed[key] = str(value)
        except Exception:
            pass  # LLM failure should never crash parsing

    return parsed
