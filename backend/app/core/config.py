from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- API keys ---
    odds_api_key: str = ""
    sentry_dsn: str = ""

    # --- PostgreSQL ---
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "nba_scout"
    postgres_password: str = "changeme"
    postgres_db: str = "nba_scout"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        # Usado pelo Alembic (run_sync)
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # --- Redis / ARQ ---
    redis_url: str = "redis://localhost:6379/0"
    arq_redis_url: str = ""  # usa redis_url se vazio

    # --- Odds API ---
    odds_api_base: str = "https://api.the-odds-api.com/v4"
    sport: str = "basketball_nba"
    regions: str = "us"
    markets: str = (
        "player_points,player_rebounds,player_assists,player_threes,"
        "player_blocks,player_steals,"
        "player_points_rebounds_assists,player_points_rebounds,"
        "player_points_assists,player_rebounds_assists,player_blocks_steals"
    )
    bookmaker_priority: list[str] = ["draftkings", "fanduel", "bet365", "betfair", "pinnacle", "betonlineag"]

    # --- Análise / modelo ---
    min_ev_percent: float = 3.0
    min_confidence: float = 0.55
    lookback_games: int = 20
    regular_season_skip_tail: int = 8
    min_minutes_fraction: float = 0.80
    playoff_hist_min_games: int = 5
    decay_factor: float = 0.9
    recent_weight: float = 0.60
    season_avg_weight: float = 0.40
    league_avg_def_rating: float = 112.0
    league_avg_pace: float = 100.0

    # --- nba_api ---
    nba_api_timeout: int = 30
    nba_season: str = ""
    https_proxy: str = ""
    http_proxy: str = ""

    # --- Data warehouse ---
    warehouse_seasons: int = 10  # temporadas históricas a manter
    lazy_refresh_stale_hours: int = 6  # horas antes de disparar lazy-refresh

    # --- App ---
    log_level: str = "INFO"
    environment: str = "development"
    # Se True, enfileira uma analise imediata no startup da API.
    # Mantido False por padrao para nao gastar quota da Odds API a cada
    # hot-reload do uvicorn em dev.
    analyze_on_startup: bool = False
    # Hora (UTC) do cron diario do worker. Uma vez por dia por padrao para
    # respeitar a quota de 500 req/mes da Odds API — calibrar conforme uso.
    cron_analysis_hour: int = 15

    @field_validator("nba_season", mode="before")
    @classmethod
    def _default_season(cls, v: str) -> str:
        if v:
            return v
        from datetime import date

        today = date.today()
        start = today.year if today.month >= 10 else today.year - 1
        return f"{start}-{(start + 1) % 100:02d}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
