#!/bin/bash
# ═══════════════════════════════════════════════════
# FIX SCRIPT - Jalankan dari folder ai-ecosystem
# Usage: bash fix-backend.sh
# ═══════════════════════════════════════════════════

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}  AI Ecosystem - Backend Fix Script     ${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

# Cek kita ada di folder yang benar
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ ERROR: Jalankan script ini dari dalam folder ai-ecosystem!${NC}"
    echo "   cd ~/ai-ecosystem && bash fix-backend.sh"
    exit 1
fi

echo -e "\n${GREEN}▶ Step 1: Fix database.py${NC}"
cat > backend/services/database.py << 'PYEOF'
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
PYEOF
echo -e "  ${GREEN}✅ database.py updated${NC}"

echo -e "\n${GREEN}▶ Step 2: Fix config.py (pastikan asyncpg URL)${NC}"
cat > backend/config.py << 'PYEOF'
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "supersecretkey123changeme"

    OLLAMA_URL: str = "http://ollama:11434"
    OLLAMA_MODEL_ANALYST: str = "llama3.1:8b"
    OLLAMA_MODEL_CRITIC: str = "llama3.1:8b"
    OLLAMA_MODEL_SYNTHESIZER: str = "llama3.1:8b"

    POSTGRES_URL: str = "postgresql+asyncpg://postgres:postgres123@postgres:5432/ai_ecosystem"
    REDIS_URL: str = "redis://redis:6379"

    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    N8N_URL: str = "http://n8n:5678"
    FILES_DIR: str = "/data/files"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
PYEOF
echo -e "  ${GREEN}✅ config.py updated${NC}"

echo -e "\n${GREEN}▶ Step 3: Fix auth.py (hapus passlib)${NC}"
cat > backend/api/routes/auth.py << 'PYEOF'
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from config import settings

router   = APIRouter()
security = HTTPBearer(auto_error=False)

SECRET_KEY = settings.SECRET_KEY
ALGORITHM  = "HS256"

USERS_DB = {
    "admin": {"username": "admin", "password": "admin123", "role": "admin"},
    "user":  {"username": "user",  "password": "user123",  "role": "user"},
}

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    username:     str
    role:         str

def create_token(data: dict, expires_minutes: int = 1440) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(minutes=expires_minutes)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        raise HTTPException(401, "Token diperlukan")
    try:
        return jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Token tidak valid")

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = USERS_DB.get(req.username)
    if not user or req.password != user["password"]:
        raise HTTPException(401, "Username atau password salah")
    token = create_token({"sub": user["username"], "role": user["role"]})
    return TokenResponse(access_token=token, username=user["username"], role=user["role"])

@router.get("/me")
async def get_me(payload: dict = Depends(verify_token)):
    return {"username": payload.get("sub"), "role": payload.get("role")}
PYEOF
echo -e "  ${GREEN}✅ auth.py updated${NC}"

echo -e "\n${GREEN}▶ Step 4: Fix requirements.txt${NC}"
cat > backend/requirements.txt << 'EOF'
fastapi==0.111.0
uvicorn[standard]==0.29.0
websockets==12.0
httpx==0.27.0
sqlalchemy==2.0.30
asyncpg==0.29.0
pydantic==2.7.1
pydantic-settings==2.2.1
python-multipart==0.0.9
python-jose[cryptography]==3.3.0
aiofiles==23.2.1
psutil==5.9.8
EOF
echo -e "  ${GREEN}✅ requirements.txt updated${NC}"

echo -e "\n${GREEN}▶ Step 5: Fix docker-compose.yml (POSTGRES_URL prefix)${NC}"
sed -i 's|postgresql://postgres:|postgresql+asyncpg://postgres:|g' docker-compose.yml
echo -e "  ${GREEN}✅ docker-compose.yml updated${NC}"

echo -e "\n${GREEN}▶ Step 6: Hapus __pycache__ lama${NC}"
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find backend -name "*.pyc" -delete 2>/dev/null || true
echo -e "  ${GREEN}✅ Cache lama dibersihkan${NC}"

echo -e "\n${GREEN}▶ Step 7: Restart backend container${NC}"
sudo docker compose stop backend
sudo docker compose rm -f backend
sudo docker compose up -d --build backend

echo -e "\n${YELLOW}Menunggu backend siap (15 detik)...${NC}"
sleep 15

echo -e "\n${GREEN}▶ Step 8: Cek status${NC}"
sudo docker logs ai-backend --tail 20

echo ""
echo -e "${GREEN}▶ Step 9: Test koneksi${NC}"
curl -s http://localhost:8000/api/health && echo "" || echo -e "${RED}Belum siap, tunggu beberapa detik lagi${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Fix selesai! Cek log di atas.        ${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
