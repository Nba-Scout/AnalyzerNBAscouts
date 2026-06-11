"""Schema de saída para props — contrato com o frontend (espelha _format_entry)."""

from __future__ import annotations

from pydantic import BaseModel


class PropOut(BaseModel):
    player_name: str
    team: str
    game: str
    market: str
    line: float
    direction: str
    odd: float
    prob_real: float
    ev_pct: float
    kelly_pct: float
    kelly_full_pct: float
    rating: str
    bookmaker: str
    games_over_line_pct: float
    all_odds: list
    team_injuries: list
    dvp_rank: int
    dvp_total: int
    line_movement: float
    line_opened: float
    projected_min: float | None
    min_boost_pct: float
    last5_values: list
    avg_stat_last10: float
    def_rating_opponent: float
    pace: float
    implied_prob: float
    minutes_avg: float


class PropsResponse(BaseModel):
    props: list[PropOut]
    generated_at: str
    from_cache: bool
    demo_mode: bool
    quota_remaining: int
    quota_limit: int
