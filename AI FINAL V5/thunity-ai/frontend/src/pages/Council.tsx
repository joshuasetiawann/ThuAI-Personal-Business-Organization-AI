import { useState, useRef, useEffect } from "react";
import { useSearchParams, useOutletContext } from "react-router-dom";
import { api, ApprovalRequiredError, fastChatStream } from "../api/client";
import { asUTC } from "../utils/time";
import { useAuth } from "../auth/AuthContext";
import Markdown from "../components/Markdown";
import { PageHeader, Card, Badge, TrustBadge, StatusBadge, ErrorState, Row, Loading, Empty, useAsync } from "../components/ui";
import type { CouncilResult, CouncilStage, AuditEntry, Source, FastChatResponse,
  LocalOnlyHealth, MetricsOverview, DecisionBrief, Approval, ConvMessage,
  Provider, MemoryUsed } from "../types";

type FastTurn = {
  id: string;
  prompt: string;
  response?: string;
  model?: string | null;
  latency_ms?: number | null;
  conversation_id?: string | null;
  status: "pending" | "streaming" | "completed" | "error";
  error?: string;
  provider?: Provider;
  label?: string;
  route_reason?: string;
  frontier?: boolean;
  knowledge_used?: boolean;
  memory_used?: MemoryUsed[];
};

type ShellCtx = { rightCollapsed?: boolean; setRightCollapsed?: (v: boolean) => void; isWide?: boolean };

// Rebuild a saved conversation into Fast-chat turns so a recent chat can be resumed.
function pairMessagesToTurns(messages: ConvMessage[]): FastTurn[] {
  const turns: FastTurn[] = [];
  let cur: FastTurn | null = null;
  for (const m of messages) {
    if (m.role === "user") {
      if (cur) turns.push(cur);
      cur = { id: m.id, prompt: m.content, status: "completed" };
    } else {
      if (cur && cur.response === undefined) cur.response = m.content;
      else { if (cur) turns.push(cur); cur = { id: m.id, prompt: "", response: m.content, status: "completed" }; }
    }
  }
  if (cur) turns.push(cur);
  return turns;
}

const AGENT_LABEL: Record<string, string> = {
  architect_analyst: "Architect Analyst",
  red_team_critic: "Red Team Critic",
  pragmatic_execution_engineer: "Pragmatic Execution Engineer",
  executive_synthesizer: "Executive Synthesizer",
  evaluator: "Evaluator",
};
const SECTIONS = ["EXECUTIVE VERDICT", "DECISION", "WHY THIS DECISION", "PRIORITY ACTIONS",
  "RISKS", "LOCAL-ONLY COMPLIANCE", "HARDWARE FIT", "ACCEPTANCE CRITERIA", "NEXT STEP"];

function parseSynthesis(text: string): { label: string; body: string }[] | null {
  if (!text) return null;
  const found: { label: string; start: number; end: number }[] = [];
  for (const s of SECTIONS) {
    const re = new RegExp(`(?:^|\\n)\\s*#{0,3}\\s*\\*{0,2}${s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\*{0,2}\\s*:?`, "i");
    const m = re.exec(text);
    if (m) found.push({ label: s, start: m.index, end: m.index + m[0].length });
  }
  if (found.length < 2) return null;
  found.sort((a, b) => a.start - b.start);
  return found.map((f, i) => ({
    label: f.label,
    body: text.slice(f.end, i + 1 < found.length ? found[i + 1].start : text.length).trim(),
  }));
}

function Score({ label, v }: { label: string; v?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((v ?? 0) * 100)));
  return (
    <div className="score">
      <div className="score-head"><span>{label}</span><b>{v == null ? "—" : pct + "%"}</b></div>
      <div className="score-bar"><div style={{ width: pct + "%" }} /></div>
    </div>
  );
}

// ── Logo-ready circular avatars (monogram is NOT hand-traced; ◆ fallback) ──
function MarkAvatar() {
  const [failed, setFailed] = useState(false);
  return (
    <span className="chat-avatar chat-avatar-mark" aria-hidden="true">
      {failed ? <span className="avatar-glyph">◆</span>
        : <img src="/thunity-mark.png" alt="" onError={() => setFailed(true)} />}
    </span>
  );
}
function UserAvatar() {
  return (
    <span className="chat-avatar chat-avatar-user" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    </span>
  );
}

// Copy an assistant answer locally (clipboard only — no network, no side-effects).
function CopyAnswer({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="fast-action" title="Copy answer"
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); }).catch(() => {}); }}>
      {done ? "✓ Copied" : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg> Copy</>}
    </button>
  );
}

// Honest per-answer provider badge — Local vs Frontier (Claude/OpenRouter), never hidden.
function ProviderBadge({ provider, frontier, label, title }:
  { provider?: Provider; frontier?: boolean; label?: string; title?: string }) {
  if (!provider) return null;
  const isFrontier = frontier ?? (provider !== "local");
  return (
    <span className={"prov-badge " + (isFrontier ? "prov-frontier" : "prov-local")} title={title || label}>
      <span className="prov-dot" aria-hidden="true" />{isFrontier ? (label || "Frontier") : "Local"}
    </span>
  );
}

