import type { ReactNode } from "react";
import { api } from "../api/client";
import { Card, Stat, Badge, Row, ServiceBadge, Loading, ErrorState, Empty, useAsync } from "../components/ui";
import type { MetricsOverview, HardwareStatus, LocalOnlyHealth, AuditEntry } from "../types";

export default function Dashboard() {
  const lo = useAsync<LocalOnlyHealth>(() => api.localOnly() as Promise<LocalOnlyHealth>);
  const m = useAsync<MetricsOverview>(() => api.metrics() as Promise<MetricsOverview>);
  const hw = useAsync<HardwareStatus>(() => api.hardware() as Promise<HardwareStatus>);
  const audit = useAsync<{ audit: AuditEntry[] }>(() => api.audit(8) as Promise<{ audit: AuditEntry[] }>);

  const openTasks = m.data?.tasks ? (m.data.tasks.backlog || 0) + (m.data.tasks.todo || 0) + (m.data.tasks.doing || 0) : 0;
  const attention: ReactNode[] = [];
  if (lo.data && lo.data.status !== "compliant") attention.push(<li key="lo">Local-only status is <b>{lo.data.status}</b> — data sovereignty is not guaranteed. <a className="link" href="/observatory">Observatory →</a></li>);
  if (lo.data?.external_ai_providers_enabled) attention.push(<li key="ext">External AI providers are <b>ENABLED</b>. <a className="link" href="/observatory">Review →</a></li>);
  if (m.data && (m.data.pending_approvals || 0) > 0) attention.push(<li key="ap"><b>{m.data.pending_approvals}</b> approval(s) awaiting resolution. <a className="link" href="/approvals">Approvals →</a></li>);
  if (m.data && m.data.failed_agent_runs > 0) attention.push(<li key="fail"><b>{m.data.failed_agent_runs}</b> failed Council run(s). <a className="link" href="/audit">Audit →</a></li>);
  if (m.data && m.data.documents_unverified > 0) attention.push(<li key="unv"><b>{m.data.documents_unverified}</b> untrusted document(s) in the vault. <a className="link" href="/knowledge">Knowledge →</a></li>);
  if (m.data && m.data.last_backup === "never") attention.push(<li key="bk">No local backup has been taken yet.</li>);
  if (openTasks > 0) attention.push(<li key="tasks"><b>{openTasks}</b> open task(s). <a className="link" href="/tasks">Mission Board →</a></li>);

  return (
    <div className="page dash-page">
      <header className="dash-hero">
        <div className="dash-eyebrow">
          <span className="dash-secure">Local-Secure</span>
          <span className="dash-eyebrow-id">THUNITY · Local AI Company OS</span>
        </div>
        <h1>Founder Command Center</h1>
        <p className="muted dash-lede">Your private, local-first AI company operations — a fast local assistant, a strategic AI Council, knowledge, decisions, tasks, and audit, all designed to run locally on your own machine. This is a read-only overview; sensitive actions stay gated behind founder approval.</p>
      </header>

      <div className="dash-entries">
        <a className="dash-entry primary" href="/chat">
          <span className="entry-label">Open Main Chat</span>
          <span className="entry-sub">Fast local assistant · answers only, no side-effects</span>
        </a>
        <a className="dash-entry" href="/council">
          <span className="entry-label">AI Council →</span>
          <span className="entry-sub">Strategic deliberation · drafts &amp; recommendations, founder-approved</span>
        </a>
      </div>

      <section className="dash-briefing">
        <Card title="Founder Daily Briefing" hint="read-only · local data snapshot">
        {(lo.loading || m.loading) && (!lo.data || !m.data) ? <Loading />
          : (lo.error && m.error) ? <div className="note">Briefing data not available yet — backend unreachable.</div>
          : <>
              <div className="muted small" style={{ marginBottom: "8px" }}>What needs your attention</div>
              {attention.length ? <ul className="bullets">{attention}</ul>
                : <div className="ok small">All clear — nothing needs founder attention right now.</div>}
              <div className="kv mt">
                {lo.data && <Row k="Local-only compliance" v={<Badge tone={lo.data.status === "compliant" ? "ok" : lo.data.status === "warning" ? "warn" : "bad"}>{lo.data.status}</Badge>} />}
                {hw.data && <Row k="GPU acceleration" v={hw.data.gpu_acceleration_confirmed ? <Badge tone="ok">confirmed</Badge> : <Badge tone="warn">unconfirmed</Badge>} />}
                {m.data && <Row k="AI Council runs (24h)" v={<b>{m.data.agent_runs_today}</b>} />}
                {m.data && <Row k="Knowledge documents" v={<b>{m.data.documents_total}</b>} />}
                {m.data && <Row k="Last backup" v={m.data.last_backup === "never" ? <span className="bad">never</span> : new Date(m.data.last_backup).toLocaleString()} />}
              </div>
            </>}
        </Card>
      </section>

      {hw.data?.warning && <div className="banner banner-warn">⚠ {hw.data.warning}</div>}

      <div className="dash-section-label">Operations &amp; Governance · read-only detail</div>
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

        <Card title="Governance" hint="/api/metrics/overview"
          actions={<a className="link" href="/approvals">Approvals →</a>}>
          {m.loading ? <Loading /> : m.error ? <ErrorState message={m.error} /> : m.data && (
            <div className="kv">
              <Row k="Pending approvals" v={<a className="link" href="/approvals">{m.data.pending_approvals ?? 0}</a>} />
              <Row k="Decisions (draft / approved / executed)" v={<a className="link" href="/decisions">{`${m.data.decisions?.draft ?? 0} / ${m.data.decisions?.approved ?? 0} / ${m.data.decisions?.executed ?? 0}`}</a>} />
              <Row k="Tasks (backlog / doing / done)" v={<a className="link" href="/tasks">{`${m.data.tasks?.backlog ?? 0} / ${m.data.tasks?.doing ?? 0} / ${m.data.tasks?.done ?? 0}`}</a>} />
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
