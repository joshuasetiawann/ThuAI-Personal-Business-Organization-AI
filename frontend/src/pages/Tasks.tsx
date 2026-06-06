import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApprovalRequiredError } from "../api/client";
import { asUTC } from "../utils/time";
import { useAuth } from "../auth/AuthContext";
import { PageHero, StatTiles, StatTile, SectionLabel, StatusBadge, RiskBadge, DetailDrawer,
  LoadMore, Loading, ErrorState, Empty, Row, Badge, usePaged } from "../components/ui";
import type { TaskBrief, TaskDetail } from "../types";

const TASKS_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h12M4 12h12M4 18h8" /><path d="M19 5l1.4 1.4L19 8" />
  </svg>
);

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "doing", label: "Doing" },
  { value: "blocked", label: "Blocked" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_LABEL = (s: string) =>
  STATUS_FILTERS.find((f) => f.value === s)?.label?.toLowerCase() || s;

// The 7 mutable statuses (filters minus the "All" entry) — used by the drawer control.
const STATUSES = STATUS_FILTERS.filter((f) => f.value);

export default function Tasks() {
  const { user } = useAuth();
  const perms = (user?.permissions || []).map((x) => String(x).toLowerCase());
  const role = String(user?.role || "").toLowerCase();
  const canManageTasks =
    role === "founder" || role === "admin" ||
    perms.includes("all") || perms.includes("create_tasks") || perms.includes("manage_tasks");

  const [status, setStatus] = useState("");
  const { rows, loading, error, done, loadMore, reload } = usePaged<TaskBrief>(
    (l, o) => api.tasks({ status: status || undefined, limit: l, offset: o }).then((r: any) => r.tasks || []),
    100, [status]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<TaskDetail | null>(null);
  const [dLoading, setDLoading] = useState(false);
  const [dErr, setDErr] = useState<string | null>(null);

  // Status-change control state (founder/admin/manage_tasks only).
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const changeStatus = async (next: string) => {
    if (!sel || saving || next === sel.status) return;
    setSaving(true); setStatusMsg(null);
    try {
      await api.patchTask(sel.id, { status: next });
      // Reflect truth: update the open task, then reload the board.
      setSel((prev) => (prev ? { ...prev, status: next } : prev));
      setStatusMsg({ tone: "ok", text: `Status updated to "${STATUS_LABEL(next)}".` });
      reload();
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) {
        setStatusMsg({
          tone: "bad",
          text: `This status change requires founder approval${e.approvalId ? ` (approval ${String(e.approvalId).slice(0, 8)})` : ""}.`,
        });
      } else {
        setStatusMsg({ tone: "bad", text: e?.message || "Failed to update status." });
      }
    } finally {
      setSaving(false);
    }
  };

  const [sp, setSp] = useSearchParams();
  const openById = useCallback((id: string) => {
    setOpen(true); setSel(null); setDErr(null); setDLoading(true); setStatusMsg(null);
    api.task(id).then((x: any) => setSel(x)).catch((e) => setDErr(e?.message || "Failed")).finally(() => setDLoading(false));
  }, []);
  const openDetail = (t: TaskBrief) => setSp({ open: t.id });
  const closeDrawer = () => setSp({});
  useEffect(() => { const id = sp.get("open"); if (id) openById(id); else setOpen(false); }, [sp, openById]);

  // Counts derived from already-loaded rows (honest: counts the loaded board only).
  const counts = useMemo(() => {
    let overdue = 0, blocked = 0, motion = 0, done = 0;
    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (r.overdue) overdue++;
      if (r.status === "blocked") blocked++;
      if (r.status === "doing" || r.status === "review") motion++;
      if (r.status === "done") done++;
    }
    return { total: rows.length, overdue, blocked, motion, done, byStatus };
  }, [rows]);

  // Board feel without new state: surface overdue → blocked → everything else.
  const sortRank = (r: TaskBrief) => (r.overdue ? 0 : r.status === "blocked" ? 1 : 2);
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => sortRank(a) - sortRank(b)),
    [rows]);

  return (
    <div className="page">
      <PageHero
        icon={TASKS_ICON}
        eyebrow="EXECUTION"
        title="Mission Board"
        desc={<>
          Every task the AI Council spun out of an approved decision lives here — track what's in
          motion, what's blocked, and what's overdue across the whole company in one board.
          <span style={{ display: "inline-block", marginTop: 8 }}>
            {canManageTasks
              ? <Badge tone="ok">Live · move a task's status from its detail drawer</Badge>
              : <Badge tone="muted">Read-only · ask a founder/admin to change task status</Badge>}
          </span>
        </>}
      />

      <StatTiles>
        <StatTile label="LOADED" value={counts.total} hint="tasks on the board" tone="default" />
        <StatTile label="OVERDUE" value={counts.overdue} hint="past their due date" tone="bad" />
        <StatTile label="BLOCKED" value={counts.blocked} hint="waiting on something" tone="warn" />
        <StatTile label="IN MOTION" value={counts.motion} hint="doing or in review" tone="accent" />
        <StatTile label="DONE" value={counts.done} hint="completed" tone="muted" />
      </StatTiles>

      <div className="filter-row">
        {STATUS_FILTERS.map((f) => {
          const n = f.value ? counts.byStatus[f.value] : counts.total;
          return (
            <button key={f.value || "all"} className={"chip" + (status === f.value ? " active" : "")}
              onClick={() => setStatus(f.value)}>
              {f.label}{n ? ` · ${n}` : ""}
            </button>
          );
        })}
      </div>

      <SectionLabel>MISSIONS</SectionLabel>
      {loading && !rows.length ? <Loading rows={6} />
        : error ? <ErrorState message={error} onRetry={reload} />
        : sortedRows.length ? (
          <>
            <div className="card-list">
              {sortedRows.map((r) => (
                <div key={r.id} className="card-row clickable" onClick={() => openDetail(r)}>
                  <div className="card-row-main">
                    <div className="card-row-title">{r.title}</div>
                    <div className="card-row-sub">
                      <span className="muted">{r.priority}</span>
                      {" · "}
                      {r.owner || "unassigned"}
                    </div>
                  </div>
                  <div className="card-row-meta">
                    <StatusBadge status={r.status} />
                    <RiskBadge risk={r.risk_level} />
                    {r.overdue
                      ? <Badge tone="bad">Overdue</Badge>
                      : r.due_date
                        ? <span className="muted">{new Date(asUTC(r.due_date)).toLocaleDateString()}</span>
                        : null}
                  </div>
                </div>
              ))}
            </div>
            <LoadMore onClick={loadMore} loading={loading} done={done} />
          </>
        ) : status ? (
          <Empty
            icon={TASKS_ICON}
            title={`No "${STATUS_LABEL(status)}" tasks right now.`}
            hint={`Nothing is currently ${STATUS_LABEL(status)}. Clear the filter to see the whole board.`}
            actions={<button className="btn-primary" style={{ width: "auto" }} onClick={() => setStatus("")}>Show all</button>}
          />
        ) : (
          <Empty
            icon={TASKS_ICON}
            title="No missions on the board yet."
            hint="Tasks appear here automatically when the AI Council turns an approved decision into action — approve a decision in Decisions to spin up the first one."
            actions={<a className="link" href="/decisions">Go to Decisions →</a>}
          />
        )}

      <DetailDrawer open={open} onClose={closeDrawer} title="Task detail">
        {dLoading ? <Loading /> : dErr ? <ErrorState message={dErr} /> : sel && (
          <div className="kv">
            <Row k="Title" v={sel.title} />
            <Row k="Status" v={canManageTasks
              ? (
                <div className="filter-row" style={{ marginTop: 0 }}>
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      className={"chip" + (sel.status === s.value ? " active" : "")}
                      disabled={saving}
                      onClick={() => changeStatus(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )
              : <StatusBadge status={sel.status} />} />
            {canManageTasks && statusMsg && (
              <Row k="" v={<Badge tone={statusMsg.tone === "ok" ? "ok" : "bad"}>{statusMsg.text}</Badge>} />
            )}
            <Row k="Priority" v={sel.priority} />
            <Row k="Owner" v={sel.owner || "—"} />
            <Row k="Risk" v={<RiskBadge risk={sel.risk_level} />} />
            <Row k="Due" v={sel.overdue
              ? <Badge tone="bad">Overdue</Badge>
              : (sel.due_date ? new Date(asUTC(sel.due_date)).toLocaleDateString() : "—")} />
            <Row k="From decision" v={sel.source_decision_id
              ? <a className="link" href={`/decisions?open=${encodeURIComponent(String(sel.source_decision_id))}`}>
                  Open source decision → <code className="mono">{String(sel.source_decision_id).slice(0, 8)}</code>
                </a>
              : "—"} />
            {sel.description && <div className="detail-block"><b>Description</b><p>{sel.description}</p></div>}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
