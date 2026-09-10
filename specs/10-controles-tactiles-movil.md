# SPEC 10 — Controles táctiles para móvil

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-09-09
> **Objective:** Agregar controles táctiles en pantalla (D-pad + botones de acción) para los 4 juegos con motor real (ASTEROIDS, TETRIS, ARKANOID, SNAKE), para que sean completamente jugables en dispositivos táctiles sin teclado físico, sin modificar ninguno de los 4 motores existentes ni el contrato `lib/games/engine.ts`.

---

## Por qué existe este spec

Los 4 motores reales (`lib/games/asteroids/engine.ts`, `tetris/engine.ts`, `arkanoid/engine.ts`, `snake/engine.ts`, creados por SPEC 05/07/08/09) solo escuchan `window.addEventListener("keydown"/"keyup", ...)` sobre `e.code`. En un dispositivo táctil sin teclado físico esos juegos son literalmente injugables hoy — SPEC 09 documentó esto explícitamente como riesgo aceptado ("Sin controles táctiles, SNAKE no es jugable en dispositivos sin teclado físico") y lo dejó fuera de alcance en los 4 specs anteriores.

La solución elegida evita tocar los 4 motores o el contrato compartido: los botones en pantalla despachan `KeyboardEvent` sintéticos sobre `window` con el mismo `code` que ya escuchan los motores (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Space`). Los motores no distinguen entre un evento de teclado real y uno sintético — desde su perspectiva es indistinguible, así que `lib/games/engine.ts`, los 4 `engine.ts` y `lib/games/registry.ts` quedan sin cambios.

Se inspeccionó el manejo de input de los 4 motores antes de diseñar este spec:

- **ASTEROIDS** (`lib/games/asteroids/engine.ts:48-68`): mantiene un registro `keys` (estado sostenido, para rotar/acelerar) y `justPressed` (flanco de subida, para disparar con `Space` — mantener la tecla físicamente presionada solo dispara una vez, ya lo maneja el propio motor).
- **ARKANOID** (`lib/games/arkanoid/engine.ts:275`): mismo patrón `keys` sostenido, solo `ArrowLeft`/`ArrowRight`.
- **SNAKE** (`lib/games/snake/engine.ts:99-100,225-232`): sin registro de estado — cada `keydown` cambia `pendingDirection` directamente; no escucha `keyup`.
- **TETRIS** (`lib/games/tetris/engine.ts:372-393`): sin registro de estado — cada `keydown` mueve/rota/hace hard-drop directamente; no escucha `keyup`. En teclado físico, mantener `←`/`→`/`↓`/`↑` presionado mueve repetidamente solo porque el sistema operativo repite el evento `keydown` nativo — un botón táctil no tiene ese auto-repeat del SO, así que TETRIS es el único de los 4 motores que necesita que la UI táctil simule ese repeat.

Esto determina el diseño: los botones de ASTEROIDS/ARKANOID despachan `keydown` en el toque y `keyup` al soltar (estado sostenido); los de SNAKE despachan un solo `keydown` por toque (sin `keyup`, el motor no lo escucha); los de TETRIS despachan `keydown` inmediato y lo repiten cada 120ms mientras se mantiene presionado (excepto el botón de `Space`/CAÍDA, que dispara una sola vez).

---

## Scope

**In:**

- **Detección de capacidad táctil por CSS**, no por JavaScript: el panel de controles y el aviso de orientación se muestran/ocultan con `@media (pointer: coarse)`, evitando problemas de hidratación SSR (el marcado se renderiza siempre; la visibilidad la decide el navegador según el dispositivo de entrada real, no el ancho de ventana).
- **`lib/games/touch-controls.ts`** (nuevo, mismo patrón que `lib/games/skins.ts`): exporta los tipos `TouchButtonConfig` (`{ code: string; label: string; repeat?: boolean }`) y `TouchLayoutConfig` (`{ dpad: { up?, down?, left?, right?: TouchButtonConfig }; actions: TouchButtonConfig[] }`), y la constante `TOUCH_LAYOUTS: Record<string, TouchLayoutConfig>` con una entrada por cada uno de los 4 juegos con motor real:
  - `asteroids`: `dpad.left`/`dpad.right` → rotar (`ArrowLeft`/`ArrowRight`), `dpad.up` → acelerar (`ArrowUp`); `actions: [{ code: "Space", label: "DISPARAR" }]`.
  - `tetris`: `dpad.left`/`dpad.right`/`dpad.down` → mover/caída suave (`ArrowLeft`/`ArrowRight`/`ArrowDown`, `repeat: true`), `dpad.up` → rotar (`ArrowUp`, `repeat: true`); `actions: [{ code: "Space", label: "CAÍDA" }]` (sin repeat).
  - `arkanoid`: solo `dpad.left`/`dpad.right` → mover paleta (`ArrowLeft`/`ArrowRight`); `actions: []`.
  - `snake`: `dpad.up`/`dpad.down`/`dpad.left`/`dpad.right` → cambiar de dirección; `actions: []`.
- **`components/games/touch-controls.tsx`** (nuevo, Client Component): `TouchControls({ gameId }: { gameId: string })`. Lee `TOUCH_LAYOUTS[gameId]`; si no existe la entrada, no renderiza nada. Dibuja el D-pad como una cruz (grid CSS 3×3, centro vacío) y los botones de `actions` a un costado, con tamaño de toque de al menos 56×56px. Cada botón usa `onPointerDown`/`onPointerUp`/`onPointerCancel`/`onPointerLeave` (Pointer Events, no Touch Events, para multi-touch nativo entre botones distintos sin plumbing adicional) para despachar `window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }))` al presionar y `keyup` equivalente al soltar/cancelar. Los botones con `repeat: true` agregan un `setInterval(120ms)` que repite el `keydown` mientras siguen presionados, limpiado en `pointerup`/`pointercancel`/`pointerleave` y al desmontar. CSS `touch-action: none` en el panel completo para evitar scroll/zoom accidental del navegador al interactuar, y `-webkit-touch-callout: none` + `user-select: none` en los botones para evitar el menú contextual de iOS en toques largos.
- **`components/game-player.tsx`**: importa y renderiza `<TouchControls gameId={game.id} />` inmediatamente después del bloque `.crt`, solo cuando `hasRealEngine` es `true` (mismo criterio ya usado para `EngineCanvas` vs. el arena decorativo). No se agrega ninguna condición de JavaScript sobre táctil/no-táctil aquí — la visibilidad la resuelve el CSS de `.touch-controls`.
- **Aviso de orientación** ("gira tu dispositivo"): un `<div className="rotate-hint">` estático agregado junto a `TouchControls` en `game-player.tsx` (solo cuando `hasRealEngine`), oculto por defecto y mostrado vía `@media (pointer: coarse) and (orientation: portrait)`. No bloquea el juego (el canvas sigue jugando y escalando en modo retrato); es solo un mensaje informativo no intrusivo. No se usa la Screen Orientation Lock API.
- **CSS nuevo en `app/globals.css`**: estilos de `.touch-controls` (panel, D-pad en cruz, botones de acción), la media query `@media (pointer: coarse) { .touch-controls { display: flex } }` (oculto por defecto, mostrado solo con puntero de tipo "coarse" — táctil), y `.rotate-hint` con su media query de orientación. Sigue el lenguaje visual neon/pixel ya usado por `.btn`/`.chip`.
- Los 4 motores (`lib/games/*/engine.ts`), `lib/games/engine.ts` (contrato `GameCallbacks`/`GameHandle`/`GameFactory`) y `lib/games/registry.ts` quedan **sin ningún cambio** — reciben los eventos táctiles como si fueran de teclado real, sin saberlo.

**Out of scope (para specs futuros):**

- Los 4 juegos sin motor real (Glotón, Invasores, Ranaria, Duelo Pixel) — siguen con el arena decorativo, sin controles táctiles hasta que tengan un `/add-game` real.
- Gestos de swipe (Snake) o drag (Asteroids) — se descartó explícitamente; los 4 juegos usan D-pad de botones por consistencia.
- Bloqueo de orientación con la Screen Orientation Lock API — solo aviso no bloqueante.
- Vibración/haptic feedback al tocar los botones.
- Soporte de gamepad físico (Bluetooth) conectado a móvil.
- Ajustes de layout/tamaño de fuente del resto de la página (`player-hud`, modal "FIN DEL JUEGO") más allá de lo que ya provee el CSS responsive existente — este spec solo agrega el panel de controles y el aviso de orientación.
- Tests automatizados.

---

## Data model

Esta feature no introduce datos persistidos (no hay tabla nueva, no hay `localStorage`). Introduce dos structures nuevas en código, ambas en `lib/games/touch-controls.ts`:

```ts
// lib/games/touch-controls.ts
export interface TouchButtonConfig {
  code: string; // KeyboardEvent.code a despachar (ej. "ArrowLeft", "Space")
  label: string; // texto/símbolo visible en el botón (ej. "◄", "DISPARAR")
  repeat?: boolean; // true = auto-repeat cada 120ms mientras se mantiene presionado (solo TETRIS)
}

export interface TouchLayoutConfig {
  dpad: {
    up?: TouchButtonConfig;
    down?: TouchButtonConfig;
    left?: TouchButtonConfig;
    right?: TouchButtonConfig;
  };
  actions: TouchButtonConfig[]; // botones sueltos junto al D-pad (ej. DISPARAR, CAÍDA)
}

export const TOUCH_LAYOUTS: Record<string, TouchLayoutConfig>;
// claves: "asteroids" | "tetris" | "arkanoid" | "snake"
```

No cambia `lib/games/engine.ts`, ningún `lib/games/<id>/engine.ts`, ni `lib/games/registry.ts`.

---

## Implementation plan

1. Crear `lib/games/touch-controls.ts` con los tipos `TouchButtonConfig`/`TouchLayoutConfig` y la constante `TOUCH_LAYOUTS` con las 4 entradas descritas en el Scope. Verificación: `npx tsc --noEmit` sin errores.
2. Crear `components/games/touch-controls.tsx` (`"use client"`): componente `TouchControls({ gameId })` que lee `TOUCH_LAYOUTS[gameId]`, renderiza el D-pad (grid 3×3) y los `actions`, con los handlers de Pointer Events que despachan `KeyboardEvent` sintéticos como se describe arriba (`repeat: true` con `setInterval(120ms)` limpiado correctamente en todos los caminos de salida — `pointerup`, `pointercancel`, `pointerleave`, desmontaje). Verificación: `npx tsc --noEmit` sin errores; el componente compila como Client Component.
3. Agregar en `app/globals.css` los estilos de `.touch-controls` (panel + D-pad en cruz + botones de acción, `touch-action: none`, tamaño mínimo de toque 56×56px, lenguaje visual neon/pixel consistente con `.btn`/`.chip`) bajo `@media (pointer: coarse)`, y `.rotate-hint` bajo `@media (pointer: coarse) and (orientation: portrait)`. Verificación visual: `npm run dev` + Chrome DevTools con emulación táctil activada (device toolbar) muestra el panel; con el mouse normal (sin emulación) permanece oculto.
4. Modificar `components/game-player.tsx`: importar `TouchControls` y renderizar `{hasRealEngine && <TouchControls gameId={game.id} />}` y el `<div className="rotate-hint">...</div>` correspondiente, ambos justo después del bloque `.crt`. Verificación: `npx tsc --noEmit` sin errores.
5. Verificación end-to-end manual en `npm run dev` con Chrome DevTools device toolbar (emulación táctil, un dispositivo móvil del listado) para cada uno de los 4 juegos:
   - **ASTEROIDS** (`/juego/asteroids/jugar`): tocar `◄`/`►` rota la nave, mantener `▲` acelera, tocar `DISPARAR` dispara una sola vez por toque (mantenerlo presionado no dispara en ráfaga); mantener rotar + acelerar + disparar simultáneamente (multi-touch, 3 dedos) funciona igual que las 3 teclas físicas a la vez.
   - **TETRIS** (`/juego/tetris/jugar`): tocar `◄`/`►` mueve una celda; mantenerlos presionados repite el movimiento (auto-repeat cada 120ms); `▼` mantiene caída suave repetida; `▲` rota repetidamente si se mantiene; `CAÍDA` hace hard-drop una sola vez por toque.
   - **ARKANOID** (`/juego/arkanoid/jugar`): mantener `◄`/`►` mueve la paleta de forma continua y fluida, igual que con teclado.
   - **SNAKE** (`/juego/snake/jugar`): tocar cada flecha del D-pad cambia de dirección en el siguiente tick; no se puede invertir 180° (comportamiento ya existente del motor, sin regresión).
   - Confirmar que el panel de controles y el aviso de orientación aparecen solo con la emulación táctil activa (desaparecen al desactivar la emulación y usar el mouse normal), y que el aviso de orientación se muestra en viewport retrato y desaparece en apaisado.
   - Confirmar que el teclado físico (probado sin emulación táctil, en desktop normal) sigue funcionando exactamente igual que antes en los 4 juegos — sin regresión.
   - Verificación final: `npm run lint` y `npm run build` pasan sin errores.

---

## Acceptance criteria

- [ ] `lib/games/touch-controls.ts` exporta `TOUCH_LAYOUTS` con una entrada por cada uno de `asteroids`, `tetris`, `arkanoid`, `snake`, con los `code` correctos descritos en el Scope.
- [ ] `components/games/touch-controls.tsx` renderiza un D-pad + botones de acción según `TOUCH_LAYOUTS[gameId]`, y no renderiza nada si `gameId` no tiene entrada.
- [ ] Con emulación táctil activa en Chrome DevTools, el panel de controles es visible en los 4 juegos con motor real; con el mouse normal (sin emulación táctil) permanece oculto.
- [ ] En ASTEROIDS, los botones táctiles rotan/aceleran/disparan igual que las teclas físicas equivalentes, incluyendo mantener los 3 al mismo tiempo (multi-touch).
- [ ] En TETRIS, mantener presionado `◄`/`►`/`▼`/`▲` repite la acción cada ~120ms; el botón `CAÍDA` hace hard-drop una sola vez por toque sin repetir.
- [ ] En ARKANOID, mantener `◄`/`►` mueve la paleta de forma continua.
- [ ] En SNAKE, cada toque de flecha cambia de dirección correctamente en el siguiente tick.
- [ ] El aviso de orientación aparece solo con puntero táctil en modo retrato, y desaparece en modo apaisado o sin puntero táctil.
- [ ] Ninguno de los 4 archivos `lib/games/<id>/engine.ts`, `lib/games/engine.ts` ni `lib/games/registry.ts` tiene cambios.
- [ ] El control por teclado físico en los 4 juegos sigue funcionando exactamente igual que antes de este spec (sin regresión).
- [ ] Los 4 juegos sin motor real siguen mostrando el arena decorativo sin controles táctiles añadidos.
- [ ] `npm run build` y `npm run lint` completan sin errores de tipos ni de ESLint.

---

## Decisions

- **Sí:** despachar `KeyboardEvent` sintéticos (`keydown`/`keyup` con el `code` correspondiente) sobre `window` desde los botones táctiles, en vez de extender el contrato `GameHandle`/`GameCallbacks`. Razón: decidido explícitamente por el usuario; cero cambios a los 4 motores existentes ni al contrato compartido de SPEC 05 — los motores ya escuchan `window.addEventListener("keydown"/"keyup")` sobre `e.code`, así que un evento sintético es indistinguible de uno real desde su perspectiva.
- **Sí:** mostrar/ocultar el panel de controles y el aviso de orientación con CSS puro (`@media (pointer: coarse)`), no con JavaScript/`matchMedia` en React state. Razón: decidido explícitamente por el usuario que la detección fuera "por capacidad táctil"; resolverlo en CSS evita problemas de hidratación SSR (el marcado es idéntico en servidor y cliente, la visibilidad la decide el navegador) y es más simple que sincronizar estado de React con un listener de `matchMedia`.
- **Sí:** cubrir los 4 juegos con motor real (ASTEROIDS, TETRIS, ARKANOID, SNAKE) en un solo spec. Razón: decidido explícitamente por el usuario; los 4 comparten el mismo mecanismo de despacho de eventos y el mismo panel/CSS, así que separarlos en specs distintos solo fragmentaría trabajo idéntico.
- **Sí:** soporte de multi-touch real (varios botones presionados a la vez) vía Pointer Events nativos, sin plumbing adicional de tracking de `pointerId` por botón. Razón: decidido explícitamente por el usuario; necesario para ASTEROIDS (rotar + acelerar + disparar simultáneo) y TETRIS (mover + caída suave); los Pointer Events ya soportan múltiples punteros simultáneos en elementos distintos de forma nativa.
- **Sí:** simular auto-repeat (cada 120ms) solo en los botones de D-pad de TETRIS, no en ningún otro botón. Razón: decidido explícitamente por el usuario; TETRIS es el único motor que reacciona a cada `keydown` individual sin registro de estado sostenido, dependiendo del auto-repeat nativo del sistema operativo en teclado físico — un botón táctil no tiene ese auto-repeat y hay que simularlo. El botón `CAÍDA` (hard drop) se excluye deliberadamente del repeat para no spammear caídas.
- **Sí:** D-pad de botones para los 4 juegos (incluyendo SNAKE), no gestos de swipe. Razón: decidido explícitamente por el usuario; consistente visualmente entre los 4 juegos y más simple de implementar/verificar que afinar umbrales de gesto y evitar conflictos con el scroll de la página.
- **Sí:** panel de controles fijo debajo de `.crt` (fuera del canvas), no overlay semitransparente encima del área jugable. Razón: decidido explícitamente por el usuario; no tapa el área de juego ni choca con los chips de selección de skin que ya existen en la esquina superior derecha del canvas (ASTEROIDS/ARKANOID/SNAKE, agregados por el sistema de skins).
- **Sí:** aviso de orientación no bloqueante ("gira tu dispositivo"), sin usar la Screen Orientation Lock API. Razón: decidido explícitamente por el usuario; la API de bloqueo de orientación requiere modo fullscreen y tiene soporte inconsistente entre navegadores — un aviso informativo es suficiente y el juego sigue siendo jugable en retrato.
- **Sí:** verificación manual con el device toolbar de Chrome DevTools (emulación táctil), no con un dispositivo físico real. Razón: decidido explícitamente por el usuario; mismo nivel de rigor de verificación manual que SPEC 05-09, sin depender de tener hardware físico a mano.
- **No:** juegos decorativos (Glotón, Invasores, Ranaria, Duelo Pixel) fuera de alcance. Razón: decidido explícitamente por el usuario; no tienen motor jugable real todavía, agregar controles táctiles a un arena decorativo no tiene efecto funcional.
- **No:** vibración/haptic feedback, gamepad Bluetooth, bloqueo de orientación real. Razón: no mencionados por el usuario como necesarios; quedan como posibles specs futuros si se necesitan.

---

## Risks

| Riesgo                                                                                                                                                                                                                                                                           | Mitigación                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin `preventDefault()`/`touch-action: none` correctamente aplicado, tocar el D-pad podría hacer scroll o zoom de la página en vez de controlar el juego.                                                                                                                         | El panel completo usa `touch-action: none` en CSS; se verifica manualmente en el paso 5 del plan que ningún toque sobre los botones mueve la página.                                                                                                                  |
| iOS puede mostrar el menú contextual de "copiar/compartir" en toques largos sobre los botones táctiles, interrumpiendo el input.                                                                                                                                                 | `-webkit-touch-callout: none` y `user-select: none` en los botones, verificado en la emulación de DevTools (Chrome no reproduce este comportamiento específico de Safari, así que se documenta como riesgo conocido no verificable 100% sin un dispositivo iOS real). |
| El `setInterval` de 120ms del repeat de TETRIS podría no limpiarse en algún camino de salida (ej. el dedo se desliza fuera del botón sin disparar `pointerup`), dejando un repeat "pegado" disparando indefinidamente.                                                           | Se limpia explícitamente en `pointerup`, `pointercancel` **y** `pointerleave` (cubre el caso de deslizar el dedo fuera del botón sin levantarlo), además de en el `cleanup` del efecto de React al desmontar. Verificado manualmente en el paso 5.                    |
| Detección por CSS (`pointer: coarse`) puede no coincidir 100% con "es un teléfono/tablet real" — una laptop con pantalla táctil pero uso primario de mouse podría mostrar el panel innecesariamente, o un dispositivo hÃ­brido reportar `pointer: fine` con un stylus conectado. | Aceptado como comportamiento estándar de la media feature CSS `pointer` (mismo criterio que usan la mayoría de sitios responsive); no se intenta una heurística más compleja de detección de dispositivo.                                                             |

---

## What is **not** in this spec

- Los 4 juegos sin motor real (Glotón, Invasores, Ranaria, Duelo Pixel).
- Gestos de swipe o drag como alternativa al D-pad.
- Bloqueo de orientación con la Screen Orientation Lock API.
- Vibración/haptic feedback.
- Soporte de gamepad físico Bluetooth en móvil.
- Cambios de layout al HUD (`player-hud`) o al modal "FIN DEL JUEGO" más allá del CSS responsive ya existente.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
