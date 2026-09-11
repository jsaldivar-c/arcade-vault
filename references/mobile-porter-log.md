# Mobile Porter — Historial de auditorías

> Mantenido automáticamente por el subagente `mobile-porter`. No editar manualmente sin necesidad.
> Recordatorio: este repo no tiene app nativa — "móvil" = este mismo Next.js visto desde un navegador de teléfono/tablet.

## 2026-09-10

**Páginas/componentes revisados:** Prioridad en las pantallas de FROGGER recién portado (`/juego/frogger`, `/juego/frogger/jugar` vía `components/game-player.tsx` genérico, y su card en `/biblioteca` vía `components/game-card.tsx` genérico), más revisión de regresión en `components/nav.tsx`, `components/home.tsx` (diff de esta spec), `lib/games/touch-controls.ts`, `components/games/touch-controls.tsx`, y los otros 3 canvases con skin (`asteroids-canvas.tsx`, `snake-canvas.tsx`, `arkanoid-canvas.tsx`) por compartir el mismo patrón de selector de skin que frogger.

**Corregido:**

- `lib/games/touch-controls.ts` — no existía entrada `frogger` en `TOUCH_LAYOUTS`, así que `/juego/frogger/jugar` no mostraba ningún panel de controles táctiles (sin `TOUCH_LAYOUTS[gameId]`, `TouchControls` no renderiza nada) → agregada entrada `frogger` con d-pad de 4 flechas sin `actions` ni `repeat` (idéntica a `snake`, ya que el motor de frogger trata cada `keydown` como un salto discreto, igual que snake con `pendingDirection`).
- `components/games/asteroids-canvas.tsx:91`, `components/games/snake-canvas.tsx:104`, `components/games/arkanoid-canvas.tsx:103`, `components/games/frogger-canvas.tsx:92` — los chips del selector de skin (`style={{ padding: "6px 8px", fontSize: 8 }}`) rendian un tap target de ~50×22px, por debajo del mínimo de 44×44px (y muy por debajo de los 56×56px que SPEC 10 estableció para el D-pad táctil) → agregado `minWidth: 44, minHeight: 44` a los 4 (mismo patrón heredado del sistema de skins, no introducido por frogger, pero corregido en los 4 para no dejar 3 juegos inconsistentes con el recién portado).

**Pendiente (requiere decisión del usuario o verificación visual):**

- El HUD interno del canvas de frogger (score/nivel/vidas/barra de tiempo, dibujado con `ctx.fillText`/`ctx.font = "bold 14px monospace"` en `lib/games/frogger/engine.ts`) escala junto con el canvas: en un viewport muy angosto (~360-400px de ancho, `.crt`/`.crt-screen` sin padding reducido en breakpoints pequeños) el canvas lógico de 800px se renderiza a ~260-280px, así que ese texto de 14px de canvas podría verse pequeño/poco legible en un teléfono real. No lo toqué porque corregirlo requiere editar `lib/games/frogger/engine.ts`, fuera de mi alcance (hard rule). Si el usuario confirma que es un problema real al probarlo, la corrección (aumentar el tamaño de fuente del HUD interno o simplificar su contenido en pantallas angostas) debe hacerse en una corrida de código normal, no por mí.
- `.crt`/`.crt-screen` no reduce su `padding` (24px fijo) en ningún breakpoint pequeño, lo que deja el área jugable de los 5 juegos con motor real bastante angosta en teléfonos de gama chica (~270-300px de ancho calculado en iPhone SE). Es una condición preexistente compartida por los 5 juegos (no una regresión de frogger) y forma parte del bisel "CRT" visual deliberado de la app, así que no lo cambié unilateralmente — queda como observación para que el usuario decida si vale la pena reducir el padding del bisel en pantallas pequeñas.
- No verifiqué visualmente nada de esto (sin herramientas de navegador). El usuario debe confirmar en `npm run dev` con el device toolbar de Chrome DevTools: el panel de controles táctiles de FROGGER aparece y funciona con emulación táctil, los 3 chips de skin (en los 4 juegos) ahora tienen un área de toque cómoda, y no hay overflow horizontal en `/juego/frogger`, `/juego/frogger/jugar` ni su card en `/biblioteca`.

Esta corrida se ejecutó siguiendo las instrucciones de `.claude/agents/mobile-porter.md` directamente en la conversación principal (no como subagente aislado) porque el subagente `mobile-porter` no aparecía disponible vía el Agent tool en esta sesión (mismo problema ya reportado con `skin-designer`).
