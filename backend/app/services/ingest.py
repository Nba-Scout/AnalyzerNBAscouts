"""Núcleo de ingestão do data warehouse — source-agnostic (Kaggle + ESPN).

Tanto o adapter Kaggle (bulk histórico, via CSV) quanto o adapter ESPN
(temporadas recentes + incremental) produzem **registros normalizados** e os
gravam aqui. O upsert tem como alvo a constraint uq_player_gamedate
(player_id, game_date): um jogador joga no máximo 1 jogo por dia, então essa é
a chave de dedup entre as fontes. No conflito, COALESCE preserva valores
não-nulos existentes (fonte mais rica não é sobrescrita por nulos).

Registro normalizado = dict com chaves iguais às colunas de PlayerGameLog
(menos player_id, resolvido aqui), mais opcionalmente game_id.
"""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics.stats_parsing import (
    _events_meta_from_raw,
    _normalize_name,
    _parse_game_rows,
)
from app.db.models.player import Player
from app.db.models.player_game_log import PlayerGameLog
from app.db.models.sync_state import SyncState

log = logging.getLogger(__name__)

# Colunas de stats sujeitas a COALESCE no conflito (preserva dado existente
# quando o novo registro traz NULL). Identificação/contexto também entram.
_COALESCE_COLS = (
    "game_id",
    "season",
    "season_type",
    "is_playoff",
    "home_away",
    "opponent_abbr",
    "team_abbr",
    "team_score",
    "opp_score",
    "margin",
    "min_played",
    "pts",
    "reb",
    "ast",
    "fg3m",
    "blk",
    "stl",
    "tov",
    "fgm",
    "fga",
    "fg3a",
    "ftm",
    "fta",
    "oreb",
    "dreb",
    "pf",
    "plus_minus",
    "pra",
    "pr",
    "pa",
    "ra",
    "stocks",
    "source",
)


def season_str_from_date(d: date) -> str:
    """Deriva a temporada NBA ('YYYY-YY') a partir da data do jogo.

    Temporada vai de outubro a junho; jogos de set/out+ pertencem à temporada
    que começa naquele ano-calendário.
    """
    start = d.year if d.month >= 9 else d.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


def _with_combos(rec: dict) -> dict:
    """Materializa combos (pra/pr/pa/ra/stocks) quando ausentes e há base."""

    def g(k: str) -> float | None:
        return rec.get(k)

    def add(a: str, b: str, c: str | None = None) -> float | None:
        vals = [g(a), g(b)] + ([g(c)] if c else [])
        if any(v is None for v in vals):
            return None
        return float(sum(vals))

    rec.setdefault("pra", add("pts", "reb", "ast"))
    rec.setdefault("pr", add("pts", "reb"))
    rec.setdefault("pa", add("pts", "ast"))
    rec.setdefault("ra", add("reb", "ast"))
    rec.setdefault("stocks", add("blk", "stl"))
    return rec


async def upsert_player(
    session: AsyncSession,
    *,
    full_name: str,
    espn_id: str | None = None,
    nba_api_id: int | None = None,
    position: str | None = None,
) -> Player:
    """Get-or-create de Player por normalized_name; completa IDs externos."""
    norm = _normalize_name(full_name)
    player = await session.scalar(select(Player).where(Player.normalized_name == norm).limit(1))

    if player is None:
        player = Player(
            full_name=full_name,
            normalized_name=norm,
            espn_id=espn_id,
            nba_api_id=nba_api_id,
            position=position,
            is_active=True,
        )
        session.add(player)
        await session.flush()  # garante player.id
        return player

    # Completa IDs/posição faltantes sem sobrescrever os existentes
    if espn_id and not player.espn_id:
        player.espn_id = espn_id
    if nba_api_id and not player.nba_api_id:
        player.nba_api_id = nba_api_id
    if position and not player.position:
        player.position = position
    return player


