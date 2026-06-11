"""Fixtures de integração — exigem Postgres real (o CI sobe como service).

Se pytest-asyncio/asyncpg não estiverem instalados (ambiente local mínimo),
os testes de integração são ignorados na coleta. Se as libs existirem mas o
Postgres não estiver acessível, cada teste é pulado (skip) pela fixture engine.
"""

from __future__ import annotations

try:
    import asyncpg  # noqa: F401
    import pytest_asyncio

    _HAVE_DEPS = True
except ImportError:
    _HAVE_DEPS = False

# Sem as dependências async, ignora todos os test_*.py desta pasta na coleta.
if not _HAVE_DEPS:
    collect_ignore_glob = ["test_*.py"]
else:
    import pytest
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    import app.db.models  # noqa: F401 — garante que todos os modelos entram no metadata
    from app.db.base import Base

    @pytest_asyncio.fixture
    async def engine():
        """Engine de teste; cria o schema e dá skip se o Postgres não responder."""
        from app.core.config import get_settings

        cfg = get_settings()
        eng = create_async_engine(cfg.database_url, poolclass=NullPool)

        try:
            async with eng.connect() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception:
            await eng.dispose()
            pytest.skip("Postgres indisponível — teste de integração pulado")

        async with eng.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
            await conn.run_sync(Base.metadata.create_all)

        yield eng

        async with eng.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await eng.dispose()

    @pytest_asyncio.fixture
    async def session(engine):
        sm = async_sessionmaker(engine, expire_on_commit=False)
        async with sm() as s:
            yield s

    @pytest_asyncio.fixture
    async def client(engine):
        """AsyncClient sobre o app, com get_db apontando para o engine de teste."""
        from app.db.session import get_db
        from app.main import app

        sm = async_sessionmaker(engine, expire_on_commit=False)

        async def _override_get_db():
            async with sm() as s:
                yield s

        app.dependency_overrides[get_db] = _override_get_db
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        app.dependency_overrides.clear()
