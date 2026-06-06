"""Role-Based Access Control: roles → permissions map. Validated on the backend."""
from __future__ import annotations

from enum import Enum
from typing import Dict, Set


class Role(str, Enum):
    founder = "founder"
    admin = "admin"
    operator = "operator"
    analyst = "analyst"
    viewer = "viewer"


class Perm(str, Enum):
    # global
    ALL = "all"
    # decisions
    APPROVE_DECISION = "approve_decision"
    CREATE_DRAFT_DECISION = "create_draft_decision"
    # workflows
    EXECUTE_WORKFLOW = "execute_workflow"
    RUN_APPROVED_WORKFLOW = "run_approved_workflow"
    # knowledge / documents
    DELETE_DOCUMENT = "delete_document"
    MANAGE_DOCUMENTS = "manage_documents"
    READ_KNOWLEDGE = "read_knowledge"
    UPLOAD_FILES = "upload_files"
    # tasks
    MANAGE_TASKS = "manage_tasks"
    CREATE_TASKS = "create_tasks"
    # analysis
    RUN_ANALYSIS = "run_analysis"
    # governance
    MANAGE_USERS = "manage_users"
    CHANGE_PROMPT = "change_prompt"
    CHANGE_SETTINGS = "change_settings"
    VIEW_LOGS = "view_logs"
    READ_DASHBOARD = "read_dashboard"
    READ_APPROVED_DECISIONS = "read_approved_decisions"


ROLE_PERMISSIONS: Dict[Role, Set[Perm]] = {
    Role.founder: {Perm.ALL},
    Role.admin: {
        Perm.MANAGE_DOCUMENTS, Perm.MANAGE_TASKS, Perm.RUN_ANALYSIS, Perm.VIEW_LOGS,
        Perm.READ_KNOWLEDGE, Perm.READ_DASHBOARD, Perm.CREATE_DRAFT_DECISION,
        Perm.APPROVE_DECISION, Perm.CREATE_TASKS, Perm.UPLOAD_FILES,
        Perm.READ_APPROVED_DECISIONS, Perm.RUN_APPROVED_WORKFLOW,
    },
    Role.operator: {
        Perm.UPLOAD_FILES, Perm.CREATE_TASKS, Perm.RUN_APPROVED_WORKFLOW,
        Perm.READ_KNOWLEDGE, Perm.READ_DASHBOARD,
    },
    Role.analyst: {
        Perm.RUN_ANALYSIS, Perm.READ_KNOWLEDGE, Perm.CREATE_DRAFT_DECISION,
        Perm.READ_DASHBOARD,
    },
    Role.viewer: {
        Perm.READ_DASHBOARD, Perm.READ_APPROVED_DECISIONS,
    },
}


def role_has_permission(role: str, perm: Perm) -> bool:
    try:
        r = Role(role)
    except ValueError:
        return False
    perms = ROLE_PERMISSIONS.get(r, set())
    return Perm.ALL in perms or perm in perms


def permissions_for_role(role: str) -> list[str]:
    try:
        r = Role(role)
    except ValueError:
        return []
    perms = ROLE_PERMISSIONS.get(r, set())
    if Perm.ALL in perms:
        return ["all"]
    return sorted(p.value for p in perms)
