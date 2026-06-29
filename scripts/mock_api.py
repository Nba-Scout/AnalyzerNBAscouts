"""Mock da API NBA Scout p/ visualizar o frontend sem subir backend+DB.

Serve o contrato de 28 campos (/api/props) + /api/player/<nome> com dados de
demonstração, no formato exato de types/api.ts. O dev server do Vite (:5173)
proxia /api para cá (:8000).

Uso: python scripts/mock_api.py   →   abrir http://localhost:5173
"""

import json
import random
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

PORT = 8000

TEAMS = ["DEN", "DAL", "MIL", "BOS", "MIN", "LAL", "PHX", "NYK", "OKC", "CLE"]
MARKETS = ["PTS", "REB", "AST", "FG3M", "BLK", "STL", "PRA", "PR", "PA", "RA", "STOCKS"]
BOOKS = ["pinnacle", "bet365", "draftkings", "fanduel", "betmgm"]
RATINGS = ["STRONG", "VALUE", "NEUTRAL", "AVOID"]


def _last5(line: float, direction: str):
    out = []
    for _ in range(5):
        v = round(line + random.uniform(-6, 7), 1)
        hit = (v > line) if direction == "OVER" else (v < line)
        out.append({"value": v, "hit": bool(hit)})
    return out


def _prop(player, team, opp, market, line, direction, rating, ev, prob):
    odd = round(random.uniform(1.7, 2.2), 2)
    line_opened = round(line + random.choice([0, 0, 0.5, -0.5, 1.0, -1.0]), 1)
    return {
        "player_name": player,
        "team": team,
        "game": f"vs {opp}",
        "market": market,
        "line": line,
        "direction": direction,
        "odd": odd,
        "prob_real": prob,
        "ev_pct": ev,
        "kelly_pct": round(max(0.0, ev / 4), 2),
        "kelly_full_pct": round(max(0.0, ev), 2),
        "rating": rating,
        "bookmaker": random.choice(BOOKS),
        "games_over_line_pct": round(random.uniform(0.3, 0.8), 2),
        "all_odds": [{"bookmaker": b, "odd": round(odd + random.uniform(-0.15, 0.15), 2)} for b in random.sample(BOOKS, 3)],
        "team_injuries": random.choice([[], [], [{"name": "Role Player", "status": "questionable"}]]),
        "dvp_rank": random.randint(1, 30),
        "dvp_total": 30,
        "line_movement": round(line - line_opened, 1),
        "line_opened": line_opened,
        "projected_min": None,
        "min_boost_pct": random.choice([0, 0, 0, 8, 12]),
        "last5_values": _last5(line, direction),
        "avg_stat_last10": round(line + random.uniform(-2, 3), 1),
        "def_rating_opponent": round(random.uniform(106, 118), 1),
        "pace": round(random.uniform(96, 104), 1),
        "implied_prob": round(1 / odd, 4),
        "minutes_avg": round(random.uniform(28, 37), 1),
    }


PLAYERS = [
    ("Nikola Jokić", "DEN", "MIN"),
    ("Luka Dončić", "DAL", "OKC"),
    ("Giannis Antetokounmpo", "MIL", "BOS"),
    ("Jayson Tatum", "BOS", "MIL"),
    ("Anthony Edwards", "MIN", "DEN"),
    ("LeBron James", "LAL", "PHX"),
    ("Shai Gilgeous-Alexander", "OKC", "DAL"),
    ("Jalen Brunson", "NYK", "CLE"),
]


def build_props():
    random.seed(42)
    props = []
    for player, team, opp in PLAYERS:
        for market in random.sample(MARKETS, random.randint(2, 4)):
            base = {"PTS": 26.5, "REB": 9.5, "AST": 7.5, "FG3M": 2.5, "BLK": 1.5, "STL": 1.5,
                    "PRA": 42.5, "PR": 34.5, "PA": 33.5, "RA": 16.5, "STOCKS": 2.5}.get(market, 20.5)
            direction = random.choice(["OVER", "OVER", "UNDER"])
            ev = round(random.uniform(-3, 14), 1)
            rating = "STRONG" if ev >= 8 else "VALUE" if ev >= 3 else "NEUTRAL" if ev >= -1 else "AVOID"
            prob = round(random.uniform(0.5, 0.7), 3)
            props.append(_prop(player, team, opp, market, base, direction, rating, ev, prob))
    props.sort(key=lambda p: -p["ev_pct"])
    return props


