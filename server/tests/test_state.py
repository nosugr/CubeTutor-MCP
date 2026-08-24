import pytest

from core.state import SOLVED, apply_move


def test_r_then_r_prime_returns_solved():
    after_r = apply_move(SOLVED, "R")
    assert after_r != SOLVED
    assert apply_move(after_r, "R'") == SOLVED


def test_r2_twice_returns_solved():
    after = apply_move(SOLVED, "R2")
    assert after != SOLVED
    assert apply_move(after, "R2") == SOLVED


def test_invalid_length_raises():
    with pytest.raises(ValueError):
        apply_move("UUU", "R")
