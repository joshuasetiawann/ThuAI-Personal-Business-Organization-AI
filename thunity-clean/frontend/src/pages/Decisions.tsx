import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApprovalRequiredError } from "../api/client";
import { PageHeader, Card, DataTable, StatusBadge, RiskBadge, DetailDrawer, LoadMore,
  Loading, ErrorState, Empty, Row, usePaged, type Column } from "../components/ui";
import type { DecisionBrief, DecisionDetail } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Decisions() {
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

  const [sp, setSp] = useSearchParams();
  const openById = useCallback((id: string) => {
    setOpen(true); setSel(null); setDErr(null); setDLoading(true); setExecMsg(null); setApprovalId(""); setConfirmingExec(false);
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

  const cols: Column<DecisionBrief>[] = [
    { key: "title", label: "Title", render: (r) => <span className="strong">{r.title}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "risk_level", label: "Risk", render: (r) => <RiskBadge risk={r.risk_level} /> },
    { key: "created_at", label: "Created", render: (r) => <span className="muted small">{new Date(r.created_at).toLocaleString()}</span> },
  ];

  return (
    <div className="page">
      <PageHeader title="Decision Ledger" subtitle="Read-only. Approve / reject / execute run through the approval flow (later sprint)." />
      <Card title="Decisions" hint="/api/decisions">
        {loading && !rows.length ? <Loading /> : error ? <ErrorState message={error} />
          : rows.length ? <><DataTable columns={cols} rows={rows} rowKey={(r) => r.id} onRow={openDetail} />
              <LoadMore onClick={loadMore} loading={loading} done={done} /></>
          : <Empty label="No decisions yet." />}
      </Card>
      <DetailDrawer open={open} onClose={closeDrawer} title="Decision detail">
        {dLoading ? <Loading /> : dErr ? <ErrorState message={dErr} /> : sel && (
          <div className="kv">
            <Row k="Title" v={sel.title} />
            <Row k="Status" v={<StatusBadge status={sel.status} />} />
            <Row k="Risk" v={<RiskBadge risk={sel.risk_level} />} />
            <Row k="Created by" v={sel.created_by || "—"} />
            <Row k="Approved by" v={sel.approved_by || "—"} />
            <Row k="Agent run" v={sel.agent_run_id
              ? <span><code className="mono">{String(sel.agent_run_id).slice(0, 8)}</code> <button className="btn btn-ghost" style={{ padding: "0 6px", fontSize: 11 }} title="Copy full id" onClick={() => { void navigator.clipboard?.writeText(String(sel.agent_run_id)); }}>copy</button></span>
              : "—"} />
            {sel.agent_run_id && <div className="muted small" style={{ marginTop: "2px" }}>Agent run detail linking is not available yet.</div>}
            {sel.summary && <div className="detail-block"><b>Summary</b><p className="muted">{sel.summary}</p></div>}
            {sel.decision_text && <div className="detail-block"><b>Decision</b><p>{sel.decision_text}</p></div>}
            <div className="detail-block">
              <div className="muted small">This only marks the decision as executed in the ledger and writes an audit entry. It does not run workflows, tools, or external actions.</div>
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
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
