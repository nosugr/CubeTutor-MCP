"""Parse Singmaster moves: U/U'/U2 … F/B/L/R/D."""

from __future__ import annotations

_FACES = "URFDLB"
_VALID = {f"{f}{s}" for f in _FACES for s in ("", "'", "2")}


def parse_move(move: str) -> tuple[str, int]:
    """Return (face, quarter_turns_cw) where quarter_turns_cw in {1, 2, 3}."""
    m = move.strip()
    if m not in _VALID:
        raise ValueError(f"invalid move: {move!r}")
    face = m[0]
    suffix = m[1:]
    turns = 1 if suffix == "" else (2 if suffix == "2" else 3)
    return face, turns
