# SPEC 02 — Home y Acerca de

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-09-01
> **Objective:** Implementar como rutas reales de Next.js App Router las pantallas Home (landing en `/`) y Acerca de (`/about`) de Arcade Vault a partir del prototipo en `references/templates/home-about/`, moviendo la Biblioteca de `/` a `/biblioteca` y actualizando la navegación global para incluir los cuatro enlaces principales.

---

## Por qué existe este spec

SPEC 01 implementó las 5 pantallas originales del prototipo (`references/templates/`) usando `/` para la Biblioteca. El prototipo tiene además una carpeta `references/templates/home-about/` con una versión de `nav.jsx` que separa "Inicio" de "Biblioteca", más un `home.jsx` (landing/marketing) y un `about.jsx` (misión + contacto) que SPEC 01 no cubrió. Este spec cierra ese hueco: agrega Home y Acerca de como rutas reales, y reubica la Biblioteca para que `/` quede libre para el landing, tal como lo asume el nav del prototipo.

---

## Scope

**In:**

- `/` — Home / landing (`home.jsx` → `Home`), migrada como Client Component:
  - Hero con `FloatingSilhouettes` (SVGs decorativos), título, subtítulo y CTAs ("EXPLORAR JUEGOS" → `/biblioteca`, "CREAR CUENTA" → `/auth`).
  - Sección "¿POR QUÉ ARCADE VAULT?" con `feature-grid` de 4 tarjetas y `FeatureIcon`.
  - Sección "JUEGOS DISPONIBLES AHORA": `mini-rail` con `MiniCard` para los primeros 6 elementos de `GAMES` (de `lib/data.ts`), cada una navega a `/juego/[id]`; botón "VER TODOS LOS JUEGOS →" a `/biblioteca`.
  - Sección de stats (`home-stats`) con los 3 bloques del prototipo.
  - Sección "ACTIVIDAD EN VIVO": ticker de últimas puntuaciones + lista "TOP JUGADORES · HOY", con el mismo contenido literal hardcodeado del prototipo (no conectado a `lib/data.ts`/`seededScores`); botón "VER SALÓN →" a `/salon`.
  - Sección de pricing (`pricing-grid`): tarjeta de plan único gratuito + FAQ, botones "EMPEZAR GRATIS →" a `/auth`.
  - CTA final ("INSERTAR MONEDA →") a `/biblioteca`.
- `/about` — Acerca de (`about.jsx` → `About`), migrada como Client Component:
  - Hero de misión + `highlight-row` con `HighlightIcon`.
  - Banner divisor decorativo (`about-divider`).
  - Sección de contacto: intro + tips, y formulario (`contact-form`) **decorativo/simulado**: valida que nombre/correo/mensaje no estén vacíos (dispara animación `shake` si faltan), y al enviar con datos válidos muestra la animación de éxito tipo terminal (`terminal-success`) con el nombre ingresado — sin llamada de red ni persistencia en `localStorage`.
- Biblioteca (`components/library.tsx`, ya existente) se reubica de `/` a `/biblioteca`, sin cambios de lógica.
- `components/nav.tsx` actualizado para 4 enlaces — Inicio (`/`), Biblioteca (`/biblioteca`), Salón de la Fama (`/salon`), Acerca de (`/about`) — en el nav de escritorio y en el panel móvil, con el estado activo correcto por ruta.
- Hook de reveal-on-scroll (`IntersectionObserver` que agrega la clase `.in` a los elementos `.reveal` al entrar en viewport), migrado de `useReveal`/el efecto equivalente en `about.jsx`, reutilizado en Home y About.
- `FloatingSilhouettes`, `MiniCard`, `FeatureIcon` (de `home.jsx`) y `HighlightIcon` (de `about.jsx`) migrados tal cual como sub-componentes.
- CSS: portar a `app/globals.css` los bloques de `references/templates/home-about/styles.css` que usan estos componentes: `home-*`, `about-*`, `feature-*`, `mini-*`, `stat-*` (home stats), `activity-*`/`ticker`/`tick-row`/`tk-*`/`top-*`/`tp-*`, `pricing-*`/`price-*`/`pc-*`/`faq-*`, `contact-*`, `terminal-success`/`term-*`, `div-bar`/`div-pixels`, `reveal`/`.in`, `section-*`, `hero-*`, `highlight`/`highlight-row`/`hl-*`, `lb-link`, `shake`, `tip-led`, `kicker` — reusando los tokens `@theme` de color ya definidos (no se crean colores nuevos).
- Metadata (`title`) propia por ruta para `/` y `/about`, siguiendo el patrón de Next.js App Router.

**Out of scope (para specs futuros):**

