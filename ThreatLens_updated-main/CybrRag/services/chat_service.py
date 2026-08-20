"""
ThreatLens AI SOC Copilot v2.1
Natural language interface for SOC analysts to query the security database.
Uses Groq LLM with conversation memory — the copilot remembers previous
messages within a session for multi-turn investigations.
"""
import json
import requests
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, distinct
from config import settings
from models.db_models import Incident, LogEntry, IPState, AttackCampaign, Blocklist, ThreatIntelEntry, ChatMessage

logger = logging.getLogger("threatlens.copilot")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Maximum number of past messages to include for conversation memory
MAX_MEMORY_MESSAGES = 10


def chat(user_message: str, db: Session, session_id: str = None) -> dict:
    """
    Process a natural language question from a SOC analyst.
    1. Gather relevant context from the database
    2. Load conversation history for multi-turn memory
    3. Send to LLM with context + history
    4. Return the answer
    """
    # Step 1: Gather context based on the question
    context = _gather_context(user_message, db)

    # Step 2: Load conversation history for memory
    history_messages = _load_conversation_history(db, session_id)

    # Step 3: Build system prompt with context
    system_prompt = f"""You are a senior SOC analyst AI assistant for the ThreatLens security platform.
You have access to the following real-time security data from the organization's database.

=== DATABASE CONTEXT ===
{json.dumps(context, indent=2, default=str)}
=== END CONTEXT ===

Provide a clear, actionable, and professional response based on the data above.
If the data shows threats, explain the severity and recommend specific actions.
If the question requires data you don't have, say so clearly.
Be concise but thorough. Use bullet points for recommendations.
If the analyst references something from the previous conversation, use the chat history to understand what they mean."""

    # Step 4: Query LLM
    if not settings.GROQ_API_KEY:
        return {
            "response": "LLM not configured. Please set GROQ_API_KEY.",
            "context_used": context,
        }

    try:
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
        }

        # Build messages array with conversation memory
        messages = [
            {"role": "system", "content": system_prompt},
        ]

        # Inject past conversation for multi-turn memory
        for hist_msg in history_messages:
            messages.append({
                "role": hist_msg["role"],
                "content": hist_msg["content"],
            })

        # Current user message
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": "llama-3.1-8b-instant",
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 800,
        }
        resp = requests.post(GROQ_URL, headers=headers, json=payload, timeout=15)

        if resp.status_code == 429:
            return {
                "response": "I'm being rate-limited by the AI service. Please wait a moment and try again.",
                "context_used": context,
            }

        if resp.status_code == 200:
            answer = resp.json()["choices"][0]["message"]["content"]
            return {
                "response": answer,
                "context_used": context,
            }
        else:
            return {
                "response": f"LLM Error: {resp.status_code}. The database context is still available for manual review.",
                "context_used": context,
            }
    except requests.exceptions.Timeout:
        logger.warning("[Copilot] LLM request timed out")
        return {
            "response": "The AI service timed out. Your database context is attached for manual review.",
            "context_used": context,
        }
    except Exception as e:
        logger.error(f"[Copilot] LLM call failed: {e}")
        return {
            "response": f"Error communicating with LLM: {str(e)}",
            "context_used": context,
        }


def _load_conversation_history(db: Session, session_id: str = None) -> list:
    """
    Load recent chat messages for multi-turn conversation memory.
    Returns the last MAX_MEMORY_MESSAGES messages in chronological order.
    """
    try:
        query = db.query(ChatMessage).order_by(ChatMessage.timestamp.desc())

        if session_id:
            # If sessions are tracked, filter by session
            query = query.filter(ChatMessage.session_id == session_id)

        recent = query.limit(MAX_MEMORY_MESSAGES).all()

        # Reverse to chronological order
        messages = []
        for msg in reversed(recent):
            messages.append({
                "role": msg.role,
                "content": msg.content[:500],  # Truncate to save tokens
            })

        return messages
    except Exception as e:
        logger.warning(f"[Copilot] Failed to load history: {e}")
        return []


