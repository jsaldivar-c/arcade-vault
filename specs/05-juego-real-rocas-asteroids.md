# SPEC 05 — Primer juego real: ROCAS (Asteroids)

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-09-03
> **Objective:** Reemplazar el arena decorativo del Reproductor de ROCAS por el motor real de `references/started-games/02-asteroids` (portado a TypeScript y encapsulado en un contrato reutilizable), integrado con el HUD y el modal de fin de partida ya existentes.

---

## Por qué existe este spec

SPEC 01 dejó las 5 pantallas del Vault funcionando, pero el Reproductor (`components/game-player.tsx`) es 100% decorativo: dibuja un arena con CSS/animaciones y simula la puntuación con un timer aleatorio, sin importar qué juego se abra. `references/started-games/02-asteroids` es un clon jugable de Asteroids ya terminado (canvas HTML5 puro, sin dependencias, en `game.js`) que el usuario quiere convertir en el primer juego real de la plataforma, bajo la entrada ya existente **ROCAS** (`lib/data.ts`, id `"rocas"`, categoría SHOOTER, "Pulveriza asteroides en gravedad cero"), que temáticamente ya corresponde a este juego.

Como este es el primer juego real de los 8 planeados, este spec también define el contrato mínimo reutilizable (`lib/games/engine.ts`) que los próximos juegos reales deberán seguir, para no rediseñar la integración desde cero cada vez.

---

## Scope

**In:**

- Puerto a TypeScript de la lógica de `references/started-games/02-asteroids/game.js` (nave, asteroides con división en fragmentos, balas, partículas de explosión, power-up de disparo triple, wraparound toroidal, 3 vidas con invencibilidad temporal al reaparecer, niveles con más asteroides) en `lib/games/asteroids/engine.ts`, encapsulado en una función factory — sin variables mutables a nivel de módulo, para soportar montar/desmontar el motor varias veces (React StrictMode en desarrollo invoca efectos dos veces; el usuario también puede navegar hacia/desde `/juego/rocas/jugar` repetidamente).
- Contrato reutilizable en `lib/games/engine.ts` para juegos reales futuros:
  ```ts
  export interface GameCallbacks {
    onStateChange(state: { score: number; lives: number; level: number }): void;
    onGameOver(finalScore: number): void;
  }
  export interface GameHandle {
    setPaused(paused: boolean): void;
    destroy(): void;
  }
  export type GameFactory = (
    canvas: HTMLCanvasElement,
    callbacks: GameCallbacks,
  ) => GameHandle;
  ```
- `components/games/asteroids-canvas.tsx` (Client Component): monta un `<canvas>` de resolución lógica 800×600 (proporción 4:3, igual que el original y que `.crt-screen`, que ya usa `aspect-ratio: 4/3`), crea el motor con `createAsteroidsGame` al montar, lo destruye al desmontar, y expone props `paused: boolean`, `restartKey: number` (al cambiar, destruye y vuelve a crear el motor desde cero), `onStateChange` y `onGameOver`.
- Integración en `components/game-player.tsx`: cuando `game.id === "rocas"`, el `.crt-screen` renderiza `<AsteroidsCanvas />` en vez del arena decorativo (`.game-arena` con `.enemy`/`.player-ship`), y el HUD de React (Jugador/Puntuación/Vidas/Nivel) se alimenta del `onStateChange` real del motor en vez del timer falso. Para los otros 7 juegos, `game-player.tsx` sigue exactamente igual que hoy (arena decorativo + timer falso) — sin cambios visibles.
- Un solo HUD visible: el `drawHUD()` (score/nivel/vidas/temporizador de disparo triple) y el overlay `GAME OVER` dibujados dentro del canvas original **no** se portan — esa información ya la muestra el HUD de React y el modal existente.
- Fin de partida real (vidas llegan a 0 dentro del motor) dispara automáticamente el mismo modal "FIN DEL JUEGO" que ya existe (input de nombre, botón GUARDAR PUNTUACIÓN, JUGAR DE NUEVO, VOLVER AL VAULT), usando la puntuación real del motor. El botón FIN se mantiene, ahora como "abandonar la partida ya" con la puntuación acumulada hasta ese momento.
- PAUSA/REANUDAR detiene y reanuda de verdad el bucle del motor real (no solo una etiqueta visual).
- JUGAR DE NUEVO reinicia el motor a un estado nuevo (nave centrada, 3 vidas, nivel 1, puntuación 0) sin recargar la página, incrementando `restartKey`.
- Controles: flechas (rotar/propulsar) y espacio (disparar), igual que el original; se agrega `preventDefault()` en esos códigos de tecla mientras el motor está montado, para que no hagan scroll de la página.
- Guardado de la puntuación final vía la función `saveScore()` ya existente en `lib/scores.ts` (localStorage, clave `av_scores`), sin cambios a ese archivo.

