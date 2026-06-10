import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api, ApprovalRequiredError } from "../api/client";
import { asUTC } from "../utils/time";
import { useAuth } from "../auth/AuthContext";
import { PageHero, StatTiles, StatTile, SectionLabel, Card, DataTable, StatusBadge, TrustBadge,
  DetailDrawer, LoadMore, Loading, ErrorState, Empty, Row, usePaged, type Column } from "../components/ui";
import type { DocBrief, DocDetail, IngestResult, Source, SearchResponse } from "../types";

const SENSITIVITIES = ["public", "internal", "confidential", "restricted"];
const ACCEPT = ".txt,.md,.csv,.json,.xlsx,.xls,.pdf,.yaml,.yml";
const TRUSTED = new Set(["authoritative", "high", "verified", "trusted"]);

// Knowledge nav icon (inner paths copied from AppShell NAV_ICONS["/knowledge"]).
const KnowledgeIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 18.5Z" />
    <path d="M5 16.5A1.5 1.5 0 0 1 6.5 15H19" />
  </svg>
);
const SearchIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
  </svg>
);

export default function Knowledge() {
  const { user } = useAuth();
  const perms = (user?.permissions || []).map((x) => String(x).toLowerCase());
  const role = String(user?.role || "").toLowerCase();
  const isPrivileged = role === "founder" || role === "admin";
  const canUpload = perms.includes("all") || perms.includes("upload_files");
  // Governed lifecycle gates (founder/admin always allowed). Manage = verify/deprecate.
  const canManageDocs = isPrivileged || perms.includes("all") || perms.includes("manage_documents");
  const canDeleteDocs = isPrivileged || perms.includes("all") || perms.includes("delete_documents");

  const { rows, loading, error, done, loadMore, reload } = usePaged<DocBrief>((l, o) =>
    api.documents(l, o).then((r: any) => r.documents || []).catch((e: any) => {
      if (e?.status === 403) throw new Error("Your role can't view documents (requires READ_KNOWLEDGE).");
      throw e;
    }));

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<DocDetail | null>(null);
  const [dLoading, setDLoading] = useState(false);
  const [dErr, setDErr] = useState<string | null>(null);
  const openDetail = (d: DocBrief) => {
    setOpen(true); setSel(null); setDErr(null); setDLoading(true);
    setActErr(null); setActOk(null); setActApproval(null); setTrust("high");
    api.document(d.id).then((x: any) => setSel(x)).catch((e) => setDErr(e?.message || "Failed")).finally(() => setDLoading(false));
  };

  // ── Governed document lifecycle (verify / deprecate / delete) ──
  const [trust, setTrust] = useState<"low" | "medium" | "high" | "authoritative">("high");
  const [acting, setActing] = useState<null | "verify" | "deprecate" | "delete">(null);
  const [actErr, setActErr] = useState<string | null>(null);
  const [actOk, setActOk] = useState<string | null>(null);
  const [actApproval, setActApproval] = useState<string | null>(null);   // 202 → approval requested, NOT success

  // Re-fetch the open document so the drawer reflects the new status/trust truth.
  const refreshOpenDoc = async (id: string) => {
    try { setSel(await api.document(id) as DocDetail); } catch { /* keep prior detail; list reload still reflects truth */ }
  };

  const doVerify = async () => {
    if (!sel || acting) return;
    setActing("verify"); setActErr(null); setActOk(null); setActApproval(null);
    try {
      await api.verifyDocument(sel.id, trust);
      setActOk(`Verified as ${trust}.`);
      reload(); await refreshOpenDoc(sel.id);
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) { setActApproval(e.approvalId); return; }
      setActErr(e?.message || "Verify failed.");
    } finally { setActing(null); }
  };

  const doDeprecate = async () => {
    if (!sel || acting) return;
    setActing("deprecate"); setActErr(null); setActOk(null); setActApproval(null);
    try {
      await api.deprecateDocument(sel.id);
      setActOk("Document deprecated.");
      reload(); await refreshOpenDoc(sel.id);
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) { setActApproval(e.approvalId); return; }
      setActErr(e?.message || "Deprecate failed.");
    } finally { setActing(null); }
  };

  const doDelete = async () => {
    if (!sel || acting) return;
    setActing("delete"); setActErr(null); setActOk(null); setActApproval(null);
    try {
      await api.deleteDocument(sel.id);   // no approvalId → may throw ApprovalRequiredError (202)
      setActOk("Document deleted.");
      reload();
      setOpen(false);   // real success only
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) { setActApproval(e.approvalId); return; }   // 202 is NOT a delete
      setActErr(e?.message || "Delete failed.");
    } finally { setActing(null); }
  };

  const [file, setFile] = useState<File | null>(null);
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [sensitivity, setSensitivity] = useState("internal");
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [upOk, setUpOk] = useState<IngestResult | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tooBig = !!file && file.size > 50 * 1024 * 1024;

  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [searchClient, setSearchClient] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchRes, setSearchRes] = useState<SearchResponse | null>(null);
  const [showGrounding, setShowGrounding] = useState(false);

  // Reveal & focus the secondary upload panel (hero / empty-state primary action).
  const revealUpload = () => {
    setShowUpload(true);
    requestAnimationFrame(() => fileInputRef.current?.focus());
  };

  // Stat tiles — all derived client-side from the already-fetched `rows`. Honest:
  // these reflect the documents loaded so far, never a forced grand total.
  const docCount = rows.length;
  const trustedCount = rows.filter((r) => TRUSTED.has(String(r.trust_level).toLowerCase())).length;
  const untrustedCount = docCount - trustedCount;
  const totalChunks = rows.reduce((s, r) => s + (r.chunk_count || 0), 0);
  const indexedCount = rows.filter((r) => String(r.document_status).toLowerCase() === "indexed").length;
  const otherStatus = docCount - indexedCount;
  const loadedQualifier = loading && docCount ? "based on loaded documents · loading more" : "based on loaded documents";

  const doUpload = async () => {
    if (!file || uploading) return;
    setUploading(true); setUpErr(null); setUpOk(null);
    const fd = new FormData();
    fd.append("file", file);
    if (clientName) fd.append("client_name", clientName);
    if (projectName) fd.append("project_name", projectName);
    if (sourceType) fd.append("source_type", sourceType);
    fd.append("sensitivity_level", sensitivity);
    try {
      const r = await api.ingestDocument(fd) as IngestResult;
      if (!r?.document_id) throw new Error("Ingestion did not return a document id.");
      setUpOk(r); setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";   // allow re-uploading the same file
      reload();
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) {
        setUpErr(`This ingest requires founder approval${e.approvalId ? ` (approval ${String(e.approvalId).slice(0, 8)})` : ""}.`);
        return;   // 202 is NOT an upload success
      }
      setUpErr(e?.message || "Upload failed.");
    } finally { setUploading(false); }
  };

  const doSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true); setSearchErr(null); setSearchRes(null); setShowGrounding(false);
    try {
      setSearchRes(await api.search(query.trim(), topK, searchClient || undefined) as SearchResponse);
    } catch (e: any) {
      if (e instanceof ApprovalRequiredError) { setSearchErr("This action requires founder approval."); return; }
      if (e?.status === 403 || e?.code === "FORBIDDEN") setSearchErr("Knowledge search requires the READ_KNOWLEDGE permission.");
      else if (e?.code === "SEARCH_FAILED") setSearchErr("Local search unavailable — ensure Ollama and the nomic-embed-text model are running.");
      else setSearchErr(e?.message || "Search failed.");
    } finally { setSearching(false); }
  };

  const cols: Column<DocBrief>[] = [
    { key: "filename", label: "File", render: (r) => <span className="strong">{r.filename}</span> },
    { key: "file_type", label: "Type", render: (r) => <span className="muted">{r.file_type || "—"}</span> },
    { key: "document_status", label: "Status", render: (r) => <StatusBadge status={r.document_status} /> },
    { key: "trust_level", label: "Trust", render: (r) => <TrustBadge trust={r.trust_level} /> },
    { key: "chunk_count", label: "Chunks", render: (r) => r.chunk_count ?? 0 },
    { key: "created_at", label: "Ingested", render: (r) => <span className="muted small">{new Date(asUTC(r.created_at)).toLocaleDateString()}</span> },
  ];

  return (
    <div className="page">
      <PageHero
        icon={KnowledgeIcon}
        eyebrow="KNOWLEDGE"
        title="Knowledge Vault"
        desc="Your local document vault — ingest client and project files, then semantically search them so AI Council answers are grounded in your own data. Everything is parsed and embedded locally, with no cloud upload."
        actions={canUpload
          ? <button className="btn btn-primary" style={{ width: "auto" }} onClick={revealUpload}>Ingest document</button>
          : <span className="muted small">Browsing only — UPLOAD_FILES required</span>}
      />

      <div className="note">
        Search is live. Verify, deprecate, and delete are now governed actions in each document's detail (founder/admin). Reindex remains disabled until its governance flow is ready.
      </div>

      <StatTiles>
        <StatTile label="DOCUMENTS" tone="accent" value={loading && !docCount ? "—" : docCount}
          hint={loadedQualifier} />
        <StatTile label="TRUSTED" tone="violet" value={loading && !docCount ? "—" : trustedCount}
          hint={`${untrustedCount} untrusted · verify pending`} />
        <StatTile label="SEARCHABLE CHUNKS" value={loading && !docCount ? "—" : totalChunks.toLocaleString()}
          hint="grounding surface for the Council" />
        <StatTile label="STATUS MIX" tone="muted" value={loading && !docCount ? "—" : `${indexedCount} indexed`}
          hint={otherStatus ? `${otherStatus} other status` : "all indexed"} />
      </StatTiles>

      <SectionLabel hint={<span className="muted small">Semantic search over your local documents</span>}>SEARCH</SectionLabel>
      <Card title="Search the vault" hint="Ask in plain language — results are retrieved chunks, not generated answers.">
        <div className="search-row">
          <label className="field" style={{ flex: "1 1 100%" }}>
            <span>Query</span>
            <input type="text" value={query} disabled={searching}
              placeholder="e.g. What did the client say about Q3 budget?"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !searching && query.trim()) doSearch(); }} />
          </label>
          <label className="field"><span>Top-K · chunks to retrieve</span>
            <select value={topK} disabled={searching} onChange={(e) => setTopK(Number(e.target.value))}>
              {[5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="field"><span>Client (optional)</span>
            <input type="text" value={searchClient} disabled={searching} onChange={(e) => setSearchClient(e.target.value)} /></label>
          <button className="btn btn-primary" style={{ width: "auto" }} disabled={searching || !query.trim()} onClick={doSearch}>
            {searching ? "Searching…" : "Search"}
          </button>
          <button className="btn" style={{ width: "auto" }} disabled={searching}
            onClick={() => { setQuery(""); setSearchRes(null); setSearchErr(null); setShowGrounding(false); }}>Clear</button>
        </div>
        <div className="muted small mt">Higher Top-K retrieves more context but may take longer on local hardware.</div>
        {searching && <div className="mt"><Loading rows={3} label="Searching local knowledge…" /></div>}
        {searchErr && !searching && <div className="mt"><ErrorState message={searchErr} onRetry={doSearch} /></div>}
        {searchRes && !searching && (searchRes.results.length ? (
          <div className="mt">
            <div className="results">
              {searchRes.results.map((r: Source) => (
                <div key={r.chunk_id} className="result">
                  <div className="result-head">
                    <span className="strong">{r.filename}</span>
                    <TrustBadge trust={r.trust_level} />
                    <StatusBadge status={r.document_status} />
                    <span className="rel">relevance {Number(r.relevance_score).toFixed(2)}</span>
                    {r.page ? <span className="muted small">p.{r.page}</span> : null}
                    {r.sheet ? <span className="muted small">{r.sheet}</span> : null}
                  </div>
                  {r.warning && <div className="warn small">⚠ {r.warning}</div>}
                  <div className="result-prev">{r.content_preview}</div>
                </div>
              ))}
            </div>
            <div className="mt">
              <button className="btn" style={{ width: "auto" }} onClick={() => setShowGrounding((v) => !v)}>
                {showGrounding ? "Hide grounding context" : "View grounding context"}
              </button>
              {showGrounding && (
                <>
                  <div className="muted small mt">Exact text passed to the model as grounding. Trust levels and warnings above apply per chunk.</div>
                  <pre className="raw small mt">{searchRes.grounding}</pre>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="mt">
            <Empty icon={SearchIcon} title="No matching chunks"
              hint="Nothing in the vault matched this query. Try broader wording, raise Top-K, or clear the client filter. Only ingested documents are searchable." />
          </div>
        ))}
      </Card>

      <SectionLabel hint={<span className="muted small">Everything you have ingested</span>}>DOCUMENTS</SectionLabel>
      <Card title="Your documents" hint="Click a row to inspect a document's status, trust, and metadata.">
        {loading && !rows.length ? <Loading rows={5} /> : error ? <ErrorState message={error} onRetry={reload} />
          : rows.length ? (
            <>
              <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} onRow={openDetail} />
              <LoadMore onClick={loadMore} loading={loading} done={done} />
            </>
          ) : (
            <Empty icon={KnowledgeIcon} title="Your vault is empty"
              hint={canUpload
                ? "Ingest a client brief, transcript, or spreadsheet above — it is parsed and embedded locally so the AI Council can cite it. New documents start indexed but untrusted until you verify them."
                : "Ask a founder/admin to upload documents, or request the UPLOAD_FILES permission."}
              actions={canUpload
                ? <button className="btn btn-primary" style={{ width: "auto" }} onClick={revealUpload}>Ingest your first document</button>
                : undefined} />
          )}
      </Card>

      {canUpload && (
        <>
          <SectionLabel hint={<span className="muted small">Stored locally · embedded via Ollama · no cloud upload</span>}>ADD DOCUMENT</SectionLabel>
          <Card
            title="Ingest a document"
            hint="Upload a file to parse and embed it into the vault."
            actions={
              <button className="btn" style={{ width: "auto" }} onClick={() => setShowUpload((v) => !v)}>
                {showUpload ? "Hide" : "Open uploader"}
              </button>
            }
          >
            {showUpload ? (
              <div className="uploader">
                <label className="field">
                  <span>File · txt, md, csv, json, xlsx, xls, pdf, yaml · up to the server limit (default 50 MB)</span>
                  <input ref={fileInputRef} type="file" accept={ACCEPT} disabled={uploading}
                    onChange={(e) => { setFile(e.target.files?.[0] || null); setUpOk(null); setUpErr(null); }} />
                  {tooBig && <span className="warn small">⚠ This file is over ~50 MB and may be rejected by the server (MAX_UPLOAD_MB).</span>}
                </label>
                <div className="uploader-meta">
                  <label className="field"><span>Client (optional)</span><input type="text" value={clientName} disabled={uploading} onChange={(e) => setClientName(e.target.value)} /></label>
                  <label className="field"><span>Project (optional)</span><input type="text" value={projectName} disabled={uploading} onChange={(e) => setProjectName(e.target.value)} /></label>
                  <label className="field"><span>Source type (optional)</span><input type="text" value={sourceType} disabled={uploading} placeholder="meta / tiktok / manual…" onChange={(e) => setSourceType(e.target.value)} /></label>
                  <label className="field"><span>Sensitivity</span>
                    <select value={sensitivity} disabled={uploading} onChange={(e) => setSensitivity(e.target.value)}>
                      {SENSITIVITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>
                {upErr && <div className="mt"><ErrorState message={upErr} /></div>}
                {upOk && (
                  <div className="banner-ok mt">
                    Ingested <b>{upOk.filename}</b> — {upOk.chunks} chunk(s) · status <StatusBadge status={upOk.document_status} /> · trust <TrustBadge trust={upOk.trust_level} />.
                    <div className="muted small mt">New documents start <b>indexed + untrusted</b> until a founder/admin verifies them.</div>
                  </div>
                )}
                <div className="uploader-actions">
                  <span className="muted small">Stored locally · parsed &amp; embedded via local Ollama · no cloud upload</span>
                  <button className="btn btn-primary council-submit" disabled={!file || uploading} onClick={doUpload}>
                    {uploading ? "Ingesting…" : "Ingest document"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="muted small">Open the uploader to add a file. Each document is parsed and embedded locally; it starts indexed but untrusted until verified.</div>
            )}
          </Card>
        </>
      )}

      <DetailDrawer open={open} onClose={() => setOpen(false)} title="Document detail">
        {dLoading ? <Loading rows={5} /> : dErr ? <ErrorState message={dErr} /> : sel && (
          <>
            <div className="kv">
              <Row k="File" v={sel.filename} />
              <Row k="Type" v={sel.file_type || "—"} />
              <Row k="Status" v={<StatusBadge status={sel.document_status} />} />
              <Row k="Trust" v={<TrustBadge trust={sel.trust_level} />} />
              <Row k="Sensitivity" v={sel.sensitivity_level || "—"} />
              <Row k="Owner" v={sel.owner || "—"} />
              <Row k="Client / Project" v={`${sel.client_name || "—"} / ${sel.project_name || "—"}`} />
              <Row k="Chunks" v={sel.chunk_count ?? 0} />
              <Row k="SHA-256" v={sel.sha256 ? <code className="mono">{String(sel.sha256).slice(0, 16)}…</code> : "—"} />
            </div>

            {(canManageDocs || canDeleteDocs) && (
              <div className="mt">
                <SectionLabel hint={<span className="muted small">Founder/admin governed</span>}>GOVERNED ACTIONS</SectionLabel>
                <div className="search-row">
                  {canManageDocs && (
                    <>
                      <label className="field"><span>Trust level</span>
                        <select value={trust} disabled={!!acting}
                          onChange={(e) => setTrust(e.target.value as typeof trust)}>
                          {(["low", "medium", "high", "authoritative"] as const).map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </label>
                      <button className="btn btn-primary" style={{ width: "auto" }} disabled={!!acting} onClick={doVerify}>
                        {acting === "verify" ? "Verifying…" : "Verify"}
                      </button>
                      <button className="btn" style={{ width: "auto" }} disabled={!!acting} onClick={doDeprecate}>
                        {acting === "deprecate" ? "Deprecating…" : "Deprecate"}
                      </button>
                    </>
                  )}
                  {canDeleteDocs && (
                    <button className="btn" style={{ width: "auto" }} disabled={!!acting} onClick={doDelete}>
                      {acting === "delete" ? "Deleting…" : "Delete"}
                    </button>
                  )}
                </div>
                <div className="muted small mt">Verify and deprecate apply immediately. Delete is high-risk and may require founder approval before it runs.</div>
                {actApproval && (
                  <div className="banner-ok mt">
                    Founder approval required — request created{actApproval ? ` (approval ${String(actApproval).slice(0, 8)})` : ""}. Nothing has changed yet.
                    {" "}<Link to="/approvals">Review in Approvals →</Link>
                  </div>
                )}
                {actOk && !actApproval && <div className="banner-ok mt">{actOk}</div>}
                {actErr && <div className="mt"><ErrorState message={actErr} /></div>}
              </div>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
