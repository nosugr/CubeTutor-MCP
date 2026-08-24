"""FastAPI app for the workbench frontend."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api import routes_detect, routes_solve, routes_state
from core.session import get_shared_session
from core.state import SOLVED

app = FastAPI(title="CubeTutor")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_state.router)
app.include_router(routes_solve.router)
app.include_router(routes_detect.router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


def reset_session_for_tests(facelets: str = SOLVED) -> None:
    """Test helper to reset the process-global session."""
    get_shared_session().set_state(facelets)


# Serve frontend dist if built
_DIST = Path(__file__).resolve().parents[2] / "dist"
if _DIST.is_dir():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="web")
