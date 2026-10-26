#!/usr/bin/env bash
# Roda uma vez na criação do Codespace: .env + dependências de backend e frontend.
# A stack em si sobe com `make dev-up` (o daemon Docker ainda não está pronto aqui).
set -euo pipefail
cd "$(dirname "$0")/.."

# .env gerado do template na primeira vez, com senha do Postgres aleatória.
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" .env
fi

# Chave da Odds API vem do secret do Codespaces (nunca do repositório).
if [ -n "${ODDS_API_KEY:-}" ]; then
  sed -i "s/^ODDS_API_KEY=.*/ODDS_API_KEY=${ODDS_API_KEY}/" .env
else
  echo "aviso: secret ODDS_API_KEY não configurado — a análise vai rodar em modo demo."
fi

pip install --no-cache-dir --quiet uv
(cd backend && uv sync --extra dev)
(cd frontend && npm ci)

echo
echo "Pronto. Suba a stack com:  make dev-up   e o frontend com:  make dev-frontend"
