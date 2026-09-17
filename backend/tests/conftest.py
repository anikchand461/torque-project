"""
Session-wide test setup.

The existing test suite has no DB isolation (test_execution.py's
one HTTP test only hits /health, so it's never mattered). The new
relationship/protocol tests actually create graphs/nodes/
relationships/protocols, so — to honor "handle the existing SQLite
development database safely" — this points DATABASE_URL at a
throwaway temp file before anything in `app` gets imported, so test
runs never write into the real torque.db dev database.

This must happen before the first `from app...` import anywhere in
the test session, since app.core.config.get_settings() is
`@lru_cache`d and reads the environment exactly once. conftest.py is
loaded by pytest before test modules are collected, which is what
makes setting the env var here effective.
"""

import os
import tempfile

_tmp_db_fd, _tmp_db_path = tempfile.mkstemp(suffix=".db")
os.close(_tmp_db_fd)
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp_db_path}"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.database import init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def _ensure_tables():
    # Plain AsyncClient + ASGITransport (the pattern the
    # existing test_execution.py already uses) does not run
    # FastAPI's lifespan handler, so init_db() (create_all)
    # never fires on its own. It's idempotent, so calling it
    # before every test is cheap and safe.
    await init_db()
    yield


@pytest_asyncio.fixture()
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
