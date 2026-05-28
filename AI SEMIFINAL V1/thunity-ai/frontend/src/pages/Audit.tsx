import { useState } from "react";
import { api } from "../api/client";
import { Card, Loading, ErrorState, Empty, useAsync } from "../components/ui";
import type { AuditEntry } from "../types";

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
                  <td className="muted small">{r.entity_type || "—"}{r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ""}</td>
                </tr>))}</tbody>
            </table>
          ) : <Empty label="No matching audit events." />}
      </Card>
    </div>
  );
}
