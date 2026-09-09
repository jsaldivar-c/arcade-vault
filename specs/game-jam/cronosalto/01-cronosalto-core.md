# SPEC — CRONOSALTO: motor real y alta en el catálogo

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-09-09
> **Objective:** Dar de alta el juego nuevo `cronosalto`/"CRONOSALTO" en el catálogo de Supabase y construir su motor real (`lib/games/cronosalto/engine.ts` + `components/games/cronosalto-canvas.tsx`), registrado en `lib/games/registry.ts`, implementando una mecánica de cruce de carriles a contrarreloj con saltos ortogonales y diagonales, distinta de un port de Frogger/Ranaria.

---

## Por qué existe este spec

El tema de esta corrida de game-jam es "Frogger / Ranaria — cruce y supervivencia por nivel: cruza la carretera y el río sin convertirte en papilla". El backlog de Arcade Vault ya reserva `ranaria` (inspirado en Frogger, `cat: VERSUS`... en realidad pendiente de puerto real) para un port fiel del clásico — ese trabajo es exclusivo de `/add-game ranaria` y no se toca aquí. Este spec toma el **tema** de cruzar carriles peligrosos sin convertirse en papilla como punto de partida, pero diseña una mecánica nueva con al menos dos cambios reales de regla frente a Frogger clásico:

1. **Cronómetro por carril, no por partida.** Frogger clásico corre un único temporizador para toda la ronda. CRONOSALTO no tiene temporizador global: cada carril individual exige abandonarlo antes de que se agote su propio presupuesto de tiempo, o el carril "se satura" y mata al jugador aunque no lo toque ningún vehículo.
2. **Saltos no ortogonales.** Frogger clásico solo permite saltar arriba/abajo/izquierda/derecha, un carril a la vez. CRONOSALTO permite saltos diagonales combinando dos direcciones (p. ej. arriba+izquierda simultáneamente) para esquivar tráfico con más margen táctico.

Ningún otro juego del Vault hoy tiene esta combinación de grid discreto + cronómetro por carril + salto diagonal, así que no compite ni con el motor de SNAKE (grid por tick, sin cronómetro por celda) ni con ninguno de los otros tres juegos reales. Este spec (`01-`) es autocontenido: entrega el juego jugable de punta a punta. `02-cronosalto-carriles-salvajes.md` construye sobre este core agregando vehículos que cambian de carril y un enemigo nuevo, sin duplicar nada de lo que ya se especifica aquí.

---

## Scope

**In:**

