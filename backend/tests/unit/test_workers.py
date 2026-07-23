"""Testes unitários de tasks do worker (sem DB)."""

from __future__ import annotations

import pytest

from app.workers import tasks


@pytest.mark.asyncio
async def test_sync_warehouse_delegates_current_season(monkeypatch):
    """sync_warehouse chama backfill_all_active com n_seasons=1 (só temporada corrente)."""
    captured: dict = {}

    async def fake_backfill_all_active(ctx, n_seasons=3):
        captured["n_seasons"] = n_seasons
        return {"status": "ok", "active": 0, "enqueued": 0}

    monkeypatch.setattr(tasks, "backfill_all_active", fake_backfill_all_active)

    result = await tasks.sync_warehouse({})

    assert captured["n_seasons"] == 1
    assert result["status"] == "ok"
