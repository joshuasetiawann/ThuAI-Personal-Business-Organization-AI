# Contract — Tool Use
**Purpose:** Constrain how agents/automation may act.
**Rule:** agents may ONLY use tools registered in `backend/tools/registry.py`. Free-form function calling is not permitted.
**Each tool declares:** name, description, input_schema, risk_level, required_permission, handler, audit flag.
**Risk:** high/critical tools (e.g. trigger_allowed_workflow, delete) require the Approval Gate; every tool invocation that is audited writes an audit_logs entry.
**Forbidden:** triggering non-allowlisted workflows; deleting data without approval; any external/cloud call.
