from core.state import SOLVED
from core.validate import validate_state


def test_solved_ok():
    ok, reason = validate_state(SOLVED)
    assert ok is True
    assert reason is None


def test_corner_swap_illegal():
    # Swap whole URF and UFL cubies on solved cube → odd corner perm.
    arr = list(SOLVED)
    for a, b in ((8, 6), (9, 18), (20, 38)):
        arr[a], arr[b] = arr[b], arr[a]
    ok, reason = validate_state("".join(arr))
    assert ok is False
    assert reason is not None


def test_wrong_color_count():
    arr = list(SOLVED)
    arr[0] = "R"  # 8 U, 10 R
    ok, reason = validate_state("".join(arr))
    assert ok is False
    assert reason == "color_count"


def test_swapped_centers_rejected():
    # Swap U and R centers: color counts stay valid but centers are wrong.
    arr = list(SOLVED)
    arr[4], arr[13] = arr[13], arr[4]
    ok, reason = validate_state("".join(arr))
    assert ok is False
    assert reason == "centers"