**Out of scope (para specs futuros):**

- Los otros 7 juegos del Vault (Bloque Buster, Caída, Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel) — siguen usando el Reproductor puramente decorativo, sin cambios en este spec.
- Persistencia de puntuaciones en Supabase o cualquier backend real — se sigue usando exclusivamente `localStorage` vía `saveScore()`, igual que en SPEC 01. El Salón de la Fama sigue usando `seededScores` mock.
- Actualizar `best`/`plays` de ROCAS en `lib/data.ts` con datos reales de partidas jugadas — quedan como mock estático, igual que en los otros 7 juegos.
- Controles táctiles/on-screen para jugar en dispositivos sin teclado físico — el original tampoco los tiene.
- Sonido/música.
- Generalizar el contrato `lib/games/engine.ts` más allá de lo necesario para Asteroids (p. ej. soporte de power-ups genéricos, multi-input) — se ajusta cuando llegue el segundo juego real si hace falta.
- Tests automatizados.

---

## Data model

Este spec no agrega tablas ni cambia `lib/data.ts` ni `lib/scores.ts`. Introduce dos tipos nuevos, puramente de UI/runtime (no persistidos):

```ts
// lib/games/engine.ts
export interface GameCallbacks {
  onStateChange(state: { score: number; lives: number; level: number }): void;
  onGameOver(finalScore: number): void;
}
export interface GameHandle {
  setPaused(paused: boolean): void;
  destroy(): void;
}
export type GameFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameHandle;
```

```ts
// lib/games/asteroids/engine.ts
export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle;
```

---

## Implementation plan

1. Crear `lib/games/engine.ts` con los tipos `GameCallbacks`, `GameHandle` y `GameFactory` del contrato reutilizable. Verificación: `npx tsc --noEmit` sin errores (archivo sin uso todavía, solo tipos).
2. Crear `lib/games/asteroids/engine.ts` portando la lógica de `references/started-games/02-asteroids/game.js` a TypeScript: mismas clases (`Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`) y mismas constantes de balance (radios, velocidades, puntos 100/50/20, drop de power-up, invencibilidad de 3s), pero con todo el estado mutable (nave, listas de entidades, score, vidas, nivel, listeners de teclado) encapsulado dentro de `createAsteroidsGame(canvas, callbacks)` en vez de variables de módulo top-level. Quitar `drawHUD()` y el overlay de `GAME OVER` dibujados en canvas; en su lugar, llamar `callbacks.onStateChange({ score, lives, level })` cada frame y `callbacks.onGameOver(score)` una sola vez cuando las vidas llegan a 0. `setPaused(true)` detiene las llamadas a `update()` (el canvas queda congelado en el último frame); `destroy()` cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado agregados. Verificación: `npx tsc --noEmit` sin errores.
3. Crear `components/games/asteroids-canvas.tsx` (Client Component): un `<canvas width={800} height={600}>` con CSS `position: absolute; inset: 0; width: 100%; height: 100%;` (para llenar `.crt-screen`, que ya tiene `aspect-ratio: 4/3`, sin distorsión). En un `useEffect` con dependencia `restartKey`, crea el motor con `createAsteroidsGame(canvasRef.current, callbacks)` y lo destruye en el cleanup. Otro `useEffect` llama `handle.setPaused(paused)` cuando cambia la prop `paused`. Verificación: `npx tsc --noEmit` sin errores; el componente compila como Client Component (`"use client"`).
4. Modificar `components/game-player.tsx`: cuando `game.id === "rocas"`, reemplazar el bloque `.game-arena` (con `.grid-floor`/`.enemy`/`.player-ship`) por `<AsteroidsCanvas paused={paused || over} restartKey={restartKey} onStateChange={setEngineState} onGameOver={handleEngineGameOver} />`; el HUD (Puntuación/Vidas/Nivel) lee de `engineState` en vez del timer falso; quitar el `useEffect` del timer falso solo para esta rama. `handleEngineGameOver(finalScore)` fija `score = finalScore` y `over = true` (abre el modal existente). El botón FIN sigue fijando `over = true` directamente con la puntuación actual del `engineState`. JUGAR DE NUEVO incrementa `restartKey`, resetea `engineState` a `{ score: 0, lives: 3, level: 1 }` y pone `over = false`, `saved = false`, `paused = false`. Los otros 7 juegos (`game.id !== "rocas"`) siguen exactamente el código actual sin cambios. Verificación manual: abrir `/juego/rocas/jugar` muestra el juego real jugable con teclado; abrir `/juego/invasores/jugar` (u otro) se ve idéntico a antes de este spec.
5. Verificación end-to-end manual: jugar una partida completa de ROCAS — mover/rotar/propulsar/disparar, partir asteroides grandes en medianos y pequeños sumando 20/50/100 puntos respectivamente, recoger el power-up de disparo triple, pasar de nivel al limpiar todos los asteroides, perder las 3 vidas y confirmar que se abre el modal "FIN DEL JUEGO" automáticamente con la puntuación real, guardar la puntuación (persiste en `localStorage["av_scores"]`) y reiniciar con "JUGAR DE NUEVO" sin recargar la página. Probar también PAUSA/REANUDAR y el botón FIN como abandono manual. Verificación final: `npm run lint` y `npm run build` pasan sin errores.

