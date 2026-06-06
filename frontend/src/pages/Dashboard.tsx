import { useState, type ReactNode } from "react";
import { api } from "../api/client";
import { asUTC } from "../utils/time";
import { useAuth } from "../auth/AuthContext";
import {
  Card, Badge, Row, ServiceBadge, Loading, ErrorState, Empty,
  PageHero, StatTiles, StatTile, SectionLabel, useAsync,
} from "../components/ui";
import type { MetricsOverview, HardwareStatus, LocalOnlyHealth, AuditEntry } from "../types";

// Dashboard nav icon (route "/") — inner paths copied from AppShell NAV_ICONS["/"].
const HOME_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

type Attn = { key: string; tone: "warn" | "bad"; text: ReactNode; href?: string; linkLabel?: string };

export default function Dashboard() {
  const { user } = useAuth();
  const lo = useAsync<LocalOnlyHealth>(() => api.localOnly() as Promise<LocalOnlyHealth>);
  const m = useAsync<MetricsOverview>(() => api.metrics() as Promise<MetricsOverview>);
  const hw = useAsync<HardwareStatus>(() => api.hardware() as Promise<HardwareStatus>);
  const audit = useAsync<{ audit: AuditEntry[] }>(() => api.audit(8) as Promise<{ audit: AuditEntry[] }>);

  // Founder/admin only — local DB snapshot is a privileged, destructive-adjacent op.
  const canBackup = !!user && (user.role === "founder" || user.role === "admin" || (user.permissions?.includes("all") ?? false));

  // Honest backup state: idle → running → ok/error. Never fakes success.
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupNote, setBackupNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const runBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupNote(null);
    try {
      const r = await api.runBackup() as { name?: string };
      setBackupNote({ tone: "ok", text: r?.name ? `Snapshot saved · ${r.name}` : "Snapshot saved" });
      m.reload(); // refresh metrics so "Last backup" reflects the new snapshot
    } catch (e) {
      setBackupNote({ tone: "bad", text: e instanceof Error ? e.message : "Backup failed" });
    } finally {
      setBackupBusy(false);
    }
  };

  const openTasks = m.data?.tasks ? (m.data.tasks.backlog || 0) + (m.data.tasks.todo || 0) + (m.data.tasks.doing || 0) : 0;

  // Honest "what needs your attention" computation — conditions, thresholds, and
  // link targets are preserved verbatim from the original; only the container is restyled.
  const attention: Attn[] = [];
  if (lo.data && lo.data.status !== "compliant")
    attention.push({ key: "lo", tone: "bad", text: <>Local-only status is <b>{lo.data.status}</b> — data sovereignty is not guaranteed.</>, href: "/observatory", linkLabel: "Observatory →" });
  if (lo.data?.external_ai_providers_enabled)
    attention.push({ key: "ext", tone: "bad", text: <>External AI providers are <b>ENABLED</b>.</>, href: "/observatory", linkLabel: "Review →" });
  if (m.data && (m.data.pending_approvals || 0) > 0)
    attention.push({ key: "ap", tone: "warn", text: <><b>{m.data.pending_approvals}</b> approval(s) awaiting resolution.</>, href: "/approvals", linkLabel: "Approvals →" });
  if (m.data && m.data.failed_agent_runs > 0)
    attention.push({ key: "fail", tone: "bad", text: <><b>{m.data.failed_agent_runs}</b> failed Council run(s).</>, href: "/audit", linkLabel: "Audit →" });
  if (m.data && m.data.documents_unverified > 0)
    attention.push({ key: "unv", tone: "warn", text: <><b>{m.data.documents_unverified}</b> untrusted document(s) in the vault.</>, href: "/knowledge", linkLabel: "Knowledge →" });
  if (m.data && m.data.last_backup === "never")
    attention.push({ key: "bk", tone: "warn", text: <>No local backup has been taken yet.</> });
  if (openTasks > 0)
    attention.push({ key: "tasks", tone: "warn", text: <><b>{openTasks}</b> open task(s).</>, href: "/tasks", linkLabel: "Mission Board →" });

  const topLoading = (lo.loading || m.loading) && (!lo.data || !m.data);
  const topDegraded = !topLoading && lo.error && m.error;

  const complianceTone = lo.data
    ? (lo.data.status === "compliant" ? "accent" : lo.data.status === "warning" ? "warn" : "bad")
    : "muted";

  return (
    <div className="page dash-page">
      <PageHero
        icon={HOME_ICON}
        eyebrow="COMMAND CENTER"
        title="Founder Command Center"
        desc="Your private, local-first AI company at a glance — see what needs your attention right now, then jump into Main Chat, the AI Council, or any operations area."
        actions={<a className="btn-primary" style={{ width: "auto" }} href="/chat">Open Main Chat</a>}
      />

      {/* Single scannable summary — values come only from already-fetched data. */}
      {topLoading ? <Loading rows={4} />
        : topDegraded ? <ErrorState message="Briefing data not available yet — backend unreachable." onRetry={() => { lo.reload(); m.reload(); }} />
        : (
          <StatTiles>
            <StatTile label="COMPLIANCE" tone={complianceTone}
              value={lo.data ? <Badge tone={lo.data.status === "compliant" ? "ok" : lo.data.status === "warning" ? "warn" : "bad"}>{lo.data.status}</Badge> : "—"}
              hint="local-only health" />
            <StatTile label="COUNCIL RUNS (24H)" tone="accent"
              value={m.data ? m.data.agent_runs_today : "—"}
              hint={m.data ? `avg ${m.data.avg_latency_ms} ms` : undefined} />
            <StatTile label="PENDING APPROVALS"
              tone={m.data && (m.data.pending_approvals || 0) > 0 ? "warn" : "default"}
              value={m.data ? (m.data.pending_approvals ?? 0) : "—"}
              hint={<a className="link" href="/approvals">Approvals →</a>} />
            <StatTile label="OPEN TASKS" tone="violet"
              value={m.data ? openTasks : "—"}
              hint={<a className="link" href="/tasks">Mission Board →</a>} />
            <StatTile label="KNOWLEDGE DOCS" tone="default"
              value={m.data ? m.data.documents_total : "—"}
              hint={m.data && m.data.documents_unverified > 0
                ? <span className="warn">{m.data.documents_unverified} unverified</span>
                : <a className="link" href="/knowledge">Knowledge →</a>} />
            <StatTile label="LAST BACKUP"
              tone={m.data?.last_backup === "never" ? "bad" : "muted"}
              value={m.data ? (m.data.last_backup === "never" ? "never" : new Date(asUTC(m.data.last_backup)).toLocaleDateString()) : "—"}
              hint={canBackup ? (
                <span style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                  <button type="button" className="btn" style={{ width: "auto", padding: "3px 10px", fontSize: "12px" }}
                    onClick={runBackup} disabled={backupBusy}
                    title="Local DB snapshot — stored locally only, never uploaded.">
                    {backupBusy ? "Backing up…" : "Back up now"}
                  </button>
                  {backupNote
                    ? <span className={backupNote.tone === "ok" ? "muted small" : "bad small"}>{backupNote.text}</span>
                    : <span className="muted small">local snapshot · never uploaded</span>}
                </span>
              ) : "local snapshot"} />
            <StatTile label="GPU ACCELERATION"
              tone={hw.data ? (hw.data.gpu_acceleration_confirmed ? "accent" : "warn") : "muted"}
              value={hw.data ? <Badge tone={hw.data.gpu_acceleration_confirmed ? "ok" : "warn"}>{hw.data.gpu_acceleration_confirmed ? "confirmed" : "unconfirmed"}</Badge> : "—"}
              hint="hardware probe" />
          </StatTiles>
        )}

      {/* "Read this first" anchor — promoted attention block. */}
      {!topLoading && !topDegraded && (
        <>
          <SectionLabel>WHAT NEEDS YOUR ATTENTION</SectionLabel>
          {attention.length ? (
            <div className="card-list">
              {attention.map((a) => (
                <div className="card-row" key={a.key}>
                  <Badge tone={a.tone}>{a.tone === "bad" ? "action" : "review"}</Badge>
                  <div className="card-row-main">
                    <div className="card-row-sub" style={{ marginTop: 0, fontSize: "13.5px", color: "var(--txt)" }}>{a.text}</div>
                  </div>
                  {a.href && <div className="card-row-meta"><a className="link" href={a.href}>{a.linkLabel}</a></div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="card-list">
              <div className="card-row">
                <Badge tone="ok">all clear</Badge>
                <div className="card-row-main">
                  <div className="card-row-title">All clear — nothing needs your attention right now.</div>
                  <div className="card-row-sub">Your local company is healthy: compliant, no pending approvals, no failed runs.</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick entry — Main Chat is now the hero primary action; Council stays here. */}
      <div className="dash-entries">
        <a className="dash-entry" href="/council">
          <span className="entry-label">AI Council →</span>
          <span className="entry-sub">Strategic deliberation · drafts &amp; recommendations, founder-approved</span>
        </a>
      </div>

      {hw.data?.warning && <div className="banner banner-warn">{hw.data.warning}</div>}

      <SectionLabel hint={<a className="link" href="/observatory">Observatory →</a>}>
        OPERATIONS &amp; GOVERNANCE · READ-ONLY DETAIL
      </SectionLabel>
      <div className="grid">
        <Card title="Local-Only Compliance" hint="/api/health/local-only">
          {lo.loading ? <Loading rows={4} /> : lo.error ? <ErrorState message={lo.error} onRetry={lo.reload} /> : lo.data && (
            <>
              <div style={{ marginBottom: "12px" }}>
                <Badge tone={lo.data.status === "compliant" ? "ok" : lo.data.status === "warning" ? "warn" : "bad"}>{lo.data.status}</Badge>
              </div>
              <div className="kv">
                <Row k="Mode" v={lo.data.local_only_mode ? <Badge tone="ok">LOCAL_ONLY: ON</Badge> : <Badge tone="bad">OFF</Badge>} />
                <Row k="External AI providers" v={lo.data.external_ai_providers_enabled ? <Badge tone="bad">ENABLED</Badge> : <Badge tone="ok">disabled</Badge>} />
                <Row k="Ollama" v={<ServiceBadge s={lo.data.ollama_status} />} />
                <Row k="Database" v={<ServiceBadge s={lo.data.database} />} />
                <Row k="Vector store" v={<span className="muted">{lo.data.vector_store}</span>} />
                <Row k="n8n" v={<ServiceBadge s={lo.data.n8n} />} />
              </div>
            </>
          )}
        </Card>

        <Card title="Operations Detail" hint="/api/metrics/overview">
          {m.loading ? <Loading rows={4} /> : m.error ? <ErrorState message={m.error} onRetry={m.reload} /> : m.data && (
            <div className="kv">
              <Row k="Documents (total / unverified)" v={<span>{m.data.documents_total} / <span className={m.data.documents_unverified ? "warn" : ""}>{m.data.documents_unverified}</span></span>} />
              <Row k="Errors logged" v={<span className={m.data.error_count ? "warn" : ""}>{m.data.error_count}</span>} />
              <Row k="Failed runs" v={<span className={m.data.failed_agent_runs ? "bad" : ""}>{m.data.failed_agent_runs}</span>} />
              <Row k="Last backup" v={m.data.last_backup === "never" ? <span className="bad">never</span> : new Date(asUTC(m.data.last_backup)).toLocaleDateString()} />
            </div>
          )}
        </Card>

        <Card title="Governance" hint="/api/metrics/overview"
          actions={<a className="link" href="/approvals">Approvals →</a>}>
          {m.loading ? <Loading rows={3} /> : m.error ? <ErrorState message={m.error} onRetry={m.reload} /> : m.data && (
            <div className="kv">
              <Row k="Pending approvals" v={<a className="link" href="/approvals">{m.data.pending_approvals ?? 0}</a>} />
              <Row k="Decisions (draft / approved / executed)" v={<a className="link" href="/decisions">{`${m.data.decisions?.draft ?? 0} / ${m.data.decisions?.approved ?? 0} / ${m.data.decisions?.executed ?? 0}`}</a>} />
              <Row k="Tasks (backlog / doing / done)" v={<a className="link" href="/tasks">{`${m.data.tasks?.backlog ?? 0} / ${m.data.tasks?.doing ?? 0} / ${m.data.tasks?.done ?? 0}`}</a>} />
            </div>
          )}
        </Card>

        <Card title="Hardware" hint="/api/hardware/status">
          {hw.loading ? <Loading rows={4} /> : hw.error ? <ErrorState message={hw.error} onRetry={hw.reload} /> : hw.data && (
            <>
              <div style={{ marginBottom: "12px" }}>
                <Badge tone={hw.data.gpu_acceleration_confirmed ? "ok" : "warn"}>
                  GPU acceleration {hw.data.gpu_acceleration_confirmed ? "confirmed" : "unconfirmed"}
                </Badge>
              </div>
              <div className="stats">
                <div className="stat"><div className="stat-v">{hw.data.cpu.percent}%</div><div className="stat-k">CPU</div></div>
                <div className="stat"><div className="stat-v">{hw.data.ram.percent}%</div><div className="stat-k">RAM</div></div>
                <div className="stat"><div className="stat-v">{hw.data.disk.percent}%</div><div className="stat-k">Disk</div></div>
              </div>
              <div className="kv mt">
                <Row k="CPU" v={<span className="muted">{hw.data.cpu.name}</span>} />
                <Row k="RAM" v={<span>{hw.data.ram.used_gb} / {hw.data.ram.total_gb} GB</span>} />
                <Row k="Disk" v={<span>{hw.data.disk.used_gb} / {hw.data.disk.total_gb} GB</span>} />
                <Row k="GPU" v={<span className="muted">{hw.data.gpu.name}</span>} />
                {hw.data.ollama && <Row k="Missing models" v={hw.data.ollama.missing_models.length ? <span className="warn">{hw.data.ollama.missing_models.join(", ")}</span> : <Badge tone="ok">none</Badge>} />}
              </div>
            </>
          )}
        </Card>

        <Card title="Recent Activity" hint="/api/audit"
          actions={<a className="link" href="/audit">View all →</a>}>
          {audit.loading ? <Loading rows={5} /> : audit.error ? <ErrorState message={audit.error} onRetry={audit.reload} />
            : (audit.data?.audit?.length
              ? <ul className="feed">{audit.data.audit.map((a) => (
                  <li key={a.id}>
                    <span className="feed-action">{a.action}</span>
                    <span className="muted small">{a.actor || "system"}{a.entity_type ? ` · ${a.entity_type}` : ""}</span>
                    <time>{new Date(asUTC(a.created_at)).toLocaleTimeString()}</time>
                  </li>))}</ul>
              : <Empty
                  icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>}
                  title="No activity yet"
                  hint="Actions you and the AI Council take — decisions, approvals, task changes — will appear here as a live audit trail." />)}
        </Card>
      </div>
    </div>
  );
}
