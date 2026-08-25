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


def test_agent_stream_chat_solve():
    # Apply 1 move
    client.post("/api/move", json={"move": "R"})
    r = client.post("/api/agent/stream_chat", json={"message": "帮我用新手层先法还原魔方", "method": "beginner"})
    assert r.status_code == 200
    assert "data: " in r.text
    assert "求解器" in r.text or "start" in r.text


def test_agent_chat_solve():
    client.post("/api/move", json={"move": "R"})
    r = client.post("/api/agent/chat", json={"message": "帮我用新手层先法还原魔方", "method": "beginner"})
    assert r.status_code == 200
    assert "solution" in r.json()
    assert len(r.json()["solution"]["steps"]) > 0

