"use client";

import { useEffect, useRef, useState } from "react";
import { createSnakeGame } from "@/lib/games/snake/engine";
import type { GameHandle } from "@/lib/games/engine";
import { getSkin, setSkin, type SkinId } from "@/lib/games/skins";

const SPRITESHEET_URL = "/games/snake/fruits.png";

const SKIN_OPTIONS: { id: SkinId; label: string }[] = [
  { id: "clasico", label: "CLÁSICO" },
  { id: "neon", label: "NEÓN" },
  { id: "retro", label: "RETRO" },
];

export function SnakeCanvas({
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
  const [skin, setSkinState] = useState<SkinId>(() => getSkin("snake"));
  // Se incrementa cada vez que el jugador cambia de skin. El motor resuelve
  // su paleta una sola vez al crearse (createSnakeGame -> getSkin), así que
  // un cambio de skin necesita forzar el remount completo del efecto de
  // abajo — de ahí que este contador, y no solo restartKey, esté en sus deps.
  const [skinVersion, setSkinVersion] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stale = false;
    const image = new Image();
    image.onload = () => {
      if (stale) return;
      const handle = createSnakeGame(canvas, { onStateChange, onGameOver });
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
  }, [restartKey, skinVersion]);

  useEffect(() => {
    pausedRef.current = paused;
    handleRef.current?.setPaused(paused);
  }, [paused]);

  const handleSkinChange = (next: SkinId) => {
    if (next === skin) return;
    setSkin("snake", next);
    setSkinState(next);
    setSkinVersion((v) => v + 1);
  };

  return (
    <div style={{ position: "absolute", inset: 0 }}>
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
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          display: "flex",
          gap: 6,
          zIndex: 4,
        }}
      >
        {SKIN_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`chip${skin === opt.id ? " active" : ""}`}
            style={{
              padding: "6px 8px",
              fontSize: 8,
              minWidth: 44,
              minHeight: 44,
            }}
            onClick={() => handleSkinChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
