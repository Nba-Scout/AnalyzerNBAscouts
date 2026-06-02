from __future__ import annotations

from pydantic import BaseModel


class PlayerAverages(BaseModel):
    PTS: float
    REB: float
    AST: float
    PRA: float
    PR: float
    PA: float
    FG3M: float
    STOCKS: float


class RecentGame(BaseModel):
    date: str
    opp: str
    home_away: str
    min: int
    pts: int
    reb: int
    ast: int
    fg3m: int
    blk: int
    stl: int
    is_playoff: bool
    margin: int
    team_score: int
    opp_score: int


class PlayoffHistory(BaseModel):
    seasons: list
    games_count: int
    avg_pts: float
    avg_reb: float
    avg_ast: float


class PlayerDetailOut(BaseModel):
    id: int
    name: str
    team: str
    teamAbbr: str
    position: str
    height: str
    age: str
    home_away_splits: dict
    averages: PlayerAverages
    spark: list[float]
    recent_games: list[RecentGame]
    playoff_history: PlayoffHistory
