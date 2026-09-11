# SPEC 11 — Rendimiento: reporte de estado sin re-render innecesario en los motores de juego

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09, `specs/game-jam/frogger/01-frogger-core.md`
> **Date:** 2026-09-10
> **Objective:** Eliminar el re-render de React en cada frame (60/s) que hoy sufren ASTEROIDS, TETRIS, ARKANOID y SNAKE al llamar `callbacks.onStateChange` incondicionalmente en el loop, introduciendo un helper compartido `createStateReporter` en `lib/games/engine.ts` que solo invoca el callback cuando `score`/`lives`/`level` cambian de verdad — el mismo criterio que FROGGER ya implementa correctamente hoy.

---

## Por qué existe este spec

El usuario pidió revisar y resolver problemas de performance en FROGGER y, de haberlos, en el resto de los juegos. La investigación de este spec (lectura completa de los 5 motores reales — `lib/games/{asteroids,tetris,arkanoid,snake,frogger}/engine.ts` — más `components/game-player.tsx` y `components/games/touch-controls.tsx`) encontró que **el problema real y medible no está en FROGGER, sino en los otros 4 motores**, y que FROGGER es justo el único que ya evita ese problema:

- **ASTEROIDS** (`lib/games/asteroids/engine.ts:470,483,546`), **TETRIS** (`lib/games/tetris/engine.ts:403,421`), **ARKANOID** (`lib/games/arkanoid/engine.ts:512,522`) y **SNAKE** (`lib/games/snake/engine.ts:240,255`) llaman `callbacks.onStateChange({ score, lives, level })` **incondicionalmente en cada `requestAnimationFrame`**, con un objeto literal nuevo en cada llamada.
- `components/game-player.tsx:131` conecta ese callback directo al setter de un `useState` (`onStateChange={setEngineState}`). Como la referencia del objeto cambia siempre, React no puede hacer bail-out (`Object.is` nunca es `true`) y re-renderiza **todo el árbol de `GamePlayer`** en cada frame — 60 veces por segundo — aunque el puntaje, las vidas y el nivel no hayan cambiado. Ese trabajo de reconciliación de React compite por el hilo principal con el propio loop de `requestAnimationFrame` del canvas.
- **FROGGER** (`lib/games/frogger/engine.ts:252-263`, función `reportState()`) ya implementa la guarda correcta: compara `score`/`lives`/`level` contra `lastReportedScore`/`lastReportedLives`/`lastReportedLevel` y solo llama `callbacks.onStateChange` cuando alguno cambió. Este spec generaliza esa misma lógica ya validada en producción, en vez de inventar un mecanismo nuevo.

Durante la misma investigación se identificaron otros tres problemas de performance reales pero de impacto menor o no confirmado. Aplicando el criterio que el usuario fijó explícitamente ("solo arreglar problemas reales detectados", no hardening preventivo), estos tres no califican — impacto no confirmado o severidad baja — y quedan fuera de este spec (ver Decisions/Risks):

- Asteroids reconstruye los arrays `bullets`/`particles`/`powerUps` con `.filter()`/`.concat()` en cada frame sin importar si algo murió (`lib/games/asteroids/engine.ts:468-531`).
- Los 5 motores alternan `ctx.shadowColor`/`ctx.shadowBlur` por cada entidad dibujada en cada frame cuando la skin activa tiene glow — más notorio en FROGGER por ser el motor con más entidades simultáneas en pantalla (hasta 12 carriles).
- TETRIS es el único de los 5 motores cuyo `dt` del loop no tiene clamp superior (`lib/games/tetris/engine.ts:408`).

---

## Scope

**In:**

- **Nuevo helper `createStateReporter`** exportado desde `lib/games/engine.ts` (el mismo archivo que ya exporta `GameCallbacks`/`GameHandle`/`GameFactory`, sin cambiar la forma de ninguno de los tres): recibe `onStateChange: GameCallbacks["onStateChange"]` y devuelve una función `(state: EngineState) => void` que compara internamente contra el último `score`/`lives`/`level` reportado y solo invoca `onStateChange` cuando alguno cambió. También se exporta el tipo `EngineState` (`{ score: number; lives: number; level: number }`) usado por la firma del helper.
- **ASTEROIDS, TETRIS, ARKANOID y SNAKE** migran sus llamadas directas a `callbacks.onStateChange({...})` dentro del loop a `reportState({...})`, donde `const reportState = createStateReporter(callbacks.onStateChange)` se crea una vez por instancia del motor (mismo lugar donde hoy se declaran `keys`/`palette`/etc., dentro del closure de la factory).
- **FROGGER también migra** su función local `reportState()` (y las variables `lastReportedScore`/`lastReportedLives`/`lastReportedLevel`) para usar el helper compartido en vez de la lógica duplicada manualmente — mismo comportamiento observable, una sola fuente de verdad para el patrón de dedupe.
- Verificación manual con **React DevTools Profiler** en los 5 juegos: confirmar que, mientras `score`/`lives`/`level` no cambian, `GamePlayer` deja de re-renderizar en cada frame en los 4 motores corregidos (antes: ~60 renders/s; después: 0), y que sigue re-renderizando correctamente y sin retraso perceptible en el HUD cuando esos valores sí cambian, en los 5 juegos.

