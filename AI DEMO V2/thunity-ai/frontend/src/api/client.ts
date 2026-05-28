// Local-only API client. Attaches JWT, handles 401 globally, detects the
// backend's 202 approval-required contract, and surfaces structured errors.
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

type Options = { method?: string; body?: unknown; auth?: boolean };

export async function apiFetch<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) { const t = tokenStore.get(); if (t) headers["Authorization"] = `Bearer ${t}`; }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", `Cannot reach backend at ${API_URL}. Is it running?`);
  }

  if (res.status === 401) {
    tokenStore.clear();
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
};
