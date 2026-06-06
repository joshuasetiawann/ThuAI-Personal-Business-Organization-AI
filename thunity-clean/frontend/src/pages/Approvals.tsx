import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, DataTable, StatusBadge, RiskBadge,
  Loading, ErrorState, Empty, useAsync, type Column } from "../components/ui";
import type { Approval } from "../types";

const canResolveTier = (role: string, risk: string) =>
  role === "founder" || (role === "admin" && (risk === "low" || risk === "medium"));

const histCols: Column<Approval>[] = [
  { key: "requested_action", label: "Action", render: (r) => <span className="strong">{r.requested_action}</span> },
  { key: "risk_level", label: "Risk", render: (r) => <RiskBadge risk={r.risk_level} /> },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "requested_by", label: "Requested by", render: (r) => r.requested_by || "—" },
  { key: "approved_by", label: "Resolved by", render: (r) => r.approved_by || "—" },
  { key: "created_at", label: "Created", render: (r) => <span className="muted small">{new Date(r.created_at).toLocaleString()}</span> },
];

function mapErr(e: any): string {
  if (e?.code === "CONFIRMATION_REQUIRED") return "Confirmation phrase is incorrect or missing.";
  if (e?.status === 403 || e?.code === "FORBIDDEN") return "You don't have permission to resolve this approval.";
  if (e?.status === 409 || e?.code === "ALREADY_RESOLVED") return "Already resolved — refreshing.";
  if (e?.code === "NETWORK") return e?.message || "Backend unreachable.";
  return e?.message || "Action failed.";
}

function PendingRow({ a, canResolve, onResolved }: { a: Approval; canResolve: boolean; onResolved: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const isCritical = a.risk_level === "critical";
  const phraseOk = !isCritical || confirm === (a.confirmation_phrase || "");

  const approve = async () => {
    if (busy || !phraseOk) return;
    setBusy(true); setErr(null);
    try { await api.approveRequest(a.id, isCritical ? confirm : undefined); onResolved(); }
    catch (e: any) { setErr(mapErr(e)); if (e?.status === 409) onResolved(); }
    finally { setBusy(false); }
  };
  const reject = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try { await api.rejectRequest(a.id); onResolved(); }
    catch (e: any) { setErr(mapErr(e)); if (e?.status === 409) onResolved(); }
    finally { setBusy(false); }
  };

  return (
    <div className="result">
      <div className="result-head">
        <span className="strong">{a.requested_action}</span>
        <RiskBadge risk={a.risk_level} />
        <StatusBadge status={a.status} />
        <span className="muted small">{a.requested_by || "—"} · {new Date(a.created_at).toLocaleString()}</span>
      </div>
      {canResolve ? (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginTop: "6px" }}>
          {isCritical && (
            <input className="filter" style={{ width: "260px" }} value={confirm} disabled={busy}
              placeholder={`Type "${a.confirmation_phrase || "APPROVE DELETE"}" to confirm`}
              onChange={(e) => setConfirm(e.target.value)} />
          )}
          <button className="btn btn-primary" style={{ width: "auto" }} disabled={busy || !phraseOk || confirmingReject} onClick={approve}>
            {busy ? "Working…" : "Approve"}
          </button>
          {isCritical ? (
            !confirmingReject ? (
              <button className="btn" style={{ width: "auto" }} disabled={busy} onClick={() => setConfirmingReject(true)}>Reject</button>
            ) : (
              <>
                <span className="small">Reject this CRITICAL approval request?</span>
                <button className="btn btn-primary" style={{ width: "auto" }} disabled={busy} onClick={() => { setConfirmingReject(false); reject(); }}>Confirm Reject</button>
                <button className="btn" style={{ width: "auto" }} disabled={busy} onClick={() => setConfirmingReject(false)}>Cancel</button>
              </>
            )
          ) : (
            <button className="btn" style={{ width: "auto" }} disabled={busy} onClick={reject}>Reject</button>
          )}
        </div>
      ) : (
        <div className="muted small" style={{ marginTop: "6px" }}>You do not have permission to resolve this approval.</div>
      )}
      {err && <div className="bad small" style={{ marginTop: "6px" }}>⚠ {err}</div>}
    </div>
  );
}

export default function Approvals() {
  const { user } = useAuth();
  const role = user?.role || "";
  const pending = useAsync<{ pending: Approval[] }>(() => api.approvalsPending() as Promise<{ pending: Approval[] }>);
  const history = useAsync<{ approvals: Approval[] }>(() => api.approvals(100, 0) as Promise<{ approvals: Approval[] }>);
  const refresh = () => { pending.reload(); history.reload(); };

  return (
    <div className="page">
      <PageHeader title="Approval Gate"
        subtitle="Review and resolve the governance queue. Resolving updates the request only — it does not execute the underlying action." />
      <div className="note">Approving or rejecting only updates the approval request status. It does NOT execute the underlying action. Execution must be invoked separately after approval.</div>
      <div className="muted small" style={{ marginBottom: "14px" }}>Founders may resolve any tier; admins may resolve low/medium. Critical approvals require typing the confirmation phrase.</div>

      <details className="card" style={{ marginBottom: "16px" }}>
        <summary style={{ cursor: "pointer", padding: "14px 16px", fontWeight: 600 }}>How approval requests are created</summary>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <ul className="bullets">
            <li>Approval requests are created <b>automatically</b> when a gated high-risk action is attempted.</li>
            <li>Examples:
              <ul className="bullets">
                <li>Marking a high/critical decision as executed without an approved approval_id.</li>
                <li>Future high-risk workflow / tool actions.</li>
              </ul>
            </li>
            <li>Resolving an approval only updates its status — it does <b>not</b> execute the underlying action.</li>
            <li>After approval, the original action must be invoked again with the approved approval_id.</li>
            <li>If this queue is empty, no gated request has been created yet.</li>
          </ul>
        </div>
      </details>

      <Card title="Pending" hint="/api/approvals/pending">
        {pending.loading ? <Loading /> : pending.error ? <ErrorState message={pending.error} />
          : pending.data?.pending?.length
            ? <div className="results">{pending.data.pending.map((a) => (
                <PendingRow key={a.id} a={a} canResolve={canResolveTier(role, a.risk_level)} onResolved={refresh} />
              ))}</div>
            : <Empty label="No pending approvals." />}
      </Card>

      <div className="mt" />
      <Card title="History" hint="/api/approvals">
        {history.loading ? <Loading /> : history.error ? <ErrorState message={history.error} />
          : history.data?.approvals?.length
            ? <DataTable columns={histCols} rows={history.data.approvals} rowKey={(r) => r.id} />
            : <Empty label="No approval history yet." />}
      </Card>
    </div>
  );
}
