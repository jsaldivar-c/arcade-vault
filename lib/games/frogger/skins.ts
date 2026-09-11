import type { SkinId } from "@/lib/games/skins";

/**
 * Paleta de colores de gameplay de Frogger. Una entrada por cada color hoy
 * hardcodeado en `engine.ts` para las zonas del tablero, la meta, las
 * entidades de carretera/río y la rana. El HUD interno del canvas (fondo,
 * texto, barra de tiempo) queda fuera de las 3 paletas a propósito: sus
 * colores (incluido el semáforo verde/ámbar/rojo del temporizador) son un
 * indicador de estado, no un elemento de arte, y duplica la misma
 * información que ya muestra el HUD de React fuera del canvas — igual
 * criterio que exceptúa el fondo `#000` compartido en asteroids/snake.
 */
export interface FroggerPalette {
  /** Fondo de los 6 carriles de carretera. */
  bgRoad: string;
  /** Fondo de los 6 carriles de río. */
  bgRiver: string;
  /** Fondo de las filas seguras (metas, zona intermedia, base de inicio). */
  bgSafe: string;
  /** Relleno de una boca de meta libre. */
  goalBg: string;
  /** Borde de una boca de meta. */
  goalBorder: string;
  /** Silueta dibujada dentro de una boca ya ocupada. */
  goalFrog: string;
  /** Relleno de los autos. */
  car: string;
  /** Relleno de los camiones. */
  truck: string;
  /** Ruedas de autos/camiones. */
  wheel: string;
  /** Relleno de los troncos. */
  log: string;
  /** Líneas de veteado sobre los troncos. */
  logGrain: string;
  /** Relleno de una tortuga/grupo de tortugas visible. */
  turtle: string;
  /** Trazo del caparazón sobre una tortuga visible. */
  turtleShell: string;
  /** Contorno de una tortuga sumergida (rgba con su propio alpha). */
  turtleSubmerged: string;
  /** Cuerpo de la rana del jugador (y sus iconos de vida en el HUD interno). */
  frog: string;
  /** Ojos de la rana. */
  frogEye: string;
  /** Si true, el motor aplica shadowBlur/shadowColor con estos mismos colores a rana/vehículos/troncos/tortugas/borde de meta. */
  glow: boolean;
}

export const FROGGER_PALETTES: Record<SkinId, FroggerPalette> = {
  // Paleta actual del juego, sin cambiar un solo valor.
  clasico: {
    bgRoad: "#000000",
    bgRiver: "#0a1a4a",
    bgSafe: "#123a1f",
    goalBg: "#3ddc63",
    goalBorder: "#e8c33d",
    goalFrog: "#1c7a3a",
    car: "#3498db",
    truck: "#c0392b",
    wheel: "#1a1a1a",
    log: "#7b4a20",
    logGrain: "rgba(0,0,0,0.35)",
    turtle: "#2e8b3d",
    turtleShell: "#1c5c27",
    turtleSubmerged: "rgba(255,255,255,0.25)",
    frog: "#39ff6a",
    frogEye: "#0a2e12",
    glow: false,
  },
  // Lenguaje visual insignia de la app: colores saturados (custom properties
  // de app/globals.css, hardcodeados como hex porque el canvas no puede leer
  // var()) + glow real. Fondos de zona oscurecidos con tinte violeta/verde
  // para diferenciarse de clasico sin perder legibilidad.
  neon: {
    bgRoad: "#0a0014",
    bgRiver: "#05012a",
    bgSafe: "#001a0f",
    goalBg: "#00ff88", // --green
    goalBorder: "#ff006e", // --magenta
    goalFrog: "#00f5ff", // --cyan
    car: "#00f5ff", // --cyan
    truck: "#ff006e", // --magenta
    wheel: "#150022",
    log: "#f5ff00", // --yellow
    logGrain: "rgba(0,0,0,0.45)",
    turtle: "#00ff88", // --green
    turtleShell: "#00f5ff", // --cyan
    turtleSubmerged: "rgba(0,245,255,0.35)",
    frog: "#f5ff00", // --yellow
    frogEye: "#1a0a00",
    glow: true,
  },
  // Paleta tipo consola/CRT de 8-16 bits: fósforo verde + ámbar, siempre
  // clara/viva sobre negro (sin glow, trazo plano tipo sprite de consola).
  retro: {
    bgRoad: "#000000",
    bgRiver: "#001505",
    bgSafe: "#1a1200",
    goalBg: "#ffb000", // ámbar CRT
    goalBorder: "#ffff00", // amarillo puro
    goalFrog: "#39ff14", // verde fósforo
    car: "#39ff14", // verde fósforo
    truck: "#ffb000", // ámbar CRT
    wheel: "#1a1a1a",
    log: "#ffb000", // ámbar CRT
    logGrain: "rgba(0,0,0,0.4)",
    turtle: "#39ff14", // verde fósforo
    turtleShell: "#ffb000", // ámbar CRT
    turtleSubmerged: "rgba(255,176,0,0.3)",
    frog: "#ffff00", // amarillo puro
    frogEye: "#1a1200",
    glow: false,
  },
};
