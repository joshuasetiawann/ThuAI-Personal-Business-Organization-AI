import type { ReactNode } from "react";
import { api } from "../api/client";
import { asUTC } from "../utils/time";
import { PageHero, StatTiles, StatTile, SectionLabel, Card, Row, Badge, StatusBadge,
  RiskBadge, ServiceBadge, DataTable, Loading, ErrorState, Empty, useAsync,
  type Column } from "../components/ui";
import type { HardwareStatus, LocalOnlyHealth, ModelHealth, WorkflowRun, Tool } from "../types";

// ── Observatory nav icon (from AppShell NAV_ICONS["/observatory"]) wrapped for the hero ──
const ObservatoryIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
  </svg>
);
const RefreshIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
  </svg>
);
const RunsIcon = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="6" r="2.2" /><circle cx="12" cy="18" r="2.2" />
    <path d="M6 8.2v3a2 2 0 0 0 2 2h2M18 8.2v3a2 2 0 0 1-2 2h-2" />
  </svg>
);
const ToolsIcon = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.7 6.3a3.5 3.5 0 0 0-4.6 4.6L4 17l3 3 6.1-6.1a3.5 3.5 0 0 0 4.6-4.6l-2.3 2.3-2-2Z" />
  </svg>
);

// Tiny inline tile glyphs (stroke, currentColor) — palette stays blue→indigo→violet.
const ic = (children: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ServicesIcon = ic(<><rect x="3" y="4" width="18" height="6" rx="1.5" /><rect x="3" y="14" width="18" height="6" rx="1.5" /><path d="M7 7h.01M7 17h.01" /></>);
const HardwareIcon = ic(<><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" /></>);
const ModelsIcon = ic(<><path d="M12 3a4 4 0 0 0-4 4 3 3 0 0 0-2 5.2A3 3 0 0 0 8 18a3 3 0 0 0 8 0 3 3 0 0 0 2-5.8A3 3 0 0 0 16 7a4 4 0 0 0-4-4Z" /></>);
const RunsTileIcon = ic(<><circle cx="6" cy="6" r="1.8" /><circle cx="18" cy="6" r="1.8" /><circle cx="12" cy="18" r="1.8" /><path d="M6 7.8v3a2 2 0 0 0 2 2h2M18 7.8v3a2 2 0 0 1-2 2h-2" /></>);
const ToolsTileIcon = ic(<path d="M14.7 6.3a3.5 3.5 0 0 0-4.6 4.6L4 17l3 3 6.1-6.1a3.5 3.5 0 0 0 4.6-4.6l-2.3 2.3-2-2Z" />);

const wfCols: Column<WorkflowRun>[] = [
  { key: "workflow_name", label: "Workflow", render: (r) => <span className="strong">{r.workflow_name}</span> },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "created_at", label: "When", render: (r) => <span className="muted small">{new Date(asUTC(r.created_at)).toLocaleString()}</span> },
];
const toolCols: Column<Tool>[] = [
  { key: "name", label: "Tool", render: (r) => <span className="mono">{r.name}</span> },
  { key: "risk_level", label: "Risk", render: (r) => <RiskBadge risk={r.risk_level} /> },
  { key: "required_permission", label: "Permission", render: (r) => <span className="mono small muted">{r.required_permission}</span> },
  { key: "audit", label: "Audited", render: (r) => r.audit ? <Badge tone="ok">Audited</Badge> : <Badge tone="warn">Not audited</Badge> },
];

// A service string counts as "up" when it reads online/local/connected/healthy.
const up = (s?: string) => !!s && /online|local|connected|healthy|ready/i.test(s);

// Thin utilization meter — blue→indigo fill, warn-tinted at high pressure.
function Meter({ label, used, total, percent, unit }:
  { label: string; used?: number; total?: number; percent: number; unit?: string }) {
  const hot = percent >= 85;
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="k">{label}</span>
        <span className="v" style={{ fontSize: 12 }}>
          {used != null && total != null && <span className="muted">{used}/{total} {unit} · </span>}
          <span className={hot ? "warn" : ""} style={{ fontWeight: 600 }}>{percent}%</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 6,
          background: hot
            ? "linear-gradient(90deg,#6366f1,#f59e0b)"
            : "linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6)",
          transition: "width .4s ease",
        }} />
      </div>
    </div>
  );
}

