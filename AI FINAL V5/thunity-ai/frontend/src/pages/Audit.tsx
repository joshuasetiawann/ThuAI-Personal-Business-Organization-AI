import { useState } from "react";
import { api } from "../api/client";
import { asUTC } from "../utils/time";
import { Card, Loading, ErrorState, Empty, Badge, PageHero, StatTiles, StatTile, SectionLabel, useAsync } from "../components/ui";
import type { AuditEntry } from "../types";

const AUDIT_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h9l4 4v14H6Z" /><path d="M14 3v5h5M9 13h6M9 16.5h6" />
  </svg>
);

const ENTITY_LINK: Record<string, string> = {
  decision: "/decisions?open=", decisions: "/decisions?open=",
  task: "/tasks?open=", tasks: "/tasks?open=",
  approval: "/approvals?focus=", approvals: "/approvals?focus=",
  workflow: "/workflows?open=", workflow_run: "/workflows?open=", workflows: "/workflows?open=",
  conversation: "/conversations?open=", conversations: "/conversations?open=",
};

function CopyId({ value }: { value: string }) {
  return <button className="btn btn-ghost" style={{ padding: "0 6px", fontSize: 11 }}
    title="Copy full id" onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(value); }}>copy</button>;
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

// Map an action string to a Badge tone so high-stakes events pop. Blue→violet
// palette only: bad (destructive), warn (in-flight), ok (success), muted (routine).
function actionTone(action: string): "ok" | "warn" | "bad" | "muted" {
  const a = (action || "").toLowerCase();
  if (/(reject|fail|expire|denied|revoke|delete|cancel|error)/.test(a)) return "bad";
  if (/(approv|execut|grant|done|complete|verif|index|success)/.test(a)) return "ok";
  if (/(pending|revis|review|running|await|request|propos)/.test(a)) return "warn";
  return "muted";
}

function relTime(iso: string): string {
  const t = new Date(asUTC(iso)).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

// Bucket a timestamp into a friendly day label for grouped sub-headers.
function dayBucket(iso: string): string {
  const d = new Date(asUTC(iso));
  if (Number.isNaN(d.getTime())) return "Unknown date";
  const today = new Date(); const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Audit() {
  const a = useAsync<{ audit: AuditEntry[] }>(() => api.audit(100) as Promise<{ audit: AuditEntry[] }>);
  const [q, setQ] = useState("");
  const all = a.data?.audit || [];
  const rows = all.filter((r) =>
    !q || r.action.includes(q) || (r.actor || "").includes(q) || (r.entity_type || "").includes(q));
  const filtered = q.trim().length > 0;

  // Summary stats — computed purely from the FILTERED view so tiles update live.
  const actors = new Set(rows.map((r) => r.actor || "system")).size;
  const actionTypes = new Set(rows.map((r) => r.action)).size;
  const mostRecent = rows[0]?.created_at;

  // Top distinct actions (by frequency) across fetched rows → quick-filter chips.
  const topActions = (() => {
    const counts = new Map<string, number>();
    for (const r of all) counts.set(r.action, (counts.get(r.action) || 0) + 1);
    return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k]) => k);
  })();

  // Group filtered rows into ordered day buckets for sticky sub-headers.
  const groups: { label: string; items: AuditEntry[] }[] = [];
  for (const r of rows) {
    const label = dayBucket(r.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(r);
    else groups.push({ label, items: [r] });
  }

  return (
    <div className="page">
      <PageHero
        icon={AUDIT_ICON}
        eyebrow="OBSERVABILITY"
        title="Audit Trail"
        desc="A tamper-proof, append-only record of every sensitive action across Thunity — see who did what, to which decision, task, or approval, and when."
        actions={
          <>
            <Badge tone="muted">Append-only · cannot be edited</Badge>
            <button className="btn btn-ghost" style={{ width: "auto" }} onClick={a.reload} disabled={a.loading}>
              {a.loading ? "Refreshing…" : "Refresh"}
            </button>
          </>
        }
      />

      {a.loading ? (
        <StatTiles>
          {[0, 1, 2, 3].map((i) => <StatTile key={i} label="—" value={<Loading inline />} tone="muted" />)}
        </StatTiles>
      ) : a.error ? null : (
        <StatTiles>
          <StatTile label="Events" value={rows.length} tone="accent"
            hint={filtered ? `of ${all.length} · latest 100` : "latest 100"} />
          <StatTile label="Actors" value={actors} tone="violet"
            hint={actors === 1 ? "distinct actor" : "distinct actors"} />
          <StatTile label="Action types" value={actionTypes} tone="default"
            hint="distinct actions" />
          <StatTile label="Most recent" value={mostRecent ? relTime(mostRecent) : "—"} tone="muted"
            hint={mostRecent ? new Date(asUTC(mostRecent)).toLocaleString() : "no events yet"} />
        </StatTiles>
      )}

      <SectionLabel hint={<span className="muted small">{`Showing ${rows.length} of ${all.length}`}</span>}>
        ACTIVITY
      </SectionLabel>

      <Card title="Recent events" hint="/api/audit?limit=100">
        <div className="toolbar" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input className="filter" style={{ flex: "1 1 240px" }}
            placeholder="Search action, actor, or entity…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          {topActions.map((act) => (
            <button key={act} className={`chip${q === act ? " chip-active" : ""}`}
              onClick={() => setQ(q === act ? "" : act)}>{act}</button>
          ))}
          {filtered && <button className="chip" onClick={() => setQ("")}>Clear ✕</button>}
        </div>

        {a.loading ? <Loading rows={6} />
          : a.error ? <ErrorState message={a.error} onRetry={a.reload} />
          : rows.length ? (
            <div className="card-list">
              {groups.map((g) => (
                <div key={g.label}>
                  <SectionLabel>{g.label}</SectionLabel>
                  {g.items.map((r) => (
                    <div key={r.id} className="card-row">
                      <div className="card-row-main">
                        <div className="card-row-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <Badge tone={actionTone(r.action)}>{r.action}</Badge>
                        </div>
                        <div className="card-row-sub">
                          {r.actor || "system"}
                          {r.actor_role ? <span className="muted"> · {r.actor_role}</span> : ""}
                        </div>
                      </div>
                      <div className="card-row-meta" style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <EntityCell type={r.entity_type} id={r.entity_id} />
                        <span className="muted small" title={new Date(asUTC(r.created_at)).toLocaleString()}>
                          {relTime(r.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : all.length === 0 ? (
            <Empty icon={AUDIT_ICON}
              title="No actions recorded yet"
              hint="As decisions are made, approvals granted, and tasks executed, every sensitive action is logged here automatically — this record is append-only and cannot be edited." />
          ) : (
            <Empty icon={AUDIT_ICON}
              title="No events match your filter"
              hint="Try a different action, actor, or entity name — or clear the filter to see all recent activity."
              actions={<button className="btn" style={{ width: "auto" }} onClick={() => setQ("")}>Clear filter</button>} />
          )}

        <p className="muted small" style={{ marginTop: 12 }}>
          Showing the latest 100 events from <code>/api/audit?limit=100</code> — not the full history.
        </p>
      </Card>
    </div>
  );
}
