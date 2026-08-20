import requests
import json
import os
import logging

logger = logging.getLogger("threatlens.mitre")

CACHE_FILE = "data/mitre_cache.json"

MITRE_STIX_URL = (
    "https://raw.githubusercontent.com/mitre-attack/"
    "attack-stix-data/master/enterprise-attack/enterprise-attack.json"
)

# In-memory cache — loaded once, reused for all subsequent calls
_mitre_cache = None


def _load_mitre_data_once():
    """Load MITRE data into memory once, then reuse."""
    global _mitre_cache

    if _mitre_cache is not None:
        return _mitre_cache

    # Try reading from disk cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = f.read().strip()
                if data:
                    _mitre_cache = json.loads(data)
                    logger.info(f"[MITRE] Loaded {len(_mitre_cache)} techniques from disk cache")
                    return _mitre_cache
        except Exception:
            pass

    # Fetch from remote
    return _fetch_and_cache()


def _fetch_and_cache():
    """Fetch MITRE data from GitHub and cache both to disk and memory."""
    global _mitre_cache

    try:
        logger.info("[MITRE] Fetching MITRE ATT&CK data from GitHub...")
        response = requests.get(MITRE_STIX_URL, timeout=30)
        response.raise_for_status()

        stix_data = response.json()
        techniques = []

        for obj in stix_data.get("objects", []):
            if obj.get("type") == "attack-pattern":
                external_refs = obj.get("external_references", [])
                technique_id = None

                for ref in external_refs:
                    if ref.get("source_name") == "mitre-attack":
                        technique_id = ref.get("external_id")

                if technique_id:
                    techniques.append({
                        "id": technique_id,
                        "name": obj.get("name"),
                        "description": obj.get("description")
                    })

        os.makedirs("data", exist_ok=True)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(techniques, f, indent=2)

        _mitre_cache = techniques
        logger.info(f"[MITRE] Cached {len(techniques)} techniques")
        return techniques

    except Exception as e:
        logger.error(f"[MITRE] Failed to fetch: {e}")
        _mitre_cache = []
        return []


def get_technique_by_id(technique_id: str):
    """Look up a MITRE technique by ID. Uses in-memory cache."""
    techniques = _load_mitre_data_once()
    for tech in techniques:
        if tech["id"] == technique_id:
            return tech
    return None


def search_techniques(query: str, limit: int = 20):
    """Search MITRE techniques by name or description keyword."""
    techniques = _load_mitre_data_once()
    q = query.lower()
    results = []
    for tech in techniques:
        name = (tech.get("name") or "").lower()
        desc = (tech.get("description") or "").lower()
        if q in name or q in desc:
            results.append({
                "id": tech["id"],
                "name": tech["name"],
                "description": (tech.get("description") or "")[:200],
            })
            if len(results) >= limit:
                break
    return results


def refresh_cache():
    """Force refresh the MITRE data cache."""
    global _mitre_cache
    _mitre_cache = None
    return _fetch_and_cache()