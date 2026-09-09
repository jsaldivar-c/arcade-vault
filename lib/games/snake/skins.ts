import type { SkinId } from "@/lib/games/skins";

/**
 * Paleta de colores de gameplay de Snake. Una entrada por cada color hoy
 * hardcodeado en `engine.ts` (cabeza y cuerpo de la serpiente). La fruta se
 * dibuja desde el spritesheet `/games/snake/fruits.png` (imagen, no color de
 * canvas), así que no forma parte de la paleta. El fondo del canvas (`#000`,
 * ver `draw()` en engine.ts) queda fuera de la paleta a propósito: es el
 * mismo negro casi puro que usa el marco CRT de toda la app en las 3 skins.
 */
export interface SnakePalette {
  /** Relleno del segmento de la cabeza (primer elemento de `segments`). */
  head: string;
  /** Relleno de los segmentos del cuerpo. */
  body: string;
  /** Si true, el motor aplica shadowBlur/shadowColor (color de la cabeza) a cada segmento. */
  glow: boolean;
}

export const SNAKE_PALETTES: Record<SkinId, SnakePalette> = {
  // Paleta actual del juego, sin cambiar un solo valor.
  clasico: {
    head: "#00ff88",
    body: "#00b368",
    glow: false,
  },
  // Lenguaje visual insignia de la app: colores saturados + glow real.
  neon: {
    head: "#f5ff00", // --yellow
    body: "#ff006e", // --magenta
    glow: true,
  },
  // Paleta tipo consola/CRT de 8-16 bits: verde fósforo + ámbar, siempre
  // clara/viva sobre negro (sin glow, plano tipo sprite de consola).
  retro: {
    head: "#39ff14", // verde fósforo
    body: "#ffb000", // ámbar CRT
    glow: false,
  },
};
