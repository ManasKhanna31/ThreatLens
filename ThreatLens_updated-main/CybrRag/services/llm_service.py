import requests
import json
import logging
from config import settings

logger = logging.getLogger("threatlens.llm")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def clean_llm_response(raw_text: str):
    """
    Extracts the first valid JSON object from LLM response safely.
    """
    import re

    try:
        raw_text = raw_text.strip()
        raw_text = raw_text.replace("```json", "").replace("```", "").strip()
        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if match:
            json_text = match.group(0)
            return json.loads(json_text)
        return {"raw_response": raw_text}
    except Exception:
        return {"raw_response": raw_text}


def llm_parse_log(raw_text: str):
    """
    Uses the Groq LLM to dynamically understand and parse unstructured log files
    that fail traditional regex parsing.
    """
    if not settings.GROQ_API_KEY:
        return None

    prompt = f"""
You are an expert log parser.
Extract the following fields from this unstructured raw log and return ONLY valid JSON:
{{
  "event_id": "extract if present, otherwise null",
  "user": "extract if present, otherwise null",
  "source_ip": "extract if present, otherwise null",
  "status": "Success or Failed, otherwise null",
  "log_type": "windows, linux, or unknown"
}}

Raw Log:
{raw_text}
"""

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 200
    }

    try:
        response = requests.post(GROQ_URL, headers=headers, json=payload, timeout=5)
        if response.status_code == 200:
            result = response.json()
            raw_output = result["choices"][0]["message"]["content"]
            return clean_llm_response(raw_output)
        else:
            logger.warning(f"[LLM Parse] API returned {response.status_code}")
            return None
    except requests.exceptions.Timeout:
        logger.warning("[LLM Parse] Request timed out")
        return None
    except Exception as e:
        logger.warning(f"[LLM Parse] Failed: {e}")
        return None


def generate_soc_summary(parsed, detection, mitre, cves, ip_intel, risk, threat_intel=None):
    """Generate SOC summary using LLM. Gracefully handles all failure modes."""
    if not settings.GROQ_API_KEY:
        return {"error": "Missing GROQ_API_KEY"}

    prompt = f"""
You are a senior SOC analyst. Your task is to provide a factual analysis of the provided security event.
DO NOT hallucinate. Only mention products, IPs, or vulnerabilities present in the Event Data.
Respond ONLY in valid JSON format:

{{
  "executive_summary": "1-2 sentence overview.",
  "technical_analysis": "Technical breakdown of event mechanics.",
  "business_impact": "Organizational and risk impact.",
  "recommended_actions": "Remediation steps for this specific event."
}}

Event Data:
Parsed Log: {json.dumps(parsed, default=str)}
Detection Result: {json.dumps(detection, default=str)}
MITRE: {json.dumps(mitre, default=str)}
CVEs: {json.dumps(cves, default=str)}
IP Intelligence: {json.dumps(ip_intel, default=str)}
Risk Assessment: {json.dumps(risk, default=str)}
Historical Threat Intelligence (RAG Context): {json.dumps(threat_intel, default=str) if threat_intel else "None"}
"""

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": "You are an expert cybersecurity SOC analyst."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 600
    }

    try:
        response = requests.post(GROQ_URL, headers=headers, json=payload, timeout=15)

        if response.status_code == 429:
            logger.warning("[SOC Summary] Rate limited by Groq API")
            return {
                "executive_summary": "LLM rate limited — analysis completed without AI summary.",
                "technical_analysis": f"Detection: {detection.get('threat_detected', 'None')}. MITRE: {detection.get('mitre_candidate', 'N/A')}.",
                "business_impact": f"Risk: {risk.get('risk_level', 'Unknown')} ({risk.get('risk_score', 0)})",
                "recommended_actions": "Review incident details and investigate source IP manually.",
            }

        if response.status_code != 200:
            logger.warning(f"[SOC Summary] Groq API returned {response.status_code}")
            return {
                "executive_summary": f"LLM Error ({response.status_code}). Detection: {detection.get('threat_detected', 'None')}.",
                "technical_analysis": "AI summary unavailable.",
                "business_impact": f"Risk: {risk.get('risk_level', 'Unknown')}",
                "recommended_actions": "Review detection results manually.",
            }

        result = response.json()
        raw_output = result["choices"][0]["message"]["content"]
        data = clean_llm_response(raw_output)

        # Hardening: Ensure expected keys exist and are strings to prevent React crashes
        # or JSON display in the UI.
        for key in ["executive_summary", "technical_analysis", "business_impact", "recommended_actions"]:
            val = data.get(key)
            if val is None:
                data[key] = "Not available."
            elif isinstance(val, (dict, list)):
                # Flatten objects/lists into human-readable strings
                if isinstance(val, dict):
                    lines = []
                    for k, v in val.items():
                        k_nice = k.replace("_", " ").title()
                        if isinstance(v, list):
                            v_str = ", ".join([str(i) for i in v])
                            lines.append(f"{k_nice}: {v_str}")
                        else:
                            lines.append(f"{k_nice}: {v}")
                    data[key] = "\n".join(lines)
                else:
                    data[key] = "\n".join([f"• {str(i)}" for i in val])
            elif not isinstance(val, str):
                data[key] = str(val)
        
        return data

    except requests.exceptions.Timeout:
        logger.warning("[SOC Summary] Request timed out")
        return {
            "executive_summary": f"LLM timed out. Detection: {detection.get('threat_detected', 'None')}.",
            "technical_analysis": "AI summary unavailable due to timeout.",
            "business_impact": f"Risk: {risk.get('risk_level', 'Unknown')}",
            "recommended_actions": "Review detection results manually.",
        }
    except Exception as e:
        logger.error(f"[SOC Summary] Unexpected error: {e}")
        return {
            "executive_summary": f"LLM error. Detection: {detection.get('threat_detected', 'None')}.",
            "technical_analysis": f"Error: {str(e)[:100]}",
            "business_impact": f"Risk: {risk.get('risk_level', 'Unknown')}",
            "recommended_actions": "Review detection results manually.",
        }