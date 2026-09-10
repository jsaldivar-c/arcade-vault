"use client";

import { useEffect, useRef } from "react";
import { createFroggerGame } from "@/lib/games/frogger/engine";
import type { GameHandle } from "@/lib/games/engine";

export function FroggerCanvas({
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handle = createFroggerGame(canvas, { onStateChange, onGameOver });
    handleRef.current = handle;

    return () => {
      handle.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  useEffect(() => {
    handleRef.current?.setPaused(paused);
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{
        position: "absolute",
        inset: 0,
        margin: "auto",
        width: "92%",
        height: "92%",
      }}
    />
  );
}
