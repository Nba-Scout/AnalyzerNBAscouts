# ADR 0003 — Regime de dados do DW e replanejamento da cadeia neural (D)

- **Status:** aceito
- **Data:** 2026-07-27
- **Decisão tomada no:** revisão da tarefa A4 e da cadeia D do `PLANO_PROXIMAS_ETAPAS.md`,
  motivada pela A3 (DW = temporada corrente, rolando — backfill Kaggle cancelado).
- **Substitui parcialmente:** a especificação original de D2 e D4 no plano.

## Contexto

A cadeia D (Fase 2 · motor neural de EV) foi especificada quando o plano previa a A3 como
backfill de **10 temporadas Kaggle (~350k linhas)**. A A3 foi redefinida em 2026-07-24: o DW
contém **apenas a temporada corrente**, mantida por `sync_warehouse` (`n_seasons=1`) + prune
de janela (`warehouse_max_games_per_player = 100`, `ingest.prune_player_game_logs`). O
`dataset.py` da A4 (PR #131) já foi escrito para esse regime.

Esta revisão responde a duas perguntas: **(a)** o volume sustenta D1/D4? **(b)** o que muda
na cadeia?

### Volume real do regime de 1 temporada

Base medida do DW hoje (seção 1 do plano): **~26,5k game logs, 474 jogadores, 1 temporada**.
Reconferir a qualquer momento com `python -m app.cli.dw_audit` (A2).

| Grandeza | Valor | Observação |
|---|---|---|
| `player_game_logs` | **~26,5k linhas** / 474 jogadores | ~56 jogos por jogador; janela de 100 quase nunca corta *dentro* de uma temporada (82+26=108) |
| Jogos elegíveis (`min_history=5`) | **~24k** | 26,5k − 474×5 |
| Linhas do dataset A4 | **~265k** | ~24k jogos × 11 mercados (`MARKET_TO_STAT`) |
| Amostra efetiva (jogos-jogador) | **~24k** | as 11 linhas de um mesmo jogo são fortemente correlacionadas |
| Linhas com `line_is_real=1` | **≈ 0 hoje** | `line_snapshots` só cresce quando a análise roda em produção (B2 pendente) |

O "~26,5k linhas" do plano é a contagem de **game logs**, não de linhas de treino — o dataset
A4 tem ~265k linhas. Ou seja: o que é escasso não é a contagem de linhas, e sim (i) o
**tamanho efetivo da amostra** (~24k jogos, não 265k eventos independentes) e (ii) as **linhas
e odds reais de mercado** (praticamente inexistentes até o deploy).

### Três achados que mudam o plano

**1. O prune apaga a temporada 2025-26 durante a 2026-27 — e a janela para evitar isso fecha
em outubro de 2026.** O prune mantém os 100 jogos mais recentes *por jogador*, sem noção de
temporada. Hoje (offseason) o DW guarda a 2025-26 inteira. Assim que a 2026-27 começar, cada
jogo novo empurra um jogo antigo para fora: por volta do meio da temporada nova, a 2025-26 já
foi apagada. O dataset de treino não é apenas pequeno — ele é **efêmero**, e o histórico
perdido não é recuperável pela ESPN via `n_seasons=1`. Custo de evitar: irrisório
(500 jogadores × ~100 jogos × 5 temporadas ≈ 250k linhas).

**2. `analyzed_props` é um livro-caixa real e nunca é podado — é o juiz honesto do D2.**
`analyzed_props` (append-only, sem retenção; `analysis_snapshots` idem) já grava, por prop
analisada: `line` e `odd_decimal` **reais** de mercado, `line_opened`, a
`true_probability` **da própria heurística** no momento da análise, `classification`, e — via
`services/settlement.py` — `result` (win/loss/push/void) + `actual_value`. Ou seja: o D2 não
precisa de odd sintética -110 nem de "reproduzir o `ev.py`" para as props que realmente foram
analisadas; o registro histórico já existe e sobrevive ao prune do DW.

**3. A metade "ROI" do gate do D4 depende da cadeia B, não da D.** O gate diz que o neural só
integra se superar o baseline em **Brier E ROI** no walk-forward. Brier/log-loss são
mensuráveis já hoje (linha sintética .5 serve). ROI **não é**: exige linha e odd reais, que só
existem em `line_snapshots`/`analyzed_props`, que só crescem quando o cron de análise roda em
produção — isto é, depois de **B1 (manual) → B2 → B3**. O mapa de dependências do plano não
mostra essa aresta. Com a quota de 500 req/mês da Odds API e ~100–300 props/dia analisadas,
3 meses de operação rendem ~9k–27k props liquidadas com odd real — suficiente para um
comparativo de ROI, ainda que ruidoso.

## Decisão

1. **D1 permanece como especificado.** ~24k linhas por mercado para uma regressão logística de
   18 features é folgado; o problema do regime de 1 temporada não é o D1. Sem mudanças.

2. **Nova tarefa A5 — prune ciente de temporada (P0, ~2h, Rodrigo, antes de out/2026).**
   Trocar a semântica de `prune_player_game_logs` de "mantenha os N jogos mais recentes" para
   "mantenha as N temporadas mais recentes" (`warehouse_keep_seasons: int = 3`, mantendo
   `warehouse_max_games_per_player` como teto *por temporada*). Temporadas encerradas passam a
   **acumular** em vez de erodir. Isso não contradiz a A3: a decisão da A3 era **não fazer
   backfill de histórico antigo não representativo**, não *descartar* as temporadas que o
   próprio sistema observou. Complemento: snapshot imutável do DW atual em parquet
   (`data/dw_snapshot_2025-26.parquet`) como corpus de treino independente do banco vivo.

3. **D2 avalia contra `analyzed_props`, não contra odd sintética.** O harness passa a ter duas
   fontes: (a) *dataset A4* → Brier/log-loss/calibração em todo o histórico (linha sintética
   permitida); (b) *`analyzed_props` liquidadas* → ROI com `odd_decimal` real, e o comparativo
   com a heurística usando a `true_probability` **gravada na época** (apples-to-apples, sem
   re-executar o `ev.py`). Odd sintética -110 fica como *fallback explicitamente rotulado*, e
   nenhum relatório de ROI pode misturar as duas fontes sem sinalizar. `+1h` no D2 (6h → 7h).

4. **D4 é dividido; a GNN é adiada.** Com ~24k jogos-jogador efetivos e 18 features que já
   reconstroem o `ev.py`, uma GNN heterogênea de 2 camadas (12h) tende a superajustar e falhar
   o gate — e um gate falho consome as 12h sem entregar produto.
   - **D4a — modelo tabular forte (~5h, P2):** gradient boosting + embeddings de jogador e
     adversário sobre o dataset A4, avaliado no harness D2. É o teste honesto de "há sinal além
     do `ev.py`?" no regime atual de dados.
   - **D4b — GNN v1 (~12h, P3, adiada):** só inicia quando o DW tiver **≥3 temporadas
     acumuladas** (consequência da A5) **ou** o D4a mostrar ganho de Brier ≥5% sobre o D1 —
     evidência de que há estrutura relacional a capturar.
   O gate objetivo (superar em Brier **e** ROI) continua valendo para D4a e D4b.

5. **O prune de `line_history` da C2 fica como está.** `line_history` (append-only, com
   `odd_decimal`) é a série intraday; a retenção de 30 dias da C2 é segura **porque**
   `analyzed_props` retém a odd do momento da análise em definitivo. Registrado aqui para que
   ninguém "conserte" isso depois como se fosse perda de dado de treino.

6. **Reordenação de prioridade: a cadeia B passa a ser caminho crítico da Fase 2.** Como o ROI
   real só acumula com o sistema em produção, cada semana sem deploy é uma semana sem dado de
   mercado. B1 (parte manual: instância Oracle, 80/443 na VCN, scripts, secrets) é o item de
   maior alavancagem do projeto agora — ele não bloqueia apenas B2/B3, mas o gate da Fase 2.

## Consequências

- **Mapa de dependências ganha duas arestas:** `A5 → A4` (o dataset passa a poder crescer) e
  `B3 → D4a/D4b` (ROI real). O caminho crítico do modelo vira
  `A1 → A2 → A5 → A4 → D1 → D2 → D4a → D5 → D6`, com `B1 → B2 → B3` alimentando o gate.
- **Horas:** +2h (A5) +1h (D2) +5h (D4a) e −12h imediatas (D4b adiada) → Fase 2 cai de ~45h
  para ~39h de trabalho iniciável.
- **Risco aceito:** se o D4a não superar o D1, a Fase 2 entrega um relatório negativo e o
  produto segue com a heurística atrás da flag `ev_engine` — resultado já previsto como
  entrega válida no plano.
- **Risco residual:** a A5 precisa entrar **antes** do início da 2026-27 (~out/2026). Se
  perder essa janela, a temporada 2025-26 é perdida e o corpus volta a zero.

## Alternativas consideradas

| Opção | Por que não |
|---|---|
| Reverter a A3 e fazer o backfill Kaggle | A decisão da A3 (histórico antigo não representativo) segue válida; o problema aqui é retenção do que *já foi observado*, não profundidade histórica |
| Manter o D4 monolítico (GNN direto, 12h) | Alta chance de falhar o gate por escassez de amostra efetiva, sem ter testado antes se existe sinal além do `ev.py` |
| Aceitar odd sintética -110 no gate de ROI | Transforma o gate objetivo em exercício circular: a odd sintética não tem vig real nem seleção de mercado, e ROI medido nela não prediz ROI real |
| Rodar a Fase 2 inteira antes da cadeia B | O gate ficaria sem a metade de ROI justamente na hora de decidir se o neural entra em produção |
