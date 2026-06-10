import { api } from "../api/client";
import { Card, Row, Badge, ServiceBadge, Loading, ErrorState, useAsync } from "../components/ui";
import type { HardwareStatus, LocalOnlyHealth, ModelHealth } from "../types";

export default function Observatory() {
  const lo = useAsync<LocalOnlyHealth>(() => api.localOnly() as Promise<LocalOnlyHealth>);
  const hw = useAsync<HardwareStatus>(() => api.hardware() as Promise<HardwareStatus>);
  const mh = useAsync<ModelHealth>(() => api.modelsHealth() as Promise<ModelHealth>);

  return (
    <div className="page">
      <div className="page-head"><h1>System Observatory</h1>
        <p className="muted">Live local infrastructure & model readiness. Models are never auto-downloaded.</p></div>
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
              {mh.data.missing_hint && (
                <div className="codeblock">{mh.data.missing_hint.map((c) => <div key={c}>{c}</div>)}</div>
              )}
              <table className="table mt">
                <thead><tr><th>Role</th><th>Model</th><th>Installed</th></tr></thead>
                <tbody>{mh.data.roles.map((r) => (
                  <tr key={r.role}><td>{r.role}</td><td>{r.model}{r.heavy && <span className="warn small"> (heavy)</span>}</td>
                    <td>{r.installed ? <Badge tone="ok">yes</Badge> : <Badge tone="bad">no</Badge>}</td></tr>
                ))}</tbody>
              </table>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
