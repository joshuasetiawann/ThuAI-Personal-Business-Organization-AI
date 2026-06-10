import { useState, useRef, useEffect } from "react";
import { api, ApprovalRequiredError } from "../api/client";
import { PageHeader, Card, Badge, TrustBadge, StatusBadge, ErrorState, Row, Loading, Empty, useAsync } from "../components/ui";
import type { CouncilResult, CouncilStage, AuditEntry, Source } from "../types";

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

export default function Council() {
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
  const hist = useAsync<{ audit: AuditEntry[] }>(() => api.councilHistory(20) as Promise<{ audit: AuditEntry[] }>);

  const [elapsed, setElapsed] = useState(0);
  const ctrl = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; ctrl.current?.abort(); }, []);
  const submit = async () => {
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

  const sections = result ? parseSynthesis(result.final_response) : null;
  const ev = result?.evaluation;
  const failedStages = result?.stages?.filter((s) => s.status !== "ok").length ?? 0;
  const srcs: Source[] = result ? ((result.sources || []) as Source[]) : [];

  return (
    <div className="page">
      <PageHeader title="AI Council"
        subtitle="Four local agents deliberate sequentially: Analyst → Critic → Execution → Analyst revision → Synthesizer → Evaluator. 100% local via Ollama." />
      <div className="note">You can save a completed Council result as a draft decision or create a backlog task for later review. Execution, approvals, workflow triggers, and tool execution remain disabled here.</div>

      <Card title="New Council session" hint="POST /api/agents/council">
        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <input type="checkbox" checked={useKb} disabled={busy} onChange={(e) => setUseKb(e.target.checked)} />
          <span>Use Knowledge Base</span>
        </label>
        {useKb && <div className="banner banner-warn">⚠ Council will use local Knowledge Vault sources. Results may include untrusted documents; verify trust badges and grounding.</div>}
        <textarea className="council-input" rows={5} value={prompt} disabled={busy}
          placeholder="Ask the council a strategic, technical, or operational question…"
          onChange={(e) => setPrompt(e.target.value)}
          aria-busy={busy}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy) submit(); }} />
        <div className="council-actions">
          <span className="muted small">Runs locally · knowledge base: {useKb ? "on" : "off"} · no decision/task side-effects · ⌘/Ctrl+Enter to run</span>
          <button className="btn btn-primary council-submit" disabled={busy || !prompt.trim()} onClick={submit}>
            {busy ? "Deliberating…" : "Convene council"}
          </button>
        </div>
      </Card>

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

      {!result && !busy && (
        <details className="stage checklist">
          <summary><span className="strong">Runtime test checklist</span></summary>
          <ul className="bullets">
            <li>Backend reachable at the configured API URL (default :8000).</li>
            <li>Ollama running locally with the council models pulled — check Observatory → Local Models for any missing.</li>
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
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
              {!confirming ? (
                <button className="btn" disabled={saving || !!savedId} onClick={() => setConfirming(true)}>
                  {saving ? "Saving…" : savedId ? "Saved as draft" : "Save as Draft Decision"}
                </button>
              ) : (
                <>
                  <span className="small">Save this Council result as a DRAFT decision?</span>
                  <button className="btn btn-primary" style={{ width: "auto" }} disabled={saving} onClick={() => { setConfirming(false); saveDraft(); }}>Confirm Save</button>
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
                <button className="btn" disabled={creatingTask || !!taskId} onClick={() => setConfirmingTask(true)}>
                  {creatingTask ? "Creating…" : taskId ? "Task created" : "Create Task"}
                </button>
              ) : (
                <>
                  <span className="small">Create one BACKLOG task from this Council result?</span>
                  <button className="btn btn-primary" style={{ width: "auto" }} disabled={creatingTask} onClick={() => { setConfirmingTask(false); createTask(); }}>Confirm Create</button>
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
