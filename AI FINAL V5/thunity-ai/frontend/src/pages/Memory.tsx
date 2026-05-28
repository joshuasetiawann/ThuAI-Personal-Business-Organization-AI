import { useRef, useState } from "react";
import { api } from "../api/client";
import { PageHero, StatTiles, StatTile, SectionLabel, Card, Badge, Loading, ErrorState, Empty, useAsync } from "../components/ui";
import type { MemoryList, MemoryItem } from "../types";

// /memory nav icon (inner paths copied from AppShell NAV_ICONS["/memory"]).
const MemoryIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3a4 4 0 0 0-4 4v0a3 3 0 0 0-2 5.2A3 3 0 0 0 8 18a3 3 0 0 0 4 1 3 3 0 0 0 4-1 3 3 0 0 0 2-5.8A3 3 0 0 0 16 7v0a4 4 0 0 0-4-4Z" />
    <path d="M12 7v12" />
  </svg>
);

// Raw enum values are submitted verbatim; label/desc are display-only.
const KINDS: { value: string; label: string; desc: string }[] = [
  { value: "fact", label: "Fact", desc: "Something that's simply true about you" },
  { value: "preference", label: "Preference", desc: "How you like things done" },
  { value: "project", label: "Project", desc: "Something you're building or running" },
  { value: "person", label: "Person", desc: "Someone in your world" },
  { value: "goal", label: "Goal", desc: "An outcome you're working toward" },
  { value: "decision", label: "Decision", desc: "A choice you've already made" },
  { value: "constraint", label: "Constraint", desc: "A rule or limit Thunity must respect" },
];
const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

function kindTone(kind: string): "ok" | "warn" | "muted" {
  if (kind === "goal" || kind === "project" || kind === "decision") return "ok";
  if (kind === "constraint") return "warn";
  return "muted";
}

