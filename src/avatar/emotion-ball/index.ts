import "./rings.js";
import "./emotions.js";
import "./ball.js";
import "./engine.js";

export interface EmotionBallInstance {
  setEmotion(id: string): void;
  handleAIMessage(payload: { emotionId: string; tips?: string } | string): void;
  spin(speed?: number): void;
  burst(count?: number): void;
  bounce(): void;
  setGaze(nx: number, ny: number): void;
  setStyle(opts: { sketch?: number }): void;
  on(event: "change" | "tips" | "error", cb: (data: any) => void): void;
  destroy(): void;
}

export interface EmotionBallCreateOptions {
  emotion?: string;
  shape?: "blob" | "wedge" | "gem";
  color?: string;
  eyeColor?: string;
  eyeScale?: number;
  idle?: boolean;
  autostart?: boolean;
  lite?: boolean;
  fallbackId?: string;
}

export const EmotionBall = {
  create(el: HTMLElement, opts?: EmotionBallCreateOptions): EmotionBallInstance {
    return (window as any).EmotionBall.create(el, opts);
  },
};
