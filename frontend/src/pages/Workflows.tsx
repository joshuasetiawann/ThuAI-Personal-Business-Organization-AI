import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApprovalRequiredError } from "../api/client";
import { asUTC } from "../utils/time";
import { PageHero, StatTiles, StatTile, SectionLabel, RiskBadge, StatusBadge,
  Loading, ErrorState, Empty, useAsync } from "../components/ui";
import type { WorkflowAllowed, WorkflowRun, WorkflowTriggerResponse } from "../types";

const WF_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="12" cy="18" r="2.2" />
    <path d="M6 8.2v3a2 2 0 0 0 2 2h2M18 8.2v3a2 2 0 0 1-2 2h-2" />
  </svg>
);

// Native workflows that produce a report viewable on the Reports page.
const REPORT_WORKFLOWS = new Set(["generate_local_report", "create_daily_brief"]);
const producesReport = (r: WorkflowRun) =>
  String(r.status || "").toLowerCase() === "completed" &&
  REPORT_WORKFLOWS.has(String(r.workflow_name || ""));

function relativeTime(iso: string): string {
  const t = new Date(asUTC(iso)).getTime();
  if (isNaN(t)) return "—";
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function WorkflowRow({ w, onRan }: { w: WorkflowAllowed; onRan: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const risk = String(w.risk || "").toLowerCase();
  const highRisk = risk === "high" || risk === "critical";

  const run = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api.triggerWorkflow(w.name) as WorkflowTriggerResponse;
      if (r?.run_id) {
        const kind = r.status === "completed" ? "ok" : r.status === "failed" ? "err" : "warn";
        setMsg({ kind, text: `Run ${r.run_id.slice(0, 8)} — status: ${r.status}` });
        onRan();
      } else setMsg({ kind: "err", text: "Unexpected response from server." });
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) setMsg({ kind: "warn", text: `Approval required (${e.riskLevel}) — not triggered here.` });
      else if (e?.status === 403 || e?.code === "FORBIDDEN" || e?.code === "WORKFLOW_NOT_ALLOWED" || e?.code === "APPROVAL_REQUIRED")
        setMsg({ kind: "err", text: e?.message || "Not permitted." });
      else setMsg({ kind: "err", text: e?.message || "Trigger failed." });
    } finally { setBusy(false); }
  };

  return (
    <div className="card-row">
      <div className="card-row-main">
        <div className="card-row-title mono">{w.name}</div>
        <div className="card-row-sub">
          {highRisk
            ? "Approval-gated — high-risk runs require founder approval via the Approval Gate"
            : <>requires: {w.required_permission}</>}
        </div>
      </div>
      <div className="card-row-meta" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
        {msg && <span className={"small " + (msg.kind === "ok" ? "ok" : msg.kind === "warn" ? "warn" : "bad")}>
          {msg.kind === "ok" ? "✓ " : msg.kind === "warn" ? "⏳ " : "⚠ "}{msg.text}
        </span>}
        <RiskBadge risk={w.risk} />
        {highRisk
          ? <StatusBadge status="approval-gated" />
          : <button className="btn btn-primary" style={{ width: "auto" }} disabled={busy} onClick={run}>
              {busy ? "Triggering…" : "Trigger"}
            </button>}
      </div>
    </div>
  );
}

export default function Workflows() {
  const allowed = useAsync<{ allowed_workflows: WorkflowAllowed[] }>(() => api.allowedWorkflows() as Promise<{ allowed_workflows: WorkflowAllowed[] }>);
  const runs = useAsync<{ runs: WorkflowRun[] }>(() => api.workflowRuns() as Promise<{ runs: WorkflowRun[] }>);

  const wf = allowed.data?.allowed_workflows ?? [];
  const isGated = (w: WorkflowAllowed) => {
    const r = String(w.risk || "").toLowerCase();
    return r === "high" || r === "critical";
  };
  const runnable = wf.filter((w) => !isGated(w)).length;
  const gated = wf.filter(isGated).length;

  const runList = runs.data?.runs ?? [];
  const statusCount = (s: string) => runList.filter((r) => String(r.status || "").toLowerCase() === s).length;
  const completed = statusCount("completed");
  const failed = statusCount("failed");
  const running = statusCount("running");
  const runsBreakdown = runList.length
    ? `${completed} completed · ${failed} failed · ${running} running`
    : "no runs yet";

  // Newest-first, without mutating the fetched array.
  const sortedRuns = [...runList].sort((a, b) =>
    new Date(asUTC(b.created_at)).getTime() - new Date(asUTC(a.created_at)).getTime());

  const statsLoading = allowed.loading || runs.loading;

  return (
    <div className="page">
      <PageHero
        icon={WF_ICON}
        eyebrow="GOVERNANCE"
        title="Workflow Engine"
        desc="Run your allow-listed local automations and watch every run's real status. High-risk workflows stay approval-gated, and results are always shown verbatim — never as fake success, and no free-form workflow names."
      />

      {statsLoading ? (
        <StatTiles>
          <StatTile label="ALLOWED WORKFLOWS" value="—" tone="accent" />
          <StatTile label="RUNNABLE HERE" value="—" tone="violet" />
          <StatTile label="APPROVAL-GATED" value="—" tone="warn" />
          <StatTile label="RECENT RUNS" value="—" tone="muted" />
        </StatTiles>
      ) : (
        <StatTiles>
          <StatTile label="ALLOWED WORKFLOWS" value={wf.length} hint="explicitly allow-listed on the backend" tone="accent" icon={WF_ICON} />
          <StatTile label="RUNNABLE HERE" value={runnable} hint="have a live Trigger button" tone="violet" />
          <StatTile label="APPROVAL-GATED" value={gated} hint="route to the Approval Gate" tone="warn" />
          <StatTile label="RECENT RUNS" value={runList.length} hint={runsBreakdown} tone="muted" />
        </StatTiles>
      )}

      <SectionLabel>ALLOWED WORKFLOWS</SectionLabel>
      {allowed.loading ? <Loading rows={4} /> : allowed.error ? <ErrorState message={allowed.error} onRetry={allowed.reload} />
        : wf.length
          ? <div className="card-list">{wf.map((w) => <WorkflowRow key={w.name} w={w} onRan={runs.reload} />)}</div>
          : <Empty icon={WF_ICON} title="No workflows are allow-listed yet"
              hint="Workflows must be explicitly allow-listed on the backend before they can run from here — once one is registered it will appear in this list, ready to trigger." />}

      <SectionLabel>RECENT RUNS</SectionLabel>
      {runs.loading ? <Loading rows={4} /> : runs.error ? <ErrorState message={runs.error} onRetry={runs.reload} />
        : sortedRuns.length
          ? <div className="card-list">
              {sortedRuns.map((r) => (
                <div className="card-row" key={r.id}>
                  <div className="card-row-main">
                    <div className="card-row-title mono">{r.workflow_name}</div>
                    <div className="card-row-sub" title={new Date(asUTC(r.created_at)).toLocaleString()}>{relativeTime(r.created_at)}</div>
                  </div>
                  <div className="card-row-meta">
                    {producesReport(r) && (
                      <Link to="/reports" className="small accent" style={{ textDecoration: "none" }}>
                        View report →
                      </Link>
                    )}
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          : <Empty icon={WF_ICON} title="No runs yet"
              hint="Trigger an allow-listed workflow above and its run — with its real, verbatim status — will show up here." />}
    </div>
  );
}
