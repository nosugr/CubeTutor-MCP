"""FastAPI routes for camera/YOLOv8 cube detection."""

from __future__ import annotations

import io
import time
import logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from cv import (
    detect_cube_roboflow,
    sample_sticker_colors,
    grid_to_face_keys,
    ROBOFLOW_MODEL_ID,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["detect"])


class DetectionResult(BaseModel):
    success: bool
    bbox: Optional[dict] = None
    confidence: Optional[float] = None
    grid: Optional[list] = None
    message: str = ""


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "method": "roboflow",
        "model": ROBOFLOW_MODEL_ID,
    }


@router.post("/detect", response_model=DetectionResult)
async def detect(file: UploadFile = File(...)):
    """Receive camera image frame, detect cube bounding box and return 3x3 facelet grid."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="未上传文件")

    try:
        from PIL import Image
        import numpy as np
        import cv2
        contents = await file.read()
        pil_img = Image.open(io.BytesIO(contents))
        frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except ImportError:
        raise HTTPException(status_code=500, detail="CV dependencies (opencv-python, pillow) not installed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"图片解析失败: {str(e)}")

    h, w = frame.shape[:2]
    if w > 960:
        scale = 960 / w
        frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
        success, encoded = cv2.imencode(".jpg", frame)
        if success:
            contents = encoded.tobytes()

    t0 = time.time()
    bbox_info, err = await detect_cube_roboflow(contents)
    elapsed = (time.time() - t0) * 1000

    if bbox_info is None:
        return DetectionResult(
            success=False,
            message=err or "未检测到魔方，请将魔方一个面正对镜头并靠近",
        )

    grid_hex = sample_sticker_colors(frame, bbox_info)
    grid_keys = grid_to_face_keys(grid_hex)
    confidence = bbox_info.get("confidence", 0.0)

    logger.info(
        f"[roboflow] 检测完成: bbox=({bbox_info['x1']},{bbox_info['y1']})-({bbox_info['x2']},{bbox_info['y2']}) "
        f"conf={confidence:.2f} grid={''.join(grid_keys)} time={elapsed:.0f}ms"
    )

    return DetectionResult(
        success=True,
        bbox={
            "x1": bbox_info["x1"],
            "y1": bbox_info["y1"],
            "x2": bbox_info["x2"],
            "y2": bbox_info["y2"],
            "width": bbox_info["x2"] - bbox_info["x1"],
            "height": bbox_info["y2"] - bbox_info["y1"],
        },
        confidence=round(confidence, 3),
        grid=grid_keys,
        message=f"检测完成 ({elapsed:.0f}ms)",
    )
