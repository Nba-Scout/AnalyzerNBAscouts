"""Auditoria de saúde do data warehouse (Tarefa A2).

Termômetro somente-leitura de `player_game_logs`: volume, cobertura por temporada
e por jogador, duplicatas, violações da janela de prune, % de playoffs, nulos em
colunas-chave e sinais de sync parado. **Não altera o DW.**

Uso (dentro do container api/worker, com Postgres acessível):

    python -m app.cli.dw_audit

Rodar antes/depois de uma carga ou sync para comparar. A coleta (`collect_audit`)
é separada da formatação (`format_report`, pura) para facilitar testes.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from datetime import date, timedelta

from sqlalchemy import distinct, func, select

# Colunas cuja ausência (NULL) é relevante para a qualidade do dataset.
_NULL_COLS = ("min_played", "pts", "reb", "ast")
# Jogador sem jogo há mais de _STALE_DAYS (vs. a data máx. do DW) pode estar fora
# do sync — só é sinal útil com a temporada ATIVA (ver _ACTIVE_WITHIN_DAYS).
_STALE_DAYS = 14
# date_max a no máx. estes dias de "hoje" ⇒ temporada ativa. Fora disso (offseason)
# a data máx. congela e quase todo o elenco pareceria "stale" → suspendemos o alerta.
_ACTIVE_WITHIN_DAYS = 3
# Gap acima disto entre datas de jogo consecutivas da liga = suspeita de dias de
# scraping perdidos (o All-Star break, ~fev, é uma exceção esperada).
_GAP_DAYS = 4


async def collect_audit(session, *, today: date | None = None) -> dict:
    """Roda as queries de auditoria e devolve as métricas num dict (só leitura).

    `today` (default: data de hoje) é injetável para testes determinísticos — usado
    só para decidir se a temporada está ativa (gate do alerta de 'stale').
    """
    from app.core.config import get_settings
    from app.db.models.player_game_log import PlayerGameLog as G

    window_max = get_settings().warehouse_max_games_per_player
    ref_today = today or date.today()

    total = await session.scalar(select(func.count()).select_from(G)) or 0
    players = await session.scalar(select(func.count(distinct(G.player_id)))) or 0

    per_season_rows = (
        await session.execute(select(G.season, func.count()).group_by(G.season).order_by(G.season))
    ).all()
    per_season = {season: int(n) for season, n in per_season_rows}

    # Contagem por jogador (subquery reutilizada para <10 jogos e violação de janela).
    counts = select(G.player_id, func.count().label("n")).group_by(G.player_id).subquery()
    players_lt_10 = await session.scalar(select(func.count()).select_from(counts).where(counts.c.n < 10)) or 0
    window_violations = (
        await session.scalar(select(func.count()).select_from(counts).where(counts.c.n > window_max)) or 0
    )

    dup_sq = select(G.player_id, G.game_date).group_by(G.player_id, G.game_date).having(func.count() > 1).subquery()
    duplicates = await session.scalar(select(func.count()).select_from(dup_sq)) or 0

    playoff_rows = await session.scalar(select(func.count()).select_from(G).where(G.is_playoff.is_(True))) or 0
    pct_playoff = round(100.0 * playoff_rows / total, 1) if total else 0.0

    nulls = {
        col: (await session.scalar(select(func.count()).select_from(G).where(getattr(G, col).is_(None))) or 0)
        for col in _NULL_COLS
    }

    date_min = await session.scalar(select(func.min(G.game_date)))
    date_max = await session.scalar(select(func.max(G.game_date)))

    # Buracos de data na liga: gaps > _GAP_DAYS entre datas de jogo consecutivas
    # (dias de scraping possivelmente perdidos; All-Star break, ~fev, é exceção).
    all_dates = (await session.scalars(select(distinct(G.game_date)).order_by(G.game_date))).all()
    gaps = [(a, b) for a, b in zip(all_dates, all_dates[1:], strict=False) if (b - a).days > _GAP_DAYS]
    date_gaps = len(gaps)
    max_gap_days = max(((b - a).days for a, b in gaps), default=0)

    # 'stale' só é significativo com a temporada ATIVA (date_max recente vs. hoje);
    # na offseason a data máx. congela e quase todo o elenco pareceria stale.
    season_active = date_max is not None and (ref_today - date_max).days <= _ACTIVE_WITHIN_DAYS
    stale_players = 0
    if season_active:
        last_per_player = select(G.player_id, func.max(G.game_date).label("last")).group_by(G.player_id).subquery()
        stale_players = (
            await session.scalar(
                select(func.count())
                .select_from(last_per_player)
                .where(last_per_player.c.last < date_max - timedelta(days=_STALE_DAYS))
            )
            or 0
        )

    return {
        "total_rows": int(total),
        "players": int(players),
        "per_season": per_season,
        "players_lt_10_games": int(players_lt_10),
        "window_violations": int(window_violations),
        "window_max": int(window_max),
        "duplicates": int(duplicates),
        "pct_playoff": pct_playoff,
        "nulls": nulls,
        "date_min": date_min.isoformat() if date_min else None,
        "date_max": date_max.isoformat() if date_max else None,
        "date_gaps": date_gaps,
        "max_gap_days": max_gap_days,
        "season_active": season_active,
        "stale_players": int(stale_players),
        "stale_days": _STALE_DAYS,
    }


def format_report(m: dict) -> str:
    """Formata as métricas num relatório de texto (função pura, testável)."""
    lines: list[str] = []
    lines.append("=== Auditoria do Data Warehouse (player_game_logs) ===")
    lines.append(f"Linhas totais......: {m['total_rows']}")
    lines.append(f"Jogadores..........: {m['players']}")
    lines.append(f"Periodo............: {m['date_min']} -> {m['date_max']}")
    lines.append(f"Playoffs...........: {m['pct_playoff']}% das linhas")
    lines.append(f"Buracos de data....: {m['date_gaps']} (maior: {m['max_gap_days']}d)")
    lines.append(f"Temporada..........: {'ativa' if m['season_active'] else 'inativa (offseason)'}")
    lines.append("")
    lines.append("Linhas por temporada:")
    if m["per_season"]:
        for season, n in m["per_season"].items():
            lines.append(f"  {season}: {n}")
    else:
        lines.append("  (vazio)")
    lines.append("")
    lines.append("Nulos em colunas-chave:")
    for col, n in m["nulls"].items():
        lines.append(f"  {col}: {n}")
    lines.append("")

    # Sinais de alerta (o que exige ação). ⚠ = estrutural; • = informativo.
    warn: list[str] = []
    if m["duplicates"]:
        warn.append(
            f"⚠ {m['duplicates']} par(es) duplicado(s) (player_id, game_date) — deveria ser 0 (uq_player_gamedate)."
        )
    if m["window_violations"]:
        warn.append(
            f"⚠ {m['window_violations']} jogador(es) com > {m['window_max']} jogos — prune da janela não aplicado."
        )
    if m["date_gaps"]:
        warn.append(
            f"• {m['date_gaps']} buraco(s) de data > {_GAP_DAYS}d na liga (maior {m['max_gap_days']}d) — "
            "checar scraping perdido; o All-Star break (~fev) é esperado."
        )
    if m["players_lt_10_games"]:
        warn.append(
            f"• {m['players_lt_10_games']} jogador(es) com < 10 jogos (raso — esperado no início da temporada)."
        )
    # 'stale' só é confiável com a temporada ativa (na offseason já vem zerado da coleta).
    if m["season_active"] and m["stale_players"]:
        warn.append(
            f"• {m['stale_players']} jogador(es) sem jogo há > {m['stale_days']} dias vs. a data máx. "
            "(possível sync parado — ou lesionados/fora)."
        )
    lines.append("Alertas:" if warn else "Alertas: nenhum.")
    lines.extend(f"  {w}" for w in warn)
    return "\n".join(lines)


async def _run() -> int:
    from app.db.session import get_session_factory

    async with get_session_factory()() as session:
        metrics = await collect_audit(session)
    print(format_report(metrics))
    # Código de saída != 0 se houver problema estrutural (duplicatas / janela).
    return 1 if (metrics["duplicates"] or metrics["window_violations"]) else 0


def main() -> int:
    # Garante UTF-8 na saída (símbolos ⚠/• no relatório) mesmo em consoles não-UTF-8.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
