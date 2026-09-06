---
name: add-game
description: Genera un spec (mismo formato que specs/05 y 06) para portar o crear el motor real de un juego del Vault e integrarlo al leaderboard de Supabase. Úsalo antes de portar/crear el motor real de CAÍDA, BLOQUE BUSTER, SERPENTINA, GLOTÓN, INVASORES, RANARIA o DUELO PIXEL (ASTEROIDS ya está implementado, SPEC 05).
disable-model-invocation: true
argument-hint: "<game-id o nombre del juego>"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /add-game — Spec generator para motores reales del Vault

## Session context

Fecha de hoy (usar para el header del spec, nunca inventarla):
!`date +%F`

Specs que ya existen:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe todavía"`

Carpetas de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "No existe references/started-games/"`

Motores reales ya portados:
!`ls lib/games/ 2>/dev/null || echo "Todavía no hay ningún motor real portado"`

---

Este skill **solo escribe el spec** (`specs/NN-slug.md`). Nunca implementa código. Existe para no tener que re-derivar, cada vez que se porta o crea un nuevo juego real del Vault, el contrato y los gotchas que ya dejaron establecidos **SPEC 05** (`specs/05-juego-real-rocas-asteroids.md`, ROCAS/Asteroids) y **SPEC 06** (`specs/06-leaderboard-y-catalogo-supabase.md`, leaderboard/catálogo en Supabase).

## Conocimiento de dominio que este skill ya tiene (no volver a preguntarlo)

1. **El contrato ya es genérico y no cambia por juego.** `lib/games/engine.ts` define:

   ```ts
   export interface GameCallbacks {
     onStateChange(state: {
       score: number;
       lives: number;
       level: number;
     }): void;
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

   El spec generado no debe proponer cambiar este contrato salvo que el juego realmente no encaje — y si eso pasa, documentarlo como Decision explícita con su razón.

2. **Patrón de archivos a replicar** (el mismo que estableció SPEC 05 para ASTEROIDS):
   - `lib/games/<id>/engine.ts` exportando `createXxxGame(canvas, callbacks): GameHandle`. Todo el estado mutable (nave/piezas/entidades, score, vidas, nivel, listeners de teclado, `requestAnimationFrame` pendiente) vive **dentro** de la función factory — nunca en variables de módulo. Esto es obligatorio porque React StrictMode invoca efectos dos veces en desarrollo y el usuario puede navegar hacia/desde `/juego/<id>/jugar` repetidamente; variables de módulo se corromperían entre montajes.
   - `components/games/<id>-canvas.tsx` (Client Component), mismo patrón que `components/games/asteroids-canvas.tsx`: un `useEffect` con dependencia `restartKey` que crea el motor y lo destruye en el cleanup, y otro `useEffect` con dependencia `paused` que solo llama `handle.setPaused(paused)`.
   - Wiring en `components/game-player.tsx` para que ese `game.id` renderice el canvas real en vez del arena decorativo, y alimente el HUD desde `onStateChange` en vez del timer falso.

3. **Deuda técnica conocida a incluir siempre en el scope/plan del spec generado**, hasta que algún spec la resuelva: `components/game-player.tsx` hoy resuelve el juego real con un único booleano hardcodeado (`isAsteroids = game.id === "asteroids"`, correctamente alineado con el id real `"asteroids"` de la tabla `games` en Supabase desde el rename de PR #15). Ese patrón funciona pero no escala a más de un juego real. Cada spec que este skill genere debe incluir, en su Implementation plan, migrar ese wiring a un registro (p. ej. `lib/games/registry.ts`, un mapa `game.id -> componente canvas`) que cubra `"asteroids"` más el juego nuevo que se está especificando.
   - **Antes de incluir esto**, verificar con Glob/Read si `lib/games/registry.ts` (o equivalente) ya existe y ya cubre `"asteroids"` correctamente — si ya existe, no lo vuelvas a proponer, solo agrega la entrada del juego nuevo al registro existente.

4. **El leaderboard ya está resuelto (SPEC 06) y es 100% genérico por `game.id`.** `saveScore()` (`lib/scores.ts`) y `getGameWithScores()`/`getAllGamesWithScores()` (`lib/supabase/games.ts`) funcionan para cualquier juego sin cambios. El spec generado debe declarar explícitamente algo como "sin cambios en `lib/scores.ts` ni `lib/supabase/games.ts`" — no propongas tocar esos archivos salvo que haya una razón concreta y nueva.

5. **Tabla id → referencia** (verifícala contra el `ls` real de la sesión de arriba antes de confiar en ella — puede quedar desactualizada a medida que se portan juegos):

   | id              | título        | cat     | carpeta de referencia                                                                                    |
   | --------------- | ------------- | ------- | -------------------------------------------------------------------------------------------------------- |
   | `asteroids`     | ASTEROIDS     | SHOOTER | `02-asteroids` (ya portado, SPEC 05)                                                                     |
   | `caida`         | CAÍDA         | PUZZLE  | `03-tetris`                                                                                              |
   | `bloque-buster` | BLOQUE BUSTER | ARCADE  | `04-arkanoid` (multi-archivo: `game.js` + `levels.js` + assets reales de sprite/audio)                   |
   | `serpentina`    | SERPENTINA    | ARCADE  | `05-snake` (solo trae `sprites.js` + `fruits.png`, un atlas de sprites de frutas — **no hay `game.js`**) |
   | `gloton`        | GLOTÓN        | ARCADE  | ninguna                                                                                                  |
   | `invasores`     | INVASORES     | SHOOTER | ninguna                                                                                                  |
   | `ranaria`       | RANARIA       | ARCADE  | ninguna                                                                                                  |
   | `duelo-pixel`   | DUELO PIXEL   | VERSUS  | ninguna                                                                                                  |

   Un juego con carpeta ya existente en `lib/games/<id>/` (ver session context) ya está portado — avisa antes de generar un spec duplicado.

6. **Gaps de contrato conocidos por juego — conviértelos en Decisions explícitas del spec, nunca las dejes implícitas:**
   - **Sin concepto natural de "vidas"** (p. ej. CAÍDA/Tetris no tiene vidas): `onStateChange` debe reportar `lives` con un valor fijo (p. ej. `0`); decide el valor y documenta la razón.
   - **Estado de "victoria" distinto de "game over"** (p. ej. BLOQUE BUSTER/Arkanoid al limpiar los 5 niveles predefinidos): el contrato solo tiene `onGameOver(finalScore)`, sin un evento de "victoria" separado. Decide si ganar también dispara `onGameOver` (con la puntuación final) y documenta la razón.
   - **Precarga asíncrona de assets** (sprites/audio, p. ej. Arkanoid con `spritesheet-breakout.png` y sonidos `.mp3`): la factory `GameFactory` es síncrona. Decide si los assets se precargan antes de llamar a `createXxxGame`, o si la factory arranca con una bandera de "cargando" internamente y empieza a dibujar/actualizar recién cuando resuelven; documenta cuál y por qué.
   - **Controles originales por mouse/clicks en canvas** (p. ej. la pala de Arkanoid movida con el mouse y un menú de pausa/selección de nivel clickeable dibujado en el propio canvas): decide si se mantienen o se convierten a solo teclado, consistente con el precedente de ASTEROIDS (flechas + espacio, con `preventDefault` en esos códigos mientras el motor está montado).
   - **Sin ninguna referencia de lógica jugable** (SERPENTINA solo trae el atlas de sprites de frutas; GLOTÓN/INVASORES/RANARIA/DUELO PIXEL no tienen ninguna carpeta de referencia): el spec debe decir explícitamente que la mecánica se diseña desde cero siguiendo las reglas clásicas del género (Snake/Pac-Man/Space Invaders/Frogger/Pong respectivamente), y notar qué assets reutilizables existen (p. ej. `references/started-games/05-snake/sprites.js` + `fruits.png` para las frutas de SERPENTINA).

## Fases

Sigue el mismo ritmo que el skill genérico `/spec` (preguntas en bloques de 3-5, `AskUserQuestion` con tu recomendación marcada primero, nunca asumir lo que no se confirmó), pero enfocado en lo que realmente es ambiguo para _este_ juego — no repreguntes nada de la sección "Conocimiento de dominio" de arriba.

### Fase 1 — Identificar el juego objetivo

- Si `$ARGUMENTS` trae un id o nombre reconocible, resuélvelo contra la tabla del punto 5. Si ya existe `lib/games/<id>/` en el session context, avisa que ese juego ya está portado y pregunta si de verdad se quiere un spec nuevo (p. ej. para una segunda iteración) antes de continuar.
- Si `$ARGUMENTS` viene vacío, lista los juegos aún no portados (los que no tienen carpeta en `lib/games/`) y usa `AskUserQuestion` para que el usuario elija cuál especificar.

### Fase 2 — Leer la referencia si existe

- Si la tabla del punto 5 indica una carpeta en `references/started-games/`, lee su(s) archivo(s) de lógica principal (`game.js`, y `levels.js`/módulos de assets si aplica) para fundamentar el Implementation plan en código real — igual que SPEC 05 lo hizo leyendo `references/started-games/02-asteroids/game.js`.
- Si no hay referencia (o solo hay un atlas de sprites como en SERPENTINA), dilo explícitamente y pasa a diseño desde cero para ese juego.

### Fase 3 — Aclarar decisiones abiertas

Usa `AskUserQuestion` en bloques de 3-5 preguntas, mismo tono que `/spec` (concretas, con opciones y tu recomendación marcada). Pregunta solo:

- Los gaps de contrato del punto 6 que apliquen a este juego en particular.
- Si el registro de wiring (punto 3) sigue pendiente o ya existe (confírmalo con Glob/Read, no lo preguntes si ya lo verificaste).
- Cualquier otra ambigüedad genuina de scope/datos/UX, usando las mismas categorías de pregunta que `/spec` (Scope, Data, Integración, Persistencia, UX y estados, Riesgos, Decisiones ya cerradas).

No sigas preguntando una vez puedas responder sin asumir nada: qué archivos van a aparecer/cambiar, cuál es el primer y último paso ejecutable, y cómo se verifica que quedó terminado.

### Fase 4 — Escribir el spec

0. **Antes de escribir absolutamente nada**, localiza y lee completo el skill `/spec` (habitualmente en `~/.claude/skills/spec/SKILL.md`, el directorio de skills de usuario — usa Glob si no conoces la ruta exacta en esta máquina, por ejemplo `**/skills/spec/SKILL.md`) y su `template.md` si existe en esa misma carpeta. Este skill (`add-game`) resume ese formato en el punto 4 de la Fase 4 de abajo, pero esa versión puede quedar desactualizada si `/spec` cambia de sección, orden, nombres de campos, o su lógica de numeración/`specs/.spec-config.yml`. Si `/spec` existe en esta máquina, sus reglas de formato/escritura (numeración, slug, secciones, estado `Draft`, seed de `specs/.spec-config.yml`) tienen prioridad sobre el resumen de este skill — síguelas tal cual las encuentres ahí. Si no lo encuentras, sigue el resumen de abajo y dilo explícitamente en la confirmación final.
1. Determina el siguiente número secuencial a partir del `ls specs/` del session context (el más alto + 1, con cero a la izquierda a dos dígitos).
2. Genera un slug kebab-case al estilo de los existentes, p. ej. `07-juego-real-caida-tetris.md`.
3. Usa la fecha del session context para `**Date:**` — nunca la inventes.
4. Sigue el mismo orden de secciones y el mismo tono que `specs/05-juego-real-rocas-asteroids.md` y `specs/06-leaderboard-y-catalogo-supabase.md` (léelos si no los tienes frescos): Header (Status/Depends on/Date/Objective) → "Por qué existe este spec" → Scope (In/Out of scope) → Data model → Implementation plan (pasos numerados, cada uno verificable) → Acceptance criteria (checklist, no aspiracional) → Decisions (Sí/No + Razón) → Risks (tabla) → "What is **not** in this spec".
5. Marca `Status: Draft`. **Nunca lo marques `Approved`** — eso lo hace el usuario.
6. Si `/spec` seed un `specs/.spec-config.yml` (ver su propio paso de Fase 4) y ese archivo no existe todavía, créalo con el contenido por defecto que indica `/spec`; si ya existe, no lo toques.
7. Escribe el archivo directamente en `specs/NN-slug.md`. No pidas permiso para el nombre del archivo — anúncialo en la confirmación final. Solo pregunta si el archivo destino ya existe.
8. Confirma al usuario: la ruta del archivo creado, que quedó en estado `Draft`, y que el siguiente paso es revisarlo, marcarlo `Approved`, y correr `/spec-impl NN-slug` para implementarlo.
9. **Detente ahí.** No propongas implementar el spec, escribir código, ni ninguna acción más allá de esa confirmación.

## Hard rules

- Nunca escribas código durante este skill — solo el `.md` del spec al final.
- Nunca propongas implementar el spec después de guardarlo.
- Nunca asumas una decisión que el usuario no confirmó — si falta información, pregunta en la Fase 3.
- No repreguntes en la Fase 3 lo que la sección "Conocimiento de dominio" ya resuelve (el contrato es genérico, el leaderboard no necesita cambios, etc.) — solo lo ambiguo para este juego específico.
- Si el registro de wiring (`lib/games/registry.ts` o equivalente) ya existe y ya cubre `"asteroids"` correctamente, no lo vuelvas a proponer como si faltara — solo agrega la entrada del juego nuevo.
