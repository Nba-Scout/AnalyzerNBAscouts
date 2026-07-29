#!/usr/bin/env bash
# Verificação do host de deploy do NBA Scout — checklist de saída da tarefa B1.
#
# SOMENTE LEITURA: não altera nada. Imprime um checklist e sai com código 1 se
# algum item obrigatório falhar (bom para colar na issue como evidência).
#
# Uso (no HOST):
#   sudo bash scripts/verify-host.sh
#
# Rode SEMPRE com sudo: os checks de segurança (config efetiva do sshd, firewall no
# kernel, jail do fail2ban, authorized_keys) exigem root. Sem root eles viram SKIP e
# o veredito NÃO é "pronto" — seria um falso OK num host que pode estar com senha de
# SSH habilitada e firewall desligado.
#
# Códigos de saída: 0 = pronto (avisos permitidos) · 1 = algum FAIL ·
#                   2 = incompleto (rodou sem root, veredito indefinido).

set -uo pipefail   # sem -e: o checklist tem de rodar até o fim mesmo com falhas

# Imprime o bloco de comentários do topo (tudo até a primeira linha não-comentário).
usage() { awk 'NR==1{next} /^#/{sub(/^#[[:space:]]?/,""); print; next} {exit}' "$0"; }

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/nba-scout}"
SSH_PORT="${SSH_PORT:-22}"

while [ $# -gt 0 ]; do
  case "$1" in
    --user) DEPLOY_USER="${2:?}"; shift 2 ;;
    --path) DEPLOY_PATH="${2:?}"; shift 2 ;;
    --ssh-port) SSH_PORT="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

FAILS=0
WARNS=0

pass() { printf '  \033[32m[ OK ]\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m[FAIL]\033[0m %s\n' "$1"; FAILS=$((FAILS + 1)); }
warn() { printf '  \033[33m[WARN]\033[0m %s\n' "$1"; WARNS=$((WARNS + 1)); }
skip() { printf '  [SKIP] %s\n' "$1"; }
sect() { printf '\n\033[1m%s\033[0m\n' "$1"; }

IS_ROOT=false
[ "$(id -u)" -eq 0 ] && IS_ROOT=true

# ── Sistema ─────────────────────────────────────────────────────────────────
sect "Sistema"
if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  if [ "${ID:-}" = "ubuntu" ] && [ "${VERSION_ID:-}" = "24.04" ]; then
    pass "SO: ${PRETTY_NAME:-Ubuntu 24.04}"
  else
    warn "SO: ${PRETTY_NAME:-?} (esperado Ubuntu 24.04)"
  fi
else
  warn "não deu para ler /etc/os-release"
fi

ARCH="$(dpkg --print-architecture 2>/dev/null || uname -m)"
case "$ARCH" in
  arm64|aarch64)
    pass "Arquitetura: $ARCH (exige imagens multi-arch no ghcr — ver build-push.yml)" ;;
  amd64|x86_64)
    pass "Arquitetura: $ARCH" ;;
  *)
    warn "Arquitetura inesperada: $ARCH" ;;
esac

MEM_MB="$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 0)"
if [ "$MEM_MB" -ge 1800 ]; then
  pass "RAM: ${MEM_MB} MB"
else
  warn "RAM: ${MEM_MB} MB (o plano pede >= 2 GB; postgres+redis+api+worker vão apertar)"
fi

DISK_AVAIL="$(df -BG --output=avail / 2>/dev/null | tail -1 | tr -dc '0-9')"
if [ -n "$DISK_AVAIL" ] && [ "$DISK_AVAIL" -ge 10 ]; then
  pass "Disco livre em /: ${DISK_AVAIL} GB"
else
  warn "Disco livre em /: ${DISK_AVAIL:-?} GB (imagens + pgdata + backups precisam de folga)"
fi

TZ_NOW="$(timedatectl show --property=Timezone --value 2>/dev/null || cat /etc/timezone 2>/dev/null || echo '?')"
if [ "$TZ_NOW" = "UTC" ] || [ "$TZ_NOW" = "Etc/UTC" ]; then
  pass "Timezone: $TZ_NOW (os crons do worker são em UTC)"
else
  warn "Timezone: $TZ_NOW — os crons do worker usam UTC; cuidado ao ler logs"
fi

# ── Docker ──────────────────────────────────────────────────────────────────
sect "Docker"
if command -v docker >/dev/null 2>&1; then
  pass "docker: $(docker --version | sed 's/Docker version //')"
  if docker compose version >/dev/null 2>&1; then
    pass "compose plugin: $(docker compose version --short 2>/dev/null || echo 'presente')"
  else
    fail "docker compose (plugin v2) ausente — deploy.yml depende dele"
  fi
  if docker info >/dev/null 2>&1; then
    pass "daemon do docker respondendo"
  else
    fail "daemon do docker não respondeu (systemctl status docker)"
  fi
else
  fail "docker não instalado"
fi

