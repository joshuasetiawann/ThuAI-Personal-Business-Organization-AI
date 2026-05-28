"""Auth routes — DB-backed users, bcrypt, JWT. No hardcoded credentials."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select, or_
from api.deps import get_db, get_current_user, require_permission
from core.security import verify_password, create_access_token, hash_password
from core.errors import AppError
from core.permissions import permissions_for_role, Role, Perm
from core.audit import log_audit
from core import ratelimit
from db.models import User

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class CreateUserRequest(BaseModel):
    email: str
    password: str
    role: str = "viewer"
    username: str | None = None


@router.post("/login")
async def login(req: LoginRequest, request: Request, db=Depends(get_db)):
    if db is None:
        raise AppError(503, "DB_OFFLINE", "Database is not available.")
    ip = request.client.host if request.client else None
    # Throttle brute-force against the (single, known) founder account.
    allowed, retry = ratelimit.check(ip, req.username)
    if not allowed:
        await log_audit(db, "auth_throttled", actor=req.username, ip=ip,
                        metadata={"retry_after_s": retry})
        await db.commit()
        raise AppError(429, "RATE_LIMITED", f"Too many sign-in attempts. Try again in {retry}s.")
    res = await db.execute(select(User).where(
        or_(User.email == req.username.lower(), User.username == req.username)))
    user = res.scalar_one_or_none()
    if not user or not user.is_active or not verify_password(req.password, user.password_hash):
        ratelimit.record_failure(ip, req.username)
        await log_audit(db, "failed_auth", actor=req.username, ip=ip)
        await db.commit()
        raise AppError(401, "AUTH_FAILED", "Invalid username or password.")
    ratelimit.record_success(ip, req.username)
    token = create_access_token({"sub": str(user.id), "role": user.role,
                                 "tv": getattr(user, "token_version", 0) or 0})
    await log_audit(db, "login", actor=user.email, actor_role=user.role, ip=ip)
    await db.commit()
    return {"access_token": token, "token_type": "bearer", "username": user.username,
            "role": user.role, "permissions": permissions_for_role(user.role)}


@router.post("/logout")
async def logout(request: Request, db=Depends(get_db), user: dict = Depends(get_current_user)):
    """Sign out everywhere: bump token_version so every previously-issued JWT for
    this account is immediately rejected (stateless revocation)."""
    import uuid as _uuid
    res = await db.execute(select(User).where(User.id == _uuid.UUID(user["id"])))
    u = res.scalar_one_or_none()
    if u is not None:
        u.token_version = (u.token_version or 0) + 1
    ip = request.client.host if request.client else None
    await log_audit(db, "logout", actor=user["email"], actor_role=user["role"], ip=ip)
    await db.commit()
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {**user, "permissions": permissions_for_role(user["role"])}


@router.post("/users")
async def create_user(req: CreateUserRequest, db=Depends(get_db),
                      actor: dict = Depends(require_permission(Perm.MANAGE_USERS))):
    if req.role not in {r.value for r in Role}:
        raise AppError(400, "BAD_ROLE", f"Unknown role: {req.role}")
    existing = await db.execute(select(User).where(User.email == req.email.lower()))
    if existing.scalar_one_or_none():
        raise AppError(409, "USER_EXISTS", "A user with this email already exists.")
    u = User(email=req.email.lower(), username=req.username or req.email.split("@")[0],
             password_hash=hash_password(req.password), role=req.role)
    db.add(u)
    await log_audit(db, "user_created", actor=actor["email"], actor_role=actor["role"],
                    entity_type="user", entity_id=str(u.id), metadata={"role": req.role})
    await db.commit()
    return {"id": str(u.id), "email": u.email, "role": u.role}
