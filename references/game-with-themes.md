# Skins por juego — Arcade Vault

> Mantenido automáticamente por el subagente `skin-designer`. No editar manualmente sin necesidad.
> Skins obligatorias por juego: `neon`, `retro`, `clasico` (default).

Las entradas se agregan aquí solo cuando el usuario invoca a `skin-designer` explícitamente sobre un juego.

## frogger (FROGGER)

- **Estado:** completo
- **Última actualización:** 2026-09-10
- **Archivos:** `lib/games/skins.ts`, `lib/games/frogger/skins.ts`, `lib/games/frogger/engine.ts`, `components/games/frogger-canvas.tsx`
- **Notas:** frogger tiene muchos más colores de gameplay que el resto de los juegos portados (fondos de zona, meta, autos/camiones/ruedas, troncos/veteado, tortugas/caparazón/sumergida, rana/ojos), todos movidos a `FroggerPalette`. clasico es la paleta original sin cambios. neon usa los custom properties de `app/globals.css` (`--cyan`/`--magenta`/`--yellow`/`--green`, hardcodeados como hex) con `shadowBlur`/`shadowColor` real en rana, vehículos, troncos, tortugas visibles y el borde de las metas; los 3 fondos de zona se oscurecen con tinte violeta/verde en vez del negro/azul/verde de clasico, para diferenciarse sin perder legibilidad. retro usa fósforo verde + ámbar CRT (siempre vivo sobre negro), sin glow — plano, mismo criterio que asteroids/snake/arkanoid. El HUD interno del canvas (fondo, texto, semáforo verde/ámbar/rojo del temporizador) queda **fuera** de las 3 paletas a propósito y documentado como comentario en `engine.ts`: es un indicador de estado (no arte) que duplica la misma info que el HUD de React fuera del canvas. Los iconos de vida del HUD interno sí siguen el color `frog` de la paleta activa (son siluetas de la rana, no parte del indicador de estado). Desviación de patrón estándar (heredada de asteroids/snake/arkanoid): el `useEffect` que monta/destruye el motor en `frogger-canvas.tsx` depende de `[restartKey, skinVersion]` en vez de solo `restartKey`, porque el motor resuelve la paleta una sola vez al crearse. Esta corrida se ejecutó siguiendo las instrucciones de `.claude/agents/skin-designer.md` directamente en la conversación principal (no como subagente aislado) porque el subagente `skin-designer` no aparecía disponible vía el Agent tool en esta sesión (mismo problema con `mobile-porter`, ya reportado como bug de producto).

## asteroids (ASTEROIDS)

- **Estado:** completo
- **Última actualización:** 2026-09-09
- **Archivos:** `lib/games/skins.ts`, `lib/games/asteroids/skins.ts`, `lib/games/asteroids/engine.ts`, `components/games/asteroids-canvas.tsx`
- **Notas:** retro usa paleta tipo vector-arcade CRT (fósforo verde `#39ff14` para la nave, ámbar `#ffb000` para asteroides, amarillo puro para balas, cian para el power-up), sin glow — plano a propósito para diferenciarse de neon. neon usa los custom properties de `app/globals.css` (`--cyan`/`--magenta`/`--yellow`/`--green`, hardcodeados como hex porque el canvas no puede leer `var()`) con `shadowBlur`/`shadowColor` real. clasico es la paleta original sin cambios (blanco + naranja del propulsor + power-up cian `#0ff`). El fondo del canvas (`#000`) queda fuera de las 3 paletas a propósito — es el mismo negro del marco CRT en toda la app, documentado como comentario en `engine.ts`. Desviación de patrón estándar: el `useEffect` que monta/destruye el motor en `asteroids-canvas.tsx` depende de `[restartKey, skinVersion]` en vez de solo `restartKey`, porque el motor resuelve la paleta una sola vez al crearse.

## arkanoid (ARKANOID)

- **Estado:** completo
- **Última actualización:** 2026-09-09
- **Archivos:** `lib/games/skins.ts`, `lib/games/arkanoid/skins.ts`, `lib/games/arkanoid/engine.ts`, `components/games/arkanoid-canvas.tsx`
- **Notas:** desviación notable del patrón estándar — este motor no tiene ningún literal `fillStyle`/`strokeStyle` de gameplay: pala, bola, bloques y explosiones son sprites recortados de un bitmap (`public/games/arkanoid/spritesheet-breakout.png`) dibujados con `drawImage`. Por eso la paleta no reemplaza colores 1:1 sino que reinterpreta el bitmap con `ctx.filter` aplicado a todos los sprites (`"none"` en clasico = render idéntico al original) y agrega glow real vía `shadowColor`/`shadowBlur` solo en pala y bola para neon (`--cyan`/`--yellow`, blur 18). retro usa el mismo bitmap con `saturate(1.5) contrast(1.3) hue-rotate(35deg) brightness(1.05)` — vira el conjunto de colores del spritesheet hacia tonos fósforo/ámbar CRT manteniendo cada bloque distinguible, sin glow (plano, igual criterio que asteroids). El fondo del canvas (`#000`) queda fuera de las 3 paletas a propósito y se limpia con `ctx.filter = "none"` explícito para que nunca herede el filtro de la skin activa. Misma desviación de patrón que asteroids: el `useEffect` que monta/destruye el motor en `arkanoid-canvas.tsx` depende de `[restartKey, skinVersion]` en vez de solo `restartKey`, preservando además la precarga de imagen (`stale` flag) que ya existía antes de este cambio.

## snake (SNAKE)

- **Estado:** completo
- **Última actualización:** 2026-09-09
- **Archivos:** `lib/games/skins.ts`, `lib/games/snake/skins.ts`, `lib/games/snake/engine.ts`, `components/games/snake-canvas.tsx`
- **Notas:** solo hay dos colores de gameplay hardcodeados en el motor (cabeza y cuerpo de la serpiente) — la fruta se dibuja desde el spritesheet `/games/snake/fruits.png` (imagen, no color de canvas), así que no forma parte de ninguna paleta. clasico es la paleta original sin cambios (`#00ff88` cabeza / `#00b368` cuerpo). neon usa amarillo `--yellow` para la cabeza y magenta `--magenta` para el cuerpo, con `shadowBlur`/`shadowColor` real (glow del color de la cabeza aplicado a todos los segmentos). retro usa verde fósforo `#39ff14` para la cabeza y ámbar CRT `#ffb000` para el cuerpo, sin glow — plano tipo sprite de consola. El fondo del canvas (`#000`) queda fuera de las 3 paletas a propósito, igual que en asteroids. Desviación de patrón estándar (heredada de asteroids): el `useEffect` que monta/destruye el motor en `snake-canvas.tsx` depende de `[restartKey, skinVersion]` en vez de solo `restartKey`. Además, ese mismo efecto ya tenía una particularidad propia de snake (crea el motor solo dentro de `image.onload` del spritesheet, con guard `stale` contra montajes obsoletos) que se preservó intacta al agregar `skinVersion` a las deps.