**Fuera de alcance (para specs futuros, solo si se confirma impacto perceptible):**

- Optimizar las allocaciones de arrays (`.filter()`/`.concat()`) por frame en `lib/games/asteroids/engine.ts`.
- Reducir o cachear el uso de `shadowColor`/`shadowBlur` por entidad en los 5 motores cuando la skin activa tiene glow — cualquier cambio al efecto visual de glow es territorio del subagente `skin-designer`, no de este spec centrado en el loop de reporte de estado.
- Agregar un clamp superior al `dt` de `lib/games/tetris/engine.ts:408` — hallazgo de severidad baja sin evidencia de causar un problema real (es un `if`, no un bucle acumulador que pueda saturar CPU).
- Cualquier cambio a la física, colisiones, temporizadores, dificultad o reglas de puntuación de los 5 juegos — este spec no toca ninguna lógica de gameplay, solo el mecanismo de reporte de estado hacia React.
- Cambios a `components/game-player.tsx`, `components/games/touch-controls.tsx` o cualquier `components/games/<id>-canvas.tsx` — ninguno de estos archivos necesita cambios (`onStateChange` sigue siendo la misma prop con la misma firma).
- Tests automatizados.

---

## Data model

Esta feature no introduce datos persistidos ni cambia ningún esquema de Supabase. Introduce un tipo y una función nuevos, ambos en `lib/games/engine.ts`, junto a los tipos ya existentes:

```ts
// lib/games/engine.ts (agregado junto a GameCallbacks/GameHandle/GameFactory existentes)
export interface EngineState {
  score: number;
  lives: number;
  level: number;
}

export function createStateReporter(
  onStateChange: (state: EngineState) => void,
): (state: EngineState) => void {
  let lastScore = -1;
  let lastLives = -1;
  let lastLevel = -1;
  return (state: EngineState) => {
    if (
      state.score !== lastScore ||
      state.lives !== lastLives ||
      state.level !== lastLevel
    ) {
      lastScore = state.score;
      lastLives = state.lives;
      lastLevel = state.level;
      onStateChange(state);
    }
  };
}
```

No cambia `GameCallbacks`, `GameHandle` ni `GameFactory`. No cambia `lib/games/registry.ts`, `components/game-player.tsx` ni ningún `components/games/<id>-canvas.tsx`.

---

## Implementation plan

1. **Agregar `EngineState` y `createStateReporter` a `lib/games/engine.ts`** tal como se define en el Data model, exportados junto a `GameCallbacks`/`GameHandle`/`GameFactory` ya existentes. Verificación: `npx tsc --noEmit` sin errores.

2. **Migrar `lib/games/asteroids/engine.ts`**: crear `const reportState = createStateReporter(callbacks.onStateChange);` junto a la declaración de `keys`/`justPressed` dentro de la factory; reemplazar las 3 llamadas directas `callbacks.onStateChange({ score, lives, level })` (líneas 470, 483, 546) por `reportState({ score, lives, level })`. Verificación: `npx tsc --noEmit` sin errores; jugar una partida en `/juego/asteroids/jugar` confirmando que el HUD de score/vidas/nivel sigue actualizándose con normalidad.

3. **Migrar `lib/games/tetris/engine.ts`**: mismo patrón; reemplazar las 2 llamadas directas (líneas 403, 421) por `reportState({ score, lives: 1, level })`. Verificación: `npx tsc --noEmit` sin errores; jugar en `/juego/tetris/jugar`.

4. **Migrar `lib/games/arkanoid/engine.ts`**: mismo patrón; reemplazar las 2 llamadas directas (líneas 512, 522) por `reportState({ score, lives, level: currentLevel })`. Verificación: `npx tsc --noEmit` sin errores; jugar en `/juego/arkanoid/jugar`.

