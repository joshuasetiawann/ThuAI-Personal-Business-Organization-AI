import { api } from "../api/client";
import { Card, Stat, Badge, Row, ServiceBadge, Loading, ErrorState, Empty, useAsync } from "../components/ui";
import type { MetricsOverview, HardwareStatus, LocalOnlyHealth, AuditEntry } from "../types";

export default function Dashboard() {
  const lo = useAsync<LocalOnlyHealth>(() => api.localOnly() as Promise<LocalOnlyHealth>);
  const m = useAsync<MetricsOverview>(() => api.metrics() as Promise<MetricsOverview>);
  const hw = useAsync<HardwareStatus>(() => api.hardware() as Promise<HardwareStatus>);
  const audit = useAsync<{ audit: AuditEntry[] }>(() => api.audit(8) as Promise<{ audit: AuditEntry[] }>);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <p className="muted">Read-only operational overview. High-risk actions are gated behind the approval flow (next sprint).</p>
      </div>

      {hw.data?.warning && <div className="banner banner-warn">⚠ {hw.data.warning}</div>}

      <div className="grid">
        <Card title="Local-Only Compliance" hint="/api/health/local-only">
          {lo.loading ? <Loading /> : lo.error ? <ErrorState message={lo.error} /> : lo.data && (
            <div className="kv">
              <Row k="Mode" v={lo.data.local_only_mode ? <Badge tone="ok">LOCAL_ONLY: ON</Badge> : <Badge tone="bad">OFF</Badge>} />
              <Row k="External AI providers" v={lo.data.external_ai_providers_enabled ? <Badge tone="bad">ENABLED</Badge> : <Badge tone="ok">disabled</Badge>} />
              <Row k="Ollama" v={<ServiceBadge s={lo.data.ollama_status} />} />
              <Row k="Database" v={<ServiceBadge s={lo.data.database} />} />
              <Row k="Vector store" v={<span className="muted">{lo.data.vector_store}</span>} />
              <Row k="n8n" v={<ServiceBadge s={lo.data.n8n} />} />
              <Row k="Status" v={<Badge tone={lo.data.status === "compliant" ? "ok" : lo.data.status === "warning" ? "warn" : "bad"}>{lo.data.status}</Badge>} />
            </div>
          )}
        </Card>

        <Card title="Operations Overview" hint="/api/metrics/overview">
          {m.loading ? <Loading /> : m.error ? <ErrorState message={m.error} /> : m.data && (
            <div className="stats">
              <Stat label="Agent runs (24h)" value={m.data.agent_runs_today} />
              <Stat label="Avg latency" value={`${m.data.avg_latency_ms} ms`} />
              <Stat label="Failed runs" value={m.data.failed_agent_runs} tone={m.data.failed_agent_runs ? "bad" : ""} />
              <Stat label="Pending approvals" value={m.data.pending_approvals ?? 0} tone={(m.data.pending_approvals || 0) > 0 ? "warn" : ""} />
              <Stat label="Documents" value={m.data.documents_total} />
              <Stat label="Unverified docs" value={m.data.documents_unverified} tone={m.data.documents_unverified ? "warn" : ""} />
              <Stat label="Errors logged" value={m.data.error_count} tone={m.data.error_count ? "warn" : ""} />
              <Stat label="Last backup" value={m.data.last_backup === "never" ? <span className="bad">never</span> : new Date(m.data.last_backup).toLocaleDateString()} tone={m.data.last_backup === "never" ? "bad" : ""} />
            </div>
          )}
        </Card>

        <Card title="Hardware" hint="/api/hardware/status">
          {hw.loading ? <Loading /> : hw.error ? <ErrorState message={hw.error} /> : hw.data && (
            <div className="kv">
              <Row k="CPU" v={<span>{hw.data.cpu.name} · {hw.data.cpu.percent}%</span>} />
              <Row k="RAM" v={<span>{hw.data.ram.used_gb} / {hw.data.ram.total_gb} GB ({hw.data.ram.percent}%)</span>} />
              <Row k="Disk" v={<span>{hw.data.disk.used_gb} / {hw.data.disk.total_gb} GB ({hw.data.disk.percent}%)</span>} />
              <Row k="GPU" v={<span>{hw.data.gpu.name}</span>} />
              <Row k="GPU acceleration" v={hw.data.gpu_acceleration_confirmed ? <Badge tone="ok">confirmed</Badge> : <Badge tone="warn">unconfirmed</Badge>} />
              {hw.data.ollama && <Row k="Missing models" v={hw.data.ollama.missing_models.length ? <span className="warn">{hw.data.ollama.missing_models.join(", ")}</span> : <Badge tone="ok">none</Badge>} />}
            </div>
          )}
        </Card>

        <Card title="Recent Activity" hint="/api/audit"
          actions={<a className="link" href="/audit">View all →</a>}>
          {audit.loading ? <Loading /> : audit.error ? <ErrorState message={audit.error} />
            : (audit.data?.audit?.length
              ? <ul className="feed">{audit.data.audit.map((a) => (
                  <li key={a.id}>
                    <span className="feed-action">{a.action}</span>
                    <span className="muted small">{a.actor || "system"}{a.entity_type ? ` · ${a.entity_type}` : ""}</span>
                    <time>{new Date(a.created_at).toLocaleTimeString()}</time>
                  </li>))}</ul>
              : <Empty label="No audit activity yet." />)}
        </Card>
      </div>
    </div>
  );
}
