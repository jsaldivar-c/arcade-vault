"use client";

import { useEffect, useRef } from "react";
import { createArkanoidGame } from "@/lib/games/arkanoid/engine";
import type { GameHandle } from "@/lib/games/engine";

const SPRITESHEET_URL = "/games/arkanoid/spritesheet-breakout.png";

export function ArkanoidCanvas({
  paused,
  restartKey,
  onStateChange,
  onGameOver,
}: {
  paused: boolean;
  restartKey: number;
  onStateChange: (state: {
    score: number;
    lives: number;
    level: number;
  }) => void;
  onGameOver: (finalScore: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stale = false;
    const image = new Image();
    image.onload = () => {
      if (stale) return;
      const handle = createArkanoidGame(canvas, { onStateChange, onGameOver });
      handle.setPaused(pausedRef.current);
      handleRef.current = handle;
    };
    image.src = SPRITESHEET_URL;

    return () => {
      stale = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  useEffect(() => {
    pausedRef.current = paused;
    handleRef.current?.setPaused(paused);
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