5. **Migrar `lib/games/snake/engine.ts`**: mismo patrón; reemplazar las 2 llamadas directas (líneas 240, 255) por `reportState({ score, lives: 1, level })`. Verificación: `npx tsc --noEmit` sin errores; jugar en `/juego/snake/jugar`.

6. **Migrar `lib/games/frogger/engine.ts`**: eliminar `lastReportedScore`/`lastReportedLives`/`lastReportedLevel` y la función local `reportState()` (líneas 180-182, 252-263); crear `const reportState = createStateReporter(callbacks.onStateChange);` junto a la declaración de estado del motor, y dejar la llamada ya existente `reportState()` al final de `update()` (línea 430) usando la nueva firma (`reportState({ score, lives, level })`); ajustar también la llamada manual dentro de `killFrog()` (líneas 270-273, que hoy actualiza los `lastReported*` a mano antes de `onGameOver`) para que pase por el mismo helper. Verificación: `npx tsc --noEmit` sin errores; jugar una partida completa en `/juego/frogger/jugar` sin regresión (HUD, muerte, fin de juego).

7. **Verificación de rendimiento con React DevTools Profiler**, en cada uno de los 5 juegos (`/juego/<id>/jugar`):
   - Grabar ~5 segundos de juego en un tramo donde `score`/`lives`/`level` **no** cambian (ej. moviendo la nave sin disparar, dejando caer una pieza sin que llegue al fondo). En ASTEROIDS/TETRIS/ARKANOID/SNAKE, confirmar que `GamePlayer` **no** re-renderiza durante ese tramo (antes del fix: ~60 renders/s). En FROGGER, confirmar que el comportamiento (ya correcto) no cambió.
   - Grabar otro tramo donde el score/vidas/nivel sí cambian (comer una fruta, destruir un asteroide, limpiar una línea, romper un bloque, llegar a una meta) y confirmar que el HUD de React se actualiza de inmediato, sin retraso perceptible, en los 5 juegos.
   - Confirmar que PAUSA/REANUDAR y JUGAR DE NUEVO siguen funcionando sin regresión en los 5 juegos.

8. **Verificación final**: `npm run lint` y `npm run build` pasan sin errores.

---

## Acceptance criteria

- [ ] `lib/games/engine.ts` exporta `EngineState` y `createStateReporter` tal como se define en el Data model, sin cambiar la forma de `GameCallbacks`, `GameHandle` ni `GameFactory`.
- [ ] `lib/games/asteroids/engine.ts`, `lib/games/tetris/engine.ts`, `lib/games/arkanoid/engine.ts` y `lib/games/snake/engine.ts` usan `createStateReporter` para invocar `onStateChange`, sin ninguna llamada directa a `callbacks.onStateChange` restante en sus loops.
- [ ] `lib/games/frogger/engine.ts` usa el mismo helper compartido en vez de su lógica local de `lastReportedScore/Lives/Level`, con comportamiento observable idéntico al actual.
- [ ] Con React DevTools Profiler, jugar ~5s sin que cambie score/vidas/nivel en ASTEROIDS, TETRIS, ARKANOID y SNAKE no dispara ningún re-render de `GamePlayer` (verificado que antes del fix sí ocurría, a razón de ~60/s).
- [ ] FROGGER sigue reportando cambios de estado exactamente igual que antes del spec (sin regresión).
- [ ] El HUD de React (`displayScore`/`displayLives`/`displayLevel`) se sigue actualizando correctamente y sin retraso perceptible en los 5 juegos cuando el valor sí cambia.
- [ ] Ningún cambio de comportamiento de gameplay (colisiones, física, temporizadores, dificultad, puntuación) en ninguno de los 5 motores — el único cambio es cuándo se invoca `callbacks.onStateChange`.
- [ ] PAUSA/REANUDAR y JUGAR DE NUEVO funcionan sin regresión en los 5 juegos.
- [ ] `npx tsc --noEmit`, `npm run lint` y `npm run build` completan sin errores.

---

## Decisions

