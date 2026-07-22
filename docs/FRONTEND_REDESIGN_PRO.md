# NBA Scout — Redesign de Frontend "Terminal Pro" + Design System

> Plano vivo do redesign completo do frontend. Executado em **etapas**, cada etapa = **1 PR + 1 issue** documentando o que foi feito. **Sem merge automático** (PRs ficam abertos para revisão).

## Objetivo

Sair da "cara de IA" (≈90% inline styles, ~25 cores soltas, sem escala) para um frontend **profissional, denso e fluido**, padronizado num **design system**. Direção: **Terminal Pro** (Bloomberg/quant) — denso, monospace-forward, alto contraste, sério.

## Decisões de design (fechadas com o usuário)

| Decisão | Escolha |
|---|---|
| Direção visual | **Terminal Pro** (quant/Bloomberg) |
| Base de estilo | **Tailwind CSS v4 + tokens** (`@theme`, CSS-first, sem `tailwind.config.js`) |
| Tema | **Dark + Light** com toggle (default = dark) |
| Marca | Mantém "NBA Scout"; **accent Âmbar/Ouro `#f59e0b`**. Verde/vermelho **reservados** para sinal de EV/hit |
| Animação | **Framer Motion** (pacote `motion`, import `motion/react`) |
| Referência de componentes | **21st.dev** (como referência, ver abaixo) |

## Stack — novas dependências

- **`tailwindcss@^4` + `@tailwindcss/vite`** — base de estilo tokenizada (mata o inline-style).
- **`motion`** (Framer Motion v12) — animações. `LazyMotion`+`domAnimation`+`strict` (usar `m.*`) para bundle mínimo (~4.6 KB vs ~34 KB); `MotionConfig reducedMotion="user"` na raiz.
- **`cmdk`** (Etapa 3, opcional) — command palette ⌘K headless, estilizado pelos tokens.
- Lógica de negócio (hooks, lib, contrato `types/api.ts`) **não muda** — é só camada de apresentação.

## 21st.dev — decisão

A pesquisa (com agentes) concluiu: o **Magic MCP (`@21st-dev/magic`)** exige API key e gera código **shadcn/Radix** com variáveis de tema próprias que **conflitam** com Tailwind v4 + nossos tokens + a estética Terminal-Pro. Portanto:
- **Não** adicionar o registry como dependência nem habilitar o Magic MCP agora.
- Usar 21st.dev como **banco de referência** de padrões (data tables densas, stat cards, command palette, badges, tabs, tooltips, number tickers, skeletons, empty states) e **emular manualmente** com Tailwind v4 + Framer Motion.
- _Para habilitar o Magic MCP depois (opcional):_ criar key em `21st.dev/magic/console` e `claude mcp add magic -e API_KEY=<key> -- npx -y @21st-dev/magic@latest`. Tratar output como rascunho.

## Sistema de tokens (Tailwind v4)

Em [global.css](../frontend/src/styles/global.css): `@import "tailwindcss"` + `@custom-variant dark` + tokens semânticos que **trocam por tema** (`:root` = dark default, `.light` sobrescreve), expostos ao Tailwind via `@theme inline`:
- **Cor**: paleta crua (neutros, amber, green, red, yellow) → semânticos: `bg`, `surface`, `raised`, `border`, `border-strong`, `text`, `text-muted`, `accent`(âmbar), `ev-strong/pos/neutral/neg`, `hit-hi/mid/lo`.
- **Tipografia**: 2 famílias (`font-mono` JetBrains Mono p/ dados; `font-sans` Inter Tight p/ labels) + escala formal. Números/tabelas sempre `tabular-nums`.
- **Espaçamento** 4px, **raio** (sm/md/lg/xl/full), **sombra** (sm/md/lg + glow âmbar), **motion** (ease + durações) sob `prefers-reduced-motion`.
- `evColor`/`hitColor`/`ratingTokens` passam a **retornar classes de token** (fonte única).

## Motion — estratégia (Framer Motion)

Raiz: `<LazyMotion features={domAnimation} strict>` + `<MotionConfig reducedMotion="user">`. Receitas (do agente de pesquisa):
- **Stagger** de linhas/cards (`variants` + `staggerChildren` + `whileInView once`).
- **Layout** ao filtrar/ordenar/trocar variação (`layout` + `AnimatePresence mode="popLayout"`, key estável = id da prop).
- **NumberTicker** (`AnimatedNumber`: `useSpring`+`useTransform`) em EV%/odds/médias + **flash de tick** (verde/vermelho) na mudança.
- **Transição de rota** Dashboard↔Player (`AnimatePresence mode="wait"` por `location.pathname`; bônus `layoutId` hero compartilhado).
- **Abas/variação**: crossfade + underline com `layoutId`.
- **Micro-interações**: `whileHover`/`whileTap`, estrela com spring, accordion `height:auto`.
- Tudo só `transform`/`opacity`; `layout` com cautela em listas (≤27 linhas OK).

## Etapas (cada uma = branch + PR + issue, sem merge)

