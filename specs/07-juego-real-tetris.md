# SPEC 07 — Segundo juego real: TETRIS

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-09-05
> **Objective:** Renombrar el juego `caida`/"CAÍDA" a `tetris`/"TETRIS" en el catálogo de Supabase (mismo tratamiento que PR #15 hizo con ROCAS→ASTEROIDS) y reemplazar el arena decorativo del Reproductor de TETRIS por el motor real de `references/started-games/03-tetris` (portado a TypeScript y encapsulado en el mismo contrato reutilizable `lib/games/engine.ts` que ya usa ASTEROIDS), integrado con el HUD y el modal de fin de partida ya existentes, y migrar el wiring de `game-player.tsx` de un booleano hardcodeado a un registro genérico juego→componente.

---

## Por qué existe este spec

SPEC 05 dejó el contrato `lib/games/engine.ts` (`GameCallbacks`/`GameHandle`/`GameFactory`) y el primer juego real (ASTEROIDS). SPEC 06 hizo el leaderboard y el catálogo 100% genéricos por `game.id` en Supabase, sin cambios necesarios para agregar juegos nuevos. `references/started-games/03-tetris` es un clon jugable de Tetris ya terminado (canvas HTML5 puro, sin dependencias, ~300 líneas en `game.js`).

La entrada del catálogo que corresponde temáticamente a este juego existe hoy en Supabase como `id: "caida"` / `title: "CAÍDA"` (categoría PUZZLE). El usuario pidió explícitamente que este juego se identifique como **TETRIS, no CAÍDA** — el mismo tratamiento que ya recibió ROCAS→ASTEROIDS en PR #15 (`151f76d`, "Refactor game references from 'Rocas' to 'Asteroids'"). A diferencia de aquel caso (donde la fila en Supabase ya se había sembrado como `asteroids`/`ASTEROIDS` desde la migración inicial de SPEC 06, y el PR #15 solo limpió referencias de código/copy que habían quedado rezagadas), aquí la fila **sí existe hoy en la base de datos** como `caida`/`CAÍDA`, así que este spec sí necesita una migración real de renombrado antes de portar el motor.

Este es el segundo juego real del Vault. Hasta ahora `components/game-player.tsx` resuelve qué canvas renderizar con un único booleano hardcodeado (`isAsteroids = game.id === "asteroids"`), lo cual no escala a un segundo juego real. Este spec también migra ese wiring a un registro (`lib/games/registry.ts`) que cubre `"asteroids"` y `"tetris"`, dejando el patrón listo para los próximos juegos reales sin volver a tocar `game-player.tsx` en cada uno.

---

## Scope

**In:**

- **Migración de renombrado en Supabase:** actualizar la fila existente de `games` de `id: "caida"` / `title: "CAÍDA"` a `id: "tetris"` / `title: "TETRIS"`, vía `mcp__supabase__apply_migration` (consistente con que SPEC 06 ya usa esa herramienta para todo cambio de esquema/datos del catálogo). Verificado que hoy `scores` no tiene ninguna fila con `game_id = 'caida'` (`SELECT count(*) FROM scores WHERE game_id = 'caida'` devuelve `0`), así que el `UPDATE` no viola el FK `scores_game_id_fkey` (`ON UPDATE NO ACTION`) ni requiere tocar `scores`.
- Puerto a TypeScript de la lógica de `references/started-games/03-tetris/game.js` (tablero 10×20, las 7 piezas estándar + la pieza extra "N/tuerca" ya presente en el original — 8 tipos en total, colores diferenciados, rotación con wall kicks básicos ±1/±2 columnas, soft drop y hard drop, pieza fantasma, vista previa de la siguiente pieza, puntuación clásica `[0,100,300,500,800]` multiplicada por nivel + 2 pts/celda en hard drop + 1 pt/fila en soft drop, niveles que suben cada 10 líneas acelerando `dropInterval` según `max(100, 1000 - (level-1)*90)`) en `lib/games/tetris/engine.ts`, encapsulado en una función factory `createTetrisGame(canvas, callbacks): GameHandle` — mismo patrón que `lib/games/asteroids/engine.ts`: todo el estado mutable (tablero, pieza actual/siguiente, score, líneas, nivel, `dropAccum`, listeners de teclado, `requestAnimationFrame` pendiente) vive dentro del closure de la factory, sin variables de módulo.
- `components/games/tetris-canvas.tsx` (Client Component), mismo patrón exacto que `components/games/asteroids-canvas.tsx`: un `<canvas width={800} height={600}>` con `position:absolute; inset:0; width:100%; height:100%` para llenar `.crt-screen` (4:3), un `useEffect` con dependencia `restartKey` que crea el motor con `createTetrisGame` y lo destruye en el cleanup, y otro `useEffect` con dependencia `paused` que solo llama `handle.setPaused(paused)`. Props idénticas a `AsteroidsCanvas` (`paused`, `restartKey`, `onStateChange`, `onGameOver`).
- Dentro del único canvas 800×600: el tablero 10×20 (con su grid, pieza fantasma con `globalAlpha=0.2`, y la pieza actual) se dibuja centrado y escalado a un tamaño de bloque que aproveche la altura disponible del canvas (referencia: bloque de 30px en el original a 300×600 lógico; en 800×600 se recalcula el `BLOCK` para mantener proporción y centrar horizontalmente). La vista previa de "siguiente pieza" (`drawNext()` del original) se dibuja como un recuadro superpuesto en la esquina superior derecha del mismo canvas, en el mismo contexto 2D — no se crea un segundo `<canvas>` ni se cambia el contrato para soportarlo.
- Un solo HUD visible: `SCORE`/`LINES`/`LEVEL` y el overlay `GAME OVER`/`PAUSA` dibujados en el original **no** se portan — el HUD de React (Puntuación/Vidas/Nivel) ya existente en `game-player.tsx` cubre score y nivel. El contador de líneas eliminadas (`lines`) no tiene slot propio en el HUD (`GameCallbacks.onStateChange` solo expone `score`/`lives`/`level`) y no se agrega uno nuevo — se sigue usando internamente solo para calcular `level` (cada 10 líneas) y `dropInterval`, sin exponerse.
- Pausa: se elimina el listener de la tecla `P` del original. La única fuente de pausa es `GameHandle.setPaused(paused)`, llamado por `game-player.tsx` desde el botón PAUSA/REANUDAR ya existente — mismo patrón que ASTEROIDS (que tampoco tiene tecla de pausa interna). `setPaused(true)` detiene las llamadas a la lógica de caída/`loop` (el canvas queda congelado en el último frame dibujado).
- Fin de partida real: TETRIS tiene **una sola vida** — al hacer topout (una pieza nueva colisiona al aparecer, igual que `spawn()`/`endGame()` del original) se llama `callbacks.onGameOver(score)` una sola vez, lo que dispara automáticamente el mismo modal "FIN DEL JUEGO" ya existente (input de nombre, GUARDAR PUNTUACIÓN, JUGAR DE NUEVO, VOLVER AL VAULT), usando la puntuación real del motor. El botón FIN se mantiene, como abandono manual con la puntuación acumulada hasta ese momento.
- `onStateChange({ score, lives, level })` se llama con `lives` fijo en `1` en todo momento mientras la partida está en curso (nunca `0` antes de game over, ya que TETRIS no tiene múltiples vidas ni las va perdiendo una por una) — el HUD de React sigue mostrando `♥` (una sola) durante la partida.
- JUGAR DE NUEVO reinicia el motor a un estado nuevo (tablero vacío, pieza nueva, score 0, nivel 1) sin recargar la página, incrementando `restartKey` — mismo mecanismo que ASTEROIDS.
- Controles idénticos al original: `←`/`→` mover horizontal, `↑` o `X` rotar (con wall kicks), `↓` soft drop, `Espacio` hard drop. Se agrega `preventDefault()` en `ArrowLeft`/`ArrowRight`/`ArrowDown`/`ArrowUp`/`Space` mientras el motor está montado (el original solo lo hacía en `Space`), consistente con el precedente de ASTEROIDS, para que no hagan scroll de la página.
- Guardado de la puntuación final vía `saveScore()` ya existente (`lib/scores.ts`, inserta en Supabase) — sin cambios a ese archivo ni a `lib/supabase/games.ts`.
- **Migración del wiring de `game-player.tsx` a un registro genérico:** crear `lib/games/registry.ts` que exporte un mapa `game.id -> Componente` (p. ej. `GAME_CANVAS_REGISTRY: Record<string, GameCanvasComponent>` con entradas `"asteroids": AsteroidsCanvas` y `"tetris": TetrisCanvas`), con un tipo común de props (`paused`, `restartKey`, `onStateChange`, `onGameOver`) que ambos componentes ya cumplen. `game-player.tsx` reemplaza `const isAsteroids = game.id === "asteroids"` por una búsqueda en el registro (`const EngineCanvas = GAME_CANVAS_REGISTRY[game.id]`); si existe, renderiza `<EngineCanvas .../>` y usa `engineState` para el HUD; si no existe (los 6 juegos restantes sin motor real), renderiza el arena decorativo + timer falso, exactamente igual que hoy.
- Limpiar la referencia mock rezagada a "Caída" en `components/home.tsx` (`TICKER`, fila `{ p: "NEONFOX", g: "Caída", ... }`) a `"Tetris"` — mismo tipo de limpieza de copy que hizo PR #15 con la fila de "Rocas" en el mismo array.

**Out of scope (para specs futuros):**

- Los otros 6 juegos del Vault sin motor real (Bloque Buster, Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel) — siguen usando el Reproductor puramente decorativo, sin cambios en este spec.
- Cambios a `lib/scores.ts` o `lib/supabase/games.ts` — el leaderboard/catálogo ya es genérico por `game.id` desde SPEC 06, sin cambios necesarios más allá de la migración de renombrado descrita arriba.
- Cambios al contrato `lib/games/engine.ts` (`GameCallbacks`/`GameHandle`/`GameFactory`) — TETRIS encaja en el contrato existente sin modificarlo.
- Un evento o slot de HUD dedicado para "líneas eliminadas" — se descarta explícitamente (ver Decisions); solo se usa internamente.
- Controles táctiles/on-screen para jugar en dispositivos sin teclado físico — el original tampoco los tiene, mismo criterio que ASTEROIDS.
- Sonido/música.
- Actualizar `best`/`plays` de TETRIS con datos reales fuera del flujo normal de `saveScore()` (ya se calculan en vivo desde SPEC 06, sin cambios necesarios).
- Tests automatizados.

---

## Data model

Migración SQL de renombrado (vía `mcp__supabase__apply_migration`; sin cambios de esquema, solo datos de la fila existente):

```sql
update games
set id = 'tetris', title = 'TETRIS'
where id = 'caida';
```

No agrega tablas ni cambia `lib/scores.ts` ni `lib/supabase/games.ts` (ya genéricos por `game.id` desde SPEC 06). No cambia el contrato `lib/games/engine.ts`. Introduce:

```ts
// lib/games/tetris/engine.ts
export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle;
```

```ts
// lib/games/registry.ts
export interface GameCanvasProps {
  paused: boolean;
  restartKey: number;
  onStateChange: (state: {
    score: number;
    lives: number;
    level: number;
  }) => void;
  onGameOver: (finalScore: number) => void;
}
export type GameCanvasComponent = (
  props: GameCanvasProps,
) => React.ReactElement;

export const GAME_CANVAS_REGISTRY: Record<string, GameCanvasComponent>;
// { asteroids: AsteroidsCanvas, tetris: TetrisCanvas }
```

---

## Implementation plan

1. Aplicar la migración de renombrado con `mcp__supabase__apply_migration`: `UPDATE games SET id = 'tetris', title = 'TETRIS' WHERE id = 'caida'`. Verificación: `mcp__supabase__execute_sql` con `SELECT id, title FROM games WHERE id IN ('tetris','caida')` devuelve una sola fila (`tetris`/`TETRIS`); `SELECT count(*) FROM scores WHERE game_id = 'caida'` sigue en `0`.
2. Crear `lib/games/tetris/engine.ts` portando la lógica de `references/started-games/03-tetris/game.js` a TypeScript: mismas constantes de balance (`COLS=10`, `ROWS=20`, 8 tipos de pieza con sus formas y colores, `LINE_SCORES=[0,100,300,500,800]`, wall kicks `[0,-1,1,-2,2]`, `dropInterval` inicial 1000ms y su fórmula de aceleración por nivel), pero con todo el estado mutable (`board`, `current`, `next`, `score`, `lines`, `level`, `dropAccum`, `dropInterval`, listeners de teclado, `requestAnimationFrame` pendiente) encapsulado dentro de `createTetrisGame(canvas, callbacks)` en vez de variables de módulo top-level. Sin listener de tecla `P` (pausa solo vía `setPaused`). El tablero se dibuja centrado en el canvas 800×600 con un `BLOCK` recalculado para aprovechar la altura disponible; la vista previa de "siguiente pieza" se dibuja en una esquina del mismo canvas/contexto. `callbacks.onStateChange({ score, lives: 1, level })` se llama en cada frame; `callbacks.onGameOver(score)` se llama una sola vez cuando una pieza nueva colisiona al aparecer (topout). `setPaused(true)` detiene la lógica de caída; `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado agregados. Verificación: `npx tsc --noEmit` sin errores.
3. Crear `components/games/tetris-canvas.tsx` siguiendo exactamente el patrón de `components/games/asteroids-canvas.tsx` (mismo tipo de props, mismo manejo de `restartKey`/`paused` en `useEffect`s separados, canvas 800×600 con el mismo CSS de posicionamiento absoluto). Verificación: `npx tsc --noEmit` sin errores; compila como Client Component (`"use client"`).
4. Crear `lib/games/registry.ts` con `GameCanvasProps`, `GameCanvasComponent` y `GAME_CANVAS_REGISTRY` mapeando `"asteroids" -> AsteroidsCanvas` y `"tetris" -> TetrisCanvas`. Verificación: `npx tsc --noEmit` sin errores.
5. Modificar `components/game-player.tsx`: reemplazar `const isAsteroids = game.id === "asteroids"` y el uso directo de `<AsteroidsCanvas .../>` por `const EngineCanvas = GAME_CANVAS_REGISTRY[game.id]` y `const hasRealEngine = Boolean(EngineCanvas)`; donde antes se usaba `isAsteroids` para decidir HUD/timer falso/render del `.crt-screen`, usar `hasRealEngine`. Cuando `hasRealEngine` es `true`, renderizar `<EngineCanvas paused={paused || over} restartKey={restartKey} onStateChange={setEngineState} onGameOver={handleEngineGameOver} />` (mismas props que hoy recibía `AsteroidsCanvas`). El resto de la lógica (`endGame`, `restart`, `handleEngineGameOver`, `handleSave`) no cambia de forma, solo la condición que las activa. Verificación manual: `/juego/asteroids/jugar` sigue funcionando exactamente igual que antes de este spec (regresión); `/juego/tetris/jugar` muestra el Tetris real jugable; `/juego/invasores/jugar` (u otro sin motor) sigue mostrando el arena decorativo sin cambios.
6. Actualizar `components/home.tsx`: cambiar la fila del `TICKER` mock `{ p: "NEONFOX", g: "Caída", s: 184220, t: "hace 2 min", c: "magenta" }` a `g: "Tetris"`. Verificación: `grep -ri "caída\|caida" app components lib` no devuelve resultados fuera de `references/`.
7. Verificación end-to-end manual de TETRIS: jugar una partida completa — mover piezas, rotar con wall kicks, soft drop y hard drop, ver la pieza fantasma y la vista previa de la siguiente pieza, limpiar líneas simples y múltiples confirmando la puntuación `100/300/500/800 × nivel`, subir de nivel cada 10 líneas y notar la aceleración de caída, perder por topout y confirmar que se abre el modal "FIN DEL JUEGO" automáticamente con la puntuación real, guardar la puntuación (aparece en `/salon` tab TETRIS y en el leaderboard de `/juego/tetris` tras recargar) y reiniciar con "JUGAR DE NUEVO" sin recargar la página. Probar también PAUSA/REANUDAR (el canvas se congela y continúa) y el botón FIN como abandono manual. Verificación final: `npm run lint` y `npm run build` pasan sin errores.

---

## Acceptance criteria

- [ ] La tabla `games` en Supabase ya no tiene ninguna fila con `id = 'caida'`; existe `id = 'tetris'` / `title = 'TETRIS'` con el resto de columnas (`short`/`long`/`cat`/`cover`/`color`) sin cambios respecto a la fila original.
- [ ] `lib/games/tetris/engine.ts` exporta `createTetrisGame(canvas, callbacks): GameHandle` con la misma mecánica que `references/started-games/03-tetris/game.js` (8 piezas, wall kicks, soft/hard drop, pieza fantasma, vista previa de siguiente pieza, puntuación y niveles idénticos al original).
- [ ] `/juego/tetris/jugar` renderiza el canvas real dentro del `.crt-screen` y es jugable con `←`/`→`/`↑`/`X`/`↓`/`Espacio`; esas teclas ya no hacen scroll de la página mientras el juego está montado.
- [ ] El HUD de React (Puntuación/Vidas/Nivel) en `/juego/tetris/jugar` refleja el estado real del motor en vivo; `Vidas` muestra una sola `♥` durante la partida.
- [ ] El topout (pieza nueva colisiona al aparecer) abre automáticamente el modal "FIN DEL JUEGO" con la puntuación real; guardar la puntuación persiste una fila real en Supabase (`scores.game_id = "tetris"`).
- [ ] El botón FIN en TETRIS abandona la partida en curso y abre el mismo modal con la puntuación acumulada hasta ese momento.
- [ ] PAUSA detiene visualmente el juego real (el canvas deja de actualizarse) y REANUDAR lo continúa sin reiniciar el progreso; no existe una tecla `P` interna que pause por su cuenta.
- [ ] JUGAR DE NUEVO desde el modal reinicia una partida nueva de TETRIS (tablero vacío, puntuación 0, nivel 1) sin recargar la página.
- [ ] `lib/games/registry.ts` existe y `GAME_CANVAS_REGISTRY` cubre `"asteroids"` y `"tetris"`; `components/game-player.tsx` ya no usa el booleano hardcodeado `game.id === "asteroids"` como única condición de motor real.
- [ ] `/juego/asteroids/jugar` sigue funcionando exactamente igual que antes de este spec tras la migración al registro (sin regresión).
- [ ] Los 6 juegos restantes sin motor real (`game.id` fuera del registro) se ven y funcionan exactamente igual que antes de este spec (arena decorativo, timer falso de puntuación).
- [ ] `components/home.tsx` ya no contiene la referencia mock "Caída" en `TICKER`.
- [ ] `npm run build` y `npm run lint` completan sin errores de tipos ni de ESLint.

---

## Decisions

- **Sí:** renombrar la fila del catálogo de `id: "caida"` / `title: "CAÍDA"` a `id: "tetris"` / `title: "TETRIS"` mediante una migración real en Supabase (`UPDATE`), en vez de mantener el id `caida` y solo cambiar el título, o de crear una fila nueva. Razón: decidido explícitamente por el usuario ("este juego es TETRIS NO CAIDAS"); mismo tratamiento completo (id + título) que recibió ROCAS→ASTEROIDS en PR #15, y consistente en toda la app (URLs, `lib/games/tetris/`, registro) en vez de una identidad dividida entre id interno y nombre visible.
- **Sí:** verificar antes de migrar que `scores` no tiene ninguna fila con `game_id = 'caida'` (confirmado: `0` filas), por lo que el `UPDATE` de `games.id` no viola el FK `scores_game_id_fkey` (`ON UPDATE NO ACTION`) ni requiere una migración adicional sobre `scores`. Razón: verificación técnica necesaria antes de ejecutar un `UPDATE` sobre una primary key referenciada por FK; de haber existido filas en `scores`, este spec habría tenido que documentar una decisión explícita sobre cómo migrarlas (no fue necesario).
- **Sí:** limpiar también la referencia mock rezagada a "Caída" en `components/home.tsx` (`TICKER`) como parte de este mismo spec. Razón: es el mismo tipo de limpieza de copy que ya hizo PR #15 para "Rocas" en el mismo array; dejarla inconsistente confundiría al usuario final viendo "Caída" en el ticker de Home mientras el juego real se llama TETRIS.
- **Sí:** TETRIS reporta `lives: 1` fijo mientras la partida está en curso (nunca `0` antes del game over). Razón: decidido explícitamente por el usuario — Tetris tiene una sola vida; perderla es directamente game over, a diferencia de ASTEROIDS que sí tiene 3 vidas decrecientes.
- **Sí:** se elimina la tecla `P` de pausa interna del original; la única fuente de pausa es `GameHandle.setPaused()`, llamado desde el botón PAUSA/REANUDAR ya existente. Razón: confirmado por el usuario — evita dos fuentes de verdad para el mismo estado; consistente con que ASTEROIDS tampoco tiene tecla de pausa propia.
- **Sí:** un solo `<canvas>` de 800×600 (mismo patrón que `AsteroidsCanvas`, sin tocar el contrato `lib/games/engine.ts`); la vista previa de "siguiente pieza" se dibuja como un recuadro superpuesto dentro del mismo canvas en vez de crear un segundo elemento `<canvas>` como en el original. Razón: confirmado por el usuario — preserva el contrato genérico de un solo canvas por juego que ya sigue ASTEROIDS, sin necesidad de generalizarlo para un caso de dos superficies de dibujo.
- **Sí:** replicar los bindings de teclado idénticos al original (`←`/`→`/`↓`/`↑`/`X`/`Espacio`, incluyendo `X` como rotación alternativa a `↑`), agregando `preventDefault()` en `ArrowLeft`/`ArrowRight`/`ArrowDown`/`ArrowUp`/`Space` mientras el motor está montado (el original solo lo hacía en `Space`). Razón: confirmado por el usuario — consistente con el precedente de ASTEROIDS de prevenir scroll de página en todas las teclas de juego.
- **Sí:** el contador de líneas eliminadas (`lines`) del original se mantiene solo como estado interno del motor (para calcular `level` y `dropInterval`) y no se expone en el HUD de React ni se agrega un campo nuevo al contrato `GameCallbacks`. Razón: decidido explícitamente por el usuario al no pedir un slot de HUD nuevo; ampliar el contrato solo para este dato sería una generalización prematura (contrario al punto 1 del conocimiento de dominio de este skill).
- **Sí:** migrar el wiring de `game-player.tsx` del booleano hardcodeado `isAsteroids` a `lib/games/registry.ts` (`GAME_CANVAS_REGISTRY`) en este mismo spec, en vez de posponerlo a un spec de refactor aparte. Razón: es la deuda técnica ya señalada por SPEC 05/06 y este skill; con el segundo juego real es el momento natural de resolverla, y no requiere tocar el contrato ni el leaderboard.
- **No:** no se cambia el contrato `lib/games/engine.ts` (`GameCallbacks`/`GameHandle`/`GameFactory`). Razón: TETRIS encaja completamente en el contrato existente sin necesidad de campos o eventos nuevos.
- **No:** no se agregan controles táctiles/on-screen. Razón: mismo criterio ya aplicado a ASTEROIDS en SPEC 05; el original tampoco los tiene.
- **No:** no se toca `lib/scores.ts` ni `lib/supabase/games.ts` más allá de la migración de renombrado de la fila de `games`. Razón: SPEC 06 ya los dejó genéricos por `game.id`; TETRIS los usa sin cambios de código.

---

## Risks

| Riesgo                                                                                                                                                                                                                                                                                                                  | Mitigación                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un `UPDATE` sobre `games.id` (primary key referenciada por FK) podría fallar o dejar huérfanas filas de `scores` si ya existieran puntuaciones guardadas para `caida`.                                                                                                                                                  | Verificado antes de escribir este spec: `SELECT count(*) FROM scores WHERE game_id = 'caida'` devuelve `0` — no hay partidas jugadas todavía bajo ese id, así que el `UPDATE` es seguro sin necesidad de migrar filas de `scores` en paralelo. El paso 1 del plan repite esta verificación antes y después de aplicar la migración. |
| Dibujar el tablero 10×20 y la vista previa de "siguiente pieza" dentro de un único canvas 800×600 (en vez de dos canvas separados como el original) requiere recalcular `BLOCK` y las coordenadas de ambos elementos; un error de escala podría solapar la vista previa con el tablero o dejar espacio muerto excesivo. | Se calcula `BLOCK` en función de la altura disponible del canvas (igual criterio que el original: bloque cuadrado, tablero centrado verticalmente) y se reserva una franja fija en la esquina superior derecha para la vista previa, verificado visualmente en el paso 7 del plan.                                                  |
| Migrar `game-player.tsx` de un booleano a una búsqueda en registro podría introducir una regresión en ASTEROIDS si el registro no mapea `"asteroids"` correctamente o si cambia sutilmente el orden de renderizado condicional.                                                                                         | El paso 5 del plan exige verificación manual explícita de que `/juego/asteroids/jugar` sigue funcionando igual que antes de este spec, antes de dar por cerrado el spec.                                                                                                                                                            |
| Sin tecla `P` interna, si `game-player.tsx` no llama `setPaused` correctamente en algún flujo (por ejemplo, al reiniciar), TETRIS podría quedar en un estado de pausa inconsistente.                                                                                                                                    | Mismo mecanismo (`useEffect` con dependencia `paused`) que ya usa `AsteroidsCanvas` y que funciona correctamente en producción para ASTEROIDS desde SPEC 05; se reutiliza sin modificaciones.                                                                                                                                       |
| Sin controles táctiles, TETRIS no es jugable en dispositivos sin teclado físico (móvil/tablet).                                                                                                                                                                                                                         | Aceptado como limitación conocida, mismo criterio que ASTEROIDS en SPEC 05; se evaluaría un spec futuro de controles táctiles si se necesita para todos los juegos reales.                                                                                                                                                          |

---

## What is **not** in this spec

- Nota de formato: no se encontró un skill `/spec` instalado en esta máquina (buscado en rutas de skills de usuario y del proyecto); este spec sigue el resumen de formato incluido en `/add-game` (mismo orden y tono de SPEC 05/06).
- Los 6 juegos restantes sin motor real (Bloque Buster, Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel) — siguen decorativos.
- Cambios al contrato `lib/games/engine.ts`.
- Un slot de HUD dedicado para líneas eliminadas.
- Controles táctiles/on-screen.
- Sonido/música.
- Cambios a `lib/scores.ts` o `lib/supabase/games.ts` más allá de la migración de renombrado.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
