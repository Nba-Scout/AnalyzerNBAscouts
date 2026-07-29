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
#   --ssh-port <n>       porta usada nas regras de ufw/fail2ban (default: 22).
#                        NÃO troca a porta do sshd — no Ubuntu 24.04 o ssh é
#                        socket-activated e a porta vive no ssh.socket, não aqui.
#   --branch <ref>       branch a clonar em DEPLOY_PATH (default: branch default do
#                        repo). Use --branch develop enquanto os scripts não
#                        estiverem na main.
#   --skip-repo          não clonar o repo nem criar .env
#   --no-harden-ssh      não mexer na config do sshd
#   --force-harden-ssh   endurece o SSH mesmo que quem chamou não tenha chave própria
#                        (só use se tiver CERTEZA de que entra por chave)
#   --oci-iptables-fix   neutraliza as regras legadas de iptables da imagem da Oracle
#                        que bloqueiam 80/443 (ver docs/DEPLOY.md; opt-in de propósito)
#   --dry-run            só imprime o que faria
#
# Segurança — duas travas anti-lockout antes de desligar a senha do SSH:
#   1. exige chave pública instalada para o usuário de deploy (e valida com
#      ssh-keygen que é mesmo uma chave PÚBLICA, não uma privada por engano);
#   2. exige que QUEM ESTÁ RODANDO também tenha chave própria — ter chave só para o
#      usuário de deploy não garante que você continua entrando. Contorne com
#      --force-harden-ssh.
# Depois de recarregar, confere o resultado com `sshd -T` em vez de assumir sucesso.
#
# Nota: as funções internas leem conteúdo do stdin (heredoc), então NÃO execute este
# script por pipe (`curl … | sudo bash`) — baixe e rode como arquivo.

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
FORCE_HARDEN=false
OCI_IPTABLES_FIX=false
DRY_RUN=false
REPO_BRANCH=""

while [ $# -gt 0 ]; do
  case "$1" in
    --user)       DEPLOY_USER="${2:?--user exige valor}"; shift 2 ;;
    --path)       DEPLOY_PATH="${2:?--path exige valor}"; shift 2 ;;
    --repo)       REPO_URL="${2:?--repo exige valor}"; shift 2 ;;
    --ssh-key)    SSH_KEY_INPUT="${2:?--ssh-key exige valor}"; shift 2 ;;
    --ssh-port)   SSH_PORT="${2:?--ssh-port exige valor}"; shift 2 ;;
    --branch)     REPO_BRANCH="${2:?--branch exige valor}"; shift 2 ;;
    --skip-repo)  SKIP_REPO=true; shift ;;
    --no-harden-ssh) HARDEN_SSH=false; shift ;;
    --force-harden-ssh) FORCE_HARDEN=true; shift ;;
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
# openssl: gera a POSTGRES_PASSWORD do .env no passo 6.
# python3-systemd: o fail2ban usa `backend = systemd` (no 24.04 não há auth.log) e
# sem esse pacote a jail sshd não inicializa. No noble ele é só "Recommends".
run apt-get install -y -qq \
  ca-certificates curl gnupg git openssl ufw fail2ban python3-systemd unattended-upgrades
applied "pacotes base OK (docker vem do repo oficial no passo seguinte)"

# ── 2. Docker (repo oficial) ───────────────────────────────────────────────
step "2/6 · Docker + Compose plugin"
# Checa o compose plugin também: um host com o docker.io do Ubuntu tem `docker` mas
# NÃO tem `docker compose` (v2), e o deploy.yml depende dele.
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  info "docker + compose v2 já instalados: $(docker --version 2>/dev/null || echo '?')"
else
  if command -v docker >/dev/null 2>&1; then
    warn "docker presente mas sem 'docker compose' v2 — instalando do repo oficial"
  fi
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

# Grupo primário real: com --user apontando p/ conta existente, o grupo pode não
# ter o mesmo nome do usuário (users, adm...) e um chown "user:user" abortaria.
DEPLOY_GROUP="$(id -gn "$DEPLOY_USER" 2>/dev/null || echo "$DEPLOY_USER")"

