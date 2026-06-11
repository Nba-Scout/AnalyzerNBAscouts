"""Chaves Redis com prefixo de versão para invalidação em massa."""

from __future__ import annotations

_V = "v1"


def player_index() -> str:
    return f"{_V}:espn:player_index"


def player_stats(player_id: int | str) -> str:
    return f"{_V}:espn:player_stats:{player_id}"


def team_injuries(team_abbr: str) -> str:
    return f"{_V}:espn:injuries:{team_abbr.upper()}"


def team_roster(team_abbr: str) -> str:
    return f"{_V}:espn:roster:{team_abbr.upper()}"


def playoff_history(player_id: int | str, year: int | str) -> str:
    return f"{_V}:espn:po_hist:{player_id}:{year}"


def matchup_defense(team_id: int | str) -> str:
    return f"{_V}:espn:matchup:{team_id}"


def latest_snapshot() -> str:
    return f"{_V}:app:latest_snapshot"


def odds_quota_remaining() -> str:
    return f"{_V}:odds:quota:remaining"


def refresh_lock() -> str:
    return f"{_V}:app:refresh_lock"


def analysis_status() -> str:
    return f"{_V}:app:analysis_status"