async def upsert_game_logs(
    session: AsyncSession,
    player_id: int,
    records: list[dict],
    source: str,
) -> int:
    """Upsert em massa de gamelogs (alvo uq_player_gamedate). Retorna nº de linhas.

    No conflito (mesmo player_id+game_date), COALESCE(novo, existente) preserva
    valores já gravados quando o novo registro traz NULL — fonte mais rica
    (ex.: Kaggle com placar) não é apagada por uma fonte mais pobre (ESPN).
    """
    if not records:
        return 0

    # Dedup por game_date dentro do lote: Postgres recusa ON CONFLICT que
    # afeta a mesma linha 2x no mesmo INSERT. Mantém o último registro da data.
    by_date: dict[date, dict] = {}
    for r in records:
        gd = r.get("game_date")
        if gd is None:
            continue
        rec = _with_combos(dict(r))
        rec["player_id"] = player_id
        rec["source"] = rec.get("source") or source
        by_date[gd] = rec

    rows = list(by_date.values())
    if not rows:
        return 0

    stmt = pg_insert(PlayerGameLog).values(rows)
    update_set = {col: func.coalesce(stmt.excluded[col], PlayerGameLog.__table__.c[col]) for col in _COALESCE_COLS}
    stmt = stmt.on_conflict_do_update(constraint="uq_player_gamedate", set_=update_set)
    await session.execute(stmt)
    return len(rows)


async def update_sync_state(
    session: AsyncSession,
    player_id: int,
    *,
    last_game_date: date | None,
    source: str,
    seasons_backfilled: int = 0,
    status: str = "ok",
) -> None:
    """Upsert do watermark de sincronização do jogador (1 linha por player_id)."""
    values = {
        "player_id": player_id,
        "last_game_date": last_game_date,
        "source": source,
        "seasons_backfilled": seasons_backfilled,
        "status": status,
    }
    stmt = pg_insert(SyncState).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["player_id"],
        set_={
            "last_game_date": func.greatest(
                func.coalesce(stmt.excluded.last_game_date, SyncState.last_game_date),
                func.coalesce(SyncState.last_game_date, stmt.excluded.last_game_date),
            ),
            "source": stmt.excluded.source,
            "seasons_backfilled": func.greatest(stmt.excluded.seasons_backfilled, SyncState.seasons_backfilled),
            "status": stmt.excluded.status,
        },
    )
    await session.execute(stmt)


# ---------------------------------------------------------------------------
# Adapter ESPN — temporadas recentes + incremental (sem geoblock, sem creds)
# ---------------------------------------------------------------------------
def _parse_iso_date(s: str) -> date | None:
    try:
        return date.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def espn_raw_to_records(raw_single: dict) -> list[dict]:
    """Converte UM gamelog ESPN (com 'seasonTypes') em registros normalizados.

    Percorre regular season + playoffs, marca is_playoff por linha e mapeia as
    colunas do _parse_game_rows (MAIÚSCULAS) para as colunas de PlayerGameLog.
    Linhas sem data válida (placeholders 'G1') são descartadas.
    """
    if not raw_single:
        return []
    events_meta = _events_meta_from_raw(raw_single)
    records: list[dict] = []

    for season_type in raw_single.get("seasonTypes", []):
        display = str(season_type.get("displayName", ""))
        is_playoffs = any(x in display for x in ("Playoff", "Post Season", "Postseason"))
        is_regular = "Regular Season" in display
        if not is_regular and not is_playoffs:
            continue

        for cat in season_type.get("categories", []):
            if cat.get("type") != "event":
                continue
            for row in _parse_game_rows(cat.get("events", []), player_id="", events_meta=events_meta):
                gd = _parse_iso_date(row.get("Date", ""))
                if gd is None:
                    continue
                records.append(
                    {
                        "game_date": gd,
                        "season": season_str_from_date(gd),
                        "season_type": "Playoffs" if is_playoffs else "Regular Season",
                        "is_playoff": is_playoffs,
                        "home_away": row.get("HomeAway") or None,
                        "opponent_abbr": row.get("Opp") or None,
                        "min_played": row.get("MIN"),
                        "pts": row.get("PTS"),
                        "reb": row.get("REB"),
                        "ast": row.get("AST"),
                        "fg3m": row.get("FG3M"),
                        "blk": row.get("BLK"),
                        "stl": row.get("STL"),
                        "tov": row.get("TOV"),
                        "fgm": row.get("FGM"),
                        "fga": row.get("FGA"),
                        "fg3a": row.get("FG3A"),
                        "ftm": row.get("FTM"),
                        "fta": row.get("FTA"),
                        "oreb": row.get("OREB"),
                        "dreb": row.get("DREB"),
                        "pf": row.get("PF"),
                        "plus_minus": row.get("PLUS_MINUS"),
                        "source": "espn",
                    }
                )
    return records


