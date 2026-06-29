"""Inicialização do Sentry (captura de erros + tracing opcional).

Init compartilhado entre a API ([app/main.py]) e o worker ARQ
([app/workers/settings.py]). `analyze_day` roda no **worker**, então o Sentry
precisa estar ativo lá também para capturar suas exceções — não só na API.

No-op se `SENTRY_DSN` não estiver configurado (dev/CI). A integração FastAPI/
Starlette é habilitada automaticamente pelo sentry-sdk quando presente.
"""

from __future__ import annotations

import structlog

from app.core.config import get_settings

log = structlog.get_logger(__name__)

_initialized = False


def init_sentry() -> bool:
    """Inicializa o Sentry se SENTRY_DSN estiver setado. Retorna True se ativou."""
    global _initialized
    if _initialized:
        return True

    cfg = get_settings()
    if not cfg.sentry_dsn:
        return False

    try:
        import sentry_sdk
    except ImportError:  # pragma: no cover
        log.warning("sentry-sdk indisponível; init do Sentry ignorado")
        return False

    sentry_sdk.init(
        dsn=cfg.sentry_dsn,
        environment=cfg.environment,
        traces_sample_rate=cfg.sentry_traces_sample_rate,
        send_default_pii=False,
    )
    _initialized = True
    log.info("Sentry inicializado", environment=cfg.environment)
    return True
