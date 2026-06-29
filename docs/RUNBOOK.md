# RUNBOOK — NBA Scout

Operação e resposta a incidentes em produção (VPS + Docker Compose).
Comandos assumem `cd $DEPLOY_PATH` (default `/opt/nba-scout`) e:

```bash
COMPOSE="docker compose -f docker/compose.yml -f docker/compose.prod.yml"
```

## Comandos rápidos

| Ação | Comando |
|---|---|
| Status dos serviços | `$COMPOSE ps` |
| Logs (todos / um) | `$COMPOSE logs -f` · `$COMPOSE logs -f api` |
| Reiniciar um serviço | `$COMPOSE restart worker` |
| Healthcheck | `curl -s localhost:8000/health/ready \| jq` |
| Migrar | `$COMPOSE run --rm api alembic upgrade head` |
| Shell no container | `$COMPOSE exec api bash` |
| Status da análise | `curl -s localhost:8000/api/status \| jq` |

`/health/ready` retorna `{"status":"ok\|degraded","checks":{"postgres":...,"redis":...}}`.

---

## Incidente: `nba_api` / stats.nba.com com geoblock

**Sintoma:** logs do worker com timeouts/403 do `nba_api`; análise cai em **modo demo**
ou jogos não carregam. Comum em **IP de cloud** e na **offseason**.

**Diagnóstico:**
```bash
$COMPOSE logs --tail=100 worker | grep -iE "nba_api|geoblock|timeout|forbidden"
```

**Mitigação:**
1. Configure um **proxy** de saída no `.env` do host e re-suba:
   ```bash
   # .env
   HTTPS_PROXY=http://user:pass@proxy-host:port
   HTTP_PROXY=http://user:pass@proxy-host:port
   ```
   ```bash
   $COMPOSE up -d --no-build api worker
   ```
2. Na **offseason** é esperado não haver jogos → o sistema usa **modo demo**
   automaticamente; não é incidente.
3. Confirme `NBA_API_TIMEOUT` (default 30s) adequado.

---

## Incidente: quota da Odds API estourada (500 req/mês)

**Sintoma:** `/api/status` mostra `quota_remaining` baixo/zero; props não atualizam;
logs "Odds API sem eventos / quota".

**Diagnóstico:**
```bash
curl -s localhost:8000/api/status | jq '.quota_remaining'
$COMPOSE logs --tail=100 worker | grep -i quota
```

**Mitigação:**
1. **Reduza a frequência** do cron: `CRON_ANALYSIS_HOUR` controla a hora; a análise é
   1×/dia por padrão. Não aumente sem folga de quota.
2. Evite disparos manuais excessivos de `POST /api/refresh` (há throttle de 60s via
   lock no Redis, mas cada run consome quota).
3. Aguarde o reset mensal da quota ou faça upgrade do plano da Odds API.
4. Enquanto isso, o app continua servindo o **último snapshot** do banco/cache.

---

## Incidente: worker travado / jobs não processam

**Sintoma:** `POST /api/refresh` retorna `queued:true` mas `/api/status` nunca sai de
`running`/não atualiza; sem logs novos no worker.

**Ação:**
```bash
$COMPOSE logs --tail=200 worker
$COMPOSE restart worker
# se persistir, recriar:
$COMPOSE up -d --no-build --force-recreate worker
```
O ARQ tem `job_timeout=300s` e `max_jobs=4`. Jobs órfãos: limpe a fila no Redis se
necessário (cuidado):
```bash
$COMPOSE exec redis redis-cli KEYS 'arq:*'
```

---

## Incidente: Redis indisponível

**Sintoma:** `/health/ready` → `redis: error`. A API é **fail-soft**: continua
servindo (sem cache/queue); `POST /api/refresh` fica indisponível.

**Ação:**
```bash
$COMPOSE ps redis
$COMPOSE restart redis
curl -s localhost:8000/health/ready | jq
```

---

## Incidente: Postgres indisponível / API `degraded`

**Sintoma:** `/health/ready` → `postgres: error`; endpoints de dados falham.

**Ação:**
```bash
$COMPOSE ps postgres
$COMPOSE logs --tail=100 postgres
$COMPOSE up -d --no-build --wait postgres
```
Se o volume corrompeu, restaure de backup (abaixo).

---

## Restore de backup (PostgreSQL)

Backups gerados por `scripts/backup-postgres.sh` em `./backups/nba_scout-*.sql.gz`.

```bash
cd /opt/nba-scout
COMPOSE="docker compose -f docker/compose.yml -f docker/compose.prod.yml"

# 1) Pare a app (mantém o banco no ar)
$COMPOSE stop api worker

# 2) Restaure (o dump tem --clean --if-exists; recria objetos)
gunzip -c backups/nba_scout-AAAAMMDD-HHMMSS.sql.gz | \
  $COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# 3) Suba de novo
$COMPOSE up -d --no-build --wait
curl -s localhost:8000/health/ready | jq
```

---

## Reverter migration (rollback de schema)

`deploy.yml` roda `alembic upgrade head`, mas **não** faz downgrade automático.
Se um deploy quebrou o schema:

```bash
$COMPOSE run --rm api alembic current      # revisão atual
$COMPOSE run --rm api alembic history      # histórico
$COMPOSE run --rm api alembic downgrade -1 # volta 1 revisão
```
Depois, faça rollback da imagem para a versão compatível (ver
[DEPLOY.md](./DEPLOY.md) § Rollback). Prefira sempre migrations **aditivas**.

---

## Deploy travado / concorrente

`deploy.yml` usa `concurrency` por environment e **não** cancela um deploy em
andamento. Se um run ficou preso, cancele em **Actions** e re-rode com `dry_run=true`
para inspecionar o plano antes de reaplicar.