---

## Acceptance criteria

- [ ] `lib/games/engine.ts` exporta `GameCallbacks`, `GameHandle` y `GameFactory`.
- [ ] `lib/games/asteroids/engine.ts` exporta `createAsteroidsGame(canvas, callbacks): GameHandle` con la misma mecánica de juego que `references/started-games/02-asteroids/game.js` (wraparound, división de asteroides, puntos 100/50/20, 3 vidas con invencibilidad al reaparecer, niveles, power-up de disparo triple).
- [ ] `/juego/rocas/jugar` renderiza el canvas real dentro del `.crt-screen` y es jugable con flechas + espacio; las flechas y espacio ya no hacen scroll de la página mientras el juego está montado.
- [ ] El HUD de React (Puntuación/Vidas/Nivel) en `/juego/rocas/jugar` refleja el estado real del motor en vivo, sin HUD duplicado dibujado dentro del canvas.
- [ ] Perder las 3 vidas en ROCAS abre automáticamente el modal "FIN DEL JUEGO" con la puntuación real; guardar la puntuación persiste una entrada en `localStorage["av_scores"]` con `game: "rocas"`.
- [ ] El botón FIN en ROCAS abandona la partida en curso y abre el mismo modal con la puntuación acumulada hasta ese momento.
- [ ] PAUSA detiene visualmente el juego real (el canvas deja de actualizarse) y REANUDAR lo continúa sin reiniciar el progreso.
- [ ] JUGAR DE NUEVO desde el modal reinicia una partida nueva de ROCAS (puntuación 0, 3 vidas, nivel 1) sin recargar la página.
- [ ] Los otros 7 juegos (`/juego/[id]/jugar` con `id !== "rocas"`) se ven y funcionan exactamente igual que antes de este spec (arena decorativo, timer falso de puntuación).
- [ ] `lib/data.ts` no cambia (`best`/`plays` de ROCAS siguen siendo el mock estático original).
- [ ] `npm run build` y `npm run lint` completan sin errores de tipos ni de ESLint.

---

## Decisions

