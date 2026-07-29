"""Testes da A1 — SQL echo desacoplado de environment + timeout ARQ↔Redis.

Garantem que `ENVIRONMENT=development` não liga mais o echo de SQL por si só e
que o `get_redis_settings()` aplica um `conn_timeout` folgado (o default de 1s do
ARQ era a causa-raiz do crash-loop do worker no fan-out do backfill).
"""

from __future__ import annotations

from app.core.config import Settings


def test_sql_echo_default_false(monkeypatch):
    monkeypatch.delenv("SQL_ECHO", raising=False)  # isola de os.environ (não só do .env)
    assert Settings(_env_file=None).sql_echo is False


def test_sql_echo_env_override(monkeypatch):
    monkeypatch.setenv("SQL_ECHO", "true")
    assert Settings(_env_file=None).sql_echo is True
    monkeypatch.setenv("SQL_ECHO", "false")
    assert Settings(_env_file=None).sql_echo is False


def test_redis_conn_timeout_defaults(monkeypatch):
    monkeypatch.delenv("REDIS_CONN_TIMEOUT", raising=False)
    monkeypatch.delenv("REDIS_CONN_RETRIES", raising=False)
    cfg = Settings(_env_file=None)
    assert cfg.redis_conn_timeout == 10  # não o default 1s do ARQ, nem pendura startup
    assert cfg.redis_conn_retries == 5


def test_redis_conn_timeout_env_override(monkeypatch):
    monkeypatch.setenv("REDIS_CONN_TIMEOUT", "45")
    assert Settings(_env_file=None).redis_conn_timeout == 45


def test_redis_conn_retries_env_override(monkeypatch):
    monkeypatch.setenv("REDIS_CONN_RETRIES", "9")
    assert Settings(_env_file=None).redis_conn_retries == 9


def test_engine_echo_follows_sql_echo(monkeypatch):
    """get_engine() usa cfg.sql_echo — não mais cfg.environment."""
    import app.db.session as sess

    # echo ligado
    monkeypatch.setattr(sess, "_engine", None)
    monkeypatch.setattr(sess, "get_settings", lambda: Settings(_env_file=None, sql_echo=True))
    assert sess.get_engine().echo is True

    # echo desligado mesmo em environment=development
    monkeypatch.setattr(sess, "_engine", None)
    monkeypatch.setattr(
        sess, "get_settings", lambda: Settings(_env_file=None, sql_echo=False, environment="development")
    )
    assert sess.get_engine().echo is False

    monkeypatch.setattr(sess, "_engine", None)  # não vaza engine p/ outros testes


def test_build_redis_settings_applies_timeout(monkeypatch):
    """O builder central aplica o timeout/retries do config."""
    import app.core.arq as arqmod

    monkeypatch.setattr(
        arqmod, "get_settings", lambda: Settings(_env_file=None, redis_conn_timeout=42, redis_conn_retries=7)
    )
    rs = arqmod.build_redis_settings()
    assert rs.conn_timeout == 42
    assert rs.conn_retries == 7


def test_get_redis_settings_delegates_to_builder(monkeypatch):
    """O consumidor (WorkerSettings) usa o mesmo builder → mesmo timeout."""
    import app.core.arq as arqmod
    import app.workers.settings as ws

    monkeypatch.setattr(arqmod, "get_settings", lambda: Settings(_env_file=None, redis_conn_timeout=33))
    assert ws.get_redis_settings().conn_timeout == 33


async def test_producer_pool_uses_timeout(monkeypatch):
    """REGRESSÃO: o pool PRODUTOR (init_arq_pool) também recebe o timeout folgado —
    é ele que faz o fan-out de enqueue do backfill (a origem do crash-loop)."""
    import app.core.arq as arqmod

    captured: dict = {}

    async def fake_create_pool(rs):
        captured["rs"] = rs
        return object()  # pool fake

    monkeypatch.setattr(arqmod, "create_pool", fake_create_pool)
    monkeypatch.setattr(
        arqmod, "get_settings", lambda: Settings(_env_file=None, redis_conn_timeout=42, redis_conn_retries=7)
    )
    try:
        await arqmod.init_arq_pool()
        assert captured["rs"].conn_timeout == 42  # não o default 1s do ARQ
        assert captured["rs"].conn_retries == 7
    finally:
        arqmod._pool = None  # não vaza o pool fake p/ outros testes
