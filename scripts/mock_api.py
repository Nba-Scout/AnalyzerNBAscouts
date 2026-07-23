"""Mock da API NBA Scout p/ visualizar o frontend sem subir backend+DB.

Serve o contrato de 28 campos (/api/props) + /api/player/<nome> com dados de
demonstração, no formato exato de types/api.ts. O dev server do Vite (:5173)
proxia /api para cá (:8000).

Uso: python scripts/mock_api.py   →   abrir http://localhost:5173
"""

import json
import random
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

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


_MARKET_KEY = {
    "PTS": "player_points", "REB": "player_rebounds", "AST": "player_assists",
    "FG3M": "player_threes", "BLK": "player_blocks", "STL": "player_steals",
    "PRA": "player_points_rebounds_assists", "PR": "player_points_rebounds",
    "PA": "player_points_assists", "RA": "player_rebounds_assists", "STOCKS": "player_blocks_steals",
}


def _market_key(market: str) -> str:
    return _MARKET_KEY.get(market, market.lower())


def _prop(player, team, opp, market, line, direction, rating, ev, prob):
    odd = round(random.uniform(1.7, 2.2), 2)
    line_opened = round(line + random.choice([0, 0, 0.5, -0.5, 1.0, -1.0]), 1)
    return {
        "player_name": player,
        "team": team,
        "game": f"vs {opp}",
        "market": market,
        "market_key": _market_key(market),
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


def build_line_history(player: str, market_key: str, direction: str):
    """Série sintética estável (por player+market) — movimento intraday da linha."""
    match = next(
        (p for p in PROPS if p["player_name"] == player and p["market_key"] == market_key), None
    )
    base = match["line"] if match else 25.5
    rnd = random.Random(hash((player, market_key)) & 0xFFFFFFFF)
    n = rnd.randint(4, 8)
    day = datetime.now(timezone.utc).replace(hour=9, minute=0, second=0, microsecond=0)
    points = []
    line = round(base + rnd.choice([0, 0, 0.5, -0.5, 1.0]), 1)
    for i in range(n):
        line = round(line + rnd.choice([0, 0, 0.5, -0.5]), 1)
        points.append(
            {
                "captured_at": (day + timedelta(hours=i * 1.5)).isoformat(),
                "line": line,
                "odd": round(rnd.uniform(1.75, 2.1), 2),
            }
        )
    return {"player_name": player, "market": market_key, "direction": direction, "points": points}


# ─── Bet tracker (carteira) — store em memória, espelha o CRUD /api/bets ──────
BETS_LOCK = threading.Lock()


def _seed_bets():
    now = datetime.now(timezone.utc)
    raw = [
        # (player, market, line, dir, odd, stake, result)  result=None → pendente
        ("Nikola Jokić", "PTS", 26.5, "OVER", 1.91, 100, "win"),
        ("Luka Dončić", "PRA", 42.5, "OVER", 1.87, 80, "loss"),
        ("Jayson Tatum", "REB", 8.5, "OVER", 2.05, 60, "win"),
        ("Anthony Edwards", "PTS", 27.5, "UNDER", 1.95, 50, "push"),
        ("Shai Gilgeous-Alexander", "AST", 6.5, "OVER", 1.80, 75, "win"),
        ("LeBron James", "PTS", 25.5, "OVER", 1.90, 100, None),
        ("Giannis Antetokounmpo", "REB", 11.5, "OVER", 1.85, 90, None),
    ]
    bets = []
    for i, (player, market, line, direction, odd, stake, result) in enumerate(raw, start=1):
        added = now - timedelta(days=len(raw) - i + 1)
        bet = {
            "id": i, "player_name": player, "market_key": market, "line": line,
            "direction": direction, "odd_decimal": odd, "ev_pct": round(random.uniform(2, 12), 1),
            "kelly_pct": round(random.uniform(1, 6), 1), "stake": float(stake),
            "status": "pending", "result": None, "profit_loss": None,
            "added_at": added.isoformat(), "settled_at": None,
        }
        if result is not None:
            bet["status"] = result
            bet["result"] = result
            bet["settled_at"] = (added + timedelta(hours=20)).isoformat()
            if result == "win":
                bet["profit_loss"] = round(stake * (odd - 1), 2)
            elif result == "loss":
                bet["profit_loss"] = -float(stake)
            else:
                bet["profit_loss"] = 0.0
        bets.append(bet)
    return bets


BETS = _seed_bets()
BET_SEQ = len(BETS)


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

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode())
        except (ValueError, UnicodeDecodeError):
            return {}

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
        elif path == "/api/bets":
            with BETS_LOCK:
                self._send(sorted(BETS, key=lambda b: b["added_at"], reverse=True))
        elif path.startswith("/api/player/"):
            name = unquote(path[len("/api/player/"):])
            self._send(build_player(name))
        elif path == "/api/line-history":
            q = parse_qs(urlparse(self.path).query)
            player = (q.get("player") or [""])[0]
            market = (q.get("market") or [""])[0]
            direction = (q.get("direction") or ["over"])[0]
            self._send(build_line_history(player, market, direction))
        elif path == "/health":
            self._send({"status": "ok"})
        else:
            self._send({"detail": "not found"}, 404)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/refresh":
            self._send({"queued": True, "message": "Análise enfileirada (mock)"})
        elif path == "/api/bets":
            body = self._read_body()
            global BET_SEQ
            with BETS_LOCK:
                BET_SEQ += 1
                bet = {
                    "id": BET_SEQ,
                    "player_name": body.get("player_name", ""),
                    "market_key": body.get("market_key", ""),
                    "line": float(body.get("line", 0)),
                    "direction": body.get("direction", "OVER"),
                    "odd_decimal": float(body.get("odd_decimal", 0)),
                    "ev_pct": float(body.get("ev_pct", 0)),
                    "kelly_pct": float(body.get("kelly_pct", 0)),
                    "stake": float(body.get("stake", 0)),
                    "status": "pending", "result": None, "profit_loss": None,
                    "added_at": datetime.now(timezone.utc).isoformat(), "settled_at": None,
                }
                BETS.append(bet)
            self._send(bet, 201)
        else:
            self._send({"detail": "not found"}, 404)

    def do_PATCH(self):
        path = self.path.split("?")[0]
        if not path.startswith("/api/bets/"):
            self._send({"detail": "not found"}, 404)
            return
        try:
            bet_id = int(path[len("/api/bets/"):])
        except ValueError:
            self._send({"detail": "id inválido"}, 400)
            return
        result = self._read_body().get("result", "push")
        with BETS_LOCK:
            bet = next((b for b in BETS if b["id"] == bet_id), None)
            if not bet:
                self._send({"detail": "Bet não encontrada"}, 404)
                return
            bet["result"] = result
            bet["status"] = result
            bet["settled_at"] = datetime.now(timezone.utc).isoformat()
            if result == "win":
                bet["profit_loss"] = round(bet["stake"] * (bet["odd_decimal"] - 1), 2)
            elif result == "loss":
                bet["profit_loss"] = -bet["stake"]
            else:
                bet["profit_loss"] = 0.0
            out = dict(bet)
        self._send(out)

    def log_message(self, *args):
        pass  # silencia o log por request


if __name__ == "__main__":
    print(f"Mock API NBA Scout em http://localhost:{PORT}  ({len(PROPS)} props demo)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
