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
from datetime import timedelta

from sqlalchemy import distinct, func, select

log = logging.getLogger("app.cli.dw_audit")

# Colunas cuja ausência (NULL) é relevante para a qualidade do dataset.
_NULL_COLS = ("min_played", "pts", "reb", "ast")
# Jogo mais recente por jogador anterior a isto (em dias, vs. a data máx. do DW)
# sinaliza que o sync pode não estar atualizando aquele jogador.
_STALE_DAYS = 14


async def collect_audit(session) -> dict:
    """Roda as queries de auditoria e devolve as métricas num dict (só leitura)."""
    from app.core.config import get_settings
    from app.db.models.player_game_log import PlayerGameLog as G

    window_max = get_settings().warehouse_max_games_per_player

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

    stale_players = 0
    if date_max is not None:
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
        "stale_players": int(stale_players),
        "stale_days": _STALE_DAYS,
    }


def format_report(m: dict) -> str:
    """Formata as métricas num relatório de texto (função pura, testável)."""
    lines: list[str] = []
    lines.append("=== Auditoria do Data Warehouse (player_game_logs) ===")
    lines.append(f"Linhas totais......: {m['total_rows']}")
    lines.append(f"Jogadores..........: {m['players']}")
    lines.append(f"Período............: {m['date_min']} → {m['date_max']}")
    lines.append(f"Playoffs...........: {m['pct_playoff']}% das linhas")
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

    # Sinais de alerta (o que exige ação)
    warn: list[str] = []
    if m["duplicates"]:
        warn.append(f"⚠ {m['duplicates']} duplicata(s) (player_id, game_date) — deveria ser 0 (uq_player_gamedate).")
    if m["window_violations"]:
        warn.append(
            f"⚠ {m['window_violations']} jogador(es) com > {m['window_max']} jogos — prune da janela não aplicado."
        )
    if m["players_lt_10_games"]:
        warn.append(f"• {m['players_lt_10_games']} jogador(es) com < 10 jogos (histórico raso — esperado no início).")
    if m["stale_players"]:
        warn.append(
            f"• {m['stale_players']} jogador(es) sem jogo nos últimos {m['stale_days']} dias vs. a data máx. "
            "(possível sync parado — ou apenas jogadores lesionados/fora)."
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
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())
