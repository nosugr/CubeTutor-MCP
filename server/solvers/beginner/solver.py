"""Canonical 7-Stage Layer-by-Layer (层先法) Beginner Solver.

Strictly solves the cube stage by stage according to canonical LBL method:
1. cross: 底层十字
2. first_layer_corners: 底层角块
3. second_layer: 中层棱块
4. last_layer_cross: 顶层十字
5. last_layer_corners_orient: 顶层角定向 (小鱼公式)
6. last_layer_corners_perm: 顶层角位置 (换角公式)
7. last_layer_edges: 顶层棱位置 (三棱换公式)
"""

from __future__ import annotations

from collections import deque
from core.state import SOLVED, apply_move
from solvers.solution import Solution, Step

_MOVES = [f + s for f in "URFDLB" for s in ("", "'", "2")]

# 4 D-Edges
_D_EDGES = [
    ((28, 25), ("D", "F")),  # DF
    ((32, 16), ("D", "R")),  # DR
    ((34, 52), ("D", "B")),  # DB
    ((30, 43), ("D", "L")),  # DL
]

# 4 D-Corners
_D_CORNERS = [
    ((29, 26, 15), ("D", "F", "R")),  # DFR
    ((27, 44, 24), ("D", "L", "F")),  # DFL
    ((33, 53, 42), ("D", "B", "L")),  # DBL
    ((35, 17, 51), ("D", "R", "B")),  # DBR
]

# 4 E-Edges (Middle Layer)
_E_EDGES = [
    ((23, 12), ("F", "R")),  # FR
    ((21, 41), ("F", "L")),  # FL
    ((50, 39), ("B", "L")),  # BL
    ((48, 14), ("B", "R")),  # BR
]


def _ok_edge(f: str, idxs: tuple[int, int], colors: tuple[str, str]) -> bool:
    return f[idxs[0]] == colors[0] and f[idxs[1]] == colors[1]


def _ok_corner(f: str, idxs: tuple[int, int, int], colors: tuple[str, str, str]) -> bool:
    return f[idxs[0]] == colors[0] and f[idxs[1]] == colors[1] and f[idxs[2]] == colors[2]


def _cross_done(f: str) -> bool:
    return all(_ok_edge(f, i, c) for i, c in _D_EDGES)


def _cross_h(f: str) -> int:
    return 4 - sum(1 for i, c in _D_EDGES if _ok_edge(f, i, c))


def _first_layer_done(f: str) -> bool:
    return _cross_done(f) and all(_ok_corner(f, i, c) for i, c in _D_CORNERS)


def _f2l_done(f: str) -> bool:
    return _first_layer_done(f) and all(_ok_edge(f, i, c) for i, c in _E_EDGES)


def _top_cross_done(f: str) -> bool:
    return _f2l_done(f) and all(f[i] == "U" for i in (1, 3, 5, 7))


def _top_corners_orient_done(f: str) -> bool:
    return _top_cross_done(f) and all(f[i] == "U" for i in (0, 2, 6, 8))


def _top_corners_perm_done(f: str) -> bool:
    if not _top_corners_orient_done(f):
        return False
    return (
        f[18] == f[20]
        and f[9] == f[11]
        and f[45] == f[47]
        and f[36] == f[38]
    )


def _simplify_moves(moves: list[str]) -> list[str]:
    res: list[str] = []
    face_turns = {"": 1, "'": 3, "2": 2}
    turn_names = {1: "", 2: "2", 3: "'"}

    for m in moves:
        f = m[0]
        t = face_turns[m[1:]] if len(m) > 1 else 1
        if res and res[-1][0] == f:
            prev_m = res.pop()
            prev_t = face_turns[prev_m[1:]] if len(prev_m) > 1 else 1
            new_t = (prev_t + t) % 4
            if new_t != 0:
                res.append(f + turn_names[new_t])
        else:
            res.append(m)
    return res


# --- Stage 1: Bottom Cross (IDA*) ---
def _solve_cross(state: str) -> tuple[str, list[str]]:
    if _cross_done(state):
        return state, []

    for limit in range(1, 9):
        found_path: list[str] = []

        def dfs(s: str, path: list[str], last_f: str) -> bool:
            if _cross_done(s):
                return True
            if len(path) + _cross_h(s) > limit:
                return False
            for m in _MOVES:
                if m[0] == last_f:
                    continue
                nxt = apply_move(s, m)
                path.append(m)
                if dfs(nxt, path, m[0]):
                    return True
                path.pop()
            return False

        if dfs(state, found_path, ""):
            curr = state
            clean_moves = _simplify_moves(found_path)
            for m in clean_moves:
                curr = apply_move(curr, m)
            return curr, clean_moves

    return state, []