# Valida que o conteúdo é REALMENTE uma chave pública. Sem isto, um
# `--ssh-key ~/.ssh/id_ed25519` (sem o .pub — erro clássico) instalaria a chave
# PRIVADA no authorized_keys: o arquivo fica não-vazio, a trava anti-lockout passa
# e ninguém consegue mais entrar.
assert_pubkey() {
  local content="$1" src="$2" tmp rc=0

  # Barra chave privada pelo CONTEÚDO. Não dá para confiar só no `ssh-keygen -l -f`:
  # ele ACEITA um arquivo de chave privada (deriva a pública dela) e sairia com 0,
  # deixando passar justamente o erro mais comum (`--ssh-key ~/.ssh/id_ed25519`,
  # sem o .pub) — que gravaria a privada no authorized_keys e trancaria todo mundo.
  if printf '%s' "$content" | grep -q 'PRIVATE KEY'; then
    die "$src é uma chave PRIVADA — use o arquivo .pub correspondente"
  fi

  # Toda linha não-vazia precisa começar com um tipo de chave conhecido.
  if printf '%s\n' "$content" | grep -qvE '^[[:space:]]*($|#|(ssh-(rsa|ed25519|dss)|ecdsa-sha2-|sk-ssh-|sk-ecdsa-))'; then
    die "$src tem linha que não parece chave pública SSH"
  fi

  # Sem ssh-keygen não há como validar o resto. Não trate como "chave inválida" —
  # seria rejeitar chave boa num host sem openssh-client e travar o provisionamento.
  if ! command -v ssh-keygen >/dev/null 2>&1; then
    warn "ssh-keygen ausente: validação de '$src' limitada ao formato das linhas"
    return 0
  fi
  tmp="$(mktemp)"
  printf '%s\n' "$content" > "$tmp"
  ssh-keygen -l -f "$tmp" >/dev/null 2>&1 || rc=$?
  rm -f "$tmp"
  [ "$rc" -eq 0 ] || die "$src não contém chave pública SSH válida"
}

AUTH_KEYS="/home/$DEPLOY_USER/.ssh/authorized_keys"
PUBKEY=""
if [ -n "$SSH_KEY_INPUT" ]; then
  if [ -f "$SSH_KEY_INPUT" ]; then
    # tr -d '\r': .pub gerado/copiado no Windows entra com CRLF e o sshd ignora a linha.
    PUBKEY="$(tr -d '\r' < "$SSH_KEY_INPUT")"
    assert_pubkey "$PUBKEY" "$SSH_KEY_INPUT"
    info "chave lida de $SSH_KEY_INPUT"
  elif printf '%s' "$SSH_KEY_INPUT" | grep -qE '^(ssh-|ecdsa-)'; then
    PUBKEY="$(printf '%s' "$SSH_KEY_INPUT" | tr -d '\r')"
    assert_pubkey "$PUBKEY" "--ssh-key"
    info "chave recebida como literal"
  else
    die "--ssh-key não é um arquivo existente nem uma chave pública válida"
  fi
else
  # Sem --ssh-key: reaproveita a chave de quem chamou o sudo (na Oracle, `ubuntu`).
  CALLER="${SUDO_USER:-}"
  CALLER_KEYS="/home/${CALLER}/.ssh/authorized_keys"
  if [ -n "$CALLER" ] && [ -s "$CALLER_KEYS" ]; then
    PUBKEY="$(tr -d '\r' < "$CALLER_KEYS")"
    info "reaproveitando authorized_keys de '$CALLER' (nenhum --ssh-key informado)"
  else
    warn "nenhuma chave informada e não achei authorized_keys de '${CALLER:-?}'"
  fi
fi

if [ -n "$PUBKEY" ]; then
  if [ "$DRY_RUN" = true ]; then
    info "[dry-run] instalaria $(printf '%s\n' "$PUBKEY" | grep -cE '^(ssh-|ecdsa-|sk-)') chave(s) em $AUTH_KEYS"
  else
    install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "/home/$DEPLOY_USER/.ssh"
    # Idempotente: só acrescenta chave que ainda não está no arquivo.
    touch "$AUTH_KEYS"
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      grep -qxF "$line" "$AUTH_KEYS" || printf '%s\n' "$line" >> "$AUTH_KEYS"
    done <<< "$PUBKEY"
    chmod 0600 "$AUTH_KEYS"
    chown "$DEPLOY_USER:$DEPLOY_GROUP" "$AUTH_KEYS"
    info "$(grep -cE '^(ssh-|ecdsa-|sk-)' "$AUTH_KEYS") chave(s) autorizada(s) em $AUTH_KEYS"
  fi
fi

# ── 4. Hardening do sshd ───────────────────────────────────────────────────
step "4/6 · Hardening do SSH"
# As duas travas avaliam o MESMO estado em dry-run e em execução real, para que o
# ensaio diga de antemão se o hardening vai acontecer ou ser pulado.
#
# Chave efetiva após o passo 3 = a que acabamos de instalar (PUBKEY) OU uma que já
# estava no authorized_keys. Não basta olhar o arquivo: em dry-run ele nem existe.
HAS_KEY=false
if [ -n "$PUBKEY" ] || [ -s "$AUTH_KEYS" ]; then
  HAS_KEY=true
fi

