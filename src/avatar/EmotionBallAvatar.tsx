import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EmotionBall, EmotionBallInstance } from "./emotion-ball";

export interface EmotionBallAvatarRef {
  setEmotion: (id: string) => void;
  burst: (count?: number) => void;
  spin: (speed?: number) => void;
  bounce: () => void;
}

export interface EmotionBallAvatarProps {
  emotion?: string;
  size?: number;
  interactive?: boolean;
  staticMode?: boolean;
  className?: string;
  onClick?: () => void;
  tips?: string;
}

export const EmotionBallAvatar = forwardRef<EmotionBallAvatarRef, EmotionBallAvatarProps>(
  (
    {
      emotion = "02",
      size = 72,
      interactive = true,
      staticMode = false,
      className = "",
      onClick,
      tips,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const ballRef = useRef<EmotionBallInstance | null>(null);

    useImperativeHandle(ref, () => ({
      setEmotion(id: string) {
        ballRef.current?.setEmotion(id);
      },
      burst(count = 24) {
        ballRef.current?.burst(count);
      },
      spin(speed = 3) {
        ballRef.current?.spin(speed);
      },
      bounce() {
        ballRef.current?.bounce();
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;
      const el = containerRef.current;
      el.innerHTML = "";

      const ball = EmotionBall.create(el, {
        emotion,
        shape: "blob", // 球球 (Blob 形态)
        idle: !staticMode,
        autostart: !staticMode,
        eyeScale: 1.2,
      });

      if (staticMode && (ball as any).renderStatic) {
        (ball as any).renderStatic();
      }

      ballRef.current = ball;

      if (interactive && !staticMode) {
        const onMouseMove = (e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) / (window.innerWidth / 2);
          const dy = (e.clientY - cy) / (window.innerHeight / 2);
          ball.setGaze(Math.max(-1, Math.min(1, dx * 1.8)), Math.max(-1, Math.min(1, dy * 1.8)));
        };
        window.addEventListener("pointermove", onMouseMove);
        return () => {
          window.removeEventListener("pointermove", onMouseMove);
          ball.destroy();
          ballRef.current = null;
        };
      }

      return () => {
        ball.destroy();
        ballRef.current = null;
      };
    }, [staticMode]);

    useEffect(() => {
      if (ballRef.current && emotion) {
        if (tips) {
          ballRef.current.handleAIMessage({ emotionId: emotion, tips });
        } else {
          ballRef.current.setEmotion(emotion);
        }
        if (staticMode && (ballRef.current as any).renderStatic) {
          (ballRef.current as any).renderStatic();
        }
      }
    }, [emotion, tips, staticMode]);

    const handleClick = () => {
      if (ballRef.current && !staticMode) {
        ballRef.current.bounce();
      }
      onClick?.();
    };

    return (
      <div
        ref={containerRef}
        className={`emotion-ball-avatar ${className}`}
        style={{ width: size, height: size, cursor: onClick ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
        onClick={handleClick}
        title="CubeTutor 魔方助手"
      />
    );
  }
);
