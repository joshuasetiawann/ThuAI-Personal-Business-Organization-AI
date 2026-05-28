"""Auth & RBAC: hashing, JWT, current-user + role/permission dependencies."""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import jwt, JWTError
from sqlalchemy import select

from config import settings
from core.errors import AppError
from core.permissions import role_has_permission, Perm
from db.base import get_db
from db.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def create_access_token(data: dict, expires_minutes: Optional[int] = None) -> str:
    exp = datetime.utcnow() + timedelta(minutes=expires_minutes or settings.JWT_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": exp}, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer), db=Depends(get_db)) -> dict:
    if creds is None:
        raise AppError(401, "AUTH_REQUIRED", "Authentication token required.",
                       suggested_action="POST /api/auth/login to obtain a token.")
    try:
        payload = decode_access_token(creds.credentials)
    except JWTError:
        raise AppError(401, "AUTH_INVALID", "Invalid or expired token.")
    if db is None:
        raise AppError(503, "DB_OFFLINE", "Database is not available.")
    try:
        res = await db.execute(select(User).where(User.id == uuid.UUID(str(payload.get("sub")))))
        user = res.scalar_one_or_none()
    except Exception:
        user = None
    if user is None or not user.is_active:
        raise AppError(401, "AUTH_INVALID", "User not found or inactive.")
    return {"id": str(user.id), "email": user.email, "username": user.username, "role": user.role}


def require_role(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] == "founder":
            return user
        if roles and user["role"] not in roles:
            raise AppError(403, "FORBIDDEN", "Insufficient role for this action.")
        return user
    return _dep


def require_permission(perm: Perm):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if not role_has_permission(user["role"], perm):
            raise AppError(403, "FORBIDDEN", f"Missing permission: {getattr(perm, 'value', perm)}")
        return user
    return _dep
