// Local-only API client. Attaches JWT, handles 401 globally, detects the
// backend's 202 approval-required contract, and surfaces structured errors.
import type { DecisionCreate, TaskCreate, StreamMeta, StreamDone } from "../types";

// Dev: default to same-origin "" — vite.config.ts proxies /api to the backend,
// so there is no cross-origin request (and no CORS) at all. A non-empty
// VITE_API_URL always wins; production builds default to the local backend.
const API_URL = (import.meta.env.VITE_API_URL as string)
  || (import.meta.env.DEV ? "" : "http://localhost:8000");
const TOKEN_KEY = "thunity_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  code: string; status: number;
  constructor(status: number, code: string, message: string) {
    super(message); this.code = code; this.status = status;
  }
}
export class AuthError extends ApiError {}
export class ApprovalRequiredError extends Error {
  approvalId: string; riskLevel: string;
  constructor(approvalId: string, riskLevel: string) {
    super("This action requires founder approval."); this.approvalId = approvalId; this.riskLevel = riskLevel;
  }
}

type Options = { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal };

export async function apiFetch<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) { const t = tokenStore.get(); if (t) headers["Authorization"] = `Bearer ${t}`; }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method, headers, signal, body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw new ApiError(0, "ABORTED", "Request cancelled.");
    throw new ApiError(0, "NETWORK", `Cannot reach backend from this browser. Backend may be offline, CORS may block this frontend port, or VITE_API_URL may be wrong.`);
  }

  if (res.status === 401) {
    tokenStore.clear();
    window.dispatchEvent(new Event("thunity:unauthorized"));   // sync AuthContext → login
    throw new AuthError(401, "UNAUTHORIZED", "Session expired — please sign in again.");
  }

  let data: any = null;
  try { data = await res.json(); } catch { data = null; }

  if (res.status === 202 && data?.approval_required) {
    throw new ApprovalRequiredError(data.approval_id, data.risk_level);
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.code || "ERROR",
      data?.message || data?.detail || `Request failed (${res.status}).`);
  }
  return data as T;
}

