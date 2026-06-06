"""RAG + file-security + grounding tests (Phase 8/9/10). Embeddings mocked so it
runs fully locally without Ollama; proves the pipeline, not embedding quality."""
import inspect

def _auth(t): return {"Authorization": f"Bearer {t}"}

TRAVERSAL = ["../../secret.env", "../.env", "/etc/passwd", "..\\..\\secret.env"]


def test_path_traversal_rejected():
    from services.file_service import FileService
    fs = FileService()
    for p in TRAVERSAL:
        for fn in (fs.sanitize_filename, fs.safe_path):
            try:
                fn(p); raise AssertionError(f"{fn.__name__} allowed {p}")
            except (ValueError, PermissionError):
                pass


def test_knowledge_endpoints_require_auth(client):
    assert client.post("/api/knowledge/ingest").status_code == 401
    assert client.post("/api/knowledge/search", json={"query": "x"}).status_code == 401
    assert client.get("/api/knowledge/documents").status_code == 401


def test_chunking_local_file(tmp_path):
    from services import knowledge_service as ks
    f = tmp_path / "notes.md"
    f.write_text("# Thunity\n" + ("local company brain knowledge. " * 80))
    segments, _ = ks.parse_file(str(f), "md")
    chunks = ks.chunk_segments(segments)
    assert len(chunks) >= 1 and all(c["content"] for c in chunks)


def test_embedding_provider_is_local_only():
    import services.embedding as emb
    src = inspect.getsource(emb).lower()
    for bad in ["openai", "pinecone", "weaviate", "cohere", "api.openai.com"]:
        assert bad not in src
    assert "ollama" in src


def test_ingest_search_grounding_end_to_end(client, founder_token, monkeypatch):
    import agents.ollama_client as oc
    async def fake_embed(text): return [1.0, 0.0, 1.0]   # const → cosine=1.0
    monkeypatch.setattr(oc.ollama, "embed", fake_embed)

    files = {"file": ("brain.txt", b"Thunity local AI company brain notes. " * 40, "text/plain")}
    ing = client.post("/api/knowledge/ingest", files=files,
                      data={"sensitivity_level": "internal"}, headers=_auth(founder_token))
    assert ing.status_code == 200, ing.text
    jb = ing.json()
    assert jb["chunks"] >= 1
    assert jb["document_status"] == "indexed" and jb["trust_level"] == "untrusted"  # spec defaults

    sr = client.post("/api/knowledge/search", json={"query": "company brain", "top_k": 3},
                     headers=_auth(founder_token))
    assert sr.status_code == 200, sr.text
    res = sr.json()["results"]
    assert res, "no retrieval results"
    for k in ["document_id", "chunk_id", "filename", "relevance_score", "trust_level", "document_status"]:
        assert k in res[0], f"search result missing {k}"
    assert "Sources used:" in sr.json()["grounding"]


def test_council_accepts_knowledge_flag_without_breaking(client, founder_token, monkeypatch):
    import agents.ollama_client as oc
    async def fake_embed(text): return [1.0, 0.0, 1.0]
    async def fake_chat(model, messages, **kw):
        last = messages[-1]["content"]
        if "Return ONLY the JSON rubric" in last:
            return {"content": '{"accuracy_score":0.5,"completeness_score":0.5,"grounding_score":0.0,'
                    '"actionability_score":0.5,"hallucination_risk":"low","major_issues":[],'
                    '"improvement_suggestions":[]}', "latency_ms": 1}
        return {"content": "EXECUTIVE VERDICT: ok\nDECISION: y\nNEXT STEP: z", "latency_ms": 1}
    monkeypatch.setattr(oc.ollama, "embed", fake_embed)
    monkeypatch.setattr(oc.ollama, "chat", fake_chat)
    r = client.post("/api/agents/council",
                    json={"message": "use our docs", "use_knowledge_base": True, "top_k": 3},
                    headers=_auth(founder_token))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "completed"
    assert "grounding_note" in r.json()