- Envío real del formulario de contacto (backend, email, o guardado en `localStorage`/base de datos). Queda puramente decorativo, igual que los botones sociales de Auth (SPEC 01).
- Datos reales/dinámicos para "ACTIVIDAD EN VIVO" y "TOP JUGADORES · HOY" en Home — el contenido queda hardcodeado como en el prototipo; no se conecta a puntuaciones reales ni a `seededScores`.
- Cualquier sistema real de créditos/monetización sugerido por la sección de pricing — sigue siendo decorativo (mismos CTAs a `/auth` y `/biblioteca`).
- Cambios a la lógica interna de Biblioteca, Detalle, Reproductor, Salón o Auth más allá de reubicar la ruta de Biblioteca.
- CSS de clases sin uso en este repo detectadas en `home-about/styles.css` (`.gp-*`, `.dp-*`, `.rivet`, `.screw`, `.lg-key`, `.lg-row`, `.live-led`, `.score-pop`) — no las referencia ningún componente de `home.jsx`, `about.jsx` ni `nav.jsx`; parecen CSS muerto de otra pantalla no incluida en el prototipo.
- SEO avanzado (Open Graph, sitemap, JSON-LD) más allá del `title`/`description` estándar por ruta.
- Tests automatizados.

---

## Data model

No se introduce ningún modelo de datos nuevo. Home reutiliza `GAMES` de `lib/data.ts` (ya definido en SPEC 01) para el `mini-rail`; el resto del contenido de Home y About (ticker de actividad, top jugadores, features, highlights, FAQ) es contenido estático embebido en los componentes, igual que en el prototipo.

---

## Implementation plan

