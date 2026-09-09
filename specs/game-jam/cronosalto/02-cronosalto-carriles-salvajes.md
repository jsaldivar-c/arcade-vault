# SPEC — CRONOSALTO: Carriles Salvajes (vehículos que cambian de carril + dron señuelo)

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, `01-cronosalto-core.md`
> **Date:** 2026-09-09
> **Objective:** Ampliar el motor de CRONOSALTO con dos peligros nuevos que se mueven entre carriles en vez de quedarse fijos en el suyo — vehículos que "coletean" temporalmente a un carril adyacente y un dron señuelo que cruza varios carriles en diagonal — sin tocar el contrato del motor ni duplicar la mecánica ya especificada en `01-cronosalto-core.md`.

---

## Por qué existe este spec

`01-cronosalto-core.md` ya deja CRONOSALTO completamente jugable: cronómetro por carril, saltos ortogonales/diagonales, y vehículos horizontales fijos a su propio carril (mismo criterio de peligro estático por fila que Frogger clásico, aunque con reglas de tiempo/movimiento distintas). Ese core por sí solo ya cumple el requisito de divergencia mecánica de este skill (cronómetro por carril + saltos diagonales), así que este segundo spec no es necesario para que el juego "no sea un clon" — es una ampliación de alcance delimitado que agrega la tercera divergencia explícitamente sugerida por el tema ("hazard que se mueve en vez de estático"), sin la cual los vehículos de `01-` seguirían pareciendo, carril por carril, muy similares a los del Frogger clásico en su comportamiento individual (aunque el juego alrededor ya sea distinto).

Es un spec separado y no una sección de `01-` porque agrega dos comportamientos de peligro completamente nuevos (coleteo entre carriles, dron diagonal multi-carril) que requieren su propio estado interno, su propia lógica de generación/despawn, y su propio período de prueba end-to-end — exactamente el tipo de "una feature complementaria de alcance delimitado" que este skill reserva para un `02-`, igual que SPEC 08 aisló sprites/audio reales de la lógica base de ARKANOID.

---

## Scope

**In:**

- **Vehículos coleteantes ("swerve"):** cada carril de peligro (filas `1..13`) tiene, por segundo, una probabilidad `swerveChance(level) = min(0.5, 0.15 + (level - 1) * 0.03)` de que uno de sus vehículos (elegido al azar entre los presentes en el carril en ese instante, excluyendo vehículos ya coleteando) inicie un coleteo: en `400ms` interpola verticalmente su posición de dibujo hacia un carril adyacente válido (fila `± 1`, siempre dentro de `1..13`, elegido al azar entre "arriba"/"abajo" si ambos son válidos), permanece ahí `800ms` actuando como un peligro adicional en ese carril (con el mismo AABB de colisión que cualquier vehículo normal de ese carril, sumado a los vehículos propios del carril — no los reemplaza), y luego interpola de regreso a su carril original en otros `400ms`. Mientras coletea, el vehículo conserva su velocidad y dirección horizontal originales (sigue moviéndose de lado mientras cambia de fila). Cada vehículo solo puede tener un coleteo activo a la vez (no se solapan sobre sí mismo).
- **Dron señuelo:** a partir de `level >= 3`, cada `8` segundos (temporizador independiente del cronómetro por carril del jugador) aparece un dron desde un borde lateral aleatorio del canvas, en una fila aleatoria de `1..13`. En el momento de aparecer, fija como objetivo la columna en la que está el jugador _en ese instante_ (objetivo estático, no persigue dinámicamente después de aparecer — ver Decisions) y se mueve en línea recta diagonal hacia esa columna combinando avance horizontal constante con desplazamiento vertical constante, atravesando entre `2` y `4` filas en aproximadamente `3` segundos antes de salir del canvas por el borde opuesto o superior/inferior (lo que ocurra primero) y despawnear. El dron es visualmente distinto de los vehículos normales (color/forma propia, p. ej. un rombo en vez de un rectángulo) y su colisión con el jugador (AABB) cuesta una vida, con la misma severidad que cualquier otro peligro del core.
- **Colisión combinada:** en cada frame, el chequeo de colisión del jugador contra peligros de su fila actual ahora considera: los vehículos propios de esa fila (ya en `01-`), cualquier vehículo de un carril adyacente que esté coleteando actualmente hacia esa fila, y cualquier dron cuya posición actual (interpolada) ocupe esa fila — mismo criterio de "cualquier solape AABB pierde una vida" del core, sin introducir un tercer nivel de severidad.
- **Escalado con `level`:** tanto `swerveChance` como la aparición de drones escalan con el `level` alcanzado (definidos arriba), reforzando la progresión de dificultad ya existente en `01-` sin introducir una segunda fuente de dificultad independiente del nivel.
- Todo el estado nuevo (coleteos activos por vehículo, temporizador de aparición de drones, lista de drones activos con su progreso de interpolación) vive dentro del mismo closure de `createCronosaltoGame` que ya encapsula el resto del estado del motor — no se crea una segunda factory ni un segundo canvas.
- El dibujo de vehículos coleteando y drones se agrega al mismo `render()` interno del motor (mismo `<canvas>` 800×600, mismo contexto 2D) — sin overlays ni elementos nuevos de DOM.

