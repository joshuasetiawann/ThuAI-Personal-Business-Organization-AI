# RAG Pipeline

A fully local retrieval-augmented pipeline (`services/knowledge_service.py`). Embeddings
are produced by local Ollama (`nomic-embed-text` by default); no external embedding
provider is ever used.

## Ingestion

`POST /api/knowledge/ingest` → `ingest_document()`:

1. **Store** the upload securely (`file_service`, SHA-256, unique id).
2. **Parse** by type — supported: `txt`, `md`, `csv`, `json`, `xlsx`/`xls`, `pdf`,
   `yaml`/`yml`. CSV/XLSX also yield a detected schema (columns, row count, missing-value
   summary) saved to `documents.metadata_json`.
3. **Chunk** — `CHUNK_CHARS=900` with `CHUNK_OVERLAP=120`, preserving page/sheet hints.
4. **Embed** each chunk locally and **sequentially** (`embed_texts`) — never
   parallel-hammering the GPU.
5. **Store** chunks + embedding vectors in PostgreSQL (`document_chunks.embedding_json`).

New documents default to `document_status="indexed"` and `trust_level="untrusted"`.
`POST /api/knowledge/documents/{id}/reindex` re-parses and re-embeds.

## Vector store

Embeddings live **locally in Postgres** and are ranked with in-process cosine similarity
(`services/embedding.cosine`). This needs no extra service and stays fully local.
`pgvector` is a documented optional upgrade for larger corpora.

## Retrieval and grounding

`POST /api/knowledge/search` → `retrieve_context()`:

1. Embed the query locally.
2. Cosine-rank all chunks.
3. **Lifecycle filter** — documents with status `deprecated` or `archived` are never
   auto-retrieved.
4. **Optional filters** — `client_name`, `min_trust` (trust order: untrusted < low <
   medium < high < authoritative).
5. Return the top-k (`MAX_CONTEXT_CHUNKS=5` default) with `filename`, `content_preview`,
   `relevance_score`, `trust_level`, `document_status`, `sensitivity_level`, page/sheet,
   and a `warning` on low-trust sources.

`format_grounding()` builds a "Sources used:" block (filename, location, chunk id,
relevance, trust). When no source is used, the grounding note says the answer is "based
on model reasoning only." The council injects this context and note into its prompts (see
`AGENT_COUNCIL.md`).

## Document lifecycle and trust

`raw → parsed → indexed`, with `verify` / `deprecate` transitions and trust levels
managed via the knowledge endpoints. Sensitivity level (`internal` default) and
owner/client/project metadata travel with each document.

## Limitations (honest)

- In-process cosine is **linear scan**, fine for a founder-scale corpus but not an ANN
  index; `pgvector` is the documented upgrade path.
- Retrieval quality depends on the local embedding model; tests mock embeddings to prove
  the **pipeline**, not embedding quality.

## Tests

`test_knowledge_file_security.py` covers path-traversal rejection, auth on knowledge
endpoints, local chunking, embedding-provider-is-local-only (source inspection), and an
ingest → search → grounding end-to-end run (with embeddings mocked) asserting
`indexed`/`untrusted` defaults and a populated "Sources used:" block.