1. Mover la Biblioteca de `/` a `/biblioteca`: crear `app/biblioteca/page.tsx` con `<Library />` (contenido actual de `app/page.tsx`) y `metadata` propia (`title: "Biblioteca · Arcade Vault"`). Verificación: `/biblioteca` renderiza la grid de 8 juegos con buscador y chips funcionando, igual que antes lo hacía `/`.
2. Portar a `app/globals.css` los bloques de CSS listados en el scope desde `references/templates/home-about/styles.css`, evitando duplicar lo que ya existe (`neon-*`, `fade-in`, `@keyframes pulse`, `@keyframes blink` ya están definidos). Verificación: `npm run build` sin errores de CSS/Tailwind.
3. Crear `lib/use-reveal.ts` con el hook de reveal-on-scroll (`IntersectionObserver`, threshold 0.12, agrega `.in` y hace `unobserve`), para usarlo solo desde Client Components. Verificación: `npx tsc --noEmit` sin errores.
4. Crear `components/home.tsx` (Client Component) migrado de `home.jsx`: `FloatingSilhouettes`, `MiniCard`, `FeatureIcon`, y las 6 secciones (hero, why, games preview, stats, actividad en vivo, pricing, CTA final), reemplazando `navigate()` por `Link`/`useRouter` de Next y usando `GAMES` de `lib/data.ts` para el mini-rail. Crear `app/page.tsx` (nueva Home) que lo use, con `metadata` propia (`title: "Arcade Vault · El arcade clásico está de vuelta"`). Verificación: `/` renderiza el hero; los CTAs navegan a `/biblioteca` y `/auth`; cada mini-card navega a `/juego/[id]` del juego correspondiente; "VER SALÓN →" navega a `/salon`.
5. Crear `components/about.tsx` (Client Component) migrado de `about.jsx`: `HighlightIcon`, hero/misión, `highlight-row`, banner divisor, y el formulario de contacto decorativo con validación/`shake`/animación de éxito (`terminal-success`), sin llamadas de red ni persistencia. Crear `app/about/page.tsx` que lo use, con `metadata` propia (`title: "Acerca de · Arcade Vault"`). Verificación: enviar el formulario vacío dispara `shake` y no avanza; completarlo muestra la animación de terminal de éxito con el nombre ingresado; no hay peticiones de red (Network tab vacío).
6. Actualizar `components/nav.tsx`: agregar los enlaces "Inicio" (`/`) y "Acerca de" (`/about`) junto a "Biblioteca" (`/biblioteca`) y "Salón de la Fama" (`/salon`) en el nav de escritorio y en el panel móvil; actualizar `isActive` para que "Inicio" solo esté activo en `/` exacto, "Biblioteca" en `/biblioteca` y `/juego/*`, y "Acerca de" en `/about`. Verificación: navegar por las 6 rutas (`/`, `/biblioteca`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon`, `/about`, `/auth`) y confirmar que el enlace correcto queda resaltado en cada una.
7. Revisar responsive de las nuevas secciones en los breakpoints ya usados por el prototipo (840px nav, y los propios de `home-*`/`about-*`) y correr `npx next typegen` tras agregar las rutas nuevas. Verificación: `npm run lint` y `npm run build` pasan sin errores; recorrido manual de `/`, `/biblioteca` y `/about` en mobile y desktop coincide visualmente con el prototipo.

---

## Acceptance criteria

- [ ] `npm run build` completa sin errores de tipos ni de ESLint.
- [ ] `/` renderiza la Home completa: hero con CTAs, sección "¿por qué Arcade Vault?", preview de 6 juegos, stats, actividad en vivo (ticker + top jugadores), pricing/FAQ, y CTA final.
- [ ] `/biblioteca` renderiza la Biblioteca (mismo comportamiento que antes tenía `/`): buscador y chips de categoría filtran en vivo.
- [ ] `/about` renderiza la sección de misión + highlights y el formulario de contacto.
- [ ] Enviar el formulario de contacto vacío dispara la animación `shake` y no muestra el mensaje de éxito; completarlo con datos válidos muestra la animación de terminal de éxito, sin petición de red ni escritura en `localStorage`.
- [ ] "EXPLORAR JUEGOS" y "VER TODOS LOS JUEGOS →" en Home navegan a `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/auth`; cada mini-card navega a `/juego/[id]` del juego correspondiente; "VER SALÓN →" navega a `/salon`.
- [ ] `Nav` muestra los 4 enlaces (Inicio, Biblioteca, Salón de la Fama, Acerca de) en escritorio y en el panel móvil, con el estado activo correcto en `/`, `/biblioteca`, `/juego/[id]`, `/juego/[id]/jugar`, `/salon` y `/about`.
- [ ] `/` ya no muestra la Biblioteca (se movió a `/biblioteca` según este spec).
- [ ] Las 7 rutas de la app (Home, Biblioteca, Detalle, Reproductor, Salón, Acerca de, Auth) usan la tipografía "Press Start 2P"/"JetBrains Mono" consistente con el resto, sin parpadeo de fuente evidente.

---

## Decisions

- **Sí:** `/` pasa a ser Home y la Biblioteca se mueve a `/biblioteca`. Razón: decidido explícitamente por el usuario; coincide con el nav de `references/templates/home-about/nav.jsx`, que separa "Inicio" de "Biblioteca" como enlaces distintos.
- **Sí:** ruta `/about` (no `/acerca-de`). Razón: decidido explícitamente por el usuario; coincide con el nombre de archivo/componente del prototipo (`about.jsx`).
- **Sí:** formulario de contacto decorativo/simulado, sin backend real. Razón: decidido explícitamente por el usuario; consistente con el patrón ya usado en Auth (SPEC 01) para funcionalidad sin backend disponible en el proyecto.
- **Sí:** contenido del ticker "ACTIVIDAD EN VIVO" y "TOP JUGADORES · HOY" estático e idéntico al prototipo, sin conectarlo a `lib/data.ts`. Razón: decidido explícitamente por el usuario; evita inventar lógica de "actividad reciente" que no existe todavía (no hay juegos jugables ni puntuaciones reales que la alimenten).
- **Sí:** Home y About como Client Components. Razón: consistente con la decisión de SPEC 01 de implementar toda la interactividad de UI como Client Components; aquí además es necesario para el `IntersectionObserver` de `reveal` y el estado del formulario de contacto.
- **Sí:** portar solo los bloques de CSS de `home-about/styles.css` que usan los componentes migrados, omitiendo clases sin ningún uso en este repo (`.gp-*`, `.dp-*`, `.rivet`, `.screw`, `.lg-key`, `.lg-row`, `.live-led`, `.score-pop`). Razón: ningún componente de `home.jsx`, `about.jsx` ni `nav.jsx` las referencia; agregarlas sería CSS muerto.
- **No:** cambios a la lógica interna de Biblioteca, Detalle, Reproductor, Salón o Auth. Razón: fuera del objetivo de este spec, que se limita a Home + Acerca de + navegación.
- **No:** persistencia real de mensajes de contacto o de "actividad en vivo". Razón: no hay backend en el proyecto todavía; se evaluaría en un spec futuro.

---

## Risks

| Riesgo | Mitigación |
|---|---|
| Las secciones `.reveal` quedan con `opacity: 0` hasta que el `IntersectionObserver` las active; si JavaScript falla o tarda, el contenido no es visible. | Comportamiento idéntico al del prototipo (riesgo aceptado, no se introduce una regresión nueva); el hook se monta en un `useEffect` que corre apenas hidrata el Client Component. |
| Mover `/` de Biblioteca a `/biblioteca` es un cambio de ruta público — cualquier enlace o marcador previo a `/` como Biblioteca deja de mostrar lo mismo. | Cambio intencional acordado explícitamente con el usuario; documentado en scope y en acceptance criteria. |
| Duplicar CSS ya existente en `globals.css` al portar `home-about/styles.css` (mismas clases o variables redefinidas). | Antes de portar cada bloque, se revisa contra `globals.css` actual (ya verificado que `neon-*`, `fade-in`, `pulse`/`blink` keyframes ya existen y no deben duplicarse). |

---

## What is **not** in this spec

- Envío real del formulario de contacto (backend, email, persistencia).
- Datos reales/dinámicos para "actividad en vivo" o "top jugadores" en Home.
- Sistema real de créditos o monetización.
- Cambios a Biblioteca, Detalle, Reproductor, Salón o Auth más allá de reubicar la ruta de Biblioteca.
- CSS de clases sin uso en este repo (`.gp-*`, `.dp-*`, `.rivet`, `.screw`, `.lg-key`, `.lg-row`, `.live-led`, `.score-pop`).
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
