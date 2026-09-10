"use client";

import { useEffect, useRef } from "react";
import {
  TOUCH_LAYOUTS,
  type TouchButtonConfig,
} from "@/lib/games/touch-controls";

const REPEAT_INTERVAL_MS = 120;

function dispatchKey(code: string, type: "keydown" | "keyup") {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

function TouchButton({
  config,
  className,
}: {
  config: TouchButtonConfig;
  className: string;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressedRef = useRef(false);

  const stopRepeat = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const press = () => {
    if (pressedRef.current) return;
    pressedRef.current = true;
    dispatchKey(config.code, "keydown");
    if (config.repeat) {
      intervalRef.current = setInterval(() => {
        dispatchKey(config.code, "keydown");
      }, REPEAT_INTERVAL_MS);
    }
  };

  const release = () => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    stopRepeat();
    dispatchKey(config.code, "keyup");
  };

  // Suelta la tecla si el botón se desmonta mientras seguía presionado
  // (ej. el jugador reinicia la partida con el dedo todavía sobre el botón).
  useEffect(() => release, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button
      type="button"
      className={`touch-btn ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        press();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {config.label}
    </button>
  );
}

export function TouchControls({ gameId }: { gameId: string }) {
  const layout = TOUCH_LAYOUTS[gameId];
  if (!layout) return null;

  const { dpad, actions } = layout;

  return (
    <div className="touch-controls">
      <div className="touch-dpad">
        {dpad.up && <TouchButton config={dpad.up} className="touch-dpad-up" />}
        {dpad.left && (
          <TouchButton config={dpad.left} className="touch-dpad-left" />
        )}
        {dpad.right && (
          <TouchButton config={dpad.right} className="touch-dpad-right" />
        )}
        {dpad.down && (
          <TouchButton config={dpad.down} className="touch-dpad-down" />
        )}
      </div>
      {actions.length > 0 && (
        <div className="touch-actions">
          {actions.map((action) => (
            <TouchButton
              key={action.code}
              config={action}
              className="touch-btn-action"
            />
          ))}
        </div>
      )}
    </div>
  );
}
