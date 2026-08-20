# services/ip_intel_service.py
import requests
from config import settings
from functools import lru_cache
from datetime import datetime, timedelta
import time
import socket
import ipaddress

VT_URL = "https://www.virustotal.com/api/v3/ip_addresses/"
OPENCAGE_URL = "https://api.opencagedata.com/geocode/v1/json"

# Free IP geolocation services as backup
IPAPI_URL = "http://ip-api.com/json/"  # We'll keep this as backup for geolocation only
IPINFO_URL = "https://ipinfo.io/{}/json"

# Cache
geo_cache = {}
CACHE_DURATION = timedelta(hours=24)

def is_public_ip(ip):
    """Check if IP is public (not private/local)"""
    try:
        ip_obj = ipaddress.ip_address(ip)
        return not (ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_multicast)
    except:
        return False

def get_ip_geolocation_ipapi(ip):
    """
    Get geolocation using ip-api.com (free, no key needed)
    This is specifically for IP geolocation
    """
    if not is_public_ip(ip):
        return {
            'ip': ip,
            'city': 'Local/Private IP',
            'country': 'Local Network',
            'country_code': 'LOCAL',
            'lat': 0,
            'lon': 0,
            'isp': 'Local Network',
            'org': 'Private IP',
            'source': 'ipapi'
        }
    
    try:
        response = requests.get(f"{IPAPI_URL}{ip}", params={'fields': 'status,country,countryCode,region,city,lat,lon,isp,org,as'}, timeout=5)
        data = response.json()
        
        if data.get('status') == 'success':
            return {
                'ip': ip,
                'city': data.get('city', 'Unknown'),
                'region': data.get('region', ''),
                'country': data.get('country', 'Unknown'),
                'country_code': data.get('countryCode', ''),
                'lat': data.get('lat', 0),
                'lon': data.get('lon', 0),
                'isp': data.get('isp', 'Unknown'),
                'org': data.get('org', 'Unknown'),
                'as': data.get('as', ''),
                'source': 'ipapi'
            }
        else:
            return None
    except Exception as e:
        print(f"Error with ip-api.com: {e}")
        return None

def get_ip_geolocation_ipinfo(ip):
    """
    Get geolocation using ipinfo.io (free, requires token but has better data)
    Sign up at https://ipinfo.io for free token (50k requests/month)
    """
    if not settings.IPINFO_TOKEN:
        return None
    
    try:
        response = requests.get(
            IPINFO_URL.format(ip),
            params={'token': settings.IPINFO_TOKEN},
            timeout=5
        )
        data = response.json()
        
        if 'loc' in data:
            lat, lon = data['loc'].split(',')
            return {
                'ip': ip,
                'city': data.get('city', 'Unknown'),
                'region': data.get('region', ''),
                'country': data.get('country', 'Unknown'),
                'country_code': data.get('country', ''),
                'lat': float(lat),
                'lon': float(lon),
                'org': data.get('org', 'Unknown'),
                'postal': data.get('postal', ''),
                'timezone': data.get('timezone', ''),
                'source': 'ipinfo'
            }
        else:
            return None
    except Exception as e:
        print(f"Error with ipinfo.io: {e}")
        return None

def get_ip_geolocation_opencage(lat, lon):
    """
    Use OpenCage to get detailed location info from coordinates
    This enriches the basic IP geolocation with more details
    """
    if not settings.OPENCAGE_API_KEY:
        return None
    
    try:
        params = {
            'q': f"{lat},{lon}",
            'key': settings.OPENCAGE_API_KEY,
            'pretty': 1,
            'language': 'en'
        }
        
        response = requests.get(OPENCAGE_URL, params=params, timeout=5)
        data = response.json()
        
        if data.get('results') and len(data['results']) > 0:
            result = data['results'][0]
            components = result.get('components', {})
            annotations = result.get('annotations', {})
            
            return {
                'timezone': annotations.get('timezone', {}).get('name', ''),
                'currency': annotations.get('currency', {}).get('name', ''),
                'flag': annotations.get('flag', ''),
                'continent': components.get('continent', ''),
                'formatted_address': result.get('formatted', ''),
                'confidence': result.get('confidence', 0),
                'source': 'opencage'
            }
    except Exception as e:
        print(f"Error with OpenCage reverse geocoding: {e}")
        return None
    
    return None

