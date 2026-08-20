"""
MITRE ATT&CK Router — exposes technique search and browsing.
"""
from fastapi import APIRouter, Query
from typing import Optional
from services.mitre_service import get_technique_by_id, search_techniques

router = APIRouter()


@router.get("/technique/{technique_id}")
def get_technique(technique_id: str):
    """Look up a specific MITRE ATT&CK technique by ID (e.g. T1110)."""
    result = get_technique_by_id(technique_id)
    if not result:
        return {"error": f"Technique '{technique_id}' not found"}
    return result


@router.get("/search")
def search_mitre(q: str = Query(..., min_length=2)):
    """Search MITRE techniques by name or keyword."""
    results = search_techniques(q)
    return {"query": q, "results": results, "total": len(results)}