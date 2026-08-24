"""54-facelet cube state (Kociemba order: U R F D L B)."""

from __future__ import annotations

from core.moves import parse_move

SOLVED = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"

# Each cycle (a b c d) means content at a goes to b, b to c, …
# Basic face turns are clockwise when looking at that face.
_CYCLES: dict[str, tuple[tuple[int, ...], ...]] = {
    "U": (
        (0, 2, 8, 6),
        (1, 5, 7, 3),
        (18, 36, 45, 9),
        (19, 37, 46, 10),
        (20, 38, 47, 11),
    ),
    "R": (
        (9, 11, 17, 15),
        (10, 14, 16, 12),
        (8, 45, 35, 26),
        (5, 48, 32, 23),
        (20, 2, 51, 29),
    ),
    "F": (
        (18, 20, 26, 24),
        (19, 23, 25, 21),
        (6, 9, 29, 44),
        (7, 12, 28, 41),
        (8, 15, 27, 38),
    ),
    "D": (
        (27, 29, 35, 33),
        (28, 32, 34, 30),
        (24, 15, 51, 42),
        (25, 16, 52, 43),
        (26, 17, 53, 44),
    ),
    "L": (
        (36, 38, 44, 42),
        (37, 41, 43, 39),
        (0, 18, 27, 53),
        (3, 21, 30, 50),
        (6, 24, 33, 47),
    ),
    "B": (
        (45, 47, 53, 51),
        (46, 50, 52, 48),
        (2, 36, 33, 17),
        (1, 39, 34, 14),
        (0, 42, 35, 11),
    ),
}


def _apply_cycles(facelets: list[str], cycles: tuple[tuple[int, ...], ...]) -> None:
    for cycle in cycles:
        tmp = facelets[cycle[-1]]
        for i in range(len(cycle) - 1, 0, -1):
            facelets[cycle[i]] = facelets[cycle[i - 1]]
        facelets[cycle[0]] = tmp


def apply_move(facelets: str, move: str) -> str:
    if len(facelets) != 54:
        raise ValueError(f"facelets length must be 54, got {len(facelets)}")
    face, turns = parse_move(move)
    arr = list(facelets)
    cycles = _CYCLES[face]
    for _ in range(turns):
        _apply_cycles(arr, cycles)
    return "".join(arr)
