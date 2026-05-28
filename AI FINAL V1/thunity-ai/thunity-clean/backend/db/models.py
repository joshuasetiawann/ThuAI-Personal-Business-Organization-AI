"""All ORM models for Thunity Local AI Company OS (single source of truth).

Naming: JSON columns use the `*_json` / `metadata_json` convention (never the
reserved `metadata`). All ids are UUID (portable via GUID). created_at/updated_at
are consistent via TimestampMixin where a row is mutable.
"""
from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import Optional

from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base, GUID, JSONType, TimestampMixin, new_uuid


# ── Identity / RBAC ──────────────────────────────────────────────────
class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="viewer")  # authoritative role
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class RoleCatalog(Base):
    """Reference catalogue of roles + their permission sets (governance/UI)."""
    __tablename__ = "roles"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    permissions_json: Mapped[dict] = mapped_column(JSONType, default=list)


class UserRole(Base):
    """Reserved for future multi-role assignment. users.role stays authoritative."""
    __tablename__ = "user_roles"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("users.id", ondelete="CASCADE"))
    role_name: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Conversations / messages ─────────────────────────────────────────
class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID, ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(500), default="New conversation")
    status: Mapped[str] = mapped_column(String(50), default="active")


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(50))  # user|assistant|system|agent
    content: Mapped[str] = mapped_column(Text)
    agent_name: Mapped[Optional[str]] = mapped_column(String(100))
    metadata_json: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Agent council runs ───────────────────────────────────────────────
class AgentRun(Base):
    __tablename__ = "agent_runs"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    conversation_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    mode: Mapped[str] = mapped_column(String(50), default="council")  # council|single
    user_message: Mapped[str] = mapped_column(Text)
    final_response: Mapped[str] = mapped_column(Text, default="")
    model_map_json: Mapped[dict] = mapped_column(JSONType, default=dict)
    knowledge_used: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(50), default="running")
    total_latency_ms: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class AgentMessage(Base):
    __tablename__ = "agent_messages"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    agent_run_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True)
    agent_name: Mapped[str] = mapped_column(String(100))
    round: Mapped[str] = mapped_column(String(50), default="1")
    model: Mapped[str] = mapped_column(String(120), default="")
    prompt_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    prompt: Mapped[str] = mapped_column(Text, default="")
    response: Mapped[str] = mapped_column(Text, default="")
    token_estimate: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50), default="ok")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PromptVersion(Base):
    __tablename__ = "prompt_versions"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    agent_name: Mapped[str] = mapped_column(String(100), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    prompt_text: Mapped[str] = mapped_column(Text)
    change_notes: Mapped[str] = mapped_column(Text, default="seed")
    created_by: Mapped[str] = mapped_column(String(120), default="system")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ── Knowledge base ───────────────────────────────────────────────────
class Document(Base, TimestampMixin):
    __tablename__ = "documents"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    file_id: Mapped[str] = mapped_column(String(64), index=True)      # unique storage id
    filename: Mapped[str] = mapped_column(String(500))               # original name
    stored_path: Mapped[str] = mapped_column(String(1000))
    sha256: Mapped[str] = mapped_column(String(64), default="")
    file_type: Mapped[str] = mapped_column(String(20), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    document_status: Mapped[str] = mapped_column(String(30), default="indexed")
    sensitivity_level: Mapped[str] = mapped_column(String(30), default="internal")
    trust_level: Mapped[str] = mapped_column(String(30), default="untrusted")
    owner: Mapped[Optional[str]] = mapped_column(String(120))
    client_name: Mapped[Optional[str]] = mapped_column(String(200))
    project_name: Mapped[Optional[str]] = mapped_column(String(200))
    source_type: Mapped[Optional[str]] = mapped_column(String(60))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    verified_by: Mapped[Optional[str]] = mapped_column(String(120))
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    expiration_date: Mapped[Optional[date]] = mapped_column(Date)
    metadata_json: Mapped[dict] = mapped_column(JSONType, default=dict)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    document_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)
    embedding_json: Mapped[list] = mapped_column(JSONType, default=list)  # local embedding vector
    token_estimate: Mapped[int] = mapped_column(Integer, default=0)
    page: Mapped[Optional[int]] = mapped_column(Integer)
    sheet: Mapped[Optional[str]] = mapped_column(String(120))
    metadata_json: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Dataset(Base):
    __tablename__ = "datasets"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    filename: Mapped[str] = mapped_column(String(500))
    source_platform: Mapped[str] = mapped_column(String(40), default="manual")
    client_name: Mapped[Optional[str]] = mapped_column(String(200))
    project_name: Mapped[Optional[str]] = mapped_column(String(200))
    campaign_name: Mapped[Optional[str]] = mapped_column(String(200))
    date_range_start: Mapped[Optional[date]] = mapped_column(Date)
    date_range_end: Mapped[Optional[date]] = mapped_column(Date)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    column_count: Mapped[int] = mapped_column(Integer, default=0)
    schema_json: Mapped[dict] = mapped_column(JSONType, default=dict)
    quality_score: Mapped[float] = mapped_column(Float, default=0.0)
    missing_value_summary: Mapped[dict] = mapped_column(JSONType, default=dict)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(30), default="active")


