#!/usr/bin/env bash
# Provisionamento do host de deploy do NBA Scout (Ubuntu 24.04).
#
# Idempotente: pode rodar de novo em cima de um host já provisionado sem estragar
# nada. Faz o passo 1 da tarefa B1 (ver docs/DEPLOY.md § "Provisionamento do host").
#
# Uso (no HOST, como usuário com sudo — na Oracle Cloud é o `ubuntu`):
#   git clone https://github.com/Nba-Scout/AnalyzerNBAscouts.git /tmp/nba-scout-prov
#   sudo bash /tmp/nba-scout-prov/scripts/provision-vps.sh --dry-run   # ensaia
#   sudo bash /tmp/nba-scout-prov/scripts/provision-vps.sh             # aplica
#
# O que faz:
#   1. Pacotes base + docker-ce + compose plugin (repo oficial da Docker).
#   2. Usuário de deploy (default `deploy`), sem senha, só chave SSH, no grupo docker.
#   3. Hardening do sshd: sem senha, sem login de root (só depois de garantir a chave).
#   4. ufw: deny incoming, allow 22/80/443 (SSH liberado ANTES de habilitar).
#   5. fail2ban (jail sshd, backend systemd) + unattended-upgrades.
#   6. Checkout do repo em DEPLOY_PATH + .env inicial com senha do Postgres gerada.
#
# Opções:
#   --user <nome>        usuário de deploy            (default: deploy)
#   --path <dir>         checkout do repo             (default: /opt/nba-scout)
#   --repo <url>         origem do clone              (default: repo público do projeto)
#   --ssh-key <val>      caminho de um .pub OU a chave literal ("ssh-ed25519 AAAA...").
#                        Se omitido, copia o authorized_keys de quem chamou o sudo.
#   --ssh-port <n>       porta do SSH p/ regra do ufw (default: 22)
#   --skip-repo          não clonar o repo nem criar .env
#   --no-harden-ssh      não mexer na config do sshd
#   --oci-iptables-fix   remove as regras legadas de iptables da imagem da Oracle
#                        que bloqueiam 80/443 (ver docs/DEPLOY.md; opt-in de propósito)
#   --dry-run            só imprime o que faria
#
# Segurança: o script se RECUSA a desabilitar senha no SSH se não houver uma chave
# pública instalada para o usuário de deploy — isso evitaria trancar você fora do host.

set -euo pipefail

# Imprime o bloco de comentários do topo (tudo até a primeira linha não-comentário),
# em vez de um intervalo de linhas fixo que sai de sincronia quando o script muda.
usage() { awk 'NR==1{next} /^#/{sub(/^#[[:space:]]?/,""); print; next} {exit}' "$0"; }

# ── Defaults ────────────────────────────────────────────────────────────────
DEPLOY_USER="deploy"
DEPLOY_PATH="/opt/nba-scout"
REPO_URL="https://github.com/Nba-Scout/AnalyzerNBAscouts.git"
SSH_KEY_INPUT=""
SSH_PORT="22"
SKIP_REPO=false
HARDEN_SSH=true
OCI_IPTABLES_FIX=false
DRY_RUN=false

while [ $# -gt 0 ]; do
  case "$1" in
    --user)       DEPLOY_USER="${2:?--user exige valor}"; shift 2 ;;
    --path)       DEPLOY_PATH="${2:?--path exige valor}"; shift 2 ;;
    --repo)       REPO_URL="${2:?--repo exige valor}"; shift 2 ;;
    --ssh-key)    SSH_KEY_INPUT="${2:?--ssh-key exige valor}"; shift 2 ;;
    --ssh-port)   SSH_PORT="${2:?--ssh-port exige valor}"; shift 2 ;;
    --skip-repo)  SKIP_REPO=true; shift ;;
    --no-harden-ssh) HARDEN_SSH=false; shift ;;
    --oci-iptables-fix) OCI_IPTABLES_FIX=true; shift ;;
    --dry-run)    DRY_RUN=true; shift ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "ERRO: opção desconhecida '$1' (use --help)" >&2; exit 2 ;;
  esac
