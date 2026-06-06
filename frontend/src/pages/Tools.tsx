import { api } from "../api/client";
import {
  PageHero, StatTiles, StatTile, SectionLabel, Card,
  RiskBadge, Badge, Loading, ErrorState, Empty, useAsync,
} from "../components/ui";
import type { ToolInfo } from "../types";

const ToolsIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a3.5 3.5 0 0 0-4.6 4.6L4 17l3 3 6.1-6.1a3.5 3.5 0 0 0 4.6-4.6l-2.3 2.3-2-2Z" />
  </svg>
);

const RISK_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const GROUPS: { key: string; label: string; risks: string[] }[] = [
  { key: "high", label: "High risk", risks: ["critical", "high"] },
  { key: "medium", label: "Medium risk", risks: ["medium"] },
  { key: "low", label: "Low risk", risks: ["low"] },
];

function ToolCard({ t }: { t: ToolInfo }) {
  const schemaKeys = t.input_schema ? Object.keys(t.input_schema) : [];
  return (
    <div className="result">
      <div className="result-head">
        <span className="mono">{t.name}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
          <RiskBadge risk={t.risk_level} />
          <Badge tone={t.audit ? "ok" : "warn"}>{t.audit ? "Audited" : "Not audited"}</Badge>
        </div>
      </div>
      {t.description && <div style={{ marginTop: "4px" }}>{t.description}</div>}
      <div className="muted small" style={{ marginTop: "6px" }}>
        {t.required_permission
          ? <>Requires: <span className="mono">{t.required_permission}</span></>
          : "No special permission"}
      </div>
      {schemaKeys.length > 0 && (
        <details style={{ marginTop: "6px" }}>
          <summary className="muted small" style={{ cursor: "pointer" }}>
            Input schema · {schemaKeys.length} field{schemaKeys.length === 1 ? "" : "s"}
          </summary>
          <div className="muted small" style={{ margin: "6px 0", display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {schemaKeys.map((k) => {
              const f = (t.input_schema as Record<string, unknown>)[k] as { type?: string } | undefined;
              const type = f && typeof f === "object" && typeof f.type === "string" ? f.type : "—";
              return <span key={k}><span className="mono">{k}</span>: {type}</span>;
            })}
          </div>
          <pre className="raw small">{JSON.stringify(t.input_schema, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

export default function Tools() {
  const tools = useAsync<{ tools: ToolInfo[] }>(() => api.tools() as Promise<{ tools: ToolInfo[] }>);

  const list = tools.data?.tools ?? [];
  const total = list.length;
  const low = list.filter((t) => (t.risk_level || "").toLowerCase() === "low").length;
  const medium = list.filter((t) => (t.risk_level || "").toLowerCase() === "medium").length;
  const high = list.filter((t) => ["high", "critical"].includes((t.risk_level || "").toLowerCase())).length;
  const audited = list.filter((t) => t.audit).length;
  const unaudited = total - audited;
  const permissions = new Set(list.map((t) => t.required_permission).filter(Boolean)).size;
  const unauditedHighRisk = list.some(
    (t) => !t.audit && ["high", "critical"].includes((t.risk_level || "").toLowerCase()),
  );

  return (
    <div className="page">
      <PageHero
        icon={ToolsIcon}
        eyebrow="GOVERNANCE"
        title="Tool Registry"
        desc="The capabilities the AI Council is allowed to use — each with its risk tier and the permission it requires — so you can see exactly what the system can reach for and why each action is gated."
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="badge badge-muted">Read-only · execution disabled</span>
            <button className="btn" style={{ width: "auto" }} onClick={tools.reload}>Reload</button>
          </div>
        }
      />

      {tools.data && total > 0 && (
        <StatTiles>
          <StatTile label="REGISTERED TOOLS" value={total} hint="capabilities in the registry" tone="accent" />
          <StatTile
            label="RISK"
            value={`${low} low · ${medium} medium · ${high} high`}
            hint="by risk tier"
            tone={high > 0 ? "warn" : "default"}
          />
          <StatTile
            label="AUDITED"
            value={`${audited} / ${total}`}
            hint={unaudited > 0 ? `${unaudited} not audited` : "all audited"}
            tone={unauditedHighRisk ? "bad" : unaudited > 0 ? "warn" : "default"}
          />
          <StatTile label="PERMISSIONS" value={permissions} hint="distinct gates required" tone="violet" />
        </StatTiles>
      )}

      <Card title="Registered tools" hint="/api/tools">
        {tools.loading ? <Loading rows={4} />
          : tools.error ? <ErrorState message={tools.error} onRetry={tools.reload} />
          : total > 0
            ? <>
                {GROUPS.map((g) => {
                  const groupTools = list
                    .filter((t) => g.risks.includes((t.risk_level || "").toLowerCase()))
                    .sort((a, b) => (RISK_RANK[(b.risk_level || "").toLowerCase()] ?? 0)
                      - (RISK_RANK[(a.risk_level || "").toLowerCase()] ?? 0));
                  if (groupTools.length === 0) return null;
                  return (
                    <div key={g.key}>
                      <SectionLabel hint={`${groupTools.length}`}>{g.label}</SectionLabel>
                      <div className="results">
                        {groupTools.map((t) => <ToolCard key={t.name} t={t} />)}
                      </div>
                    </div>
                  );
                })}
                {/* Any tools with an unrecognised risk tier still render, never dropped */}
                {(() => {
                  const known = new Set(["critical", "high", "medium", "low"]);
                  const other = list.filter((t) => !known.has((t.risk_level || "").toLowerCase()));
                  if (other.length === 0) return null;
                  return (
                    <div>
                      <SectionLabel hint={`${other.length}`}>Other</SectionLabel>
                      <div className="results">
                        {other.map((t) => <ToolCard key={t.name} t={t} />)}
                      </div>
                    </div>
                  );
                })()}
              </>
            : <Empty
                icon={ToolsIcon}
                title="No tools registered"
                hint="When the AI Council is granted a capability, it appears here with its risk tier and the permission it requires. The registry is read-only — execution stays disabled in this UI."
              />}
      </Card>
    </div>
  );
}