# ── Governance: decisions / tasks / approvals / workflows ────────────
class Decision(Base, TimestampMixin):
    __tablename__ = "decisions"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    conversation_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    agent_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    title: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(Text, default="")
    decision_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="draft")
    risk_level: Mapped[str] = mapped_column(String(20), default="medium")
    evidence_json: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_by: Mapped[Optional[str]] = mapped_column(String(120))
    approved_by: Mapped[Optional[str]] = mapped_column(String(120))


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="backlog")
    source_decision_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    source_agent_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    owner: Mapped[Optional[str]] = mapped_column(String(120))
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    risk_level: Mapped[str] = mapped_column(String(20), default="low")
    created_by: Mapped[Optional[str]] = mapped_column(String(120))


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    requested_action: Mapped[str] = mapped_column(String(120))
    payload_json: Mapped[dict] = mapped_column(JSONType, default=dict)
    risk_level: Mapped[str] = mapped_column(String(20), default="medium")
    requested_by: Mapped[Optional[str]] = mapped_column(String(120))
    approved_by: Mapped[Optional[str]] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    confirmation_phrase: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    workflow_name: Mapped[str] = mapped_column(String(120))
    source_decision_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    source_task_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    triggered_by: Mapped[Optional[str]] = mapped_column(String(120))
    approval_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    logs: Mapped[str] = mapped_column(Text, default="")
    output_artifact_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class Evaluation(Base):
    __tablename__ = "evaluations"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    agent_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID, index=True)
    evaluator_type: Mapped[str] = mapped_column(String(20), default="self")
    accuracy_score: Mapped[float] = mapped_column(Float, default=0.0)
    completeness_score: Mapped[float] = mapped_column(Float, default=0.0)
    grounding_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    actionability_score: Mapped[float] = mapped_column(Float, default=0.0)
    hallucination_risk: Mapped[str] = mapped_column(String(20), default="medium")
    comments: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="ok")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Observability / audit ────────────────────────────────────────────
class SystemMetric(Base):
    __tablename__ = "system_metrics"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    service: Mapped[str] = mapped_column(String(100))
    metric_name: Mapped[str] = mapped_column(String(100))
    metric_value: Mapped[float] = mapped_column(Float, default=0.0)
    unit: Mapped[str] = mapped_column(String(50), default="")
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ModelUsageLog(Base):
    __tablename__ = "model_usage_logs"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    model: Mapped[str] = mapped_column(String(120), index=True)
    agent_name: Mapped[Optional[str]] = mapped_column(String(100))
    agent_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer)
    token_estimate: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="ok")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ErrorLog(Base):
    __tablename__ = "error_logs"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    code: Mapped[str] = mapped_column(String(60), default="ERROR")
    message: Mapped[str] = mapped_column(Text)
    detail: Mapped[str] = mapped_column(Text, default="")
    path: Mapped[Optional[str]] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    actor: Mapped[Optional[str]] = mapped_column(String(120))
    actor_role: Mapped[Optional[str]] = mapped_column(String(50))
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(60))
    entity_id: Mapped[Optional[str]] = mapped_column(String(80))
    ip: Mapped[Optional[str]] = mapped_column(String(60))
    metadata_json: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── Client / project / artifact / risk / notification / sandbox ──────
class Client(Base):
    __tablename__ = "clients"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200))
    industry: Mapped[Optional[str]] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(30), default="active")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), default="active")
    objective: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text, default="")
    source_type: Mapped[Optional[str]] = mapped_column(String(60))
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    created_by: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Artifact(Base):
    __tablename__ = "artifacts"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(300))
    artifact_type: Mapped[str] = mapped_column(String(60), default="markdown")
    path: Mapped[Optional[str]] = mapped_column(String(1000))
    content: Mapped[str] = mapped_column(Text, default="")
    source_type: Mapped[Optional[str]] = mapped_column(String(60))
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    created_by: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Risk(Base):
    __tablename__ = "risks"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    source_type: Mapped[Optional[str]] = mapped_column(String(60))
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    severity: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(GUID)
    kind: Mapped[str] = mapped_column(String(60), default="info")
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text, default="")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SandboxRun(Base):
    __tablename__ = "sandbox_runs"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=new_uuid)
    requested_by: Mapped[Optional[str]] = mapped_column(String(120))
    task_type: Mapped[str] = mapped_column(String(80), default="analysis")
    input_files: Mapped[list] = mapped_column(JSONType, default=list)
    generated_files: Mapped[list] = mapped_column(JSONType, default=list)
    status: Mapped[str] = mapped_column(String(30), default="created")
    logs: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