export default function Observatory() {
  const lo = useAsync<LocalOnlyHealth>(() => api.localOnly() as Promise<LocalOnlyHealth>);
  const hw = useAsync<HardwareStatus>(() => api.hardware() as Promise<HardwareStatus>);
  const mh = useAsync<ModelHealth>(() => api.modelsHealth() as Promise<ModelHealth>);
  const wf = useAsync<{ runs: WorkflowRun[] }>(() => api.workflowRuns() as Promise<{ runs: WorkflowRun[] }>);
  const tools = useAsync<{ tools: Tool[] }>(() => api.tools() as Promise<{ tools: Tool[] }>);

  const reloadAll = () => { lo.reload(); hw.reload(); mh.reload(); wf.reload(); tools.reload(); };

  // ── Derived summaries (ALL from already-fetched data; honest "—"/0 when empty) ──
  const svcUp = lo.data ? [lo.data.ollama_status, lo.data.database, lo.data.n8n, lo.data.vector_store].filter(up).length : 0;
  const svcTotal = 4;
  const svcAllUp = lo.data ? svcUp === svcTotal : false;

  const hwPressure = hw.data ? Math.max(hw.data.cpu.percent, hw.data.ram.percent, hw.data.disk.percent) : 0;
  const hwHot = hw.data ? hwPressure >= 85 : false;

  const installed = mh.data?.installed_models.length ?? 0;
  const missing = mh.data?.missing_models.length ?? 0;

  const runs = wf.data?.runs ?? [];
  const runDone = runs.filter((r) => /done|success|complete/i.test(r.status)).length;
  const runActive = runs.filter((r) => /run|progress|pending|queue/i.test(r.status)).length;
  const runFailed = runs.filter((r) => /fail|error/i.test(r.status)).length;

  const allTools = tools.data?.tools ?? [];
  const highRisk = allTools.filter((t) => /high|critical/i.test(t.risk_level)).length;
  const unaudited = allTools.filter((t) => !t.audit).length;

  // ── Overall health verdict — single glance, never forced green ──
  const anyLoading = lo.loading || hw.loading || mh.loading || wf.loading;
  const anyError = lo.error || hw.error || mh.error || wf.error;
  const attention = [
    lo.data && !svcAllUp, hw.data && hwHot, mh.data && missing > 0, wf.data && runFailed > 0,
  ].filter(Boolean).length;
  let verdictTone: "ok" | "warn" | "bad" | "muted" = "muted";
  let verdictText = "Checking system health…";
  if (anyError) { verdictTone = "muted"; verdictText = "Status unavailable — a health check could not be reached"; }
  else if (anyLoading) { verdictTone = "muted"; verdictText = "Checking system health…"; }
  else if (runFailed > 0 || (lo.data && !svcAllUp)) { verdictTone = "bad"; verdictText = "Service degraded — needs attention"; }
  else if (attention > 0) { verdictTone = "warn"; verdictText = `${attention} item${attention > 1 ? "s" : ""} need attention`; }
  else { verdictTone = "ok"; verdictText = "All systems healthy"; }

  return (
    <div className="page">
      <PageHero
        icon={ObservatoryIcon}
        eyebrow="OBSERVABILITY"
        title="System Observatory"
        desc="See at a glance whether Thunity's local engine is healthy — its services, this machine's hardware, your local models, governed automation runs, and the tool registry. Everything here is read-only, so you can spot a degraded service or missing model before it blocks the company."
        actions={
          <button className="btn" style={{ width: "auto", display: "inline-flex", alignItems: "center", gap: 7 }}
            onClick={reloadAll} title="Re-run every health check">
            {RefreshIcon} Refresh all
          </button>
        }
      />

      {/* Single overall health verdict — the one glance */}
      <div className="section-label" style={{ marginTop: 2 }}>
        <span>OVERALL HEALTH</span>
        <span className="section-label-hint">
          <Badge tone={verdictTone}>{verdictText}</Badge>
        </span>
      </div>

      {/* Stat tiles — each from already-fetched data, honest while pending */}
      <StatTiles>
        <StatTile label="SERVICES" icon={ServicesIcon}
          tone={lo.loading ? "muted" : lo.error ? "bad" : svcAllUp ? "accent" : "warn"}
          value={lo.loading ? "—" : lo.error ? "—" : `${svcUp}/${svcTotal} online`}
          hint={lo.loading ? "checking…" : lo.error ? "unavailable" : `engine status · ${lo.data?.status ?? "—"}`} />

        <StatTile label="HARDWARE" icon={HardwareIcon}
          tone={hw.loading ? "muted" : hw.error ? "bad" : hwHot ? "warn" : "default"}
          value={hw.loading || hw.error ? "—" : `RAM ${hw.data?.ram.used_gb}/${hw.data?.ram.total_gb} GB`}
          hint={hw.loading ? "checking…" : hw.error ? "unavailable"
            : `disk ${hw.data?.disk.percent}% · GPU ${hw.data?.gpu_acceleration_confirmed ? "confirmed" : "unconfirmed"}`} />

        <StatTile label="LOCAL MODELS" icon={ModelsIcon}
          tone={mh.loading ? "muted" : mh.error ? "bad" : missing > 0 ? "warn" : "violet"}
          value={mh.loading || mh.error ? "—" : `${installed} installed`}
          hint={mh.loading ? "checking…" : mh.error ? "unavailable"
            : missing > 0 ? `${missing} missing · ${mh.data?.missing_models.join(", ")}` : "all required models present"} />

        <StatTile label="AUTOMATION" icon={RunsTileIcon}
          tone={wf.loading ? "muted" : wf.error ? "bad" : runFailed > 0 ? "bad" : "default"}
          value={wf.loading || wf.error ? "—" : `${runs.length} run${runs.length === 1 ? "" : "s"}`}
          hint={wf.loading ? "checking…" : wf.error ? "unavailable"
            : runs.length ? `${runDone} done · ${runActive} running · ${runFailed} failed` : "no runs yet"} />

        <StatTile label="TOOLS" icon={ToolsTileIcon}
          tone={tools.loading ? "muted" : tools.error ? "bad" : highRisk > 0 ? "violet" : "default"}
          value={tools.loading || tools.error ? "—" : `${allTools.length} registered`}
          hint={tools.loading ? "checking…" : tools.error ? "unavailable"
            : allTools.length ? `${highRisk} high-risk · ${unaudited === 0 ? "all audited" : `${unaudited} un-audited`}` : "none registered"} />
      </StatTiles>

      {/* TIER 1 — live, must-watch signals */}
      <SectionLabel>ENGINE HEALTH</SectionLabel>
      <div className="grid">
        <Card title="Services" hint="Local engine dependencies">
          {lo.loading ? <Loading rows={5} /> : lo.error ? <ErrorState message={lo.error} onRetry={lo.reload} /> : lo.data && (
            <div className="kv">
              <Row k="Ollama" v={<ServiceBadge s={lo.data.ollama_status} />} />
              <Row k="Database" v={<ServiceBadge s={lo.data.database} />} />
              <Row k="n8n" v={<ServiceBadge s={lo.data.n8n} />} />
              <Row k="Vector store" v={<span className="muted">{lo.data.vector_store}</span>} />
              <Row k="Compliance" v={<Badge tone={lo.data.status === "compliant" ? "ok" : "warn"}>{lo.data.status}</Badge>} />
            </div>
          )}
        </Card>

        <Card title="Hardware" hint="This machine right now">
          {hw.loading ? <Loading rows={5} /> : hw.error ? <ErrorState message={hw.error} onRetry={hw.reload} /> : hw.data && (
            <>
              <div className="kv">
                <Meter label="CPU" percent={hw.data.cpu.percent} />
                <Meter label="RAM" used={hw.data.ram.used_gb} total={hw.data.ram.total_gb} percent={hw.data.ram.percent} unit="GB" />
                <Meter label="Disk" used={hw.data.disk.used_gb} total={hw.data.disk.total_gb} percent={hw.data.disk.percent} unit="GB" />
                <Row k="GPU" v={<span>{hw.data.gpu.name} · {hw.data.gpu.vram_gb}GB</span>} />
                <Row k="Acceleration" v={hw.data.gpu_acceleration_confirmed ? <Badge tone="ok">confirmed</Badge> : <Badge tone="warn">unconfirmed</Badge>} />
              </div>
              {hw.data.warning && <div className="banner banner-warn mt">⚠ {hw.data.warning}</div>}
            </>
          )}
        </Card>

        <Card title="Local Models" hint="Models powering the local council">
          {mh.loading ? <Loading rows={4} /> : mh.error ? <ErrorState message={mh.error} onRetry={mh.reload} /> : mh.data && (
            <>
              <div className="kv">
                <Row k="Ollama" v={<ServiceBadge s={mh.data.ollama_status} />} />
                <Row k="Installed" v={<span className="muted">{mh.data.installed_models.length ? mh.data.installed_models.join(", ") : "—"}</span>} />
                <Row k="Required" v={<span className="muted">{mh.data.required_models.join(", ")}</span>} />
                <Row k="Missing" v={mh.data.missing_models.length ? <span className="warn">{mh.data.missing_models.join(", ")}</span> : <Badge tone="ok">none</Badge>} />
              </div>
              {mh.data.missing_models.length > 0 && (
                <div className="banner banner-warn mt">⚠ These models are missing — the local council is degraded until they are installed.</div>
              )}
              {mh.data.missing_hint && mh.data.missing_hint.length > 0 && (
                <>
                  <div className="hint mt" style={{ display: "block", marginBottom: 4 }}>How to install</div>
                  <div className="codeblock">{mh.data.missing_hint.map((c) => <div key={c}>{c}</div>)}</div>
                </>
              )}
            </>
          )}
        </Card>
      </div>

      {/* TIER 2 — governed activity & reference data */}
      <SectionLabel>GOVERNED ACTIVITY</SectionLabel>
      <div className="grid">
        <Card title="Workflow Runs" hint="Automation triggered under governance">
          {wf.loading ? <Loading rows={4} /> : wf.error ? <ErrorState message={wf.error} onRetry={wf.reload} />
            : wf.data?.runs?.length ? <DataTable columns={wfCols} rows={wf.data.runs} rowKey={(r) => r.id} />
            : <Empty icon={RunsIcon} title="No automation has run yet"
                hint="Governed workflows triggered from the AI Council or Operations will appear here with their status and time — execution always requires permission and approval." />}
        </Card>

        <Card title="Tool Registry" hint="Governed registry — read-only">
          {tools.loading ? <Loading rows={4} /> : tools.error ? <ErrorState message={tools.error} onRetry={tools.reload} />
            : tools.data?.tools?.length
              ? <><DataTable columns={toolCols} rows={tools.data.tools} rowKey={(r) => r.name} />
                  <div className="note mt">Tools are registry-governed; execution requires permission + approval and is not available here.</div></>
              : <Empty icon={ToolsIcon} title="No tools registered"
                  hint="Tools are added to the governed registry by the backend; once registered they show their risk level, required permission, and whether each call is audited. They can never be executed from this page." />}
        </Card>
      </div>
    </div>
  );
}