// Multipart upload — sets Authorization only; the browser sets the multipart
// Content-Type + boundary. Same 401 / 202 / structured-error handling as apiFetch.
export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const t = tokenStore.get(); if (t) headers["Authorization"] = `Bearer ${t}`;
  let res: Response;
  try { res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: form }); }
  catch { throw new ApiError(0, "NETWORK", `Cannot reach backend from this browser. Backend may be offline, CORS may block this frontend port, or VITE_API_URL may be wrong.`); }
  if (res.status === 401) {
    tokenStore.clear(); window.dispatchEvent(new Event("thunity:unauthorized"));
    throw new AuthError(401, "UNAUTHORIZED", "Session expired — please sign in again.");
  }
  let data: any = null; try { data = await res.json(); } catch { data = null; }
  if (res.status === 202 && data?.approval_required) throw new ApprovalRequiredError(data.approval_id, data.risk_level);
  if (!res.ok) throw new ApiError(res.status, data?.code || "ERROR", data?.message || data?.detail || `Upload failed (${res.status}).`);
  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    apiFetch<{ access_token: string; username: string; role: string; permissions: string[] }>(
      "/api/auth/login", { method: "POST", body: { username, password }, auth: false }),
  me: () => apiFetch<{ username: string; role: string; permissions: string[] }>("/api/auth/me"),
  localOnly: () => apiFetch("/api/health/local-only", { auth: false }),
  metrics: () => apiFetch("/api/metrics/overview"),
  hardware: () => apiFetch("/api/hardware/status"),
  modelsHealth: () => apiFetch("/api/models/health"),
  audit: (limit = 8) => apiFetch(`/api/audit?limit=${limit}`),

  // ── W2 read-only operational endpoints ──
  decisions: (limit = 100, offset = 0) => apiFetch(`/api/decisions?limit=${limit}&offset=${offset}`),
  decision: (id: string) => apiFetch(`/api/decisions/${id}`),
  executeDecision: (id: string, approval_id?: string) =>
    apiFetch(`/api/decisions/${id}/execute${approval_id ? `?approval_id=${encodeURIComponent(approval_id)}` : ""}`, { method: "POST" }),
  tasks: (o: { status?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    q.set("limit", String(o.limit ?? 100)); q.set("offset", String(o.offset ?? 0));
    if (o.status) q.set("status", o.status);
    return apiFetch(`/api/tasks?${q.toString()}`);
  },
  task: (id: string) => apiFetch(`/api/tasks/${id}`),
  approvals: (limit = 100, offset = 0) => apiFetch(`/api/approvals?limit=${limit}&offset=${offset}`),
  approvalsPending: () => apiFetch(`/api/approvals/pending`),
  approveRequest: (id: string, confirmation?: string) =>
    apiFetch(`/api/approvals/${id}/approve`, { method: "POST", body: { confirmation: confirmation ?? null } }),
  rejectRequest: (id: string) => apiFetch(`/api/approvals/${id}/reject`, { method: "POST" }),
  documents: (limit = 100, offset = 0) => apiFetch(`/api/knowledge/documents?limit=${limit}&offset=${offset}`),
  document: (id: string) => apiFetch(`/api/knowledge/documents/${id}`),
  search: (query: string, top_k = 5, client_name?: string) =>
    apiFetch("/api/knowledge/search", { method: "POST", body: { query, top_k, client_name: client_name ?? null } }),
  conversations: (limit = 100, offset = 0) => apiFetch(`/api/conversations?limit=${limit}&offset=${offset}`),
  conversation: (id: string) => apiFetch(`/api/conversations/${id}`),
  conversationMessages: (id: string) => apiFetch(`/api/conversations/${id}/messages`),
  // Index a conversation transcript into the local Knowledge base (low-trust, redacted, audited).
  ingestConversation: (id: string) => apiFetch(`/api/conversations/${encodeURIComponent(id)}/ingest`, { method: "POST" }),
  // Sync the brain folder (~/Documents/thunity-conversations) → Knowledge (skips chat mirrors).
  syncFolder: () => apiFetch<{ ok: boolean; added?: number; updated?: number; unchanged?: number; removed?: number; indexed?: number; reason?: string }>("/api/knowledge/sync-folder", { method: "POST" }),
  workflowRuns: () => apiFetch(`/api/workflows/runs`),
  allowedWorkflows: () => apiFetch(`/api/workflows/allowed`),
  triggerWorkflow: (workflow_name: string) =>
    apiFetch("/api/workflows/trigger", { method: "POST", body: { workflow_name, payload: {} } }),
  tools: () => apiFetch(`/api/tools`),

  // ── W3 AI Council (long-running: 2-4 min; no client timeout) ──
  council: (message: string, opts: { use_knowledge_base?: boolean; top_k?: number; conversation_id?: string | null; signal?: AbortSignal } = {}) =>
    apiFetch("/api/agents/council", { signal: opts.signal, method: "POST", body: {
      message,
      conversation_id: opts.conversation_id ?? null,
      use_knowledge_base: opts.use_knowledge_base ?? false,
      top_k: opts.top_k ?? 5,
      save_as_decision: false,
      create_tasks_from_output: false,
      allow_deep_reasoning: false,
    } }),
  fastChat: (message: string, conversation_id?: string,
             opts: { provider?: string | null; use_knowledge?: boolean } = {}) =>
    apiFetch("/api/agents/chat", { method: "POST", body: {
      message, conversation_id: conversation_id ?? null,
      provider: opts.provider ?? null, use_knowledge: opts.use_knowledge ?? false,
      client_time: new Date().toString() } }),
  councilHistory: (limit = 20) => apiFetch(`/api/audit?action=agent_run&limit=${limit}`),
  ingestDocument: (form: FormData) => apiUpload("/api/knowledge/ingest", form),
  createDecision: (body: DecisionCreate) => apiFetch("/api/decisions", { method: "POST", body }),
  createTask: (body: TaskCreate) => apiFetch("/api/tasks", { method: "POST", body }),

  // ── Hybrid + memory ──
  agentsHealth: () => apiFetch("/api/agents/health"),
  appSettings: () => apiFetch("/api/settings"),
  // Founder-tunable runtime toggles (persisted server-side).
  runtimeSettings: () => apiFetch<{ auto_ingest_conversations: boolean }>("/api/settings/runtime"),
  setRuntimeSettings: (body: { auto_ingest_conversations?: boolean }) =>
    apiFetch<{ auto_ingest_conversations: boolean }>("/api/settings/runtime", { method: "POST", body }),
  memories: (limit = 200) => apiFetch(`/api/memory?limit=${limit}`),
  memoryCount: () => apiFetch(`/api/memory/count`),
  addMemory: (content: string, kind = "fact", importance = 3) =>
    apiFetch("/api/memory", { method: "POST", body: { content, kind, importance } }),
  forgetMemory: (id: string) => apiFetch(`/api/memory/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // ── Auth: sign out everywhere (server-side token revocation) ──
  logout: () => apiFetch("/api/auth/logout", { method: "POST" }),

  // ── Knowledge document lifecycle (founder/admin gated server-side) ──
  verifyDocument: (id: string, trust_level = "high") =>
    apiFetch(`/api/knowledge/documents/${encodeURIComponent(id)}/verify?trust_level=${encodeURIComponent(trust_level)}`, { method: "POST" }),
  deprecateDocument: (id: string) =>
    apiFetch(`/api/knowledge/documents/${encodeURIComponent(id)}/deprecate`, { method: "POST" }),
  reindexDocument: (id: string) =>
    apiFetch(`/api/knowledge/documents/${encodeURIComponent(id)}/reindex`, { method: "POST" }),
  // DELETE returns the 202 approval-required contract → ApprovalRequiredError until approved.
  deleteDocument: (id: string, approval_id?: string) =>
    apiFetch(`/api/knowledge/documents/${encodeURIComponent(id)}${approval_id ? `?approval_id=${encodeURIComponent(approval_id)}` : ""}`, { method: "DELETE" }),

  // ── Mission board: status transitions + create-from-decision ──
  patchTask: (id: string, body: { status?: string; priority?: string; owner?: string; title?: string }) =>
    apiFetch(`/api/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  taskFromDecision: (decisionId: string) =>
    apiFetch(`/api/tasks/from-decision/${encodeURIComponent(decisionId)}`, { method: "POST" }),

  // ── Reports (artifacts produced by governed workflows) ──
  reports: (limit = 50, offset = 0) => apiFetch(`/api/reports?limit=${limit}&offset=${offset}`),
  report: (id: string) => apiFetch(`/api/reports/${encodeURIComponent(id)}`),

  // ── Local backup (founder/admin; in-process DB snapshot, never uploaded) ──
  runBackup: () => apiFetch("/api/backup/run", { method: "POST" }),
  listBackups: () => apiFetch("/api/backup/list"),
};

// ── Streaming Fast Chat (SSE over fetch — EventSource can't send the Bearer) ──
export interface FastStreamHandlers {
  onMeta?: (m: StreamMeta) => void;
  onToken?: (t: string) => void;
  onDone?: (d: StreamDone) => void;
  onError?: (msg: string) => void;
}

export async function fastChatStream(
  message: string,
  opts: { conversation_id?: string | null; provider?: string | null; use_knowledge?: boolean; signal?: AbortSignal },
  handlers: FastStreamHandlers,
): Promise<void> {
  const t = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/agents/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({
        message,
        conversation_id: opts.conversation_id ?? null,
        provider: opts.provider ?? null,
        use_knowledge: opts.use_knowledge ?? false,
        client_time: new Date().toString(),
      }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw new ApiError(0, "ABORTED", "Request cancelled.");
    throw new ApiError(0, "NETWORK", "Cannot reach backend from this browser.");
  }
  if (res.status === 401) {
    tokenStore.clear(); window.dispatchEvent(new Event("thunity:unauthorized"));
    throw new AuthError(401, "UNAUTHORIZED", "Session expired — please sign in again.");
  }
  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status}).`;
    try { const j = await res.json(); msg = j?.message || j?.detail || msg; } catch { /* ignore */ }
    throw new ApiError(res.status, "STREAM_ERROR", msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }
      if (evt.type === "meta") handlers.onMeta?.(evt as StreamMeta);
      else if (evt.type === "token") handlers.onToken?.(evt.v || "");
      else if (evt.type === "done") handlers.onDone?.(evt as StreamDone);
      else if (evt.type === "error") handlers.onError?.(evt.message || "stream error");
    }
  }
}
