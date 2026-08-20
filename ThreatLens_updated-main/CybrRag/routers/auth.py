"""
ThreatLens Auth Router
Handles user registration, login, token refresh, profile, and user management.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime

from models.database import get_db
from models.db_models import User
from services.auth_service import (
    create_user, authenticate_user, create_access_token,
    create_refresh_token, decode_token, get_user_by_email,
    get_user_by_username, hash_password,
)
from dependencies.auth import get_current_user, require_role

router = APIRouter()


# ========================
#  Request / Response Models
# ========================
class SignupRequest(BaseModel):
    email: str
    username: str
    password: str
    full_name: Optional[str] = None
    organization: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if not v.isalnum() and "_" not in v:
            raise ValueError("Username must be alphanumeric (underscores allowed)")
        return v


class LoginRequest(BaseModel):
    login: str  # email or username
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    organization: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        return v


class AdminRoleUpdate(BaseModel):
    role: str  # admin, analyst, viewer

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ("admin", "analyst", "viewer"):
            raise ValueError("Role must be: admin, analyst, or viewer")
        return v


# ========================
#  Helper
# ========================
def _user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "organization": user.organization,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }


def _build_token_response(user: User) -> dict:
    from config import settings
    token_data = {"sub": str(user.id), "role": user.role, "username": user.username}
    access = create_access_token(token_data)
    refresh = create_refresh_token(token_data)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": _user_to_dict(user),
    }


# ========================
#  Endpoints
# ========================
@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    """Register a new user account."""
    # Check if email already exists
    if get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Check if username already exists
    if get_user_by_username(db, data.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken",
        )

    # First user becomes admin automatically
    user_count = db.query(User).count()
    role = "admin" if user_count == 0 else "analyst"

    user = create_user(
        db=db,
        email=data.email,
        username=data.username,
        password=data.password,
        full_name=data.full_name,
        role=role,
        organization=data.organization,
    )

    response = _build_token_response(user)
    response["message"] = f"Account created successfully. Role: {role}"
    if role == "admin":
        response["message"] += " (first user is automatically admin)"

    return response


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Login with email or username and password."""
    user = authenticate_user(db, data.login, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    return _build_token_response(user)


@router.post("/refresh")
def refresh_token(data: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a refresh token for a new access token."""
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    from services.auth_service import get_user_by_id
    user = get_user_by_id(db, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    return _build_token_response(user)


@router.get("/me")
def get_profile(current_user: User = Depends(get_current_user)):
    """Get the current user's profile."""
    return {"user": _user_to_dict(current_user)}


@router.put("/me")
def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's profile."""
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.organization is not None:
        current_user.organization = data.organization
    db.commit()
    return {"message": "Profile updated", "user": _user_to_dict(current_user)}


@router.put("/me/password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password."""
    from services.auth_service import verify_password
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


# ========================
#  Admin-Only Endpoints
# ========================
@router.get("/users", dependencies=[Depends(require_role("admin"))])
def list_users(db: Session = Depends(get_db)):
    """List all users (admin only)."""
    users = db.query(User).order_by(User.created_at).all()
    return {
        "total": len(users),
        "users": [_user_to_dict(u) for u in users],
    }


@router.put("/users/{user_id}/role", dependencies=[Depends(require_role("admin"))])
def update_user_role(
    user_id: int,
    data: AdminRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change a user's role (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = data.role
    db.commit()
    return {"message": f"User '{user.username}' role changed to '{data.role}'"}


@router.put("/users/{user_id}/deactivate", dependencies=[Depends(require_role("admin"))])
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate a user account (admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = not user.is_active
    db.commit()
    status_str = "activated" if user.is_active else "deactivated"
    return {"message": f"User '{user.username}' {status_str}"}
