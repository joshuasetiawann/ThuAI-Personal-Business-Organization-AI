"""initial baseline — create all tables from the ORM metadata.

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-01

This baseline creates the full current schema from db.models (single source of
truth). Subsequent migrations should be generated with
`alembic revision --autogenerate -m "..."`.
"""
from alembic import op  # noqa: F401
from db.base import Base
import db.models  # noqa: F401

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(op.get_bind())