async def backfill_player_espn(
    session: AsyncSession,
    *,
    full_name: str,
    espn_id: str | None = None,
    n_seasons: int = 3,
) -> dict:
    """Backfill de um jogador via ESPN. Resolve espn_id se não fornecido.

    Retorna sumário {player_id, espn_id, games, last_game_date, status}.
    """
    from app.clients.espn import fetch_player_gamelog, fetch_player_index

    if not espn_id:
        try:
            index = await fetch_player_index()
        except Exception as exc:  # noqa: BLE001
            log.warning("backfill_player_espn: fetch_player_index falhou: %s", exc)
            return {"status": "error", "error": "player_index"}
        espn_id = (index or {}).get(_normalize_name(full_name))
        if not espn_id:
            return {"status": "not_found", "full_name": full_name}

    try:
        raw = await fetch_player_gamelog(espn_id, n_seasons=n_seasons)
    except Exception as exc:  # noqa: BLE001
        log.warning("backfill_player_espn: gamelog falhou (%s): %s", espn_id, exc)
        return {"status": "error", "error": "gamelog", "espn_id": espn_id}
    if not raw:
        return {"status": "not_found", "espn_id": espn_id}

    # Shape multi-season ({"seasons":[{year,data}]}) ou single (seasonTypes no topo)
    season_blobs = raw["seasons"] if isinstance(raw.get("seasons"), list) else [{"data": raw}]
    records: list[dict] = []
    for blob in season_blobs:
        records.extend(espn_raw_to_records(blob.get("data") or {}))

    player = await upsert_player(session, full_name=full_name, espn_id=str(espn_id))
    upserted = await upsert_game_logs(session, player.id, records, source="espn")
    last_gd = max((r["game_date"] for r in records), default=None)
    await update_sync_state(
        session,
        player.id,
        last_game_date=last_gd,
        source="espn",
        seasons_backfilled=n_seasons,
        status="ok",
    )
    await session.commit()
    return {
        "status": "ok",
        "player_id": player.id,
        "espn_id": str(espn_id),
        "games": upserted,
        "last_game_date": last_gd.isoformat() if last_gd else None,
    }


# ---------------------------------------------------------------------------
# Adapter Kaggle — bulk histórico via CSV (dataset nathanlauga/nba-games)
# ---------------------------------------------------------------------------
# Schema esperado (games_details.csv):
#   GAME_ID, TEAM_ID, TEAM_ABBREVIATION, PLAYER_ID, PLAYER_NAME, MIN,
#   FGM, FGA, FG3M, FG3A, FTM, FTA, OREB, DREB, REB, AST, STL, BLK, TO,
#   PF, PTS, PLUS_MINUS
# Cruzado com games.csv para data/temporada/placar:
#   GAME_ID, GAME_DATE_EST, SEASON, HOME_TEAM_ID, VISITOR_TEAM_ID,
#   PTS_home, PTS_away
# O parser é defensivo: colunas ausentes viram None.


def _kaggle_min_to_float(raw: str | None) -> float | None:
    """Converte 'MIN' do Kaggle ('34:12' ou '34.000' ou '34') para minutos float."""
    if raw is None or raw == "":
        return None
    s = str(raw).strip()
    if ":" in s:  # formato MM:SS
        mm, _, ss = s.partition(":")
        try:
            return round(int(mm) + int(ss) / 60.0, 1)
        except ValueError:
            return None
    try:
        return round(float(s), 1)
    except ValueError:
        return None


