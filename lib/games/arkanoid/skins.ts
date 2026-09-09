import type { SkinId } from "@/lib/games/skins";

/**
 * Paleta de colores de gameplay de Arkanoid.
 *
 * A diferencia de Asteroids, este motor no dibuja formas vectoriales con
 * `fillStyle`/`strokeStyle` — pala, bola, bloques y explosiones son sprites
 * recortados de un único bitmap (`public/games/arkanoid/spritesheet-breakout.png`,
 * ver `SPRITES`/`EXPLOSION_FRAMES` en `engine.ts`), así que no existe ningún
 * literal de color de gameplay que reemplazar 1:1 salvo el fondo del canvas
 * (`#000`, fuera de las 3 paletas a propósito — mismo negro del marco CRT en
 * toda la app).
 *
 * Por eso la paleta de este juego reinterpreta el bitmap con `ctx.filter`
 * (aplicado a todos los `drawImage` de sprites, sin tocar el archivo PNG) y
 * agrega glow real vía `shadowColor`/`shadowBlur` a los dos elementos
 * controlables por el jugador (pala y bola) para las skins que lo requieran.
 */
export interface ArkanoidPalette {
  /**
   * `ctx.filter` aplicado antes de dibujar bloques, explosiones, pala y bola
   * desde el spritesheet. `"none"` en clasico deja el bitmap exactamente
   * como hoy (ningún valor cambiado).
   */
  spriteFilter: string;
  /** Color de resplandor (shadowColor) de la pala del jugador. `null` = sin glow. */
  paddleGlow: string | null;
  /** Color de resplandor de la bola. `null` = sin glow. */
  ballGlow: string | null;
  /** Radio de `shadowBlur` usado cuando `paddleGlow`/`ballGlow` no son `null`. */
  glowBlur: number;
}

export const ARKANOID_PALETTES: Record<SkinId, ArkanoidPalette> = {
  // Bitmap del spritesheet sin reinterpretar — el aspecto actual del juego.
  clasico: {
    spriteFilter: "none",
    paddleGlow: null,
    ballGlow: null,
    glowBlur: 0,
  },
  // Lenguaje visual insignia de la app: sprites más saturados/brillantes +
  // glow real (--cyan en la pala, --yellow en la bola) sobre los dos
  // elementos que el jugador controla o sigue con la vista.
  neon: {
    spriteFilter: "saturate(1.7) brightness(1.15) contrast(1.05)",
    paddleGlow: "#00f5ff", // --cyan
    ballGlow: "#f5ff00", // --yellow
    glowBlur: 18,
  },
  // Paleta tipo consola/CRT: el mismo bitmap con un giro de matiz hacia
  // tonos fósforo verde/ámbar, más contraste y saturación para que se lea
  // claro/vivo sobre el negro del canvas. Sin glow (plano, a propósito,
  // igual que el criterio "retro" ya usado en Asteroids).
  retro: {
    spriteFilter:
      "saturate(1.5) contrast(1.3) hue-rotate(35deg) brightness(1.05)",
    paddleGlow: null,
    ballGlow: null,
    glowBlur: 0,
  },
};
