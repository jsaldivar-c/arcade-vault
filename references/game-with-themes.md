# Skins por juego — Arcade Vault

> Mantenido automáticamente por el subagente `skin-designer`. No editar manualmente sin necesidad.
> Skins obligatorias por juego: `neon`, `retro`, `clasico` (default).

Las entradas se agregan aquí solo cuando el usuario invoca a `skin-designer` explícitamente sobre un juego.

## asteroids (ASTEROIDS)

- **Estado:** completo
- **Última actualización:** 2026-09-09
- **Archivos:** `lib/games/skins.ts`, `lib/games/asteroids/skins.ts`, `lib/games/asteroids/engine.ts`, `components/games/asteroids-canvas.tsx`
- **Notas:** retro usa paleta tipo vector-arcade CRT (fósforo verde `#39ff14` para la nave, ámbar `#ffb000` para asteroides, amarillo puro para balas, cian para el power-up), sin glow — plano a propósito para diferenciarse de neon. neon usa los custom properties de `app/globals.css` (`--cyan`/`--magenta`/`--yellow`/`--green`, hardcodeados como hex porque el canvas no puede leer `var()`) con `shadowBlur`/`shadowColor` real. clasico es la paleta original sin cambios (blanco + naranja del propulsor + power-up cian `#0ff`). El fondo del canvas (`#000`) queda fuera de las 3 paletas a propósito — es el mismo negro del marco CRT en toda la app, documentado como comentario en `engine.ts`. Desviación de patrón estándar: el `useEffect` que monta/destruye el motor en `asteroids-canvas.tsx` depende de `[restartKey, skinVersion]` en vez de solo `restartKey`, porque el motor resuelve la paleta una sola vez al crearse.
