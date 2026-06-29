# Segurança do repositório

Este documento descreve as proteções de segurança do repo `Nba-Scout/AnalyzerNBAscouts`
e a **branch protection desejada** (que precisa ser configurada na UI do GitHub —
não há como versioná-la em arquivo).

## Ferramentas automatizadas (já no repo)

| Ferramenta | Arquivo | O que faz | Falha quando |
|---|---|---|---|
| **Dependabot** | [`.github/dependabot.yml`](../.github/dependabot.yml) | PRs semanais de atualização de deps (`pip`, `npm`, `docker`, `github-actions`). Minor/patch agrupados; majors isolados. | — (abre PR) |
| **CodeQL** | [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml) | SAST de `python` e `javascript-typescript`; query suite `security-and-quality`. Push/PR em `main`/`develop` + semanal. | Alertas aparecem no **Security › Code scanning** |
| **Gitleaks** | [`.github/workflows/security-scan.yml`](../.github/workflows/security-scan.yml) | Varre **todo o histórico** de commits por segredos vazados. | Qualquer segredo detectado (`--exit-code=1`) |
| **Trivy** | [`.github/workflows/security-scan.yml`](../.github/workflows/security-scan.yml) | Scan de vulnerabilidades + misconfig no filesystem; SARIF no Security tab. | Vuln **HIGH/CRITICAL** com fix disponível |
| **CODEOWNERS** | [`.github/CODEOWNERS`](../.github/CODEOWNERS) | Exige review do owner nas áreas do código. | — (exige review se branch protection ativa) |

`.gitignore` cobre `.env` e demais segredos locais (confirmado).

## Branch protection desejada (configurar na UI)

**GitHub › Settings › Branches › Add branch ruleset** (ou Branch protection rules) para
`main` **e** `develop`:

### Regras comuns (`main` e `develop`)
- ☑️ **Require a pull request before merging** — sem push direto.
  - ☑️ Require approvals: **1** (mínimo).
  - ☑️ Require review from Code Owners.
  - ☑️ Dismiss stale pull request approvals when new commits are pushed.
- ☑️ **Require status checks to pass before merging**
  - ☑️ Require branches to be up to date before merging.
  - **Checks obrigatórios:** `CI OK` (job `ci-success`), `Analyze (python)`,
    `Analyze (javascript-typescript)`, `Gitleaks (secrets)`, `Trivy (fs)`.
- ☑️ **Require conversation resolution before merging.**
- ☑️ **Block force pushes.**
- ☑️ **Do not allow deletions.**

### Específico de `main`
- ☑️ Exigir que o PR venha de `develop` (fluxo: feature → `develop` → `main`).
- ☑️ (Opcional) Require signed commits.

> ⚠️ Os nomes dos checks só aparecem na lista de "required status checks" **depois**
> que cada workflow rodou ao menos uma vez no repo. Abra um PR com estes workflows,
> deixe rodar, e então marque-os como obrigatórios.

## Secrets e Environments

Os secrets de deploy (SSH, Postgres, etc.) ficam em **Settings › Environments**
(`staging`/`production`) — ver [`DEPLOY.md`](./DEPLOY.md). Nunca commitar segredos;
o gitleaks falha o CI se isso acontecer.
