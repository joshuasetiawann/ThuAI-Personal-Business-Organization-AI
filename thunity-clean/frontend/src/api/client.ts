// Local-only API client. Attaches JWT, handles 401 globally, detects the
// backend's 202 approval-required contract, and surfaces structured errors.
import type { DecisionCreate, TaskCreate } from "../types";

const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";
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
  fastChat: (message: string, conversation_id?: string) =>
    apiFetch("/api/agents/chat", { method: "POST", body: { message, conversation_id: conversation_id ?? null } }),
  councilHistory: (limit = 20) => apiFetch(`/api/audit?action=agent_run&limit=${limit}`),
  ingestDocument: (form: FormData) => apiUpload("/api/knowledge/ingest", form),
  createDecision: (body: DecisionCreate) => apiFetch("/api/decisions", { method: "POST", body }),
  createTask: (body: TaskCreate) => apiFetch("/api/tasks", { method: "POST", body }),
};
