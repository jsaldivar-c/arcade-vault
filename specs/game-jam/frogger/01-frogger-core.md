# SPEC — Frogger: motor real y renombrado del catálogo

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-09-10
> **Objective:** Renombrar el juego `ranaria`/"RANARIA" a `frogger`/"FROGGER" en el catálogo de Supabase (mismo tratamiento que PR #15 hizo con ROCAS→ASTEROIDS, SPEC 07 con CAÍDA→TETRIS, SPEC 08 con BLOQUE BUSTER→ARKANOID y SPEC 09 con SERPENTINA→SNAKE) y construir su motor real (`lib/games/frogger/engine.ts` + `components/games/frogger-canvas.tsx`), registrado en `lib/games/registry.ts`.

---

## Por qué existe este spec

Este spec nació como copia de un ejercicio de curso que integraba Frogger con una arquitectura propia: un componente `FroggerGame.tsx` con props `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver` por separado, una play-page dedicada `app/games/frogger/play/page.tsx`, un `id` de catálogo `frogger` insertado por `INSERT`, y un `color: 'lime'`. La arquitectura de props/rutas no existe en Arcade Vault: el contrato real es el `GameFactory` de `lib/games/engine.ts` (`(canvas, callbacks) => GameHandle`, con un único callback `onStateChange({score, lives, level})` en vez de tres separados), no hay play-pages por juego (la ruta genérica `app/juego/[id]/jugar/page.tsx` ya resuelve cualquier `game.id` contra `lib/games/registry.ts`), y `GameColor` en `lib/data.ts` solo admite `"cyan" | "magenta" | "yellow" | "green"` (`'lime'` ni compila) — este spec corrige esas tres piezas.

El `id` sí es `frogger`, por decisión explícita del usuario: es el único juego que se va a implementar bajo este tema, y el `INSERT` original queda descartado en favor de un `UPDATE` sobre la fila que ya existe en el catálogo. Arcade Vault tiene hoy una fila placeholder `id: "ranaria"` / `title: "RANARIA"` (`cat: "ARCADE"`, `cover: "cover-rana"`, `color: "green"`) reservada para este mismo juego — confirmado con `select id, title, cat, cover, color from games where id = 'ranaria'` y con `select count(*) from scores where game_id = 'ranaria'` (`0` filas, así que renombrar el `id` es seguro sin violar el FK `scores_game_id_fkey`). En vez de insertar una fila `frogger` nueva y dejar `ranaria` huérfana duplicando el mismo tema en `/biblioteca`, este spec renombra esa fila existente a `frogger`/`FROGGER` — el mismo tratamiento que ya recibieron ROCAS→ASTEROIDS (PR #15), CAÍDA→TETRIS (SPEC 07), BLOQUE BUSTER→ARKANOID (SPEC 08) y SERPENTINA→SNAKE (SPEC 09): un placeholder en español se renombra al nombre real del juego en el momento en que se construye su motor. `cat`/`cover`/`color` se conservan sin cambios (`cover-rana` ya es el arte temático de rana; `green` ya es un valor válido de `GameColor`).

Como `.crt-screen` (`app/globals.css`) tiene `aspect-ratio: 4/3` fijo para los cuatro juegos reales existentes, el canvas 640×560 (≈8:7) del ejercicio original se habría deformado dentro del marco. Este spec usa 800×600 con una cuadrícula de 20×15 celdas de 40px — el mismo tamaño lógico que ya usan ASTEROIDS/TETRIS/ARKANOID/SNAKE.

Este spec (`01-`) es autocontenido: entrega el juego jugable de punta a punta con la mecánica clásica de Frogger (saltos discretos, carriles de tráfico, río con troncos y tortugas, rondas con 5 metas, vidas y temporizador). Las skins (`neon`/`retro`/`clasico`) y la auditoría móvil no forman parte de este spec — las aplica el subagente `skin-designer` y luego `mobile-porter` **después** de implementar este plan, mismo tratamiento que reciben ASTEROIDS/ARKANOID/SNAKE (ver `references/game-with-themes.md`).

---

## Scope

**In:**

- **Migración de renombrado en Supabase:** actualizar la fila existente de `games` de `id: "ranaria"` / `title: "RANARIA"` a `id: "frogger"` / `title: "FROGGER"` (resto de columnas — `cat`/`cover`/`color` — sin cambios), vía `mcp__supabase__apply_migration`, consistente con SPEC 07/08/09. Verificado antes de escribir este spec que `scores` no tiene ninguna fila con `game_id = 'ranaria'` (`0` filas), así que el `UPDATE` no viola el FK `scores_game_id_fkey`.
- Motor real en `lib/games/frogger/engine.ts`, encapsulado en `createFroggerGame(canvas, callbacks): GameHandle` — mismo patrón que `lib/games/asteroids/engine.ts`/`lib/games/snake/engine.ts`: todo el estado mutable (carriles, entidades, rana, ronda, temporizador, listener de teclado, `requestAnimationFrame` pendiente) vive dentro del closure de la factory, nunca en variables de módulo.
- **Tablero en cuadrícula:** canvas lógico 800×600 (4:3, mismo criterio que los 4 juegos reales existentes), dividido en `COLS=20` × `ROWS=15` celdas de `CELL=40×40px`. El mapa vertical se divide en zonas fijas por fila (0 = arriba): fila `0` metas, filas `1–6` río (6 carriles), fila `7` zona segura intermedia, filas `8–13` carretera (6 carriles), fila `14` base de inicio.
- **Metas:** 5 bocas destino en la fila `0`, cada una de 2 columnas de ancho, alternadas con huecos de 2 columnas (`goal(i)` ocupa las columnas `[2 + i*4, 3 + i*4]` para `i` en `0..4`) — una boca ya ocupada no puede volver a usarse en la misma ronda; llegar a un hueco entre bocas o a una boca ya ocupada es muerte. Al rellenar las 5 bocas se completa la ronda.
- **Entidades de carretera** (filas `8–13`): coches y camiones de 1–3 celdas de ancho, velocidad `1.5–4 px/frame` y dirección alternada por carril (par → derecha, impar → izquierda), en loop continuo (al salir de un borde se reintroducen por el opuesto). Colisión con la rana es letal.
- **Entidades de río** (filas `1–6`): troncos (2–4 celdas, huecos ≥1 celda) y grupos de tortugas (2–3), velocidad `1–3 px/frame`, mismo loop continuo que la carretera. La rana solo sobrevive en el río si está sobre un tronco o tortugas visibles; si cae al agua, muere. Las tortugas alternan visible (3s) → sumergida (1.5s) → visible; sumergidas no sirven de apoyo.
- **Progresión por nivel:** cada nivel incrementa un 15% todas las velocidades de carriles (carretera y río) respecto al nivel anterior.
- **Movimiento de la rana:** saltos discretos de 1 celda (40px) en 4 direcciones (↑ ↓ ← →); cada pulsación de flecha inicia una animación de salto de 120ms hacia la celda destino; mientras anima no acepta un salto nuevo. La rana no puede saltar fuera de los bordes laterales del canvas por su propia voluntad (sí puede ser empujada fuera por un tronco/tortuga en movimiento — ver condiciones de muerte).
- **Soporte en el río:** mientras la rana está sobre un carril de río y no está animando un salto, se desplaza horizontalmente junto con la entidad que la sostiene (mismo `dir`/`speed` del carril).
- **Condiciones de muerte:** (a) colisión con vehículo en la carretera, (b) caer al agua (sin tronco/tortuga visible debajo), (c) la tortuga que la sostiene se sumerge mientras la rana sigue encima, (d) ser empujada fuera de los bordes izquierdo/derecho mientras está sobre una entidad del río, (e) agotar el temporizador de ronda.
- **Temporizador de ronda:** `roundTimeSec(level) = max(8, 15 - (level - 1))` segundos, visible como barra en el HUD interno del canvas (fila `0` del canvas, no ocupa una fila de la cuadrícula de juego). Se reinicia al empezar cada ronda nueva y cada vez que la rana respawnea tras perder una vida dentro de la misma ronda.
- **Sistema de vidas:** 3 vidas iniciales. Cada muerte resta 1 vida; si quedan vidas, la rana respawnea en la fila `14`, columna `9`, y se reinicia el temporizador de ronda (sin perder el progreso de metas ya ocupadas ni el puntaje acumulado). Si `lives` llega a `0`, se dispara `callbacks.onStateChange({score, lives: 0, level})` y a continuación `callbacks.onGameOver(score)` una sola vez, deteniendo el loop.
- **Puntuación:** se mantiene `bestRowThisRound` (inicial `14`, se reinicia a `14` al empezar cada ronda nueva, **no** al perder una vida dentro de la misma ronda). Cada vez que la rana alcanza una fila estrictamente menor a `bestRowThisRound` (avance neto hacia la meta) suma `+10` pts y actualiza `bestRowThisRound`. Ocupar una boca destino suma `+50` pts más un bonus de tiempo `= tiempo_restante_seg × 10`. Completar la ronda (5 bocas llenas) suma `+200` pts adicionales, incrementa `level` en `1`, reconstruye los carriles con la velocidad del nivel nuevo, vacía las bocas y respawnea la rana en fila `14`/columna `9` con un temporizador de ronda nuevo.
- `callbacks.onStateChange({ score, lives, level })` se llama cada vez que alguno de los tres valores cambia (mismo criterio que ASTEROIDS/ARKANOID).
- **HUD interno del canvas** (fila `0` del canvas, por encima de la cuadrícula de juego): puntuación arriba-izquierda, nivel arriba-centro, iconos de rana arriba-derecha (uno por vida restante), barra de tiempo con color verde → amarillo → rojo según el tiempo restante — patrón de doble HUD igual que el resto de la plataforma (el HUD de React fuera del canvas ya muestra los mismos tres valores vía `onStateChange`).
- **Renderizado sin sprites bitmap:** fondo por zonas (negro carretera, azul oscuro río, verde oscuro filas seguras, verde claro bocas destino), coches/camiones como rectángulos con ruedas circulares, troncos como rectángulos con textura de líneas, tortugas visibles como círculos con patrón de escamas y sumergidas como contorno semitransparente, rana como elipse verde brillante con ojos y patas extendidas durante el salto, bocas destino con borde dorado y silueta de rana si están ocupadas — no se carga ninguna imagen (sin referencia de assets disponible para este juego en `references/started-games/`).
- **Controles:** `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight` sobre `window`, con `preventDefault()` en las 4 mientras el motor está montado (mismo criterio que los 4 juegos reales existentes, evita scroll de página).
- `components/games/frogger-canvas.tsx` (Client Component) con las props estándar de `GameCanvasProps` (`paused`, `restartKey`, `onStateChange`, `onGameOver`) — mismo patrón que `snake-canvas.tsx`/`asteroids-canvas.tsx`: un `useEffect[restartKey]` crea el motor con `createFroggerGame(canvasRef.current, callbacks)` y lo destruye en el cleanup (sin precarga de imágenes, ya que no hay spritesheet); un segundo `useEffect[paused]` solo llama `handle.setPaused(paused)`. Canvas `width={800} height={600}` con el mismo CSS de posicionamiento absoluto (`position: absolute; inset: 0; margin: auto; width: 92%; height: 92%`) que usan los 4 canvas existentes.
- **`GameHandle.setPaused(paused)`** congela el loop completo (avance de carriles, animación de salto, temporizador) — no hay tecla de pausa interna al canvas, mismo criterio que los 4 juegos reales existentes. **`destroy()`** cancela el `requestAnimationFrame` pendiente y remueve el listener de `keydown`.
- **Agregar la entrada `"frogger": FroggerCanvas`** a `GAME_CANVAS_REGISTRY` en el `lib/games/registry.ts` ya existente (hoy cubre `"asteroids"`, `"tetris"`, `"arkanoid"`, `"snake"`) — no se recrea el archivo ni se cambia su forma (`GameCanvasProps`/`GameCanvasComponent` ya sirven sin modificación).
- Guardado de la puntuación final vía `saveScore()` ya existente (`lib/scores.ts`) y el modal "FIN DEL JUEGO" ya existente en `components/game-player.tsx` — sin cambios a ninguno de los dos, ambos ya genéricos por `game.id`.
- Limpiar la referencia mock rezagada a "Ranaria" en `components/home.tsx` (`TICKER`) a `"Frogger"` — mismo tipo de limpieza de copy que hicieron PR #15, SPEC 07, SPEC 08 y SPEC 09 en el mismo array.

**Fuera de alcance (para specs futuros o para los subagentes ya existentes):**

- Play-page dedicada (`app/games/frogger/play/page.tsx` o similar) — la ruta genérica `app/juego/[id]/jugar/page.tsx` ya cubre cualquier `game.id` presente en `GAME_CANVAS_REGISTRY`.
- Sprites bitmap externos — todo se dibuja con primitivas canvas, no se carga ninguna imagen.
- **Skins (`neon`/`retro`/`clasico`)** — las aplica el subagente `skin-designer` después de que este plan esté implementado, mismo tratamiento que ASTEROIDS/ARKANOID/SNAKE.
- **Controles táctiles** — la infraestructura de `components/games/touch-controls.tsx`/`lib/games/touch-controls.ts` (SPEC 10) ya soporta agregar una entrada `frogger` a `TOUCH_LAYOUTS` con un simple d-pad de 4 flechas sin más cambios de motor, pero agregarla es trabajo de una corrida separada (o del subagente `mobile-porter`), no de este spec.
- Animaciones de muerte elaboradas (explosiones, partículas) — spec secundario.
- Power-ups especiales (mosca en la boca destino, cocodrilo disfrazado de tronco) — spec secundario.
- Supabase Auth y RLS — `user_id` se guarda como `null`, mismo tratamiento que los 4 juegos reales existentes.
- Realtime en el leaderboard.
- Componente genérico `CanvasGame` (YAGNI, mismo criterio que el resto de los juegos reales).

---

## Data model

Migración SQL de renombrado (vía `mcp__supabase__apply_migration`; sin cambios de esquema, solo datos de la fila existente):

```sql
update games
set id = 'frogger', title = 'FROGGER'
where id = 'ranaria';
```

No agrega tablas ni cambia `lib/scores.ts` ni `lib/supabase/games.ts` (ya genéricos por `game.id`). No cambia el contrato `lib/games/engine.ts` ni la forma de `lib/games/registry.ts`. Introduce:

```ts
// lib/games/frogger/engine.ts
export function createFroggerGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle;
```

```ts
// lib/games/registry.ts (entrada nueva sobre el mapa ya existente)
export const GAME_CANVAS_REGISTRY: Record<string, GameCanvasComponent>;
// { asteroids: AsteroidsCanvas, tetris: TetrisCanvas, arkanoid: ArkanoidCanvas, snake: SnakeCanvas, frogger: FroggerCanvas }
```

Tipos locales dentro de `lib/games/frogger/engine.ts` (no exportados):

```ts
type Direction = "up" | "down" | "left" | "right";

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
}

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}
```

---

## Implementation plan

1. Aplicar la migración de renombrado con `mcp__supabase__apply_migration`: `UPDATE games SET id = 'frogger', title = 'FROGGER' WHERE id = 'ranaria'`. Verificación: `mcp__supabase__execute_sql` con `SELECT id, title FROM games WHERE id IN ('frogger','ranaria')` devuelve una sola fila (`frogger`/`FROGGER`); `SELECT count(*) FROM scores WHERE game_id = 'ranaria'` sigue en `0`.

2. **Definir constantes y tipos** dentro de `lib/games/frogger/engine.ts`:

   ```ts
   const COLS = 20;
   const ROWS = 15;
   const CELL = 40; // px
   const CANVAS_W = COLS * CELL; // 800
   const CANVAS_H = ROWS * CELL; // 600
   // Zonas (índice de fila, 0 = arriba)
   const ROW_GOALS = 0;
   const ROW_RIVER_TOP = 1;
   const ROW_RIVER_BOT = 6;
   const ROW_SAFE_MID = 7;
   const ROW_ROAD_TOP = 8;
   const ROW_ROAD_BOT = 13;
   const ROW_START = 14;
   const FROG_START_COL = 9;
   const GOAL_WIDTH = 2;
   const GOAL_COUNT = 5;
   ```

   Más los tipos locales `Direction`/`Entity`/`Lane`/`Frog` del data model. Verificación: `npx tsc --noEmit` sin errores.

3. **Construir el mapa de carriles** — función `buildLanes(level: number): Lane[]`:
   - Carriles de carretera (filas `8–13`, 6 carriles): velocidades entre `1.5` y `4` px/frame escaladas `× 1.15^(level-1)`; sentidos alternos por índice de carril; entidades precargadas con huecos atravesables.
   - Carriles de río (filas `1–6`, 6 carriles): velocidades entre `1` y `3` px/frame con la misma escala por nivel; troncos de 2–4 celdas con huecos de al menos 1 celda; grupos de tortugas de 2–3 con ciclo de inmersión 3s visible / 1.5s bajo el agua.
     Verificación: al loguear el array `lanes` en consola, cada carril tiene al menos 2 entidades y los huecos son visibles.

4. **Game loop principal** con `requestAnimationFrame`, arrancado inmediatamente al crear el motor:
   - `update(dt: number)`:
     - Si el motor está en pausa (flag interno que controla `setPaused`), no avanzar ninguna lógica (pero seguir dibujando el último frame vía `draw()`).
     - Avanzar cada entidad de cada carril (`entity.col += lane.speed * lane.dir * dt / 16`); reintroducir por el lado opuesto al salir del canvas.
     - Si la rana no está animando: si hay una dirección pendiente (del listener de teclado), iniciar animación de salto (`animating = true`, `animT = 0`, calcular `targetCol/targetRow` recortado a `[0, COLS-1]`/`[0, ROWS-1]`).
     - Si la rana está animando: avanzar `animT += dt`; al llegar a `120`, completar el salto (`col/row = target`, `animating = false`) y resolver la celda destino (muerte/meta/puntuación de avance).
     - Si la rana está en un carril de río y no animando: desplazarla junto con la entidad que la sostiene (`getSupport`); si no hay soporte, es muerte por agua.
     - Decrementar el temporizador de ronda; si llega a `0`, es muerte por tiempo.
     - Llamar `callbacks.onStateChange({score, lives, level})` si alguno cambió desde el último frame.
   - `draw()`: fondo por zonas, entidades de cada carril, rana, bocas destino, HUD interno — según lo descrito en el Scope.

5. **Detección de colisiones y soporte**:
   - `checkRoadCollision(frog, lanes)`: `true` si `frog.col` cae dentro de `[entity.col, entity.col + entity.width)` de alguna entidad en el carril de `frog.row`.
   - `getSupport(frog, lanes)`: entidad de río cuyo rango cubre la columna de la rana en su carril, o `null` si no hay ninguna o si es una tortuga con `submerged === true`.
   - `checkGoal(frog, goals)`: si `frog.row === ROW_GOALS`, calcula la boca correspondiente a `frog.col` (`Math.floor((frog.col - 2) / 4)` si cae en un rango de boca válido); si está libre, la marca y suma puntos; si ya estaba ocupada o `frog.col` cae en un hueco entre bocas, es muerte.

6. **Gestión de ronda completada** — `completeRound()`: respawnea la rana en fila `14`/columna `9`, vacía las bocas, incrementa `level`, reconstruye los carriles con `buildLanes(level)`, reinicia `bestRowThisRound = ROW_START` y el temporizador de ronda.

7. **Gestión de muerte** — `killFrog()`: decrementa `lives`; si `lives === 0`, llama `callbacks.onStateChange({score, lives: 0, level})` y luego `callbacks.onGameOver(score)`, detiene el loop; si `lives > 0`, respawnea la rana en fila `14`/columna `9` sin resetear `bestRowThisRound` ni las bocas ya ocupadas, y reinicia el temporizador de ronda.

8. **Crear `components/games/frogger-canvas.tsx`** con las props estándar (`paused`, `restartKey`, `onStateChange`, `onGameOver`), canvas 800×600, `useEffect[restartKey]` que crea/destruye el motor, `useEffect[paused]` que llama `handle.setPaused(paused)`. Verificación: `npx tsc --noEmit` sin errores; compila como Client Component (`"use client"`).

9. **Modificar `lib/games/registry.ts`**: importar `FroggerCanvas` y agregar `frogger: FroggerCanvas` a `GAME_CANVAS_REGISTRY`, sin tocar `GameCanvasProps`/`GameCanvasComponent` ni las entradas existentes. Verificación: `npx tsc --noEmit` sin errores.

10. **Actualizar `components/home.tsx`**: cambiar la fila del `TICKER` mock que menciona "Ranaria" a `"Frogger"`. Verificación: `grep -ri "ranaria" app components lib` no devuelve resultados fuera de `references/`.

11. **Verificación end-to-end manual**: jugar una partida completa en `/juego/frogger/jugar` — saltar en las 4 direcciones, cruzar la carretera esquivando vehículos, cruzar el río sobre troncos y tortugas (confirmando que sumergirse mata), llenar las 5 bocas y ver que la ronda sube de nivel y acelera, agotar el temporizador y confirmar muerte, perder las 3 vidas y confirmar que abre el modal "FIN DEL JUEGO" con la puntuación real, guardar el puntaje (aparece en `/salon` y en `/juego/frogger` al recargar), reiniciar con "JUGAR DE NUEVO", probar PAUSA/REANUDAR, y confirmar que `/juego/asteroids/jugar`, `/juego/tetris/jugar`, `/juego/arkanoid/jugar` y `/juego/snake/jugar` siguen funcionando sin regresión, y que `gloton`/`invasores`/`duelo-pixel` siguen mostrando el arena decorativo.

12. **Verificación final**: `npm run lint` y `npm run build` pasan sin errores.

---

## Acceptance criteria

- [ ] La tabla `games` en Supabase ya no tiene ninguna fila con `id = 'ranaria'`; existe `id = 'frogger'` / `title = 'FROGGER'` con `cat`/`cover`/`color` (`ARCADE`/`cover-rana`/`green`) sin cambios respecto a la fila original.
- [ ] `lib/games/frogger/engine.ts` exporta `createFroggerGame(canvas, callbacks): GameHandle` respetando el contrato de `lib/games/engine.ts` sin modificarlo.
- [ ] `/juego/frogger/jugar` (ruta genérica, sin play-page dedicada) renderiza el canvas 800×600 real dentro de `.crt-screen`, con las zonas de carretera, río, zonas seguras y bocas destino visualmente diferenciadas.
- [ ] La rana aparece centrada (columna 9) en la fila de inicio al cargar la partida.
- [ ] La rana salta exactamente una celda (40px) por pulsación de flecha con animación de 120ms; esas 4 teclas no hacen scroll de la página mientras el motor está montado.
- [ ] La rana no puede saltar por su propia cuenta fuera de los bordes laterales.
- [ ] Coches y camiones se mueven horizontalmente en loop por sus 6 carriles de carretera, reintroduciéndose por el lado opuesto al salir.
- [ ] Troncos y tortugas se mueven horizontalmente en loop por sus 6 carriles de río; las tortugas alternan visible/sumergida con el ciclo 3s/1.5s.
- [ ] La rana muere al ser alcanzada por un vehículo, al caer al agua, cuando la tortuga que la sostiene se sumerge, al ser empujada fuera de los bordes por una entidad del río, y al agotar el temporizador de ronda.
- [ ] Al morir con vidas restantes, la rana respawnea en fila 14/columna 9 sin perder el puntaje ni las bocas ya ocupadas en la ronda.
- [ ] Llegar a una boca libre la marca como ocupada y suma `+50` pts más el bonus de tiempo; llegar a una boca ya ocupada o a un hueco entre bocas es muerte.
- [ ] Completar las 5 bocas suma `+200` pts, incrementa `level`, reconstruye los carriles más rápido y reinicia la ronda.
- [ ] `callbacks.onStateChange({score, lives, level})` se dispara cada vez que alguno de los tres valores cambia; el HUD de React lo refleja en vivo.
- [ ] El HUD interno del canvas (score, nivel, iconos de vida, barra de tiempo) se dibuja correctamente.
- [ ] Al llegar a `lives = 0`, se dispara `onStateChange({..., lives: 0, ...})` y luego `onGameOver(score)`; se abre el modal "FIN DEL JUEGO" ya existente con la puntuación real.
- [ ] Guardar la puntuación inserta una fila real en Supabase (`scores.game_id = "frogger"`) y aparece en `/salon` y en `/juego/frogger` al recargar.
- [ ] PAUSA congela el loop real (carriles, salto, temporizador) y REANUDAR lo continúa sin reiniciar el progreso.
- [ ] JUGAR DE NUEVO reinicia una partida nueva (rana en inicio, score 0, 3 vidas, nivel 1, bocas vacías) sin recargar la página.
- [ ] `lib/games/registry.ts` sigue siendo el mismo archivo y `GAME_CANVAS_REGISTRY` ahora cubre `"asteroids"`, `"tetris"`, `"arkanoid"`, `"snake"` y `"frogger"`.
- [ ] `/juego/asteroids/jugar`, `/juego/tetris/jugar`, `/juego/arkanoid/jugar` y `/juego/snake/jugar` siguen funcionando sin regresión.
- [ ] `gloton`, `invasores` y `duelo-pixel` siguen mostrando el arena decorativo, sin cambios.
- [ ] `components/home.tsx` ya no contiene la referencia mock "Ranaria" en `TICKER`.
- [ ] `npm run lint` y `npm run build` completan sin errores de tipos ni de ESLint.

---

## Decisions

- **Sí: renombrar la fila del catálogo de `id: "ranaria"` / `title: "RANARIA"` a `id: "frogger"` / `title: "FROGGER"` mediante una migración real en Supabase (`UPDATE`)**, en vez de insertar una fila nueva `frogger` (como hacía el ejercicio de curso original) o mantener el id `ranaria`. Razón: decidido explícitamente por el usuario — `frogger` es el único juego de este tema que se va a implementar, así que no hace falta conservar `ranaria` como id independiente. Mismo tratamiento completo (id + título, vía `UPDATE`) que recibieron ROCAS→ASTEROIDS, CAÍDA→TETRIS, BLOQUE BUSTER→ARKANOID y SERPENTINA→SNAKE, evitando además una fila `ranaria` huérfana duplicando el mismo tema en `/biblioteca`. `cat`/`cover`/`color` se conservan (`ARCADE`/`cover-rana`/`green`) porque ya son correctos y válidos (`'lime'` del original no lo era).

- **Sí: verificar antes de migrar que `scores` no tiene ninguna fila con `game_id = 'ranaria'`** (confirmado: `0` filas), por lo que el `UPDATE` de `games.id` no viola el FK `scores_game_id_fkey` ni requiere una migración adicional sobre `scores`. Razón: verificación técnica necesaria antes de ejecutar un `UPDATE` sobre una primary key referenciada por FK; mismo chequeo que ya hicieron SPEC 07/08/09.

- **Sí: contrato `GameFactory` estándar (`onStateChange` unificado) en vez de 4 callbacks separados** — el original tenía `onScoreChange`/`onLivesChange`/`onLevelChange`/`onGameOver` como props de un componente React. Razón: `lib/games/engine.ts` ya define el contrato único (`GameCallbacks.onStateChange({score, lives, level})` + `onGameOver(finalScore)`) que usan los 4 juegos reales existentes; duplicar un contrato paralelo por juego rompería `lib/games/registry.ts` y `components/game-player.tsx`, que asumen la forma genérica.

- **Sí: sin play-page dedicada, ruta genérica `/juego/frogger/jugar`** — el original creaba `app/games/frogger/play/page.tsx`. Razón: `app/juego/[id]/jugar/page.tsx` ya resuelve cualquier `game.id` presente en `GAME_CANVAS_REGISTRY` vía `getGameWithScores(id)`; una ruta dedicada sería código muerto duplicado del mismo patrón que ya usan los 4 juegos reales.

- **Sí: canvas 800×600 con cuadrícula 20×15** — el original usaba 640×560 (16×14). Razón: `.crt-screen` tiene `aspect-ratio: 4/3` fijo en toda la app; 640×560 se habría deformado al escalarse con las mismas reglas CSS (`width: 92%; height: 92%`) que usan los 4 canvas existentes.

- **Sí: 6 carriles de carretera (filas 8–13) en vez de 5** — consecuencia directa de pasar de 14 a 15 filas totales manteniendo intactas las 6 filas de río, la fila segura intermedia, la fila de metas y la fila de inicio del diseño original. Razón: absorber la fila extra en la zona de tráfico (en vez de, por ejemplo, duplicar la fila segura) mantiene la dificultad y la estructura de zonas más fieles al Frogger clásico.

- **Sí: primitivas canvas sin sprites bitmap** — igual que el original. Razón: no existe ninguna carpeta de referencia para este juego en `references/started-games/`, así que no hay ningún asset real que reutilizar.

- **Sí: cuadrícula discreta de 40px con animación de salto de 120ms** — igual que el original. Razón: mecánica canónica de Frogger; simplifica la detección de colisiones/soporte comparando filas/columnas enteras.

- **Sí: doble HUD (interno del canvas + React)** — igual que el original. Razón: coherencia con el patrón ya establecido en los 4 juegos reales de la plataforma.

- **Sí: 3 vidas, 5 bocas destino, temporizador de ronda, tortugas con ciclo de inmersión** — mecánica preservada del diseño original sin cambios de balance más allá de lo ya descrito. Razón: son las reglas canónicas de Frogger; el spec de curso ya las había diseñado correctamente, solo el contrato/rutas/tamaño de canvas/id de catálogo estaban desalineados con esta app.

- **No: skins (`neon`/`retro`/`clasico`)** — no se agregan en este spec. Razón: en Arcade Vault las skins las aplica el subagente `skin-designer` en una corrida separada **después** de que el motor exista, mismo orden que ASTEROIDS/ARKANOID/SNAKE (ver `references/game-with-themes.md`); mezclarlas aquí duplicaría ese trabajo.

- **No: entrada en `TOUCH_LAYOUTS` (controles táctiles)** — no se agrega en este spec, aunque sería trivial (un d-pad de 4 flechas, sin cambios de motor). Razón: mantener este spec centrado en el motor; la entrada de SPEC 10 es responsabilidad de una corrida separada o de `mobile-porter`.

- **No: movimiento continuo (interpolado)** — igual que el original. Razón: la interpolación continua requeriría colisiones AABB en espacio continuo, aumentando la complejidad sin añadir diversión al género.

- **No: cocodrilo disfrazado de tronco ni mosca bonus en bocas** — igual que el original, spec secundario. Razón: capas de dificultad/recompensa independientes de la mecánica base.

- **No: componente genérico `CanvasGame`** — igual que el original. Razón: YAGNI, cada juego real de la plataforma tiene su propio componente.

- **No: RLS ni Realtime en el leaderboard** — igual que el original. Razón: mismo tratamiento que los 4 juegos reales existentes; se evaluaría en specs futuros de seguridad/tiempo real si se necesita para toda la plataforma.

---

## Risks

| Riesgo                                                                                                                                                                                                                                                      | Mitigación                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un `UPDATE` sobre `games.id` (primary key referenciada por FK) podría fallar o dejar huérfanas filas de `scores` si ya existieran puntuaciones guardadas para `ranaria`.                                                                                    | Verificado antes de escribir este spec: `SELECT count(*) FROM scores WHERE game_id = 'ranaria'` devuelve `0` — no hay partidas jugadas todavía bajo ese id, así que el `UPDATE` es seguro. El paso 1 del plan repite esta verificación antes y después de aplicar la migración.             |
| Sin ningún archivo de referencia jugable para Frogger en `references/started-games/`, toda la lógica de colisión/soporte/rondas se diseña desde cero — un error de diseño podría producir un juego injusto o con bugs no detectados hasta jugarlo.          | Las reglas elegidas son las convenciones clásicas y ampliamente conocidas de Frogger, ya validadas en el spec original de curso; el paso 11 del plan exige una partida manual completa cubriendo las 5 condiciones de muerte, las 5 metas y la progresión de nivel antes de cerrar el spec. |
| Expandir la carretera de 5 a 6 carriles (por pasar de 14 a 15 filas) cambia el balance de dificultad respecto al Frogger clásico de 5 carriles.                                                                                                             | Cambio documentado explícitamente en Decisions; el paso 11 del plan incluye jugar varias rondas para confirmar que sigue siendo pasable con el diseño de huecos de `buildLanes`.                                                                                                            |
| El movimiento de la rana sobre troncos/tortugas en movimiento (empuje horizontal continuo mientras no anima un salto) es una interacción de estado más compleja que el resto de los motores existentes (ninguno combina grid discreto + arrastre continuo). | `getSupport()` se verifica en cada frame, no solo al aterrizar; el paso 11 del plan prueba explícitamente quedarse quieto sobre un tronco cerca del borde para confirmar la condición de muerte (d) por empuje fuera del canvas.                                                            |
| Sin controles táctiles, FROGGER no es jugable en dispositivos sin teclado físico — mismo estado que los otros 4 juegos reales hasta que se agregue la entrada correspondiente en `TOUCH_LAYOUTS`.                                                           | Aceptado como limitación conocida y documentado como fuera de alcance; agregar la entrada es trivial (mismo d-pad de 4 flechas que SNAKE) y puede hacerse en una corrida separada sin tocar el motor.                                                                                       |

---

## What is **not** in this spec

- Play-page dedicada — se usa la ruta genérica `/juego/[id]/jugar`.
- Skins (`neon`/`retro`/`clasico`) — responsabilidad de `skin-designer` en una corrida posterior.
- Entrada en `TOUCH_LAYOUTS`/controles táctiles — responsabilidad de una corrida separada o de `mobile-porter`.
- Animaciones de muerte elaboradas (explosiones, partículas).
- Power-ups especiales (mosca bonus, cocodrilo disfrazado de tronco).
- Supabase Auth y RLS.
- Realtime en el leaderboard.
- Componente genérico `CanvasGame`.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec o corrida de subagente.
