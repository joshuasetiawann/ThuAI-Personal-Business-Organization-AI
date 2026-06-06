export interface User { username: string; role: string; permissions?: string[]; }

export interface LocalOnlyHealth {
  local_only_mode: boolean; ollama_status: string; external_ai_providers_enabled: boolean;
  database: string; vector_store: string; n8n: string; status: string;
  frontier_enabled?: boolean; frontier_providers?: string[]; frontier_model?: string | null;
}

export interface MetricsOverview {
  agent_runs_today: number; avg_latency_ms: number; failed_agent_runs: number; error_count: number;
  documents_total: number; documents_unverified: number; documents_deprecated: number;
  pending_approvals?: number; local_only_status: string; external_ai_providers_enabled: boolean;
  last_backup: string; hardware_warning?: string;
  decisions?: Record<string, number>; tasks?: Record<string, number>;
}

export interface HardwareStatus {
  cpu: { name: string; logical: number; percent: number };
  ram: { total_gb: number; used_gb: number; percent: number; profile_gb?: number };
  disk: { total_gb: number; used_gb: number; percent: number };
  gpu: { name: string; vram_gb: number; acceleration: string };
  gpu_acceleration_confirmed: boolean; warning: string | null;
  ollama?: { status: string; missing_models: string[] };
}

export interface ModelHealth {
  ollama_status: string; installed_models: string[]; required_models: string[];
  missing_models: string[]; missing_hint: string[] | null;
  roles: { role: string; model: string; installed: boolean; heavy: boolean;
           pull_command: string | null; warning: string | null }[];
  note: string;
}

export interface AuditEntry {
  id: string; actor: string | null; actor_role?: string | null; action: string;
  entity_type: string | null; entity_id: string | null; created_at: string; metadata?: unknown;
}

// ── W2 read-only operational entities ────────────────────────────────
export interface DecisionBrief { id: string; title: string; status: string; risk_level: string; agent_run_id?: string | null; created_at: string; }
export interface DecisionDetail extends DecisionBrief { decision_text?: string; summary?: string; evidence?: unknown; created_by?: string | null; approved_by?: string | null; conversation_id?: string | null; }
export interface TaskBrief { id: string; title: string; status: string; priority: string; owner: string | null; risk_level: string; due_date: string | null; overdue?: boolean; created_at: string; }
export interface TaskDetail extends TaskBrief { description?: string; source_decision_id?: string | null; source_agent_run_id?: string | null; }
export interface Approval { id: string; requested_action: string; risk_level: string; status: string; requested_by?: string | null; approved_by?: string | null; confirmation_phrase: string | null; created_at: string; }
export interface DocBrief { id: string; filename: string; file_type: string; document_status: string; trust_level: string; chunk_count: number; created_at: string; }
export interface DocDetail extends DocBrief { sensitivity_level?: string; owner?: string | null; client_name?: string | null; project_name?: string | null; sha256?: string; metadata?: unknown; }
export interface ConvBrief { id: string; title: string; status: string; created_at: string; updated_at?: string; in_knowledge?: boolean; }
export interface ConvKnowledge { document_id: string; chunks: number; trust_level: string; updated_at: string | null; }
export interface ConvDetail { id: string; title: string; status: string; user_id: string | null; in_knowledge?: boolean; knowledge?: ConvKnowledge | null; }
export interface WorkflowRun { id: string; workflow_name: string; status: string; created_at: string; }
export interface Tool { name: string; description: string; risk_level: string; required_permission: string; audit: boolean; input_schema?: unknown; }

// ── W3 AI Council ────────────────────────────────────────────────────
export interface CouncilStage { agent: string; model: string; content: string; status: string; latency_ms: number | null; }
export interface CouncilEvaluation { accuracy_score?: number; completeness_score?: number; grounding_score?: number; actionability_score?: number; hallucination_risk?: string; major_issues?: string[]; improvement_suggestions?: string[]; status?: string; }
export interface CouncilResult {
  agent_run_id: string; conversation_id: string | null; status: string; final_response: string;
  stages: CouncilStage[]; model_map?: Record<string, string>; knowledge_used: boolean;
  sources?: unknown[]; grounding_note?: string; evaluation?: CouncilEvaluation;
  total_latency_ms?: number; decision_id?: string | null;
  synthesis_provider?: string; memory_used?: boolean;
}
export interface IngestResult { document_id: string; filename: string; chunks: number; document_status: string; trust_level: string; sha256: string; }
export interface Source {
  document_id: string; chunk_id: string; filename: string; content_preview: string;
  relevance_score: number; trust_level: string; document_status: string; sensitivity_level?: string;
  page?: number | null; sheet?: string | null; warning?: string | null;
  metadata?: { client_name?: string | null; project_name?: string | null };
}
export interface SearchResponse { results: Source[]; grounding: string; }

export interface ConvMessage { id: string; role: string; content: string; agent_name?: string | null; created_at: string; }

export interface ReportBrief { id: string; title: string; source_type?: string | null; status: string; created_by?: string | null; created_at: string | null; }
export interface ReportDetail extends ReportBrief { content: string; }

export interface DecisionCreate { title: string; decision_text: string; summary: string; risk_level: "low" | "medium" | "high" | "critical"; conversation_id?: string; agent_run_id?: string; }

export interface TaskCreate { title: string; description?: string; priority?: string; risk_level?: string; owner?: string; due_date?: string; }

export interface WorkflowAllowed { name: string; risk: string; required_permission: string; }
export interface WorkflowTriggerResponse { run_id: string; workflow_name: string; status: string; }

export interface ToolInfo { name: string; input_schema?: Record<string, unknown>; risk_level: string; required_permission: string; audit: boolean; description: string; }

// ── Hybrid (local ⇄ frontier) + memory ───────────────────────────────
export type Provider = "local" | "anthropic" | "openrouter";
export interface MemoryUsed { kind: string; content: string; }
export interface FastChatResponse {
  conversation_id: string; response: string; status: string; model: string; latency_ms: number | null;
  provider?: Provider; frontier?: boolean; label?: string; route_reason?: string;
  knowledge_used?: boolean; memory_used?: MemoryUsed[]; sources?: Source[];
}
// SSE events from /api/agents/chat/stream
export interface StreamMeta {
  type: "meta"; conversation_id: string; provider: Provider; model: string; frontier: boolean;
  label: string; route_reason: string; knowledge_used: boolean; memory_used: MemoryUsed[];
}
export interface StreamDone {
  type: "done"; conversation_id: string; model: string; provider: Provider; frontier: boolean;
  label: string; route_reason: string; latency_ms: number | null; knowledge_used: boolean;
}
export interface MemoryItem {
  id: string; kind: string; content: string; importance: number; source: string;
  status: string; use_count: number; last_used_at: string | null; created_at: string | null;
}
export interface MemoryList { memories: MemoryItem[]; total: number; }
