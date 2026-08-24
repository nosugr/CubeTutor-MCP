"""
训练 YOLOv8 魔方检测模型

使用方法:
1. 准备数据集：将魔方图片放到 datasets/cube/images/ 下
2. 标注：使用 Roboflow / labelImg 标注，类别为 "cube_face"
3. 运行: python train_cube_model.py

或使用 Roboflow 数据集:
    from roboflow import Roboflow
    rf = Roboflow(api_key="YOUR_API_KEY")
    project = rf.workspace("your-workspace").project("cube-detection")
    dataset = project.version(1).download("yolov8")
"""
import os
from pathlib import Path

# 自动创建数据集目录结构
DATASET_DIR = Path("datasets/cube")
IMAGES_DIR = DATASET_DIR / "images"
LABELS_DIR = DATASET_DIR / "labels"
IMAGES_TRAIN = IMAGES_DIR / "train"
IMAGES_VAL = IMAGES_DIR / "val"
LABELS_TRAIN = LABELS_DIR / "train"
LABELS_VAL = LABELS_DIR / "val"

for d in [IMAGES_TRAIN, IMAGES_VAL, LABELS_TRAIN, LABELS_VAL]:
    d.mkdir(parents=True, exist_ok=True)

# 创建 data.yaml
data_yaml = DATASET_DIR / "data.yaml"
data_yaml.write_text(f"""path: {DATASET_DIR.absolute()}
train: images/train
val: images/val
names:
  0: cube_face
""")

print(f"数据集目录已创建: {DATASET_DIR.absolute()}")
print(f"请将魔方图片放入 {IMAGES_TRAIN} 和 {IMAGES_VAL}")
print(f"标注后 .txt 文件放入 {LABELS_TRAIN} 和 {LABELS_VAL}")
print(f"")
print(f"标注格式 (YOLO): 每行: class_id center_x center_y width height (归一化 0-1)")
print(f"示例: 0 0.5 0.5 0.3 0.3")
print(f"")
print(f"开始训练请运行:")
print(f"  python -c \"from ultralytics import YOLO; m=YOLO('yolov8n.pt'); m.train(data='datasets/cube/data.yaml', epochs=50, imgsz=640)\"")
print(f"")
print(f"训练完成后，将 runs/detect/train/weights/best.pt 复制为 cube_best.pt")
print(f"  cp runs/detect/train/weights/best.pt cube_best.pt")
