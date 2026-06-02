from __future__ import annotations

from pydantic import BaseModel


class StatusOut(BaseModel):
    is_refreshing: bool
    cached_at: str | None
    next_refresh_in: int | None
    quota_remaining: int
    warehouse_last_sync: str | None


class RefreshOut(BaseModel):
    queued: bool
    message: str
