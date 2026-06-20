"""
Async SQLAlchemy base + engine/session.

DB-agnostic types (GUID, JSONType) let the *same* models run on PostgreSQL
(UUID + JSONB) in production and on SQLite (aiosqlite) for the test suite — so
tests are real, not mocked against a different schema.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy.types import TypeDecorator, CHAR, JSON
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy import DateTime, String, event

from config import settings


class GUID(TypeDecorator):
    """Platform-independent UUID: PG UUID, else CHAR(36)."""
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            value = uuid.UUID(str(value))
        return value if dialect.name == "postgresql" else str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


# JSONB on Postgres, generic JSON elsewhere.
JSONType = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


# ── engine / session (lazy) ──────────────────────────────────────────
_engine = None
_SessionLocal = None


def _make_engine(url: str | None = None):
    engine = create_async_engine(url or settings.POSTGRES_URL, echo=False, pool_pre_ping=True,
                                 future=True)
    # SQLite defaults to foreign_keys=OFF, so ON DELETE CASCADE and FK constraints
    # would be silently ignored — meaning the test suite couldn't catch a cascade or
    # referential-integrity bug that Postgres enforces in production. Turn it on per
    # connection so tests exercise the same rules as prod.
    if engine.dialect.name == "sqlite":
        @event.listens_for(engine.sync_engine, "connect")
        def _enable_sqlite_fk(dbapi_conn, _record):  # pragma: no cover - infra glue
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()
    return engine


async def _try_engine(url: str | None, create_all: bool) -> bool:
    global _engine, _SessionLocal
    _engine = _make_engine(url)
    _SessionLocal = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
    if create_all:
        # Import models so metadata is populated before create_all.
        import db.models  # noqa: F401
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    return True


async def init_db(create_all: bool = True) -> bool:
    """Initialise engine + session factory. Returns True if the DB is reachable.

    Development fallback: when the configured Postgres is unreachable (e.g. the
    backend is run bare with `uvicorn main:app`, no docker stack), fall back to a
    local SQLite file so the app is usable immediately. Production never falls
    back — a broken DB stays a visible failure."""
    global _engine, _SessionLocal
    try:
        return await _try_engine(None, create_all)
    except Exception as e:  # pragma: no cover - depends on infra
        print(f"⚠️  Database not reachable: {e}")
        _engine = None
        _SessionLocal = None
    if settings.is_production or not settings.POSTGRES_URL.startswith("postgresql"):
        return False
    try:
        import pathlib
        dev_db = pathlib.Path("./data") / "thunity_dev.db"
        dev_db.parent.mkdir(parents=True, exist_ok=True)
        ok = await _try_engine(f"sqlite+aiosqlite:///{dev_db}", create_all)
        print(f"⚠️  DEV FALLBACK: Postgres unreachable — using local SQLite at {dev_db}. "
              "Start the docker stack (or set POSTGRES_URL) to use Postgres.")
        return ok
    except Exception as e:  # pragma: no cover - depends on infra
        print(f"⚠️  SQLite dev fallback failed: {e}")
        _engine = None
        _SessionLocal = None
        return False


def session_factory():
    return _SessionLocal


async def get_db():
    """FastAPI dependency. Yields None if DB unavailable (routes must handle)."""
    if _SessionLocal is None:
        yield None
        return
    async with _SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
