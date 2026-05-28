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
