import logging
from collections.abc import AsyncGenerator
from sqlalchemy import event, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_async_engine(settings.database_url, echo=False, future=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# SQLite does not enforce foreign key constraints (including the
# ON DELETE CASCADE declared on Relationship.source_node_id /
# target_node_id) unless PRAGMA foreign_keys is turned on for each
# connection. Without this, deleting a node leaves its relationships
# behind as orphaned rows that reference a node that no longer exists.
if engine.dialect.name == "sqlite":

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


def _ensure_relationship_pair_constraint(sync_conn: Connection) -> None:
    """Bolts Relationship.node_pair_key + its unique index onto a
    database whose `relationships` table already existed before this
    column did.

    `Base.metadata.create_all` (called right before this) only
    creates tables that don't exist yet — it never alters an
    existing table, so a dev database from before this column was
    added would otherwise crash on the first query that touches it.
    """
    columns = {
        row[1]
        for row in sync_conn.execute(text("PRAGMA table_info(relationships)")).fetchall()
    }

    if not columns:
        # Table doesn't exist yet (fresh database) — create_all
        # above already created it with the column, nothing to do.
        return

    if "node_pair_key" not in columns:
        sync_conn.execute(text("ALTER TABLE relationships ADD COLUMN node_pair_key VARCHAR(73)"))

    sync_conn.execute(
        text(
            """
            UPDATE relationships
            SET node_pair_key = CASE
                WHEN source_node_id < target_node_id
                THEN source_node_id || '|' || target_node_id
                ELSE target_node_id || '|' || source_node_id
            END
            WHERE node_pair_key IS NULL
            """
        )
    )

    try:
        sync_conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_relationship_node_pair "
                "ON relationships (graph_id, node_pair_key)"
            )
        )
    except Exception:
        # A database that already has duplicate (graph_id,
        # node_pair_key) pairs from before this constraint existed
        # would fail here. Crashing every future startup over that
        # would be worse than starting once without the DB-level
        # guarantee — new rows are still caught by the
        # application-level check in relationship_service.py.
        logger.warning(
            "Could not create unique index on relationships(graph_id, node_pair_key) — "
            "the database may already contain duplicate relationship pairs.",
            exc_info=True,
        )


async def init_db() -> None:
    from app.models import graph, node, relationship, protocol, execution  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        if engine.dialect.name == "sqlite":
            await conn.run_sync(_ensure_relationship_pair_constraint)