function ImportanceDots({ n }: { n: number }) {
  return (
    <span className="imp-dots" title={`importance ${n}/5`} aria-label={`importance ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={"imp-dot" + (i <= n ? " on" : "")} />)}
    </span>
  );
}

// Honest snapshot of the hybrid engine (no secrets — only whether a key is present).
// Relocated BELOW the memory list as a supporting "Engine & grounding" card.
function HybridCard() {
  const s = useAsync<any>(() => api.appSettings());
  const f = s.data?.frontier;
  return (
    <Card title="Engine & grounding" hint="local-first · optional frontier"
      actions={f?.enabled ? <Badge tone="ok">Hybrid active</Badge> : <Badge tone="muted">Local only</Badge>}>
      {s.loading ? <Loading rows={3} />
        : s.error ? <ErrorState message="Could not load engine settings." />
        : (
          <div className="hybrid-grid">
            <div className="hybrid-line">
              <span className="hybrid-k">Local engine</span>
              <span className="hybrid-v">Ollama · {s.data?.models?.fast || "local model"}</span>
            </div>
            <div className="hybrid-line">
              <span className="hybrid-k">Frontier engine</span>
              <span className="hybrid-v">
                {f?.enabled
                  ? <>{f.provider === "openrouter" ? "OpenRouter" : "Claude"} · {f.model} <span className="ok">(active)</span></>
                  : <span className="muted">not configured</span>}
              </span>
            </div>
            <div className="hybrid-line">
              <span className="hybrid-k">Routing</span>
              <span className="hybrid-v">{f?.auto_routing ? "Auto — quick → local · complex → frontier" : "Manual"}</span>
            </div>
            {!f?.enabled && (
              <div className="hybrid-note">
                To add a smarter remote brain, set <code>OPENROUTER_API_KEY</code> (free models available) or
                <code> ANTHROPIC_API_KEY</code> (Claude, paid) in <code>.env</code> and restart the backend.
                Until then every answer is produced locally. Memory grounding works either way.
              </div>
            )}
            {f?.enabled && (
              <div className="hybrid-note ok-note">
                Frontier answers are always grounded in your local memory + knowledge, and labelled
                <span className="prov-badge prov-frontier" style={{ marginLeft: 6 }}><span className="prov-dot" />Frontier · {f.provider === "openrouter" ? "OpenRouter" : "Claude"}</span> in chat.
                {f.provider === "openrouter" && <> Note: OpenRouter sends prompts to a third party — not local.</>}
              </div>
            )}
          </div>
        )}
    </Card>
  );
}

export default function Memory() {
  const mem = useAsync<MemoryList>(() => api.memories(200) as Promise<MemoryList>);
  // Hybrid status tile derives from the SAME endpoint HybridCard uses — no new endpoint.
  const settings = useAsync<any>(() => api.appSettings());
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("fact");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [confirming, setConfirming] = useState<string | null>(null);
  const addInput = useRef<HTMLInputElement | null>(null);

  const add = async () => {
    if (!content.trim() || busy) return;
    setBusy(true); setErr(null);
    try { await api.addMemory(content.trim(), kind, 3); setContent(""); mem.reload(); }
    catch (e: any) { setErr(e?.message || "Could not add memory."); }
    finally { setBusy(false); }
  };
  const forget = async (m: MemoryItem) => {
    try { await api.forgetMemory(m.id); mem.reload(); } catch { /* surfaced on reload */ }
    finally { setConfirming(null); }
  };
  const focusComposer = () => {
    addInput.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    addInput.current?.focus();
  };

  const items = mem.data?.memories || [];
  const total = mem.data?.total ?? 0;

  // All tile values come from already-fetched data; honest "—" while loading.
  const founderCount = items.filter((m) => m.source === "founder").length;
  const autoCount = items.length - founderCount;
  const grounding = items.filter((m) => m.use_count > 0);
  const totalUses = grounding.reduce((sum, m) => sum + (m.use_count || 0), 0);
  const priorityCount = items.filter((m) => m.importance >= 4).length;
  const ready = !!mem.data && !mem.loading;
  const frontier = settings.data?.frontier;
  const hybridOn = !!frontier?.enabled;

  // Client-side kind filter on already-fetched items (no refetch).
  const kindCounts: Record<string, number> = {};
  for (const m of items) kindCounts[m.kind] = (kindCounts[m.kind] || 0) + 1;
  const visible = filter === "all" ? items : items.filter((m) => m.kind === filter);

  return (
    <div className="page">
      <PageHero
        icon={MemoryIcon}
        eyebrow="KNOWLEDGE"
        title="Memory"
        desc="Thunity's private memory of you — durable facts, preferences, and constraints, curated locally and fed into every answer. Add what it should always remember, and forget what it shouldn't."
        actions={<button className="btn btn-primary" style={{ width: "auto" }} onClick={focusComposer}>Remember this</button>}
      />

      <StatTiles>
        <StatTile label="TOTAL REMEMBERED" tone="accent"
          value={ready ? total : "—"} hint={ready ? "durable memories" : "loading…"} />
        <StatTile label="FOUNDER-AUTHORED" tone="violet"
          value={ready ? founderCount : "—"}
          hint={ready ? `${autoCount} auto-captured` : "loading…"} />
        <StatTile label="ACTIVELY GROUNDING" tone="default"
          value={ready ? grounding.length : "—"}
          hint={ready ? `${totalUses}× used in answers` : "loading…"} />
        <StatTile label="HIGH IMPORTANCE" tone="warn"
          value={ready ? priorityCount : "—"}
          hint={ready ? "importance 4–5" : "loading…"} />
        <StatTile label="ENGINE" tone={hybridOn ? "violet" : "muted"}
          value={settings.loading ? "—" : settings.error ? "—" : hybridOn ? "Hybrid" : "Local only"}
          hint={settings.loading ? "loading…" : settings.error ? "unavailable"
            : hybridOn ? `Frontier · ${frontier?.provider === "openrouter" ? "OpenRouter" : "Claude"}` : "all answers local"} />
      </StatTiles>

      <Card title="Teach Thunity something" hint="founder-authored · grounds future answers">
        <div className="mem-add">
          <input ref={addInput} className="filter mem-add-input" placeholder="e.g. I prefer concise answers"
            value={content} onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <select className="filter" value={kind} onChange={(e) => setKind(e.target.value)}
            title={KINDS.find((k) => k.value === kind)?.desc}>
            {KINDS.map((k) => <option key={k.value} value={k.value} title={k.desc}>{k.label}</option>)}
          </select>
          <button className="btn btn-primary" style={{ width: "auto" }} disabled={busy || !content.trim()} onClick={add}>
            {busy ? "Saving…" : "Remember this"}
          </button>
        </div>
        <div className="muted small mt">{KINDS.find((k) => k.value === kind)?.desc}</div>
        {err && <div className="bad small" style={{ marginTop: 8 }}>⚠ {err}</div>}
      </Card>

      <SectionLabel hint={mem.loading && mem.data ? <span className="muted small">refreshing…</span> : <span className="muted small">curated locally · private</span>}>
        REMEMBERED ({total})
      </SectionLabel>

      <section className="card"><div className="card-body">
        {mem.loading && !mem.data ? <Loading rows={5} />
          : mem.error ? <ErrorState message="Could not load memories." onRetry={mem.reload} />
          : items.length === 0 ? (
            <Empty
              icon={MemoryIcon}
              title="Thunity hasn't learned anything about you yet."
              hint="Add a fact, preference, or constraint above — or just keep chatting in Main Chat and durable details get captured automatically. Everything here stays local and private, and grounds every future answer."
              actions={<button className="btn btn-primary" style={{ width: "auto" }} onClick={focusComposer}>Remember this</button>}
            />
          ) : (
            <>
              <div className="filter-row">
                <button className={"chip" + (filter === "all" ? " active" : "")} onClick={() => setFilter("all")}>
                  All <span className="mono">{items.length}</span>
                </button>
                {KINDS.filter((k) => kindCounts[k.value]).map((k) => (
                  <button key={k.value} className={"chip" + (filter === k.value ? " active" : "")}
                    onClick={() => setFilter(k.value)} title={k.desc}>
                    {k.label} <span className="mono">{kindCounts[k.value]}</span>
                  </button>
                ))}
              </div>

              {visible.length === 0 ? (
                <Empty title={`No ${KIND_LABEL[filter] || filter} memories.`} hint="Pick another kind, or add one above." />
              ) : (
                <ul className="mem-list">
                  {visible.map((m) => (
                    <li key={m.id} className="mem-row">
                      <Badge tone={kindTone(m.kind)}>{KIND_LABEL[m.kind] || m.kind}</Badge>
                      <span className="mem-content">{m.content}</span>
                      <ImportanceDots n={m.importance} />
                      {m.use_count > 0 && <span className="mem-used" title="times used to ground an answer">{m.use_count}× used</span>}
                      <span className="mem-src">{m.source === "founder" ? "by you" : "auto"}</span>
                      {confirming === m.id ? (
                        <span style={{ display: "inline-flex", gap: 8, flex: "none", alignItems: "center" }}>
                          <button className="mem-forget" title="Confirm — archives this memory (recoverable in audit)" onClick={() => forget(m)}>Confirm forget</button>
                          <button className="btn btn-ghost" style={{ width: "auto", padding: "5px 10px", fontSize: 12 }} onClick={() => setConfirming(null)}>Cancel</button>
                        </span>
                      ) : (
                        <button className="mem-forget" title="Forget (archives — recoverable in audit)" onClick={() => setConfirming(m.id)}>Forget</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        <div className="muted small mt">Curated locally by the Memory Agent. Forgetting archives a memory (append-only audit keeps the trail). Memory never creates tasks, decisions, or approvals.</div>
      </div></section>

      <HybridCard />
    </div>
  );
}
