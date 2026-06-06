"""Idempotent startup seeding: role catalogue, default prompt versions, and a
founder user (from env only — never a hardcoded admin/admin123)."""
from __future__ import annotations
from sqlalchemy import select, func
from config import settings
from core.security import hash_password
from core.permissions import ROLE_PERMISSIONS, permissions_for_role, Role
from db.models import User, RoleCatalog, PromptVersion
from agents import prompts as default_prompts


async def seed_roles(db) -> None:
    for role in Role:
        res = await db.execute(select(RoleCatalog).where(RoleCatalog.name == role.value))
        if res.scalar_one_or_none() is None:
            db.add(RoleCatalog(name=role.value, description=f"{role.value} role",
                               permissions_json=permissions_for_role(role.value)))
    await db.flush()


async def seed_prompts(db) -> None:
    # Idempotent AND upgrade-aware: seed when missing; when a system-seeded default
    # prompt's text has changed in code (e.g. an honesty/hybrid correction), supersede
    # it with a NEW version (preserving history) rather than silently keeping the stale
    # copy. Human-edited prompts (created_by != "system") are never overwritten.
    for agent_name, text in default_prompts.DEFAULTS.items():
        res = await db.execute(
            select(PromptVersion).where(PromptVersion.agent_name == agent_name,
                                        PromptVersion.is_active == True))  # noqa: E712
        active = res.scalars().first()
        if active is None:
            db.add(PromptVersion(agent_name=agent_name, version=1, prompt_text=text,
                                 change_notes="seed", created_by="system", is_active=True))
        elif active.prompt_text != text and active.created_by == "system":
            active.is_active = False
            db.add(PromptVersion(agent_name=agent_name, version=active.version + 1,
                                 prompt_text=text, created_by="system", is_active=True,
                                 change_notes="auto-upgrade: default prompt changed (honest hybrid disclosure)"))
    await db.flush()


async def ensure_founder(db) -> str:
    count = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    if count > 0:
        return "users_exist"
    if settings.FOUNDER_EMAIL and settings.FOUNDER_PASSWORD:
        db.add(User(email=settings.FOUNDER_EMAIL.lower(),
                    username=settings.FOUNDER_EMAIL.split("@")[0],
                    password_hash=hash_password(settings.FOUNDER_PASSWORD), role="founder"))
        await db.flush()
        return "founder_created"
    print("ℹ️  No users yet. Set FOUNDER_EMAIL and FOUNDER_PASSWORD to bootstrap the founder account.")
    return "no_founder_env"


async def run_bootstrap(db) -> dict:
    await seed_roles(db)
    await seed_prompts(db)
    founder = await ensure_founder(db)
    await db.commit()
    return {"founder": founder}
