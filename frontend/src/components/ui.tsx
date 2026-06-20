import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

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

// ── Premium states (backward-compatible: old label/message props still work) ──
export function Loading({ label = "Loading…", rows = 3, inline = false }:
  { label?: string; rows?: number; inline?: boolean }) {
  if (inline) return <div className="state"><span className="spinner" />{label}</div>;
  return (
    <div className="state-skeleton" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          <span className="sk sk-dot" />
          <span className="sk sk-line" style={{ width: `${68 - i * 12}%` }} />
          <span className="sk sk-pill" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, title = "Couldn’t load this", onRetry }:
  { message: string; title?: string; onRetry?: () => void }) {
  return (
    <div className="state-premium state-premium-error">
      <div className="state-icon" aria-hidden>⚠</div>
      <div className="state-title">{title}</div>
      <p className="state-hint">{message}</p>
      {onRetry && <button className="btn" style={{ width: "auto" }} onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ icon, title, hint, label, actions }:
  { icon?: ReactNode; title?: string; hint?: ReactNode; label?: string; actions?: ReactNode }) {
  const head = title ?? label ?? "Nothing here yet";
  return (
    <div className="state-premium">
      <div className="state-icon" aria-hidden>{icon ?? "✦"}</div>
      <div className="state-title">{head}</div>
      {hint && <p className="state-hint">{hint}</p>}
      {actions && <div className="state-actions">{actions}</div>}
    </div>
  );
}

// ── §21 Premium Page-Kit: shared hero / stat tiles / section labels ──
export function PageHero({ icon, eyebrow, title, desc, actions }:
  { icon?: ReactNode; eyebrow?: string; title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-hero">
      <div className="page-hero-main">
        {icon && <div className="page-hero-icon">{icon}</div>}
        <div className="page-hero-text">
          {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
          <h1 className="page-hero-title">{title}</h1>
          {desc && <p className="page-desc">{desc}</p>}
        </div>
      </div>
      {actions && <div className="page-hero-actions">{actions}</div>}
    </header>
  );
}

export function StatTiles({ children }: { children: ReactNode }) {
  return <div className="stat-tiles">{children}</div>;
}

export function StatTile({ label, value, hint, tone, icon }:
  { label: string; value: ReactNode; hint?: ReactNode;
    tone?: "default" | "accent" | "violet" | "warn" | "bad" | "muted"; icon?: ReactNode }) {
  return (
    <div className={`stat-tile tile-${tone || "default"}`}>
      <div className="stat-tile-top">
        <span className="stat-tile-label">{label}</span>
        {icon && <span className="stat-tile-icon">{icon}</span>}
      </div>
      <div className="stat-tile-value">{value}</div>
      {hint && <div className="stat-tile-hint">{hint}</div>}
    </div>
  );
}

export function SectionLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="section-label">
      <span>{children}</span>
      {hint && <span className="section-label-hint">{hint}</span>}
    </div>
  );
}

export function useAsync<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Callers pass inline arrow functions, so depending on fn's identity would
  // refetch on every render. The latest fn lives in a ref instead: auto-run
  // stays mount-only, but reload() always executes the CURRENT closure (the
  // previous version captured the first render's fn forever).
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(() => {
    setLoading(true); setError(null);
    fnRef.current().then(setData).catch((e) => setError(e?.message || "Request failed")).finally(() => setLoading(false));
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