def _gather_context(question: str, db: Session) -> dict:
    """
    Intelligently gather database context based on what the question is about.
    """
    q = question.lower()
    context = {}

    # Always include summary stats
    context["summary"] = {
        "total_incidents": db.query(func.count(Incident.id)).scalar() or 0,
        "open_incidents": db.query(func.count(Incident.id)).filter(Incident.status == "Open").scalar() or 0,
        "total_logs": db.query(func.count(LogEntry.id)).scalar() or 0,
        "active_campaigns": db.query(func.count(AttackCampaign.id)).filter(AttackCampaign.status == "Active").scalar() or 0,
        "blocked_ips": db.query(func.count(Blocklist.id)).scalar() or 0,
    }

    # IP-specific query
    import re
    ip_match = re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', question)
    if ip_match:
        ip = ip_match.group(0)
        ip_state = db.query(IPState).filter(IPState.ip_address == ip).first()
        ip_incidents = db.query(Incident).filter(Incident.source_ip == ip).order_by(desc(Incident.timestamp)).limit(5).all()

        context["ip_investigation"] = {
            "ip": ip,
            "state": {
                "failed_logins": ip_state.failed_logins if ip_state else 0,
                "stages": ip_state.stages_detected if ip_state else [],
                "first_seen": str(ip_state.first_seen) if ip_state else None,
                "last_seen": str(ip_state.last_seen) if ip_state else None,
            },
            "incidents": [
                {"id": i.id, "threat": i.threat_type, "risk": i.risk_level, "status": i.status}
                for i in ip_incidents
            ],
        }

    # Attack/threat related
    if any(kw in q for kw in ["attack", "threat", "incident", "critical", "high", "brute", "campaign"]):
        recent_incidents = db.query(Incident).order_by(desc(Incident.timestamp)).limit(10).all()
        context["recent_incidents"] = [
            {
                "id": i.id,
                "threat": i.threat_type,
                "risk_level": i.risk_level,
                "risk_score": i.risk_score,
                "source_ip": i.source_ip,
                "status": i.status,
                "timestamp": str(i.timestamp),
                "mitre": i.mitre_technique,
            }
            for i in recent_incidents
        ]

        campaigns = db.query(AttackCampaign).filter(
            AttackCampaign.status.in_(["Active", "Dormant"])
        ).order_by(desc(AttackCampaign.last_seen)).limit(5).all()
        context["campaigns"] = [
            {
                "id": c.id,
                "name": c.name,
                "status": c.status,
                "risk_level": c.risk_level,
                "stages": [s.get("stage") for s in (c.stages_progression or [])],
                "source_ips": c.source_ips,
                "first_seen": str(c.first_seen),
                "last_seen": str(c.last_seen),
            }
            for c in campaigns
        ]

    # User-specific
    if any(kw in q for kw in ["user", "admin", "root", "account", "login"]):
        user_activity = (
            db.query(LogEntry.user, func.count(LogEntry.id).label("count"), LogEntry.status)
            .filter(LogEntry.user.isnot(None))
            .group_by(LogEntry.user, LogEntry.status)
            .order_by(desc("count"))
            .limit(10)
            .all()
        )
        context["user_activity"] = [
            {"user": u, "count": c, "status": s} for u, c, s in user_activity
        ]

    # Top offenders
    if any(kw in q for kw in ["top", "most", "worst", "frequent", "common"]):
        top_ips = (
            db.query(Incident.source_ip, func.count(Incident.id).label("count"))
            .filter(Incident.source_ip.isnot(None))
            .group_by(Incident.source_ip)
            .order_by(desc("count"))
            .limit(10)
            .all()
        )
        context["top_offending_ips"] = [{"ip": ip, "incidents": c} for ip, c in top_ips]

        top_threats = (
            db.query(Incident.threat_type, func.count(Incident.id).label("count"))
            .group_by(Incident.threat_type)
            .order_by(desc("count"))
            .limit(10)
            .all()
        )
        context["top_threat_types"] = [{"threat": t, "count": c} for t, c in top_threats]

    # Blocklist
    if any(kw in q for kw in ["block", "ban", "firewall", "blocklist"]):
        blocked = db.query(Blocklist).order_by(desc(Blocklist.blocked_at)).limit(20).all()
        context["blocklist"] = [
            {"ip": b.ip_address, "reason": b.reason, "blocked_at": str(b.blocked_at)}
            for b in blocked
        ]

    return context
