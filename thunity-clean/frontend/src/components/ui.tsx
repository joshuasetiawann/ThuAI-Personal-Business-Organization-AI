import { useCallback, useEffect, useState, type ReactNode } from "react";

export function Card({ title, hint, actions, children }:
  { title: string; hint?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <div><h3>{title}</h3>{hint && <span className="hint">{hint}</span>}</div>
        {actions}
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Badge({ tone, children }:
  { tone: "ok" | "warn" | "bad" | "muted"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Stat({ label, value, tone }:
  { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="stat">
      <div className={`stat-value ${tone || ""}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="row"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

export const ServiceBadge = ({ s }: { s: string }) =>
  <Badge tone={/online|local/i.test(s) ? "ok" : "bad"}>{s}</Badge>;

export const Loading = ({ label = "Loading…" }: { label?: string }) =>
  <div className="state"><span className="spinner" />{label}</div>;
export const ErrorState = ({ message }: { message: string }) =>
  <div className="state state-error">⚠ {message}</div>;
export const Empty = ({ label = "Nothing yet." }: { label?: string }) =>
  <div className="state state-muted">{label}</div>;

export function useAsync<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(() => {
    setLoading(true); setError(null);
    fn().then(setData).catch((e) => setError(e?.message || "Request failed")).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { run(); }, [run]);
  return { data, error, loading, reload: run };
}

// ── W2 additions ─────────────────────────────────────────────────────
const STATUS_TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = {
  approved: "ok", done: "ok", completed: "ok", indexed: "ok", executed: "ok", verified: "ok", active: "ok",
  pending: "muted", draft: "muted", backlog: "muted", raw: "muted", parsed: "muted", todo: "muted", archived: "muted",
  rejected: "bad", failed: "bad", deprecated: "bad", cancelled: "bad", expired: "bad",
  blocked: "warn", revised: "warn", skipped: "warn", doing: "warn", review: "warn", running: "warn", pending_approval: "warn",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[(status || "").toLowerCase()] ?? "muted"}>{status || "—"}</Badge>;
}

const RISK_TONE: Record<string, "muted" | "warn" | "bad"> = { low: "muted", medium: "warn", high: "bad", critical: "bad" };
export function RiskBadge({ risk }: { risk: string }) {
  return <Badge tone={RISK_TONE[(risk || "").toLowerCase()] ?? "muted"}>{risk || "—"}</Badge>;
}

export function TrustBadge({ trust }: { trust: string }) {
  const t = (trust || "").toLowerCase();
  const tone = t === "authoritative" || t === "high" ? "ok" : t === "medium" ? "warn" : "bad";
  return <Badge tone={tone}>{trust || "—"}</Badge>;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="page-head"><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>;
}

export interface Column<T> { key: string; label: string; render?: (row: T) => ReactNode; }
export function DataTable<T>({ columns, rows, rowKey, onRow }:
  { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; onRow?: (r: T) => void }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={rowKey(r)} className={onRow ? "rowlink" : ""} onClick={() => onRow?.(r)}>
            {columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—")}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function LoadMore({ onClick, loading, done }: { onClick: () => void; loading: boolean; done: boolean }) {
  if (done) return null;
  return <div className="loadmore"><button className="btn" onClick={onClick} disabled={loading}>{loading ? "Loading…" : "Load more"}</button></div>;
}

export function DetailDrawer({ open, onClose, title, children }:
  { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><h3>{title}</h3><button className="btn btn-ghost" onClick={onClose}>✕</button></div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

// Offset-pagination hook (accumulates rows). reloads when `deps` change.
export function usePaged<T>(fetcher: (limit: number, offset: number) => Promise<T[]>, limit = 100, deps: unknown[] = []) {
  const [rows, setRows] = useState<T[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = (reset: boolean, off: number) => {
    setLoading(true); setError(null);
    fetcher(limit, off)
      .then((batch) => { setRows((prev) => (reset ? batch : [...prev, ...batch])); setOffset(off + limit); setDone(batch.length < limit); })
      .catch((e) => setError(e?.message || "Request failed"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { setRows([]); setOffset(0); setDone(false); load(true, 0); /* eslint-disable-next-line */ }, deps);
  return { rows, loading, error, done, loadMore: () => load(false, offset), reload: () => load(true, 0) };
}
