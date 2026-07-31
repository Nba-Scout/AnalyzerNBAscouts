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

## Animações implementadas (17)

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

### Lote 4 — foco, frescor & profundidade (2º round de pesquisa)

| # | Animação | Componente | T | S | A11y |
|---|---|---|---|---|---|
| 12 | **Spotlight de linha** — a linha sob o cursor fica nítida, as demais recuam ~40% de opacidade | `global.css` `.props-table tbody:hover tr:not(:hover)` | CSS opacity | foco de leitura | `@media reduced` → opacity 1 |
| 13 | **Specular sweep** — brilho âmbar varre a tabela quando os dados revalidam | `PropsTableTerminal` (`<m.div>` overlay, key = contador de revalidação) | translateX + opacity | "atualizou agora" | sem sweep |
| 14 | **Z-depth sticky** — o header ganha sombra de elevação quando há linhas roladas por baixo | `PropsTableTerminal` (`onScroll` → `shadow` no `<thead>` sticky) | box-shadow + transition | "tem mais fora da tela" | sombra sem transição |
| 15 | **Afterimage delta** — "fantasma" da odd antiga desliza (↑/↓) e some ao mudar | `FlashCell` (prop `afterimage`) na coluna Odd | `<m.span>` y + opacity | magnitude/direção da mudança | sem fantasma |
| 16 | **Outlier RGB-split** — aberração cromática one-shot no EV quando ≥ 12% (outlier) | `CountUp` (prop `outlier`) + `global.css` `rgbSplit` | text-shadow keyframe | "outlier de alto valor" | sem split |
| 17 | **Sparkline live playhead** — halo "radar" pulsa no ponto mais recente | `TrendSparkline` (`<m.circle>` loop) | scale + opacity loop | "série ao vivo" | halo estático |

### Lote 5 — Carteira & Backtest

O padrão (count-up + curva desenhando + reveal em cascata) foi estendido pras
outras telas do produto:

| Tela | Animações | Componentes |
|---|---|---|
| **Backtest** (`/backtest`) | tiles (Props/Hit/P&L/ROI/Odd/Voids) com **count-up** + recontagem ao trocar rating/janela; **curva acumulada desenha** (pathLength, área fade, pontos após o traço); linhas "Por dia" entram em **cascata** | `Backtest.tsx` (`CountUp`, `m.path`, `m.tbody`/`m.tr`) |
| **Carteira** (`/bets`) | KPIs (Banca/P&L/ROI/Acerto/Em aberto) com **count-up** + recontagem ao liquidar/adicionar; **curva de bankroll desenha**; linhas de aposta em **cascata** + `layout` (deslizam ao liquidar) | `WalletSummary.tsx`, `BetsTable.tsx` |

## Backlog — pesquisado, não implementado

Consolidado de 2 rounds de pesquisa (GSAP/anime/motion + terminais de trading/
sportsbooks + GSAP-Scroll/Locomotive/Kenta Toshikura + three.js/anime/Oryzo).
Priorizado por (valor de produto ÷ esforço).

### 1º round

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

### 2º round (foco no painel)

> ✅ Já implementados no Lote 4: Z-depth sticky (#14), Afterimage delta (#15),
> Outlier RGB-split (#16), Sparkline live playhead (#17). Restam abaixo.

| Ideia | Sinal / valor | Viabilidade | Esforço |
|---|---|---|---|
| **Header colapsável por scroll** — KPIs condensam numa faixa fina | densidade sob demanda | Média (useScroll + histerese) | M |
| **Decode-on-tick** — scramble curto de dígitos ao chegar valor novo | "dado sendo decodificado" | Média (anime v4 ou ~30 linhas JS) | P/M |
| **Cursor contextual HUD** — crosshair na odd, "+EV" na célula EV, lupa no gráfico | tom de terminal pro | Média (useSpring no pointer) | M |
| **Morph entre variações** Terminal↔Cards↔Editorial (cada prop mantém posição) | continuidade de identidade | Média/Baixa — **GSAP Flip vale a dep** | G |
| **Teia de correlação de parlay** (MotionPath entre pernas selecionadas) | risco de correlação (quant) | Média — SVG+motion ou anime | M/G |
| **Confidence field GPU** — densidade de partículas ∝ tamanho de amostra | confiança do dado | Baixa — **precisa three.js**; fallback canvas 2D | G |

> Descartado: **scroll-skew/blur** nas linhas — ambos os rounds marcaram como risco à legibilidade dos números.

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
