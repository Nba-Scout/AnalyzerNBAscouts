# Dashboard Motion — Spec detalhado das animações do painel

> Sistema de animações profissionais do painel (`/dashboard`), portado de um
> protótipo (`hero-proto.html`, descartável/não commitado) para o app real.
> Branch de origem: `feature/dashboard-motion`. Todas as animações usam a lib
> **`motion`** (Framer Motion, `motion/react`) já presente — **zero dependência
> nova** — e respeitam `prefers-reduced-motion` (WCAG 2.3.3).

## Princípio

**Movimento a serviço do dado.** Cada animação comunica um estado/sinal do
produto (mudou, para que lado, aposta forte, filtro ativo, feed vivo). Nada de
enfeite sem função — evita a "cara de IA". Cores de sinal (verde/vermelho) só
para EV/hit/P&L; âmbar é chrome/ação.

## Infra

- **Provider:** [`MotionProvider`](../frontend/src/components/motion/MotionProvider.tsx)
  usa `LazyMotion` com **`domMax`** (não `domAnimation`) — necessário para as
  animações de **layout** (`layout`, `layoutId`). Delta de bundle ~5 KB gz.
- **`MotionConfig reducedMotion`**: default `"user"` (respeita o SO). Override de
  **dev**: `VITE_FORCE_MOTION=1` → `"never"`, para revisar o visual num sistema
  com "reduzir movimento" ligado. **Nunca** ligar em produção.
- **Átomo `CountUp`** ([atoms](../frontend/src/components/atoms/index.tsx)) lê a
  mesma flag (usa `useReducedMotion()` que ignora o `MotionConfig`).

## Animações implementadas (11)

Legenda: **T** = técnica · **S** = sinal comunicado · **A11y** = comportamento
com `prefers-reduced-motion`.

### Lote 1 — estrutura (commit `05e039e`)

| # | Animação | Componente | T | S | A11y |
|---|---|---|---|---|---|
| 1 | **FLIP nas linhas** — deslizam pra nova posição ao ordenar/filtrar | `PropsTableTerminal` (`<m.tr layout>`, key estável `player|market|dir|line`) | Motion `layout` (spring) | ordem mudou | estático (sem transform) |
| 2 | **Reveal em cascata** — linhas entram no mount | `PropsTableTerminal` (`<m.tbody>` `staggerChildren`) | variants opacity | conteúdo chegando | fade sem y |
| 3 | **Count-up** — EV%/Hit%/Kelly contam de 0 (mount) e prev→novo (refetch) | `CountUp` | `useMotionValue`+`animate`+`useTransform` | magnitude do número | vai direto ao valor |
| 4 | **Sublinhado deslizante** das abas de variação | `Dashboard` (`<m.span layoutId="dash-tab-ink">`) | Motion `layoutId` | aba ativa | snap instantâneo |
| 5 | **Traço vivo** — gauge e sparkline desenham | `Gauge`, `TrendSparkline` (`<m.path pathLength>`) | pathLength 0→1 | valor/tendência | desenho off |

### Lote 2 — sinais (commit `b52c4fd`)

| # | Animação | Componente | T | S | A11y |
|---|---|---|---|---|---|
| 6 | **Flash direcional** — tint verde↑/vermelho↓ nos números ao mudar | `CountUp` (prop `flash`) | WAAPI `backgroundColor` | mudou e pra que lado | sem flash |
| 7 | **Glow "respirando"** nas linhas STRONG (barra de accent pulsa) | `global.css` `@keyframes strongGlow` na `tr.row-strong td:first-child::before` | CSS box-shadow loop | melhor aposta | `@media reduced` corta |
| 8 | **Seta de line movement fluindo** na direção do movimento | `PropsTableTerminal` (`<m.span>` loop de `y`) | Motion loop | linha subiu/desceu | estático |
| 9 | **Pills de filtro deslizantes** — fill âmbar desliza no grupo | `ui/Pill` (`layoutGroup`) + `FilterBar` (market/game/team) | Motion `layoutId` por grupo | filtro ativo | snap |
| 10 | **Heartbeat** — o live-dot "bate" a cada nova geração de dados | `Dashboard` (`<m.span key={generated_at}>` scale pop) | scale keyframe | feed vivo | sem pop (livePulse CSS segue) |

### Lote 3 — expandir linha (commit `1eececf`)

| # | Animação | Componente | T | S | A11y |
|---|---|---|---|---|---|
| 11 | **Efeito no gráfico ao abrir** — traço desenha + pontos "pipocam" em sequência; painel entra fade+slide, gráfico faz scale-in | `AccordionPanel` (`<m.div>`) + `TrendSparkline` (prop `reveal`) | pathLength + `<m.circle>` scale stagger (spring) | detalhe abrindo / tendência | desenho/pop off |

## Backlog — 3º round (pesquisado, não implementado)

Priorizado por (valor de produto ÷ esforço). Fonte: varredura de GSAP/anime/
motion + padrões de terminais de trading e sportsbooks (jul/2026).

| Ideia | Sinal | Viabilidade | Esforço |
|---|---|---|---|
| **Odômetro de dígitos** (rolagem vertical por dígito; motion tem `AnimateNumber`) | magnitude/direção — upgrade do count-up | Alta (só motion) | M |
| **Estado de odd suspensa/travada** (dessatura + cadeado + pulse) | mercado indisponível — padrão crítico de sportsbook | Alta | P |
| **Fly-to-betslip** — a prop "voa" pra carteira ao adicionar | ação confirmada (feedback espacial) | Média | M |
| **Barra de magnitude in-cell** (largura ∝ EV/Kelly) | "quão forte" — densidade de terminal | Alta | P |
| **Bet-add: + → ✓ desenhando** + toast com spring | pending→confirmado | Alta | M |
| **Skeleton→conteúdo crossfade** no refetch | percepção de velocidade | Alta | P |
| **Data-freshness / stale decay** (opacidade cai conforme envelhece) | recência do dado | Média | P/M |
| **Jitter de volatilidade** na sparkline (amplitude ∝ taxa de mudança) | turbulência do mercado (canal pré-atentivo) | Média (cuidar perf) | M |
| **Backdrop WebGL "market-heat"** (shader discreto, tom ∝ EV médio do slate) | clima geral do dia | Baixa em CSS — **precisa three.js (dep nova)** | G |

## Notas transversais (a11y / performance)

- Verde/vermelho **nunca** é o único canal — sempre com ícone/posição/label.
- Feeds em tempo real: throttle nos flashes; preferir `transform`/opacity
  (não layout) com muitas linhas; pausar quando a aba está oculta.
- Jitter e WebGL são os únicos itens com risco de custo (cap de FPS).

## Como revisar localmente

```bash
# backend real na 8000 OU um mock servindo /api/props
cd frontend
VITE_FORCE_MOTION=1 npx vite      # flag liga o motion mesmo com reduced-motion do SO
# abrir http://localhost:5173/#/dashboard
```
