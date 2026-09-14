from collections.abc import AsyncGenerator
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings


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


async def init_db() -> None:
    from app.models import graph, node, relationship, protocol, execution  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
