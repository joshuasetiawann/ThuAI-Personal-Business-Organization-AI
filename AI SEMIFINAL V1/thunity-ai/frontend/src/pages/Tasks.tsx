import { useState } from "react";
import { api } from "../api/client";
import { PageHeader, Card, DataTable, StatusBadge, RiskBadge, DetailDrawer, LoadMore,
  Loading, ErrorState, Empty, Row, Badge, usePaged, type Column } from "../components/ui";
import type { TaskBrief, TaskDetail } from "../types";

const STATUSES = ["", "backlog", "todo", "doing", "blocked", "review", "done", "cancelled"];

export default function Tasks() {
  const [status, setStatus] = useState("");
  const { rows, loading, error, done, loadMore } = usePaged<TaskBrief>(
    (l, o) => api.tasks({ status: status || undefined, limit: l, offset: o }).then((r: any) => r.tasks || []),
    100, [status]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<TaskDetail | null>(null);
  const [dLoading, setDLoading] = useState(false);
  const [dErr, setDErr] = useState<string | null>(null);

  const openDetail = (t: TaskBrief) => {
    setOpen(true); setSel(null); setDErr(null); setDLoading(true);
    api.task(t.id).then((x: any) => setSel(x)).catch((e) => setDErr(e?.message || "Failed")).finally(() => setDLoading(false));
  };

  const cols: Column<TaskBrief>[] = [
    { key: "title", label: "Title", render: (r) => <span className="strong">{r.title}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "priority", label: "Priority", render: (r) => <span className="muted">{r.priority}</span> },
    { key: "owner", label: "Owner", render: (r) => r.owner || "—" },
    { key: "risk_level", label: "Risk", render: (r) => <RiskBadge risk={r.risk_level} /> },
    { key: "due_date", label: "Due", render: (r) => r.overdue ? <Badge tone="bad">overdue</Badge> : (r.due_date ? new Date(r.due_date).toLocaleDateString() : "—") },
  ];

  return (
    <div className="page">
      <PageHeader title="Mission Board" subtitle="Read-only. Creating tasks and changing status arrive in a later sprint." />
      <div className="filter-row">
        {STATUSES.map((s) => (
          <button key={s || "all"} className={"chip" + (status === s ? " active" : "")} onClick={() => setStatus(s)}>{s || "all"}</button>
        ))}
      </div>
      <Card title="Tasks" hint="/api/tasks">
        {loading && !rows.length ? <Loading /> : error ? <ErrorState message={error} />
          : rows.length ? <><DataTable columns={cols} rows={rows} rowKey={(r) => r.id} onRow={openDetail} />
              <LoadMore onClick={loadMore} loading={loading} done={done} /></>
          : <Empty label="No tasks here yet." />}
      </Card>
      <DetailDrawer open={open} onClose={() => setOpen(false)} title="Task detail">
        {dLoading ? <Loading /> : dErr ? <ErrorState message={dErr} /> : sel && (
          <div className="kv">
            <Row k="Title" v={sel.title} />
            <Row k="Status" v={<StatusBadge status={sel.status} />} />
            <Row k="Priority" v={sel.priority} />
            <Row k="Owner" v={sel.owner || "—"} />
            <Row k="Risk" v={<RiskBadge risk={sel.risk_level} />} />
            <Row k="Due" v={sel.due_date ? new Date(sel.due_date).toLocaleDateString() : "—"} />
            <Row k="From decision" v={sel.source_decision_id ? <code className="mono">{String(sel.source_decision_id).slice(0, 8)}</code> : "—"} />
            {sel.description && <div className="detail-block"><b>Description</b><p>{sel.description}</p></div>}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
