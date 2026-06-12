import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import {
  PageHero, StatTiles, StatTile, SectionLabel, Card, Badge, Row,
  ServiceBadge, Loading, Empty, useAsync,
} from "../components/ui";
import type { LocalOnlyHealth } from "../types";

const WRENCH_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a3.5 3.5 0 0 0-4.6 4.6L4 17l3 3 6.1-6.1a3.5 3.5 0 0 0 4.6-4.6l-2.3 2.3-2-2Z" />
  </svg>
);
const EYE_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
  </svg>
);
const CHEVRON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";
const N8N_URL = "http://localhost:5678";

const SETTINGS_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12h2.5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
  </svg>
);

const RefreshIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" />
  </svg>
);

const ShieldIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v6c0 4-3 6.5-7 9-4-2.5-7-5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

// Founder-tunable: auto-ingest every conversation into the Knowledge base.
function AutoIngestToggle() {
  const [val, setVal] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.runtimeSettings()
      .then((r) => setVal(!!r.auto_ingest_conversations))
      .catch(() => setErr("Could not load settings."));
  }, []);
  const toggle = async () => {
    if (val === null || saving) return;
    const next = !val;
    setSaving(true); setErr(null);
    try {
      const r = await api.setRuntimeSettings({ auto_ingest_conversations: next });
      setVal(!!r.auto_ingest_conversations);
    } catch (e: any) {
      setErr(e?.message || "Failed to save.");
    } finally { setSaving(false); }
  };
  const on = !!val;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {err && <span className="small" style={{ color: "var(--down, #ff6b6b)" }}>{err}</span>}
      <button role="switch" aria-checked={on} onClick={toggle} disabled={val === null || saving}
        title={on ? "Auto-ingest on" : "Auto-ingest off"}
        style={{
          width: 46, height: 26, borderRadius: 999, position: "relative", padding: 0,
          cursor: val === null || saving ? "default" : "pointer", flex: "0 0 auto",
          border: "1px solid rgba(255,255,255,0.12)",
          background: on ? "linear-gradient(90deg, rgba(79,139,255,.95), rgba(139,92,246,.95))"
                         : "rgba(255,255,255,0.08)",
          transition: "background .2s", opacity: val === null || saving ? 0.6 : 1,
        }}>
        <span style={{
          position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20,
          borderRadius: "50%", background: "#fff", transition: "left .2s",
          boxShadow: "0 1px 3px rgba(0,0,0,.4)",
        }} />
      </button>
    </div>
  );
}

// Manual "sync now" for the brain folder → Knowledge.
function BrainFolderSync() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sync = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api.syncFolder();
      if (!r.ok) { setMsg("Folder not ready (is it mounted?)."); return; }
      setMsg(`Synced: +${r.added ?? 0} new · ${r.updated ?? 0} updated · ${r.unchanged ?? 0} unchanged · ${r.removed ?? 0} removed (${r.indexed ?? 0} files indexed).`);
    } catch (e: any) {
      setMsg(e?.message || "Sync failed (is Ollama down?).");
    } finally { setBusy(false); }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button className="btn" style={{ width: "auto" }} disabled={busy} onClick={sync}>
        {busy ? "Syncing…" : "Sync now"}
      </button>
      {msg && <span className="muted small">{msg}</span>}
    </div>
  );
}

