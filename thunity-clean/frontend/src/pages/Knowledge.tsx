import { useState, useRef } from "react";
import { api, ApprovalRequiredError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, DataTable, StatusBadge, TrustBadge, DetailDrawer, LoadMore,
  Loading, ErrorState, Empty, Row, usePaged, type Column } from "../components/ui";
import type { DocBrief, DocDetail, IngestResult, Source, SearchResponse } from "../types";

const SENSITIVITIES = ["public", "internal", "confidential", "restricted"];
const ACCEPT = ".txt,.md,.csv,.json,.xlsx,.xls,.pdf,.yaml,.yml";

export default function Knowledge() {
  const { user } = useAuth();
  const perms = (user?.permissions || []).map((x) => String(x).toLowerCase());
  const canUpload = perms.includes("all") || perms.includes("upload_files");

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
    api.document(d.id).then((x: any) => setSel(x)).catch((e) => setDErr(e?.message || "Failed")).finally(() => setDLoading(false));
  };

  const [file, setFile] = useState<File | null>(null);
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [sensitivity, setSensitivity] = useState("internal");
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [upOk, setUpOk] = useState<IngestResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tooBig = !!file && file.size > 50 * 1024 * 1024;

  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [searchClient, setSearchClient] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchRes, setSearchRes] = useState<SearchResponse | null>(null);

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
    setSearching(true); setSearchErr(null); setSearchRes(null);
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
    { key: "created_at", label: "Ingested", render: (r) => <span className="muted small">{new Date(r.created_at).toLocaleDateString()}</span> },
  ];

  return (
    <div className="page">
      <PageHeader title="Knowledge Vault" subtitle="Search is available. Verify, deprecate, reindex, and delete remain disabled until governance flows are ready." />

      {canUpload ? (
        <Card title="Add document" hint="POST /api/knowledge/ingest">
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
            {upErr && <ErrorState message={upErr} />}
            {upOk && (
              <div className="banner-ok">
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
        </Card>
      ) : (
        <div className="note">Uploading documents requires the UPLOAD_FILES permission. You can browse existing documents below.</div>
      )}

      <Card title="Search knowledge" hint="POST /api/knowledge/search">
        <div className="search-row">
          <label className="field" style={{ flex: "1 1 55%" }}>
            <span>Query</span>
            <input type="text" value={query} disabled={searching}
              placeholder="Semantic search over local documents…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !searching && query.trim()) doSearch(); }} />
          </label>
          <label className="field"><span>Top K</span>
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
            onClick={() => { setQuery(""); setSearchRes(null); setSearchErr(null); }}>Clear</button>
        </div>
        <div className="muted small mt">Higher values may take longer on local hardware.</div>
        {searching && <div className="mt"><Loading label="Searching local knowledge…" /></div>}
        {searchErr && <div className="mt"><ErrorState message={searchErr} /></div>}
        {searchRes && !searching && (searchRes.results.length ? (
          <div className="mt">
            <div className="muted small">Grounding is based on retrieved chunks. Trust levels and warnings are shown per result.</div>
            <pre className="raw small">{searchRes.grounding}</pre>
            <div className="results mt">
              {searchRes.results.map((r: Source) => (
                <div key={r.chunk_id} className="result">
                  <div className="result-head">
                    <span className="strong">{r.filename}</span>
                    <TrustBadge trust={r.trust_level} />
                    <StatusBadge status={r.document_status} />
                    <span className="rel">rel {Number(r.relevance_score).toFixed(2)}</span>
                    {r.page ? <span className="muted small">p.{r.page}</span> : null}
                    {r.sheet ? <span className="muted small">{r.sheet}</span> : null}
                  </div>
                  {r.warning && <div className="warn small">⚠ {r.warning}</div>}
                  <div className="result-prev">{r.content_preview}</div>
                </div>
              ))}
            </div>
          </div>
        ) : <div className="mt"><Empty label="No matching chunks found." /></div>)}
      </Card>

      <Card title="Documents" hint="/api/knowledge/documents">
        {loading && !rows.length ? <Loading /> : error ? <ErrorState message={error} />
          : rows.length ? <><DataTable columns={cols} rows={rows} rowKey={(r) => r.id} onRow={openDetail} />
              <LoadMore onClick={loadMore} loading={loading} done={done} /></>
          : <Empty label="No documents ingested yet." />}
      </Card>

      <DetailDrawer open={open} onClose={() => setOpen(false)} title="Document detail">
        {dLoading ? <Loading /> : dErr ? <ErrorState message={dErr} /> : sel && (
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
        )}
      </DetailDrawer>
    </div>
  );
}