# 2ª trava: ter chave para o usuário `deploy` NÃO garante que VOCÊ continua entrando.
# Se a sua sessão autentica por senha e a única chave instalada é a do CD (que vive
# no secret do GitHub), desligar a senha te tranca fora — e a 1ª trava passaria
# felizmente, porque o arquivo está não-vazio.
CALLER_NOW="${SUDO_USER:-}"
CALLER_HAS_KEY=false
if [ -n "$CALLER_NOW" ] && [ -s "/home/${CALLER_NOW}/.ssh/authorized_keys" ]; then
  CALLER_HAS_KEY=true
fi

if [ "$HARDEN_SSH" != true ]; then
  info "pulado (--no-harden-ssh)"
elif [ "$HAS_KEY" != true ]; then
  warn "nenhuma chave pública para '$DEPLOY_USER' — NÃO vou desabilitar a senha do"
  warn "SSH (isso trancaria você fora). Rode de novo com --ssh-key <arquivo.pub>."
  HARDEN_SSH=skipped
elif [ "$CALLER_HAS_KEY" != true ] && [ "$FORCE_HARDEN" != true ]; then
  warn "quem chamou ('${CALLER_NOW:-root}') não tem authorized_keys próprio."
  warn "Desligar a senha do SSH pode te trancar fora do host. Confirme que você"
  warn "entra por chave e rode de novo com --force-harden-ssh (ou --no-harden-ssh"
  warn "e endureça depois). Hardening PULADO."
  HARDEN_SSH=skipped
fi

if [ "$HARDEN_SSH" = true ]; then
  # Prefixo 00-: no sshd_config o PRIMEIRO valor obtido vence, e o Include processa
  # /etc/ssh/sshd_config.d/*.conf em ordem lexicográfica. Com 99- um
  # 50-cloud-init.conf (comum em imagem de nuvem) com "PasswordAuthentication yes"
  # ganharia da nossa config e o hardening seria um no-op silencioso.
  SSHD_DROPIN=/etc/ssh/sshd_config.d/00-nba-scout.conf
  write_file "$SSHD_DROPIN" 0644 <<'EOF'
# Hardening do NBA Scout (provision-vps.sh). Só chave, sem root.
# Prefixo 00 de propósito: no sshd_config o primeiro valor lido vence.
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF
  if [ "$DRY_RUN" = true ]; then
    info "[dry-run] validaria com 'sshd -t', conferiria 'sshd -T' e recarregaria o ssh"
  else
    # Config inválida derruba o sshd — se não passar, REMOVE o drop-in em vez de
    # deixar o host num estado que quebra conexões novas (em modo socket-activated
    # cada conexão nova já lê a config nova).
    if ! sshd -t 2>/dev/null; then
      rm -f "$SSHD_DROPIN"
      die "config do sshd ficou inválida; drop-in removido — host preservado"
    fi

    # No Ubuntu 24.04 o ssh é socket-activated: ssh.service costuma estar inativo e
    # `systemctl reload ssh` falharia. Pior, o restart pararia o ssh.socket e o
    # daemon voltaria a escutar a porta do sshd_config — se a porta tivesse sido
    # trocada no socket, ninguém mais entra.
    if systemctl is-active --quiet ssh.socket; then
      info "ssh socket-activated: cada conexão nova já lê a config (nada a recarregar)"
    else
      systemctl reload ssh 2>/dev/null \
        || systemctl restart ssh \
        || warn "não consegui recarregar o ssh — confira 'systemctl status ssh'"
    fi

    # Asserção real: só afirma o que o sshd EFETIVAMENTE aplicou.
    if sshd -T 2>/dev/null | grep -qi '^passwordauthentication no'; then
      info "confirmado via 'sshd -T': senha desabilitada"
    else
      warn "'sshd -T' NÃO confirma 'passwordauthentication no' — outro drop-in ou"
      warn "config global está vencendo. Investigue antes de confiar no hardening."
    fi
  fi
elif [ "$HARDEN_SSH" = skipped ]; then
  : # aviso já emitido acima
fi

# ── 5. Firewall + fail2ban + updates automáticos ───────────────────────────
step "5/6 · ufw + fail2ban + unattended-upgrades"

