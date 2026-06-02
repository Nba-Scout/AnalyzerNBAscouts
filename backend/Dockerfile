# ── Stage 1: instala dependências ──────────────────────────────────────────
FROM python:3.14-slim AS deps

WORKDIR /app
RUN pip install uv --no-cache-dir

COPY pyproject.toml .
RUN uv pip install --system --no-cache -e ".[dev]"


# ── Stage 2: runtime slim ───────────────────────────────────────────────────
FROM python:3.14-slim AS runtime

# Usuário não-root
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copia deps instalados do stage anterior
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

COPY . .

RUN chown -R appuser:appuser /app
USER appuser

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Gunicorn + UvicornWorker em produção
CMD ["gunicorn", "app.main:app", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-w", "2", \
     "-b", "0.0.0.0:8000", \
     "--access-logfile", "-"]
