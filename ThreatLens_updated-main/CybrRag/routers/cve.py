"""
CVE Router — exposes CVE search via the National Vulnerability Database.
"""
from fastapi import APIRouter, Query
from services.cve_service import search_cves

router = APIRouter()


@router.get("/search")
def search_cve(q: str = Query(..., min_length=2)):
    """Search for CVEs related to a technique or keyword (via NVD API)."""
    results = search_cves(q)
    return {"query": q, "results": results, "total": len(results) if results else 0}
