// 计算机视觉魔方录入模块
// 提供：摄像头采集、facelet 索引映射、网格旋转与状态校验
// 贴纸颜色分类统一由后端 /detect 接口完成，前端不做颜色识别
import { COLORS, FACE } from "../cuber/define";

export type FaceKey = "U" | "D" | "F" | "B" | "L" | "R";

export const FACE_KEYS: FaceKey[] = ["U", "R", "F", "D", "L", "B"];

export const FACE_COLORS: Record<FaceKey, string> = {
  U: COLORS.U,
  D: COLORS.D,
  F: COLORS.F,
  B: COLORS.B,
  R: COLORS.R,
  L: COLORS.L,
};

// 根据背景色亮度返回高对比度的前景色（黑或白），避免浅色背景上白字不可见
export function contrastColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  // 相对亮度（sRGB 加权）
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#000" : "#fff";
}

export const FACE_ENUM: Record<FaceKey, FACE> = {
  U: FACE.U,
  D: FACE.D,
  F: FACE.F,
  B: FACE.B,
  L: FACE.L,
  R: FACE.R,
};

export type Region = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const FACELET_INDICES: Record<FaceKey, number[]> = {
  U: [6, 7, 8, 15, 16, 17, 24, 25, 26],
  R: [26, 17, 8, 23, 14, 5, 20, 11, 2],
  F: [24, 25, 26, 21, 22, 23, 18, 19, 20],
  D: [18, 19, 20, 9, 10, 11, 0, 1, 2],
  L: [6, 15, 24, 3, 12, 21, 0, 9, 18],
  B: [8, 7, 6, 5, 4, 3, 2, 1, 0],
};

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: true, audio: false },
  ];
  let lastErr: unknown = null;
  for (const attempt of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(attempt);
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      return stream;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export function stopCamera(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export function identifyFace(grid: FaceKey[]): FaceKey {
  return grid[4];
}

export function rotateGrid(grid: FaceKey[]): FaceKey[] {
  const [a, b, c, d, e, f, g, h, i] = grid;
  return [g, d, a, h, e, b, i, f, c];
}

// 水平翻转 3x3 网格：撤销前置摄像头预览镜像，恢复魔方真实朝向
// [a,b,c,d,e,f,g,h,i] -> [c,b,a,f,e,d,i,h,g]
export function mirrorGrid(grid: FaceKey[]): FaceKey[] {
  const [a, b, c, d, e, f, g, h, i] = grid;
  return [c, b, a, f, e, d, i, h, g];
}

// 每面采集时，应该朝上的面（基于标准 2D 展开图布局）
// 展开图:        U
//             L   F   R   B
//                D
// 采集时按此映射摆放魔方，采集结果可在展开图中手动旋转校正
export const ON_TOP_FACE: Record<FaceKey, FaceKey> = {
  U: "B",
  D: "F",
  F: "U",
  B: "U",
  L: "U",
  R: "U",
};

export const FACE_ORIENTATION_HINTS: Record<FaceKey, string> = {
  U: "白色面正对镜头，蓝色面朝上",
  D: "黄色面正对镜头，绿色面朝上",
  F: "绿色面正对镜头，白色面朝上",
  B: "蓝色面正对镜头，白色面朝上",
  L: "橙色面正对镜头，白色面朝上",
  R: "红色面正对镜头，白色面朝上",
};

export type ValidationResult = { ok: boolean; issues: string[]; counts: Record<string, number> };

export function validateState(faces: Record<FaceKey, FaceKey[] | undefined>): ValidationResult {
  const counts: Record<string, number> = { U: 0, D: 0, F: 0, B: 0, L: 0, R: 0 };
  const issues: string[] = [];
  for (const key of FACE_KEYS) {
    const grid = faces[key];
    if (!grid) {
      issues.push(`${key} 面未录入`);
      continue;
    }
    if (grid[4] !== key) issues.push(`${key} 面中心颜色应为 ${key}（检测到 ${grid[4]}）`);
    for (const c of grid) counts[c] = (counts[c] || 0) + 1;
  }
  for (const key of FACE_KEYS) {
    if (counts[key] !== 9) issues.push(`${key} 色共 ${counts[key]} 个（应为 9）`);
  }
  return { ok: issues.length === 0, issues, counts };
}
