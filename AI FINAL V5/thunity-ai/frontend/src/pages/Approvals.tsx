import { useState } from "react";
import { api } from "../api/client";
import { asUTC } from "../utils/time";
import { useAuth } from "../auth/AuthContext";
import { Card, StatusBadge, RiskBadge, StatTiles, StatTile, PageHero,
  SectionLabel, Loading, ErrorState, Empty, useAsync } from "../components/ui";
import type { Approval } from "../types";

const canResolveTier = (role: string, risk: string) =>
  role === "founder" || (role === "admin" && (risk === "low" || risk === "medium"));

// Risk drives the left-accent of each pending card — reuse the kit's risk tone
// language (blue→indigo→violet only, no new colors).
const RISK_ACCENT: Record<string, string> = {
  low: "var(--muted)",
  medium: "rgb(var(--aurora-blue))",
  high: "rgb(var(--aurora-purple))",
  critical: "rgb(var(--aurora-purple))",
};
const accentFor = (risk: string) => RISK_ACCENT[(risk || "").toLowerCase()] ?? "var(--muted)";

const HERO_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z" /><path d="M9 11.5l2 2 4-4" />
  </svg>
);

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
    <div className="card-row" style={{
      flexDirection: "column", alignItems: "stretch", gap: "12px",
      borderLeft: `3px solid ${accentFor(a.risk_level)}`, padding: "15px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        <div className="card-row-main">
          <div className="card-row-title" style={{ whiteSpace: "normal" }}>{a.requested_action}</div>
          <div className="card-row-sub" style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap", marginTop: "5px" }}>
            <StatusBadge status={a.status} />
            <span>Requested by {a.requested_by || "—"} · {new Date(asUTC(a.created_at)).toLocaleString()}</span>
          </div>
        </div>
        <div className="card-row-meta"><RiskBadge risk={a.risk_level} /></div>
      </div>

      {canResolve ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {isCritical && (
            <div style={{
              border: "1px solid rgba(var(--aurora-purple),0.40)", borderRadius: "10px",
              padding: "12px 13px", background: "rgba(var(--aurora-purple),0.06)",
              display: "flex", flexDirection: "column", gap: "9px",
            }}>
              <div className="small" style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.3 3.9 1.8 18a1.8 1.8 0 0 0 1.5 2.7h17.4A1.8 1.8 0 0 0 22.2 18L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
                  <path d="M12 9v4" /><path d="M12 17h.01" />
                </svg>
                This action is irreversible — type the confirmation phrase to approve.
              </div>
              <input className="filter" style={{ width: "100%", maxWidth: "320px" }} value={confirm} disabled={busy}
                placeholder={`Type "${a.confirmation_phrase || "APPROVE DELETE"}" to confirm`}
                onChange={(e) => setConfirm(e.target.value)} />
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
            {isCritical ? (
              !confirmingReject ? (
                <>
                  <button className="btn" style={{ width: "auto" }} disabled={busy} onClick={() => setConfirmingReject(true)}>Reject</button>
                  <button className="btn btn-primary" style={{ width: "auto" }} disabled={busy || !phraseOk} onClick={approve}>
                    {busy ? "Working…" : "Approve"}
                  </button>
                </>
              ) : (
                <>
                  <span className="small" style={{ marginRight: "auto" }}>Reject this CRITICAL approval request?</span>
                  <button className="btn" style={{ width: "auto" }} disabled={busy} onClick={() => setConfirmingReject(false)}>Cancel</button>
                  <button className="btn btn-primary" style={{ width: "auto" }} disabled={busy} onClick={() => { setConfirmingReject(false); reject(); }}>Confirm Reject</button>
                </>
              )
            ) : (
              <>
                <button className="btn" style={{ width: "auto" }} disabled={busy} onClick={reject}>Reject</button>
                <button className="btn btn-primary" style={{ width: "auto" }} disabled={busy || !phraseOk} onClick={approve}>
                  {busy ? "Working…" : "Approve"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="muted small" style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Founder approval required — you can review but not resolve this {a.risk_level} request.
        </div>
      )}
      {err && <div className="bad small" style={{ marginTop: "2px" }}>⚠ {err}</div>}
    </div>
  );
}

function HistoryRow({ a }: { a: Approval }) {
  return (
    <div className="card-row" style={{ borderLeft: `3px solid ${accentFor(a.risk_level)}` }}>
      <div className="card-row-main">
        <div className="card-row-title">{a.requested_action}</div>
        <div className="card-row-sub">
          Requested by {a.requested_by || "—"} · Resolved by {a.approved_by || "—"} · {new Date(asUTC(a.created_at)).toLocaleString()}
        </div>
      </div>
      <div className="card-row-meta">
        <RiskBadge risk={a.risk_level} />
        <StatusBadge status={a.status} />
      </div>
    </div>
  );
}

export default function Approvals() {
  const { user } = useAuth();
  const role = user?.role || "";
  const pending = useAsync<{ pending: Approval[] }>(() => api.approvalsPending() as Promise<{ pending: Approval[] }>);
  const history = useAsync<{ approvals: Approval[] }>(() => api.approvals(100, 0) as Promise<{ approvals: Approval[] }>);
  const refresh = () => { pending.reload(); history.reload(); };

  // All stat-tile values derive strictly from already-fetched data (honest 0 when empty).
  const pendingItems = pending.data?.pending ?? [];
  const pendingCount = pendingItems.length;
  const awaitingYou = pendingItems.filter((a) => canResolveTier(role, a.risk_level)).length;
  const criticalPending = pendingItems.filter((a) => a.risk_level === "critical").length;
  const historyItems = history.data?.approvals ?? [];
  const approvedCount = historyItems.filter((a) => a.status === "approved").length;
  const rejectedCount = historyItems.filter((a) => a.status === "rejected").length;

  return (
    <div className="page">
      <PageHero
        icon={HERO_ICON}
        eyebrow="GOVERNANCE"
        title="Approval Gate"
        desc="Review and resolve the high-risk actions the system has held back. Approving or rejecting only changes a request's status — it never executes the underlying action."
        actions={
          <button className="btn" style={{ width: "auto" }} onClick={refresh}>Refresh</button>
        }
      />

      <StatTiles>
        <StatTile label="PENDING" value={pendingCount} hint="awaiting a decision"
          tone={pendingCount > 0 ? "warn" : "muted"} />
        <StatTile label="AWAITING YOU" value={awaitingYou} hint="you can resolve now"
          tone={awaitingYou > 0 ? "accent" : "muted"} />
        <StatTile label="CRITICAL PENDING" value={criticalPending} hint="irreversible · needs phrase"
          tone={criticalPending > 0 ? "bad" : "muted"} />
        <StatTile label="RESOLVED"
          value={historyItems.length}
          hint={`${approvedCount} approved · ${rejectedCount} rejected`}
          tone="violet" />
      </StatTiles>

      <details className="card" style={{ marginBottom: "16px" }}>
        <summary style={{ cursor: "pointer", padding: "14px 16px", fontWeight: 600 }}>How does the approval gate work?</summary>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <ul className="bullets">
            <li>Requests are created <b>automatically</b> when a gated high-risk action is attempted (e.g. marking a high/critical decision as executed without an approved approval_id).</li>
            <li>Resolving an approval only updates its status — it does <b>not</b> execute the underlying action. After approval, the original action must be invoked again with the approved approval_id.</li>
            <li><b>Who can resolve:</b> founders may resolve any tier; admins may resolve low/medium. Critical approvals require typing the exact confirmation phrase.</li>
            <li>If this queue is empty, no gated request has been created yet.</li>
          </ul>
        </div>
      </details>

      <SectionLabel>PENDING QUEUE</SectionLabel>
      <Card title="Pending" hint="/api/approvals/pending">
        {pending.loading ? <Loading rows={4} /> : pending.error ? <ErrorState message={pending.error} onRetry={pending.reload} />
          : pendingCount
            ? <div className="card-list">{pendingItems.map((a) => (
                <PendingRow key={a.id} a={a} canResolve={canResolveTier(role, a.risk_level)} onResolved={refresh} />
              ))}</div>
            : <Empty icon={HERO_ICON} title="Queue clear — nothing awaiting approval"
                hint="Requests appear here automatically when the system holds back a gated high-risk action (e.g. executing a high/critical decision). Nothing is currently waiting on you." />}
      </Card>

      <div className="mt" />
      <SectionLabel>DECISION HISTORY</SectionLabel>
      <Card title="History" hint="/api/approvals">
        {history.loading ? <Loading rows={5} /> : history.error ? <ErrorState message={history.error} onRetry={history.reload} />
          : historyItems.length
            ? <div className="card-list">{historyItems.map((a) => <HistoryRow key={a.id} a={a} />)}</div>
            : <Empty
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>}
                title="No decisions recorded yet"
                hint="Once you approve or reject a request, it is logged here as a permanent governance record — approving or rejecting only updates status, it never executes the action." />}
      </Card>
    </div>
  );
}