def parse_kaggle_details(details_path: str, games_path: str | None = None) -> dict[tuple[str, int | None], list[dict]]:
    """Lê games_details.csv (+ games.csv opcional) e agrupa registros por jogador.

    Retorna {(player_name, nba_api_id): [record, ...]}. Não toca no banco —
    a gravação é feita por ingest_kaggle (testável isoladamente).
    """
    import csv

    # Metadados de jogo (data, temporada, placar) por GAME_ID
    games_meta: dict[str, dict] = {}
    if games_path:
        with open(games_path, encoding="utf-8", newline="") as fh:
            for g in csv.DictReader(fh):
                gid = (g.get("GAME_ID") or "").strip()
                if not gid:
                    continue
                games_meta[gid] = g

    grouped: dict[tuple[str, int | None], list[dict]] = {}
    with open(details_path, encoding="utf-8", newline="") as fh:
        for d in csv.DictReader(fh):
            name = (d.get("PLAYER_NAME") or "").strip()
            if not name:
                continue
            if (d.get("MIN") or "").strip() == "":
                continue  # DNP — sem minutos, ignora

            gid = (d.get("GAME_ID") or "").strip()
            meta = games_meta.get(gid, {})

            game_date = _parse_iso_date((meta.get("GAME_DATE_EST") or "")[:10])
            if game_date is None:
                continue

            season_raw = meta.get("SEASON")
            season = season_str_from_date(game_date)
            if season_raw and str(season_raw).isdigit():
                yr = int(season_raw)
                season = f"{yr}-{str(yr + 1)[-2:]}"

            def _i(key: str, src: dict = d) -> int | None:
                v = (src.get(key) or "").strip()
                try:
                    return int(float(v)) if v else None
                except ValueError:
                    return None

            pid = _i("PLAYER_ID")
            rec = {
                "game_id": None,  # GAME_ID do Kaggle != games.id interno; mantém NULL
                "game_date": game_date,
                "season": season,
                "season_type": "Regular Season",
                "is_playoff": False,
                "team_abbr": (d.get("TEAM_ABBREVIATION") or "").strip() or None,
                "min_played": _kaggle_min_to_float(d.get("MIN")),
                "pts": _i("PTS"),
                "reb": _i("REB"),
                "ast": _i("AST"),
                "fg3m": _i("FG3M"),
                "blk": _i("BLK"),
                "stl": _i("STL"),
                "tov": _i("TO"),
                "fgm": _i("FGM"),
                "fga": _i("FGA"),
                "fg3a": _i("FG3A"),
                "ftm": _i("FTM"),
                "fta": _i("FTA"),
                "oreb": _i("OREB"),
                "dreb": _i("DREB"),
                "pf": _i("PF"),
                "plus_minus": _i("PLUS_MINUS"),
                "source": "kaggle",
            }
            grouped.setdefault((name, pid), []).append(rec)

    return grouped


async def ingest_kaggle(
    session: AsyncSession,
    details_path: str,
    games_path: str | None = None,
    *,
    only_active: bool = True,
) -> dict:
    """Ingere o dataset Kaggle no warehouse. Reaproveita o upsert source-agnostic.

    only_active: se True, só grava jogadores que já existem na tabela Player
    (populada pela lista de ativos / pelo backfill ESPN) — evita inflar o DW com
    aposentados. Se False, cria Player para todos os nomes do CSV.
    """
    grouped = parse_kaggle_details(details_path, games_path)
    players_ingested = 0
    games_ingested = 0

    for (name, nba_id), records in grouped.items():
        if only_active:
            norm = _normalize_name(name)
            existing = await session.scalar(select(Player.id).where(Player.normalized_name == norm).limit(1))
            if existing is None:
                continue

        player = await upsert_player(session, full_name=name, nba_api_id=nba_id)
        n = await upsert_game_logs(session, player.id, records, source="kaggle")
        last_gd = max((r["game_date"] for r in records), default=None)
        await update_sync_state(session, player.id, last_game_date=last_gd, source="kaggle", status="ok")
        players_ingested += 1
        games_ingested += n

    await session.commit()
    return {"status": "ok", "players": players_ingested, "games": games_ingested}