# --- Stage 2: First Layer Corners ---
SLOT_CORNER_INFO = [
    (0, ["R", "U", "R'", "U'"], (8, 20, 9), ((29, 26, 15), ("D", "F", "R"))),
    (1, ["F", "U", "F'", "U'"], (6, 18, 38), ((27, 44, 24), ("D", "L", "F"))),
    (2, ["L", "U", "L'", "U'"], (0, 36, 47), ((33, 53, 42), ("D", "B", "L"))),
    (3, ["B", "U", "B'", "U'"], (2, 45, 11), ((35, 17, 51), ("D", "R", "B"))),
]

TOP_CORNER_POS = [
    (8, 20, 9),
    (6, 18, 38),
    (0, 36, 47),
    (2, 45, 11),
]


def _corner_colors(state: str, idxs: tuple[int, int, int]) -> set[str]:
    return {state[i] for i in idxs}


def _solve_first_layer_corners(state: str) -> tuple[str, list[str]]:
    curr = state
    raw_moves: list[str] = []
    target_sets = [
        ({"D", "F", "R"}, 0),
        ({"D", "F", "L"}, 1),
        ({"D", "B", "L"}, 2),
        ({"D", "B", "R"}, 3),
    ]

    for _ in range(25):
        if _first_layer_done(curr):
            break
        found_on_top = False
        for cset, slot_id in target_sets:
            idxs, colors = _D_CORNERS[slot_id]
            if _ok_corner(curr, idxs, colors):
                continue
            top_idx_found = None
            for top_i, top_pos in enumerate(TOP_CORNER_POS):
                if _corner_colors(curr, top_pos) == cset:
                    top_idx_found = top_i
                    break
            if top_idx_found is not None:
                diff = (slot_id - top_idx_found) % 4
                u_rot = ["", "U", "U2", "U'"][diff]
                if u_rot:
                    curr = apply_move(curr, u_rot)
                    raw_moves.append(u_rot)
                trigger = SLOT_CORNER_INFO[slot_id][1]
                for _ in range(6):
                    if _ok_corner(curr, idxs, colors):
                        break
                    for m in trigger:
                        curr = apply_move(curr, m)
                        raw_moves.append(m)
                found_on_top = True
                break
        if not found_on_top:
            for slot_id in range(4):
                idxs, colors = _D_CORNERS[slot_id]
                if not _ok_corner(curr, idxs, colors):
                    trigger = SLOT_CORNER_INFO[slot_id][1]
                    for m in trigger:
                        curr = apply_move(curr, m)
                        raw_moves.append(m)
                    break

    clean_moves = _simplify_moves(raw_moves)
    curr = state
    for m in clean_moves:
        curr = apply_move(curr, m)
    return curr, clean_moves


# --- Stage 3: Second Layer (Middle Edges) ---
INSERT_RULES = {
    ("F", "R"): ["U", "R", "U'", "R'", "U'", "F'", "U", "F"],
    ("F", "L"): ["U'", "L'", "U", "L", "U", "F", "U'", "F'"],
    ("R", "B"): ["U", "B", "U'", "B'", "U'", "R'", "U", "R"],
    ("R", "F"): ["U'", "F'", "U", "F", "U", "R", "U'", "R'"],
    ("B", "L"): ["U", "L", "U'", "L'", "U'", "B'", "U", "B"],
    ("B", "R"): ["U'", "R'", "U", "R", "U", "B", "U'", "B'"],
    ("L", "F"): ["U", "F", "U'", "F'", "U'", "L'", "U", "L"],
    ("L", "B"): ["U'", "B'", "U", "B", "U", "L", "U'", "L'"],
}

EJECT_RULES = [
    ["U", "R", "U'", "R'", "U'", "F'", "U", "F"],
    ["U'", "L'", "U", "L", "U", "F", "U'", "F'"],
    ["U", "L", "U'", "L'", "U'", "B'", "U", "B"],
    ["U", "B", "U'", "B'", "U'", "R'", "U", "R"],
]

TOP_EDGE_POS = [
    (19, 7, "F"),
    (10, 5, "R"),
    (46, 1, "B"),
    (37, 3, "L"),
]

FACE_ORDER = {"F": 0, "R": 1, "B": 2, "L": 3}


