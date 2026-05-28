export interface User { username: string; role: string; permissions?: string[]; }

export interface LocalOnlyHealth {
  local_only_mode: boolean; ollama_status: string; external_ai_providers_enabled: boolean;
  database: string; vector_store: string; n8n: string; status: string;
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
