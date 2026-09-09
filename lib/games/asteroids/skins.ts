import type { SkinId } from "@/lib/games/skins";

/**
 * Paleta de colores de gameplay de Asteroids. Una entrada por cada color
 * hoy hardcodeado en `engine.ts` (nave, balas, asteroides, power-up,
 * partículas de explosión y llama del propulsor). El fondo del canvas
 * (`#000`, ver `draw()` en engine.ts) queda fuera de la paleta a propósito:
 * es el mismo negro casi puro que usa el marco CRT de toda la app en las
 * 3 skins.
 */
export interface AsteroidsPalette {
  /** Trazo del triángulo de la nave del jugador. */
  ship: string;
  /** Llama del propulsor — color rgba completo, incluye su propio alpha. */
  thruster: string;
  /** Relleno de las balas disparadas por la nave. */
  bullet: string;
  /** Trazo de los polígonos de los asteroides. */
  asteroid: string;
  /** Power-up de disparo triple (marco rotado + texto "3x"). */
  powerUp: string;
  /** Partículas de explosión, como tripleta "r,g,b" (el motor arma el rgba con su propio alpha por partícula). */
  particleRgb: string;
  /** Si true, el motor aplica shadowBlur/shadowColor con estos mismos colores a nave/balas/asteroides/power-up. */
  glow: boolean;
}

export const ASTEROIDS_PALETTES: Record<SkinId, AsteroidsPalette> = {
  // Paleta actual del juego, sin cambiar un solo valor.
  clasico: {
    ship: "#fff",
    thruster: "rgba(255, 130, 0, 0.85)",
    bullet: "#fff",
    asteroid: "#fff",
    powerUp: "#0ff",
    particleRgb: "255,255,255",
    glow: false,
  },
  // Lenguaje visual insignia de la app: colores saturados + glow real.
  neon: {
    ship: "#00f5ff", // --cyan
    thruster: "rgba(0, 255, 136, 0.9)", // --green
    bullet: "#f5ff00", // --yellow
    asteroid: "#ff006e", // --magenta
    powerUp: "#00ff88", // --green
    particleRgb: "245,255,0", // --yellow
    glow: true,
  },
  // Paleta tipo consola/CRT de 8-16 bits: fósforo verde + ámbar, siempre
  // clara/viva sobre negro (sin glow, trazo plano tipo vector arcade).
  retro: {
    ship: "#39ff14", // verde fósforo
    thruster: "rgba(255, 176, 0, 0.85)", // ámbar
    bullet: "#ffff00", // amarillo puro
    asteroid: "#ffb000", // ámbar CRT
    powerUp: "#00ffff", // cian retro
    particleRgb: "57,255,20", // verde fósforo
    glow: false,
  },
};
