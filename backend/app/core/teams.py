"""Mapeamento de times NBA + helpers de normalização."""

from __future__ import annotations

TEAM_NAME_MAP: dict[str, list[str]] = {
    "Atlanta Hawks": ["Hawks", "ATL"],
    "Boston Celtics": ["Celtics", "BOS"],
    "Brooklyn Nets": ["Nets", "BKN", "BRK"],
    "Charlotte Hornets": ["Hornets", "CHA", "CHO"],
    "Chicago Bulls": ["Bulls", "CHI"],
    "Cleveland Cavaliers": ["Cavaliers", "Cavs", "CLE"],
    "Dallas Mavericks": ["Mavericks", "Mavs", "DAL"],
    "Denver Nuggets": ["Nuggets", "DEN"],
    "Detroit Pistons": ["Pistons", "DET"],
    "Golden State Warriors": ["Warriors", "GSW", "Golden State"],
    "Houston Rockets": ["Rockets", "HOU"],
    "Indiana Pacers": ["Pacers", "IND"],
    "LA Clippers": ["Clippers", "LAC", "Los Angeles Clippers"],
    "Los Angeles Lakers": ["Lakers", "LAL", "LA Lakers"],
    "Memphis Grizzlies": ["Grizzlies", "MEM"],
    "Miami Heat": ["Heat", "MIA"],
    "Milwaukee Bucks": ["Bucks", "MIL"],
    "Minnesota Timberwolves": ["Timberwolves", "Wolves", "MIN"],
    "New Orleans Pelicans": ["Pelicans", "NOP", "NO"],
    "New York Knicks": ["Knicks", "NYK"],
    "Oklahoma City Thunder": ["Thunder", "OKC"],
    "Orlando Magic": ["Magic", "ORL"],
    "Philadelphia 76ers": ["76ers", "Sixers", "PHI"],
    "Phoenix Suns": ["Suns", "PHX", "PHO"],
    "Portland Trail Blazers": ["Trail Blazers", "Blazers", "POR"],
    "Sacramento Kings": ["Kings", "SAC"],
    "San Antonio Spurs": ["Spurs", "SAS", "SA"],
    "Toronto Raptors": ["Raptors", "TOR"],
    "Utah Jazz": ["Jazz", "UTA"],
    "Washington Wizards": ["Wizards", "WAS", "WSH"],
}


def normalize(name: str) -> str:
    return "".join(c.lower() for c in name if c.isalnum())


# Índice pré-construído: nome normalizado → nome canônico
_INDEX: dict[str, str] = {}

for _canonical, _aliases in TEAM_NAME_MAP.items():
    _INDEX[normalize(_canonical)] = _canonical
    for _a in _aliases:
        _INDEX[normalize(_a)] = _canonical


def canonical_team_name(name: str) -> str:
    norm = normalize(name)
    if norm in _INDEX:
        return _INDEX[norm]
    for key, canonical in _INDEX.items():
        if norm and (norm in key or key in norm):
            return canonical
    return name


def team_abbr(name: str) -> str:
    canonical = canonical_team_name(name)
    for a in TEAM_NAME_MAP.get(canonical, []):
        if len(a) == 3 and a.isupper():
            return a
    return canonical[:3].upper() if canonical else ""