- **Sí:** reutilizar la entrada existente `"rocas"` de `GAMES` en vez de crear un juego nuevo. Razón: decidido explícitamente por el usuario; coincide temáticamente (SHOOTER, "Pulveriza asteroides en gravedad cero") y evita una entrada duplicada.
- **Sí:** definir ya un contrato reutilizable (`lib/games/engine.ts`) desde este primer juego real, en vez de una integración ad-hoc. Razón: decidido explícitamente por el usuario, pensando en los 7 juegos reales restantes que seguirán el mismo patrón `GameFactory`/`GameHandle`/`GameCallbacks`.
- **Sí:** un solo HUD (React), alimentado por `onStateChange` del motor; se elimina el `drawHUD()` y el overlay `GAME OVER` dibujados dentro del canvas original. Razón: decidido explícitamente por el usuario para evitar HUDs duplicados o inconsistentes entre canvas y React.
- **Sí:** el game over real (vidas = 0) dispara el modal de fin de partida ya existente de SPEC 01, reutilizando su UI de guardado de puntuación en vez de construir una nueva. El botón FIN se conserva como abandono manual. Razón: decidido explícitamente por el usuario.
- **No:** no se conecta a Supabase en este spec; la persistencia sigue siendo solo `localStorage` vía `saveScore()`. Razón: decidido explícitamente por el usuario, consistente con la decisión ya tomada en SPEC 01 (persistencia real de puntuaciones queda para un spec de backend futuro).
- **No:** no se agregan controles táctiles/on-screen. Razón: decidido explícitamente por el usuario; el original tampoco los tiene, se documenta como limitación conocida (ver Risks).
- **No:** `best`/`plays` de ROCAS en `lib/data.ts` no se actualizan con datos reales de partidas. Razón: decidido explícitamente por el usuario, consistente con que los otros 7 juegos siguen siendo mock estático hasta un spec de backend agregador.
- **Sí:** portar `game.js` a TypeScript encapsulando todo el estado mutable dentro de la función factory (no variables de módulo top-level como en el original). Razón: `tsconfig.json` exige `strict` en todo el repo; además el estado a nivel de módulo del original rompería si el componente se monta más de una vez (React StrictMode en desarrollo invoca efectos dos veces) o si el usuario navega hacia/desde `/juego/rocas/jugar` repetidamente.
- **Sí:** mantener la resolución lógica del canvas en 800×600 (4:3), escalada por CSS al contenedor `.crt-screen` (que ya usa `aspect-ratio: 4/3`), en vez de reescribir la lógica de coordenadas del juego. Razón: minimiza el riesgo de introducir bugs de física/colisión al portar; el contenedor ya tiene la proporción correcta.

---

## Risks

| Riesgo                                                                                                                                                                                                                                | Mitigación                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React StrictMode en desarrollo monta y desmonta efectos dos veces, lo que podría duplicar listeners de teclado o dejar dos bucles `requestAnimationFrame` corriendo si el motor no limpia bien.                                       | Todo el estado y los listeners viven dentro del closure de `createAsteroidsGame`; `destroy()` remueve los listeners y cancela el `requestAnimationFrame` pendiente antes de que el segundo montaje cree una instancia nueva.        |
| Las flechas y la barra espaciadora son teclas que el navegador usa para hacer scroll de la página.                                                                                                                                    | El motor llama `preventDefault()` en `keydown` para esos códigos mientras está montado (equivalente a cuando el usuario está en `/juego/rocas/jugar`).                                                                              |
| Sin controles táctiles, ROCAS no es jugable en dispositivos sin teclado físico (móvil/tablet).                                                                                                                                        | Aceptado como limitación conocida por decisión explícita del usuario; se evaluaría un spec futuro de controles táctiles si se necesita.                                                                                             |
| El original dibuja su propio "GAME OVER" y HUD dentro del canvas; si algún callback (`onStateChange`/`onGameOver`) se llama de más o de menos por un bug de porteo, el HUD de React podría desincronizarse del estado real del juego. | Los callbacks se disparan desde los mismos puntos donde el original actualizaba `score`/`lives`/`level` y donde llamaba a `killShip()`/`state = 'gameover'`, verificado manualmente jugando una partida completa (paso 5 del plan). |

---

## What is **not** in this spec

- Los otros 7 juegos del Vault (siguen decorativos).
- Persistencia de puntuaciones en Supabase o cualquier backend real.
- Actualización de `best`/`plays` con datos reales de partidas.
- Controles táctiles/on-screen.
- Sonido/música.
- Generalización adicional del contrato `lib/games/engine.ts` más allá de lo que necesita Asteroids.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
