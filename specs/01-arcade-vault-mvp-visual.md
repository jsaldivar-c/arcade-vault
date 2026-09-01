# SPEC 01 — MVP visual de Arcade Vault

> **Status:** Implementado
> **Depends on:** —
> **Date:** 2026-08-30
> **Objective:** Implementar como rutas reales de Next.js App Router las 5 pantallas visuales de Arcade Vault (Biblioteca, Detalle, Reproductor, Salón de la Fama y Auth), replicando fielmente el diseño y la interactividad de UI del prototipo en `references/templates` sin implementar lógica real de ningún juego ni backend.

---

## Por qué existe este spec

`references/templates/` es un prototipo estático HTML/Babel-en-navegador que define la UX completa de Arcade Vault (enrutamiento por hash, estado en `window` globals, `localStorage`). Ese prototipo **no** es la arquitectura objetivo: hay que convertirlo en rutas reales de App Router, Server/Client Components y CSS integrado con Tailwind v4, conservando la fidelidad visual y de interacción, pero sin arrastrar sus patrones de implementación (hash-router, globals).

---

## Scope

**In:**

- Las 5 pantallas del prototipo, como rutas reales de App Router:
  - `/` — Biblioteca (`biblioteca.jsx` → `Library`, `GameCard`)
  - `/juego/[id]` — Detalle del juego (`detalle.jsx` → `GameDetail`)
  - `/juego/[id]/jugar` — Reproductor (`reproductor.jsx` → `GamePlayer`)
  - `/salon` — Salón de la Fama (`salon.jsx` → `HallOfFame`)
  - `/auth` — Iniciar sesión / crear cuenta (`auth.jsx` → `Auth`)
- Navegación global (`nav.jsx` → `Nav`) en el layout raíz: logo, links activos según ruta, contador de créditos estático, botón de sesión, menú móvil.
- Tema visual fiel al prototipo: paleta neón/pixel, fondo con grid animado y scanlines, tipografía "Press Start 2P" (títulos) y "JetBrains Mono" (texto/mono), portadas de juego generadas 100% con CSS, marco CRT del reproductor.
- Interactividad de UI replicada como Client Components: buscador y chips de categoría en la Biblioteca, efecto tilt de las tarjetas, tabs del Salón de la Fama, pausa/fin de partida y guardado de puntuación en el Reproductor, tabs y envío del formulario de Auth, apertura/cierre del menú móvil.
- Datos mock estáticos migrados de `data.jsx` a `lib/data.ts` (`GAMES`, `CATS`, `PLAYERS`, `seededScores`), sin base de datos ni API.
- Sesión de usuario simulada (`localStorage`, clave `av_user`) vía un `SessionProvider` de React Context: login (con nombre), logout, "jugar como invitado", nombre visible en `Nav` y precargado en el Reproductor y en la fila "tu mejor marca" del Salón.
- Guardado de la puntuación final del Reproductor en `localStorage` (clave `av_scores`) como efecto de UI equivalente al del prototipo, sin que alimente ninguna pantalla (el Salón sigue usando `seededScores` mock, igual que el prototipo).

**Out of scope (para specs futuros):**

- Lógica real de cualquiera de los 8 juegos (Bloque Buster, Caída, Serpentina, Glotón, Invasores, Rocas, Ranaria, Duelo Pixel). El Reproductor solo muestra el marco decorativo (HUD, CRT, animaciones CSS, temporizador de puntuación falso) igual que el prototipo — no hay motor de juego.
- Backend o API real de autenticación: no hay validación de credenciales, ni registro real, ni OAuth con Google/GitHub (los botones sociales quedan decorativos, sin acción).
- Persistencia real de puntuaciones que alimente el Salón de la Fama o cualquier ranking real entre usuarios.
- Base de datos o servicio externo de cualquier tipo.
- Sonido o música.
- PWA / soporte offline / service workers.
- Tests automatizados.

---

## Data model

Módulo `lib/data.ts`, migración tipada de `data.jsx`:

