import requests
import logging
from config import settings

logger = logging.getLogger("threatlens.cve")

NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"


def search_cves(keyword: str, max_results: int = 3):
    """Search NVD for CVEs matching a keyword. Gracefully handles API errors."""
    params = {
        "keywordSearch": keyword,
        "resultsPerPage": max_results
    }

    headers = {}
    if settings.NVD_API_KEY:
        headers["apiKey"] = settings.NVD_API_KEY

    try:
        response = requests.get(NVD_URL, params=params, headers=headers, timeout=10)

        if response.status_code == 403:
            logger.warning("[CVE] NVD API returned 403 Forbidden — rate limited or invalid key")
            return []
        if response.status_code == 429:
            logger.warning("[CVE] NVD API returned 429 Too Many Requests")
            return []
        if response.status_code != 200:
            logger.warning(f"[CVE] NVD API returned {response.status_code}")
            return []

        data = response.json()
        results = []

        for item in data.get("vulnerabilities", []):
            cve_data = item.get("cve", {})
            metrics = cve_data.get("metrics", {})

            cvss_score = None
            if "cvssMetricV31" in metrics:
                cvss_score = metrics["cvssMetricV31"][0]["cvssData"]["baseScore"]
            elif "cvssMetricV2" in metrics:
                cvss_score = metrics["cvssMetricV2"][0]["cvssData"]["baseScore"]

            results.append({
                "cve_id": cve_data.get("id"),
                "description": cve_data.get("descriptions", [{}])[0].get("value"),
                "cvss_score": cvss_score
            })

        return results

    except requests.exceptions.Timeout:
        logger.warning("[CVE] NVD API request timed out")
        return []
    except requests.exceptions.ConnectionError:
        logger.warning("[CVE] NVD API connection failed")
        return []
    except Exception as e:
        logger.error(f"[CVE] Unexpected error: {e}")
        return []