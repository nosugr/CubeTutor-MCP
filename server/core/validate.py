"""Validate a 54-facelet cube state (Kociemba layout)."""

from __future__ import annotations

# Corner facelet indices and home colors (order defines orientation 0).
_CORNER_FACELETS = (
    (8, 9, 20),    # URF
    (6, 18, 38),   # UFL
    (0, 36, 47),   # ULB
    (2, 45, 11),   # UBR
    (29, 26, 15),  # DFR
    (27, 44, 24),  # DLF
    (33, 53, 42),  # DBL
    (35, 17, 51),  # DRB
)
_CORNER_COLORS = (
    ("U", "R", "F"),
    ("U", "F", "L"),
    ("U", "L", "B"),
    ("U", "B", "R"),
    ("D", "F", "R"),
    ("D", "L", "F"),
    ("D", "B", "L"),
    ("D", "R", "B"),
)

# Edge facelet indices and home colors.
_EDGE_FACELETS = (
    (5, 10),   # UR
    (7, 19),   # UF
    (3, 37),   # UL
    (1, 46),   # UB
    (32, 16),  # DR
    (28, 25),  # DF
    (30, 43),  # DL
    (34, 52),  # DB
    (23, 12),  # FR
    (21, 41),  # FL
    (50, 39),  # BL
    (48, 14),  # BR
)
_EDGE_COLORS = (
    ("U", "R"),
    ("U", "F"),
    ("U", "L"),
    ("U", "B"),
    ("D", "R"),
    ("D", "F"),
    ("D", "L"),
    ("D", "B"),
    ("F", "R"),
    ("F", "L"),
    ("B", "L"),
    ("B", "R"),
)


def _perm_parity(perm: list[int]) -> int:
    """Return 0 even / 1 odd."""
    seen = [False] * len(perm)
    odd = 0
    for i in range(len(perm)):
        if seen[i]:
            continue
        length = 0
        j = i
        while not seen[j]:
            seen[j] = True
            j = perm[j]
            length += 1
        if length > 0:
            odd ^= (length - 1) & 1
    return odd


def validate_state(facelets: str) -> tuple[bool, str | None]:
    """Return (ok, reason_code). reason_code is None when ok."""
    if len(facelets) != 54:
        return False, "length"

    for color in "URFDLB":
        if facelets.count(color) != 9:
            return False, "color_count"

    # Centers are fixed on a real cube and define face orientation.
    if [facelets[i] for i in (4, 13, 22, 31, 40, 49)] != list("URFDLB"):
        return False, "centers"

    # --- corners ---
    cp = [-1] * 8
    co = [0] * 8
    for pos in range(8):
        fac = [facelets[i] for i in _CORNER_FACELETS[pos]]
        # orientation: which of the 3 facelets carries U or D
        ori = next((k for k in range(3) if fac[k] in ("U", "D")), None)
        if ori is None:
            return False, "corner_cubie"
        col0, col1 = fac[ori], fac[(ori + 1) % 3]
        for cubie, colors in enumerate(_CORNER_COLORS):
            if colors[0] == col0 and colors[1] == col1:
                cp[pos] = cubie
                co[pos] = ori
                break
        else:
            return False, "corner_cubie"
    if sorted(cp) != list(range(8)):
        return False, "corner_cubie"
    if sum(co) % 3 != 0:
        return False, "corner_orientation"

    # --- edges ---
    ep = [-1] * 12
    eo = [0] * 12
    for pos in range(12):
        fac = [facelets[i] for i in _EDGE_FACELETS[pos]]
        for cubie, colors in enumerate(_EDGE_COLORS):
            if fac[0] == colors[0] and fac[1] == colors[1]:
                ep[pos] = cubie
                eo[pos] = 0
                break
            if fac[0] == colors[1] and fac[1] == colors[0]:
                ep[pos] = cubie
                eo[pos] = 1
                break
        else:
            return False, "edge_cubie"
    if sorted(ep) != list(range(12)):
        return False, "edge_cubie"
    if sum(eo) % 2 != 0:
        return False, "edge_orientation"

    if _perm_parity(cp) != _perm_parity(ep):
        return False, "permutation_parity"

    return True, None
