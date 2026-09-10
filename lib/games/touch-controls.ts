/**
 * Layouts de controles táctiles por juego. Cada botón despacha un
 * KeyboardEvent sintético con el `code` correspondiente sobre `window` —
 * los 4 motores reales ya escuchan ese evento, así que no requieren cambios.
 * Ver components/games/touch-controls.tsx para el componente que consume esto.
 */

export interface TouchButtonConfig {
  code: string;
  label: string;
  /** true = auto-repeat mientras se mantiene presionado (solo D-pad de TETRIS). */
  repeat?: boolean;
}

export interface TouchLayoutConfig {
  dpad: {
    up?: TouchButtonConfig;
    down?: TouchButtonConfig;
    left?: TouchButtonConfig;
    right?: TouchButtonConfig;
  };
  actions: TouchButtonConfig[];
}

export const TOUCH_LAYOUTS: Record<string, TouchLayoutConfig> = {
  asteroids: {
    dpad: {
      left: { code: "ArrowLeft", label: "◄" },
      right: { code: "ArrowRight", label: "►" },
      up: { code: "ArrowUp", label: "▲" },
    },
    actions: [{ code: "Space", label: "A" }],
  },
  tetris: {
    dpad: {
      left: { code: "ArrowLeft", label: "◄", repeat: true },
      right: { code: "ArrowRight", label: "►", repeat: true },
      down: { code: "ArrowDown", label: "▼", repeat: true },
    },
    actions: [
      { code: "ArrowUp", label: "A", repeat: true },
      { code: "Space", label: "B" },
    ],
  },
  arkanoid: {
    dpad: {
      left: { code: "ArrowLeft", label: "◄" },
      right: { code: "ArrowRight", label: "►" },
    },
    actions: [],
  },
  snake: {
    dpad: {
      up: { code: "ArrowUp", label: "▲" },
      down: { code: "ArrowDown", label: "▼" },
      left: { code: "ArrowLeft", label: "◄" },
      right: { code: "ArrowRight", label: "►" },
    },
    actions: [],
  },
};
