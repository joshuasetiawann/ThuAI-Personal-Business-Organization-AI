import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { PageHero, StatTiles, StatTile, SectionLabel, Card, StatusBadge, DetailDrawer,
  LoadMore, Loading, ErrorState, Empty, Row, usePaged } from "../components/ui";
import type { ConvBrief, ConvDetail, ConvMessage } from "../types";

const ConvIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 10h8M8 14h5" />
    <path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-4.6A8 8 0 1 1 21 12Z" />
  </svg>
);

const ChevronIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const DAY = 24 * 60 * 60 * 1000;

// Backend sends naive UTC (no 'Z'); treat as UTC so relative times are correct everywhere.
const asUTC = (iso: string) => (/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");

// Relative, human label for a timestamp — computed from already-fetched created_at.
function relTime(iso: string): string {
  const d = new Date(asUTC(iso));
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - DAY).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isYesterday) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

// Recency bucket for grouping headers.
function bucketOf(iso: string): "Today" | "This week" | "Earlier" {
  const d = new Date(asUTC(iso)).getTime();
  const now = Date.now();
  if (new Date(asUTC(iso)).toDateString() === new Date().toDateString()) return "Today";
  if (now - d <= 7 * DAY) return "This week";
  return "Earlier";
}

export default function Conversations() {
  const { rows, loading, error, done, loadMore, reload } =
    usePaged<ConvBrief>((l, o) => api.conversations(l, o).then((r: any) => r.conversations || []));
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<ConvDetail | null>(null);
  const [dLoading, setDLoading] = useState(false);
  const [dErr, setDErr] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ConvMessage[] | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  const [sp, setSp] = useSearchParams();
  const openById = useCallback((id: string) => {
    setOpen(true); setSel(null); setDErr(null); setDLoading(true);
    setMsgs(null); setMsgErr(null); setMsgLoading(true);
    api.conversation(id).then((x: any) => setSel(x))
      .catch((e) => setDErr(e?.status === 403 ? "You don't have access to this conversation." : (e?.message || "Failed")))
      .finally(() => setDLoading(false));
    api.conversationMessages(id).then((r: any) => setMsgs(r.messages || []))
      .catch((e) => setMsgErr(e?.status === 403 ? "No access to this conversation's messages." : (e?.message || "Failed to load messages.")))
      .finally(() => setMsgLoading(false));
  }, []);
  const ingestToKnowledge = async () => {
    if (!sel) return;
    setIngesting(true); setIngestMsg(null);
    try {
      const r: any = await api.ingestConversation(sel.id);
      setIngestMsg(
        r.status === "ingested"
          ? `Tersimpan ke Knowledge · ${r.chunks} potongan${r.redactions ? ` · ${r.redactions} data sensitif diredaksi` : ""}.`
          : r.status === "unchanged" ? "Sudah tersimpan & terbaru di Knowledge."
          : r.status === "too_short" ? "Percakapan terlalu pendek untuk dijadikan knowledge."
          : "Selesai.");
      if (r.status !== "too_short") setSel({ ...sel, in_knowledge: true });
      reload();
    } catch (e: any) {
      setIngestMsg(e?.message || "Gagal menyimpan ke Knowledge (Ollama mati?).");
    } finally { setIngesting(false); }
  };

  const openDetail = (c: ConvBrief) => setSp({ open: c.id });
  const closeDrawer = () => setSp({});
  useEffect(() => { const id = sp.get("open"); if (id) openById(id); else setOpen(false); }, [sp, openById]);

  // ── Stat tiles: derived purely from already-fetched rows (honest, no fabrication) ──
  const thisWeek = rows.filter((r) => Date.now() - new Date(asUTC(r.created_at)).getTime() <= 7 * DAY).length;
  const newest = rows.reduce<string | null>((acc, r) =>
    !acc || new Date(asUTC(r.created_at)) > new Date(asUTC(acc)) ? r.created_at : acc, null);

  // ── Recency-grouped, scannable rows ──
  const groups: { label: string; items: ConvBrief[] }[] = [];
  for (const r of rows) {
    const b = bucketOf(r.created_at);
    let g = groups.find((x) => x.label === b);
    if (!g) { g = { label: b, items: [] }; groups.push(g); }
    g.items.push(r);
  }

  const startLink = <Link className="link" to="/chat">Start a new chat →</Link>;

  return (
    <div className="page">
      <PageHero
        icon={ConvIcon}
        eyebrow="OBSERVABILITY"
        title="Conversations"
        desc="Every chat and Council session is captured automatically — open any one to read the full transcript of who said what. Read-only, so nothing here can be lost."
        actions={startLink}
      />

      {rows.length > 0 && (
        <StatTiles>
          <StatTile
            label="LOADED"
            value={rows.length}
            hint={done ? "all so far" : "+ more available"}
            tone="accent"
            icon={ConvIcon}
          />
          <StatTile
            label="THIS WEEK"
            value={thisWeek}
            hint="started in the last 7 days"
            tone="violet"
          />
          <StatTile
            label="LATEST ACTIVITY"
            value={newest ? relTime(newest) : "—"}
            hint="most recent conversation"
            tone="default"
          />
        </StatTiles>
      )}

      <Card title="Conversations" hint="Most recent first">
        {loading && !rows.length ? <Loading rows={5} />
          : error ? <ErrorState message={error} onRetry={reload} />
          : rows.length ? (
            <>
              {groups.map((g) => (
                <div key={g.label}>
                  <SectionLabel>{g.label.toUpperCase()}</SectionLabel>
                  <div className="card-list">
                    {g.items.map((c) => (
                      <div key={c.id} className="card-row clickable" onClick={() => openDetail(c)}>
                        <span className="card-row-glyph" aria-hidden>{ConvIcon}</span>
                        <div className="card-row-main">
                          <div className="card-row-title">{c.title || "Untitled conversation"}</div>
                          <div className="card-row-sub">{relTime(c.created_at)}</div>
                        </div>
                        <div className="card-row-meta">
                          {c.in_knowledge && (
                            <span className="mono small" style={{ color: "var(--ok)", opacity: 0.9 }}
                              title="Indexed into the AI's Knowledge">✓ KB</span>
                          )}
                          {c.status && c.status !== "active" && <StatusBadge status={c.status} />}
                          <span className="card-row-chevron">{ChevronIcon}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <LoadMore onClick={loadMore} loading={loading} done={done} />
            </>
          ) : (
            <Empty
              icon={ConvIcon}
              title="No conversations captured yet"
              hint="Every chat and AI Council session is saved here automatically. Start one in Fast Chat or the AI Council and it will appear in this list — read-only, so nothing here can be lost."
              actions={startLink}
            />
          )}
      </Card>

      <DetailDrawer open={open} onClose={closeDrawer} title="Conversation">
        {dLoading ? <Loading rows={3} /> : dErr ? <ErrorState message={dErr} /> : sel && (
          <div className="kv">
            <Row k="Title" v={sel.title} />
            <Row k="Status" v={<StatusBadge status={sel.status} />} />
            <Row k="Owner" v="You" />
          </div>
        )}
        {sel && (
          <div className="detail-block">
            <SectionLabel>KNOWLEDGE</SectionLabel>
            <p className="muted small" style={{ margin: "0 0 10px" }}>
              Simpan transkrip percakapan ini ke Knowledge AI agar bisa ditarik kembali sebagai
              konteks di chat berikutnya. Disimpan sebagai sumber trust rendah (low); data sensitif
              (password/token) diredaksi otomatis.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" disabled={ingesting} onClick={ingestToKnowledge}>
                {ingesting ? "Menyimpan…" : sel.in_knowledge ? "Perbarui di Knowledge" : "Simpan ke Knowledge"}
              </button>
              {sel.in_knowledge && (
                <span className="mono small" style={{ color: "var(--ok)", opacity: 0.9 }}>
                  ✓ Tersimpan di Knowledge{sel.knowledge ? ` · ${sel.knowledge.chunks} potongan` : ""}
                </span>
              )}
            </div>
            {ingestMsg && <p className="muted small" style={{ marginTop: 8 }}>{ingestMsg}</p>}
          </div>
        )}
        <div className="detail-block">
          <SectionLabel>TRANSCRIPT</SectionLabel>
          {msgLoading ? <Loading rows={3} /> : msgErr ? <ErrorState message={msgErr} />
            : msgs && msgs.length ? (
              <div className="transcript">
                {msgs.map((m) => {
                  const isUser = (m.role || "").toLowerCase() === "user";
                  return (
                    <div key={m.id} className={`transcript-msg ${isUser ? "from-user" : "from-agent"}`}>
                      <div className="transcript-head">
                        <span className="strong">{m.agent_name || (isUser ? "You" : m.role)}</span>
                        <time className="muted small mono">{relTime(m.created_at)}</time>
                      </div>
                      <div className="transcript-body">{m.content}</div>
                    </div>
                  );
                })}
              </div>
            ) : <Empty title="No messages in this conversation." />}
        </div>
      </DetailDrawer>
    </div>
  );
}
