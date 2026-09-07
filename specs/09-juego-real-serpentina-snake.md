# SPEC 09 — Tercer juego real: SNAKE

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-09-07
> **Objective:** Renombrar el juego `serpentina`/"SERPENTINA" a `snake`/"SNAKE" en el catálogo de Supabase (mismo tratamiento que PR #15 hizo con ROCAS→ASTEROIDS, SPEC 07 con CAÍDA→TETRIS y SPEC 08 con BLOQUE BUSTER→ARKANOID) y reemplazar el arena decorativo del Reproductor de SNAKE por un motor real diseñado desde cero siguiendo las reglas clásicas de Snake (sin referencia de lógica jugable disponible, solo un atlas de sprites de frutas), agregando la entrada correspondiente al registro ya existente `lib/games/registry.ts`.

---

## Por qué existe este spec

SPEC 05 dejó el contrato `lib/games/engine.ts` y el primer juego real (ASTEROIDS). SPEC 06 hizo el leaderboard/catálogo 100% genéricos por `game.id`. SPEC 07 agregó el segundo juego real (TETRIS) y migró el wiring de `components/game-player.tsx` de un booleano hardcodeado a `lib/games/registry.ts` (`GAME_CANVAS_REGISTRY`), que hoy ya cubre `"asteroids"` y `"tetris"`. SPEC 08 agregó el tercer juego real (ARKANOID) y confirmó el mismo patrón de renombrado + precarga de assets antes de crear el motor; `GAME_CANVAS_REGISTRY` hoy cubre `"asteroids"`, `"tetris"` y `"arkanoid"`.

A diferencia de ROCAS/CAÍDA/BLOQUE BUSTER, `references/started-games/05-snake` **no trae ningún archivo de lógica jugable** (`game.js` o equivalente) — solo `sprites.js` (un atlas `SPRITE_ATLAS.fruits` con 22 recortes de frutas dentro de `fruits.png`, tomado de spriters-resource.com) y `fruits.png`. Este spec diseña la mecánica desde cero siguiendo las reglas clásicas de Snake (movimiento en cuadrícula, la serpiente crece al comer, game over al chocar contra pared o contra su propio cuerpo), reutilizando únicamente el atlas de sprites de frutas como asset visual.

La entrada del catálogo que corresponde temáticamente a este juego existe hoy en Supabase como `id: "serpentina"` / `title: "SERPENTINA"` (categoría ARCADE). El usuario pidió explícitamente renombrarla a **SNAKE, no SERPENTINA** — el mismo tratamiento que ya recibieron ROCAS→ASTEROIDS (PR #15), CAÍDA→TETRIS (SPEC 07) y BLOQUE BUSTER→ARKANOID (SPEC 08). Se verificó antes de escribir este spec (`SELECT count(*) FROM scores WHERE game_id = 'serpentina'` → `0`) que no existen puntuaciones guardadas todavía bajo ese id, así que el `UPDATE` sobre `games.id` (primary key referenciada por el FK `scores_game_id_fkey`) es seguro y no requiere tocar `scores` en paralelo.

---

## Scope

**In:**

- **Migración de renombrado en Supabase:** actualizar la fila existente de `games` de `id: "serpentina"` / `title: "SERPENTINA"` a `id: "snake"` / `title: "SNAKE"` (resto de columnas — `short`/`long`/`cat`/`cover`/`color` — sin cambios), vía `mcp__supabase__apply_migration`, consistente con SPEC 06/07/08. Verificado que `scores` no tiene ninguna fila con `game_id = 'serpentina'` (`0` filas), así que el `UPDATE` no viola el FK `scores_game_id_fkey` ni requiere tocar `scores`.
- Diseño e implementación desde cero (sin referencia de `game.js`) de la mecánica clásica de Snake en `lib/games/snake/engine.ts`, encapsulada en `createSnakeGame(canvas, callbacks): GameHandle` — mismo patrón que `lib/games/asteroids/engine.ts`, `lib/games/tetris/engine.ts` y `lib/games/arkanoid/engine.ts`: todo el estado mutable (segmentos de la serpiente, dirección actual/pendiente, posición de la fruta, score, nivel, intervalo de movimiento, listeners de teclado, `requestAnimationFrame` pendiente) vive dentro del closure de la factory, sin variables de módulo.
- **Tablero en cuadrícula:** canvas lógico 800×600 (4:3, mismo criterio que los 3 juegos reales anteriores), dividido en una cuadrícula de `COLS=20` × `ROWS=15` celdas de `40×40px` cada una (ambas dimensiones dividen exacto: `800/20=40`, `600/15=40`, celdas cuadradas sin distorsión).
- **Movimiento:** la serpiente avanza automáticamente una celda por "tick" en la dirección actual (no por frame); el jugador cambia la dirección pendiente con las flechas, sin permitir invertir 180° sobre sí misma en un solo tick (p. ej. no se puede ir de derecha a izquierda directamente si la serpiente se mueve a la derecha). Arranca con 3 segmentos horizontales centrados en el tablero, moviéndose a la derecha.
- **Fruta con sprite real:** en cada aparición de fruta se elige aleatoriamente uno de los 22 recortes de `SPRITE_ATLAS.fruits` (`references/started-games/05-snake/sprites.js`) y se dibuja con `drawImage` sobre la imagen precargada `fruits.png`, escalado a una celda de la cuadrícula — puramente visual, sin afectar el puntaje (todas las frutas otorgan los mismos puntos fijos). La fruta se coloca en una celda aleatoria libre (no ocupada por la serpiente) cada vez que se come la anterior.
- **Puntuación:** `+10` puntos fijos por fruta comida (mismo orden de magnitud que `+10` pts/bloque de ARKANOID), independientemente del tipo de fruta dibujado.
- **Crecimiento:** al comer una fruta, la serpiente crece un segmento (no se remueve la cola en ese tick); en los demás ticks se remueve la cola al mismo tiempo que se agrega la nueva cabeza, simulando desplazamiento.
- **Progresión de nivel/velocidad:** cada `5` frutas comidas, `level` sube en `1` y el intervalo entre ticks de movimiento se reduce siguiendo `max(60, 150 - (level - 1) * 10)` ms (mismo espíritu que la fórmula de aceleración de TETRIS por líneas, con un piso de velocidad para mantener el juego jugable).
- **Fin de partida:** game over al chocar contra cualquier borde del tablero (sin wraparound) o contra el propio cuerpo de la serpiente; dispara `callbacks.onGameOver(score)` una sola vez, lo que abre automáticamente el mismo modal "FIN DEL JUEGO" ya existente (input de nombre, GUARDAR PUNTUACIÓN, JUGAR DE NUEVO, VOLVER AL VAULT). El botón FIN se mantiene como abandono manual con la puntuación acumulada hasta ese momento.
- **`onStateChange({ score, lives, level })` reporta `lives: 1` fijo** durante toda la partida (mismo tratamiento que TETRIS en SPEC 07: sin concepto de vidas múltiples, cualquier colisión termina la partida directamente) — el HUD de React muestra un solo `♥` durante la partida.
- `components/games/snake-canvas.tsx` (Client Component), mismo patrón que `arkanoid-canvas.tsx`: precarga `fruits.png` con `new Image()` dentro del `useEffect[restartKey]` y solo al `onload` (si el efecto sigue vigente) llama `createSnakeGame(canvasRef.current, callbacks)`; el cleanup destruye el motor si ya se creó, o marca la carga en curso como obsoleta si todavía no resolvía. Otro `useEffect` con dependencia `paused` llama `handle.setPaused(paused)`. Props idénticas a los 3 canvas existentes (`paused`, `restartKey`, `onStateChange`, `onGameOver`).
- Los assets se copian a `public/games/snake/fruits.png` para poder servirse como estático de Next.js.
- Un solo HUD visible: Puntuación/Vidas/Nivel ya existentes en React; no se dibuja HUD ni overlay de game over dentro del canvas.
- PAUSA/REANUDAR detiene y reanuda de verdad el tick de movimiento del motor real (no solo una etiqueta visual). JUGAR DE NUEVO reinicia el motor a un estado nuevo (serpiente de 3 segmentos centrada, score 0, nivel 1) sin recargar la página, incrementando `restartKey`.
- Controles: solo flechas (`←`/`→`/`↑`/`↓`) para cambiar de dirección, igual criterio que los 3 juegos reales anteriores; se agrega `preventDefault()` en esos 4 códigos de tecla mientras el motor está montado, para que no hagan scroll de la página.
- Guardado de la puntuación final vía `saveScore()` ya existente (`lib/scores.ts`, inserta en Supabase) — sin cambios a ese archivo ni a `lib/supabase/games.ts`.
- **Agregar la entrada `"snake": SnakeCanvas` a `GAME_CANVAS_REGISTRY`** en el `lib/games/registry.ts` ya existente (hoy cubre `"asteroids"`, `"tetris"` y `"arkanoid"`) — no se recrea el archivo ni se cambia su forma (`GameCanvasProps`/`GameCanvasComponent` ya sirven sin modificación).
- Limpiar la referencia mock rezagada a "Serpentina" en `components/home.tsx` (`TICKER`, fila `{ p: "ARKADYA", g: "Serpentina", ... }`) a `"Snake"` — mismo tipo de limpieza de copy que hicieron PR #15, SPEC 07 y SPEC 08 en el mismo array. (La copy de `FEATURES` en el mismo archivo ya dice "Arkanoid, Tetris, Snake y muchos más" — no requiere cambios.)

**Out of scope (para specs futuros):**

- Los 4 juegos restantes sin motor real (Glotón, Invasores, Ranaria, Duelo Pixel) — siguen usando el Reproductor decorativo, sin cambios en este spec.
- Cambios a `lib/scores.ts` o `lib/supabase/games.ts` — el leaderboard/catálogo ya es genérico por `game.id` desde SPEC 06.
- Cambios al contrato `lib/games/engine.ts` (`GameCallbacks`/`GameHandle`/`GameFactory`) — SNAKE encaja en el contrato existente sin modificarlo.
- Puntajes variables por tipo de fruta — se descarta explícitamente (ver Decisions); todas las frutas otorgan el mismo puntaje fijo, el sprite variado es solo cosmético.
- Wraparound en los bordes del tablero — se descarta explícitamente (ver Decisions); chocar con cualquier pared es game over.
- Controles táctiles/on-screen ni soporte de swipe para dispositivos sin teclado físico.
- Sonido/música.
- Tests automatizados.

---

## Data model

Migración SQL de renombrado (vía `mcp__supabase__apply_migration`; sin cambios de esquema, solo datos de la fila existente):

```sql
update games
set id = 'snake', title = 'SNAKE'
where id = 'serpentina';
```

No agrega tablas ni cambia `lib/scores.ts` ni `lib/supabase/games.ts` (ya genéricos por `game.id`). No cambia el contrato `lib/games/engine.ts` ni la forma de `lib/games/registry.ts`. Introduce:

```ts
// lib/games/snake/engine.ts
export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle;
```

```ts
// lib/games/registry.ts (entrada nueva sobre el mapa ya existente)
export const GAME_CANVAS_REGISTRY: Record<string, GameCanvasComponent>;
// { asteroids: AsteroidsCanvas, tetris: TetrisCanvas, arkanoid: ArkanoidCanvas, snake: SnakeCanvas }
```

---

## Implementation plan

1. Aplicar la migración de renombrado con `mcp__supabase__apply_migration`: `UPDATE games SET id = 'snake', title = 'SNAKE' WHERE id = 'serpentina'`. Verificación: `mcp__supabase__execute_sql` con `SELECT id, title FROM games WHERE id IN ('snake','serpentina')` devuelve una sola fila (`snake`/`SNAKE`); `SELECT count(*) FROM scores WHERE game_id = 'serpentina'` sigue en `0`.
2. Copiar `references/started-games/05-snake/fruits.png` a `public/games/snake/fruits.png`. Verificación: el archivo se sirve en `http://localhost:3000/games/snake/fruits.png` con `next dev` corriendo.
3. Crear `lib/games/snake/engine.ts` con la mecánica descrita en el Scope, portando las coordenadas de `SPRITE_ATLAS.fruits` de `references/started-games/05-snake/sprites.js` (22 recortes `{x, y, w, h}` dentro de `fruits.png`) como una constante TypeScript tipada. Constantes de balance: `COLS=20`, `ROWS=15`, `CELL=40`, tick inicial `150ms`, `+10` pts/fruta, cada `5` frutas sube `level` y reduce el tick a `max(60, 150 - (level-1)*10)`. Todo el estado mutable (segmentos, dirección actual/pendiente, posición y sprite de la fruta actual, score, frutas comidas, nivel, tick acumulado, listeners de teclado, `requestAnimationFrame` pendiente) encapsulado dentro de `createSnakeGame(canvas, callbacks)`. La factory recibe la imagen de `fruits.png` ya cargada como parámetro (ver paso 4) y usa `drawImage` con las coordenadas del atlas para dibujar la fruta actual escalada a una celda; la serpiente se dibuja con `fillRect` por segmento (sin sprite propio, solo la fruta usa el atlas). `callbacks.onStateChange({ score, lives: 1, level })` en cada tick; `callbacks.onGameOver(score)` una sola vez al detectar colisión con pared o con el propio cuerpo. `setPaused(true)` detiene el avance de ticks (el canvas queda congelado en el último frame); `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, evitando inversión directa de 180°. Verificación: `npx tsc --noEmit` sin errores.
4. Crear `components/games/snake-canvas.tsx` siguiendo el patrón de `arkanoid-canvas.tsx` (mismas props, canvas 800×600 con el mismo CSS de posicionamiento absoluto), precargando `new Image()` apuntando a `/games/snake/fruits.png` dentro del `useEffect[restartKey]` y solo al `onload` (si el efecto sigue vigente) llamando `createSnakeGame(canvasRef.current, callbacks)`. Verificación: `npx tsc --noEmit` sin errores; compila como Client Component (`"use client"`).
5. Modificar `lib/games/registry.ts`: importar `SnakeCanvas` y agregar `snake: SnakeCanvas` a `GAME_CANVAS_REGISTRY`, sin tocar `GameCanvasProps`/`GameCanvasComponent` ni las entradas existentes de `asteroids`/`tetris`/`arkanoid`. Verificación: `npx tsc --noEmit` sin errores.
6. Actualizar `components/home.tsx`: cambiar la fila del `TICKER` mock `{ p: "ARKADYA", g: "Serpentina", s: 7820, t: "hace 24 min", c: "green" }` a `g: "Snake"`. Verificación: `grep -ri "serpentina" app components lib` no devuelve resultados fuera de `references/`.
7. Verificación end-to-end manual: jugar una partida completa de SNAKE en `/juego/snake/jugar` — mover con las 4 flechas confirmando que no se puede invertir 180° directamente, comer frutas viendo el sprite real variar aleatoriamente y sumando `+10` pts c/u, ver que la serpiente crece un segmento por fruta, confirmar que sube de `Nivel` cada 5 frutas y la serpiente acelera, chocar contra una pared y confirmar que abre el modal "FIN DEL JUEGO" automáticamente con la puntuación real, y por separado chocar contra el propio cuerpo y confirmar el mismo resultado. Guardar la puntuación (aparece en `/salon` tab SNAKE y en el leaderboard de `/juego/snake` tras recargar) y reiniciar con "JUGAR DE NUEVO" sin recargar la página. Probar PAUSA/REANUDAR (el canvas se congela y continúa) y el botón FIN como abandono manual. Confirmar que `/juego/asteroids/jugar`, `/juego/tetris/jugar` y `/juego/arkanoid/jugar` siguen funcionando sin regresión, y que los 4 juegos restantes sin motor real siguen mostrando el arena decorativo. Verificación final: `npm run lint` y `npm run build` pasan sin errores.

---

## Acceptance criteria

- [ ] La tabla `games` en Supabase ya no tiene ninguna fila con `id = 'serpentina'`; existe `id = 'snake'` / `title = 'SNAKE'` con el resto de columnas (`short`/`long`/`cat`/`cover`/`color`) sin cambios respecto a la fila original.
- [ ] `lib/games/snake/engine.ts` exporta `createSnakeGame(canvas, callbacks): GameHandle` con movimiento en cuadrícula (20×15 celdas), crecimiento al comer fruta, sprite de fruta real elegido al azar del atlas de `fruits.png`, `+10` pts/fruta fijo, subida de nivel + aceleración cada 5 frutas, y game over al chocar con pared o con el propio cuerpo.
- [ ] `/juego/snake/jugar` renderiza el canvas real dentro del `.crt-screen` y es jugable con las 4 flechas; esas teclas ya no hacen scroll de la página mientras el juego está montado. No es posible invertir la dirección 180° en un solo tick.
- [ ] El HUD de React (Puntuación/Vidas/Nivel) en `/juego/snake/jugar` refleja el estado real del motor en vivo; `Vidas` muestra una sola `♥` durante la partida.
- [ ] Chocar con una pared o con el propio cuerpo abre automáticamente el modal "FIN DEL JUEGO" con la puntuación real; guardar la puntuación persiste una fila real en Supabase (`scores.game_id = "snake"`).
- [ ] El botón FIN en SNAKE abandona la partida en curso y abre el mismo modal con la puntuación acumulada hasta ese momento.
- [ ] PAUSA detiene visualmente el juego real (el canvas deja de actualizarse) y REANUDAR lo continúa sin reiniciar el progreso.
- [ ] JUGAR DE NUEVO desde el modal reinicia una partida nueva de SNAKE (serpiente de 3 segmentos, puntuación 0, nivel 1) sin recargar la página.
- [ ] `lib/games/registry.ts` sigue siendo el mismo archivo (no se recrea) y `GAME_CANVAS_REGISTRY` ahora cubre `"asteroids"`, `"tetris"`, `"arkanoid"` y `"snake"`.
- [ ] `/juego/asteroids/jugar`, `/juego/tetris/jugar` y `/juego/arkanoid/jugar` siguen funcionando exactamente igual que antes de este spec (sin regresión).
- [ ] Los 4 juegos restantes sin motor real se ven y funcionan exactamente igual que antes de este spec (arena decorativo, timer falso de puntuación).
- [ ] `components/home.tsx` ya no contiene la referencia mock "Serpentina" en `TICKER`.
- [ ] `npm run build` y `npm run lint` completan sin errores de tipos ni de ESLint.

---

## Decisions

- **Sí:** renombrar la fila del catálogo de `id: "serpentina"` / `title: "SERPENTINA"` a `id: "snake"` / `title: "SNAKE"` mediante una migración real en Supabase (`UPDATE`), en vez de mantener el id `serpentina` y solo cambiar el título, o de crear una fila nueva. Razón: decidido explícitamente por el usuario; mismo tratamiento completo (id + título) que recibieron ROCAS→ASTEROIDS, CAÍDA→TETRIS y BLOQUE BUSTER→ARKANOID, y consistente en toda la app (URLs, `lib/games/snake/`, registro) en vez de una identidad dividida entre id interno y nombre visible.
- **Sí:** verificar antes de migrar que `scores` no tiene ninguna fila con `game_id = 'serpentina'` (confirmado: `0` filas), por lo que el `UPDATE` de `games.id` no viola el FK `scores_game_id_fkey` ni requiere una migración adicional sobre `scores`. Razón: verificación técnica necesaria antes de ejecutar un `UPDATE` sobre una primary key referenciada por FK; mismo chequeo que ya hicieron SPEC 07/08.
- **Sí:** diseñar la mecánica de SNAKE desde cero siguiendo las reglas clásicas del género, ya que `references/started-games/05-snake` no trae ningún archivo de lógica jugable (solo `sprites.js` + `fruits.png`). Razón: confirmado explícitamente por el usuario al elegir todas las opciones recomendadas de diseño (fruta con sprite real y puntaje único, game over al chocar con pared, `lives: 1` fijo, nivel/velocidad progresivos cada 5 frutas) en la fase de preguntas de este spec.
- **Sí:** usar los sprites reales del atlas `SPRITE_ATLAS.fruits` (`fruits.png`, 22 frutas) para dibujar la fruta, eligiendo una al azar en cada aparición, pero con un puntaje fijo (`+10`) independiente del tipo de fruta dibujado — sin tabla de puntos variable por fruta. Razón: decidido explícitamente por el usuario; reutiliza el único asset real disponible para este juego (mismo criterio que ARKANOID reutilizando su spritesheet real) sin la complejidad adicional de un sistema de puntajes por tipo de fruta.
- **Sí:** game over al chocar contra cualquier borde del tablero (sin wraparound), además de al chocar contra el propio cuerpo. Razón: decidido explícitamente por el usuario; es la regla clásica de Snake que la mayoría de jugadores espera, a diferencia del wraparound toroidal que sí usa ROCAS/Asteroids.
- **Sí:** `lives: 1` fijo durante toda la partida (mismo tratamiento que TETRIS en SPEC 07). Razón: decidido explícitamente por el usuario — Snake no tiene vidas múltiples clásicamente, cualquier colisión termina la partida directamente.
- **Sí:** nivel y velocidad progresan cada 5 frutas comidas, con una fórmula de aceleración con piso (`max(60, 150 - (level-1)*10)` ms de intervalo entre ticks). Razón: decidido explícitamente por el usuario; mismo espíritu que la aceleración de TETRIS por líneas eliminadas, adaptado a "frutas comidas" como métrica de progreso de Snake.
- **Sí:** agregar la entrada `"snake"` al `lib/games/registry.ts` ya existente en vez de recrearlo o duplicarlo. Razón: el registro ya existe desde SPEC 07 (extendido en SPEC 08) y ya cubre `asteroids`/`tetris`/`arkanoid` correctamente; solo falta esta entrada.
- **No:** no se agregan controles táctiles/on-screen ni soporte de swipe. Razón: mismo criterio ya aplicado a ASTEROIDS/TETRIS/ARKANOID; se documenta como limitación conocida (ver Risks).
- **No:** no se agrega sonido/música. Razón: mismo criterio que ASTEROIDS/TETRIS (sin audio en su referencia); SNAKE tampoco trae assets de audio.
- **No:** no se toca `lib/scores.ts` ni `lib/supabase/games.ts` más allá de la migración de renombrado de la fila de `games`. Razón: SPEC 06 ya los dejó genéricos por `game.id`; SNAKE los usa sin cambios de código.

---

## Risks

| Riesgo                                                                                                                                                                                                                                                                                                                                  | Mitigación                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un `UPDATE` sobre `games.id` (primary key referenciada por FK) podría fallar o dejar huérfanas filas de `scores` si ya existieran puntuaciones guardadas para `serpentina`.                                                                                                                                                             | Verificado antes de escribir este spec: `SELECT count(*) FROM scores WHERE game_id = 'serpentina'` devuelve `0` — no hay partidas jugadas todavía bajo ese id, así que el `UPDATE` es seguro sin necesidad de migrar filas de `scores` en paralelo. El paso 1 del plan repite esta verificación antes y después de aplicar la migración. |
| Sin ningún `game.js` de referencia, la mecánica completa (colisiones, crecimiento, progresión de nivel) se diseña desde cero para este spec, a diferencia de ASTEROIDS/TETRIS/ARKANOID que portaron lógica ya probada. Un error de diseño podría producir un juego injusto o con bugs de colisión no detectados hasta jugarlo.          | Las reglas elegidas son las convenciones clásicas y ampliamente conocidas de Snake (sin sorpresas de diseño); el paso 7 del plan exige una partida completa jugada manualmente cubriendo colisión con pared, colisión con el propio cuerpo, crecimiento y progresión de nivel antes de dar por cerrado el spec.                          |
| El movimiento en cuadrícula por "tick" (a diferencia del movimiento continuo por frame de ASTEROIDS/ARKANOID) es un patrón de game loop distinto dentro del mismo repo; un manejo incorrecto del acumulador de tiempo podría producir movimiento entrecortado o input perdido si el jugador cambia de dirección más rápido que el tick. | La dirección pendiente se guarda en una variable separada dentro del closure y solo se aplica al inicio del siguiente tick (un cambio de dirección por tick), patrón estándar de Snake que evita perder inputs rápidos o aplicar más de un giro por tick. Verificado manualmente en el paso 7 del plan.                                  |
| Elegir una fruta aleatoria del atlas de 22 sprites en cada aparición podría, por azar, dibujar visualmente la misma fruta varias veces seguidas, lo cual algún usuario podría interpretar erróneamente como un bug de que "no cambia la fruta".                                                                                         | Es puramente cosmético y no afecta el puntaje (`+10` fijo independiente del sprite); no requiere mitigación funcional, se documenta aquí como comportamiento esperado.                                                                                                                                                                   |
| Sin controles táctiles, SNAKE no es jugable en dispositivos sin teclado físico (móvil/tablet).                                                                                                                                                                                                                                          | Aceptado como limitación conocida, mismo criterio que ASTEROIDS/TETRIS/ARKANOID; se evaluaría un spec futuro de controles táctiles si se necesita para todos los juegos reales.                                                                                                                                                          |

---

## What is **not** in this spec

- Nota de formato: no se encontró un skill `/spec` instalado en esta máquina (buscado en rutas de skills de usuario y del proyecto); este spec sigue el resumen de formato incluido en `/add-game` (mismo orden y tono de SPEC 05/06/07/08).
- Los 4 juegos restantes sin motor real (Glotón, Invasores, Ranaria, Duelo Pixel) — siguen decorativos.
- Puntajes variables por tipo de fruta.
- Wraparound en los bordes del tablero.
- Controles táctiles/on-screen.
- Sonido/música.
- Cambios a `lib/scores.ts` o `lib/supabase/games.ts` más allá de la migración de renombrado.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
