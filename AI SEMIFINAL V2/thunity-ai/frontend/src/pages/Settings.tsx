import { api } from "../api/client";
import { PageHeader, Card, Badge, Row, ServiceBadge, Loading, ErrorState, useAsync } from "../components/ui";
import type { LocalOnlyHealth } from "../types";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";
const N8N_URL = "http://localhost:5678";

export default function Settings() {
  const lo = useAsync<LocalOnlyHealth>(() => api.localOnly() as Promise<LocalOnlyHealth>);

  return (
    <div className="page">
      <PageHeader title="Settings & Governance"
        subtitle="Read-only configuration and operating posture. Nothing on this page changes the backend." />

      <Card title="System Mode" hint="/api/health/local-only">
        <div className="muted small" style={{ marginBottom: "8px" }}>
          Local-only mode keeps all reasoning, embeddings, and data on this machine — no external AI/cloud provider is used in the core path.
        </div>
        {lo.loading ? <Loading /> : lo.error ? <ErrorState message={lo.error} /> : lo.data && (
          <div className="kv">
            <Row k="Local-only mode" v={lo.data.local_only_mode ? <Badge tone="ok">on</Badge> : <Badge tone="bad">off</Badge>} />
            <Row k="Compliance status" v={<Badge tone={lo.data.status === "compliant" ? "ok" : lo.data.status === "warning" ? "warn" : "bad"}>{lo.data.status}</Badge>} />
            <Row k="External AI providers" v={lo.data.external_ai_providers_enabled ? <Badge tone="bad">ENABLED</Badge> : <Badge tone="ok">disabled</Badge>} />
            <Row k="Ollama" v={<ServiceBadge s={lo.data.ollama_status} />} />
            <Row k="Database" v={<ServiceBadge s={lo.data.database} />} />
            <Row k="n8n" v={<ServiceBadge s={lo.data.n8n} />} />
          </div>
        )}
      </Card>

      <Card title="API / Frontend Connection">
        <div className="kv">
          <Row k="Backend API base URL" v={<span className="mono">{API_BASE}</span>} />
        </div>
        <div className="muted small" style={{ marginTop: "8px" }}>
          This is the backend URL the browser calls (from <span className="mono">VITE_API_URL</span>). No secrets are shown here.
        </div>
      </Card>

      <Card title="n8n Configuration">
        <div className="kv">
          <Row k="n8n (local)" v={<span className="mono">{N8N_URL}</span>} />
          <Row k="Webhook pattern" v={<span className="mono">N8N_URL + "/webhook/" + workflow_name</span>} />
        </div>
        <div className="muted small" style={{ marginTop: "8px" }}>
          n8n is the local automation engine. The Workflow service triggers a backend-configured webhook for each allow-listed workflow. Example webhook paths:
        </div>
        <pre className="raw small">/webhook/generate_local_report
/webhook/create_daily_brief
/webhook/export_decision_to_markdown</pre>
        <div className="muted small">The exact configured <span className="mono">N8N_URL</span> lives in the backend <span className="mono">.env</span> and is never exposed in the UI.</div>
        <div className="banner banner-warn mt">⚠ Do not paste secrets or tokens into public webhook names.</div>
      </Card>

      <Card title="Webhook Setup Guide">
        <ol className="bullets">
          <li>Open n8n at <span className="mono">{N8N_URL}</span>.</li>
          <li>Create a new workflow.</li>
          <li>Add a <b>Webhook</b> trigger node.</li>
          <li>Set the webhook <b>path</b> equal to an allow-listed workflow name.</li>
          <li>Example path: <span className="mono">generate_local_report</span>.</li>
          <li>Activate the workflow.</li>
          <li>Return to the <a className="link" href="/workflows">Workflows</a> page.</li>
          <li>Trigger only low/medium workflows from the UI.</li>
          <li>High-risk workflows remain approval-gated / disabled in the current UI.</li>
        </ol>
      </Card>

      <Card title="Models / Ollama">
        <div className="muted small">
          Local model status is visible in <a className="link" href="/observatory">System Observatory</a>.
          Do not delete or reinstall models from this UI. A “missing model” warning means the app cannot currently
          see the model — not that you must reinstall it.
        </div>
      </Card>

      <Card title="Safety & Governance">
        <ul className="bullets">
          <li>Tool execution is disabled in this UI.</li>
          <li>High-risk workflow trigger is disabled in this UI.</li>
          <li>Approval Gate resolves request status only — it does not execute the underlying action.</li>
          <li>Decision “Mark as Executed” writes ledger status + audit only.</li>
          <li>No auto-execute and no auto-approve — every risky action needs an explicit founder click.</li>
        </ul>
      </Card>

      <Card title="Future Settings">
        <div className="muted small">
          Editable preferences for n8n, webhooks, and model selection are planned for a later sprint. This page is
          intentionally read-only for now.
        </div>
      </Card>
    </div>
  );
}
