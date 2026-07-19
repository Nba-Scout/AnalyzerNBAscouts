"""Integração da leitura do data warehouse (batch_gamelog_stats) — Postgres real."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.services import ingest, warehouse


async def _seed_player(session, *, espn_id: str, name: str, n_games: int):
    """Cria um jogador (com espn_id) e n_games gamelogs de regular season."""
    player = await ingest.upsert_player(session, full_name=name, espn_id=espn_id)
    await session.commit()
    base = date(2026, 1, 1)
    records = [
        {
            "game_date": base + timedelta(days=i),
            "season": "2025-26",
            "season_type": "Regular Season",
            "is_playoff": False,
            "home_away": "home" if i % 2 == 0 else "away",
            "min_played": 32.0,
            "pts": 20.0 + i,
            "reb": 8.0,
            "ast": 5.0,
        }
        for i in range(n_games)
    ]
    await ingest.upsert_game_logs(session, player.id, records, source="espn")
    await session.commit()
    return player


@pytest.mark.asyncio
async def test_batch_gamelog_stats_serves_from_dw(session):
    """Jogador com histórico suficiente é servido pelo DW (chave = espn_id)."""
    await _seed_player(session, espn_id="3000001", name="DW Player A", n_games=20)

    out = await warehouse.batch_gamelog_stats(session, ["3000001"])

    assert "3000001" in out
    stats = out["3000001"]
    assert stats["games_played"] > 0
    assert stats["df"] is not None
    assert "avg_pts" in stats and stats["avg_pts"] > 0


@pytest.mark.asyncio
async def test_batch_excludes_below_min_and_unknown(session):
    """Jogador abaixo de MIN_DW_GAMES e espn_id desconhecido não entram no mapa."""
    # 2 jogos (< MIN_DW_GAMES=3) → tratado como ausente (cai na ESPN no chamador)
    await _seed_player(session, espn_id="3000002", name="Sparse Player", n_games=2)

    out = await warehouse.batch_gamelog_stats(session, ["3000002", "nao-existe"])

    assert "3000002" not in out
    assert "nao-existe" not in out


@pytest.mark.asyncio
async def test_batch_empty_input(session):
    assert await warehouse.batch_gamelog_stats(session, []) == {}


@pytest.mark.asyncio
async def test_batch_ignores_previous_season_playoffs(session):
    """Playoffs de temporada passada não marcam is_playoffs=True na regular atual.

    Sem o escopo por temporada, os playoffs de 2024-25 ainda na janela do DW
    marcariam is_playoffs=True e dominariam o lookback durante a temporada regular
    de 2025-26 — divergindo do path ESPN (n_seasons=1, que não os vê).
    """
    player = await ingest.upsert_player(session, full_name="Cross Season", espn_id="3000003")
    await session.commit()

    records = []
    # Temporada passada: 8 jogos de PLAYOFF, pontuação alta (2024-25)
    base_old = date(2025, 5, 1)
    for i in range(8):
        records.append(
            {
                "game_date": base_old + timedelta(days=i),
                "season": "2024-25",
                "season_type": "Playoffs",
                "is_playoff": True,
                "home_away": "home",
                "min_played": 34.0,
                "pts": 30.0,
                "reb": 9.0,
                "ast": 6.0,
            }
        )
    # Temporada corrente: 20 jogos de REGULAR, pontuação menor (2025-26)
    base_new = date(2026, 1, 1)
    for i in range(20):
        records.append(
            {
                "game_date": base_new + timedelta(days=i),
                "season": "2025-26",
                "season_type": "Regular Season",
                "is_playoff": False,
                "home_away": "away",
                "min_played": 32.0,
                "pts": 18.0,
                "reb": 7.0,
                "ast": 4.0,
            }
        )
    await ingest.upsert_game_logs(session, player.id, records, source="espn")
    await session.commit()

    stats = (await warehouse.batch_gamelog_stats(session, ["3000003"]))["3000003"]
    # Só há playoffs de temporada passada → is_playoffs deve ser False
    assert stats["is_playoffs"] is False
    # E o lookback não é dominado pelos 30 pts de playoff antigo (~18 da regular atual)
    assert stats["avg_pts"] < 25
