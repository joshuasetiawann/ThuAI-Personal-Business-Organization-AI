"""Input schemas (lightweight) for registered tools."""
TOOL_INPUT_SCHEMAS = {
    "search_knowledge_base": {"query": "str", "top_k": "int?"},
    "read_document": {"document_id": "uuid"},
    "create_decision_draft": {"title": "str", "decision_text": "str", "risk_level": "str?"},
    "create_task": {"title": "str", "description": "str?", "priority": "str?"},
    "request_approval": {"requested_action": "str", "risk_level": "str", "payload": "dict?"},
    "trigger_allowed_workflow": {"workflow_name": "str", "payload": "dict?"},
    "get_system_metrics": {},
    "create_report": {"title": "str", "content": "str"},
}
