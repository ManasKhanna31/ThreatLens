"""
ThreatLens Threat Intelligence Ingestion Service
Fetches from real, free threat intelligence feeds:
  - CISA KEV (Known Exploited Vulnerabilities)
  - Abuse.ch Feodo Tracker (Botnet C2 IPs)
  - Abuse.ch URLhaus (Malicious URLs)
Stores in MySQL for RAG retrieval.
"""
import httpx
import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from models.database import SessionLocal
from models.db_models import ThreatIntelEntry

logger = logging.getLogger("threatlens.intel_ingestion")

CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
FEODO_TRACKER_URL = "https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json"
URLHAUS_RECENT_URL = "https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/"


def ingest_all():
    """Run all ingestion pipelines."""
    db = SessionLocal()
    try:
        results = {
            "cisa_kev": _ingest_cisa_kev(db),
            "feodo_tracker": _ingest_feodo_tracker(db),
            "urlhaus": _ingest_urlhaus(db),
        }
        db.commit()
        logger.info(f"[Intel Ingestion] Complete: {results}")
        return results
    except Exception as e:
        logger.error(f"[Intel Ingestion] Error: {e}")
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


def _ingest_cisa_kev(db: Session) -> dict:
    """Ingest CISA Known Exploited Vulnerabilities catalog."""
    try:
        resp = httpx.get(CISA_KEV_URL, timeout=15)
        if resp.status_code != 200:
            return {"status": "error", "code": resp.status_code}

        data = resp.json()
        vulns = data.get("vulnerabilities", [])
        new_count = 0

        for vuln in vulns[:100]:  # Latest 100
            cve_id = vuln.get("cveID", "")

            # Skip if already exists
            exists = db.query(ThreatIntelEntry).filter(
                ThreatIntelEntry.ioc_value == cve_id,
                ThreatIntelEntry.source == "CISA_KEV",
            ).first()
            if exists:
                continue

            entry = ThreatIntelEntry(
                source="CISA_KEV",
                title=f"{cve_id}: {vuln.get('vulnerabilityName', 'Unknown')}",
                description=(
                    f"Vendor: {vuln.get('vendorProject', 'N/A')}. "
                    f"Product: {vuln.get('product', 'N/A')}. "
                    f"{vuln.get('shortDescription', '')} "
                    f"Required action: {vuln.get('requiredAction', 'N/A')}. "
                    f"Due date: {vuln.get('dueDate', 'N/A')}."
                ),
                ioc_type="cve",
                ioc_value=cve_id,
                severity="CRITICAL",
                tags=[
                    vuln.get("vendorProject", ""),
                    vuln.get("product", ""),
                    vuln.get("knownRansomwareCampaignUse", "Unknown"),
                ],
                raw_data=vuln,
            )
            db.add(entry)
            new_count += 1

        return {"status": "ok", "new_entries": new_count, "total_in_feed": len(vulns)}

    except Exception as e:
        logger.error(f"CISA KEV ingestion failed: {e}")
        return {"status": "error", "message": str(e)}


def _ingest_feodo_tracker(db: Session) -> dict:
    """Ingest Abuse.ch Feodo Tracker botnet C2 IP blocklist."""
    try:
        resp = httpx.get(FEODO_TRACKER_URL, timeout=15)
        if resp.status_code != 200:
            return {"status": "error", "code": resp.status_code}

        data = resp.json()
        entries = data if isinstance(data, list) else data.get("data", data.get("entries", []))
        new_count = 0

        if not isinstance(entries, list):
            return {"status": "error", "message": "Unexpected feed format"}

        for item in entries[:200]:
            ip = item.get("ip_address") or item.get("dst_ip", "")
            if not ip:
                continue

            exists = db.query(ThreatIntelEntry).filter(
                ThreatIntelEntry.ioc_value == ip,
                ThreatIntelEntry.source == "FEODO_TRACKER",
            ).first()
            if exists:
                continue

            entry = ThreatIntelEntry(
                source="FEODO_TRACKER",
                title=f"Botnet C2: {ip}",
                description=(
                    f"Malware: {item.get('malware', 'Unknown')}. "
                    f"Port: {item.get('dst_port', item.get('port', 'N/A'))}. "
                    f"Status: {item.get('status', 'N/A')}. "
                    f"Country: {item.get('country', 'N/A')}. "
                    f"This IP has been identified as an active command and control server."
                ),
                ioc_type="ip",
                ioc_value=ip,
                severity="CRITICAL",
                tags=[item.get("malware", "botnet"), "C2", item.get("country", "")],
                raw_data=item,
            )
            db.add(entry)
            new_count += 1

        return {"status": "ok", "new_entries": new_count}

    except Exception as e:
        logger.error(f"Feodo Tracker ingestion failed: {e}")
        return {"status": "error", "message": str(e)}


def _ingest_urlhaus(db: Session) -> dict:
    """Ingest Abuse.ch URLhaus recent malicious URLs."""
    try:
        resp = httpx.post(URLHAUS_RECENT_URL, timeout=15)
        if resp.status_code != 200:
            return {"status": "error", "code": resp.status_code}

        data = resp.json()
        urls = data.get("urls", [])
        new_count = 0

        for item in urls[:100]:
            url_val = item.get("url", "")
            if not url_val:
                continue

            exists = db.query(ThreatIntelEntry).filter(
                ThreatIntelEntry.ioc_value == url_val[:500],
                ThreatIntelEntry.source == "URLHAUS",
            ).first()
            if exists:
                continue

            entry = ThreatIntelEntry(
                source="URLHAUS",
                title=f"Malicious URL: {url_val[:80]}",
                description=(
                    f"Threat: {item.get('threat', 'Unknown')}. "
                    f"Status: {item.get('url_status', 'N/A')}. "
                    f"Tags: {', '.join(item.get('tags', []) or [])}. "
                    f"Reporter: {item.get('reporter', 'N/A')}."
                ),
                ioc_type="url",
                ioc_value=url_val[:500],
                severity="HIGH",
                tags=item.get("tags") or ["malware"],
                raw_data=item,
            )
            db.add(entry)
            new_count += 1

        return {"status": "ok", "new_entries": new_count}

    except Exception as e:
        logger.error(f"URLhaus ingestion failed: {e}")
        return {"status": "error", "message": str(e)}


def get_intel_stats(db: Session) -> dict:
    """Return counts of stored threat intel."""
    from sqlalchemy import func
    total = db.query(func.count(ThreatIntelEntry.id)).scalar() or 0
    by_source = (
        db.query(ThreatIntelEntry.source, func.count(ThreatIntelEntry.id))
        .group_by(ThreatIntelEntry.source)
        .all()
    )
    return {
        "total_entries": total,
        "by_source": {s: c for s, c in by_source},
    }
