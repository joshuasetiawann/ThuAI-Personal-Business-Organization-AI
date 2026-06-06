"""Tool registry — agents/automation may ONLY use registered tools. Each tool
declares risk + required permission + whether it is audited. Free-form function
calling by agents is not permitted."""
from __future__ import annotations
from typing import Dict, List, Optional
from core.permissions import Perm
from tools.schemas import TOOL_INPUT_SCHEMAS

TOOLS: Dict[str, Dict] = {
    "search_knowledge_base": {"description": "Semantic search over the local knowledge base.",
                              "risk_level": "low", "required_permission": Perm.READ_KNOWLEDGE, "audit": True},
    "read_document": {"description": "Read a stored document's metadata/content.",
                      "risk_level": "low", "required_permission": Perm.READ_KNOWLEDGE, "audit": True},
    "create_decision_draft": {"description": "Create a draft decision in the ledger.",
                              "risk_level": "low", "required_permission": Perm.CREATE_DRAFT_DECISION, "audit": True},
    "create_task": {"description": "Create a task on the mission board.",
                    "risk_level": "low", "required_permission": Perm.CREATE_TASKS, "audit": True},
    "request_approval": {"description": "Open an approval request for a risky action.",
                         "risk_level": "medium", "required_permission": Perm.CREATE_DRAFT_DECISION, "audit": True},
    "trigger_allowed_workflow": {"description": "Trigger an allow-listed n8n workflow.",
                                 "risk_level": "high", "required_permission": Perm.RUN_APPROVED_WORKFLOW, "audit": True},
    "get_system_metrics": {"description": "Read system/observability metrics.",
                           "risk_level": "low", "required_permission": Perm.READ_DASHBOARD, "audit": False},
    "create_report": {"description": "Create a report artifact.",
                      "risk_level": "low", "required_permission": Perm.RUN_ANALYSIS, "audit": True},
}


def list_tools() -> List[Dict]:
    return [{"name": n, "input_schema": TOOL_INPUT_SCHEMAS.get(n, {}),
             "risk_level": t["risk_level"],
             "required_permission": getattr(t["required_permission"], "value", str(t["required_permission"])),
             "audit": t["audit"], "description": t["description"]} for n, t in TOOLS.items()]


def get_tool(name: str) -> Optional[Dict]:
    return TOOLS.get(name)