PROPS = build_props()


def build_player(name: str):
    random.seed(hash(name) % (2**32))
    team, opp = "DEN", "MIN"
    for p, t, o in PLAYERS:
        if p.lower() == name.lower():
            team, opp = t, o
    games = []
    for i in range(15):
        pts = random.randint(14, 38)
        reb = random.randint(3, 14)
        ast = random.randint(2, 12)
        ha = "home" if i % 2 == 0 else "away"
        ts = random.randint(98, 124)
        os_ = random.randint(95, 122)
        games.append({
            "date": f"05/{28 - i:02d}", "opp": random.choice(TEAMS), "home_away": ha,
            "min": random.randint(28, 39), "pts": pts, "reb": reb, "ast": ast,
            "fg3m": random.randint(0, 6), "blk": random.randint(0, 3), "stl": random.randint(0, 4),
            "is_playoff": i < 4, "margin": ts - os_, "team_score": ts, "opp_score": os_,
        })

    def avg(key):
        return round(sum(g[key] for g in games) / len(games), 1)

    home = [g for g in games if g["home_away"] == "home"]
    away = [g for g in games if g["home_away"] == "away"]

    def savg(lst, k):
        return round(sum(g[k] for g in lst) / len(lst), 1) if lst else 0.0

    return {
        "id": abs(hash(name)) % 99999,
        "name": name,
        "team": {"DEN": "Denver Nuggets", "DAL": "Dallas Mavericks", "MIL": "Milwaukee Bucks",
                 "BOS": "Boston Celtics", "MIN": "Minnesota Timberwolves", "LAL": "Los Angeles Lakers",
                 "OKC": "Oklahoma City Thunder", "NYK": "New York Knicks"}.get(team, "NBA Team"),
        "teamAbbr": team,
        "position": random.choice(["G", "F", "C", "G-F", "F-C"]),
        "height": random.choice(["1.96m", "2.06m", "2.11m", "2.01m"]),
        "age": str(random.randint(22, 33)),
        "home_away_splits": {
            "home_games": len(home), "home_avg_pts": savg(home, "pts"),
            "home_avg_reb": savg(home, "reb"), "home_avg_ast": savg(home, "ast"),
            "away_games": len(away), "away_avg_pts": savg(away, "pts"),
            "away_avg_reb": savg(away, "reb"), "away_avg_ast": savg(away, "ast"),
        },
        "averages": {
            "PTS": avg("pts"), "REB": avg("reb"), "AST": avg("ast"),
            "PRA": round(avg("pts") + avg("reb") + avg("ast"), 1),
            "PR": round(avg("pts") + avg("reb"), 1), "PA": round(avg("pts") + avg("ast"), 1),
            "FG3M": avg("fg3m"), "STOCKS": round(avg("blk") + avg("stl"), 1),
        },
        "spark": [g["pts"] for g in reversed(games)],
        "recent_games": games,
        "playoff_history": {
            "seasons": ["2022-23", "2023-24"], "games_count": 28,
            "avg_pts": round(random.uniform(22, 30), 1), "avg_reb": round(random.uniform(7, 12), 1),
            "avg_ast": round(random.uniform(5, 9), 1),
        },
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/props":
            self._send({
                "props": PROPS,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "from_cache": False,
                "demo_mode": True,
                "quota_remaining": 437,
                "quota_limit": 500,
            })
        elif path.startswith("/api/player/"):
            name = unquote(path[len("/api/player/"):])
            self._send(build_player(name))
        elif path == "/health":
            self._send({"status": "ok"})
        else:
            self._send({"detail": "not found"}, 404)

    def do_POST(self):
        if self.path.split("?")[0] == "/api/refresh":
            self._send({"queued": True, "message": "Análise enfileirada (mock)"})
        else:
            self._send({"detail": "not found"}, 404)

    def log_message(self, *args):
        pass  # silencia o log por request


if __name__ == "__main__":
    print(f"Mock API NBA Scout em http://localhost:{PORT}  ({len(PROPS)} props demo)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
