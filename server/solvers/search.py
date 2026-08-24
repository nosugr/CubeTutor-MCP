"""Short-scramble meet-in-the-middle search to SOLVED."""

from __future__ import annotations

from collections import deque

from core.state import SOLVED, apply_move

_MOVES = [f + s for f in "URFDLB" for s in ("", "'", "2")]


def invert_move(m: str) -> str:
    if m.endswith("2"):
        return m
    if m.endswith("'"):
        return m[0]
    return m + "'"


def _expand_level(paths: dict[str, list[str]], frontier: list[str]) -> list[str]:
    nxt_frontier: list[str] = []
    for state in frontier:
        path = paths[state]
        last = path[-1][0] if path else None
        for m in _MOVES:
            if m[0] == last:
                continue
            nxt = apply_move(state, m)
            if nxt in paths:
                continue
            paths[nxt] = path + [m]
            nxt_frontier.append(nxt)
    return nxt_frontier


def mitm_to_solved(start: str, max_depth: int = 6) -> list[str]:
    if start == SOLVED:
        return []

    fwd: dict[str, list[str]] = {start: []}
    back: dict[str, list[str]] = {SOLVED: []}
    fwd_front = [start]
    back_front = [SOLVED]

    for _ in range(max_depth):
        fwd_front = _expand_level(fwd, fwd_front)
        hit = set(fwd_front) & back.keys()
        if hit:
            state = next(iter(hit))
            return fwd[state] + [invert_move(m) for m in reversed(back[state])]

        back_front = _expand_level(back, back_front)
        hit = set(back_front) & fwd.keys()
        if hit:
            state = next(iter(hit))
            return fwd[state] + [invert_move(m) for m in reversed(back[state])]

        if not fwd_front and not back_front:
            break

    raise RuntimeError("MITM failed; scramble deeper than search")