done

# ── Helpers ─────────────────────────────────────────────────────────────────
step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }
warn() { printf '\033[33m    AVISO: %s\033[0m\n' "$1" >&2; }
die()  { printf '\033[31mERRO: %s\033[0m\n' "$1" >&2; exit 1; }

# Mensagem que AFIRMA um estado aplicado — silenciosa em dry-run, onde nada mudou.
applied() { [ "$DRY_RUN" = true ] || info "$1"; }

# Executa (ou só imprime, em dry-run) um comando. O eco usa %q para sair
# copiável/colável (argumentos com espaço mantêm as aspas).
run() {
  if [ "$DRY_RUN" = true ]; then
    printf '    [dry-run] '; printf '%q ' "$@"; printf '\n'
  else
    "$@"
  fi
}

# Escreve um arquivo com conteúdo vindo do stdin. Uso: write_file <path> <mode>
write_file() {
  local path="$1" mode="$2" content
  content="$(cat)"
  if [ "$DRY_RUN" = true ]; then
    printf '    [dry-run] escreveria %s (mode %s, %s linhas)\n' \
      "$path" "$mode" "$(printf '%s\n' "$content" | wc -l | tr -d ' ')"
    return 0
  fi
  install -D -m "$mode" /dev/null "$path"
  printf '%s\n' "$content" > "$path"
}

# ── Pré-condições ───────────────────────────────────────────────────────────
step "Pré-condições"
[ "$(id -u)" -eq 0 ] || die "rode com sudo (precisa criar usuário, instalar pacotes e mexer no firewall)"

ARCH="$(dpkg --print-architecture)"
info "Arquitetura: $ARCH"
if [ "$ARCH" = "arm64" ]; then
  info "Host ARM (ex.: Oracle Ampere A1). As imagens do ghcr precisam ter variante"
  info "linux/arm64 — o build-push.yml publica multi-arch desde o PR do B1."
fi

if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  info "SO: ${PRETTY_NAME:-desconhecido}"
  [ "${ID:-}" = "ubuntu" ] || warn "script testado no Ubuntu 24.04; siga por sua conta em ${ID:-outro SO}"
else
  warn "/etc/os-release ausente — não deu para identificar o SO"
fi

[ "$DRY_RUN" = true ] && info "MODO DRY-RUN: nada será alterado."

# ── 1. Pacotes base ────────────────────────────────────────────────────────
step "1/6 · Pacotes base"
export DEBIAN_FRONTEND=noninteractive
run apt-get update -qq
# openssl explícito: é usado para gerar a POSTGRES_PASSWORD do .env no passo 6.
run apt-get install -y -qq \
  ca-certificates curl gnupg git openssl ufw fail2ban unattended-upgrades
applied "pacotes base OK (docker vem do repo oficial no passo seguinte)"

# ── 2. Docker (repo oficial) ───────────────────────────────────────────────
step "2/6 · Docker + Compose plugin"
if command -v docker >/dev/null 2>&1; then
  info "docker já instalado: $(docker --version 2>/dev/null || echo '?')"
else
  run install -m 0755 -d /etc/apt/keyrings
  if [ "$DRY_RUN" = true ]; then
    info "[dry-run] baixaria a chave GPG da Docker p/ /etc/apt/keyrings/docker.asc"
  else
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  write_file /etc/apt/sources.list.d/docker.list 0644 <<EOF
deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME:-noble} stable
EOF
  run apt-get update -qq
  run apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
run systemctl enable --now docker

# ── 3. Usuário de deploy + chave SSH ───────────────────────────────────────
step "3/6 · Usuário '$DEPLOY_USER' + chave SSH"
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  info "usuário já existe"
else
  # --disabled-password: sem senha; login só por chave.
  run adduser --disabled-password --gecos "NBA Scout deploy" "$DEPLOY_USER"
fi
run usermod -aG docker "$DEPLOY_USER"
info "no grupo docker (atenção: grupo docker é equivalente a root no host)"