# ── Usuário de deploy ───────────────────────────────────────────────────────
sect "Usuário de deploy"
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  pass "usuário '$DEPLOY_USER' existe"
  if id -nG "$DEPLOY_USER" 2>/dev/null | tr ' ' '\n' | grep -qx docker; then
    pass "'$DEPLOY_USER' está no grupo docker"
  else
    fail "'$DEPLOY_USER' NÃO está no grupo docker — o deploy via SSH vai falhar"
  fi

  AUTH_KEYS="/home/$DEPLOY_USER/.ssh/authorized_keys"
  if [ "$IS_ROOT" = true ]; then
    if [ -s "$AUTH_KEYS" ]; then
      pass "$(grep -c . "$AUTH_KEYS") chave(s) em authorized_keys"
      PERM="$(stat -c '%a' "$AUTH_KEYS")"
      if [ "$PERM" = "600" ]; then
        pass "permissão de authorized_keys: $PERM"
      else
        warn "permissão de authorized_keys: $PERM (esperado 600)"
      fi
    else
      fail "authorized_keys vazio/ausente — sem login por chave"
    fi
  else
    skip "authorized_keys (precisa de sudo)"
  fi
else
  fail "usuário '$DEPLOY_USER' não existe"
fi

# ── SSH ─────────────────────────────────────────────────────────────────────
sect "SSH"
if [ "$IS_ROOT" = true ] && command -v sshd >/dev/null 2>&1; then
  SSHD_EFF="$(sshd -T 2>/dev/null)"
  if [ -n "$SSHD_EFF" ]; then
    if printf '%s\n' "$SSHD_EFF" | grep -qi '^passwordauthentication no'; then
      pass "PasswordAuthentication no"
    else
      fail "PasswordAuthentication está ATIVA — só chave, por favor"
    fi
    if printf '%s\n' "$SSHD_EFF" | grep -qi '^permitrootlogin no'; then
      pass "PermitRootLogin no"
    else
      warn "PermitRootLogin não está 'no'"
    fi
  else
    # FAIL, não WARN: sem a config efetiva não há como afirmar que o SSH está
    # endurecido — e "avisos são permitidos" deixaria o veredito passar.
    fail "'sshd -T' não retornou config efetiva — impossível confirmar o hardening do SSH"
  fi
else
  skip "config efetiva do sshd (precisa de sudo e do binário sshd)"
fi

# ── Firewall ────────────────────────────────────────────────────────────────
sect "Firewall"
if command -v ufw >/dev/null 2>&1; then
  if [ "$IS_ROOT" = true ]; then
    UFW_OUT="$(ufw status verbose 2>/dev/null)"
    if printf '%s' "$UFW_OUT" | grep -qi 'Status: active'; then
      pass "ufw ativo"
    else
      fail "ufw inativo"
    fi
    if printf '%s' "$UFW_OUT" | grep -qi 'deny (incoming)'; then
      pass "política de entrada: deny"
    else
      fail "política de entrada não é deny"
    fi
    for p in "$SSH_PORT" 80 443; do
      if printf '%s' "$UFW_OUT" | grep -qE "^${p}/tcp"; then
        pass "porta $p/tcp liberada"
      else
        fail "porta $p/tcp não liberada"
      fi
    done

    # CRÍTICO: tudo acima vem de /etc/ufw (config), NÃO do kernel. Um
    # `iptables-restore` sem --noflush (o que o netfilter-persistent faz ao
    # recarregar rules.v4) apaga as chains ufw-* do kernel e o `ufw status`
    # continua dizendo "active" — firewall inexistente com checklist verde.
    # Então conferimos o kernel de verdade.
    if command -v iptables >/dev/null 2>&1; then
      if iptables -S INPUT 2>/dev/null | grep -q 'ufw'; then
        pass "kernel: chain INPUT com regras do ufw carregadas"
      else
        fail "kernel SEM regras do ufw na INPUT — o ufw se diz ativo mas o firewall não está aplicado (iptables -S INPUT)"
      fi
    else
      skip "estado do firewall no kernel (iptables ausente)"
    fi
  else
    skip "status do ufw (precisa de sudo)"
  fi
else
  fail "ufw não instalado"
fi

# Regras legadas da imagem da Oracle competindo com o ufw.
LEGACY_RULES="/etc/iptables/rules.v4"
if [ "$IS_ROOT" = true ] && [ -f "$LEGACY_RULES" ]; then
  if grep -qE 'REJECT|DROP' "$LEGACY_RULES" 2>/dev/null; then
    fail "$LEGACY_RULES tem REJECT/DROP (imagem Oracle): 80/443 seguem bloqueados apesar do ufw — rode provision-vps.sh --oci-iptables-fix"
  else
    pass "sem regras legadas de iptables conflitando"
  fi
fi

# Portas publicadas pelo Docker entram por DNAT e não passam pela chain INPUT, ou
# seja: o "deny incoming" do ufw NÃO as fecha. Enquanto não houver reverse proxy
# (B2), api e frontend ficam expostos direto na internet.
if [ "$IS_ROOT" = true ] && command -v ss >/dev/null 2>&1; then
  EXPOSED="$(ss -ltnH 2>/dev/null | awk '{print $4}' | grep -E '(^|\*|0\.0\.0\.0|\[::\]):(8000|8080)$' || true)"
  if [ -n "$EXPOSED" ]; then
    warn "8000/8080 escutando em todas as interfaces: o ufw não bloqueia porta publicada pelo Docker (DNAT). Sem TLS até o B2 — não divulgue o IP."
  fi
