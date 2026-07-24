"""Testes da A1 — SQL echo desacoplado de environment + timeout ARQ↔Redis.

Garantem que `ENVIRONMENT=development` não liga mais o echo de SQL por si só e
que o `get_redis_settings()` aplica um `conn_timeout` folgado (o default de 1s do
ARQ era a causa-raiz do crash-loop do worker no fan-out do backfill).
"""

from __future__ import annotations

from app.core.config import Settings


def test_sql_echo_default_false():
    assert Settings(_env_file=None).sql_echo is False


def test_sql_echo_env_override(monkeypatch):
    monkeypatch.setenv("SQL_ECHO", "true")
    assert Settings(_env_file=None).sql_echo is True
    monkeypatch.setenv("SQL_ECHO", "false")
    assert Settings(_env_file=None).sql_echo is False


def test_redis_conn_timeout_defaults():
    cfg = Settings(_env_file=None)
    assert cfg.redis_conn_timeout == 30  # não o default 1s do ARQ
    assert cfg.redis_conn_retries == 5


def test_redis_conn_timeout_env_override(monkeypatch):
    monkeypatch.setenv("REDIS_CONN_TIMEOUT", "45")
    assert Settings(_env_file=None).redis_conn_timeout == 45


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


def test_get_redis_settings_applies_timeout(monkeypatch):
    import app.workers.settings as ws

    monkeypatch.setattr(
        ws, "get_settings", lambda: Settings(_env_file=None, redis_conn_timeout=42, redis_conn_retries=7)
    )
    rs = ws.get_redis_settings()
    assert rs.conn_timeout == 42
    assert rs.conn_retries == 7