- **Alta en Supabase:** insertar una fila nueva en `games` (no es un renombrado — `cronosalto` no existe hoy en el catálogo), vía `mcp__supabase__apply_migration`, documentado como SQL de ejemplo (ver Data model). Antes de aplicar la migración real, verificar con `mcp__supabase__execute_sql` que `SELECT count(*) FROM games WHERE id = 'cronosalto'` devuelve `0`.
- **Ampliación aditiva de `lib/data.ts`:** `CategoryFilter` gana el valor `"RUNNER"` y `GameColor` gana el valor `"orange"`, sin quitar ni renombrar ningún valor existente (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS` y `cyan`/`magenta`/`yellow`/`green` se mantienen intactos). `CATS` gana `"RUNNER"` en su arreglo.
- **Tablero en cuadrícula:** canvas lógico 800×600 (4:3, mismo criterio que ASTEROIDS/TETRIS/ARKANOID/SNAKE), dividido en `COLS=20` × `ROWS=15` celdas de `CELL=40×40px` (mismas dimensiones de grid que SNAKE, mecánica de movimiento completamente distinta).
- **Fila 14 (inferior, `y=560-600`): zona de salida segura.** Sin vehículos, sin cronómetro de carril. El jugador respawnea aquí tras perder una vida (sin perder la partida) o al empezar un circuito nuevo.
- **Fila 0 (superior, `y=0-40`): meta del circuito.** Alcanzarla otorga `+100` puntos, incrementa `level` en `1`, y respawnea al jugador en la fila 14 con la dificultad del circuito siguiente (ver más abajo) — no termina la partida; es un ciclo sin tope de niveles (progresión infinita, mismo espíritu "endless" que TETRIS/SNAKE en vez del set fijo de 5 niveles de ARKANOID).
- **Filas 1–13 (13 carriles de peligro):** cada carril contiene entre `2 + floor(level/2)` y `5` vehículos (ancho aleatorio de `1` a `3` celdas, alto `CELL`, color por carril tomado de una paleta cíclica de 5 colores). Los vehículos se mueven horizontalmente a velocidad constante dentro de su carril: `speed(level, laneIndex) = min(400, 80 + laneIndex * 5 + (level - 1) * 15)` px/s. La dirección alterna por índice de carril (`laneIndex` par → derecha, impar → izquierda). Cuando el borde delantero de un vehículo sale del canvas, reaparece del lado opuesto con un espacio aleatorio respecto al vehículo anterior de su carril (wraparound, sin destruir/recrear el arreglo de vehículos del carril).
- **Movimiento del jugador — salto discreto por evento de tecla, con diagonales reales:** el motor mantiene un `Set<string>` de teclas de flecha actualmente presionadas (`keydown`/`keyup` de `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`). En cada `keydown` de una tecla de flecha, si no está en cooldown (`hopCooldownMs = 150`), calcula `dx = (ArrowRight presionada ? 1 : 0) - (ArrowLeft presionada ? 1 : 0)` y `dy = (ArrowDown presionada ? 1 : 0) - (ArrowUp presionada ? 1 : 0)`; si `dx === 0 && dy === 0` no hace nada (par opuesto anula el eje, ej. arriba+abajo). Si `dx` y `dy` son ambos distintos de cero, es un salto diagonal (mueve una celda en ambos ejes simultáneamente); si solo uno es distinto de cero, es un salto ortogonal clásico. La nueva posición se recorta a los límites del grid (`col` en `[0, 19]`, `row` en `[0, 14]`); si cae fuera de rango en un eje, ese eje simplemente no se mueve (no se cancela el salto completo). Tras cada salto se reinicia el cooldown.
- **Cronómetro por carril:** al entrar el jugador a una fila nueva dentro de `1..13` (por cualquier tipo de salto, ortogonal o diagonal), se reinicia un cronómetro interno `laneTimer = laneTimeBudgetMs(level)`, donde `laneTimeBudgetMs(level) = max(1200, 3000 - (level - 1) * 200)`. Mientras el jugador permanezca en esa misma fila, `laneTimer` decrece con cada frame (`delta` de `requestAnimationFrame`). Al llegar a `0`, empieza una ventana de gracia de `500ms` (parpadeo visual del carril, puramente informativo). Si el jugador sigue en la misma fila cuando expira la gracia, pierde una vida por "saturación de carril" — sin necesidad de que ningún vehículo lo toque. Moverse a cualquier fila distinta (incluso retrocediendo) antes de que expire la gracia reinicia el cronómetro sobre la fila nueva y cancela el peligro de la anterior. Las filas 0 y 14 nunca tienen cronómetro.
- **Colisión con vehículos:** en cada frame, si la celda actual del jugador se solapa (AABB) con el rectángulo de cualquier vehículo de su fila, pierde una vida — igual severidad que la saturación de carril.
- **Pérdida de vida (con vidas restantes):** el jugador respawnea en fila 14, columna central (`col = 9`), `laneTimer` se limpia (fila 14 no tiene cronómetro), `bestRowReached` se reinicia a `14`. El `level`/dificultad de los vehículos **no** cambia — sigue siendo el mismo circuito que estaba intentando cruzar. El puntaje ya acumulado no se pierde.
- **Puntuación:** se mantiene `bestRowReached` (inicial `14`) por intento de cruce. Cada vez que el jugador alcanza una fila estrictamente menor a `bestRowReached` (es decir, progreso neto hacia la meta, no retrocesos ni repeticiones), suma `+5` puntos por cada fila de avance neto y actualiza `bestRowReached` a la fila nueva. Alcanzar la fila `0` (meta) suma además `+100` puntos, incrementa `level`, y dispara el respawn de "circuito completado" descrito arriba (a diferencia del respawn por pérdida de vida, este sí reinicia el nivel de dificultad hacia arriba).
- **Vidas:** `lives` inicial en `3` (vidas múltiples, no fija en `1`) — mismo tratamiento que ASTEROIDS/ARKANOID, justificado en Decisions: es un juego de esquivar peligros donde cada golpe individual es una pérdida parcial recuperable, igual que en esos dos, a diferencia de TETRIS/SNAKE donde cualquier error es terminal.
- **Fin de partida:** al perder la tercera vida (`lives` llega a `0`), se llama `callbacks.onGameOver(score)` una sola vez — sin respawn. No existe una condición de "victoria final" (no hay un último nivel que termine el juego, ver Decisions); el juego es de progresión infinita hasta perder las 3 vidas, igual criterio que SNAKE/TETRIS.
- `callbacks.onStateChange({ score, lives, level })` se llama en cada frame del loop, con `lives` decreciendo de `3` a `0` (reportando la transición a `0` en el mismo frame en el que se detecta la pérdida de la última vida, siempre **antes** de disparar `onGameOver`) y `level` empezando en `1` y subiendo cada vez que se completa un circuito.
- `components/games/cronosalto-canvas.tsx` (Client Component), mismo patrón que `arkanoid-canvas.tsx`/`snake-canvas.tsx`: un `<canvas width={800} height={600}>` con posicionamiento absoluto para llenar `.crt-screen`; un `useEffect` con dependencia `restartKey` que crea el motor con `createCronosaltoGame(canvas, callbacks)` (sin precarga de imágenes — este juego no usa spritesheets, todo se dibuja con formas/color, mismo criterio que ASTEROIDS/TETRIS) y lo destruye en el cleanup; otro `useEffect` con dependencia `paused` que solo llama `handle.setPaused(paused)`. Props idénticas a los 4 canvas existentes (`paused`, `restartKey`, `onStateChange`, `onGameOver`).
- **Pausa:** única fuente de pausa es `GameHandle.setPaused(paused)`; `setPaused(true)` congela el loop completo (vehículos, cronómetro de carril, animación) — no hay tecla de pausa interna, mismo criterio que los 4 juegos reales existentes.
- **Renderizado:** figuras dibujadas por código (`fillRect`/`strokeRect`), sin spritesheet — el jugador es un cuadrado de un color distintivo (p. ej. naranja, a juego con el `color` del catálogo), los vehículos son rectángulos de su color de carril, las filas 0/14 se dibujan con un tono de "zona segura" diferenciado, y el carril con cronómetro en ventana de gracia parpadea (alternando opacidad) como única señal visual del peligro de saturación.
- **Controles:** solo `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, con `preventDefault()` en las 4 mientras el motor está montado, para que no hagan scroll de la página — mismo criterio que los 4 juegos reales existentes. Sin controles táctiles ni de mouse.
- JUGAR DE NUEVO reinicia el motor a un estado nuevo (jugador en fila 14 col 9, `score=0`, `lives=3`, `level=1`, vehículos regenerados desde cero) sin recargar la página, incrementando `restartKey` — mismo mecanismo que los 4 juegos reales existentes.
- Guardado de la puntuación final vía `saveScore()` ya existente (`lib/scores.ts`) — sin cambios a ese archivo ni a `lib/supabase/games.ts` (ambos ya genéricos por `game.id`).
- **Agregar la entrada `"cronosalto": CronosaltoCanvas` a `GAME_CANVAS_REGISTRY`** en el `lib/games/registry.ts` ya existente (hoy cubre `"asteroids"`, `"tetris"`, `"arkanoid"`, `"snake"`) — no se recrea el archivo ni se cambia su forma (`GameCanvasProps`/`GameCanvasComponent` ya sirven sin modificación).

**Out of scope (para specs futuros):**

- Vehículos que cambian de carril, señuelos/drones u otros peligros nuevos — cubierto en `02-cronosalto-carriles-salvajes.md`.
- Carriles de río con troncos/plataformas flotantes (mecánica clásica de Frogger) — este spec usa un único tipo de peligro (vehículos horizontales); un spec futuro podría agregar un segundo tipo de carril si se decide ampliar el juego.
- Power-ups, escudos, congelar el cronómetro, u otros modificadores temporales.
- Sonido/música.
- Una regla CSS bespoke `.cover-cronosalto` en `app/globals.css` (ver Decisions) — la portada usa el fallback genérico `.cover-bg` hasta un spec de pulido visual futuro.
- Controles táctiles/mobile.
- Supabase Auth/RLS.
- Realtime en el leaderboard.
- Cambios al contrato `lib/games/engine.ts`.
- Tests automatizados.

---

## Data model

Migración SQL de alta (vía `mcp__supabase__apply_migration`; documentada como texto — este agente no tiene ninguna herramienta de migración de Supabase en su toolset y nunca la ejecuta):

```sql
insert into games (id, title, short, long, cat, cover, color) values (
  'cronosalto',
  'CRONOSALTO',
  'Cruza carriles a contrarreloj antes de que te aplasten',
  'Salta en diagonal u ortogonal por carriles saturados de trafico antes de que el cronometro de cada carril se agote. Sobrevive cruces cada vez mas veloces y alcanza la meta para desatar el siguiente circuito, mas letal que el anterior.',
  'RUNNER',
  'cover-cronosalto',
  'orange'
);
```

Ampliación aditiva de tipos (`lib/data.ts`, sin quitar valores existentes):

```ts
export type CategoryFilter =
  "TODOS" | "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS" | "RUNNER"; // nuevo

export type GameColor = "cyan" | "magenta" | "yellow" | "green" | "orange"; // nuevo

export const CATS: CategoryFilter[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
  "RUNNER", // nuevo
];
```

No agrega tablas ni cambia `lib/scores.ts` ni `lib/supabase/games.ts` (ya genéricos por `game.id`). No cambia el contrato `lib/games/engine.ts` ni la forma de `lib/games/registry.ts`. Introduce:

```ts
// lib/games/cronosalto/engine.ts
export function createCronosaltoGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle;
```

```ts
// lib/games/registry.ts (entrada nueva sobre el mapa ya existente)
export const GAME_CANVAS_REGISTRY: Record<string, GameCanvasComponent>;
// { asteroids, tetris, arkanoid, snake, cronosalto: CronosaltoCanvas }
```

---

## Implementation plan

1. Verificar con `mcp__supabase__execute_sql` que `SELECT count(*) FROM games WHERE id = 'cronosalto'` devuelve `0`. Aplicar la migración de alta con `mcp__supabase__apply_migration` (SQL del Data model). Verificación: `SELECT id, title, cat, color FROM games WHERE id = 'cronosalto'` devuelve la fila esperada.
2. Editar `lib/data.ts`: agregar `"RUNNER"` a `CategoryFilter` y a `CATS`, agregar `"orange"` a `GameColor`, sin tocar los valores existentes. Verificación: `npx tsc --noEmit` sin errores; `/biblioteca` sigue filtrando correctamente los juegos ya existentes por categoría.
3. Crear `lib/games/cronosalto/engine.ts` implementando la mecánica completa del Scope: grid `20×15` de celdas `40×40`, generación de vehículos por carril (`1..13`) con velocidad/dirección/wraparound según las fórmulas del Scope, salto discreto ortogonal/diagonal por `keydown` con cooldown de `150ms`, cronómetro por carril (`laneTimeBudgetMs(level)`, gracia de `500ms`), colisión AABB jugador-vehículo, `bestRowReached` y puntuación (`+5`/fila de avance neto, `+100` al llegar a la meta), vidas `3→0`, respawn por pérdida de vida vs. respawn por circuito completado (con la diferencia de si sube `level` o no), dibujo con `fillRect` (jugador, vehículos, filas seguras, parpadeo de gracia). Todo el estado mutable (posición del jugador, `bestRowReached`, `laneTimer`, arreglo de vehículos por carril, teclas presionadas, cooldown de salto, `score`/`lives`/`level`, `requestAnimationFrame` pendiente, listeners de teclado) encapsulado dentro de `createCronosaltoGame(canvas, callbacks)`, nunca en variables de módulo. `callbacks.onStateChange({ score, lives, level })` en cada frame; `callbacks.onGameOver(score)` una sola vez al llegar `lives === 0`, siempre después de haber reportado `lives: 0` en el `onStateChange` de ese mismo frame. `setPaused(true)` detiene el loop completo; `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de `keydown`/`keyup`. Verificación: `npx tsc --noEmit` sin errores.
4. Crear `components/games/cronosalto-canvas.tsx` siguiendo el patrón de `asteroids-canvas.tsx`/`tetris-canvas.tsx` (sin precarga de imágenes, ya que no hay spritesheet): mismas props (`paused`, `restartKey`, `onStateChange`, `onGameOver`), canvas `800×600` con el mismo CSS de posicionamiento absoluto, `useEffect[restartKey]` que crea/destruye el motor, `useEffect[paused]` que llama `handle.setPaused(paused)`. Verificación: `npx tsc --noEmit` sin errores; compila como Client Component (`"use client"`).
5. Modificar `lib/games/registry.ts`: importar `CronosaltoCanvas` y agregar `cronosalto: CronosaltoCanvas` a `GAME_CANVAS_REGISTRY`, sin tocar `GameCanvasProps`/`GameCanvasComponent` ni las 4 entradas existentes. Verificación: `npx tsc --noEmit` sin errores.
6. Verificación end-to-end manual: jugar una partida completa en `/juego/cronosalto/jugar` — saltar en las 4 direcciones ortogonales y confirmar al menos un salto diagonal real (dos flechas simultáneas moviendo al jugador en ambos ejes a la vez), avanzar por varios carriles sumando `+5` por fila de avance neto, quedarse quieto en un carril el tiempo suficiente para ver el parpadeo de gracia y perder una vida por saturación sin que ningún vehículo lo toque, chocar deliberadamente con un vehículo y perder una vida, confirmar que tras perder una vida (con vidas restantes) el jugador respawnea en la fila de salida sin que cambie `level`, llegar a la fila de meta y confirmar el bono de `+100`, la subida de `level` y el respawn de circuito nuevo con vehículos más rápidos, perder las 3 vidas y confirmar que se abre el modal "FIN DEL JUEGO" automáticamente con la puntuación real. Guardar la puntuación (aparece en `/salon` tab CRONOSALTO y en el leaderboard de `/juego/cronosalto` tras recargar) y reiniciar con "JUGAR DE NUEVO" sin recargar la página. Probar PAUSA/REANUDAR (el canvas se congela y continúa, incluyendo el cronómetro de carril) y el botón FIN como abandono manual. Confirmar que los 4 juegos reales existentes siguen funcionando sin regresión y que los demás juegos sin motor real siguen mostrando el arena decorativo. Verificación final: `npm run lint` y `npm run build` pasan sin errores.

---

## Acceptance criteria

- [ ] La tabla `games` en Supabase tiene una fila nueva `id = 'cronosalto'` / `title = 'CRONOSALTO'` / `cat = 'RUNNER'` / `color = 'orange'` / `cover = 'cover-cronosalto'`, sin afectar ninguna fila existente.
- [ ] `lib/data.ts` incluye `"RUNNER"` en `CategoryFilter`/`CATS` y `"orange"` en `GameColor`, sin quitar ni renombrar valores existentes.
- [ ] `lib/games/cronosalto/engine.ts` exporta `createCronosaltoGame(canvas, callbacks): GameHandle` con grid `20×15`, saltos ortogonales y diagonales reales, cronómetro por carril independiente del temporizador de partida, vehículos por carril con velocidad/dirección/wraparound, y las reglas de puntuación/vidas/nivel descritas en el Scope.
- [ ] `/juego/cronosalto/jugar` renderiza el canvas real dentro del `.crt-screen` y es jugable con las 4 flechas, incluyendo saltos diagonales al presionar dos flechas adyacentes simultáneamente; esas teclas ya no hacen scroll de la página mientras el juego está montado.
- [ ] Permanecer en un carril de peligro más allá de su presupuesto de tiempo (sin que ningún vehículo lo toque) hace perder una vida por saturación de carril.
- [ ] Chocar con un vehículo hace perder una vida con la misma severidad que la saturación de carril.
- [ ] Perder una vida con vidas restantes respawnea al jugador en la fila de salida sin cambiar `level`; llegar a la fila de meta otorga `+100` puntos, sube `level` en `1` y respawnea con vehículos más rápidos.
- [ ] El HUD de React (Puntuación/Vidas/Nivel) en `/juego/cronosalto/jugar` refleja el estado real del motor en vivo; `Vidas` baja de `3` a `0`.
- [ ] Perder la tercera vida abre automáticamente el modal "FIN DEL JUEGO" con la puntuación real; guardar la puntuación persiste una fila real en Supabase (`scores.game_id = "cronosalto"`).
- [ ] El botón FIN abandona la partida en curso y abre el mismo modal con la puntuación acumulada hasta ese momento.
- [ ] PAUSA detiene visualmente el juego real (canvas y cronómetro de carril congelados) y REANUDAR lo continúa sin reiniciar el progreso; no existe tecla de pausa interna.
- [ ] JUGAR DE NUEVO desde el modal reinicia una partida nueva (fila de salida, `score=0`, `lives=3`, `level=1`) sin recargar la página.
- [ ] `lib/games/registry.ts` sigue siendo el mismo archivo (no se recrea) y `GAME_CANVAS_REGISTRY` ahora cubre `"asteroids"`, `"tetris"`, `"arkanoid"`, `"snake"` y `"cronosalto"`.
- [ ] Los 4 juegos reales existentes siguen funcionando exactamente igual que antes de este spec (sin regresión); los juegos restantes sin motor real siguen mostrando el arena decorativo.
- [ ] `npm run build` y `npm run lint` completan sin errores de tipos ni de ESLint.

---

## Decisions

- **Sí: nombre/id nuevos (`cronosalto`/CRONOSALTO), no un port de Ranaria/Frogger.** Razón: el tema de esta corrida usa Frogger/Ranaria como inspiración explícita, pero `ranaria` sigue reservado para un port fiel vía `/add-game ranaria`; este juego diverge en al menos dos reglas reales (cronómetro por carril en vez de por partida, saltos diagonales en vez de solo ortogonales), cumpliendo el requisito de divergencia mecánica de este skill.
- **Sí: vidas múltiples (`lives` inicial `3`, decreciente), no `lives` fija en `1`.** Razón: CRONOSALTO es un juego de esquivar peligros donde cada golpe individual (vehículo o saturación de carril) es una falla parcial recuperable dentro de la misma partida, igual tratamiento que ASTEROIDS/ARKANOID; fijar `lives: 1` (como TETRIS/SNAKE) penalizaría con excesiva dureza un solo error de timing en un juego ya bastante exigente por el cronómetro por carril.
- **Sí: sin condición de "victoria final"; progresión de niveles infinita hasta perder las 3 vidas.** Razón: mismo criterio que TETRIS/SNAKE (juegos "endless" sin tope de nivel) en vez del tope fijo de 5 niveles de ARKANOID; completar un circuito (llegar a la fila de meta) es una victoria parcial que otorga puntos y sube la dificultad, no un evento de fin de partida.
- **Sí: perder una vida respawnea en el mismo circuito (mismo `level`), mientras que completar un circuito sí sube `level`.** Razón: distingue claramente "fallar un intento de cruce" de "superar un circuito completo", dándole sentido a que la dificultad solo escale cuando el jugador demuestra progreso real, no cada vez que muere.
- **Sí: los saltos diagonales combinan dos flechas simultáneas leídas de un `Set` de teclas presionadas, en vez de agregar teclas dedicadas (ej. `Q`/`E`/`Z`/`C`).** Razón: mantiene el esquema de controles a solo 4 teclas de flecha (mismo criterio de simplicidad que los 4 juegos reales existentes) mientras habilita una mecánica genuinamente nueva; un par de flechas opuestas en el mismo eje (arriba+abajo, izquierda+derecha) se anula naturalmente a `0` en ese eje sin necesitar un caso especial.
- **Sí: cronómetro por carril con ventana de gracia de `500ms` en vez de muerte instantánea al llegar a `0`.** Razón: da al jugador una señal visual clara (parpadeo) antes de la pérdida de vida, evitando que la mecánica nueva se sienta injusta o arbitraria la primera vez que se experimenta.
- **No: sin regla CSS bespoke `.cover-cronosalto` en `app/globals.css` en este spec.** Razón: los 4 juegos reales existentes reutilizaron coberturas ya diseñadas en specs de renombrado; como CRONOSALTO es un juego 100% nuevo sin cobertura previa, diseñar un patrón visual bespoke (como `.cover-bricks`/`.cover-snake`) es trabajo de un spec de pulido visual futuro con `/frontend-design`, no de este spec de mecánica. El fallback genérico `.cover-bg` ya definido en `app/globals.css` cubre el caso sin romper el layout de `game-card.tsx`.
- **Sí: ampliar `CategoryFilter`/`GameColor` en `lib/data.ts` de forma aditiva (`RUNNER`/`orange`), en vez de forzar `cat`/`color` a valores ya usados por otro juego.** Razón: pedido explícito de la tarea (evitar repetir categoría/color de los juegos más recientes); es un cambio aditivo sin romper ningún valor existente ni el contrato `lib/games/engine.ts`.
- **No: sin carriles de río con troncos/plataformas.** Razón: un solo tipo de peligro (vehículos horizontales) alcanza para un spec autocontenido y jugable; agregar un segundo tipo de carril duplicaría buena parte de la lógica de movimiento horizontal con reglas de flotación distintas, mejor evaluado en un spec futuro si se decide ampliar el juego.
- **No: sin cambios al contrato `lib/games/engine.ts`.** Razón: CRONOSALTO encaja completamente en `GameCallbacks`/`GameHandle`/`GameFactory` existentes, sin campos o eventos nuevos.
- **No: sin controles táctiles/mobile, sin Supabase Auth/RLS, sin Realtime en el leaderboard.** Razón: fuera de alcance por mandato general de este skill para todo spec de game-jam.

---

## Risks

| Riesgo                                                                                                                                                                                                                                                                                                                                                                             | Mitigación                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Combinar un loop de vehículos continuo (basado en `delta` de tiempo) con saltos discretos disparados por evento de teclado y un cronómetro de carril acumulado en paralelo es un patrón de game loop más complejo que los 4 juegos reales existentes; un bug de sincronización podría dejar el cronómetro corriendo durante la pausa o descontar tiempo de más/menos entre frames. | El cronómetro de carril se descuenta con el mismo `delta` de `requestAnimationFrame` que mueve los vehículos, dentro del mismo bloque de actualización que `setPaused(true)` detiene por completo; se verifica manualmente en el paso 6 del plan que PAUSA congela también el parpadeo de gracia, no solo el movimiento visual. |
| Leer combinaciones de teclas presionadas vía un `Set` podría comportarse de forma inconsistente entre navegadores si el evento `keyup` no se dispara correctamente (p. ej. al perder foco de la ventana).                                                                                                                                                                          | Se limpia el `Set` completo en el listener de `blur` de la ventana (si el foco se pierde, se asume que ninguna tecla sigue presionada) y en `destroy()`; comportamiento estándar para juegos de teclado basados en estado de teclas.                                                                                            |
| La fórmula de dificultad (`laneTimeBudgetMs`, velocidad de vehículos) podría resultar injugable en niveles altos si el piso de `1200ms` combinado con velocidades cercanas al máximo de `400px/s` no deja margen real de reacción.                                                                                                                                                 | Ambas fórmulas incluyen un piso/techo explícito (`max(1200, ...)` / `min(400, ...)`) precisamente para evitar una escalada sin límite; se verifica jugando varios circuitos consecutivos en el paso 6 del plan antes de cerrar el spec.                                                                                         |
| Ampliar `CategoryFilter`/`GameColor` en `lib/data.ts` es un cambio de tipos compartido por toda la app (filtros de `/biblioteca`, tarjetas de juego); un error tipográfico en el valor nuevo rompería el build para todos los juegos, no solo CRONOSALTO.                                                                                                                          | Cambio estrictamente aditivo (una unión de tipos más un elemento en un arreglo), verificado con `npx tsc --noEmit` y `npm run build` en los pasos 2 y 6 del plan antes de considerar el spec implementado.                                                                                                                      |
| Sin cobertura CSS bespoke, la tarjeta de CRONOSALTO en `/biblioteca` se verá visualmente más genérica que las de los otros 4 juegos reales hasta un spec de pulido visual futuro.                                                                                                                                                                                                  | Aceptado explícitamente como trade-off de alcance (ver Decisions); no afecta la jugabilidad ni rompe el layout, solo el acabado visual de la portada.                                                                                                                                                                           |

---

## What is **not** in this spec

- Vehículos que cambian de carril, drones u otros peligros nuevos — ver `02-cronosalto-carriles-salvajes.md`.
- Carriles de río con troncos/plataformas flotantes.
- Power-ups, escudos o cualquier modificador temporal del cronómetro.
- Sonido/música.
- Una regla CSS bespoke `.cover-cronosalto`.
- Controles táctiles/mobile.
- Supabase Auth/RLS.
- Realtime en el leaderboard.
- Cambios al contrato `lib/games/engine.ts`.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