def get_ip_geolocation(ip):
    """
    Main geolocation function - uses multiple services for best results
    """
    # Check cache first
    if ip in geo_cache:
        cache_time, cache_data = geo_cache[ip]
        if datetime.now() - cache_time < CACHE_DURATION:
            print(f"Cache hit for {ip}")
            return cache_data
    
    # Get basic geolocation
    geo_data = None
    
    # Try ip-api.com first (no key needed)
    geo_data = get_ip_geolocation_ipapi(ip)
    
    # If ip-api fails and we have ipinfo token, try that
    if not geo_data and settings.IPINFO_TOKEN:
        geo_data = get_ip_geolocation_ipinfo(ip)
    
    # If we got coordinates, enrich with OpenCage
    if geo_data and geo_data.get('lat') and geo_data.get('lon'):
        enriched = get_ip_geolocation_opencage(geo_data['lat'], geo_data['lon'])
        if enriched:
            geo_data.update(enriched)
    
    # For private/local IPs
    if not geo_data:
        geo_data = {
            'ip': ip,
            'city': 'Private/Local IP',
            'country': 'Local Network',
            'country_code': 'LOCAL',
            'lat': 0,
            'lon': 0,
            'isp': 'Local Network',
            'org': 'Private IP',
            'source': 'local'
        }
    
    # Cache the result
    geo_cache[ip] = (datetime.now(), geo_data)
    
    return geo_data


def get_ip_reputation(ip):
    """Get IP reputation from VirusTotal"""
    if not settings.VT_API_KEY:
        return {
            "malicious": 0,
            "suspicious": 0,
            "harmless": 0,
            "undetected": 0,
            "source": "none"
        }

    headers = {"x-apikey": settings.VT_API_KEY}

    try:
        response = requests.get(f"{VT_URL}{ip}", headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        stats = data["data"]["attributes"]["last_analysis_stats"]

        return {
            "malicious": stats.get("malicious", 0),
            "suspicious": stats.get("suspicious", 0),
            "harmless": stats.get("harmless", 0),
            "undetected": stats.get("undetected", 0),
            "source": "virustotal"
        }
    except Exception as e:
        print(f"Error fetching reputation for {ip}: {e}")
        return {
            "malicious": 0,
            "suspicious": 0,
            "harmless": 0,
            "undetected": 0,
            "source": "error"
        }

def enrich_ip(ip):
    """Main function to enrich IP with geolocation and reputation"""
    print(f"Enriching IP: {ip}")
    
    # Get geolocation
    geo = get_ip_geolocation(ip)
    print(f"Geo data: {geo.get('city')}, {geo.get('country')} ({geo.get('lat')}, {geo.get('lon')})")
    
    # Get reputation
    reputation = get_ip_reputation(ip)
    
    # Calculate risk score
    risk_score = 0
    risk_factors = []
    
    if reputation:
        risk_score += reputation['malicious'] * 10
        risk_score += reputation['suspicious'] * 5
        
        if reputation['malicious'] > 0:
            risk_factors.append(f"Malicious ({reputation['malicious']} detections)")
    
    # Country-based risk
    high_risk_countries = ['RU', 'CN', 'IR', 'KP', 'SY', 'VE']
    if geo.get('country_code') in high_risk_countries:
        risk_score += 20
        risk_factors.append(f"High-risk country: {geo.get('country')}")
    
    risk_level = 'CRITICAL' if risk_score >= 70 else 'HIGH' if risk_score >= 40 else 'MEDIUM' if risk_score >= 20 else 'LOW'
    
    result = {
        "ip": ip,
        "geo": geo,
        "reputation": reputation,
        "risk_assessment": {
            "risk_score": min(risk_score, 100),
            "risk_level": risk_level,
            "risk_factors": risk_factors
        },
        "enriched_at": datetime.now().isoformat()
    }
    
    print(f"IP enrichment complete. Risk: {risk_level} ({risk_score})")
    return result

# Test function
if __name__ == "__main__":
    # Test with various IPs
    test_ips = ["8.8.8.8", "1.1.1.1", "203.55.77.99", "192.168.1.1"]
    
    for ip in test_ips:
        print(f"\n{'='*50}")
        print(f"Testing IP: {ip}")
        result = enrich_ip(ip)
        print(f"Location: {result['geo'].get('city')}, {result['geo'].get('country')}")
        print(f"Coordinates: {result['geo'].get('lat')}, {result['geo'].get('lon')}")
        print(f"Risk: {result['risk_assessment']['risk_level']} ({result['risk_assessment']['risk_score']})")