```ts
export type CategoryFilter = "TODOS" | "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Exclude<CategoryFilter, "TODOS">;
  cover: string; // clase CSS .cover-* definida en globals.css
  color: GameColor;
  best: number;
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/2026"
}

export const GAMES: Game[];
export const CATS: CategoryFilter[];
export const PLAYERS: string[];
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Sesión de usuario (`lib/session.tsx`), sin persistencia de esquema versionado (es un mock):

```ts
export interface SessionUser {
  name: string;
}
// Context: { user: SessionUser | null; login(name: string): void; logout(): void }
```

Puntuación guardada (`lib/scores.ts`), solo escritura, sin lectura en ninguna pantalla de este MVP:

```ts
export interface SavedScore {
  game: string; // Game["id"]
  score: number;
  name: string;
  at: number; // Date.now()
}
export function saveScore(entry: SavedScore): void; // push a localStorage "av_scores"
```

---

## Implementation plan

1. Configurar fuentes con `next/font/google` ("Press Start 2P" y "JetBrains Mono") en `app/layout.tsx`, expuestas como variables CSS, y actualizar el `metadata` (title/description en español). Verificación: `npm run dev` sigue sirviendo sin errores.
2. Crear `lib/data.ts` con los tipos y los datos migrados de `data.jsx` (`GAMES`, `CATS`, `PLAYERS`, `seededScores`). Verificación: `npx tsc --noEmit` sin errores.
3. Reemplazar `app/globals.css` por el tema visual portado de `references/templates/styles.css` (variables de color, fondo `.av-bg` animado, tipografía pixel/mono, `.btn`, `.card`, `.cover-*`, etc.), mapeando los colores como tokens `@theme` de Tailwind v4. Verificación visual: la home (aún con el `page.tsx` placeholder) muestra el fondo oscuro con grid animado y las fuentes correctas.
4. Crear `lib/session.tsx` con `SessionProvider` (Client Component, Context) que lea/escriba `localStorage` bajo la clave `av_user`, y el hook `useSession()`. Montarlo en `app/layout.tsx` envolviendo el contenido. Verificación: sin login, `useSession().user` es `null` tras recargar la página.
5. Crear `components/nav.tsx` (Client Component) migrado de `nav.jsx`: logo, links Biblioteca/Salón con estado activo vía `usePathname`, contador de créditos estático, botón de sesión (Iniciar sesión / nombre + salir) conectado a `useSession`, y panel de menú móvil. Montarlo en `app/layout.tsx`. Verificación: la nav aparece en todas las rutas; el menú móvil abre/cierra por debajo de 840px de ancho.
6. Crear `components/game-card.tsx` y `components/library.tsx` (Client Component) migrados de `biblioteca.jsx`: buscador, chips de categoría, grid de tarjetas con efecto tilt, estado vacío "NO HAY RESULTADOS". Usarlos en `app/page.tsx` (`/`). Verificación: buscar por nombre y filtrar por categoría actualiza el grid en vivo.
7. Crear `app/juego/[id]/page.tsx` migrado de `detalle.jsx`: portada, tags, descripción, `stat-strip`, leaderboard con `seededScores`, botón JUGAR AHORA (`Link` a `/juego/[id]/jugar`) y VOLVER AL VAULT (`Link` a `/`). Usar `notFound()` si el `id` no existe en `GAMES`. Verificación: `/juego/bloque-buster` renderiza los datos del juego; una ruta con id inexistente muestra 404.
8. Crear `components/game-player.tsx` (Client Component) y `app/juego/[id]/jugar/page.tsx` migrados de `reproductor.jsx`: HUD (jugador/puntuación/vidas/nivel), marco CRT con animaciones decorativas, pausa, fin de partida con modal, input de iniciales prellenado con el nombre de sesión (o "INVITADO"), guardado de la puntuación vía `saveScore()` al confirmar. Verificación: pulsar FIN muestra el modal; guardar la puntuación persiste en `localStorage` (`av_scores`) y muestra el toast "PUNTUACIÓN GUARDADA".
9. Crear `components/hall-of-fame.tsx` (Client Component) y `app/salon/page.tsx` migrados de `salon.jsx`: tabs por juego, podio top 3, tabla de posiciones con `seededScores`, fila "tu mejor marca" cuando hay sesión activa. Verificación: cambiar de tab recalcula podio y tabla; sin sesión no aparece la fila "tu mejor marca".
10. Crear `components/auth-form.tsx` (Client Component) y `app/auth/page.tsx` migrados de `auth.jsx`: tabs Iniciar sesión/Crear cuenta, campos, envío que llama a `useSession().login(nombre)` y redirige a `/`, botón "Jugar como invitado", botones sociales decorativos sin acción. Verificación: iniciar sesión con un nombre y recargar la página mantiene la sesión (la nav muestra el nombre); "salir" limpia la sesión.
11. Ajustar el footer y la metadata final en `app/layout.tsx` (copyright, versión) y revisar el responsive en los breakpoints del prototipo (840px nav, 900px detalle, 720px salón/tabla). Verificación: `npm run lint` y `npm run build` pasan sin errores; recorrido manual de las 5 rutas en mobile y desktop coincide visualmente con el prototipo.

---

## Acceptance criteria

- [X] `npm run build` completa sin errores de tipos ni de ESLint.
- [X] `/` renderiza la Biblioteca con el grid de 8 juegos, buscador y chips de categoría funcionando (filtran en vivo).
- [X] `/juego/[id]` renderiza el detalle correcto para cada uno de los 8 juegos de `GAMES`; un id inexistente devuelve 404.
- [X] `/juego/[id]/jugar` muestra el HUD, el marco CRT y, al pulsar FIN, un modal con la puntuación final y guardado de nombre.
- [X] Guardar la puntuación en el Reproductor persiste una entrada en `localStorage["av_scores"]`.
- [X] `/salon` muestra podio + tabla para el juego seleccionado en las tabs, y la fila "tu mejor marca" solo aparece con sesión iniciada.
- [X] `/auth` permite iniciar sesión con un nombre; tras recargar la página, `Nav` sigue mostrando ese nombre (persistencia vía `localStorage["av_user"]`).
- [X] Cerrar sesión desde `Nav` limpia `localStorage["av_user"]` y vuelve a mostrar "Iniciar Sesión".
- [X] El menú móvil de `Nav` abre y cierra correctamente por debajo de 840px de ancho.
- [X] Las 5 rutas usan la tipografía "Press Start 2P" en títulos/pixel-text y "JetBrains Mono" en texto mono, sin parpadeo de fuente (FOUT) evidente.
- [X] Ningún juego real (Bloque Buster, Caída, etc.) tiene lógica jugable — el Reproductor es puramente decorativo.

---

## Decisions

- **Sí:** rutas reales de Next.js App Router (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon`, `/auth`) en vez del hash-router del prototipo. Razón: exigido por `CLAUDE.md` (App Router only) y es la arquitectura objetivo del proyecto real.
- **Sí:** replicar fielmente `reproductor.jsx`, incluido el temporizador de puntuación simulado. Razón: es un efecto puramente visual/decorativo (HUD + CRT + CSS), no constituye "implementar un juego"; excluirlo dejaría el botón "JUGAR AHORA" sin destino, contradiciendo "todas las pantallas".
- **Sí:** auth mock con `localStorage`, sin backend. Razón: coherente con "solamente la parte visual"; no hay spec de backend/autenticación real todavía.
- **Sí:** sesión de usuario compartida vía `SessionProvider` (Context) en `app/layout.tsx`, en vez de que cada pantalla lea `localStorage` por separado. Razón: `Nav` vive en el layout raíz y no se remonta entre navegaciones de App Router; sin estado compartido no se enteraría de un login hecho en `/auth`.
- **Sí:** CSS custom portado casi literal a `globals.css`, usando tokens `@theme` de Tailwind v4 solo para colores, en vez de reescribir todo en utilidades Tailwind. Razón: los efectos del prototipo (CRT, portadas 100% CSS, `clip-path` pixel, scanlines) son demasiado complejos y frágiles para reproducir fielmente con utilidades puras.
- **Sí:** datos mock en `lib/data.ts`, sin base de datos ni API. Razón: es un MVP visual; el modelo de datos real se define en un spec futuro.
- **No:** persistencia real de puntuaciones jugables que alimente el Salón de la Fama. Razón: no hay juego real que las genere; el Salón sigue usando `seededScores` mock, igual que el prototipo.
- **No:** login/registro con validación real de backend u OAuth funcional. Razón: fuera de alcance de un MVP visual; los botones sociales quedan decorativos.
- **No:** sonido, multijugador, PWA/offline. Razón: no mencionados en el objetivo del spec; se evaluarían en specs futuros si se necesitan.

---

## Risks

| Riesgo                                                                 | Mitigación                                                                                          |
| ----------------------------------------------------------------------| ----------------------------------------------------------------------------------------------------|
| `localStorage` no disponible en SSR (`window` undefined en servidor)  | `SessionProvider` y `saveScore()` solo acceden a `localStorage` dentro de efectos/handlers de cliente, nunca durante el render de servidor. |
| `localStorage` bloqueado (modo privado / política del navegador)      | Los `try/catch` ya presentes en el prototipo se conservan; sin persistencia, la sesión simplemente no sobrevive a un reload, pero la UI sigue funcionando. |
| Fuente "Press Start 2P" tarda en cargar y desplaza el layout           | Usar `next/font/google` con `display: "swap"` y reservar altura en los títulos vía `line-height`/tamaño fijo del prototipo. |

---

## What is **not** in this spec

- Lógica jugable de cualquiera de los 8 juegos.
- Backend o API real de autenticación (registro, login, OAuth).
- Persistencia real de puntuaciones que alimente rankings entre usuarios.
- Base de datos o servicio externo.
- Sonido/música, multijugador, PWA/offline.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