AUTH_KEYS="/home/$DEPLOY_USER/.ssh/authorized_keys"
PUBKEY=""
if [ -n "$SSH_KEY_INPUT" ]; then
  if [ -f "$SSH_KEY_INPUT" ]; then
    PUBKEY="$(cat "$SSH_KEY_INPUT")"
    info "chave lida de $SSH_KEY_INPUT"
  elif printf '%s' "$SSH_KEY_INPUT" | grep -qE '^(ssh-|ecdsa-)'; then
    PUBKEY="$SSH_KEY_INPUT"
    info "chave recebida como literal"
  else
    die "--ssh-key não é um arquivo existente nem uma chave pública válida"
  fi
else
  # Sem --ssh-key: reaproveita a chave de quem chamou o sudo (na Oracle, `ubuntu`).
  CALLER="${SUDO_USER:-}"
  CALLER_KEYS="/home/${CALLER}/.ssh/authorized_keys"
  if [ -n "$CALLER" ] && [ -s "$CALLER_KEYS" ]; then
    PUBKEY="$(cat "$CALLER_KEYS")"
    info "reaproveitando authorized_keys de '$CALLER' (nenhum --ssh-key informado)"
  else
    warn "nenhuma chave informada e não achei authorized_keys de '${CALLER:-?}'"
  fi
fi

if [ -n "$PUBKEY" ]; then
  if [ "$DRY_RUN" = true ]; then
    info "[dry-run] instalaria $(printf '%s\n' "$PUBKEY" | grep -c . ) chave(s) em $AUTH_KEYS"
  else
    install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
    # Idempotente: só acrescenta chave que ainda não está no arquivo.
    touch "$AUTH_KEYS"
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      grep -qxF "$line" "$AUTH_KEYS" || printf '%s\n' "$line" >> "$AUTH_KEYS"
    done <<< "$PUBKEY"
    chmod 0600 "$AUTH_KEYS"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH_KEYS"
    info "$(grep -c . "$AUTH_KEYS") chave(s) autorizada(s) em $AUTH_KEYS"
  fi
fi

# ── 4. Hardening do sshd ───────────────────────────────────────────────────
step "4/6 · Hardening do SSH"
if [ "$HARDEN_SSH" != true ]; then
  info "pulado (--no-harden-ssh)"
elif [ "$DRY_RUN" != true ] && [ ! -s "$AUTH_KEYS" ]; then
  # Trava de segurança: desligar senha sem chave instalada = lockout.
  warn "sem chave em $AUTH_KEYS — NÃO vou desabilitar a senha do SSH (evita lockout)."
  warn "rode de novo com --ssh-key <arquivo.pub|chave> depois de resolver isso."
else
  if [ "$DRY_RUN" = true ] && [ -z "$PUBKEY" ]; then
    warn "em execução real, sem chave pública o hardening seria RECUSADO (anti-lockout)"
  fi
  write_file /etc/ssh/sshd_config.d/99-nba-scout.conf 0644 <<'EOF'
# Hardening do NBA Scout (provision-vps.sh). Só chave, sem root.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF
  if [ "$DRY_RUN" = true ]; then
    info "[dry-run] validaria com 'sshd -t' e recarregaria o ssh"
  else
    # Valida a config ANTES de recarregar: config inválida derruba o sshd.
    sshd -t || die "config do sshd inválida — reverta /etc/ssh/sshd_config.d/99-nba-scout.conf"
    systemctl reload ssh 2>/dev/null || systemctl restart ssh
    info "sshd recarregado (senha e login de root desabilitados)"
  fi
fi

# ── 5. Firewall + fail2ban + updates automáticos ───────────────────────────
step "5/6 · ufw + fail2ban + unattended-upgrades"
# ORDEM IMPORTA: libera o SSH antes de habilitar o ufw, senão a sessão cai.
run ufw allow "$SSH_PORT/tcp"
run ufw allow 80/tcp
run ufw allow 443/tcp
run ufw default deny incoming
run ufw default allow outgoing
run ufw --force enable
applied "ufw ativo: entrada negada, exceto $SSH_PORT/80/443"

