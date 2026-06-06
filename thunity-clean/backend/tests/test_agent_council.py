"""4-agent council runtime tests (Phase 5/6). Ollama is mocked so the loop runs
fully locally with no model server — proves orchestration + persistence wiring."""

def _auth(t): return {"Authorization": f"Bearer {t}"}

REQUIRED_AGENTS = ["architect_analyst", "red_team_critic",
                   "pragmatic_execution_engineer", "executive_synthesizer"]


def test_council_module_imports():
    import agents.council as c
    assert hasattr(c, "run_council")


def test_flow_has_four_agents_plus_evaluator():
    from agents import prompts as p
    for a in REQUIRED_AGENTS + ["evaluator"]:
        assert a in p.DEFAULTS, f"missing default prompt for {a}"
    # synthesizer enforces the required structured output contract
    syn = p.DEFAULTS["executive_synthesizer"]
    for h in ["EXECUTIVE VERDICT", "DECISION", "RISKS", "LOCAL-ONLY COMPLIANCE",
              "HARDWARE FIT", "ACCEPTANCE CRITERIA", "NEXT STEP"]:
        assert h in syn, f"synthesizer prompt missing header: {h}"


def test_council_route_requires_auth(client):
    assert client.post("/api/agents/council", json={"message": "hi"}).status_code == 401


def test_model_router_returns_local_models():
    from agents.model_router import role_model_map
    vals = " ".join(role_model_map().values()).lower()
    for cloud in ["openai", "gpt-", "claude", "anthropic", "gemini", "groq", "together"]:
        assert cloud not in vals
    assert role_model_map()["analyst"]  # configured


def test_sequential_by_default():
    from config import settings
    assert settings.AGENT_EXECUTION_MODE == "sequential"
    assert settings.MAX_PARALLEL_AGENT_RUNS == 1


def test_council_end_to_end_persists(client, founder_token, monkeypatch):
    """Run the full council with a fake local Ollama; assert run + messages persist."""
    import agents.ollama_client as oc

    async def fake_chat(model, messages, **kw):
        last = messages[-1]["content"]
        if "Return ONLY the JSON rubric" in last:
            return {"content": '{"accuracy_score":0.8,"completeness_score":0.7,'
                    '"grounding_score":0.0,"actionability_score":0.6,'
                    '"hallucination_risk":"low","major_issues":[],"improvement_suggestions":[]}',
                    "latency_ms": 3}
        if "Produce the final structured decision" in last:
            return {"content": "EXECUTIVE VERDICT: proceed\nDECISION: do X\nNEXT STEP: ship",
                    "latency_ms": 4}
        return {"content": f"[{model}] stage analysis", "latency_ms": 2}

    monkeypatch.setattr(oc.ollama, "chat", fake_chat)
    r = client.post("/api/agents/council", json={"message": "How should we expand?"},
                    headers=_auth(founder_token))
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["agent_run_id"] and b["status"] == "completed"
    assert len(b["stages"]) == 5                       # 4 agents, analyst runs twice
    assert "DECISION" in b["final_response"]           # synthesizer output saved
    assert b["evaluation"]["accuracy_score"] == 0.8    # evaluator persisted
    # persisted conversation memory (user + assistant)
    cid = b["conversation_id"]
    msgs = client.get(f"/api/conversations/{cid}/messages", headers=_auth(founder_token)).json()["messages"]
    roles = {m["role"] for m in msgs}
    assert "user" in roles and "assistant" in roles
