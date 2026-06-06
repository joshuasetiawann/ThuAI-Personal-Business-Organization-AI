import { api } from "../api/client";
import { PageHeader, Card, RiskBadge, Badge, Loading, ErrorState, Empty, useAsync } from "../components/ui";
import type { ToolInfo } from "../types";

export default function Tools() {
  const tools = useAsync<{ tools: ToolInfo[] }>(() => api.tools() as Promise<{ tools: ToolInfo[] }>);

  return (
    <div className="page">
      <PageHeader title="Tool Registry"
        subtitle="Tools the AI Council may use, with their risk tier and required permission." />
      <div className="note">Tool execution is intentionally disabled in this UI. This page is registry visibility only.</div>

      <Card title="Registered tools" hint="/api/tools">
        {tools.loading ? <Loading /> : tools.error ? <ErrorState message={tools.error} />
          : tools.data?.tools?.length
            ? <div className="results">{tools.data.tools.map((t) => (
                <div key={t.name} className="result">
                  <div className="result-head">
                    <span className="mono">{t.name}</span>
                    <RiskBadge risk={t.risk_level} />
                    <span className="muted small">{t.required_permission}</span>
                    <Badge tone={t.audit ? "ok" : "muted"}>{t.audit ? "audited" : "not audited"}</Badge>
                  </div>
                  {t.description && <div className="muted small" style={{ marginTop: "4px" }}>{t.description}</div>}
                  {t.input_schema && Object.keys(t.input_schema).length > 0 && (
                    <details style={{ marginTop: "6px" }}>
                      <summary className="muted small" style={{ cursor: "pointer" }}>input schema</summary>
                      <pre className="raw small">{JSON.stringify(t.input_schema, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}</div>
            : <Empty label="No tools registered." />}
      </Card>
    </div>
  );
}
