"""Input schemas (lightweight) for registered tools."""
TOOL_INPUT_SCHEMAS = {
    "search_knowledge_base": {"query": "str", "top_k": "int?"},
    "read_document": {"document_id": "uuid"},
    "create_decision_draft": {"title": "str", "decision_text": "str", "summary": "str?",
                              "risk_level": "str?"},
    "create_task": {"title": "str", "description": "str?", "priority": "str?",
                    "risk_level": "str?"},
    "request_approval": {"requested_action": "str", "risk_level": "str", "payload": "dict?"},
    "trigger_allowed_workflow": {"workflow_name": "str", "payload": "dict?"},
    "get_system_metrics": {},
    "create_report": {"title": "str", "content": "str"},
}

# Numeric range bounds, enforced centrally by the executor (not left to each
# handler): {tool: {field: (min, max)}}. Out-of-range values are rejected.
TOOL_ARG_BOUNDS = {
    "search_knowledge_base": {"top_k": (1, 50)},
}
