"""Funções puras de análise de matchup defensivo.

Extraídas de get_matchup_defense / _compute_dvp_ranks em stats.py (raiz)
e do uso em scout.py. Sem I/O direto — recebem dicts já carregados.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

__all__ = ["compute_matchup", "get_dvp_rank"]

# Defaults espelhados de Settings (league_avg_def_rating / league_avg_pace)
_DEFAULT_DEF_RATING: float = 112.0
_DEFAULT_PACE: float = 100.0
_DEFAULT_DVP_RANK: int = 15
_DEFAULT_DVP_TOTAL: int = 30


def compute_matchup(opp_name_or_stats=None, opp_team_stats: dict | None = None) -> dict:
    """Extrai métricas defensivas do time adversário.

    Aceita duas formas de chamada:
      compute_matchup(stats_dict)               # primeiro arg é o dict
      compute_matchup("LAL", stats_dict)        # primeiro arg é nome/abbr (ignorado)
      compute_matchup(None, None)               # retorna defaults

    Retorna dict com: def_rating, pace, dvp_rank, dvp_total.
    """
    # Resolve qual argumento é o dict de stats
    if isinstance(opp_name_or_stats, dict):
        stats = opp_name_or_stats
    else:
        stats = opp_team_stats

    if not stats:
        log.debug("compute_matchup: stats vazio, usando defaults")
        return {
            "def_rating": _DEFAULT_DEF_RATING,
            "pace":       _DEFAULT_PACE,
            "dvp_rank":   _DEFAULT_DVP_RANK,
            "dvp_total":  _DEFAULT_DVP_TOTAL,
        }

    def_rating = stats.get("def_rating")
    pace       = stats.get("pace")
    dvp_rank   = stats.get("dvp_rank")
    dvp_total  = stats.get("dvp_total")

    # Fallback individual para cada campo ausente/inválido
    try:
        def_rating = float(def_rating) if def_rating is not None else _DEFAULT_DEF_RATING
    except (TypeError, ValueError):
        def_rating = _DEFAULT_DEF_RATING

    try:
        pace = float(pace) if pace is not None else _DEFAULT_PACE
    except (TypeError, ValueError):
        pace = _DEFAULT_PACE

    try:
        dvp_rank = int(dvp_rank) if dvp_rank is not None else _DEFAULT_DVP_RANK
    except (TypeError, ValueError):
        dvp_rank = _DEFAULT_DVP_RANK

    try:
        dvp_total = int(dvp_total) if dvp_total is not None else _DEFAULT_DVP_TOTAL
    except (TypeError, ValueError):
        dvp_total = _DEFAULT_DVP_TOTAL

    return {
        "def_rating": def_rating,
        "pace":       pace,
        "dvp_rank":   dvp_rank,
        "dvp_total":  dvp_total,
    }


def get_dvp_rank(opp_abbr: str, all_teams: dict, stat_key: str = "def_rating") -> tuple[int, int]:
    """Calcula o rank defensivo do adversário para uma estatística específica.

    Rank 1 = pior defesa para aquela stat (mais favorável para o atacante);
    Rank 30 = melhor defesa (menos favorável).

    Parâmetros
    ----------
    opp_abbr:
        Abreviação do time adversário (ex: ``"MIA"``).
    stat_key:
        Chave da estatística para ranquear (ex: ``"avg_pts_allowed"``,
        ``"def_rating"``). Deve ser uma chave numérica presente nos
        dicts de ``all_teams``.
    all_teams:
        Dict ``{team_abbr: {stat_key: float, ...}}`` com dados de todos os
        times — geralmente vindo do cache de team_stats do data warehouse ou
        de stats._team_stats_cache.

    Retorna
    -------
    (rank, total) onde rank 1 é pior defesa e total é o número de times
    ranqueados. Retorna (15, 30) se o time não for encontrado ou os dados
    estiverem incompletos.
    """
    if not all_teams or not opp_abbr:
        log.debug("get_dvp_rank: all_teams vazio ou opp_abbr ausente")
        return (_DEFAULT_DVP_RANK, _DEFAULT_DVP_TOTAL)

    # Coleta (abbr, valor) para times que possuem a chave solicitada
    values: list[tuple[str, float]] = []
    for abbr, team_data in all_teams.items():
        if not isinstance(team_data, dict):
            continue
        raw = team_data.get(stat_key)
        if raw is None:
            continue
        try:
            values.append((str(abbr), float(raw)))
        except (TypeError, ValueError):
            continue

    if not values:
        log.debug(
            "get_dvp_rank: nenhum time possui stat_key=%s em all_teams", stat_key
        )
        return (_DEFAULT_DVP_RANK, _DEFAULT_DVP_TOTAL)

    total = len(values)

    # Ordena descendente: maior valor = pior defesa = rank 1
    # (ex: maior def_rating = concede mais = rank 1 para o atacante)
    values.sort(key=lambda x: x[1], reverse=True)
    rank_map = {abbr: i + 1 for i, (abbr, _) in enumerate(values)}

    # Tenta match exato; depois case-insensitive
    rank = rank_map.get(opp_abbr)
    if rank is None:
        upper = opp_abbr.upper()
        for abbr, r in rank_map.items():
            if abbr.upper() == upper:
                rank = r
                break

    if rank is None:
        log.debug(
            "get_dvp_rank: %s nao encontrado no ranking de %s", opp_abbr, stat_key
        )
        return (_DEFAULT_DVP_RANK, _DEFAULT_DVP_TOTAL)

    return (rank, total)
