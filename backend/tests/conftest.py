"""Fixtures compartilhadas entre os testes."""

from __future__ import annotations

import pathlib
import sys

import pytest

# Garante que backend/ está no sys.path para `import app.*` funcionar
_BACKEND = str(pathlib.Path(__file__).parent.parent)
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)


@pytest.fixture
def neutral_matchup() -> dict:
    return {"def_rating": 112.0, "pace": 100.0}
