from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime

from models.database import get_db
from models.db_models import ChatMessage
from services.chat_service import chat

router = APIRouter()


class ChatInput(BaseModel):
    message: str
    session_id: Optional[str] = None


@router.post("/ask")
def ask_copilot(data: ChatInput, db: Session = Depends(get_db)):
    """SOC Copilot — ask natural language questions about your security data.
    Pass a session_id to enable multi-turn conversation memory."""
    # Save user message
    user_msg = ChatMessage(role="user", content=data.message, session_id=data.session_id)
    db.add(user_msg)
    db.flush()

    # Get AI response with conversation memory
    result = chat(data.message, db, session_id=data.session_id)

    # Save assistant response
    asst_msg = ChatMessage(
        role="assistant",
        content=result["response"],
        context_used=result.get("context_used"),
        session_id=data.session_id,
    )
    db.add(asst_msg)
    db.commit()

    return {
        "response": result["response"],
        "context_used": result.get("context_used"),
        "session_id": data.session_id,
    }


@router.get("/history")
def get_chat_history(session_id: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    """Get recent chat history, optionally filtered by session_id."""
    query = db.query(ChatMessage).order_by(ChatMessage.timestamp.desc())
    if session_id:
        query = query.filter(ChatMessage.session_id == session_id)
    messages = query.limit(limit).all()
    return {
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "session_id": m.session_id,
                "timestamp": m.timestamp.isoformat() if m.timestamp else None,
            }
            for m in reversed(messages)
        ]
    }
