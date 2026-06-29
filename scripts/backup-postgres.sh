#!/usr/bin/env bash
# Backup do PostgreSQL do NBA Scout (pg_dump via container do compose).
#
# Uso (no host, a partir da raiz do repo):
#   bash scripts/backup-postgres.sh
#
# Variáveis (env ou .env da raiz):
#   BACKUP_DIR        destino dos dumps        (default: ./backups)
#   BACKUP_RETENTION  dias a manter            (default: 14)
#   COMPOSE_FILES     args -f do compose       (default: -f docker/compose.yml -f docker/compose.prod.yml)
#   POSTGRES_USER / POSTGRES_DB                (lidos do .env se presente)
#
# Agendar via crontab do host (diário às 04:00):
#   0 4 * * * cd /opt/nba-scout && bash scripts/backup-postgres.sh >> /var/log/nba-scout-backup.log 2>&1
#
# Restore: ver docs/RUNBOOK.md (seção "Restore de backup").

set -euo pipefail

cd "$(dirname "$0")/.."

# Carrega .env da raiz, se existir (POSTGRES_USER/DB etc.)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-14}"
COMPOSE_FILES="${COMPOSE_FILES:--f docker/compose.yml -f docker/compose.prod.yml}"
PG_USER="${POSTGRES_USER:-nba_scout}"
PG_DB="${POSTGRES_DB:-nba_scout}"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/nba_scout-$TS.sql.gz"

echo "==> Dump de '$PG_DB' (user=$PG_USER) -> $OUT"
# -T: sem TTY (rodável em cron). pg_dump roda dentro do container postgres.
docker compose $COMPOSE_FILES exec -T postgres \
  pg_dump -U "$PG_USER" -d "$PG_DB" --clean --if-exists \
  | gzip -9 > "$OUT"

echo "==> OK ($(du -h "$OUT" | cut -f1))"

echo "==> Removendo backups com mais de $BACKUP_RETENTION dias"
find "$BACKUP_DIR" -name 'nba_scout-*.sql.gz' -type f -mtime +"$BACKUP_RETENTION" -print -delete || true

echo "==> Concluído."
