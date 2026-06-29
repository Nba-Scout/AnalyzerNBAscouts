"""Cascata de minutos — projeção de minutos ajustados por lesões.

Extraído de _compute_freed_minutes (scout.py) e da cascata de minutos
em estimate_true_probability (ev.py). Sem I/O direto.
"""

from __future__ import annotations

import logging

log = logging.getLogger(__name__)

__all__ = ["compute_freed_minutes", "compute_projected_minutes"]


def compute_freed_minutes(injuries: list[dict], player_stats_cache: dict) -> float:
    """Soma os minutos médios dos jogadores 'Out'/'Doubtful' do time.

    Parâmetros
    ----------
    injuries:
        Lista de dicts com ``"player_id"`` e ``"status"``.
        Apenas ``"Out"`` e ``"Doubtful"`` liberam minutos.
    player_stats_cache:
        Dict ``{player_id: {"minutes_avg": float, ...}}`` ou
        dict ``{player_id: player_name}`` (roster simples).
        Também aceita ``"minutes_avg"`` injetado diretamente no dict de injury.

    Retorna float >= 0.0.
    """
    freed: float = 0.0
    for inj in injuries:
        if not isinstance(inj, dict):
            continue
        status = inj.get("status", "")
        if status not in ("Out", "Doubtful"):
            continue

        player_id = inj.get("player_id", "")

        # 1) Tenta no cache por player_id
        avg_min = 0.0
        cache_entry = player_stats_cache.get(player_id) if player_id else None
        if isinstance(cache_entry, dict):
            try:
                avg_min = float(cache_entry.get("minutes_avg", 0.0))
            except (TypeError, ValueError):
                avg_min = 0.0
        elif isinstance(cache_entry, (int, float)):
            avg_min = float(cache_entry)

        # 2) Fallback: "minutes_avg" diretamente no dict de injury
        if avg_min == 0.0:
            try:
                avg_min = float(inj.get("minutes_avg", 0.0))
            except (TypeError, ValueError):
                avg_min = 0.0

        if avg_min > 0:
            freed += avg_min
            log.debug(
                "compute_freed_minutes: %s (%s) libera %.1f min",
                inj.get("player") or player_id or "?",
                status,
                avg_min,
            )

    return freed


def compute_projected_minutes(
    minutes_avg,
    freed_minutes: float = 0.0,
) -> float:
    """Projeta os minutos do jogador considerando desfalques do time.

    Aceita duas formas:
      compute_projected_minutes(30.0, freed_minutes=10.0)    # float direto
      compute_projected_minutes(player_stats_dict, 10.0)     # dict com "minutes_avg"

    Se freed_minutes > 0: projected = min(avg + freed*0.3, avg*1.15)
    Senao: retorna avg. Clamp: max(0.0, min(result, 48.0)).
    """
    avg: float = 0.0
    try:
        avg = float(minutes_avg.get("minutes_avg", 0.0)) if isinstance(minutes_avg, dict) else float(minutes_avg)
    except (TypeError, ValueError):
        avg = 0.0

    if avg <= 0.0:
        return 0.0

    try:
        freed_minutes = float(freed_minutes)
    except (TypeError, ValueError):
        freed_minutes = 0.0

    if freed_minutes > 0.0:
        # Absorve 30% dos minutos liberados, cap de +15%
        projected = min(avg + freed_minutes * 0.3, avg * 1.15)
        log.debug(
            "compute_projected_minutes: avg=%.1f freed=%.1f -> projected=%.1f",
            avg,
            freed_minutes,
            projected,
        )
    else:
        projected = avg

    # Clamp: nunca negativo, nunca acima de 48 min de jogo
    return max(0.0, min(projected, 48.0))