- **Sí: alcance limitado al hallazgo crítico (re-render por frame vía `onStateChange`)**, dejando fuera las allocaciones de arrays en Asteroids, el uso de `shadowBlur`/glow en los 5 motores y el clamp de `dt` faltante en Tetris. Razón: el usuario fijó explícitamente el criterio "solo problemas reales detectados, sin hardening preventivo"; estos tres hallazgos no lo cumplen (impacto no confirmado o severidad baja), a diferencia del re-render de React que es medible y confirmado en 4 de los 5 motores. Mezclarlos en el mismo spec diluiría la verificación del único problema con síntoma medible.
- **Sí: helper compartido `createStateReporter` en `lib/games/engine.ts`**, en vez de duplicar la guarda de dedupe (`lastReportedScore/Lives/Level`) en cada uno de los 4 motores que hoy la necesitan. Razón: decidido explícitamente por el usuario; es la misma lógica de 3 comparaciones que FROGGER ya tenía escrita a mano — centralizarla evita 4 copias divergentes del mismo patrón sin cambiar la forma del contrato compartido (`GameCallbacks`/`GameHandle`/`GameFactory` quedan intactos).
- **Sí: FROGGER también migra al helper compartido**, aunque su lógica actual ya era correcta. Razón: decidido explícitamente por el usuario en la fase de clarificación — los 5 motores usan una única implementación validada del mismo patrón en vez de dos versiones equivalentes (una local en Frogger, una compartida en los otros 4) que podrían divergir con el tiempo; el comportamiento observable no cambia.
- **Sí: verificación con React DevTools Profiler** en vez de solo inspección de código o smoke test manual. Razón: decidido explícitamente por el usuario; este proyecto no tiene tests automatizados para los motores de juego (ver CLAUDE.md/AGENTS.md — cada spec de juego real se verifica manualmente), y el Profiler es la única forma objetiva de confirmar que el número de re-renders realmente bajó, no solo que "el juego se ve bien".
- **No: optimizar `.filter()`/`.concat()` por frame en `lib/games/asteroids/engine.ts`.** Hallazgo real pero fuera de alcance por decisión del usuario; candidato a spec futuro si se confirma que causa stutter perceptible con muchas partículas/balas en pantalla.
- **No: reducir o cachear `shadowColor`/`shadowBlur` por entidad** en Frogger/Asteroids/Snake. Hallazgo real pero fuera de alcance por decisión del usuario; además, cualquier ajuste al efecto visual de glow es territorio del subagente `skin-designer` (dueño de las paletas/glow por juego), no de un spec de rendimiento del loop.
- **No: agregar clamp de `dt` en `lib/games/tetris/engine.ts:408`.** Hallazgo de severidad baja sin evidencia de causar un problema real (es un `if` de una sola comprobación, no un bucle acumulador que pueda saturar CPU al volver de una pestaña en segundo plano); fuera de alcance de este spec centrado en el reporte de estado.

---

## Risks

| Riesgo                                                                                                                                                                                     | Mitigación                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dejar de llamar `onStateChange` en cada frame podría introducir un retraso perceptible en el HUD si algún valor cambia justo en el frame donde antes se reportaba "de más".                | El helper compara en cada llamada (que sigue ocurriendo en cada frame, solo que ahora con una guarda antes de invocar el callback), así que cualquier cambio real se reporta en el frame inmediatamente siguiente, sin retraso adicional. El paso 7 del plan verifica manualmente que no hay retraso perceptible en los 5 juegos.                                 |
| Refactorizar FROGGER (que ya funcionaba correctamente) para usar el helper compartido introduce riesgo de regresión en un motor que no tenía el bug.                                       | El comportamiento del helper es funcionalmente idéntico a la lógica local que reemplaza (misma comparación de 3 campos, mismo criterio de "reportar solo si cambió"); el paso 6 del plan incluye una partida completa de verificación manual en Frogger, incluyendo el camino de `killFrog()` que hoy actualiza los `lastReported*` a mano antes de `onGameOver`. |
| El Profiler de React DevTools puede mostrar renders adicionales no relacionados con `onStateChange` (ej. por el resto del árbol de la página), dificultando confirmar que el fix funcionó. | El paso 7 del plan se enfoca específicamente en el componente `GamePlayer` dentro del árbol grabado por el Profiler, y compara el mismo tramo de juego (sin cambios de score/vidas/nivel) antes y después del fix para aislar la diferencia.                                                                                                                      |

---

## What is **not** in this spec

- Optimización de allocaciones de arrays por frame en Asteroids (`.filter()`/`.concat()`).
- Optimización del uso de `shadowBlur`/glow por entidad en los 5 motores.
- Clamp de `dt` en Tetris.
- Cualquier cambio a la física, colisiones, temporizadores, dificultad o puntuación de los 5 juegos.
- Cambios a `components/game-player.tsx`, `components/games/touch-controls.tsx` o cualquier `components/games/<id>-canvas.tsx`.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec futuro.