# Imagens Ubuntu da Oracle vêm com regras iptables legadas persistidas em
# /etc/iptables/rules.v4 que REJEITAM tudo menos a 22 — elas continuam valendo
# junto do ufw e mantêm 80/443 bloqueados.
#
# ORDEM IMPORTA: isto roda ANTES do `ufw --force enable`. A versão anterior deste
# script rodava depois e escrevia um rules.v4 "vazio" + netfilter-persistent reload;
# o plugin faz `iptables-restore` SEM --noflush, o que esvazia a tabela filter
# inteira e leva embora as chains ufw-* (e as DOCKER-*) que acabaram de subir —
# deixando o host SEM firewall, com `ufw status` ainda dizendo "active" (o ufw lê o
# estado em /etc/ufw, não no kernel).
LEGACY_RULES="/etc/iptables/rules.v4"
if [ -f "$LEGACY_RULES" ] && grep -qE 'REJECT|DROP' "$LEGACY_RULES" 2>/dev/null; then
  if [ "$OCI_IPTABLES_FIX" = true ]; then
    run cp "$LEGACY_RULES" "$LEGACY_RULES.bak-nba-scout"
    # Tira o arquivo do caminho e desliga o serviço que o reaplica no boot, em vez
    # de reescrevê-lo: nada de iptables-restore, nada de flush de chain alheia.
    run mv "$LEGACY_RULES" "$LEGACY_RULES.disabled-by-nba-scout"
    if command -v netfilter-persistent >/dev/null 2>&1; then
      run netfilter-persistent flush || warn "netfilter-persistent flush falhou (segue)"
      run systemctl disable --now netfilter-persistent \
        || warn "não consegui desabilitar o netfilter-persistent (confira no boot)"
    else
      warn "netfilter-persistent não instalado; regras em memória podem persistir até reboot"
    fi
    applied "regras legadas neutralizadas: arquivo movido p/ .disabled-by-nba-scout + backup"
  else
    warn "$LEGACY_RULES tem REJECT/DROP (típico de imagem Oracle): 80/443 seguem"
    warn "bloqueados mesmo com ufw liberado. Rode de novo com --oci-iptables-fix"
    warn "para neutralizar (com backup), e libere 80/443 na Security List da VCN."
  fi
fi

# ORDEM IMPORTA (2): libera o SSH antes de habilitar o ufw, senão a sessão cai.
run ufw allow "$SSH_PORT/tcp"
run ufw allow 80/tcp
run ufw allow 443/tcp
run ufw default deny incoming
run ufw default allow outgoing
run ufw --force enable
applied "ufw ativo: entrada negada, exceto $SSH_PORT/80/443"
# Honestidade sobre o alcance do ufw: portas publicadas pelo Docker (o compose
# publica 8080 e 8000 em 0.0.0.0) entram por DNAT/FORWARD e NÃO passam pela chain
# INPUT — ou seja, o "deny incoming" não as fecha.
applied "ATENÇÃO: 8080/8000 publicados pelo Docker driblam o ufw (DNAT, não passa por INPUT)"

# jail.d/ em vez de jail.local: sobrescrever jail.local apagaria configuração do
# operador (um `ignoreip` com o IP do escritório, por exemplo) a cada execução.
write_file /etc/fail2ban/jail.d/nba-scout.local 0644 <<EOF
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
# || warn: fail2ban que não sobe não deve abortar o provisionamento e deixar o host
# sem checkout nem .env (set -e mataria o script aqui).
run systemctl enable --now fail2ban || warn "fail2ban não subiu — veja 'systemctl status fail2ban'"
run systemctl restart fail2ban || warn "restart do fail2ban falhou (jail pode estar inativa)"

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
    run chown "$DEPLOY_USER:$DEPLOY_GROUP" "$DEPLOY_PATH"
    if [ -n "$REPO_BRANCH" ]; then
      run sudo -u "$DEPLOY_USER" git clone --quiet --branch "$REPO_BRANCH" "$REPO_URL" "$DEPLOY_PATH"
      info "clonado de $REPO_URL (branch $REPO_BRANCH)"
    else
      run sudo -u "$DEPLOY_USER" git clone --quiet "$REPO_URL" "$DEPLOY_PATH"
      info "clonado de $REPO_URL (branch default)"
    fi
  fi

  ENV_FILE="$DEPLOY_PATH/.env"
  if [ -f "$ENV_FILE" ]; then
    # NUNCA sobrescrever: o .env tem a senha do Postgres em uso pelo volume pgdata.
    info ".env já existe — preservado intacto"
  elif [ "$DRY_RUN" = true ]; then
    info "[dry-run] criaria $ENV_FILE a partir do .env.example (senha gerada, mode 600)"
  elif [ ! -f "$DEPLOY_PATH/.env.example" ]; then
    # Sem esta guarda, o `>` do sed criaria um .env VAZIO antes de falhar — e a
    # re-execução veria ".env já existe" e nunca o regeneraria.
    warn ".env.example não encontrado em $DEPLOY_PATH — .env NÃO criado"
  else
    PG_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
    # Cria já com 0600: com `>` puro o arquivo nasce 0644 (umask 022) contendo a
    # senha, e só depois viria o chmod — janela curta, mas evitável.
    install -m 0600 -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" /dev/null "$ENV_FILE"
    sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PG_PASS|" \
        -e "s|^ENVIRONMENT=.*|ENVIRONMENT=production|" \
        "$DEPLOY_PATH/.env.example" > "$ENV_FILE"
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