fi

# ── Serviços de segurança ───────────────────────────────────────────────────
sect "Segurança"
if systemctl is-active --quiet fail2ban 2>/dev/null; then
  pass "fail2ban ativo"
  if [ "$IS_ROOT" = true ]; then
    if fail2ban-client status sshd >/dev/null 2>&1; then
      pass "jail 'sshd' carregada"
    else
      warn "jail 'sshd' não carregada (no Ubuntu 24.04 exige backend = systemd)"
    fi
  else
    skip "jail do fail2ban (precisa de sudo)"
  fi
else
  fail "fail2ban não está ativo"
fi

AUTO_UPG="/etc/apt/apt.conf.d/20auto-upgrades"
# Ancorado no início da linha: sem isso, a linha COMENTADA que o pacote instala
# (//APT::Periodic::Unattended-Upgrade "1";) casaria e daria um falso OK.
if [ -f "$AUTO_UPG" ] && grep -qE '^APT::Periodic::Unattended-Upgrade[[:space:]]+"1";' "$AUTO_UPG" 2>/dev/null; then
  pass "unattended-upgrades habilitado"
else
  warn "unattended-upgrades não habilitado ($AUTO_UPG)"
fi

# ── Checkout e .env ─────────────────────────────────────────────────────────
sect "Aplicação"
if [ -d "$DEPLOY_PATH/.git" ]; then
  pass "checkout do repo em $DEPLOY_PATH"
  for f in docker/compose.yml docker/compose.prod.yml; do
    if [ -f "$DEPLOY_PATH/$f" ]; then
      pass "$f presente"
    else
      fail "$f ausente — deploy.yml não vai conseguir subir a stack"
    fi
  done
else
  fail "sem checkout do repo em $DEPLOY_PATH (DEPLOY_PATH do Environment)"
fi

ENV_FILE="$DEPLOY_PATH/.env"
if [ -f "$ENV_FILE" ]; then
  pass ".env presente"
  PERM="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || echo '?')"
  if [ "$PERM" = "600" ]; then
    pass "permissão do .env: $PERM"
  else
    warn "permissão do .env: $PERM (esperado 600 — contém a senha do Postgres)"
  fi
  if [ -r "$ENV_FILE" ]; then
    # Lê o VALOR da chave em vez de casar a linha crua: um .env salvo no Windows
    # vem com CRLF e o \r invisível fazia o regex '...$' falhar (falso [ OK ]).
    env_val() { sed -n "s/^$1=//p" "$ENV_FILE" | tr -d '\r' | head -1; }
    # CRLF no .env também quebra o `. ./.env` do scripts/backup-postgres.sh.
    if grep -q $'\r' "$ENV_FILE"; then
      fail ".env tem CRLF — quebra o source do backup-postgres.sh; converta com: sed -i 's/\r\$//' .env"
    else
      pass ".env com fim de linha LF"
    fi

    if [ "$(env_val ENVIRONMENT)" = "production" ]; then
      pass "ENVIRONMENT=production"
    else
      fail "ENVIRONMENT não é production (liga echo de SQL e outros comportamentos de dev)"
    fi

    ODDS_VAL="$(env_val ODDS_API_KEY)"
    if [ -z "$ODDS_VAL" ] || [ "$ODDS_VAL" = "sua_chave_aqui" ]; then
      fail "ODDS_API_KEY não preenchida"
    else
      pass "ODDS_API_KEY preenchida"
    fi

    PG_VAL="$(env_val POSTGRES_PASSWORD)"
    if [ -z "$PG_VAL" ] || [ "$PG_VAL" = "changeme" ]; then
      fail "POSTGRES_PASSWORD ainda é o placeholder 'changeme'"
    else
      pass "POSTGRES_PASSWORD trocada"
    fi
  else
    skip "conteúdo do .env (sem permissão de leitura)"
  fi
else
  fail ".env ausente em $DEPLOY_PATH"
fi

# ── Resumo ──────────────────────────────────────────────────────────────────
printf '\n\033[1mResumo:\033[0m %d falha(s), %d aviso(s)\n' "$FAILS" "$WARNS"
if [ "$FAILS" -gt 0 ]; then
  printf 'Host NÃO está pronto para o deploy. Corrija os FAIL acima.\n'
  exit 1
fi
if [ "$IS_ROOT" != true ]; then
  # Sem root, os checks de segurança viraram SKIP. Dizer "pronto" aqui seria um falso
  # OK justamente nos itens que mais importam (senha do SSH, firewall, fail2ban).
  printf 'VEREDITO INDEFINIDO: rodou sem root, então os checks de segurança foram\n'
  printf 'pulados (SKIP). Rode "sudo bash %s" para um veredito real.\n' "$0"
  exit 2
fi
printf 'Host pronto. Próximo passo: secrets do Environment + deploy.yml com dry_run=true.\n'
exit 0
