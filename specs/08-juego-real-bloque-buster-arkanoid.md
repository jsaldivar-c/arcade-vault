# SPEC 08 — Tercer juego real: ARKANOID

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-09-07
> **Objective:** Renombrar el juego `bloque-buster`/"BLOQUE BUSTER" a `arkanoid`/"ARKANOID" en el catálogo de Supabase (mismo tratamiento que PR #15 hizo con ROCAS→ASTEROIDS y SPEC 07 con CAÍDA→TETRIS) y reemplazar el arena decorativo del Reproductor por el motor real de `references/started-games/04-arkanoid` (portado a TypeScript, mismo contrato reutilizable `lib/games/engine.ts` que ya usan ASTEROIDS y TETRIS), agregando la entrada correspondiente al registro ya existente `lib/games/registry.ts`.

---

## Por qué existe este spec

SPEC 05 dejó el contrato `lib/games/engine.ts` y el primer juego real (ASTEROIDS). SPEC 06 hizo el leaderboard/catálogo 100% genéricos por `game.id`. SPEC 07 agregó el segundo juego real (TETRIS) y migró el wiring de `components/game-player.tsx` de un booleano hardcodeado a `lib/games/registry.ts` (`GAME_CANVAS_REGISTRY`), que hoy ya cubre `"asteroids"` y `"tetris"`. `references/started-games/04-arkanoid` es un clon jugable de Arkanoid ya terminado (canvas HTML5 puro, `game.js` + `levels.js` + un spritesheet real y 2 efectos de sonido reales en `assets/`).

La entrada del catálogo que corresponde temáticamente a este juego existe hoy en Supabase como `id: "bloque-buster"` / `title: "BLOQUE BUSTER"` (categoría ARCADE). El usuario pidió explícitamente renombrarla a **ARKANOID, no BLOQUE BUSTER** — el mismo tratamiento que ya recibieron ROCAS→ASTEROIDS (PR #15) y CAÍDA→TETRIS (SPEC 07). Se verificó antes de escribir este spec (`SELECT count(*) FROM scores WHERE game_id = 'bloque-buster'` → `0`) que no existen puntuaciones guardadas todavía bajo ese id, así que el `UPDATE` sobre `games.id` (primary key referenciada por el FK `scores_game_id_fkey`) es seguro y no requiere tocar `scores` en paralelo.

Este es el tercer juego real del Vault y el primero con assets reales (spritesheet + audio) en vez de figuras dibujadas por código, y el primero en agregar una entrada a un registro que ya existe (en vez de crearlo, como hizo SPEC 07).

---

## Scope

**In:**

- **Migración de renombrado en Supabase:** actualizar la fila existente de `games` de `id: "bloque-buster"` / `title: "BLOQUE BUSTER"` a `id: "arkanoid"` / `title: "ARKANOID"` (resto de columnas — `short`/`long`/`cat`/`cover`/`color` — sin cambios), vía `mcp__supabase__apply_migration`, consistente con que SPEC 06/07 ya usan esa herramienta para cambios de datos del catálogo. Verificado que `scores` no tiene ninguna fila con `game_id = 'bloque-buster'` (`0` filas), así que el `UPDATE` no viola el FK `scores_game_id_fkey` ni requiere tocar `scores`.
- Puerto a TypeScript de la lógica de `references/started-games/04-arkanoid/game.js` + `levels.js` (pala, pelota, colisión AABB con paredes/pala/bloques, 10×6 bloques por nivel, 3 vidas, 5 niveles con patrones de bloques y velocidades `×1.00/1.10/1.21/1.33/1.46`, animación de explosión de 4 frames al romper un bloque, puntuación `+10` por bloque) en `lib/games/arkanoid/engine.ts`, encapsulado en `createArkanoidGame(canvas, callbacks): GameHandle` — mismo patrón que `lib/games/asteroids/engine.ts` y `lib/games/tetris/engine.ts`: todo el estado mutable (pala, pelota, bloques, explosiones, vidas, score, nivel actual, listeners de teclado, `requestAnimationFrame` pendiente) vive dentro del closure de la factory, sin variables de módulo.
- Renderizado con sprites reales: se porta el uso del spritesheet (`assets/spritesheet-breakout.png`, helpers `drawSprite`/`drawFrame` de `assets/spritesheet.js`) para pala, pelota, bloques y frames de explosión — no se reemplaza por figuras dibujadas con `fillRect`/colores planos. Los assets se copian a `public/games/arkanoid/` (`spritesheet-breakout.png`, `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3`) para poder servirse como estáticos de Next.js.
- **Precarga del spritesheet antes de crear el motor**: `components/games/arkanoid-canvas.tsx` precarga la imagen (`new Image()` + `onload`) antes de llamar a `createArkanoidGame(canvas, callbacks)`; el motor no se crea (ni dibuja/actualiza nada) mientras la imagen no haya resuelto.
- **Sonido real**: se portan los 2 efectos de sonido del original (`ball-bounce.mp3` al rebotar en paredes/pala, `break-sound.mp3` al romper un bloque), reproducidos con `Audio` + `cloneNode().play()` para permitir solapamiento, igual que el original. Es el primer juego real del Vault con audio (ASTEROIDS y TETRIS quedaron explícitamente sin sonido en SPEC 05/07 por no tener assets de audio disponibles).
- `components/games/arkanoid-canvas.tsx` (Client Component): mismo patrón que `asteroids-canvas.tsx`/`tetris-canvas.tsx` (canvas 800×600, `position:absolute;inset:0;width:100%;height:100%`, props `paused`/`restartKey`/`onStateChange`/`onGameOver`), con la precarga de spritesheet descrita arriba dentro del `useEffect[restartKey]` antes de instanciar el motor, e ignorando el resultado de una precarga obsoleta si `restartKey` vuelve a cambiar antes de que resuelva.
- **Controles 100% por teclado**: `←`/`→` mueven la pala (el original ya los soporta en paralelo al mouse); se elimina por completo el control por mouse (`mousemove` sobre el canvas). Se agrega `preventDefault()` en `ArrowLeft`/`ArrowRight` mientras el motor está montado, mismo criterio que ASTEROIDS/TETRIS.
- **Sin tecla de pausa interna ni menú de selección de nivel por click**: se elimina la tecla `P`/`Escape` y el listener de `click` del original (que abría un overlay de "saltar a nivel 1-5" mientras `isPaused` era `true`). La única fuente de pausa es `GameHandle.setPaused(paused)`. Los 5 niveles se juegan siempre en orden (`1 → 2 → 3 → 4 → 5`) sin salto manual (ver Decisions para la razón concreta de por qué se descarta, no solo por precedente).
- Fin de partida real: perder las 3 vidas (bola cae por debajo de la pala 3 veces) llama `callbacks.onGameOver(score)`, igual que hoy en ASTEROIDS. **Limpiar el nivel 5 (victoria) también llama `callbacks.onGameOver(score)`** — mismo evento, mismo modal "FIN DEL JUEGO" ya existente, sin overlay ni UI de "victoria" separada dibujada en canvas.
- `onStateChange({ score, lives, level })` llamado cada frame con valores reales: `lives` decrece de 3 a 0 igual que ASTEROIDS (a diferencia de TETRIS, que fija `lives: 1`); `level` refleja el nivel actual 1-5 y sube al limpiar todos los bloques de un nivel.
- JUGAR DE NUEVO reinicia el motor a un estado nuevo (pala centrada, nivel 1, 3 vidas, score 0) sin recargar la página, incrementando `restartKey` — mismo mecanismo que ASTEROIDS/TETRIS.
- **Agregar la entrada `"arkanoid": ArkanoidCanvas` a `GAME_CANVAS_REGISTRY`** en el `lib/games/registry.ts` ya existente (creado en SPEC 07, hoy cubre `"asteroids"` y `"tetris"`) — no se recrea el archivo ni se cambia su forma (`GameCanvasProps`/`GameCanvasComponent` ya sirven sin modificación).
- Limpiar la referencia mock rezagada a "Bloque Buster" en `components/home.tsx` (`TICKER`, fila `{ p: "GLITCHA", g: "Bloque Buster", ... }`) a `"Arkanoid"` — mismo tipo de limpieza de copy que hizo PR #15 con "Rocas" y SPEC 07 con "Caída" en el mismo array.
- Guardado de la puntuación final vía `saveScore()` ya existente (`lib/scores.ts`) — sin cambios a ese archivo ni a `lib/supabase/games.ts`.

**Out of scope (para specs futuros):**

- Los 4 juegos restantes sin motor real (Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel) — siguen usando el Reproductor decorativo, sin cambios en este spec.
- El menú de selección de nivel por click y el control de pala por mouse del original — descartados explícitamente en este spec (ver Decisions), no se retoman salvo un spec futuro que rediseñe el overlay de pausa compartido de `game-player.tsx`.
- Cambios al contrato `lib/games/engine.ts` (`GameCallbacks`/`GameHandle`/`GameFactory`).
- Cambios a `lib/scores.ts` o `lib/supabase/games.ts`.
- Controles táctiles/on-screen.
- Música de fondo (solo se portan los 2 efectos de sonido puntuales ya existentes: rebote y rotura de bloque).
- Tests automatizados.

---

## Data model

Migración SQL de renombrado (vía `mcp__supabase__apply_migration`; sin cambios de esquema, solo datos de la fila existente):

```sql
update games
set id = 'arkanoid', title = 'ARKANOID'
where id = 'bloque-buster';
```

No agrega tablas ni cambia `lib/scores.ts` ni `lib/supabase/games.ts` (ya genéricos por `game.id` desde SPEC 06). No cambia el contrato `lib/games/engine.ts`. Introduce:

```ts
// lib/games/arkanoid/engine.ts
export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle;
```

Modifica (agrega una entrada, no cambia la forma del archivo):

```ts
// lib/games/registry.ts (ya existe desde SPEC 07)
export const GAME_CANVAS_REGISTRY: Record<string, GameCanvasComponent> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
  arkanoid: ArkanoidCanvas, // nuevo
};
```

Nuevos assets estáticos:

```
public/games/arkanoid/spritesheet-breakout.png
public/games/arkanoid/sounds/ball-bounce.mp3
public/games/arkanoid/sounds/break-sound.mp3
```

---

## Implementation plan

1. Aplicar la migración de renombrado con `mcp__supabase__apply_migration`: `UPDATE games SET id = 'arkanoid', title = 'ARKANOID' WHERE id = 'bloque-buster'`. Verificación: `mcp__supabase__execute_sql` con `SELECT id, title FROM games WHERE id IN ('arkanoid','bloque-buster')` devuelve una sola fila (`arkanoid`/`ARKANOID`); `SELECT count(*) FROM scores WHERE game_id = 'bloque-buster'` sigue en `0`.
2. Copiar `references/started-games/04-arkanoid/assets/spritesheet-breakout.png`, `assets/sounds/ball-bounce.mp3` y `assets/sounds/break-sound.mp3` a `public/games/arkanoid/` (manteniendo `sounds/` como subcarpeta). Verificación: los 3 archivos existen en `public/games/arkanoid/` y se sirven en `http://localhost:3000/games/arkanoid/...` con `next dev` corriendo.
3. Crear `lib/games/arkanoid/engine.ts` portando `game.js` + `levels.js`: mismas constantes de balance (`BLOCK_COLS=10`, `BLOCK_ROWS=6`, `BLOCK_W=64`, `BLOCK_H=24`, colores por nivel de `levels.js`, velocidades `×1.00/1.10/1.21/1.33/1.46`, `EXPLOSION_DURATION=150`, `+10` pts/bloque), pero con todo el estado mutable (`paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `currentLevel`, listeners de `keydown`/`keyup`, `requestAnimationFrame` pendiente) encapsulado dentro de `createArkanoidGame(canvas, callbacks)`. La factory recibe el spritesheet ya cargado (ver paso 4) y usa `drawSprite`/`drawFrame` equivalentes portados a TS. Sin `mousemove`, sin tecla `P`/`Escape`, sin `click` de selección de nivel. `callbacks.onStateChange({ score, lives, level })` en cada frame; `callbacks.onGameOver(score)` tanto al llegar `lives === 0` como al limpiar el nivel 5 (victoria). `setPaused(true)` detiene la lógica de `update()`; `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de `ArrowLeft`/`ArrowRight`. Verificación: `npx tsc --noEmit` sin errores.
4. Crear `components/games/arkanoid-canvas.tsx` siguiendo el patrón de `asteroids-canvas.tsx`/`tetris-canvas.tsx` (mismas props, canvas 800×600 con el mismo CSS de posicionamiento absoluto), con un paso adicional: dentro del `useEffect[restartKey]`, precargar `new Image()` apuntando a `/games/arkanoid/spritesheet-breakout.png`, y solo al `onload` (y si el efecto sigue vigente, es decir `restartKey` no cambió mientras cargaba) llamar `createArkanoidGame(canvasRef.current, callbacks)`; el cleanup destruye el motor si ya se creó, o marca la carga en curso como obsoleta si todavía no resolvía. Verificación: `npx tsc --noEmit` sin errores; compila como Client Component (`"use client"`).
5. Modificar `lib/games/registry.ts`: importar `ArkanoidCanvas` y agregar `arkanoid: ArkanoidCanvas` a `GAME_CANVAS_REGISTRY`, sin tocar `GameCanvasProps`/`GameCanvasComponent` ni las entradas existentes de `asteroids`/`tetris`. Verificación: `npx tsc --noEmit` sin errores.
6. Actualizar `components/home.tsx`: cambiar la fila del `TICKER` mock `{ p: "GLITCHA", g: "Bloque Buster", s: 28450, t: "hace 18 min", c: "cyan" }` a `g: "Arkanoid"`. Verificación: `grep -ri "bloque.buster" app components lib` no devuelve resultados fuera de `references/`.
7. Verificación end-to-end manual: jugar una partida completa de ARKANOID en `/juego/arkanoid/jugar` — mover la pala con `←`/`→`, rebotar en paredes/pala reproduciendo `ball-bounce.mp3`, romper bloques sumando `10` pts c/u con la animación de explosión y `break-sound.mp3`, limpiar los 5 niveles confirmando los patrones de bloques y el aumento de velocidad de la pelota, ver el `Nivel` del HUD subir en cada transición, perder las 3 vidas y confirmar que se abre el modal "FIN DEL JUEGO" automáticamente con la puntuación real, o alternativamente limpiar el nivel 5 y confirmar que también abre el mismo modal. Guardar la puntuación (aparece en `/salon` tab ARKANOID y en el leaderboard de `/juego/arkanoid` tras recargar) y reiniciar con "JUGAR DE NUEVO" sin recargar la página. Probar PAUSA/REANUDAR (el canvas se congela y continúa) y el botón FIN como abandono manual. Confirmar que `/juego/asteroids/jugar` y `/juego/tetris/jugar` siguen funcionando sin regresión, y que los 4 juegos restantes sin motor real siguen mostrando el arena decorativo. Verificación final: `npm run lint` y `npm run build` pasan sin errores.

---

## Acceptance criteria

- [ ] La tabla `games` en Supabase ya no tiene ninguna fila con `id = 'bloque-buster'`; existe `id = 'arkanoid'` / `title = 'ARKANOID'` con el resto de columnas (`short`/`long`/`cat`/`cover`/`color`) sin cambios respecto a la fila original.
- [ ] `lib/games/arkanoid/engine.ts` exporta `createArkanoidGame(canvas, callbacks): GameHandle` con la misma mecánica que `references/started-games/04-arkanoid` (pala, pelota, colisión AABB, 3 vidas, 5 niveles con sus patrones/velocidades, animación de explosión, `+10` pts/bloque).
- [ ] El renderizado usa el spritesheet real (`spritesheet-breakout.png`) para pala/pelota/bloques/explosiones, servido desde `public/games/arkanoid/`.
- [ ] Los efectos de sonido reales (`ball-bounce.mp3`, `break-sound.mp3`) se reproducen al rebotar y al romper un bloque respectivamente.
- [ ] `/juego/arkanoid/jugar` renderiza el canvas real dentro del `.crt-screen` y es jugable con `←`/`→`; esas teclas ya no hacen scroll de la página mientras el juego está montado. No hay control de pala por mouse.
- [ ] El HUD de React (Puntuación/Vidas/Nivel) en `/juego/arkanoid/jugar` refleja el estado real del motor en vivo: `Vidas` baja de 3 a 0, `Nivel` sube de 1 a 5.
- [ ] Perder las 3 vidas abre automáticamente el modal "FIN DEL JUEGO" con la puntuación real; limpiar el nivel 5 (victoria) también abre el mismo modal con la puntuación real. Guardar la puntuación persiste una fila real en Supabase (`scores.game_id = "arkanoid"`).
- [ ] El botón FIN abandona la partida en curso y abre el mismo modal con la puntuación acumulada hasta ese momento.
- [ ] PAUSA detiene visualmente el juego real (el canvas deja de actualizarse) y REANUDAR lo continúa sin reiniciar el progreso; no existe tecla `P`/`Escape` interna ni menú de selección de nivel por click.
- [ ] JUGAR DE NUEVO desde el modal reinicia una partida nueva (pala centrada, nivel 1, 3 vidas, score 0) sin recargar la página.
- [ ] `lib/games/registry.ts` sigue siendo el mismo archivo (no se recrea) y `GAME_CANVAS_REGISTRY` ahora cubre `"asteroids"`, `"tetris"` y `"arkanoid"`.
- [ ] `/juego/asteroids/jugar` y `/juego/tetris/jugar` siguen funcionando exactamente igual que antes de este spec (sin regresión).
- [ ] Los 4 juegos restantes sin motor real se ven y funcionan exactamente igual que antes de este spec (arena decorativo, timer falso de puntuación).
- [ ] `components/home.tsx` ya no contiene la referencia mock "Bloque Buster" en `TICKER`.
- [ ] `npm run build` y `npm run lint` completan sin errores de tipos ni de ESLint.

---

## Decisions

- **Sí:** renombrar la fila del catálogo de `id: "bloque-buster"` / `title: "BLOQUE BUSTER"` a `id: "arkanoid"` / `title: "ARKANOID"` mediante una migración real en Supabase (`UPDATE`), en vez de mantener el id `bloque-buster` y solo cambiar el título, o de crear una fila nueva. Razón: decidido explícitamente por el usuario; mismo tratamiento completo (id + título) que recibieron ROCAS→ASTEROIDS (PR #15) y CAÍDA→TETRIS (SPEC 07), y consistente en toda la app (URLs, `lib/games/arkanoid/`, registro) en vez de una identidad dividida entre id interno y nombre visible.
- **Sí:** verificar antes de migrar que `scores` no tiene ninguna fila con `game_id = 'bloque-buster'` (confirmado: `0` filas), por lo que el `UPDATE` de `games.id` no viola el FK `scores_game_id_fkey` ni requiere una migración adicional sobre `scores`. Razón: verificación técnica necesaria antes de ejecutar un `UPDATE` sobre una primary key referenciada por FK; mismo chequeo que ya hizo SPEC 07 para `caida`.
- **Sí:** limpiar también la referencia mock rezagada a "Bloque Buster" en `components/home.tsx` (`TICKER`) como parte de este mismo spec. Razón: es el mismo tipo de limpieza de copy que ya hicieron PR #15 ("Rocas") y SPEC 07 ("Caída") en el mismo array; dejarla inconsistente confundiría al usuario final viendo "Bloque Buster" en el ticker de Home mientras el juego real se llama ARKANOID.
- **Sí:** no se necesita ninguna migración de esquema adicional (columnas), solo `id`/`title` de la fila existente. Razón: `short`/`long`/`cat`/`cover`/`color` ya son genéricos y no mencionan el nombre del juego de forma que requiera actualizarse.
- **Sí:** precargar el spritesheet (`Image.onload`) antes de llamar a `createArkanoidGame`, en vez de una bandera de carga interna dentro de la factory. Razón: confirmado explícitamente por el usuario; más simple de razonar y evita tener que dibujar frames en blanco dentro del motor mientras carga.
- **Sí:** incluir los 2 efectos de sonido reales del original (`ball-bounce.mp3`, `break-sound.mp3`), copiados a `public/games/arkanoid/sounds/`. Razón: confirmado explícitamente por el usuario — primer juego real del Vault con audio, a diferencia de ASTEROIDS/TETRIS (SPEC 05/07), que quedaron sin sonido porque sus referencias no traían assets de audio.
- **Sí:** controles 100% por teclado (`←`/`→` mueven la pala); se elimina el control por mouse del original. Razón: confirmado explícitamente por el usuario, consistente con el precedente de ASTEROIDS/TETRIS.
- **No:** se elimina el menú de pausa/selección de nivel por click del original; los 5 niveles se juegan siempre en orden sin salto manual. Razón: el usuario pidió mantenerlo solo si no era complejo o rompía algo. Se determinó que sí rompe algo concreto: `components/game-player.tsx` ya dibuja su propio overlay "EN PAUSA" (`.crt-content`, `zIndex: 5`) que cubre todo `.crt-screen` —incluido el canvas— mientras `paused` es `true` (ver `components/game-player.tsx` líneas 142-164), lo que bloquearía cualquier click hacia un menú dibujado dentro del canvas. Resolverlo requeriría modificar el overlay de pausa compartido por **todos** los juegos (decorativos y reales) solo para este caso, lo cual excede el alcance de este spec y agrega riesgo cruzado a ASTEROIDS/TETRIS y a los juegos decorativos.
- **Sí:** se elimina también la tecla `P`/`Escape` de pausa interna del original; la única fuente de pausa sigue siendo `GameHandle.setPaused()`. Razón: mismo precedente de ASTEROIDS/TETRIS, reforzado por la decisión anterior de eliminar el menú de pausa propio (ya no hay ninguna razón para que el motor conozca un estado de pausa que no le llega por `setPaused`).
- **Sí:** limpiar el nivel 5 (victoria) dispara `callbacks.onGameOver(score)`, el mismo evento que perder las 3 vidas — abre el mismo modal "FIN DEL JUEGO", reutilizando el flujo de guardado existente, sin overlay ni UI de "victoria" separada. Razón: confirmado explícitamente por el usuario ("por el momento queda igual como Fin del juego").
- **Sí:** el HUD de React (Puntuación/Vidas/Nivel) refleja el nivel real (1-5) vía `onStateChange`, sin agregar ningún campo nuevo al contrato. Razón: confirmado explícitamente por el usuario ("el HUD debe manejar el nivel actual"); ARKANOID encaja sin cambios en `GameCallbacks`, igual que ASTEROIDS (a diferencia de TETRIS, que fija `lives: 1` por no tener vidas múltiples).
- **Sí:** agregar la entrada `"arkanoid"` al `lib/games/registry.ts` ya existente en vez de recrearlo o duplicarlo. Razón: el registro ya existe desde SPEC 07 y ya cubre `asteroids`/`tetris` correctamente; solo falta esta entrada.
- **No:** no se cambia el contrato `lib/games/engine.ts`. Razón: ARKANOID encaja completamente (vidas reales decrecientes, niveles reales, sin eventos nuevos necesarios).
- **No:** no se agregan controles táctiles/on-screen. Razón: mismo criterio ya aplicado a ASTEROIDS/TETRIS.
- **No:** no se toca `lib/scores.ts` ni `lib/supabase/games.ts` más allá de la migración de renombrado de la fila de `games`. Razón: SPEC 06 ya los dejó genéricos por `game.id`; ARKANOID los usa sin cambios de código.

---

## Risks

| Riesgo                                                                                                                                                                                                                | Mitigación                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un `UPDATE` sobre `games.id` (primary key referenciada por FK) podría fallar o dejar huérfanas filas de `scores` si ya existieran puntuaciones guardadas para `bloque-buster`.                                        | Verificado antes de escribir este spec: `SELECT count(*) FROM scores WHERE game_id = 'bloque-buster'` devuelve `0` — no hay partidas jugadas todavía bajo ese id, así que el `UPDATE` es seguro sin necesidad de migrar filas de `scores` en paralelo. El paso 1 del plan repite esta verificación antes y después de aplicar la migración. |
| Reproducir audio con `Audio`/`cloneNode().play()` podría chocar con políticas de autoplay del navegador si se dispara sin un gesto previo del usuario.                                                                | Los sonidos solo se reproducen en eventos de rebote/rotura dentro de una partida ya iniciada (tras navegar e interactuar con la UI de React y presionar teclas), lo cual normalmente cuenta como gesto de usuario habilitando audio; se verifica manualmente en el paso 7 del plan.                                                         |
| Precargar el spritesheet de forma asíncrona antes de crear el motor podría dejar el canvas en blanco unos frames, o crear una condición de carrera si `restartKey` cambia mientras una carga anterior sigue en vuelo. | El efecto de precarga verifica que su propio `restartKey` siga vigente antes de crear el motor, descartando el resultado de una carga obsoleta — mismo criterio general que evitar condiciones de carrera en efectos async de React.                                                                                                        |
| Eliminar el menú de selección de nivel por click podría sentirse como una regresión de funcionalidad frente al original para quien quisiera probar niveles específicos rápidamente.                                   | Aceptado explícitamente por el usuario como trade-off (ver Decisions) a cambio de no modificar el overlay de pausa compartido por todos los juegos; los 5 niveles se siguen jugando completos en orden normal.                                                                                                                              |
| Portar la física de colisión AABB (paredes/pala/bloques) 1:1 a TypeScript podría introducir bugs sutiles (p. ej. la pelota atraviesa la pala en frames rápidos) si se reordenan los chequeos del original.            | Se porta el mismo orden de chequeos que `game.js` (paredes → pala → bloques, un bloque por frame), verificado jugando una partida completa en el paso 7 del plan.                                                                                                                                                                           |

---

## What is **not** in this spec

- Nota de formato: no se encontró un skill `/spec` instalado en esta máquina (buscado con `Glob **/skills/spec/SKILL.md`, sin resultados); este spec sigue el resumen de formato incluido en `/add-game` (mismo orden y tono de SPEC 05/06/07).
- Los 4 juegos restantes sin motor real (Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel) — siguen decorativos.
- El menú de selección de nivel por click y el control de pala por mouse del original.
- Cambios al contrato `lib/games/engine.ts`.
- Cambios a `lib/scores.ts` o `lib/supabase/games.ts` más allá de la migración de renombrado.
- Controles táctiles/on-screen.
- Música de fondo.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