export default function Settings() {
  const lo = useAsync<LocalOnlyHealth>(() => api.localOnly() as Promise<LocalOnlyHealth>);
  const d = lo.data;

  // ── StatTile values, derived ONLY from the already-fetched health payload ──
  const complianceTone: "default" | "warn" | "bad" =
    d?.status === "compliant" ? "default" : d?.status === "warning" ? "warn" : "bad";
  const services = d ? [d.ollama_status, d.database, d.n8n] : [];
  const servicesOnline = services.filter((s) => /online|local/i.test(s)).length;

  // Honest posture copy — conditional on the REAL status (never claim "no external
  // AI" while a declared frontier model is enabled).
  const isHybrid = !!d && (d.status === "hybrid" || d.external_ai_providers_enabled || d.frontier_enabled);
  const modeDesc = !d
    ? "Local-first by default; any frontier use is declared, key-gated, and labelled."
    : isHybrid
      ? "Local-first: reasoning, embeddings, and data stay on this machine by default. For heavy or strategic work a single declared, key-gated frontier model (Claude / OpenRouter) is used and is always labelled — never a silent cloud fallback. With no frontier key configured, the system runs 100% locally."
      : "Local-only: all reasoning, embeddings, and data stay on this machine — no external AI / cloud provider is used.";

  return (
    <div className="page">
      <PageHero
        icon={SETTINGS_ICON}
        eyebrow="GOVERNANCE"
        title="Settings & Governance"
        desc="Your system's operating posture and safety rulebook — see at a glance whether Thunity is running fully on this machine, which services are healthy, and what guardrails protect every risky action."
        actions={<Badge tone="muted">Read-only</Badge>}
      />

      {/* ── Summary tiles (computed from /api/health/local-only) ── */}
      <StatTiles>
        <StatTile
          label="COMPLIANCE"
          value={lo.loading ? "—" : lo.error ? "—" : (d?.status ?? "—")}
          hint="overall posture"
          tone={lo.loading || lo.error ? "muted" : complianceTone}
        />
        <StatTile
          label="LOCAL-ONLY MODE"
          value={lo.loading ? "—" : lo.error ? "—" : (d?.local_only_mode ? "On" : "Off")}
          hint="core reasoning on this machine"
          tone={lo.loading || lo.error ? "muted" : d?.local_only_mode ? "accent" : "warn"}
        />
        <StatTile
          label="EXTERNAL PROVIDERS"
          value={lo.loading ? "—" : lo.error ? "—" : (d?.external_ai_providers_enabled ? "Enabled" : "Disabled")}
          hint="declared frontier for heavy work"
          tone={lo.loading || lo.error ? "muted" : d?.external_ai_providers_enabled ? "bad" : "default"}
        />
        <StatTile
          label="CORE SERVICES"
          value={lo.loading ? "—" : lo.error ? "—" : `${servicesOnline} / 3`}
          hint="online"
          tone={lo.loading || lo.error ? "muted" : servicesOnline === 3 ? "default" : "warn"}
        />
      </StatTiles>

      {/* ════════ SECTION — System & diagnostics (moved here from the sidebar) ════════ */}
      <SectionLabel hint="moved here to keep the sidebar focused">SYSTEM &amp; DIAGNOSTICS</SectionLabel>
      <div className="card-list">
        <Link to="/tools" className="card-row clickable">
          <span className="card-row-meta" style={{ color: "var(--accent-2)" }}>{WRENCH_ICON}</span>
          <div className="card-row-main">
            <div className="card-row-title">Tool Registry</div>
            <div className="card-row-sub">The capabilities the AI Council may use — risk tier &amp; required permission per tool.</div>
          </div>
          <span className="card-row-meta">{CHEVRON}</span>
        </Link>
        <Link to="/observatory" className="card-row clickable">
          <span className="card-row-meta" style={{ color: "var(--accent-2)" }}>{EYE_ICON}</span>
          <div className="card-row-main">
            <div className="card-row-title">System Observatory</div>
            <div className="card-row-sub">Live services, hardware, local models, workflow runs &amp; the tool registry — read-only.</div>
          </div>
          <span className="card-row-meta">{CHEVRON}</span>
        </Link>
      </div>

      {/* ════════ SECTION — Knowledge & memory (editable) ════════ */}
      <SectionLabel hint="frontier-style long-term memory over your chats">KNOWLEDGE &amp; MEMORY</SectionLabel>
      <Card title="Conversations → Knowledge">
        <div className="muted small" style={{ marginBottom: 12 }}>
          When on, every conversation (Fast Chat &amp; AI Council) is automatically indexed into your
          local Knowledge base, so the AI can recall relevant past chats as grounding. Honest by design:
          stored locally as a <b>low-trust</b> source, secrets (passwords/tokens) are redacted before
          embedding, every ingest is audited, and it runs in the background without blocking replies.
          The governance ledgers (decisions / tasks / approvals) are never touched.
        </div>
        <div className="card-row">
          <div className="card-row-main">
            <div className="card-row-title">Auto-ingest every conversation</div>
            <div className="card-row-sub">turn off to index only the chats you pick (a “Save to Knowledge” button on each conversation)</div>
          </div>
          <div className="card-row-meta"><AutoIngestToggle /></div>
        </div>
        <div className="muted small" style={{ marginTop: 10 }}>
          Manage what’s indexed in <Link className="link" to="/knowledge">Knowledge Vault</Link>
          {" "}· save individual chats from <Link className="link" to="/conversations">Conversations</Link>.
        </div>
      </Card>

      <Card title="Brain folder — the folder the AI reads">
        <div className="muted small" style={{ marginBottom: 12 }}>
          Drop your files (.md, .txt, .pdf, .csv, .json, etc.) into{" "}
          <span className="mono">~/Documents/thunity-conversations/</span> on your Mac — the AI will
          <b> read them</b> as knowledge, indexed automatically (~every 30 seconds). Edit/delete a file →
          the knowledge follows. The automatic chat mirror lives in the{" "}
          <span className="mono">chats/</span> subfolder and is skipped (never duplicated). Default trust is{" "}
          <b>medium</b>; manage it in the <Link className="link" to="/knowledge">Knowledge Vault</Link>.
        </div>
        <BrainFolderSync />
      </Card>

      {/* ════════ SECTION A — Live posture ════════ */}
      <SectionLabel>LIVE POSTURE</SectionLabel>

      <Card
        title="System Mode"
        hint="/api/health/local-only"
        actions={
          <button className="btn" style={{ width: "auto" }} onClick={lo.reload} title="Re-read live health">
            {RefreshIcon}<span style={{ marginLeft: 6 }}>Refresh</span>
          </button>
        }
      >
        <div className="muted small" style={{ marginBottom: "12px" }}>
          {modeDesc}
        </div>

        {lo.loading ? (
          <Loading rows={4} />
        ) : lo.error ? (
          <Empty
            icon={SETTINGS_ICON}
            title="Can't read system posture right now"
            hint="Thunity couldn't reach the health endpoint — the backend may be offline or restarting. Posture and service status will appear here once it responds."
            actions={
              <button className="btn" style={{ width: "auto" }} onClick={lo.reload}>Try again</button>
            }
          />
        ) : d && (
          <>
            <div className="section-label" style={{ marginTop: 0 }}><span>POLICY POSTURE</span></div>
            <div className="card-list">
              <div className="card-row">
                <div className="card-row-main"><div className="card-row-title">Local-only mode</div>
                  <div className="card-row-sub">core reasoning &amp; embeddings stay on this machine</div></div>
                <div className="card-row-meta">{d.local_only_mode ? <Badge tone="ok">on</Badge> : <Badge tone="bad">off</Badge>}</div>
              </div>
              <div className="card-row">
                <div className="card-row-main"><div className="card-row-title">Compliance status</div>
                  <div className="card-row-sub">overall governance posture</div></div>
                <div className="card-row-meta">
                  <Badge tone={d.status === "compliant" ? "ok" : d.status === "warning" ? "warn" : "bad"}>{d.status}</Badge>
                </div>
              </div>
              <div className="card-row">
                <div className="card-row-main"><div className="card-row-title">External AI providers</div>
                  <div className="card-row-sub">declared, key-gated frontier · labelled, never silent</div></div>
                <div className="card-row-meta">
                  {d.external_ai_providers_enabled ? <Badge tone="bad">ENABLED</Badge> : <Badge tone="ok">disabled</Badge>}
                </div>
              </div>
              {d.frontier_enabled && (
                <div className="card-row">
                  <div className="card-row-main"><div className="card-row-title">Frontier (hybrid)</div>
                    <div className="card-row-sub">
                      {(d.frontier_providers && d.frontier_providers.length > 0)
                        ? d.frontier_providers.join(", ") : "frontier provider"}
                      {d.frontier_model ? <> · <span className="mono">{d.frontier_model}</span></> : null}
                    </div></div>
                  <div className="card-row-meta"><Badge tone="muted">declared &amp; labelled</Badge></div>
                </div>
              )}
            </div>

            <div className="section-label"><span>CORE SERVICES</span></div>
            <div className="card-list">
              <div className="card-row">
                <div className="card-row-main"><div className="card-row-title">Ollama</div>
                  <div className="card-row-sub">local model runtime</div></div>
                <div className="card-row-meta"><ServiceBadge s={d.ollama_status} /></div>
              </div>
              <div className="card-row">
                <div className="card-row-main"><div className="card-row-title">Database</div>
                  <div className="card-row-sub">structured store</div></div>
                <div className="card-row-meta"><ServiceBadge s={d.database} /></div>
              </div>
              <div className="card-row">
                <div className="card-row-main"><div className="card-row-title">Vector store</div>
                  <div className="card-row-sub">embeddings &amp; retrieval</div></div>
                <div className="card-row-meta"><ServiceBadge s={d.vector_store} /></div>
              </div>
              <div className="card-row">
                <div className="card-row-main"><div className="card-row-title">n8n</div>
                  <div className="card-row-sub">local automation engine</div></div>
                <div className="card-row-meta"><ServiceBadge s={d.n8n} /></div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ════════ SECTION B — Connections ════════ */}
      <SectionLabel>CONNECTIONS</SectionLabel>

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
          n8n is the local automation engine. The Workflow service triggers a backend-configured webhook for each allow-listed workflow.
        </div>
        <div className="section-label"><span>EXAMPLE WEBHOOK PATHS</span></div>
        <div className="chip-row">
          <span className="mono chip">/webhook/generate_local_report</span>
          <span className="mono chip">/webhook/create_daily_brief</span>
          <span className="mono chip">/webhook/export_decision_to_markdown</span>
        </div>
        <div className="muted small" style={{ marginTop: "10px" }}>
          The exact configured <span className="mono">N8N_URL</span> lives in the backend <span className="mono">.env</span> and is never exposed in the UI.
        </div>
        <div className="banner banner-warn mt">⚠ Do not paste secrets or tokens into public webhook names.</div>
      </Card>

      {/* ════════ SECTION C — Guardrails & guidance ════════ */}
      <SectionLabel>GUARDRAILS &amp; GUIDANCE</SectionLabel>

      <Card title="Safety & Governance">
        <div className="card-list">
          {[
            "Tool execution is disabled in this UI.",
            "High-risk workflow trigger is disabled in this UI.",
            "Approval Gate resolves request status only — it does not execute the underlying action.",
            "Decision “Mark as Executed” writes ledger status + audit only.",
            "No auto-execute and no auto-approve — every risky action needs an explicit founder click.",
          ].map((rule, i) => (
            <div className="card-row" key={i}>
              <div className="card-row-meta" style={{ color: "var(--aurora-indigo, #818cf8)" }}>{ShieldIcon}</div>
              <div className="card-row-main"><div className="card-row-title" style={{ fontWeight: 500 }}>{rule}</div></div>
            </div>
          ))}
        </div>
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

      <Card title="Future Settings">
        <div className="muted small">
          Editable preferences for n8n, webhooks, and model selection are planned for a later sprint. This page is
          intentionally read-only for now.
        </div>
      </Card>
    </div>
  );
}