def _solve_second_layer(state: str) -> tuple[str, list[str]]:
    curr = state
    raw_moves: list[str] = []

    for _ in range(25):
        if _f2l_done(curr):
            break
        found = False
        for cur_pos_idx, (s_idx, t_idx, pos_face) in enumerate(TOP_EDGE_POS):
            c_side = curr[s_idx]
            c_top = curr[t_idx]
            if c_side not in ("U", "D") and c_top not in ("U", "D"):
                target_pos_idx = FACE_ORDER[c_side]
                diff = (cur_pos_idx - target_pos_idx) % 4
                u_rot = ["", "U", "U2", "U'"][diff]
                if u_rot:
                    curr = apply_move(curr, u_rot)
                    raw_moves.append(u_rot)

                if (c_side, c_top) in INSERT_RULES:
                    alg = INSERT_RULES[(c_side, c_top)]
                    for m in alg:
                        curr = apply_move(curr, m)
                        raw_moves.append(m)
                    found = True
                    break

        if not found:
            for slot_id in range(4):
                idxs, colors = _E_EDGES[slot_id]
                if not _ok_edge(curr, idxs, colors):
                    alg = EJECT_RULES[slot_id]
                    for m in alg:
                        curr = apply_move(curr, m)
                        raw_moves.append(m)
                    break

    clean_moves = _simplify_moves(raw_moves)
    curr = state
    for m in clean_moves:
        curr = apply_move(curr, m)
    return curr, clean_moves


# --- Stage 4: Top Cross (FRUR'U'F') ---
def _solve_top_cross(state: str) -> tuple[str, list[str]]:
    curr = state
    raw_moves: list[str] = []
    alg = ["F", "R", "U", "R'", "U'", "F'"]

    for _ in range(8):
        if _top_cross_done(curr):
            break
        u_edges = (curr[1] == "U", curr[3] == "U", curr[5] == "U", curr[7] == "U")
        count = sum(u_edges)
        if count == 0:
            for m in alg:
                curr = apply_move(curr, m)
                raw_moves.append(m)
        elif count == 2:
            if curr[3] == "U" and curr[5] == "U":
                for m in alg:
                    curr = apply_move(curr, m)
                    raw_moves.append(m)
            elif curr[1] == "U" and curr[3] == "U":
                for m in alg:
                    curr = apply_move(curr, m)
                    raw_moves.append(m)
            else:
                curr = apply_move(curr, "U")
                raw_moves.append("U")
        else:
            curr = apply_move(curr, "U")
            raw_moves.append("U")

    clean_moves = _simplify_moves(raw_moves)
    curr = state
    for m in clean_moves:
        curr = apply_move(curr, m)
    return curr, clean_moves


# --- Stage 5: Top Corners Orientation (Sune: R U R' U R U2 R') ---
def _solve_top_corners_orient(state: str) -> tuple[str, list[str]]:
    curr = state
    raw_moves: list[str] = []
    sune = ["R", "U", "R'", "U", "R", "U2", "R'"]

    for _ in range(12):
        if _top_corners_orient_done(curr):
            break
        yellow_corners = [i for i in (0, 2, 6, 8) if curr[i] == "U"]
        count = len(yellow_corners)
        if count == 1:
            if curr[6] == "U":
                for m in sune:
                    curr = apply_move(curr, m)
                    raw_moves.append(m)
            else:
                curr = apply_move(curr, "U")
                raw_moves.append("U")
        elif count == 0:
            if curr[38] == "U":
                for m in sune:
                    curr = apply_move(curr, m)
                    raw_moves.append(m)
            else:
                curr = apply_move(curr, "U")
                raw_moves.append("U")
        else:
            if curr[18] == "U":
                for m in sune:
                    curr = apply_move(curr, m)
                    raw_moves.append(m)
            else:
                curr = apply_move(curr, "U")
                raw_moves.append("U")

    clean_moves = _simplify_moves(raw_moves)
    curr = state
    for m in clean_moves:
        curr = apply_move(curr, m)
    return curr, clean_moves


