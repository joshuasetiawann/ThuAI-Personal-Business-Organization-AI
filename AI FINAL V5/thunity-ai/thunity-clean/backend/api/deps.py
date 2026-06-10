"""Convenience re-exports for route dependencies."""
from db.base import get_db  # noqa: F401
from core.security import get_current_user, require_role, require_permission  # noqa: F401
from core.permissions import Perm, Role  # noqa: F401
