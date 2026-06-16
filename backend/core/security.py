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

# bcrypt silently truncates input past 72 bytes — two long passwords sharing the
# first 72 bytes would otherwise authenticate interchangeably. Reject longer inputs
# explicitly so the full password is always honoured (no silent truncation).
_MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    if len((password or "").encode("utf-8")) > _MAX_PASSWORD_BYTES:
        raise AppError(400, "PASSWORD_TOO_LONG",
                       f"Password must be at most {_MAX_PASSWORD_BYTES} bytes.",
                       suggested_action="Choose a shorter passphrase.")
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    # An over-length input could never have been stored (hash_password rejects it),
    # so treat it as a non-match rather than letting bcrypt truncate-and-compare.
    if len((password or "").encode("utf-8")) > _MAX_PASSWORD_BYTES:
        return False
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
    # Validate the token subject shape explicitly so a malformed token is a clear
    # 401 — not silently coerced into "user not found", and not masking DB errors.
    try:
        user_id = uuid.UUID(str(payload.get("sub")))
    except (ValueError, TypeError, AttributeError):
        raise AppError(401, "AUTH_INVALID", "Invalid token subject.")
    try:
        res = await db.execute(select(User).where(User.id == user_id))
        user = res.scalar_one_or_none()
    except Exception:
        # A genuine DB failure must surface as 503, not be conflated with auth failure.
        raise AppError(503, "DB_OFFLINE", "Database error while resolving the session.")
    if user is None or not user.is_active:
        raise AppError(401, "AUTH_INVALID", "User not found or inactive.")
    # Stateless revocation: a token is valid only while its `tv` claim matches the
    # user's current token_version (bumped on logout). Legacy tokens lack `tv` → 0.
    if int(payload.get("tv", 0)) != int(getattr(user, "token_version", 0) or 0):
        raise AppError(401, "AUTH_INVALID", "Session was signed out — please sign in again.")
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
