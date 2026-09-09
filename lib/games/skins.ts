/**
 * Sistema de skins compartido por todos los juegos de Arcade Vault.
 *
 * Cada juego portado (`lib/games/<id>/`) puede definir su propia paleta por
 * skin en `lib/games/<id>/skins.ts`, pero la persistencia (localStorage) y el
 * tipo `SkinId` viven acá una sola vez para toda la app.
 */

export type SkinId = "neon" | "retro" | "clasico";

const STORAGE_PREFIX = "av-skin:";
const VALID_SKINS: readonly SkinId[] = ["neon", "retro", "clasico"];

function isSkinId(value: string | null): value is SkinId {
  return value !== null && (VALID_SKINS as readonly string[]).includes(value);
}

/**
 * Lee la skin guardada del jugador para un juego. SSR-safe: nunca revienta
 * si `window`/`localStorage` no existen o lanzan (modo privado, cuotas,
 * etc.) — en cualquiera de esos casos devuelve el default `"clasico"`.
 */
export function getSkin(gameId: string): SkinId {
  if (typeof window === "undefined") return "clasico";
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${gameId}`);
    return isSkinId(raw) ? raw : "clasico";
  } catch {
    return "clasico";
  }
}

/** Guarda la skin elegida por el jugador para un juego. SSR-safe. */
export function setSkin(gameId: string, skin: SkinId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${gameId}`, skin);
  } catch {
    // localStorage no disponible — no-op, el juego sigue funcionando con
    // el default en memoria.
  }
}
