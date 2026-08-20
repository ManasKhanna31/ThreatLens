"""
ThreatLens RAG Service v2.1
Retrieves relevant threat intelligence from MySQL-backed store.
Uses cached TF-IDF matrix (rebuilt only when data changes) + direct IOC matching.
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.db_models import ThreatIntelEntry
import logging

logger = logging.getLogger("threatlens.rag")

# Module-level TF-IDF cache
_tfidf_cache = {
    "vectorizer": None,
    "matrix": None,
    "entries": None,
    "entry_count": 0,
}


def _get_or_rebuild_tfidf(db: Session):
    """Build TF-IDF matrix only when the intel count changes."""
    current_count = db.query(func.count(ThreatIntelEntry.id)).scalar() or 0

    if (
        _tfidf_cache["matrix"] is not None
        and _tfidf_cache["entry_count"] == current_count
        and current_count > 0
    ):
        return _tfidf_cache["vectorizer"], _tfidf_cache["matrix"], _tfidf_cache["entries"]

    # Rebuild
    entries = db.query(ThreatIntelEntry).order_by(
        ThreatIntelEntry.ingested_at.desc()
    ).limit(500).all()

    if not entries or len(entries) < 2:
        return None, None, entries or []

    documents = [f"{e.title} {e.description}" for e in entries]
    vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
    matrix = vectorizer.fit_transform(documents)

    _tfidf_cache["vectorizer"] = vectorizer
    _tfidf_cache["matrix"] = matrix
    _tfidf_cache["entries"] = entries
    _tfidf_cache["entry_count"] = current_count

    logger.info(f"[RAG] TF-IDF cache rebuilt with {current_count} entries")
    return vectorizer, matrix, entries


def retrieve_threat_intel(query: str, db: Session, top_k: int = 3) -> list:
    """
    Retrieve relevant threat intelligence using two strategies:
    1. Direct IOC match (IP, CVE, hash exact match)
    2. Cached TF-IDF semantic similarity over descriptions
    """
    if not query:
        return []

    results = []

    # Strategy 1: Direct IOC match
    try:
        direct_matches = db.query(ThreatIntelEntry).filter(
            ThreatIntelEntry.ioc_value.contains(query[:100])
        ).limit(3).all()

        for match in direct_matches:
            results.append({
                "intel_id": match.id,
                "source": match.source,
                "title": match.title,
                "description": match.description,
                "ioc_type": match.ioc_type,
                "ioc_value": match.ioc_value,
                "severity": match.severity,
                "relevance": "direct_match",
                "relevance_score": 1.0,
            })
    except Exception as e:
        logger.warning(f"Direct IOC match failed: {e}")

    # Strategy 2: Cached TF-IDF semantic search
    try:
        vectorizer, matrix, entries = _get_or_rebuild_tfidf(db)

        if vectorizer and matrix is not None and entries:
            query_vec = vectorizer.transform([query])
            similarities = cosine_similarity(query_vec, matrix).flatten()
            top_indices = similarities.argsort()[-top_k:][::-1]

            for idx in top_indices:
                if similarities[idx] > 0.05:
                    entry = entries[idx]
                    if not any(r["intel_id"] == entry.id for r in results):
                        results.append({
                            "intel_id": entry.id,
                            "source": entry.source,
                            "title": entry.title,
                            "description": entry.description,
                            "ioc_type": entry.ioc_type,
                            "ioc_value": entry.ioc_value,
                            "severity": entry.severity,
                            "relevance": "semantic_match",
                            "relevance_score": round(float(similarities[idx]), 3),
                        })
    except Exception as e:
        logger.warning(f"TF-IDF search failed: {e}")

    # Fallback: if no DB intel exists, use built-in knowledge base
    if not results:
        results = _fallback_intel(query)

    return results[:top_k]


def check_ioc_match(ip: str, db: Session) -> list:
    """
    Check if an IP address appears in our threat intel database.
    Used during log ingestion for automatic IOC cross-referencing.
    """
    if not ip:
        return []

    matches = db.query(ThreatIntelEntry).filter(
        ThreatIntelEntry.ioc_value == ip,
        ThreatIntelEntry.ioc_type == "ip",
    ).all()

    return [
        {
            "intel_id": m.id,
            "source": m.source,
            "title": m.title,
            "severity": m.severity,
            "ioc_type": m.ioc_type,
        }
        for m in matches
    ]


def _fallback_intel(query: str) -> list:
    """Hardcoded minimal intel for when DB has no entries yet."""
    BUILTIN_INTEL = [
        {
            "title": "Brute Force leading to PowerShell Execution",
            "description": "Common multi-stage attack: initial access via brute force on RDP/SSH, followed by obfuscated PowerShell scripts for persistence or secondary payloads.",
            "tags": ["Brute Force", "PowerShell", "Initial Access"],
        },
        {
            "title": "Credential Dumping via LSASS",
            "description": "Adversaries access credential material in LSASS process memory using tools like Mimikatz or ProcDump for offline credential extraction.",
            "tags": ["Credential Dumping", "LSASS", "Mimikatz"],
        },
        {
            "title": "Ransomware Lateral Movement Pattern",
            "description": "After initial compromise, ransomware operators perform internal recon then laterally move using compromised credentials via SMB/WMI.",
            "tags": ["Ransomware", "Lateral Movement", "SMB"],
        },
        {
            "title": "APT Slow Brute Force Campaign",
            "description": "Advanced threat actors spread login attempts across days or weeks to avoid detection thresholds, often using rotating proxy infrastructure.",
            "tags": ["APT", "Slow Brute Force", "Evasion"],
        },
    ]

    query_lower = query.lower()
    results = []
    for intel in BUILTIN_INTEL:
        score = sum(1 for tag in intel["tags"] if tag.lower() in query_lower) / len(intel["tags"])
        if score > 0 or any(word in intel["description"].lower() for word in query_lower.split()):
            results.append({
                "intel_id": None,
                "source": "BUILTIN",
                "title": intel["title"],
                "description": intel["description"],
                "ioc_type": "technique",
                "ioc_value": None,
                "severity": "MEDIUM",
                "relevance": "fallback",
                "relevance_score": round(score, 3),
            })

    return sorted(results, key=lambda x: x["relevance_score"], reverse=True)