**Out of scope (para specs futuros):**

- Que el dron persiga dinámicamente la columna del jugador después de aparecer (objetivo fijo al momento de spawnear, ver Decisions).
- Power-ups para neutralizar drones o coleteos (ej. escudo temporal).
- Sonido/música para los eventos de coleteo o aparición de dron.
- Un HUD o indicador visual dedicado que anuncie "dron entrante" antes de que aparezca en pantalla.
- Carriles de río con troncos/plataformas (sigue fuera de alcance, ver `01-cronosalto-core.md`).
- Cambios al contrato `lib/games/engine.ts` o a la forma de `lib/games/registry.ts`.
- Controles táctiles/mobile, Supabase Auth/RLS, Realtime en el leaderboard.
- Tests automatizados.

---

## Data model

No agrega tablas, no cambia `games`/`scores`, no cambia `lib/scores.ts` ni `lib/supabase/games.ts`. No cambia el contrato `lib/games/engine.ts` ni la forma de `lib/games/registry.ts` (`GAME_CANVAS_REGISTRY` sigue apuntando a la misma `CronosaltoCanvas` de `01-`, sin entradas nuevas).

Modifica (no recrea) la firma ya existente de `01-cronosalto-core.md`, agregando estado interno nuevo dentro del mismo closure:

```ts
// lib/games/cronosalto/engine.ts (misma firma pública que 01-, estado interno ampliado)
export function createCronosaltoGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle;

// Estado interno nuevo dentro del closure (no exportado, no forma parte del contrato público):
// - swerve activo por vehículo: { active: boolean; targetRow: number; phase: "out" | "hold" | "back"; elapsedMs: number }
// - drones activos: { x: number; y: number; row: number; targetCol: number; spawnedAtMs: number }[]
// - droneSpawnAccumMs: number
```

---

## Implementation plan

1. En `lib/games/cronosalto/engine.ts` (ya creado por `01-`), agregar el estado de coleteo por vehículo (`swerve` descrito en Data model) a la estructura de datos de vehículo ya existente, inicializado en `{ active: false, ... }` al generarse cada vehículo. En el `update()` del loop, para cada carril, tirar la probabilidad `swerveChance(level)` una vez por segundo acumulado (no una vez por frame) para decidir si arranca un coleteo nuevo sobre un vehículo elegible del carril; avanzar la interpolación (`out`/`hold`/`back`) de cualquier vehículo con coleteo activo según los tiempos del Scope. Verificación: `npx tsc --noEmit` sin errores; log temporal (removido antes de terminar el paso) confirmando que los coleteos ocurren con la frecuencia esperada en una sesión de prueba.
2. Agregar la generación y actualización de drones: un acumulador `droneSpawnAccumMs` que dispara un dron nuevo cada `8000ms` una vez que `level >= 3`, fijando `targetCol` a la columna del jugador en el instante de aparición; actualizar la posición interpolada de cada dron activo por frame según su velocidad diagonal constante, y removerlo del arreglo cuando sale del canvas. Verificación: `npx tsc --noEmit` sin errores.
3. Extender el chequeo de colisión del jugador (ya existente en `01-`) para incluir vehículos coleteando actualmente hacia la fila del jugador y drones cuya fila interpolada coincide con la del jugador, con el mismo AABB y la misma consecuencia (pérdida de una vida) que el resto de peligros. Verificación: `npx tsc --noEmit` sin errores.
4. Extender `render()` para dibujar vehículos coleteando en su posición interpolada (en vez de su fila "de origen" mientras el coleteo está activo) y drones con una forma distinta (rombo) y color propio. Verificación visual manual en el paso 5.
5. Verificación end-to-end manual: jugar varias partidas en `/juego/cronosalto/jugar` hasta observar al menos un coleteo de vehículo hacia un carril adyacente (confirmando que el jugador puede perder una vida por un vehículo que "no debería estar en ese carril" según `01-`), subir a `level >= 3` y observar la aparición de al menos un dron cruzando varios carriles en diagonal, y confirmar que chocar con un dron pierde una vida igual que cualquier otro peligro. Confirmar que el core de `01-` (cronómetro por carril, saltos diagonales, puntuación, vidas, niveles) sigue funcionando sin regresión. Verificación final: `npm run lint` y `npm run build` pasan sin errores.

---

## Acceptance criteria

- [ ] Los vehículos de cualquier carril pueden, con la probabilidad y los tiempos descritos, coletear temporalmente hacia un carril adyacente válido, actuando como un peligro adicional en ese carril mientras dura el coleteo, y regresan a su carril original al finalizar.
- [ ] A partir de `level >= 3`, aparece al menos un dron señuelo cada ~8 segundos, cruzando entre 2 y 4 filas en diagonal hacia la columna del jugador en el instante de su aparición, y despareciendo al salir del canvas.
- [ ] Colisionar con un vehículo coleteando o con un dron cuesta una vida, con la misma severidad que colisionar con un vehículo normal o con la saturación de carril de `01-`.
- [ ] El core de `01-cronosalto-core.md` (cronómetro por carril, saltos ortogonales/diagonales, puntuación por avance neto, bono de meta, vidas, subida de nivel) sigue funcionando exactamente igual que antes de este spec.
- [ ] `lib/games/engine.ts` y la forma pública de `lib/games/registry.ts` no cambian.
- [ ] `npm run build` y `npm run lint` completan sin errores de tipos ni de ESLint.

