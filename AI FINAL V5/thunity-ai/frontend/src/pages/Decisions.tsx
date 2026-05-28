import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApprovalRequiredError } from "../api/client";
import { asUTC } from "../utils/time";
import { useAuth } from "../auth/AuthContext";
import { PageHero, StatTiles, StatTile, SectionLabel, Card, StatusBadge, RiskBadge, DetailDrawer, LoadMore,
  Loading, ErrorState, Empty, Row, usePaged } from "../components/ui";
import type { DecisionBrief, DecisionDetail } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DecisionsIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l2.5 2.5L17 8" /><rect x="4" y="4" width="16" height="16" rx="2.5" />
  </svg>
);

export default function Decisions() {
  const { user } = useAuth();
  const perms = (user?.permissions || []).map((x) => String(x).toLowerCase());
  const role = String(user?.role || "").toLowerCase();
  const canCreateTask = role === "founder" || role === "admin" || perms.includes("all") || perms.includes("create_tasks");

  const { rows, loading, error, done, loadMore, reload } =
    usePaged<DecisionBrief>((l, o) => api.decisions(l, o).then((r: any) => r.decisions || []));
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<DecisionDetail | null>(null);
  const [dLoading, setDLoading] = useState(false);
  const [dErr, setDErr] = useState<string | null>(null);
  const [execBusy, setExecBusy] = useState(false);
  const [execMsg, setExecMsg] = useState<{ kind: "ok" | "pending" | "err"; text: string; approvalId?: string } | null>(null);
  const [approvalId, setApprovalId] = useState("");
  const [confirmingExec, setConfirmingExec] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskMsg, setTaskMsg] = useState<{ kind: "ok" | "pending" | "err"; text: string; taskId?: string } | null>(null);

  const [sp, setSp] = useSearchParams();
  const openById = useCallback((id: string) => {
    setOpen(true); setSel(null); setDErr(null); setDLoading(true); setExecMsg(null); setApprovalId(""); setConfirmingExec(false); setTaskMsg(null);
    api.decision(id).then((x: any) => setSel(x)).catch((e) => setDErr(e?.message || "Failed")).finally(() => setDLoading(false));
  }, []);
  const openDetail = (d: DecisionBrief) => setSp({ open: d.id });
  const closeDrawer = () => setSp({});
  useEffect(() => { const id = sp.get("open"); if (id) openById(id); else setOpen(false); }, [sp, openById]);

  const doExecute = async () => {
    if (!sel || execBusy) return;
    const aid = approvalId.trim();
    if (aid && !UUID_RE.test(aid)) { setExecMsg({ kind: "err", text: "Approval ID must be a valid UUID." }); return; }
    setExecBusy(true); setExecMsg(null);
    try {
      const d = await api.executeDecision(sel.id, aid || undefined) as { status?: string };
      if (d?.status === "executed") {
        setSel({ ...sel, status: "executed" });
        setExecMsg({ kind: "ok", text: "Decision marked as executed in the ledger." });
        reload();
      } else {
        setExecMsg({ kind: "err", text: "Unexpected response from server." });
      }
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) {
        setExecMsg({ kind: "pending", text: `Approval required for ${e.riskLevel} execution.`, approvalId: e.approvalId });
      } else if (e?.code === "NOT_APPROVED" || e?.status === 409) {
        setExecMsg({ kind: "err", text: "Decision must be approved before execution." });
      } else if (e?.code === "APPROVAL_REQUIRED" || e?.status === 403) {
        setExecMsg({ kind: "err", text: "An approved approval_id is required for high/critical execution." });
      } else if (e?.status === 404) {
        setExecMsg({ kind: "err", text: "Decision not found." });
      } else {
        setExecMsg({ kind: "err", text: e?.message || "Execution failed." });
      }
    } finally { setExecBusy(false); }
  };

  const doCreateTask = async () => {
    if (!sel || taskBusy) return;
    setTaskBusy(true); setTaskMsg(null);
    try {
      const t = await api.taskFromDecision(sel.id) as { id?: string; task_id?: string; title?: string };
      const newId = t?.id || t?.task_id;
      if (newId) {
        setTaskMsg({ kind: "ok", text: "Task created from this decision.", taskId: newId });
      } else {
        setTaskMsg({ kind: "err", text: "Task created, but the server did not return its id." });
      }
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) {
        setTaskMsg({ kind: "pending", text: `Approval required (${e.riskLevel}) before this task can be created — approval ${e.approvalId.slice(0, 8)}.` });
      } else if (e?.status === 403) {
        setTaskMsg({ kind: "err", text: "Your role can't create tasks (requires CREATE_TASKS)." });
      } else if (e?.status === 404) {
        setTaskMsg({ kind: "err", text: "Decision not found." });
      } else if (e?.status === 409) {
        setTaskMsg({ kind: "err", text: e?.message || "A task already exists for this decision." });
      } else {
        setTaskMsg({ kind: "err", text: e?.message || "Could not create task." });
      }
    } finally { setTaskBusy(false); }
  };

  // Summary counts — computed purely from already-fetched rows (no new endpoint).
  const norm = (s: string) => (s || "").toLowerCase();
  const awaiting = rows.filter((r) => norm(r.status) === "approved").length;
  const executed = rows.filter((r) => norm(r.status) === "executed").length;
  const pending = rows.filter((r) => ["draft", "pending", "pending_approval"].includes(norm(r.status))).length;
  const highRisk = rows.filter((r) => ["high", "critical"].includes(norm(r.risk_level))).length;
  const loadedQ = done ? undefined : "of loaded so far";

  const isActionable = (status: string) => norm(status) === "approved";

  return (
    <div className="page">
      <PageHero
        icon={DecisionsIcon}
        eyebrow="GOVERNANCE"
        title="Decision Ledger"
        desc="The governed record of every decision the AI Council and founder have made — review each one's reasoning and risk, and mark approved decisions as executed."
        actions={<button className="btn" style={{ width: "auto" }} onClick={reload} disabled={loading}>Refresh</button>}
      />

      {rows.length > 0 && (
        <StatTiles>
          <StatTile label="DECISIONS IN LEDGER" value={rows.length} hint={loadedQ} tone="default" />
          <StatTile label="AWAITING EXECUTION" value={awaiting} hint="approved · ready for you" tone="warn" />
          <StatTile label="EXECUTED" value={executed} hint="recorded in ledger" tone="violet" />
          <StatTile label="DRAFT / PENDING" value={pending} hint="not yet approved" tone="muted" />
          <StatTile label="HIGH / CRITICAL RISK" value={highRisk} hint="governance exposure" tone={highRisk > 0 ? "bad" : "muted"} />
        </StatTiles>
      )}

      <Card title="All decisions" hint={done ? undefined : "paginated"}>
        {loading && !rows.length ? <Loading rows={5} /> : error ? <ErrorState message={error} onRetry={reload} />
          : rows.length ? (
            <>
              <div className="card-list">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="card-row clickable"
                    style={isActionable(r.status) ? { borderLeft: "2px solid var(--accent, #6366f1)" } : undefined}
                    onClick={() => openDetail(r)}
                  >
                    <div className="card-row-main">
                      <div className="card-row-title">{r.title}</div>
                      <div className="card-row-sub">
                        <span className="mono">{new Date(asUTC(r.created_at)).toLocaleString()}</span>
                        {isActionable(r.status) && <span> · awaiting execution</span>}
                      </div>
                    </div>
                    <div className="card-row-meta">
                      <StatusBadge status={r.status} />
                      <RiskBadge risk={r.risk_level} />
                    </div>
                  </div>
                ))}
              </div>
              <LoadMore onClick={loadMore} loading={loading} done={done} />
            </>
          )
          : <Empty
              icon={DecisionsIcon}
              title="No decisions in the ledger yet"
              hint="Decisions are recorded here when the AI Council reaches a conclusion or a governance decision is created. Run a session in AI Council, and approved decisions will appear ready to execute."
              actions={<a className="link" href="/council">Open AI Council →</a>}
            />}
      </Card>

      <DetailDrawer open={open} onClose={closeDrawer} title="Decision detail">
        {dLoading ? <Loading rows={4} /> : dErr ? <ErrorState message={dErr} onRetry={() => { const id = sp.get("open"); if (id) openById(id); }} /> : sel && (
          <div className="kv">
            {/* Header zone: title + status/risk pills */}
            <div className="detail-block">
              <div className="strong" style={{ fontSize: 16, marginBottom: 8 }}>{sel.title}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatusBadge status={sel.status} />
                <RiskBadge risk={sel.risk_level} />
              </div>
            </div>

            {/* Provenance group */}
            <div className="detail-block">
              <SectionLabel>PROVENANCE</SectionLabel>
              <Row k="Created by" v={sel.created_by || "—"} />
              <Row k="Approved by" v={sel.approved_by || "—"} />
              <Row k="Agent run" v={sel.agent_run_id
                ? <span><code className="mono">{String(sel.agent_run_id).slice(0, 8)}</code> <button className="btn btn-ghost" style={{ padding: "0 6px", fontSize: 11 }} title="Copy full id" onClick={() => { void navigator.clipboard?.writeText(String(sel.agent_run_id)); }}>copy</button></span>
                : "—"} />
              {sel.agent_run_id && <div className="muted small" style={{ marginTop: "2px" }}>Agent run detail linking is not available yet.</div>}
            </div>

            {/* Reasoning group */}
            {(sel.summary || sel.decision_text) && (
              <div className="detail-block">
                <SectionLabel>REASONING</SectionLabel>
                {sel.summary && <div className="detail-block" style={{ marginTop: 0 }}><b>Summary</b><p className="muted">{sel.summary}</p></div>}
                {sel.decision_text && <div className="detail-block"><b>Decision</b><p>{sel.decision_text}</p></div>}
              </div>
            )}

            {/* Execution action panel */}
            <div className="detail-block">
              <SectionLabel>EXECUTION</SectionLabel>
              <div className="muted small" style={{ marginBottom: 8 }}>This only marks the decision as executed in the ledger and writes an audit entry. It does not run workflows, tools, or external actions.</div>
              {sel.status === "approved" ? (
                <div style={{ marginTop: "8px" }}>
                  {(sel.risk_level === "high" || sel.risk_level === "critical") && (
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px", marginBottom: "8px" }}>
                      <span className="muted">Approved approval ID (for high/critical only)</span>
                      <input className="filter" style={{ width: "100%" }} value={approvalId} disabled={execBusy}
                        placeholder="Paste approval_id after Approval Gate approval"
                        onChange={(e) => setApprovalId(e.target.value)} />
                      {approvalId.trim() !== "" && !UUID_RE.test(approvalId.trim()) && <span className="bad small">Approval ID must be a valid UUID.</span>}
                    </label>
                  )}
                  {!confirmingExec ? (
                    <button className="btn btn-primary" style={{ width: "auto" }} disabled={execBusy || (approvalId.trim() !== "" && !UUID_RE.test(approvalId.trim()))} onClick={() => setConfirmingExec(true)}>
                      {execBusy ? "Working…" : "Mark as Executed"}
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <span className="small">Mark this approved decision as executed in the ledger?</span>
                      <button className="btn btn-primary" style={{ width: "auto" }} disabled={execBusy} onClick={() => { setConfirmingExec(false); doExecute(); }}>Confirm Mark Executed</button>
                      <button className="btn" style={{ width: "auto" }} disabled={execBusy} onClick={() => setConfirmingExec(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              ) : <div className="muted small" style={{ marginTop: "6px" }}>Marking as executed is available only for approved decisions (current status: {sel.status}).</div>}
              {execMsg && (
                <div className="small" style={{ marginTop: "8px" }}>
                  {execMsg.kind === "ok" && <span className="ok">✓ {execMsg.text}</span>}
                  {execMsg.kind === "err" && <span className="bad">⚠ {execMsg.text}</span>}
                  {execMsg.kind === "pending" && <span className="warn">⏳ {execMsg.text}{execMsg.approvalId ? ` (approval ${execMsg.approvalId.slice(0, 8)})` : ""} — paste it in the field above, then Mark as Executed. <a className="link" href="/approvals">Approval Gate →</a></span>}
                </div>
              )}

              {/* Follow-up: turn this decision into an actionable task */}
              {canCreateTask && (
                <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border, rgba(255,255,255,0.08))" }}>
                  <div className="muted small" style={{ marginBottom: 8 }}>Create a task in the backlog so this decision becomes actionable work. This does not execute anything.</div>
                  <button className="btn" style={{ width: "auto" }} disabled={taskBusy} onClick={doCreateTask}>
                    {taskBusy ? "Creating…" : "Create task from this decision"}
                  </button>
                  {taskMsg && (
                    <div className="small" style={{ marginTop: "8px" }}>
                      {taskMsg.kind === "ok" && (
                        <span className="ok">✓ {taskMsg.text}{taskMsg.taskId ? <> (<code className="mono">{taskMsg.taskId.slice(0, 8)}</code>)</> : null} <a className="link" href="/tasks">View in Tasks →</a></span>
                      )}
                      {taskMsg.kind === "err" && <span className="bad">⚠ {taskMsg.text}</span>}
                      {taskMsg.kind === "pending" && <span className="warn">⏳ {taskMsg.text} <a className="link" href="/approvals">Approval Gate →</a></span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