# Imagens Ubuntu da Oracle vêm com regras iptables legadas que REJEITAM tudo
# menos a 22 — elas convivem com o ufw e continuam bloqueando 80/443.
LEGACY_RULES="/etc/iptables/rules.v4"
if [ -f "$LEGACY_RULES" ] && grep -qE 'REJECT|DROP' "$LEGACY_RULES" 2>/dev/null; then
  if [ "$OCI_IPTABLES_FIX" = true ]; then
    run cp "$LEGACY_RULES" "$LEGACY_RULES.bak-nba-scout"
    write_file "$LEGACY_RULES" 0640 <<'EOF'
# Regras legadas removidas pelo provision-vps.sh do NBA Scout; o firewall agora é
# o ufw. Backup do original em rules.v4.bak-nba-scout.
*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
COMMIT
EOF
    run netfilter-persistent reload
    info "regras legadas de iptables neutralizadas (backup salvo)"
  else
    warn "$LEGACY_RULES tem REJECT/DROP (típico de imagem Oracle): 80/443 seguem"
    warn "bloqueados mesmo com ufw liberado. Rode de novo com --oci-iptables-fix"
    warn "para neutralizar (com backup), e libere 80/443 na Security List da VCN."
  fi
fi

write_file /etc/fail2ban/jail.local 0644 <<EOF
# fail2ban do NBA Scout. No Ubuntu 24.04 não existe /var/log/auth.log — os logs
# do sshd vão para o journald, então o backend precisa ser systemd.
[DEFAULT]
backend = systemd
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = $SSH_PORT
EOF
run systemctl enable --now fail2ban
run systemctl restart fail2ban

write_file /etc/apt/apt.conf.d/20auto-upgrades 0644 <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
applied "unattended-upgrades habilitado"

# ── 6. Checkout do repo + .env ─────────────────────────────────────────────
step "6/6 · Checkout em $DEPLOY_PATH + .env"
if [ "$SKIP_REPO" = true ]; then
  info "pulado (--skip-repo)"
else
  if [ -d "$DEPLOY_PATH/.git" ]; then
    info "checkout já existe — não vou mexer no working tree"
  else
    run mkdir -p "$DEPLOY_PATH"
    run chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
    run sudo -u "$DEPLOY_USER" git clone --quiet "$REPO_URL" "$DEPLOY_PATH"
    info "clonado de $REPO_URL"
  fi

  ENV_FILE="$DEPLOY_PATH/.env"
  if [ -f "$ENV_FILE" ]; then
    # NUNCA sobrescrever: o .env tem a senha do Postgres em uso pelo volume pgdata.
    info ".env já existe — preservado intacto"
  elif [ "$DRY_RUN" = true ]; then
    info "[dry-run] criaria $ENV_FILE a partir do .env.example (senha gerada, mode 600)"
  else
    PG_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
    sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PG_PASS|" \
        -e "s|^ENVIRONMENT=.*|ENVIRONMENT=production|" \
        "$DEPLOY_PATH/.env.example" > "$ENV_FILE"
    chmod 0600 "$ENV_FILE"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
    info ".env criado (POSTGRES_PASSWORD gerada, ENVIRONMENT=production, mode 600)"
    warn "falta preencher ODDS_API_KEY em $ENV_FILE antes do primeiro deploy"
  fi
fi

# ── Resumo ─────────────────────────────────────────────────────────────────
step "Concluído"
cat <<EOF
Próximos passos (ver docs/DEPLOY.md § Provisionamento do host):
  1. Preencher ODDS_API_KEY em $DEPLOY_PATH/.env
  2. Validar o host:  sudo bash $DEPLOY_PATH/scripts/verify-host.sh
  3. Testar o login:  ssh -i <chave-privada> $DEPLOY_USER@<ip-do-host>
  4. Cadastrar os secrets do Environment no GitHub (SSH_HOST/SSH_USER/SSH_KEY)
  5. Actions › Deploy › Run workflow com dry_run=true
EOF
[ "$DRY_RUN" = true ] && info "(dry-run: nada acima foi realmente aplicado)"
exit 0
