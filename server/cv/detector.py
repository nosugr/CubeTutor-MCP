"""Computer Vision & Cube Detection Core Module."""

from __future__ import annotations

import io
import os
import time
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

# Roboflow / YOLO configuration
ROBOFLOW_API_KEY = os.environ.get("ROBOFLOW_API_KEY", "nJNN9coDC2lKNecMH2t3")
ROBOFLOW_MODEL_ID = os.environ.get("ROBOFLOW_MODEL_ID", "rubik-cube-last/1")
ROBOFLOW_URL = f"https://serverless.roboflow.com/{ROBOFLOW_MODEL_ID}?api_key={ROBOFLOW_API_KEY}"


async def detect_cube_roboflow(image_bytes: bytes) -> tuple[Optional[dict], Optional[str]]:
    """Use Roboflow / YOLO model to detect cube bounding box in image bytes."""
    try:
        files = {"file": ("cube.jpg", image_bytes, "image/jpeg")}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(ROBOFLOW_URL, files=files)
        if resp.status_code != 200:
            snippet = resp.text[:120].replace("\n", " ")
            logger.warning(f"Roboflow API returned {resp.status_code}: {snippet}")
            return None, f"Roboflow {resp.status_code}: {snippet}"
        data = resp.json()
        predictions = data.get("predictions", [])
        if not predictions:
            return None, "未检测到魔方预测结果"

        # Find detection with largest bounding box area
        best = max(predictions, key=lambda p: p.get("width", 0) * p.get("height", 0))
        x = best.get("x", 0)
        y = best.get("y", 0)
        w = best.get("width", 0)
        h = best.get("height", 0)
        conf = best.get("confidence", 0)

        return {
            "x1": int(x - w / 2),
            "y1": int(y - h / 2),
            "x2": int(x + w / 2),
            "y2": int(y + h / 2),
            "confidence": conf,
            "class": best.get("class", "Face"),
        }, None
    except httpx.TimeoutException:
        logger.warning("Roboflow API timeout")
        return None, "Roboflow API 请求超时"
    except Exception as e:
        logger.error(f"Roboflow detection exception: {e}")
        return None, f"检测异常: {e}"


async def debug_detect_roboflow(image_bytes: bytes) -> dict:
    """Debug helper: return raw Roboflow response details."""
    try:
        files = {"file": ("cube.jpg", image_bytes, "image/jpeg")}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(ROBOFLOW_URL, files=files)
        return {
            "status_code": resp.status_code,
            "roboflow_url": ROBOFLOW_URL.replace(ROBOFLOW_API_KEY, "***"),
            "body_preview": resp.text[:500],
        }
    except Exception as e:
        return {"error": str(e)}


def sample_sticker_colors(frame, bbox: dict) -> list[str]:
    """Sample 3x3 sticker grid colors within the detected bounding box, return HEX list."""
    try:
        import cv2
    except ImportError:
        return ["#ffffff"] * 9

    x1, y1 = bbox["x1"], bbox["y1"]
    x2, y2 = bbox["x2"], bbox["y2"]
    w = x2 - x1
    h = y2 - y1
    n = 3
    colors = []

    for row in range(n):
        for col in range(n):
            cx = x1 + (col + 0.5) * w / n
            cy = y1 + (row + 0.5) * h / n
            cell_w = w / n * 0.45
            cell_h = h / n * 0.45

            sx1 = max(0, int(cx - cell_w / 2))
            sy1 = max(0, int(cy - cell_h / 2))
            sx2 = min(frame.shape[1] - 1, int(cx + cell_w / 2))
            sy2 = min(frame.shape[0] - 1, int(cy + cell_h / 2))

            if sx2 <= sx1 or sy2 <= sy1:
                colors.append("#000000")
                continue

            cell = frame[sy1:sy2, sx1:sx2]
            avg_bgr = cv2.mean(cell)[:3]
            b, g, r = [int(v) for v in avg_bgr]
            colors.append(f"#{r:02x}{g:02x}{b:02x}")

    return colors


def classify_sticker_hex(hex_color: str) -> str:
    """Classify HEX color into Rubik cube face letters U/D/F/B/L/R."""
    r = int(hex_color[1:3], 16)
    g = int(hex_color[3:5], 16)
    b = int(hex_color[5:7], 16)

    try:
        import cv2
        import numpy as np
        hsv = cv2.cvtColor(np.uint8([[[b, g, r]]]), cv2.COLOR_BGR2HSV)[0][0]
        h, s, v = int(hsv[0]), int(hsv[1]), int(hsv[2])

        if s < 22 and v > 55:
            return "U"
        if s > 28:
            if h < 10 or h > 170:
                return "R"
            elif h < 25:
                return "L"
            elif h < 45:
                return "D"
            elif h < 75:
                return "F"
            else:
                return "B"
        return "U"
    except ImportError:
        return "U"


def grid_to_face_keys(grid_hex: list[str]) -> list[str]:
    """Convert list of 9 HEX colors to facelet letters (U/D/F/B/L/R)."""
    return [classify_sticker_hex(h) for h in grid_hex]
