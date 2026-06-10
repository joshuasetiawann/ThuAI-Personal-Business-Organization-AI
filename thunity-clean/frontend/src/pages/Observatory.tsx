import { api } from "../api/client";
import { PageHeader, Card, Row, Badge, StatusBadge, RiskBadge, ServiceBadge, DataTable,
  Loading, ErrorState, Empty, useAsync, type Column } from "../components/ui";
import type { HardwareStatus, LocalOnlyHealth, ModelHealth, WorkflowRun, Tool } from "../types";

const wfCols: Column<WorkflowRun>[] = [
  { key: "workflow_name", label: "Workflow", render: (r) => <span className="strong">{r.workflow_name}</span> },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "created_at", label: "When", render: (r) => <span className="muted small">{new Date(r.created_at).toLocaleString()}</span> },
];
const toolCols: Column<Tool>[] = [
  { key: "name", label: "Tool", render: (r) => <span className="mono">{r.name}</span> },
  { key: "risk_level", label: "Risk", render: (r) => <RiskBadge risk={r.risk_level} /> },
  { key: "required_permission", label: "Permission", render: (r) => <span className="muted small">{r.required_permission}</span> },
  { key: "audit", label: "Audited", render: (r) => r.audit ? <Badge tone="ok">yes</Badge> : <Badge tone="muted">no</Badge> },
];

export default function Observatory() {
  const lo = useAsync<LocalOnlyHealth>(() => api.localOnly() as Promise<LocalOnlyHealth>);
  const hw = useAsync<HardwareStatus>(() => api.hardware() as Promise<HardwareStatus>);
  const mh = useAsync<ModelHealth>(() => api.modelsHealth() as Promise<ModelHealth>);
  const wf = useAsync<{ runs: WorkflowRun[] }>(() => api.workflowRuns() as Promise<{ runs: WorkflowRun[] }>);
  const tools = useAsync<{ tools: Tool[] }>(() => api.tools() as Promise<{ tools: Tool[] }>);

  return (
    <div className="page">
      <PageHeader title="System Observatory" subtitle="Live local infrastructure, model readiness, governed automation & tools — read-only." />
      <div className="grid">
        <Card title="Services" hint="/api/health/local-only">
          {lo.loading ? <Loading /> : lo.error ? <ErrorState message={lo.error} /> : lo.data && (
            <div className="kv">
              <Row k="Ollama" v={<ServiceBadge s={lo.data.ollama_status} />} />
              <Row k="Database" v={<ServiceBadge s={lo.data.database} />} />
              <Row k="n8n" v={<ServiceBadge s={lo.data.n8n} />} />
              <Row k="Vector store" v={<span className="muted">{lo.data.vector_store}</span>} />
              <Row k="Compliance" v={<Badge tone={lo.data.status === "compliant" ? "ok" : "warn"}>{lo.data.status}</Badge>} />
            </div>
          )}
        </Card>

        <Card title="Hardware" hint="/api/hardware/status">
          {hw.loading ? <Loading /> : hw.error ? <ErrorState message={hw.error} /> : hw.data && (
            <>
              <div className="kv">
                <Row k="CPU" v={<span>{hw.data.cpu.name} · {hw.data.cpu.percent}%</span>} />
                <Row k="RAM" v={<span>{hw.data.ram.used_gb}/{hw.data.ram.total_gb} GB ({hw.data.ram.percent}%)</span>} />
                <Row k="Disk" v={<span>{hw.data.disk.used_gb}/{hw.data.disk.total_gb} GB ({hw.data.disk.percent}%)</span>} />
                <Row k="GPU" v={<span>{hw.data.gpu.name} · {hw.data.gpu.vram_gb}GB</span>} />
                <Row k="Acceleration" v={hw.data.gpu_acceleration_confirmed ? <Badge tone="ok">confirmed</Badge> : <Badge tone="warn">unconfirmed</Badge>} />
              </div>
              {hw.data.warning && <div className="banner banner-warn mt">⚠ {hw.data.warning}</div>}
            </>
          )}
        </Card>

        <Card title="Local Models" hint="/api/models/health">
          {mh.loading ? <Loading /> : mh.error ? <ErrorState message={mh.error} /> : mh.data && (
            <>
              <div className="kv">
                <Row k="Ollama" v={<ServiceBadge s={mh.data.ollama_status} />} />
                <Row k="Required" v={<span className="muted">{mh.data.required_models.join(", ")}</span>} />
                <Row k="Missing" v={mh.data.missing_models.length ? <span className="warn">{mh.data.missing_models.join(", ")}</span> : <Badge tone="ok">none</Badge>} />
              </div>
              {mh.data.missing_hint && <div className="codeblock">{mh.data.missing_hint.map((c) => <div key={c}>{c}</div>)}</div>}
            </>
          )}
        </Card>

        <Card title="Workflow Runs" hint="/api/workflows/runs">
          {wf.loading ? <Loading /> : wf.error ? <ErrorState message={wf.error} />
            : wf.data?.runs?.length ? <DataTable columns={wfCols} rows={wf.data.runs} rowKey={(r) => r.id} />
            : <Empty label="No workflow runs yet." />}
        </Card>

        <Card title="Tool Registry" hint="/api/tools">
          {tools.loading ? <Loading /> : tools.error ? <ErrorState message={tools.error} />
            : tools.data?.tools?.length
              ? <><DataTable columns={toolCols} rows={tools.data.tools} rowKey={(r) => r.name} />
                  <div className="note mt">Tools are registry-governed; execution requires permission + approval and is not available here.</div></>
              : <Empty label="No tools registered." />}
        </Card>
      </div>
    </div>
  );
}
