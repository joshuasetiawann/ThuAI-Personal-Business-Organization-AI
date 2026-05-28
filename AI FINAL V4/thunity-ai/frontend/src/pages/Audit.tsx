import { useState } from "react";
import { api } from "../api/client";
import { Card, Loading, ErrorState, Empty, useAsync } from "../components/ui";
import type { AuditEntry } from "../types";

const ENTITY_LINK: Record<string, string> = {
  decision: "/decisions?open=", decisions: "/decisions?open=",
  task: "/tasks?open=", tasks: "/tasks?open=",
  approval: "/approvals?focus=", approvals: "/approvals?focus=",
  workflow: "/workflows?open=", workflow_run: "/workflows?open=", workflows: "/workflows?open=",
  conversation: "/conversations?open=", conversations: "/conversations?open=",
};

function CopyId({ value }: { value: string }) {
  return <button className="btn btn-ghost" style={{ padding: "0 6px", fontSize: 11 }}
    title="Copy full id" onClick={() => { void navigator.clipboard?.writeText(value); }}>copy</button>;
}

function EntityCell({ type, id }: { type: string | null; id: string | null }) {
  if (!type) return <span className="muted small">—</span>;
  const t = type.toLowerCase();
  if (!id) return <span className="muted small">{type}</span>;
  const short = `${type} · ${String(id).slice(0, 8)}`;
  if (t === "agent_run" || t === "agent_runs")
    return <span className="muted small">{short} <CopyId value={id} /></span>;
  const base = ENTITY_LINK[t];
  if (base) return <a className="link small" href={`${base}${encodeURIComponent(id)}`}>{short}</a>;
  return <span className="muted small">{short}</span>;
}

export default function Audit() {
  const a = useAsync<{ audit: AuditEntry[] }>(() => api.audit(100) as Promise<{ audit: AuditEntry[] }>);
  const [q, setQ] = useState("");
  const rows = (a.data?.audit || []).filter((r) =>
    !q || r.action.includes(q) || (r.actor || "").includes(q) || (r.entity_type || "").includes(q));

  return (
    <div className="page">
      <div className="page-head"><h1>Audit Trail</h1>
        <p className="muted">Append-only record of sensitive actions. Cannot be edited or deleted via the UI.</p></div>
      <Card title="Recent events" hint="/api/audit?limit=100"
        actions={<input className="filter" placeholder="filter action / actor…" value={q} onChange={(e) => setQ(e.target.value)} />}>
        {a.loading ? <Loading /> : a.error ? <ErrorState message={a.error} />
          : rows.length ? (
            <table className="table">
              <thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Entity</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td className="muted small">{new Date(r.created_at).toLocaleString()}</td>
                  <td><span className="feed-action">{r.action}</span></td>
                  <td>{r.actor || "system"}{r.actor_role ? <span className="muted small"> · {r.actor_role}</span> : ""}</td>
                  <td><EntityCell type={r.entity_type} id={r.entity_id} /></td>
                </tr>))}</tbody>
            </table>
          ) : <Empty label="No matching audit events." />}
      </Card>
    </div>
  );
}
