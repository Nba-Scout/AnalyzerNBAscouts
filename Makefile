.PHONY: dev test lint format type-check build migrate makemigration logs clean

# ── Desenvolvimento local ──────────────────────────────────────────────────
dev:
	docker compose -f docker/compose.yml -f docker/compose.override.yml up --build postgres redis api worker

dev-frontend:
	cd frontend && npm run dev

# ── Backend ────────────────────────────────────────────────────────────────
test:
	cd backend && python -m pytest tests/ -v

lint:
	cd backend && ruff check app tests

format:
	cd backend && ruff format app tests

type-check:
	cd backend && mypy app --ignore-missing-imports

# ── Banco de dados ─────────────────────────────────────────────────────────
migrate:
	cd backend && alembic upgrade head

makemigration:
	cd backend && alembic revision --autogenerate -m "$(msg)"

# ── Docker ─────────────────────────────────────────────────────────────────
build:
	docker compose -f docker/compose.yml build

logs:
	docker compose -f docker/compose.yml logs -f

down:
	docker compose -f docker/compose.yml down

# ── Frontend ───────────────────────────────────────────────────────────────
frontend-build:
	cd frontend && npm run build

frontend-install:
	cd frontend && npm install

# ── Limpeza ────────────────────────────────────────────────────────────────
clean:
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	find backend -name "*.pyc" -delete 2>/dev/null; true
