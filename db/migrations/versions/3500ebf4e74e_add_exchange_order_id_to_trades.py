"""Add exchange_order_id to trades

Revision ID: 3500ebf4e74e
Revises: 6a9d2808dd38
Create Date: 2026-06-28 20:58:43.193584

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3500ebf4e74e'
down_revision: Union[str, Sequence[str], None] = '6a9d2808dd38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("trades", sa.Column("exchange_order_id", sa.String(length=128), nullable=True))
    op.create_index(op.f("ix_trades_exchange_order_id"), "trades", ["exchange_order_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_trades_exchange_order_id"), table_name="trades")
    op.drop_column("trades", "exchange_order_id")
