from fastapi.testclient import TestClient

from api.http_app import app, reset_session_for_tests
from core.state import SOLVED
from core.validate import validate_state


client = TestClient(app)


def setup_function() -> None:
    reset_session_for_tests(SOLVED)


def test_health():
    assert client.get("/api/health").json() == {"ok": True}


def test_set_state_rejects_illegal():
    bad = "R" * 54
    r = client.post("/api/state", json={"facelets": bad})
    assert r.status_code == 400
    assert r.json()["detail"]["ok"] is False


def test_scramble_valid_then_solve():
    r = client.post("/api/scramble", json={"n": 8})
    assert r.status_code == 200
    data = r.json()
    assert validate_state(data["facelets"])[0] is True
    assert len(data["moves"]) == 8
    assert client.get("/api/state").json()["facelets"] == data["facelets"]

    # kociemba handles deeper states; beginner MITM is for short distance
    sol = client.post("/api/solve", json={"method": "kociemba"})
    assert sol.status_code == 200
    body = sol.json()
    assert body["method"] == "kociemba"
    assert isinstance(body["steps"], list)


def test_move():
    r = client.post("/api/move", json={"move": "R"})
    assert r.status_code == 200
    assert r.json()["facelets"] != SOLVED
