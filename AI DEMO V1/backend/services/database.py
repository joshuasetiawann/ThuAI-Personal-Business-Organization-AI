from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, Text, DateTime, Float, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from config import settings


class Base(DeclarativeBase):
    pass


class Message(Base):
    __tablename__ = "messages"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(String(255))
    role            = Column(String(50), nullable=False)
    content         = Column(Text, nullable=False)
    agent_name      = Column(String(100))
    extra_data      = Column(JSON, default={})
    created_at      = Column(DateTime, default=datetime.utcnow)


class AgentLog(Base):
    __tablename__ = "agent_logs"
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id  = Column(String(255))
    agent_name  = Column(String(100))
    action      = Column(String(255))
    input_text  = Column(Text)
    output_text = Column(Text)
    duration_ms = Column(Integer)
    status      = Column(String(50))
    created_at  = Column(DateTime, default=datetime.utcnow)


class SystemMetric(Base):
    __tablename__ = "system_metrics"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    service      = Column(String(100))
    metric_name  = Column(String(100))
    metric_value = Column(Float)
    unit         = Column(String(50))
    recorded_at  = Column(DateTime, default=datetime.utcnow)


engine            = None
AsyncSessionLocal = None


async def init_db():
    global engine, AsyncSessionLocal
    try:
        engine = create_async_engine(
            settings.POSTGRES_URL,
            echo=False,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
        )
        AsyncSessionLocal = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Database connected")
    except Exception as e:
        print(f"⚠️  Database tidak tersambung: {e}")
        engine = None


async def get_db():
    if AsyncSessionLocal is None:
        yield None
        return
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
