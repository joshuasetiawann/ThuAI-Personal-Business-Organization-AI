import { useState } from "react";
import { api, ApprovalRequiredError } from "../api/client";
import { PageHeader, Card, DataTable, RiskBadge, StatusBadge,
  Loading, ErrorState, Empty, useAsync, type Column } from "../components/ui";
import type { WorkflowAllowed, WorkflowRun, WorkflowTriggerResponse } from "../types";

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
    <div className="result">
      <div className="result-head">
        <span className="mono">{w.name}</span>
        <RiskBadge risk={w.risk} />
        <span className="muted small">{w.required_permission}</span>
      </div>
      {highRisk ? (
        <div className="muted small" style={{ marginTop: "6px" }}>
          High-risk workflow trigger is approval-gated and disabled in this UI. Use the Approval Gate flow in a later sprint.
        </div>
      ) : (
        <div style={{ marginTop: "6px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" style={{ width: "auto" }} disabled={busy} onClick={run}>
            {busy ? "Triggering…" : "Trigger"}
          </button>
          {msg && <span className={"small " + (msg.kind === "ok" ? "ok" : msg.kind === "warn" ? "warn" : "bad")}>
            {msg.kind === "ok" ? "✓ " : msg.kind === "warn" ? "⏳ " : "⚠ "}{msg.text}
          </span>}
        </div>
      )}
    </div>
  );
}

const runCols: Column<WorkflowRun>[] = [
  { key: "workflow_name", label: "Workflow", render: (r) => <span className="mono">{r.workflow_name}</span> },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "created_at", label: "When", render: (r) => <span className="muted small">{new Date(r.created_at).toLocaleString()}</span> },
];

export default function Workflows() {
  const allowed = useAsync<{ allowed_workflows: WorkflowAllowed[] }>(() => api.allowedWorkflows() as Promise<{ allowed_workflows: WorkflowAllowed[] }>);
  const runs = useAsync<{ runs: WorkflowRun[] }>(() => api.workflowRuns() as Promise<{ runs: WorkflowRun[] }>);

  return (
    <div className="page">
      <PageHeader title="Workflow Engine"
        subtitle="Allow-listed local workflows only. High-risk workflows are approval-gated and not triggerable from this view." />
      <div className="note">Triggering runs an allow-listed local n8n workflow. Status is shown verbatim (running / skipped / completed / failed) — never as fake success. No free-form workflow names.</div>

      <Card title="Allowed workflows" hint="/api/workflows/allowed">
        {allowed.loading ? <Loading /> : allowed.error ? <ErrorState message={allowed.error} />
          : allowed.data?.allowed_workflows?.length
            ? <div className="results">{allowed.data.allowed_workflows.map((w) => <WorkflowRow key={w.name} w={w} onRan={runs.reload} />)}</div>
            : <Empty label="No allow-listed workflows." />}
      </Card>

      <div className="mt" />
      <Card title="Recent runs" hint="/api/workflows/runs">
        {runs.loading ? <Loading /> : runs.error ? <ErrorState message={runs.error} />
          : runs.data?.runs?.length
            ? <DataTable columns={runCols} rows={runs.data.runs} rowKey={(r) => r.id} />
            : <Empty label="No workflow runs yet." />}
      </Card>
    </div>
  );
}
