.PHONY: dev test lint format type-check build migrate makemigration logs clean deploy migrate-prod logs-prod backup backfill backfill-dev

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

# ── Produção (rodar NO HOST/VPS — ver docs/DEPLOY.md) ───────────────────────
COMPOSE_PROD = docker compose -f docker/compose.yml -f docker/compose.prod.yml

deploy:
	$(COMPOSE_PROD) pull
	$(COMPOSE_PROD) up -d --no-build --wait postgres redis
	$(COMPOSE_PROD) run --rm api alembic upgrade head
	$(COMPOSE_PROD) up -d --no-build --wait

migrate-prod:
	$(COMPOSE_PROD) run --rm api alembic upgrade head

logs-prod:
	$(COMPOSE_PROD) logs -f

backup:
	bash scripts/backup-postgres.sh

# Seed inicial do data warehouse (enfileira backfill ESPN de 2 temporadas p/ todos
# os ativos; o worker processa em background e o prune mantém o teto por jogador).
backfill:
	$(COMPOSE_PROD) run --rm api python -m app.workers.enqueue backfill_all_active 2

# Idem, mas na stack de dev (compose base).
backfill-dev:
	docker compose -f docker/compose.yml run --rm api python -m app.workers.enqueue backfill_all_active 2

# ── Limpeza ────────────────────────────────────────────────────────────────
clean:
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	find backend -name "*.pyc" -delete 2>/dev/null; true
