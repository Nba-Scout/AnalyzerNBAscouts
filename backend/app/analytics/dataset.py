"""Dataset supervisionado de treino a partir do data warehouse (Tarefa A4).

Transforma `player_game_logs` em linhas **(jogador, jogo, mercado)** com features
calculadas SOMENTE com jogos anteriores à data-alvo (corte temporal estrito, sem
vazamento) e `label = stat_real >= linha`. Alimenta a Fase 2 (baseline D1, harness D2).

**Offline-only:** não toca `ev.py`, `/api/props` nem o request-path. O motor
heurístico (`ev.py`) NÃO é modificado — aqui apenas reproduzimos, num formato
tabular, features equivalentes às que ele consome (médias móveis, frequência sobre
a linha, minutos, descanso/back-to-back, playoffs, contexto de matchup).

Linha (`line`): usa a linha real de `line_snapshots` quando existir para
(jogador, data, mercado); senão sintetiza a partir da média móvel recente
(arredondada a .5), registrando a origem em `line_source`.

Determinístico: mesmos dados + params ⇒ mesmo dataset (ordenação estável, sem
aleatoriedade). Uso via CLI:

    python -m app.analytics.dataset --out data/train.parquet --valid-from 2026-01-01
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import date

from app.core.constants import MARKET_TO_STAT

log = logging.getLogger(__name__)

# Defaults de matchup (espelham matchup.py / Settings) usados quando não há
# provedor de força de time as-of-data. A força real do adversário até a data D
# (def_rating/pace calculados sem vazamento) é um follow-up natural do D3.
_DEFAULT_DEF_RATING = 112.0
_DEFAULT_PACE = 100.0

# Janela da média móvel que define a linha sintética.
_LINE_WINDOW = 10

# Mercados default = todos os suportados pelo motor.
DEFAULT_MARKETS: tuple[str, ...] = tuple(MARKET_TO_STAT.keys())

# Colunas de feature (entrada do modelo) — garantidamente sem NaN na saída.
# opp_def_rating/opp_pace ficam FORA (são constantes = média da liga enquanto não
# há força de time as-of-data; feature morta + risco de train/serve skew). Seguem
# no output como colunas de contexto, prontas para virar feature quando o D3 as
# calcular sem vazamento.
FEATURE_COLUMNS: tuple[str, ...] = (
    "avg_5",
    "avg_10",
    "avg_20",
    "season_avg",
    "std_10",
    "z_score",
    "avg_minus_line",
    "avg_over_line",
    "freq_over_line_10",
    "freq_over_line_20",
    "minutes_avg_10",
    "minutes_trend",
    "games_prior",
    "rest_days",
    "back_to_back",
    "is_playoff",
    "is_home",
    "line_is_real",
)

# (opp_abbr, as_of_date) -> (def_rating, pace)
MatchupProvider = Callable[[str | None, date], tuple[float, float]]
# (player_name, game_date, market_key) -> linha real ou None
LineProvider = Callable[[str, date, str], "float | None"]


def _default_matchup(_opp: str | None, _as_of: date) -> tuple[float, float]:
    return _DEFAULT_DEF_RATING, _DEFAULT_PACE


def _mean(vals: Sequence[float]) -> float:
    return sum(vals) / len(vals) if vals else 0.0


def _std(vals: Sequence[float]) -> float:
    """Desvio-padrão amostral; 0.0 com menos de 2 pontos (evita NaN)."""
    n = len(vals)
    if n < 2:
        return 0.0
    m = _mean(vals)
    return (sum((v - m) ** 2 for v in vals) / (n - 1)) ** 0.5


@dataclass
class GameLog:
    """Um jogo de um jogador, normalizado para o construtor de features.

    `stats` mapeia token MAIÚSCULO (PTS, REB, ..., PRA, STOCKS) → valor, contendo
    apenas os stats não-nulos daquele jogo.
    """

    game_date: date
    is_playoff: bool = False
    is_home: bool | None = None
    opponent_abbr: str | None = None
    min_played: float | None = None
    stats: dict[str, float] = field(default_factory=dict)
    player_id: int = 0
    player_name: str = ""
    season: str = ""


def build_player_rows(
    logs: Sequence[GameLog],
    markets: Sequence[str] = DEFAULT_MARKETS,
    *,
    min_history: int = 5,
    matchup: MatchupProvider = _default_matchup,
    line_provider: LineProvider | None = None,
) -> list[dict]:
    """Gera as linhas de treino de UM jogador (função pura, testável sem DB).

    Para cada jogo em ordem cronológica com pelo menos `min_history` jogos
    anteriores, e para cada mercado, produz uma linha cujas features usam
    EXCLUSIVAMENTE jogos com data estritamente < data-alvo (corte temporal
    estrito, garantido localmente — não dependemos da unicidade por data do DW).
    """
    ordered = sorted(logs, key=lambda g: g.game_date)
    rows: list[dict] = []

    for i, g in enumerate(ordered):
        # Corte estrito e LOCAL: exclui o alvo, jogos futuros E empates de data.
        prior = [p for p in ordered[:i] if p.game_date < g.game_date]
        if len(prior) < min_history:
            continue

        rest_days = (g.game_date - prior[-1].game_date).days
        back_to_back = 1 if rest_days == 1 else 0
        def_rating, pace = matchup(g.opponent_abbr, g.game_date)
        minutes_prior = [p.min_played for p in prior if p.min_played is not None]
        minutes_avg_10 = _mean(minutes_prior[-10:])
        minutes_20 = _mean(minutes_prior[-20:])
        minutes_trend = (_mean(minutes_prior[-5:]) / minutes_20) if minutes_20 > 0 else 1.0

        for market in markets:
            stat = MARKET_TO_STAT.get(market)
            if stat is None:
                continue
            actual = g.stats.get(stat)
            if actual is None:
                continue

            prior_vals = [p.stats[stat] for p in prior if stat in p.stats]
            if len(prior_vals) < min_history:
                continue  # histórico insuficiente do stat para este mercado

            avg_5 = _mean(prior_vals[-5:])
            avg_10 = _mean(prior_vals[-10:])
            avg_20 = _mean(prior_vals[-20:])
            season_avg = _mean(prior_vals)  # DW = temporada corrente ⇒ média da temporada até D
            std_10 = _std(prior_vals[-10:])

            # Linha: real de line_snapshots quando existir; senão sintética. A
            # sintética é SEMPRE .5 (int(média) + 0.5) — nunca inteira, então não há
            # empate/push possível e o piso natural é 0.5 (stats de baixo volume).
            real_line = line_provider(g.player_name, g.game_date, market) if line_provider else None
            if real_line is None:
                line = float(int(_mean(prior_vals[-_LINE_WINDOW:]))) + 0.5
                line_is_real = 0
                line_source = "synthetic"
            else:
                line = float(real_line)
                line_is_real = 1
                line_source = "real"

            if actual == line:
                continue  # push (só ocorre em linha real inteira) — ambíguo, descartado

            # freq sobre a linha em 2 janelas (a de 20 desacopla da janela .5 da linha);
            # `>` estrito, coerente com a semântica de "over" e com ev.games_over_line.
            freq_10 = sum(1 for v in prior_vals[-10:] if v > line) / len(prior_vals[-10:])
            freq_20 = sum(1 for v in prior_vals[-20:] if v > line) / len(prior_vals[-20:])
            # Interações que reconstroem o núcleo do ev.py (z = (avg-line)/std).
            z_score = (avg_10 - line) / std_10 if std_10 > 0 else 0.0
            avg_over_line = avg_10 / line if line > 0 else 0.0

            rows.append(
                {
                    "player_id": g.player_id,
                    "player_name": g.player_name,
                    "season": g.season,
                    "game_date": g.game_date,
                    "market": market,
                    "stat": stat,
                    "line": line,
                    "line_source": line_source,
                    "label": 1 if actual > line else 0,
                    "actual": float(actual),
                    # contexto (não-features enquanto constantes)
                    "opp_def_rating": float(def_rating),
                    "opp_pace": float(pace),
                    # features
                    "avg_5": avg_5,
                    "avg_10": avg_10,
                    "avg_20": avg_20,
                    "season_avg": season_avg,
                    "std_10": std_10,
                    "z_score": z_score,
                    "avg_minus_line": avg_10 - line,
                    "avg_over_line": avg_over_line,
                    "freq_over_line_10": freq_10,
                    "freq_over_line_20": freq_20,
                    "minutes_avg_10": minutes_avg_10,
                    "minutes_trend": minutes_trend,
                    "games_prior": len(prior_vals),
                    "rest_days": rest_days,
                    "back_to_back": back_to_back,
                    "is_playoff": 1 if g.is_playoff else 0,
                    "is_home": 1 if g.is_home else 0,
                    "line_is_real": line_is_real,
                }
            )

    return rows


# ---------------------------------------------------------------------------
# Carga a partir do data warehouse (Postgres)
# ---------------------------------------------------------------------------
_STAT_TOKENS: tuple[str, ...] = tuple(dict.fromkeys(MARKET_TO_STAT.values()))  # únicos, ordem estável


async def _load_line_lookup(session) -> dict[tuple[str, date, str], float]:
    """Pré-carrega linhas reais de abertura: {(norm_name, data, mercado): linha}."""
    from sqlalchemy import select

    from app.analytics.stats_parsing import _normalize_name
    from app.db.models.line import LineSnapshot

    rows = (await session.scalars(select(LineSnapshot).where(LineSnapshot.direction == "over"))).all()
    return {(_normalize_name(r.player_name), r.game_date, r.market_key): float(r.line_opened) for r in rows}


async def build_training_rows(
    session,
    *,
    markets: Sequence[str] = DEFAULT_MARKETS,
    min_history: int = 5,
    matchup: MatchupProvider = _default_matchup,
) -> list[dict]:
    """Carrega o DW e monta o dataset supervisionado (linhas ordenadas e estáveis)."""
    from collections import defaultdict

    from sqlalchemy import select

    from app.analytics.stats_parsing import _normalize_name
    from app.db.models.player import Player
    from app.db.models.player_game_log import PlayerGameLog

    players = {p.id: p for p in (await session.scalars(select(Player))).all()}
    logs = (
        await session.scalars(select(PlayerGameLog).order_by(PlayerGameLog.player_id, PlayerGameLog.game_date))
    ).all()

    line_lookup = await _load_line_lookup(session)

    def _line_provider(name: str, d: date, market: str) -> float | None:
        return line_lookup.get((_normalize_name(name), d, market))

    by_player: dict[int, list[GameLog]] = defaultdict(list)
    for r in logs:
        stats = {tok: getattr(r, tok.lower()) for tok in _STAT_TOKENS if getattr(r, tok.lower()) is not None}
        player = players.get(r.player_id)
        by_player[r.player_id].append(
            GameLog(
                game_date=r.game_date,
                is_playoff=bool(r.is_playoff),
                is_home=(r.home_away == "home") if r.home_away else None,
                opponent_abbr=r.opponent_abbr,
                min_played=r.min_played,
                stats=stats,
                player_id=r.player_id,
                player_name=(player.full_name if player else ""),
                season=r.season,
            )
        )

    rows: list[dict] = []
    for pid in sorted(by_player):
        rows.extend(
            build_player_rows(
                by_player[pid],
                markets,
                min_history=min_history,
                matchup=matchup,
                line_provider=_line_provider,
            )
        )
    log.info("build_training_rows: %d linhas de %d jogadores", len(rows), len(by_player))
    return rows


# ---------------------------------------------------------------------------
# Export (pandas / parquet) e CLI
# ---------------------------------------------------------------------------
def rows_to_frame(rows: list[dict], *, valid_from: date | None = None):
    """Converte as linhas em DataFrame; adiciona `split` (train/valid) se `valid_from`."""
    import pandas as pd

    df = pd.DataFrame(rows)
    if not df.empty and valid_from is not None:
        df["split"] = df["game_date"].map(lambda d: "valid" if d >= valid_from else "train")
    return df


def write_parquet(df, path: str) -> None:
    """Escreve o DataFrame em parquet (pyarrow é dependência do extra opcional [ml])."""
    try:
        import pyarrow  # noqa: F401
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "pyarrow ausente — instale o extra offline: pip install -e '.[ml]' (ou 'pip install pyarrow')."
        ) from exc
    import pathlib

    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="python -m app.analytics.dataset", description="Gera o dataset de treino (A4).")
    p.add_argument("--out", default="data/train.parquet", help="Caminho do parquet de saída.")
    p.add_argument("--valid-from", default=None, help="Data ISO (YYYY-MM-DD): jogos >= viram split=valid.")
    p.add_argument("--min-history", type=int, default=5, help="Mín. de jogos anteriores para gerar uma linha.")
    p.add_argument("--markets", default=None, help="Lista de mercados separada por vírgula (default: todos).")
    return p.parse_args(argv)


async def _run(args: argparse.Namespace) -> int:
    from app.db.session import get_session_factory

    markets = tuple(args.markets.split(",")) if args.markets else DEFAULT_MARKETS
    unknown = [m for m in markets if m not in MARKET_TO_STAT]
    if unknown:
        raise SystemExit(f"Mercado(s) inválido(s): {', '.join(unknown)}. Válidos: {', '.join(MARKET_TO_STAT)}")
    valid_from = date.fromisoformat(args.valid_from) if args.valid_from else None

    async with get_session_factory()() as session:
        rows = await build_training_rows(session, markets=markets, min_history=args.min_history)

    df = rows_to_frame(rows, valid_from=valid_from)
    write_parquet(df, args.out)

    n_valid = int((df["split"] == "valid").sum()) if ("split" in df) else 0
    print(f"OK: {len(df)} linhas -> {args.out} (train={len(df) - n_valid}, valid={n_valid})")
    return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    return asyncio.run(_run(_parse_args(sys.argv[1:] if argv is None else argv)))


if __name__ == "__main__":
    raise SystemExit(main())
