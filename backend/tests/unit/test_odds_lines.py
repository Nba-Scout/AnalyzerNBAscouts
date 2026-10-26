"""Linha principal por grupo — base do movimento de linha com linhas alternativas."""

from __future__ import annotations

from app.clients.odds import main_lines

G = ("Giannis Antetokounmpo", "player_points", "over")


def test_consensus_line_beats_single_book_ladder():
    # Escada da Bovada (1 casa por degrau) + 28.5 ofertado por 4 casas.
    items = [(G, 24.5 + i, 1.36 + 0.2 * i, 1) for i in range(10) if 24.5 + i != 28.5]
    items.append((G, 28.5, 1.87, 4))
    assert main_lines(items) == {G: (28.5, 1.87)}


def test_tie_on_books_prefers_most_balanced_odd():
    items = [(G, 27.5, 1.55, 2), (G, 28.5, 1.95, 2), (G, 29.5, 2.4, 2)]
    assert main_lines(items)[G] == (28.5, 1.95)


def test_groups_are_independent():
    under = ("Giannis Antetokounmpo", "player_points", "under")
    reb = ("Giannis Antetokounmpo", "player_rebounds", "over")
    items = [(G, 28.5, 1.87, 3), (under, 28.5, 1.9, 3), (reb, 10.5, 1.8, 2)]
    assert main_lines(items) == {G: (28.5, 1.87), under: (28.5, 1.9), reb: (10.5, 1.8)}