---

## Decisions

- **Sí: el dron fija su columna objetivo una sola vez, al aparecer, en vez de perseguir dinámicamente al jugador durante todo su recorrido.** Razón: un dron que persigue en tiempo real la posición del jugador podría volverse imposible de esquivar de forma consistente (especialmente combinado con el cronómetro por carril, que ya presiona al jugador a moverse); un objetivo fijo al spawnear mantiene el peligro predecible y esquivable con planificación, mismo espíritu de "peligro leíble" que ya aplica el core a la ventana de gracia del cronómetro.
- **Sí: el coleteo se decide por probabilidad acumulada por segundo (no por frame) y escala con `level`.** Razón: decidir la probabilidad por frame directamente (a 60fps) requeriría una probabilidad diminuta y sensible a la tasa de refresco del navegador; acumular por segundo la hace independiente del framerate y fácil de razonar/ajustar.
- **Sí: los vehículos coleteando se suman a los vehículos propios del carril destino, sin reemplazarlos.** Razón: mantiene la dificultad del carril destino intacta (no se "vacía" temporalmente un carril para rellenar otro), y hace que el coleteo sea estrictamente un peligro adicional, consistente con el objetivo de este spec de aumentar el riesgo, no de redistribuirlo.
- **No: sin HUD ni indicador dedicado de "dron entrante".** Razón: mantiene el alcance de este spec limitado a la mecánica de peligro en sí; un indicador de advertencia (como el parpadeo de gracia del cronómetro en `01-`) podría agregarse en un spec futuro de pulido de feedback visual si se decide que el dron es demasiado impredecible en la práctica.
- **No: sin power-ups para neutralizar estos peligros nuevos.** Razón: los power-ups son una ampliación de alcance propia (ver `01-cronosalto-core.md`, Out of scope) que afectaría por igual a peligros del core y de este spec; mejor evaluados juntos en un spec futuro dedicado, no parcialmente aquí.
- **No: sin cambios al contrato `lib/games/engine.ts` ni a la forma de `lib/games/registry.ts`.** Razón: todo el estado nuevo es interno al closure de `createCronosaltoGame`, ya existente desde `01-`; no se necesita ningún campo o evento nuevo expuesto hacia `game-player.tsx`.

---

## Risks

| Riesgo                                                                                                                                                                                                                                       | Mitigación                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un vehículo coleteando hacia el carril donde está el jugador justo cuando este entra a esa fila podría sentirse como una colisión "injusta" por aparecer sin aviso previo.                                                                   | El coleteo tarda `400ms` en interpolarse hacia el carril destino (no aparece instantáneamente), dando una ventana de reacción visual; se verifica jugando varias sesiones en el paso 5 del plan y se documenta como comportamiento esperado si el jugador entra a un carril ya "en proceso" de recibir un coleteo. |
| Un dron con objetivo fijo podría, por mala suerte, spawnear exactamente sobre la columna donde el jugador decide quedarse, haciendo la colisión casi inevitable.                                                                             | El dron tarda ~3 segundos en cruzar sus 2-4 filas (no aparece ya encima del jugador), dando tiempo de sobra para moverse de columna antes de que llegue a la fila del jugador; se verifica en el paso 5 del plan.                                                                                                  |
| Agregar colisión contra vehículos coleteando y drones en el mismo chequeo por frame que ya usa `01-` para vehículos normales podría introducir una regresión sutil en la detección de colisión del core si no se aísla bien la lógica nueva. | El paso 3 del plan implementa la extensión como chequeos adicionales sobre el mismo resultado booleano de "hay colisión" del core, sin modificar la lógica de colisión de vehículos normales ya existente; el paso 5 exige confirmar explícitamente que el core sigue sin regresión.                               |
| Escalar `swerveChance` sin techo real más allá de `0.5`/seg combinado con drones frecuentes en niveles muy altos podría volver el juego injugable en partidas muy largas.                                                                    | `swerveChance` está topada explícitamente en `min(0.5, ...)`; los drones mantienen un intervalo fijo de `8s` sin acelerar con el nivel (solo su condición de activación depende de `level >= 3`), evitando una segunda escalada sin límite superpuesta a la del core.                                              |

---

## What is **not** in this spec

- Persecución dinámica del dron tras su aparición.
- Power-ups para neutralizar coleteos o drones.
- Sonido/música.
- HUD/indicador de advertencia dedicado para el dron.
- Carriles de río con troncos/plataformas.
- Cambios al contrato `lib/games/engine.ts` o a la forma de `lib/games/registry.ts`.
- Controles táctiles/mobile, Supabase Auth/RLS, Realtime en el leaderboard.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
