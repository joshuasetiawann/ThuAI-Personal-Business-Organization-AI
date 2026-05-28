# Gemini W13A Fast Chat Review Bundle

Project: Thunity Local AI Company OS
Phase: W13A Fast Chat / Lightweight Assistant

Scope:
- Adds POST /api/agents/chat
- Adds Fast Chat / AI Council mode toggle
- Fast Chat uses one local model only
- Fast Chat persists user + assistant messages to conversation
- Fast Chat must not run Council
- Fast Chat must not create decision/task/approval/workflow/tool
- Council behavior must remain unchanged
- Save Draft Decision / Create Task remain Council-only
- Use Knowledge Base remains Council-only



============================================================
FILE: backend/api/routes/agents.py
============================================================
"""AI Council endpoints (non-streaming, fully persisted)."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.deps import get_db, get_current_user, require_permission
from core.permissions import Perm
from core.errors import AppError
from core.audit import log_audit
from agents.council import run_council, _active_prompt
from agents.ollama_client import ollama
from agents.model_router import role_model_map, select_model
from db.models import AgentRun, AgentMessage
from services import conversation_service as cs
from services import decision_service, task_service

router = APIRouter()


class CouncilRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    use_knowledge_base: bool = False
    top_k: int = 5
    save_as_decision: bool = False
    create_tasks_from_output: bool = False
    allow_deep_reasoning: bool = False


class SingleRequest(BaseModel):
    agent_name: str = "architect_analyst"
    message: str
    conversation_id: str | None = None


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


FAST_SYSTEM = ("You are Thunity Fast Assistant. Answer briefly and practically. "
               "For strategic or high-risk decisions, tell the user to use AI Council.")


@router.post("/council")
async def council(req: CouncilRequest, db=Depends(get_db),
                  user: dict = Depends(require_permission(Perm.RUN_ANALYSIS))):
    if not req.message.strip():
        raise AppError(400, "EMPTY_MESSAGE", "message must not be empty.")
    # ensure a conversation
    conv_id = req.conversation_id
    if conv_id:
        conv = await cs.get_conversation(db, conv_id)
        if not conv or not cs.can_access(user, conv):
            raise AppError(403, "FORBIDDEN", "No access to that conversation.")
    else:
        conv = await cs.create_conversation(db, user["id"], req.message[:60])
        conv_id = str(conv.id)

    await cs.add_message(db, conv_id, "user", req.message)
    result = await run_council(db, req.message, user, conversation_id=uuid.UUID(conv_id),
                               use_knowledge_base=req.use_knowledge_base, top_k=req.top_k,
                               allow_deep=req.allow_deep_reasoning)
    await cs.add_message(db, conv_id, "assistant", result["final_response"],
                         agent_name="executive_synthesizer",
                         metadata={"agent_run_id": result["agent_run_id"],
                                   "sources": result["sources"]})

    decision_id = None
    if req.save_as_decision and result["status"] == "completed":
        d = await decision_service.create_decision(
            db, title=req.message[:120], decision_text=result["final_response"],
            summary=result["grounding_note"], conversation_id=conv_id,
            agent_run_id=result["agent_run_id"],
            evidence={"sources": result["sources"], "evaluation": result["evaluation"]},
            created_by=user["email"])
        decision_id = str(d.id)
        if req.create_tasks_from_output:
            await task_service.create_from_decision(db, d, created_by=user["email"])

    await log_audit(db, "agent_run", actor=user["email"], actor_role=user["role"],
                    entity_type="agent_run", entity_id=result["agent_run_id"],
                    metadata={"knowledge_used": result["knowledge_used"], "status": result["status"]})
    await db.commit()
    result["conversation_id"] = conv_id
    result["decision_id"] = decision_id
    return result


@router.post("/single")
async def single_agent(req: SingleRequest, db=Depends(get_db),
                       user: dict = Depends(require_permission(Perm.RUN_ANALYSIS))):
    role_key = {"architect_analyst": "analyst", "red_team_critic": "critic",
                "pragmatic_execution_engineer": "execution",
                "executive_synthesizer": "synthesizer", "evaluator": "evaluator"}.get(req.agent_name, "analyst")
    model = role_model_map().get(role_key)
    prompt = await _active_prompt(db, req.agent_name)
    run = AgentRun(mode="single", user_message=req.message, model_map_json={req.agent_name: model},
                   status="running", user_id=uuid.UUID(user["id"]))
    db.add(run)
    await db.flush()
    status, content, latency = "ok", "", None
    try:
        out = await ollama.chat(model, [{"role": "system", "content": prompt["text"]},
                                        {"role": "user", "content": req.message}])
        content, latency = out["content"], out["latency_ms"]
    except Exception as e:
        status, content = "failed", f"[failed: {e}]"
    db.add(AgentMessage(agent_run_id=run.id, agent_name=req.agent_name, round="single",
                        model=model, prompt_version_id=prompt["id"], prompt=req.message[:4000],
                        response=content, latency_ms=latency, status=status))
    run.final_response, run.status = content, "completed" if status == "ok" else "failed"
    await log_audit(db, "agent_run", actor=user["email"], entity_type="agent_run", entity_id=str(run.id))
    await db.commit()
    return {"agent_run_id": str(run.id), "agent": req.agent_name, "model": model,
            "response": content, "status": run.status}


@router.post("/chat")
async def fast_chat(req: ChatRequest, db=Depends(get_db),
                    user: dict = Depends(require_permission(Perm.RUN_ANALYSIS))):
    """Lightweight single-model chat for casual prompts. Local Ollama only; persists
    user+assistant messages; never runs the Council or any tool/workflow/decision."""
    if not req.message.strip():
        raise AppError(400, "EMPTY_MESSAGE", "message must not be empty.")
    conv_id = req.conversation_id
    if conv_id:
        conv = await cs.get_conversation(db, conv_id)
        if not conv or not cs.can_access(user, conv):
            raise AppError(403, "FORBIDDEN", "No access to that conversation.")
    else:
        conv = await cs.create_conversation(db, user["id"], req.message[:60])
        conv_id = str(conv.id)
    await cs.add_message(db, conv_id, "user", req.message)
    model = select_model("fast")
    try:
        out = await ollama.chat(model, [{"role": "system", "content": FAST_SYSTEM},
                                        {"role": "user", "content": req.message}])
    except Exception as e:
        raise AppError(503, "OLLAMA_OFFLINE", "Local model is not reachable.",
                       detail=str(e)[:300], suggested_action="Ensure Ollama is running.")
    content, latency = out.get("content", ""), out.get("latency_ms")
    await cs.add_message(db, conv_id, "assistant", content, agent_name="fast_assistant",
                         metadata={"model": model, "latency_ms": latency})
    await log_audit(db, "fast_chat", actor=user["email"], entity_type="conversation", entity_id=conv_id)
    await db.commit()
    return {"conversation_id": conv_id, "response": content, "status": "completed",
            "model": model, "latency_ms": latency}


@router.get("/health")
async def agents_health(user: dict = Depends(get_current_user)):
    oll = await ollama.health()
    return {"agents": list(role_model_map().keys()), "models": role_model_map(), "ollama": oll}


============================================================
FILE: frontend/src/pages/Council.tsx
============================================================
import { useState, useRef, useEffect } from "react";
import { api, ApprovalRequiredError } from "../api/client";
import { PageHeader, Card, Badge, TrustBadge, StatusBadge, ErrorState, Row, Loading, Empty, useAsync } from "../components/ui";
import type { CouncilResult, CouncilStage, AuditEntry, Source, FastChatResponse } from "../types";

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
  const [mode, setMode] = useState<"fast" | "council">("fast");
  const [fastBusy, setFastBusy] = useState(false);
  const [fastErr, setFastErr] = useState<string | null>(null);
  const [fastResult, setFastResult] = useState<FastChatResponse | null>(null);
  const [fastConvId, setFastConvId] = useState<string | null>(null);
  const hist = useAsync<{ audit: AuditEntry[] }>(() => api.councilHistory(20) as Promise<{ audit: AuditEntry[] }>);

  const [elapsed, setElapsed] = useState(0);
  const ctrl = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; ctrl.current?.abort(); }, []);
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
    if (fastBusy || !prompt.trim()) return;
    setFastBusy(true); setFastErr(null);
    try {
      const r = await api.fastChat(prompt, fastConvId || undefined) as FastChatResponse;
      setFastResult(r);
      if (r.conversation_id) setFastConvId(r.conversation_id);
    } catch (e: any) {
      setFastErr(e?.message || "Fast chat failed.");
    } finally { setFastBusy(false); }
  };

  const submit = () => { if (mode === "fast") void runFast(); else void runCouncil(); };

  const sections = result ? parseSynthesis(result.final_response) : null;
  const ev = result?.evaluation;
  const failedStages = result?.stages?.filter((s) => s.status !== "ok").length ?? 0;
  const srcs: Source[] = result ? ((result.sources || []) as Source[]) : [];

  return (
    <div className="page">
      <PageHeader title="AI Council"
        subtitle="Four local agents deliberate sequentially: Analyst → Critic → Execution → Analyst revision → Synthesizer → Evaluator. 100% local via Ollama." />
      <div className="note">You can save a completed Council result as a draft decision or create a backlog task for later review. Execution, approvals, workflow triggers, and tool execution remain disabled here.</div>

      <Card title="New session" hint={mode === "fast" ? "POST /api/agents/chat" : "POST /api/agents/council"}>
        <div className="filter-row" style={{ marginBottom: "8px" }}>
          <button className={"chip" + (mode === "fast" ? " active" : "")} disabled={busy || fastBusy} onClick={() => setMode("fast")}>Fast Chat</button>
          <button className={"chip" + (mode === "council" ? " active" : "")} disabled={busy || fastBusy} onClick={() => setMode("council")}>AI Council</button>
        </div>
        <div className="muted small" style={{ marginBottom: "10px" }}>
          {mode === "fast"
            ? "Fast Chat — one local model, quick answer. Use AI Council for important decisions."
            : "AI Council — multi-agent deliberation for important decisions (slower, ~2–4 min)."}
        </div>
        {mode === "council" && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <input type="checkbox" checked={useKb} disabled={busy} onChange={(e) => setUseKb(e.target.checked)} />
              <span>Use Knowledge Base</span>
            </label>
            {useKb && <div className="banner banner-warn">⚠ Council will use local Knowledge Vault sources. Results may include untrusted documents; verify trust badges and grounding.</div>}
          </>
        )}
        <textarea className="council-input" rows={mode === "fast" ? 3 : 5} value={prompt} disabled={busy || fastBusy}
          placeholder={mode === "fast" ? "Ask a quick question…" : "Ask the council a strategic, technical, or operational question…"}
          onChange={(e) => setPrompt(e.target.value)}
          aria-busy={busy || fastBusy}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !busy && !fastBusy) submit(); }} />
        <div className="council-actions">
          <span className="muted small">
            {mode === "fast"
              ? "Runs locally · one model · no side-effects · ⌘/Ctrl+Enter to send"
              : `Runs locally · knowledge base: ${useKb ? "on" : "off"} · no decision/task side-effects · ⌘/Ctrl+Enter to run`}
          </span>
          {mode === "fast"
            ? <button className="btn btn-primary council-submit" disabled={fastBusy || !prompt.trim()} onClick={submit}>{fastBusy ? "Thinking…" : "Send"}</button>
            : <button className="btn btn-primary council-submit" disabled={busy || !prompt.trim()} onClick={submit}>{busy ? "Deliberating…" : "Convene council"}</button>}
        </div>
      </Card>

      {fastErr && <ErrorState message={fastErr} />}
      {fastBusy && <Card title="Fast Assistant"><div className="council-loading"><span className="spinner" /><div>Thinking locally…</div></div></Card>}
      {fastResult && !fastBusy && (
        <Card title="Fast Assistant"
          hint={`${fastResult.model}${typeof fastResult.latency_ms === "number" ? ` · ${(fastResult.latency_ms / 1000).toFixed(1)}s` : ""}`}
          actions={fastResult.conversation_id ? <a className="link" href="/conversations">Conversations →</a> : undefined}>
          <pre className="raw">{fastResult.response || "(empty)"}</pre>
        </Card>
      )}

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

      {mode === "council" && !result && !busy && (
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


============================================================
FILE: frontend/src/api/client.ts
============================================================
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
    throw new ApiError(0, "NETWORK", `Cannot reach backend at ${API_URL}. Is it running?`);
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
  catch { throw new ApiError(0, "NETWORK", `Cannot reach backend at ${API_URL}. Is it running?`); }
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


============================================================
FILE: frontend/src/types.ts
============================================================
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

// ── W2 read-only operational entities ────────────────────────────────
export interface DecisionBrief { id: string; title: string; status: string; risk_level: string; agent_run_id?: string | null; created_at: string; }
export interface DecisionDetail extends DecisionBrief { decision_text?: string; summary?: string; evidence?: unknown; created_by?: string | null; approved_by?: string | null; conversation_id?: string | null; }
export interface TaskBrief { id: string; title: string; status: string; priority: string; owner: string | null; risk_level: string; due_date: string | null; overdue?: boolean; created_at: string; }
export interface TaskDetail extends TaskBrief { description?: string; source_decision_id?: string | null; source_agent_run_id?: string | null; }
export interface Approval { id: string; requested_action: string; risk_level: string; status: string; requested_by?: string | null; approved_by?: string | null; confirmation_phrase: string | null; created_at: string; }
export interface DocBrief { id: string; filename: string; file_type: string; document_status: string; trust_level: string; chunk_count: number; created_at: string; }
export interface DocDetail extends DocBrief { sensitivity_level?: string; owner?: string | null; client_name?: string | null; project_name?: string | null; sha256?: string; metadata?: unknown; }
export interface ConvBrief { id: string; title: string; status: string; created_at: string; }
export interface ConvDetail { id: string; title: string; status: string; user_id: string | null; }
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

export interface DecisionCreate { title: string; decision_text: string; summary: string; risk_level: "low" | "medium" | "high" | "critical"; conversation_id?: string; agent_run_id?: string; }

export interface TaskCreate { title: string; description?: string; priority?: string; risk_level?: string; owner?: string; due_date?: string; }

export interface WorkflowAllowed { name: string; risk: string; required_permission: string; }
export interface WorkflowTriggerResponse { run_id: string; workflow_name: string; status: string; }

export interface ToolInfo { name: string; input_schema?: Record<string, unknown>; risk_level: string; required_permission: string; audit: boolean; description: string; }

export interface FastChatResponse { conversation_id: string; response: string; status: string; model: string; latency_ms: number | null; }
