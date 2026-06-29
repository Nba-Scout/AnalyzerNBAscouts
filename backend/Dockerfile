# syntax=docker/dockerfile:1
# Multi-stage. O runtime recebe SÓ as dependências de produção (sem [dev]),
# reduzindo tamanho e superfície de ataque. A suíte de testes roda no CI
# (job backend de ci.yml) com Postgres/Redis como services — não num estágio aqui.

# ── Stage base: Python + uv ──────────────────────────────────────────────────
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

WORKDIR /app
RUN pip install uv --no-cache-dir


# ── Stage deps: SÓ dependências de produção ──────────────────────────────────
# Sem ".[dev]": o runtime não carrega pytest/ruff/mypy/etc.
FROM base AS deps

COPY pyproject.toml .
RUN uv pip install --system --no-cache -e .


# ── Stage runtime: slim, non-root, só deps de produção ───────────────────────
FROM python:3.11-slim AS runtime

# OCI labels (rastreabilidade da imagem)
LABEL org.opencontainers.image.title="nba-scout-backend" \
      org.opencontainers.image.description="NBA Scout — API FastAPI + worker ARQ (mesma imagem, command diferente)" \
      org.opencontainers.image.source="https://github.com/Nba-Scout/AnalyzerNBAscouts"

# Usuário não-root
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copia apenas as deps de produção instaladas no stage `deps`
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Código da aplicação (inclui alembic/ + migrations — necessárias p/ `alembic upgrade head`)
COPY . .

RUN chown -R appuser:appuser /app
USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    WEB_CONCURRENCY=2

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Gunicorn + UvicornWorker. Nº de workers é configurável via env WEB_CONCURRENCY
# (gunicorn honra a variável quando --workers não é passado).
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", \
     "--access-logfile", "-"]