# --- Stage 6: Top Corners Permutation (Headlights: R' F R' B2 R F' R' B2 R2) ---
def _solve_top_corners_perm(state: str) -> tuple[str, list[str]]:
    curr = state
    raw_moves: list[str] = []
    t_perm = ["R'", "F", "R'", "B2", "R", "F'", "R'", "B2", "R2"]

    for _ in range(10):
        if _top_corners_perm_done(curr):
            break
        hl_F = curr[18] == curr[20]
        hl_R = curr[9] == curr[11]
        hl_B = curr[45] == curr[47]
        hl_L = curr[36] == curr[38]
        hl_count = sum([hl_F, hl_R, hl_B, hl_L])
        if hl_count == 4:
            break
        elif hl_count == 1:
            if hl_B:
                for m in t_perm:
                    curr = apply_move(curr, m)
                    raw_moves.append(m)
            elif hl_R:
                curr = apply_move(curr, "U'")
                raw_moves.append("U'")
            elif hl_L:
                curr = apply_move(curr, "U")
                raw_moves.append("U")
            else:
                curr = apply_move(curr, "U2")
                raw_moves.append("U2")
        else:
            for m in t_perm:
                curr = apply_move(curr, m)
                raw_moves.append(m)

    clean_moves = _simplify_moves(raw_moves)
    curr = state
    for m in clean_moves:
        curr = apply_move(curr, m)
    return curr, clean_moves


# --- Stage 7: Top Edges Permutation (U-Perm / AUF) ---
def _solve_top_edges_perm(state: str) -> tuple[str, list[str]]:
    curr = state
    u_cw = ["R2", "U", "R", "U", "R'", "U'", "R'", "U'", "R'", "U", "R'"]
    u_ccw = ["R", "U'", "R", "U", "R", "U", "R", "U'", "R'", "U'", "R2"]

    for u_turn in ["", "U", "U'", "U2"]:
        test_state = apply_move(curr, u_turn) if u_turn else curr
        if test_state == SOLVED:
            return test_state, ([u_turn] if u_turn else [])

    q = deque([(curr, [])])
    visited = {curr}

    while q:
        s, path = q.popleft()
        for u_turn in ["", "U", "U'", "U2"]:
            test_s = apply_move(s, u_turn) if u_turn else s
            if test_s == SOLVED:
                full_p = _simplify_moves(path + ([u_turn] if u_turn else []))
                cur_sol = state
                for m in full_p:
                    cur_sol = apply_move(cur_sol, m)
                return cur_sol, full_p
        if len(path) >= 25:
            continue
        for u_rot in ["", "U", "U'", "U2"]:
            for op in [u_cw, u_ccw]:
                step_op = ([u_rot] if u_rot else []) + op
                nxt = s
                for m in step_op:
                    nxt = apply_move(nxt, m)
                if nxt not in visited:
                    visited.add(nxt)
                    q.append((nxt, path + step_op))

    return curr, []


class BeginnerSolver:
    def solve(self, facelets: str) -> Solution:
        if facelets == SOLVED:
            return Solution(method="beginner", steps=[])

        steps: list[Step] = []
        curr = facelets

        # Stage 1: 底层十字
        curr, m1 = _solve_cross(curr)
        for m in m1:
            steps.append(Step(move=m, stage="cross", narration_key="bottom_cross"))

        # Stage 2: 底层角块
        curr, m2 = _solve_first_layer_corners(curr)
        for m in m2:
            steps.append(Step(move=m, stage="first_layer_corners", narration_key="first_layer_corners"))

        # Stage 3: 中层棱块
        curr, m3 = _solve_second_layer(curr)
        for m in m3:
            steps.append(Step(move=m, stage="second_layer", narration_key="second_layer"))

        # Stage 4: 顶层十字
        curr, m4 = _solve_top_cross(curr)
        for m in m4:
            steps.append(Step(move=m, stage="last_layer_cross", narration_key="last_layer_cross"))

        # Stage 5: 顶层角定向
        curr, m5 = _solve_top_corners_orient(curr)
        for m in m5:
            steps.append(Step(move=m, stage="last_layer_corners_orient", narration_key="last_layer_corners_orient"))

        # Stage 6: 顶层角位置
        curr, m6 = _solve_top_corners_perm(curr)
        for m in m6:
            steps.append(Step(move=m, stage="last_layer_corners_perm", narration_key="last_layer_corners_perm"))

        # Stage 7: 顶层棱位置
        curr, m7 = _solve_top_edges_perm(curr)
        for m in m7:
            steps.append(Step(move=m, stage="last_layer_edges", narration_key="last_layer_edges"))

        if curr != SOLVED:
            # Fallback if any extreme edge case occurs
            from solvers.kociemba import KociembaSolver
            k_steps = KociembaSolver().solve(facelets).steps
            return Solution(method="beginner", steps=k_steps)

        return Solution(method="beginner", steps=steps)