| Etapa | Branch | Entrega |
|---|---|---|
| **1 — Fundação** | `feat/redesign-foundation` | Tailwind v4 + `@theme` tokens (dark+light); `useTheme` + toggle; `motion` + `MotionProvider` (LazyMotion+MotionConfig); `AnimatedNumber`; `prefers-reduced-motion`. App segue funcionando (inline coexiste). |
| **2 — Design system** | `feat/redesign-primitives` | `src/components/ui/*` tokenizados (Button, Badge/RatingBadge, Card, Stat, Tabs, Tooltip, Pill, Panel, Skeleton, EmptyState, Table helpers); converter `colors`/`ratingTokens` p/ tokens; rota `/styleguide`. |
| **3 — Dashboard** | `feat/redesign-dashboard` | Reescrita das 3 variações + FilterBar + SummaryStrip + AccordionPanel + RefreshCountdown sobre primitivos + motion (stagger, layout, NumberTicker, tick-flash, toggle de densidade, ⌘K opcional). Zero inline style. |
| **4 — Player + shell + tweaks** | `feat/redesign-player-shell` | Reescrita da página Player + App/Layout com transições de rota + painel de tweaks **dark glass** tokenizado. |
| **5 — Polish/qualidade** | `feat/redesign-polish` | `:focus-visible` âmbar, ARIA, navegação por teclado; auditoria de contraste AA nos 2 temas; breakpoints formais; limpeza do `global.css`; checagem de bundle. |
| **6 — Landing / Home** | `feat/redesign-landing` | Página inicial de marketing (`/`) antes do painel: hero "Aposte com matemática, não com palpite", grade de 6 recursos, banda de CTA e footer. Dashboard passa para `/dashboard`. Fora do `Layout` (sem painel de tweaks). Tokens + motion. |

## Etapa 6 — Landing / Home page (spec detalhado)

> Origem: mockup do usuário no Claude Design/Gamma (bundle em `.design_extract/NBA Scout (Standalone)`). Objetivo: uma **porta de entrada de marketing** antes do painel — hoje o `/` cai direto no Dashboard. Marketing-page limpa, dark-first, **sem** o FAB de tweaks (fica fora do `Layout`). Reutiliza os mesmos tokens e o `motion` já montados.

### Roteamento

- `/` (index) → **`Landing`** (rota de topo, irmã de `styleguide`, **fora** do `<Layout>` → sem painel de tweaks).
- `/dashboard` → `Dashboard` (era o index; continua dentro do `Layout`).
- CTAs "Abrir o painel" / "Entrar no painel" → `navigate("/dashboard")`.
- "Como funciona" → âncora suave para a seção **Recursos**.
- `Player`/`Bets` → botão voltar passa a apontar para `/dashboard` (não mais `/`, que agora é a landing).

### Seções (na ordem)

1. **Nav** — logo (badge "NS" + "NBA Scout") à esquerda; à direita `ThemeToggle` + botão "Entrar no painel →".
2. **Hero** — pill mono "● Odds ao vivo — playoffs 2026"; `h1` em duas linhas ("Aposte com matemática," / "não com palpite." em `text-fg-muted`); parágrafo-lead com trechos enfatizados (stats reais, odds ao vivo, defesa do adversário); CTAs primário ("⊞ Abrir o painel") + secundário ("Como funciona"); card visual (painel "court" via gradiente CSS + grid sutil + chips "4 jogos monitorados hoje" / "● 6 strong bets ativas").
3. **Recursos** (`id="recursos"`) — label "RECURSOS", `h2` "Tudo que você precisa para achar valor", sub, grade de **6 cards** (ícone + título + descrição): EV% em tempo real, Odds ao vivo, Kelly fracionado, Rating por prop, Histórico de playoffs, Cache inteligente. Cópias exatas do mockup.
4. **CTA band** — imagem de fundo com overlay, `h2` "Pronto para achar sua próxima entrada?", sub, CTA "⊞ Abrir o painel".
5. **Footer** — logo + tagline + "© 2026 NBA Scout · EV Analyzer".

### Design

- Dark-first (usa `bg-canvas`/`surface`/`border`/`text-fg`/`fg-muted`); funciona também no tema claro. Sinal verde só nos "live dots".
- Badge do logo em **gradiente índigo→violeta** (marca da landing, fiel ao mockup) — o âmbar do app permanece dentro do painel.
- Motion: `whileInView` fade-up nas seções + `staggerChildren` nos cards; respeita `prefers-reduced-motion` (via `MotionConfig` global).
- Sem novas dependências. **Nenhuma foto de terceiros embutida** — o visual do hero/CTA é gradiente CSS + grid (evita direitos de imagem e mantém o bundle self-contained).

## Verificação (por etapa)

- `tsc -b`, `eslint`, `prettier --check`, `vitest run`, `vite build` (vigiar bundle).
- Visual ao vivo: `npm run dev` (:5173) + mock [scripts/mock_api.py](../scripts/mock_api.py) (:8000) — testar **toggle dark/light**, as 3 variações, página de jogador, e a fluidez (stagger/number-ticker/transições).
- a11y: navegação por teclado com foco visível; `prefers-reduced-motion` desliga motion; contraste AA nos 2 temas.
- Sem regressão de comportamento (filtros, favoritos, CSV, navegação, tweaks).

## Backlog futuro (não nesta sequência)
- **TanStack Table** headless para a variação terminal (se a tabela crescer).
- **Command palette ⌘K** completo (cmdk) — busca de jogador/prop/filtro.
- **Magic MCP** habilitável (passos acima) para acelerar geração de variações.