// Time-aware greeting for the calm empty state.
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ── System-status dot: REAL state only, never forced green ──
function statusTone(s?: string): "ok" | "warn" | "bad" | "muted" {
  const v = (s || "").toLowerCase();
  if (!v) return "muted";
  if (/online|local|compliant|connected|ready|ok|healthy|up/.test(v)) return "ok";
  if (/warn|degraded|partial|unconfirmed|missing/.test(v)) return "warn";
  return "bad";
}
function StatusLine({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "bad" | "muted" }) {
  return (
    <div className="sys-row">
      <span className="sys-name"><span className={"sys-dot dot-" + tone} aria-hidden="true" />{label}</span>
      <span className={"sys-val val-" + tone}>{value}</span>
    </div>
  );
}
function fiTimeAgo(iso?: string | null): string {
  if (!iso) return ""; const t = new Date(asUTC(iso)).getTime(); if (!t) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "now"; const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60); if (h < 24) return h + "h ago"; const d = Math.floor(h / 24);
  if (d < 7) return d + "d ago"; return Math.floor(d / 7) + "w ago";
}
function riskTone(r?: string): "ok" | "warn" | "bad" | "muted" {
  const v = (r || "").toLowerCase();
  if (v === "low") return "ok"; if (v === "medium") return "warn";
  if (v === "high" || v === "critical") return "bad"; return "muted";
}
function CtxCheck() {
  return (<svg className="ctx-ic" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.4l2.4 2.4 4.6-5" /></svg>);
}

// Live model/provider info for the honest "Model" pill (no hard-coded names).
type AppSettingsShape = {
  models?: { fast?: string };
  frontier?: { enabled?: boolean; provider?: string; model?: string; auto_routing?: boolean };
  compliance_status?: string;
};
function shortModel(m?: string): string {
  if (!m) return "local model";
  return m.replace(/-instruct\b/i, "").replace(/:latest\b/i, "").trim();
}
function titleCase(s?: string): string {
  if (!s) return "";
  if (s.toLowerCase() === "openrouter") return "OpenRouter";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// Consistent capitalisation for raw status strings (e.g. "online" → "Online").
function capWord(s?: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// Notify the shell that a conversation was created/updated so the sidebar
// "Recent Conversations" list refreshes in real time (no polling delay).
function pingConversations() {
  try { window.dispatchEvent(new Event("thunity:conversation-updated")); } catch { /* ignore */ }
}

// ── Founder Insight panel — mounted only in Fast mode, so its read-only
//    fetches don't fire on /council. All data is real or labelled context. ──
function FounderInsightPanel({ turns, convId, convHref }:
  { turns: number; convId: string | null; convHref: string | null }) {
  const lo = useAsync<LocalOnlyHealth>(() => api.localOnly() as Promise<LocalOnlyHealth>);
  const metrics = useAsync<MetricsOverview>(() => api.metrics() as Promise<MetricsOverview>);
  const decisions = useAsync<{ decisions: DecisionBrief[] }>(() => api.decisions(3, 0) as Promise<{ decisions: DecisionBrief[] }>);
  const approvals = useAsync<{ pending: Approval[] }>(() => api.approvalsPending() as Promise<{ pending: Approval[] }>);
  const settings = useAsync<AppSettingsShape>(() => api.appSettings() as Promise<AppSettingsShape>);

  // Keep the panel ALIVE — gently re-fetch the real read-only data so System
  // Status, decisions, approvals and the vault never go stale while open.
  useEffect(() => {
    const id = window.setInterval(() => {
      lo.reload(); metrics.reload(); decisions.reload(); approvals.reload();
    }, 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backendTone = lo.loading ? "muted" : lo.error ? "bad" : "ok";
  const backendVal = lo.loading ? "Checking…" : lo.error ? "Offline" : "Online";
  const compliant = lo.data?.status === "compliant";
  const hybrid = lo.data?.status === "hybrid";
  const allOk = !lo.loading && !lo.error && ["database", "ollama_status", "n8n"].every((k) => statusTone((lo.data as any)?.[k]) === "ok");
  // Honest status pill (moved here from the topbar): never forced, reflects real lo.status.
  const secureTone = lo.error ? "bad" : hybrid ? "hybrid" : compliant ? "local" : lo.data ? "warn" : "muted";
  const secureLabel = lo.error ? "Unknown"
    : hybrid ? "Hybrid · Local + Frontier"
    : compliant ? "Local-Secure"
    : lo.data ? (lo.data.status || "Checking").replace(/^\w/, (c) => c.toUpperCase())
    : "Checking…";

  return (
    <aside className="chat-context" aria-label="Founder Insight">
      <div className="insight-panel">
        <div className="insight-panel-head">
          <span className="iph-spark" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.7 5.6L19.5 9l-5.8 1.4L12 16l-1.7-5.6L4.5 9l5.8-1.4z" /></svg></span>
          Founder Insight Panel
        </div>

        {/* Status + model (moved from the topbar so the chrome stays Gemini-clean) */}
        <div className="insight-status">
          <span className={"secure-pill secure-" + secureTone}>
            <span className="secure-dot" aria-hidden="true" />
            <span className="secure-text">{secureLabel}</span>
          </span>
          {settings.loading ? (
            <span className="insight-model">Model · checking…</span>
          ) : settings.data ? (
            <>
              <span className="insight-model im-local" title={`Main Chat fast model (local): ${settings.data.models?.fast || "unknown"}`}>
                <span className="im-dot" aria-hidden="true" />Local · {shortModel(settings.data.models?.fast)}
              </span>
              {settings.data.frontier?.enabled && settings.data.frontier?.provider && (
                <span className="insight-model im-frontier" title={`Heavy / strategic auto-routes to frontier: ${settings.data.frontier.provider} · ${settings.data.frontier.model || "model"}`}>
                  <span className="im-dot" aria-hidden="true" />Frontier · {titleCase(settings.data.frontier.provider)}
                </span>
              )}
            </>
          ) : (
            <span className="insight-model" title="Main Chat uses a fast local model; heavy/strategic routes to frontier.">Model · Local Fast</span>
          )}
        </div>

        {/* System Status — REAL read-only health */}
        <section className="insight-card">
          <div className="insight-card-title">System Status
            <span className={"insight-allok val-" + (allOk ? "ok" : lo.error ? "bad" : "warn")}>
              <span className={"sys-dot dot-" + (allOk ? "ok" : lo.error ? "bad" : "warn")} aria-hidden="true" />
              {allOk ? "All Systems Operational" : lo.error ? "Backend offline" : "Checking…"}
            </span>
          </div>
          <StatusLine label="Backend" value={backendVal} tone={backendTone} />
          <StatusLine label="Database" value={capWord(lo.data?.database) || (lo.error ? "Unknown" : "…")} tone={lo.loading ? "muted" : lo.error ? "bad" : statusTone(lo.data?.database)} />
          <StatusLine label="Ollama" value={capWord(lo.data?.ollama_status) || (lo.error ? "Unknown" : "…")} tone={lo.loading ? "muted" : lo.error ? "bad" : statusTone(lo.data?.ollama_status)} />
          <StatusLine label="n8n" value={capWord(lo.data?.n8n) || (lo.error ? "Unknown" : "…")} tone={lo.loading ? "muted" : lo.error ? "bad" : statusTone(lo.data?.n8n)} />
          {lo.error && <div className="insight-empty">Live health unavailable — backend unreachable.</div>}
        </section>

        {/* Founder Context — capability/context (labelled, honest) */}
        <section className="insight-card">
          <div className="insight-card-title">Founder Context</div>
          <div className="insight-line ctx-line"><CtxCheck />{lo.data ? (compliant ? "Local stack compliant" : `Local-only: ${lo.data.status}`) : "Local-first workspace"}</div>
          <div className="insight-line ctx-line"><CtxCheck />Fast Chat ready · answers only</div>
          <div className="insight-line ctx-line"><CtxCheck />AI Council available for strategy</div>
          <div className="insight-foot">Context — not live system health.</div>
        </section>

        {/* Recent Decisions — REAL read-only */}
        <section className="insight-card">
          <div className="insight-card-title">Recent Decisions <a className="insight-more" href="/decisions">All →</a></div>
          {decisions.loading ? <div className="insight-empty">Loading…</div>
            : decisions.error ? <div className="insight-empty">Unavailable</div>
            : decisions.data?.decisions?.length
              ? decisions.data.decisions.slice(0, 3).map((d) => (
                  <a key={d.id} className="dec-row" href={`/decisions?open=${d.id}`} title={d.title}>
                    <span className="dec-title">{d.title || "Untitled decision"}</span>
                    <span className="dec-time">{fiTimeAgo(d.created_at)}</span>
                    <span className={"sys-dot dot-" + riskTone(d.risk_level)} aria-hidden="true" />
                  </a>
                ))
              : <div className="insight-empty">No decisions yet</div>}
        </section>

        {/* Pending Approvals — REAL read-only */}
        <section className="insight-card">
          <div className="insight-card-title">Pending Approvals <a className="insight-more" href="/approvals">Open →</a></div>
          {approvals.loading ? <div className="insight-empty">Loading…</div>
            : approvals.error ? <div className="insight-empty">Unavailable</div>
            : approvals.data?.pending?.length
              ? <>
                  {approvals.data.pending.slice(0, 3).map((a) => (
                    <div key={a.id} className="appr-row">
                      <span className="appr-title" title={a.requested_action}>{a.requested_action}</span>
                      <span className={"risk-badge risk-" + riskTone(a.risk_level)}>{(a.risk_level || "—").replace(/^\w/, (c) => c.toUpperCase())}</span>
                    </div>
                  ))}
                </>
              : <div className="insight-empty">No pending items</div>}
        </section>

        {/* Local Vault — REAL read-only (metrics) */}
        <section className="insight-card vault-card">
          <div className="insight-card-title">Local Vault <a className="insight-more" href="/knowledge">Vault →</a></div>
          {metrics.loading ? <div className="insight-empty">Loading…</div>
            : metrics.error ? <div className="insight-empty">Unavailable</div>
            : metrics.data
              ? <>
                  <div className="sys-row"><span className="sys-name">Knowledge indexed</span><span className="sys-val">{metrics.data.documents_total} docs</span></div>
                  <div className="sys-row"><span className="sys-name">Unverified</span><span className={"sys-val " + (metrics.data.documents_unverified ? "val-warn" : "val-ok")}>{metrics.data.documents_unverified}</span></div>
                  <div className="sys-row"><span className="sys-name">Backup</span><span className={"sys-val " + (metrics.data.last_backup && metrics.data.last_backup !== "never" ? "val-ok" : "val-warn")}>{metrics.data.last_backup && metrics.data.last_backup !== "never" ? fiTimeAgo(metrics.data.last_backup) : "never"}</span></div>
                </>
              : <div className="insight-empty">Unavailable</div>}
          <span className="vault-sparkle" aria-hidden="true">◆</span>
        </section>

        {/* Session + policy (governance transparency) */}
        <section className="insight-card insight-card-quiet">
          <div className="sys-row"><span className="sys-name">Local turns</span><span className="sys-val">{turns}</span></div>
          <div className="sys-row"><span className="sys-name">Conversation saved</span><span className={"sys-val " + (convId ? "val-ok" : "")}>{convId ? "Yes" : "No"}</span></div>
          <div className="insight-foot">Local-Secure · no tools · no workflow execution · no side-effects.</div>
          {convHref && <a className="insight-link-row" href={convHref}>Open saved conversation →</a>}
        </section>

        <div className="insight-tagline">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4.5" y="11" width="15" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <span>Private by design. Local by default.<br /><span className="muted">Intelligence that stays with you.</span></span>
        </div>
      </div>
    </aside>
  );
}

const FAST_SUGGESTIONS: { label: string; fill: string; council?: boolean }[] = [
  { label: "Brief today's priorities", fill: "Brief today's priorities." },
  { label: "Review latest decision", fill: "Review the latest decision and summarize it." },
  { label: "Escalate this to AI Council", fill: "Escalate this topic to AI Council for strategic analysis.", council: true },
];

// The real 6-stage council pipeline (shown as a creative stepper — honest, fixed sequence).
const COUNCIL_PIPELINE: { n: string; role: string; desc: string }[] = [
  { n: "1", role: "Architect Analyst", desc: "Frames the problem & options" },
  { n: "2", role: "Red-Team Critic", desc: "Attacks risks & weak points" },
  { n: "3", role: "Execution Engineer", desc: "Grounds it in what's doable" },
  { n: "4", role: "Analyst Revision", desc: "Refines after the critique" },
  { n: "5", role: "Executive Synthesizer", desc: "Writes the decision" },
  { n: "6", role: "Evaluator", desc: "Scores accuracy & grounding" },
];

export default function Council({ initialMode = "fast" }: { initialMode?: "fast" | "council" }) {
  const { user } = useAuth();
  const shell = (useOutletContext<ShellCtx>() || {}) as ShellCtx;
  const insightCollapsed = shell.rightCollapsed ?? true;
  // The Founder Insight Panel exists ONLY in the wide 3-zone layout. In a narrow /
  // small-tab window it is DISABLED — never rendered, its toggle hidden — so it can
  // never overlap the chat. Narrow mode = chat + a left-nav slide-over only.
  const isWide = shell.isWide ?? true;
  const showInsight = !insightCollapsed && isWide;
  const [prompt, setPrompt] = useState("");
  const [useKb, setUseKb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskErr, setTaskErr] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [confirmingTask, setConfirmingTask] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [mode, setMode] = useState<"fast" | "council">(initialMode);
  const [fastBusy, setFastBusy] = useState(false);
  const [fastErr, setFastErr] = useState<string | null>(null);
  const [fastResult, setFastResult] = useState<FastChatResponse | null>(null);
  const [fastConvId, setFastConvId] = useState<string | null>(null);
  const [fastLastPrompt, setFastLastPrompt] = useState("");
  const [fastTurns, setFastTurns] = useState<FastTurn[]>([]);
  const [fastProvider, setFastProvider] = useState<"auto" | "local" | "frontier">("auto");
  const hist = useAsync<{ audit: AuditEntry[] }>(() => api.councilHistory(20) as Promise<{ audit: AuditEntry[] }>);

  const [elapsed, setElapsed] = useState(0);
  const ctrl = useRef<AbortController | null>(null);
  const fastCtrl = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const fastEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { mounted.current = false; ctrl.current?.abort(); fastCtrl.current?.abort(); }, []);
  useEffect(() => {
    if (mode !== "fast") return;
    const toBottom = () => {
      const canvas = fastEndRef.current?.closest(".chat-canvas") as HTMLElement | null;
      if (canvas) canvas.scrollTop = canvas.scrollHeight;       // keep latest message + composer in view
      else fastEndRef.current?.scrollIntoView({ block: "end" });
    };
    requestAnimationFrame(toBottom);
    const t = setTimeout(toBottom, 80);                          // catch late layout (markdown/resume)
    return () => clearTimeout(t);
  }, [fastTurns, mode]);
  const [searchParams] = useSearchParams();
  const convParam = searchParams.get("conv");
  // Resume a saved conversation when arriving via /chat?conv=… (sidebar Recent) — loads history + continues it.
  useEffect(() => {
    if (initialMode !== "fast" || !convParam) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.conversationMessages(convParam) as any;
        const msgs = (data?.messages || data || []) as ConvMessage[];
        if (cancelled || !msgs.length) return;
        setFastTurns(pairMessagesToTurns(msgs));
        setFastConvId(convParam);
      } catch { /* ignore — start a fresh thread */ }
    })();
    return () => { cancelled = true; };
  }, [convParam]);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const focusPrompt = () => setTimeout(() => promptRef.current?.focus(), 0);
  const fillPrompt = (text: string, council?: boolean) => { if (council) setMode("council"); setPrompt(text); focusPrompt(); };
  const runCouncil = async () => {
    if (busy || !prompt.trim()) return;            // no duplicate or empty submissions
    setBusy(true); setError(null); setResult(null); setElapsed(0); setSavedId(null); setSaveErr(null); setConfirming(false); setTaskId(null); setTaskErr(null); setConfirmingTask(false);
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    ctrl.current = new AbortController();
    try {
      setResult(await api.council(prompt, { use_knowledge_base: useKb, signal: ctrl.current.signal }) as CouncilResult);
      pingConversations();   // a council run persists a conversation — refresh the sidebar list
    } catch (e: any) {
      if (e?.code === "ABORTED") return;            // navigated away mid-run; run persists server-side
      if (e instanceof ApprovalRequiredError) setError("This action requires founder approval — not available in this view.");
      else setError(e?.message || "Council run failed.");
    } finally {
      window.clearInterval(timer);
      if (mounted.current) { setBusy(false); hist.reload(); }   // refresh history after success OR failure
    }
  };

  const saveDraft = async () => {
    if (!result || saving) return;
    setSaving(true); setSaveErr(null); setSavedId(null);
    const title = prompt.trim().slice(0, 80) || "Council recommendation";
    const secs = parseSynthesis(result.final_response);
    const summary = (secs && secs[0] ? `${secs[0].label}: ${secs[0].body}` : result.final_response).slice(0, 280);
    try {
      const d = await api.createDecision({
        title,
        decision_text: result.final_response,
        summary,
        risk_level: "medium",
        conversation_id: result.conversation_id || undefined,
        agent_run_id: result.agent_run_id || undefined,
      }) as { id?: string };
      if (!d?.id) throw new Error("Decision was not created.");
      setSavedId(d.id);
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) { setSaveErr("This action requires founder approval — draft not saved."); return; }
      setSaveErr(e?.message || "Could not save draft decision.");
    } finally { setSaving(false); }
  };

  const createTask = async () => {
    if (!result || creatingTask) return;
    setCreatingTask(true); setTaskErr(null); setTaskId(null);
    const title = prompt.trim().slice(0, 120) || "Council follow-up task";
    try {
      const t = await api.createTask({
        title,
        description: result.final_response,
        priority: "medium",
        risk_level: "low",
      }) as { id?: string };
      if (!t?.id) throw new Error("Task was not created.");
      setTaskId(t.id);
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) { setTaskErr("This action requires founder approval — task not created."); return; }
      setTaskErr(e?.message || "Could not create task.");
    } finally { setCreatingTask(false); }
  };

  const patchTurn = (id: string, patch: Partial<FastTurn>) =>
    setFastTurns((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));

  const runFast = async () => {
    const text = prompt.trim();
    if (fastBusy || !text) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setFastLastPrompt(text);
    setFastTurns((prev) => [...prev, { id, prompt: text, status: "pending", response: "" }]);
    setPrompt(""); focusPrompt();
    setFastBusy(true); setFastErr(null);
    fastCtrl.current = new AbortController();
    const provider = fastProvider === "auto" ? undefined : fastProvider;
    let streamedAny = false;
    try {
      await fastChatStream(text, { conversation_id: fastConvId || undefined, provider, signal: fastCtrl.current.signal }, {
        onMeta: (m) => {
          if (m.conversation_id) { setFastConvId(m.conversation_id); pingConversations(); }
          patchTurn(id, { provider: m.provider, label: m.label, route_reason: m.route_reason,
            frontier: m.frontier, knowledge_used: m.knowledge_used, memory_used: m.memory_used,
            conversation_id: m.conversation_id, status: "streaming" });
        },
        onToken: (tok) => { streamedAny = true; setFastTurns((prev) => prev.map((t) =>
          t.id === id ? { ...t, response: (t.response || "") + tok, status: "streaming" } : t)); },
        onDone: (d) => { if (d.conversation_id) setFastConvId(d.conversation_id);
          patchTurn(id, { status: "completed", model: d.model, latency_ms: d.latency_ms,
            provider: d.provider, label: d.label, frontier: d.frontier, knowledge_used: d.knowledge_used });
          pingConversations(); },
        onError: (msg) => { setFastErr(msg); patchTurn(id, { status: "error", error: msg }); },
      });
    } catch (e: any) {
      if (e?.code === "ABORTED") { patchTurn(id, { status: "completed" }); }
      else if (!streamedAny) {
        // Streaming unavailable — fall back to the non-streaming endpoint once.
        try {
          const r = await api.fastChat(text, fastConvId || undefined, { provider }) as FastChatResponse;
          if (r.conversation_id) setFastConvId(r.conversation_id);
          patchTurn(id, { response: r.response, model: r.model, latency_ms: r.latency_ms,
            conversation_id: r.conversation_id, provider: r.provider, label: r.label,
            route_reason: r.route_reason, frontier: r.frontier, knowledge_used: r.knowledge_used,
            memory_used: r.memory_used, status: "completed" });
          pingConversations();
        } catch (e2: any) {
          const msg = e2?.message || "Fast chat failed.";
          setFastErr(msg); patchTurn(id, { status: "error", error: msg });
        }
      } else {
        const msg = e?.message || "Stream interrupted.";
        setFastErr(msg); patchTurn(id, { status: "error", error: msg });
      }
    } finally { setFastBusy(false); fastCtrl.current = null; }
  };

  const clearFastThread = () => { setFastTurns([]); setFastResult(null); setFastErr(null); setFastLastPrompt(""); };

  const submit = () => { if (mode === "fast") void runFast(); else void runCouncil(); };

  const sections = result ? parseSynthesis(result.final_response) : null;
  const ev = result?.evaluation;
  const failedStages = result?.stages?.filter((s) => s.status !== "ok").length ?? 0;
  const srcs: Source[] = result ? ((result.sources || []) as Source[]) : [];
  const fastConvHref = fastConvId ? `/conversations?open=${encodeURIComponent(fastConvId)}` : null;
  const fastInputHelpId = "fast-chat-input-help";
  const councilInputHelpId = "council-chat-input-help";
  const councilActionContextId = "council-action-context";
  // silence unused-state warnings for values kept for parity/debug
  void fastResult; void fastErr; void fastLastPrompt;

  return (
    <div className={"page" + (mode === "fast" ? " fast-mode-page" : " council-mode-page")}>
      {/* ambient = the single global fixed <Aurora global/> mounted in AppShell */}
      {mode === "council" && (
        <div className="mode-switch" aria-label="Chat mode">
          <button aria-pressed={false} className="mode-tab" disabled={busy || fastBusy} onClick={() => setMode("fast")}>Main Chat</button>
          <button aria-pressed={true} className="mode-tab active" disabled={busy || fastBusy}>AI Council</button>
        </div>
      )}

      {mode === "council" && (
        <div className="council-cockpit">
          {/* Big Thunity monogram — centred behind the convene screen (mirrors Main Chat). */}
          <div className="council-watermark" aria-hidden="true"><span className="mark-glyph" /></div>
          <div className={"council-main" + (!result && !busy ? " council-main-empty" : "")}>
            <div className="council-canvas">
            {!result && !busy && (
              <div className="council-hero">
                <div className="council-hero-title">Convene the AI Council</div>
                <div className="council-hero-sub">Six local agents deliberate in sequence to produce a governed recommendation — strategic, slower (~2–4 min), drafts only. Nothing executes; the founder decides.</div>
                <div className="council-chips">
                  <span className="chip" style={{ cursor: "default" }}>Strategic review</span>
                  <span className="chip" style={{ cursor: "default" }}>Drafts only</span>
                  <span className="chip" style={{ cursor: "default" }}>Founder approval required</span>
                </div>
              </div>
            )}
            </div>
            <div className="council-composer">
              <label className="kb-toggle">
                <input type="checkbox" checked={useKb} disabled={busy} onChange={(e) => setUseKb(e.target.checked)} />
                <span>Use Knowledge Base</span>
                <span className="kb-hint">grounds the council in your local Knowledge Vault</span>
              </label>
              {useKb && <div className="banner banner-warn">⚠ Council will use local Knowledge Vault sources. Results may include untrusted documents; verify trust badges and grounding.</div>}
              <textarea ref={promptRef} className="council-input" rows={4} value={prompt} disabled={busy || fastBusy}
                placeholder="Ask the council a strategic, technical, or operational question…"
                onChange={(e) => setPrompt(e.target.value)}
                aria-busy={busy || fastBusy} aria-describedby={councilInputHelpId} aria-label="AI Council question"
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy && !fastBusy) submit(); }} />
              <div className="council-actions">
                <span id={councilInputHelpId} className="muted small">{`Runs locally · KB: ${useKb ? "on" : "off"} · no side-effects · ⌘/Ctrl+Enter`}</span>
                <button className="btn btn-primary council-submit" disabled={busy || !prompt.trim()} onClick={submit}>{busy ? "Deliberating…" : "Convene council"}</button>
              </div>
            </div>
          </div>

          <aside className="council-aside" aria-label="Deliberation pipeline">
            <div className="insight-panel-head">
              <span className="iph-spark cl-spark" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="12" cy="18" r="2.4" /><path d="M6 8.4v1.6a2 2 0 0 0 2 2h2M18 8.4v1.6a2 2 0 0 1-2 2h-2" /></svg></span>
              Deliberation Pipeline
            </div>
            <ol className="pipeline">
              {COUNCIL_PIPELINE.map((s) => (
                <li key={s.n} className="pl-step">
                  <span className="pl-n">{s.n}</span>
                  <span className="pl-body"><span className="pl-role">{s.role}</span><span className="pl-desc">{s.desc}</span></span>
                </li>
              ))}
            </ol>
            <div className="insight-tagline">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4.5" y="11" width="15" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              <span>Sequential · local-only · drafts only.<br /><span className="muted">The AI proposes; the founder decides.</span></span>
            </div>
          </aside>
        </div>
      )}

      {mode === "fast" && (
        <div className={"chat-cockpit" + (showInsight ? "" : " chat-cockpit--solo")}>
          <div className={"chat-main" + (fastTurns.length === 0 ? " chat-main-empty" : "")}>
            {/* Big Thunity monogram — centred on the CHAT column, every state/size */}
            <div className="chat-watermark" aria-hidden="true"><span className="mark-glyph" /></div>
            <div className="chat-canvas">
              {fastTurns.length === 0 ? (
                <div className="fast-empty-state">
                  <h1 className="fast-greeting">{greeting()}</h1>
                  <div className="fast-greeting-sub">What should we work on{user?.username ? `, ${user.username}` : ""}?</div>
                  <div className="fast-empty-cue">Local-first · remembers what matters · private by default</div>
                </div>
              ) : (
                <>
                  <div className="fast-thread" aria-live="polite" aria-relevant="additions text" aria-atomic="false" aria-busy={fastTurns.some((t) => t.status === "pending")}>
                    {fastTurns.map((t) => (
                      <div key={t.id} className="fast-turn">
                        <div className="fast-user">
                          <div className="fast-rolebar">
                            <UserAvatar />
                            <span className="fast-role">You</span>
                            <span className="founder-chip">FOUNDER</span>
                          </div>
                          <div className="fast-bubble">{t.prompt}</div>
                        </div>
                        <div className="fast-assistant">
                          <div className="fast-rolebar">
                            <MarkAvatar />
                            <span className="fast-role">Thunity Assistant</span>
                          </div>
                          {t.status === "pending"
                            ? <div className="assistant-block muted" role="status"><span className="spinner" /> Thinking…</div>
                            : t.status === "error"
                              ? <div className="assistant-block assistant-error">
                                  <div className="bad small">⚠ {t.error || "The response didn't complete."}</div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                                    <button type="button" className="fast-retry" onClick={() => fillPrompt(t.prompt)}>Retry prompt</button>
                                    <span className="muted small">Re-fills your message — nothing was sent or executed.</span>
                                  </div>
                                </div>
                              : <>
                                  <div className={"fast-bubble assistant-block" + (t.status === "streaming" ? " is-streaming" : "")}>
                                    {t.status === "completed"
                                      ? <Markdown text={t.response || "(empty)"} />
                                      : <>{t.response || ""}{t.status === "streaming" && <span className="stream-caret" aria-hidden="true" />}</>}
                                  </div>
                                  {t.status === "completed" && (
                                    <div className="fast-foot">
                                      <ProviderBadge provider={t.provider} frontier={t.frontier} label={t.label} title={t.route_reason} />
                                      {t.memory_used && t.memory_used.length > 0 && (
                                        <span className="mem-chip" title={"Grounded in your memory:\n" + t.memory_used.map((m) => "• " + m.content).join("\n")}>
                                          ◆ {t.memory_used.length} {t.memory_used.length === 1 ? "memory" : "memories"}
                                        </span>
                                      )}
                                      {t.knowledge_used && <span className="mem-chip kb-chip" title="Grounded in your local Knowledge Vault">⛁ vault</span>}
                                      {typeof t.latency_ms === "number" && <span className="fast-meta">{t.latency_ms}ms</span>}
                                      <span className="fast-actions"><CopyAnswer text={t.response || ""} /></span>
                                    </div>
                                  )}
                                </>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div ref={fastEndRef} />
                  <div className="fast-clear-row">
                    {fastConvHref && <a className="link" href={fastConvHref}>Open conversation →</a>}
                    <span className="muted small">Clear is local-only — saved history is kept.</span>
                    <button className="btn" style={{ width: "auto" }} disabled={fastBusy} onClick={clearFastThread}>Clear local thread</button>
                  </div>
                </>
              )}
            </div>

            <div className="chat-composer">
              {fastTurns.length === 0 ? (
                /* STITCH empty-state: ONE frosted card with the controls INSIDE it
                   (attach · mode · engine · send), suggestion chips BELOW the card. */
                <>
                  <div className="composer-bar composer-bar--stitch">
                    <textarea ref={promptRef} className="council-input fast-input" rows={1} value={prompt} disabled={fastBusy}
                      placeholder="Ask Thunity or send a command…"
                      onChange={(e) => setPrompt(e.target.value)}
                      aria-busy={busy || fastBusy} aria-describedby={fastInputHelpId} aria-label="Fast Chat message"
                      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy && !fastBusy) submit(); }} />
                    <div className="composer-bar-row">
                      <button type="button" className="composer-attach" disabled aria-label="Attachments not available yet"
                        title="Attachments are not available in this local-secure prototype.">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21.4 11.1 12.3 20.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8" />
                        </svg>
                      </button>
                      <div className="mode-switches" role="group" aria-label="Chat mode">
                        <button type="button" className="mode-sw on" aria-pressed={true} disabled={fastBusy} title="Fast Chat (active)">
                          <span className="mode-sw-label">⚡ Fast Chat</span>
                          <span className="mode-sw-track" aria-hidden="true"><span className="mode-sw-knob" /></span>
                        </button>
                        <button type="button" className="mode-sw" aria-pressed={false} disabled={fastBusy} onClick={() => setMode("council")}>
                          <span className="mode-sw-label">AI Council</span>
                          <span className="mode-sw-track" aria-hidden="true"><span className="mode-sw-knob" /></span>
                        </button>
                      </div>
                      <div className="prov-select" role="group" aria-label="Engine">
                        {(["auto", "local", "frontier"] as const).map((p) => (
                          <button key={p} type="button" className={"prov-opt" + (fastProvider === p ? " on" : "")}
                            disabled={fastBusy} aria-pressed={fastProvider === p}
                            title={p === "auto" ? "Auto-route: quick → local, complex → frontier"
                              : p === "local" ? "Always answer locally (most private)"
                              : "Prefer frontier (falls back to local if unavailable)"}
                            onClick={() => setFastProvider(p)}>
                            {p === "auto" ? "Auto" : p === "local" ? "Local" : "Frontier"}
                          </button>
                        ))}
                      </div>
                      <button className="composer-send" disabled={fastBusy || !prompt.trim()} onClick={submit}
                        aria-label={fastBusy ? "Sending" : "Send message"}>
                        {fastBusy ? <span className="spinner" />
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>}
                      </button>
                    </div>
                  </div>
                  <div className="composer-quickstart composer-quickstart--below">
                    {FAST_SUGGESTIONS.map((sug) => (
                      <button key={sug.label} className="chip" disabled={fastBusy}
                        onClick={() => fillPrompt(sug.fill, sug.council)}>{sug.label}</button>
                    ))}
                  </div>
                  <div className="composer-foot composer-foot--stitch">
                    <span id={fastInputHelpId} className="muted small">Memory-aware · never creates tasks or decisions · ⌘/Ctrl+Enter to send</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="composer-quickstart">
                    {FAST_SUGGESTIONS.map((sug) => (
                      <button key={sug.label} className="chip" disabled={fastBusy}
                        onClick={() => fillPrompt(sug.fill, sug.council)}>{sug.label}</button>
                    ))}
                  </div>
                  <div className="composer-bar">
                    <button type="button" className="composer-attach" disabled aria-label="Attachments not available yet"
                      title="Attachments are not available in this local-secure prototype.">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21.4 11.1 12.3 20.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8" />
                      </svg>
                    </button>
                    <textarea ref={promptRef} className="council-input fast-input" rows={1} value={prompt} disabled={fastBusy}
                      placeholder="Ask Thunity or send a command…"
                      onChange={(e) => setPrompt(e.target.value)}
                      aria-busy={busy || fastBusy} aria-describedby={fastInputHelpId} aria-label="Fast Chat message"
                      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy && !fastBusy) submit(); }} />
                    <button className="composer-send" disabled={fastBusy || !prompt.trim()} onClick={submit}
                      aria-label={fastBusy ? "Sending" : "Send message"}>
                      {fastBusy ? <span className="spinner" />
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>}
                    </button>
                  </div>
                  <div className="composer-controls">
                    <div className="composer-controls-left">
                      <div className="mode-switches" role="group" aria-label="Chat mode">
                        <button type="button" className="mode-sw on" aria-pressed={true} disabled={fastBusy} title="Fast Chat (active)">
                          <span className="mode-sw-label">⚡ Fast Chat</span>
                          <span className="mode-sw-track" aria-hidden="true"><span className="mode-sw-knob" /></span>
                        </button>
                        <button type="button" className="mode-sw" aria-pressed={false} disabled={fastBusy} onClick={() => setMode("council")}>
                          <span className="mode-sw-label">AI Council</span>
                          <span className="mode-sw-track" aria-hidden="true"><span className="mode-sw-knob" /></span>
                        </button>
                      </div>
                      <div className="prov-select" role="group" aria-label="Engine">
                        {(["auto", "local", "frontier"] as const).map((p) => (
                          <button key={p} type="button" className={"prov-opt" + (fastProvider === p ? " on" : "")}
                            disabled={fastBusy} aria-pressed={fastProvider === p}
                            title={p === "auto" ? "Auto-route: quick → local, complex → frontier"
                              : p === "local" ? "Always answer locally (most private)"
                              : "Prefer frontier (falls back to local if unavailable)"}
                            onClick={() => setFastProvider(p)}>
                            {p === "auto" ? "Auto" : p === "local" ? "Local" : "Frontier"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button className="btn btn-escalate" disabled={fastBusy}
                      onClick={() => fillPrompt("Escalate this topic to AI Council for strategic analysis.", true)}>Escalate to AI Council</button>
                  </div>
                  <div className="composer-foot">
                    <span id={fastInputHelpId} className="muted small">Memory-aware · never creates tasks or decisions · ⌘/Ctrl+Enter to send</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {showInsight && (
            <FounderInsightPanel turns={fastTurns.length} convId={fastConvId} convHref={fastConvHref} />
          )}
        </div>
      )}

      {mode === "council" && (
      <Card title="Recent Council Activity" hint="/api/audit?action=agent_run"
        actions={<>{hist.loading && hist.data ? <span className="muted small">refreshing…</span> : null}<a className="link" href="/conversations">Conversations →</a> <a className="link" href="/audit">Audit Trail →</a></>}>
        {hist.loading && !hist.data ? <Loading />
          : hist.error
            ? <div className="note">Council run history is also visible via <a className="link" href="/conversations">Conversations</a> and the <a className="link" href="/audit">Audit Trail</a>. Detailed audit access requires the VIEW_LOGS permission.</div>
            : hist.data?.audit?.length
              ? <ul className="feed">{hist.data.audit.map((a) => {
                  const md = (a.metadata || {}) as { status?: string; knowledge_used?: boolean };
                  return (
                    <li key={a.id}>
                      <span className="feed-action">run {String(a.entity_id || "").slice(0, 8)}</span>
                      <span className="muted small">{a.actor || "system"} · {md.status || "?"}{md.knowledge_used ? " · knowledge" : ""}</span>
                      <time>{new Date(asUTC(a.created_at)).toLocaleString()}</time>
                    </li>
                  );
                })}</ul>
              : <Empty label="No council runs recorded yet. Convene the council above to create one." />}
        {!hist.error && <div className="muted small mt">Per-run deep links aren't available yet — open a session in <a className="link" href="/conversations">Conversations</a> to read its transcript, or see the <a className="link" href="/audit">Audit Trail</a>.</div>}
      </Card>
      )}

      {mode === "council" && !result && !busy && (
        <details className="stage checklist">
          <summary><span className="strong">Runtime test checklist</span></summary>
          <ul className="bullets">
            <li>Backend reachable at the configured API URL (default :8000).</li>
            <li>Ollama running locally and required council models visible in Observatory → Local Models.</li>
            <li>Signed in with run-analysis permission (founder / admin / analyst).</li>
            <li>Expect ~2–4 minutes per run on local hardware; elapsed time is shown live.</li>
            <li>If Ollama is offline the run returns a <b>failed</b> status with stage errors — shown honestly, never as success.</li>
          </ul>
        </details>
      )}

      {mode === "council" && busy && (
        <Card title="Council is deliberating locally…">
          <div className="council-loading" aria-live="polite">
            <span className="spinner" />
            <div>
              <b>Six sequential stages are running on local models.</b>
              <p className="muted">This can take <b>2–4 minutes</b> on this hardware (longer on CPU fallback).
                Keep this tab open — there is no cloud acceleration.</p>
              <p className="muted small">Elapsed: {elapsed}s</p>
            </div>
          </div>
        </Card>
      )}

      {mode === "council" && error && <ErrorState message={error} />}

      {mode === "council" && result && !busy && (
        <>
          {result.status !== "completed" && (
            <div className="banner banner-bad">⚠ Council did not complete cleanly (status: {result.status}).{failedStages ? ` ${failedStages} stage(s) failed.` : ""} See the transcript below (e.g., Ollama offline or a missing model).</div>
          )}
          <div className="council-meta">
            <Badge tone={result.status === "completed" ? "ok" : "bad"}>{result.status}</Badge>
            <span className="muted small">run {result.agent_run_id.slice(0, 8)}</span>
            {typeof result.total_latency_ms === "number" && <span className="muted small">· {(result.total_latency_ms / 1000).toFixed(1)}s</span>}
            <Badge tone={result.knowledge_used ? "ok" : "muted"}>{result.knowledge_used ? "knowledge used" : "no knowledge source"}</Badge>
          </div>

          {result.status === "completed" && (
            <div id={councilActionContextId} className="muted small" style={{ marginBottom: "16px", lineHeight: 1.5 }}>This is a local <b>recommendation / draft</b> — not an executed action. A draft decision or task is created <b>only when you confirm below</b>, never automatically; execution and approvals remain gated.</div>
          )}

          {result.status === "completed" && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
              {!confirming ? (
                <button className="btn" aria-describedby={councilActionContextId} disabled={saving || !!savedId} onClick={() => setConfirming(true)}>
                  {saving ? "Saving…" : savedId ? "Saved as draft" : "Save as Draft Decision"}
                </button>
              ) : (
                <>
                  <span className="small">Save this Council result as a <b>DRAFT decision</b>? Creates a record only — no execution.</span>
                  <button className="btn btn-primary" aria-describedby={councilActionContextId} style={{ width: "auto" }} disabled={saving} onClick={() => { setConfirming(false); saveDraft(); }}>Confirm Save</button>
                  <button className="btn" disabled={saving} onClick={() => setConfirming(false)}>Cancel</button>
                </>
              )}
              {savedId && <span className="ok small">Draft decision created (<a className="link" href="/decisions">{savedId.slice(0, 8)}</a>) — open Decisions to review.</span>}
              {saveErr && <span className="bad small">⚠ {saveErr}</span>}
            </div>
          )}

          {result.status === "completed" && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
              {!confirmingTask ? (
                <button className="btn" aria-describedby={councilActionContextId} disabled={creatingTask || !!taskId} onClick={() => setConfirmingTask(true)}>
                  {creatingTask ? "Creating…" : taskId ? "Task created" : "Create Task"}
                </button>
              ) : (
                <>
                  <span className="small">Create one <b>BACKLOG task</b> from this Council result? Creates a task record only — not a workflow run.</span>
                  <button className="btn btn-primary" aria-describedby={councilActionContextId} style={{ width: "auto" }} disabled={creatingTask} onClick={() => { setConfirmingTask(false); createTask(); }}>Confirm Create</button>
                  <button className="btn" disabled={creatingTask} onClick={() => setConfirmingTask(false)}>Cancel</button>
                </>
              )}
              {taskId && <span className="ok small">Backlog task created (<a className="link" href="/tasks">{taskId.slice(0, 8)}</a>) — open Mission Board to review.</span>}
              {taskErr && <span className="bad small">⚠ {taskErr}</span>}
            </div>
          )}

          <Card title="Executive Synthesis">
            {sections
              ? <div className="synthesis">{sections.map((s) => (
                  <div key={s.label} className="syn-block"><div className="syn-label">{s.label}</div><p>{s.body || "—"}</p></div>
                ))}</div>
              : <pre className="raw">{result.final_response || "(empty)"}</pre>}
          </Card>

          {ev && (
            <Card title="Evaluation" hint="local evaluator">
              <div className="scores">
                <Score label="Accuracy" v={ev.accuracy_score} />
                <Score label="Completeness" v={ev.completeness_score} />
                <Score label="Grounding" v={ev.grounding_score} />
                <Score label="Actionability" v={ev.actionability_score} />
              </div>
              <div className="kv mt">
                <Row k="Hallucination risk" v={<Badge tone={ev.hallucination_risk === "low" ? "ok" : ev.hallucination_risk === "high" ? "bad" : "warn"}>{ev.hallucination_risk || "—"}</Badge>} />
                {ev.status === "failed" && <Row k="Evaluator" v={<Badge tone="warn">unavailable</Badge>} />}
              </div>
              {ev.major_issues?.length ? <div className="detail-block"><b>Major issues</b><ul className="bullets">{ev.major_issues.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
              {ev.improvement_suggestions?.length ? <div className="detail-block"><b>Improvements</b><ul className="bullets">{ev.improvement_suggestions.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
            </Card>
          )}

          {(result.grounding_note || srcs.length > 0) && (
            <Card title="Source grounding">
              <div className="muted small">Trust levels describe source labels, not automatic verification of the final answer.</div>
              {result.grounding_note && <pre className="raw small">{result.grounding_note}</pre>}
              {srcs.length > 0 && (
                <div className="results mt">
                  {srcs.map((sc: Source, i: number) => (
                    <div key={sc.chunk_id || i} className="result">
                      <div className="result-head">
                        {sc.filename && <span className="strong">{sc.filename}</span>}
                        {sc.trust_level && <TrustBadge trust={sc.trust_level} />}
                        {sc.document_status && <StatusBadge status={sc.document_status} />}
                        {typeof sc.relevance_score === "number" && <span className="rel">rel {Number(sc.relevance_score).toFixed(2)}</span>}
                        {sc.page ? <span className="muted small">p.{sc.page}</span> : null}
                        {sc.sheet ? <span className="muted small">{sc.sheet}</span> : null}
                      </div>
                      {sc.warning && <div className="warn small">⚠ {sc.warning}</div>}
                      {sc.content_preview && <div className="result-prev">{sc.content_preview}</div>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card title="Deliberation transcript" hint={`${result.stages?.length || 0} stages`}>
            {result.stages?.map((st: CouncilStage, i: number) => (
              <details key={i} className="stage">
                <summary>
                  <span className="stage-n">Stage {i + 1}</span>
                  <span className="strong">{AGENT_LABEL[st.agent] || st.agent}</span>
                  <span className="muted small">{st.model}</span>
                  {st.status !== "ok" && <Badge tone="bad">{st.status}</Badge>}
                  {typeof st.latency_ms === "number" && <span className="muted small">{(st.latency_ms / 1000).toFixed(1)}s</span>}
                </summary>
                <pre className="raw">{st.content}</pre>
              </details>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
