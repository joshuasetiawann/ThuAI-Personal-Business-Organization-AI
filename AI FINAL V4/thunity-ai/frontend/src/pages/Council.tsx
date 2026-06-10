import { useState, useRef, useEffect } from "react";
import { api, ApprovalRequiredError } from "../api/client";
import { PageHeader, Card, Badge, TrustBadge, StatusBadge, ErrorState, Row, Loading, Empty, useAsync } from "../components/ui";
import type { CouncilResult, CouncilStage, AuditEntry, Source, FastChatResponse } from "../types";

type FastTurn = {
  id: string;
  prompt: string;
  response?: string;
  model?: string | null;
  latency_ms?: number | null;
  conversation_id?: string | null;
  status: "pending" | "completed" | "error";
  error?: string;
};

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

const FAST_SUGGESTIONS: { label: string; fill: string; council?: boolean }[] = [
  { label: "Brief today's priorities", fill: "Brief today's priorities." },
  { label: "Review latest decision", fill: "Review the latest decision and summarize it." },
  { label: "Escalate to AI Council", fill: "Escalate this topic to AI Council for strategic analysis.", council: true },
];

export default function Council({ initialMode = "fast" }: { initialMode?: "fast" | "council" }) {
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
  const hist = useAsync<{ audit: AuditEntry[] }>(() => api.councilHistory(20) as Promise<{ audit: AuditEntry[] }>);

  const [elapsed, setElapsed] = useState(0);
  const ctrl = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const fastEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { mounted.current = false; ctrl.current?.abort(); }, []);
  useEffect(() => { if (mode === "fast") fastEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [fastTurns, mode]);
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

  const runFast = async () => {
    const text = prompt.trim();
    if (fastBusy || !text) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setFastLastPrompt(text);
    setFastTurns((prev) => [...prev, { id, prompt: text, status: "pending" }]);
    setPrompt(""); focusPrompt();
    setFastBusy(true); setFastErr(null);
    try {
      const r = await api.fastChat(text, fastConvId || undefined) as FastChatResponse;
      setFastResult(r);
      if (r.conversation_id) setFastConvId(r.conversation_id);
      setFastTurns((prev) => prev.map((t) => t.id === id ? {
        ...t, response: r.response, model: r.model, latency_ms: r.latency_ms,
        conversation_id: r.conversation_id, status: "completed" as const,
      } : t));
    } catch (e: any) {
      const msg = e?.message || "Fast chat failed.";
      setFastErr(msg);
      setFastTurns((prev) => prev.map((t) => t.id === id ? { ...t, status: "error" as const, error: msg } : t));
    } finally { setFastBusy(false); }
  };

  const clearFastThread = () => { setFastTurns([]); setFastResult(null); setFastErr(null); setFastLastPrompt(""); };

  const submit = () => { if (mode === "fast") void runFast(); else void runCouncil(); };

  const sections = result ? parseSynthesis(result.final_response) : null;
  const ev = result?.evaluation;
  const failedStages = result?.stages?.filter((s) => s.status !== "ok").length ?? 0;
  const srcs: Source[] = result ? ((result.sources || []) as Source[]) : [];
  const fastConvHref = fastConvId ? `/conversations?open=${encodeURIComponent(fastConvId)}` : null;
  const fastInputHelpId = "fast-chat-input-help";
  const councilActionContextId = "council-action-context";

  return (
    <div className={"page" + (mode === "fast" ? " fast-mode-page" : " council-mode-page")}>
      <PageHeader title={mode === "fast" ? "Fast Chat" : "AI Council"}
        subtitle={mode === "fast"
          ? "Ask Thunity quick operational questions using one local model. No tools, no workflow execution, no decision side-effects."
          : "Four local agents deliberate sequentially: Analyst → Critic → Execution → Analyst revision → Synthesizer → Evaluator. 100% local via Ollama."} />
      <div className="note">{mode === "fast"
        ? "Fast Chat is for quick local assistance. It does not create decisions, tasks, approvals, workflows, or tool calls."
        : "You can save a completed Council result as a draft decision or create a backlog task for later review. Execution, approvals, workflow triggers, and tool execution remain disabled here."}</div>

      <Card title="New session" hint={mode === "fast" ? "POST /api/agents/chat" : "POST /api/agents/council"}>
        <div className="filter-row" style={{ marginBottom: "8px" }}>
          <button className={"chip" + (mode === "fast" ? " active" : "")} disabled={busy || fastBusy} onClick={() => setMode("fast")}>Fast Chat</button>
          <button className={"chip" + (mode === "council" ? " active" : "")} disabled={busy || fastBusy} onClick={() => setMode("council")}>AI Council</button>
        </div>
        {mode === "fast" ? (
          <div className="fast-mode-head">
            <span className="fast-secure-tag">Local-Secure</span>
            <div className="filter-row" style={{ margin: 0 }}>
              <span className="chip" style={{ cursor: "default" }}>Local-only</span>
              <span className="chip" style={{ cursor: "default" }}>No tools</span>
              <span className="chip" style={{ cursor: "default" }}>No workflow execution</span>
            </div>
          </div>
        ) : (
          <div className="council-mode-head">
            <div>
              <div className="fast-mode-title">AI Council</div>
              <div className="fast-mode-subtitle">Multi-agent deliberation for important decisions (slower, ~2–4 min).</div>
            </div>
            <div className="filter-row" style={{ margin: 0 }}>
              <span className="chip" style={{ cursor: "default" }}>Strategic review</span>
              <span className="chip" style={{ cursor: "default" }}>Drafts only</span>
              <span className="chip" style={{ cursor: "default" }}>Founder approval required</span>
            </div>
          </div>
        )}
        {mode === "council" && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <input type="checkbox" checked={useKb} disabled={busy} onChange={(e) => setUseKb(e.target.checked)} />
              <span>Use Knowledge Base</span>
            </label>
            {useKb && <div className="banner banner-warn">⚠ Council will use local Knowledge Vault sources. Results may include untrusted documents; verify trust badges and grounding.</div>}
          </>
        )}
        <textarea ref={promptRef} className={"council-input" + (mode === "fast" ? " fast-input" : "")} rows={mode === "fast" ? 3 : 5} value={prompt} disabled={busy || fastBusy}
          placeholder={mode === "fast" ? "Ask a quick question…" : "Ask the council a strategic, technical, or operational question…"}
          onChange={(e) => setPrompt(e.target.value)}
          aria-busy={busy || fastBusy} aria-describedby={fastInputHelpId} aria-label={mode === "fast" ? "Fast Chat message" : "AI Council question"}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy && !fastBusy) submit(); }} />
        <div className="council-actions">
          <span id={fastInputHelpId} className="muted small">
            {mode === "fast"
              ? "Runs locally · one model · no side-effects · ⌘/Ctrl+Enter to send"
              : `Runs locally · knowledge base: ${useKb ? "on" : "off"} · no decision/task side-effects · ⌘/Ctrl+Enter to run`}
          </span>
          {mode === "fast"
            ? <button className="btn btn-primary council-submit" disabled={fastBusy || !prompt.trim()} onClick={submit}>{fastBusy ? "Thinking…" : "Send"}</button>
            : <button className="btn btn-primary council-submit" disabled={busy || !prompt.trim()} onClick={submit}>{busy ? "Deliberating…" : "Convene council"}</button>}
        </div>
      </Card>

      {mode === "fast" && (
        <div className="fast-workspace">
          <div className="fast-main">
            <div className="fast-canvas-mark" aria-hidden="true">
              <span className="mark-glyph">◆</span>
              <span className="mark-word">THUNITY</span>
            </div>
            <div className="fast-canvas-content">
            <div className="fast-quickstart">
              <span className="fast-quickstart-label">Quick start</span>
              <div className={"fast-suggestions" + (fastTurns.length > 0 ? " quiet" : "")}>
                {FAST_SUGGESTIONS.map((sug) => (
                  <button key={sug.label} className="chip" disabled={fastBusy}
                    onClick={() => fillPrompt(sug.fill, sug.council)}>{sug.label}</button>
                ))}
              </div>
            </div>

            {fastTurns.length === 0 && (
              <div className="fast-empty-state">
                <div className="fast-empty-title">Ask Thunity anything</div>
                <div className="fast-empty-sub">Responses stay local and side-effect-free. Fast Chat can answer, summarize, and reason — it won't create tasks, decisions, workflows, or tool calls.</div>
                <div className="fast-empty-cue">Local-secure · one local model · no side-effects</div>
              </div>
            )}

            {fastTurns.length > 0 && (
              <Card title="Fast Assistant"
                actions={fastConvHref ? <a className="link" href={fastConvHref}>Open conversation →</a> : undefined}>
                <div className="fast-thread" aria-live="polite" aria-relevant="additions text" aria-atomic="false" aria-busy={fastTurns.some((t) => t.status === "pending")}>
                  {fastTurns.map((t) => (
                    <div key={t.id} className="fast-turn">
                      <div className="fast-user">
                        <div className="muted small strong">You</div>
                        <div style={{ whiteSpace: "pre-wrap", marginTop: "2px" }}>{t.prompt}</div>
                      </div>
                      <div className="fast-assistant">
                        <div className="muted small strong">Thunity Assistant</div>
                        {t.status === "pending"
                          ? <div className="muted" role="status" style={{ marginTop: "4px" }}><span className="spinner" /> Thinking locally…</div>
                          : t.status === "error"
                            ? <div style={{ marginTop: "4px" }}>
                                <div className="bad small">⚠ {t.error || "The local response didn't complete."}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                                  <button type="button" className="fast-retry" onClick={() => fillPrompt(t.prompt)}>Retry prompt</button>
                                  <span className="muted small">Re-fills your message — nothing was sent or executed.</span>
                                </div>
                              </div>
                            : <>
                                <pre className="raw" style={{ marginTop: "4px" }}>{t.response || "(empty)"}</pre>
                                <div className="fast-meta">{`Local Fast${typeof t.latency_ms === "number" ? ` • ${t.latency_ms}ms` : ""} • Local-only`}</div>
                              </>}
                      </div>
                    </div>
                  ))}
                </div>
                <div ref={fastEndRef} />
                <div className="fast-clear-row">
                  <span className="muted small">Does not delete saved conversation history.</span>
                  <button className="btn" style={{ width: "auto" }} disabled={fastBusy} onClick={clearFastThread}>Clear local thread</button>
                </div>
              </Card>
            )}
            </div>
          </div>

          <div className="fast-side">
            <div className="fast-insight-card">
              <div className="fast-insight-title">Founder Insight</div>
              <div className="fast-insight-note">Local policy &amp; session context — not live system health.</div>

              <div className="fast-insight-section">
                <div className="fast-insight-label">Local Policy</div>
                <div className="muted small" style={{ margin: "-2px 0 8px" }}>Local Secure — answers only, no side-effects.</div>
                <div className="fast-insight-row"><span>Local-only</span><b className="fast-check">✓</b></div>
                <div className="fast-insight-row"><span>No tools</span><b className="fast-check">✓</b></div>
                <div className="fast-insight-row"><span>No workflow execution</span><b className="fast-check">✓</b></div>
              </div>

              <div className="fast-insight-section">
                <div className="fast-insight-label">Session</div>
                <div className="fast-insight-row"><span>Local turns</span><b>{fastTurns.length}</b></div>
                <div className="fast-insight-row"><span>Conversation saved</span>{fastConvId ? <b className="ok">Yes</b> : <span className="muted">No</span>}</div>
              </div>

              <div className="fast-insight-section">
                <div className="fast-insight-label">Next Step</div>
                <p className="muted small" style={{ margin: "0 0 6px" }}>Use Fast Chat for quick operational answers.</p>
                <p className="muted small" style={{ margin: 0 }}>Escalate to AI Council for strategic analysis.</p>
                {fastConvHref && (
                  <a className="fast-insight-link link" href={fastConvHref}>Open saved conversation →</a>
                )}
              </div>
            </div>
          </div>
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
                      <time>{new Date(a.created_at).toLocaleString()}</time>
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

      {busy && (
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

      {error && <ErrorState message={error} />}

      {result && !busy && (
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
