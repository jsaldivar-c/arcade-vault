# SPEC 06 — Leaderboard y catálogo de juegos en Supabase

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05
> **Date:** 2026-09-04
> **Objective:** Reemplazar el catálogo mock de juegos (`GAMES`) y el leaderboard mock (`seededScores`) por tablas reales `games` y `scores` en Supabase (lectura pública en ambas, inserción pública solo en `scores`, igual de abierto que el modelo de confianza actual de `localStorage`), consumidas desde Server Components en Home/Biblioteca/Detalle/Salón de la Fama, y hacer que `saveScore()` inserte directamente en Supabase en vez de `localStorage`.

---

## Por qué existe este spec

SPEC 04 dejó lista la integración base de Supabase (clientes browser/server, refresco de sesión) pero el proyecto seguía sin tablas. SPEC 05 conectó el primer motor de juego real (ROCAS) pero su puntuación sigue guardándose solo en `localStorage["av_scores"]` vía `saveScore()`, y el Salón de la Fama (`/salon`) y el mini-leaderboard del Detalle (`/juego/[id]`) siguen mostrando `seededScores` — filas generadas con un PRNG determinista, no partidas reales. El catálogo de juegos (`GAMES` en `lib/data.ts`) también es un array estático con `best`/`plays` hardcodeados.

El usuario pidió implementar un leaderboard real y una tabla de juegos real, apoyándose en la integración de SPEC 04. Este spec crea las tablas `games` y `scores` en Supabase, migra el catálogo actual a `games`, y hace que el guardado de puntuaciones (de los 8 juegos, no solo ROCAS) escriba en `scores` en vez de `localStorage`. `best`/`plays` del catálogo pasan a calcularse en vivo agregando `scores`.

---

## Scope

**In:**

- Tabla `games` en Supabase (catálogo completo: `id`, `title`, `short`, `long`, `cat`, `cover`, `color`), poblada vía migración con los 8 juegos que hoy existen en `lib/data.ts` (mismo contenido). Pasa a ser la fuente de verdad del catálogo.
- Tabla `scores` en Supabase (`id`, `game_id` → FK a `games.id`, `player_name`, `score`, `created_at`), vacía al terminar este spec (se llena con partidas reales).
- RLS habilitado en ambas tablas: lectura pública en `games` y `scores`; inserción pública solo en `scores` (sin inserción/edición/borrado pública en `games`, que solo cambia vía migración). Mismo modelo de confianza que hoy tiene `localStorage` (el cliente controla el valor de la puntuación que envía); documentado como riesgo conocido a resolver cuando exista autenticación real.
- `lib/supabase/games.ts`: funciones de solo-servidor (`lib/supabase/server.ts`) para leer el catálogo y las puntuaciones: `getGames()`, `getGameWithScores(id, limit)`, `getAllGamesWithScores(limit)`. `best`/`plays` se calculan en vivo (agregando `scores` embebidas en la misma consulta), sin columnas denormalizadas ni triggers.
- `lib/scores.ts` reescrito: `saveScore()` pasa a insertar en la tabla `scores` vía el cliente browser de `lib/supabase/client.ts`, en vez de escribir en `localStorage["av_scores"]` (que se elimina).
- Los 8 juegos (no solo ROCAS) persisten sus puntuaciones reales en Supabase a través del mismo flujo (`GamePlayer` → `saveScore()`) que ya usan hoy vía `localStorage` — sin cambios en qué juegos pueden guardar, solo en el backend de guardado.
- `app/page.tsx` (Home), `app/biblioteca/page.tsx` (Biblioteca), `app/juego/[id]/page.tsx` (Detalle) y `app/salon/page.tsx` (Salón de la Fama) pasan a hacer el fetch de `games`/`scores` en el Server Component de la ruta y pasan los datos como props a los Client Components existentes (`Home`, `Library`, `HallOfFame`), que dejan de importar `GAMES`/`seededScores` de `lib/data.ts`.
- Estados vacíos reales: un juego sin partidas jugadas muestra 0 en `best`/`plays`, y su leaderboard (en Detalle y en Salón) muestra "AÚN NO HAY PUNTUACIONES" en vez de filas rellenas con mock.
- "Tu mejor marca" en el Salón de la Fama pasa a calcularse buscando, entre las puntuaciones reales del juego activo, la de mayor puntaje cuyo `player_name` coincide (sin distinguir mayúsculas) con el nombre de la sesión activa; si no hay ninguna, esa sección no se renderiza.
- `lib/data.ts` conserva `CategoryFilter`, `GameColor`, `CATS` y las interfaces `Game` (con `plays: number`, antes `string` tipo `"12.4K"`) y `ScoreRow`; se eliminan el array `GAMES`, `seededScores` y `PLAYERS` (mock ya no usado).
- `GamePlayer` (`components/game-player.tsx`): `handleSave` pasa a ser asíncrono, deshabilita el botón "GUARDAR PUNTUACIÓN" mientras la inserción está en curso, y si Supabase devuelve un error muestra un mensaje y permite reintentar (no marca `saved = true`).

**Out of scope (para specs futuros):**

- Autenticación real con Supabase Auth — la sesión sigue siendo el mock de `localStorage["av_user"]` (solo un nombre, sin cuentas). El leaderboard no vincula puntuaciones a usuarios reales, solo al texto libre `player_name` que ya se pedía en el modal de fin de partida.
- Cualquier mecanismo anti-abuso más allá de RLS pública (rate limiting, validación de rango de puntuación por juego, CAPTCHA, Edge Functions de verificación). Se documenta como riesgo conocido.
- Motores de juego reales para los 7 juegos que hoy siguen siendo decorativos (Bloque Buster, Caída, Serpentina, Glotón, Invasores, Ranaria, Duelo Pixel) — sus puntuaciones seguirán siendo las que genera el timer falso de `GamePlayer`, solo cambia dónde se guardan.
- Paginación, "cargar más" o infinite scroll en el leaderboard — se sigue mostrando un top N fijo (12 en Salón, 10 en Detalle), igual que con `seededScores`.
- Edición o borrado de puntuaciones ya guardadas (propias o ajenas).
- Caché, revalidación incremental (`revalidateTag`/ISR) o denormalización de `best`/`plays` — se calculan en vivo en cada request.
- Migraciones versionadas en `supabase/migrations/` o Supabase CLI local — se sigue usando exclusivamente la herramienta MCP `mcp__supabase__apply_migration`, igual que decidió SPEC 04.
- Tests automatizados.

---

## Data model

Migración SQL (vía `mcp__supabase__apply_migration`):

```sql
create table games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null,
  cover text not null,
  color text not null
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id) on delete cascade,
  player_name text not null,
  score integer not null,
  created_at timestamptz not null default now()
);

alter table games enable row level security;
alter table scores enable row level security;

create policy "games are publicly readable" on games
  for select using (true);

create policy "scores are publicly readable" on scores
  for select using (true);

create policy "anyone can insert a score" on scores
  for insert with check (true);

insert into games (id, title, short, long, cat, cover, color) values
  ('bloque-buster', 'BLOQUE BUSTER', '...', '...', 'ARCADE', 'cover-bricks', 'cyan'),
  -- ... los 8 juegos actuales de lib/data.ts, contenido idéntico al mock.
  ('duelo-pixel', 'DUELO PIXEL', '...', '...', 'VERSUS', 'cover-duelo', 'cyan');
```

Tipos TypeScript (`lib/data.ts`, sin cambios de forma salvo `plays`):

```ts
export type CategoryFilter =
  "TODOS" | "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Exclude<CategoryFilter, "TODOS">;
  cover: string;
  color: GameColor;
  best: number;
  plays: number; // antes string tipo "12.4K"; ahora conteo real de scores
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // formateado server-side desde scores.created_at
}

export const CATS: CategoryFilter[]; // sin cambios
```

Funciones de lectura (`lib/supabase/games.ts`, solo Server Components):

```ts
export async function getGames(): Promise<Game[]>;
export async function getGameWithScores(
  id: string,
  limit?: number, // default 10
): Promise<{ game: Game; scores: ScoreRow[] } | null>;
export async function getAllGamesWithScores(
  limit?: number, // default 12
): Promise<{ game: Game; scores: ScoreRow[] }[]>;
```

Escritura (`lib/scores.ts`, cliente browser):

```ts
export interface NewScore {
  game: string; // Game["id"]
  score: number;
  name: string;
}
export async function saveScore(
  entry: NewScore,
): Promise<{ error: string | null }>;
```

---

## Implementation plan

1. Aplicar la migración con `mcp__supabase__apply_migration`: crear `games` y `scores`, habilitar RLS, crear las 3 políticas (lectura pública en ambas, inserción pública solo en `scores`), e insertar los 8 juegos actuales con el contenido exacto de `GAMES` en `lib/data.ts`. Verificación: `mcp__supabase__list_tables` muestra `games` y `scores`; una consulta `select * from games` vía MCP devuelve 8 filas con los mismos `id`/`title` que el mock actual.
2. Crear `lib/supabase/games.ts` con `getGames()`, `getGameWithScores(id, limit)` y `getAllGamesWithScores(limit)`, usando `createClient()` de `lib/supabase/server.ts` y el embedding de Supabase (`games` con `scores(*)` anidado) para traer catálogo + puntuaciones en una sola consulta por función. `best`/`plays` se calculan en JS a partir del array de `scores` embebido (`Math.max(...)` y `.length`); `ScoreRow.date` se formatea desde `created_at` (`DD/MM/YYYY`). Verificación: `npx tsc --noEmit` sin errores (archivo sin uso todavía).
3. Reescribir `lib/scores.ts`: `saveScore(entry: NewScore)` usa `createClient()` de `lib/supabase/client.ts` para insertar `{ game_id: entry.game, player_name: entry.name, score: entry.score }` en `scores`, devuelve `{ error: error?.message ?? null }`. Se elimina el uso de `localStorage["av_scores"]`. Verificación: `npx tsc --noEmit` sin errores.
4. Actualizar `app/page.tsx` (Server Component) para llamar `getGames()` y pasar `games` como prop a `<Home games={games} />`; `components/home.tsx` deja de importar `GAMES` de `lib/data.ts` y usa la prop para el preview de 6 juegos. Verificación: `/` sigue mostrando el preview con `best` real (0 si el juego no tiene partidas todavía).
5. Actualizar `app/biblioteca/page.tsx` para llamar `getGames()` y pasar `games` como prop a `<Library games={games} />`; `components/library.tsx` deja de importar `GAMES` de `lib/data.ts`, filtra/busca sobre la prop igual que hoy. Verificación: `/biblioteca` sigue filtrando por nombre y categoría en vivo; cada tarjeta muestra `best` real.
6. Actualizar `app/juego/[id]/page.tsx`: reemplazar `GAMES.find(...)` + `seededScores(...)` por `await getGameWithScores(id, 10)`; `notFound()` si devuelve `null`. `game.plays` se muestra con `.toLocaleString("es-ES")` (antes era el string abreviado del mock). El aside "MEJORES PUNTUACIONES" itera `scores`; si está vacío, muestra "AÚN NO HAY PUNTUACIONES — SÉ EL PRIMERO" en vez de la tabla. Verificación: `/juego/rocas` (y los otros 7 ids) renderiza sin datos mock; un id inexistente sigue devolviendo 404.
7. Dividir `/salon`: `app/salon/page.tsx` pasa a ser `async`, llama `await getAllGamesWithScores(12)` y pasa el resultado como prop `entries` a `<HallOfFame entries={entries} />`. `components/hall-of-fame.tsx` deja de importar `GAMES`/`seededScores` de `lib/data.ts`: recibe `entries: { game: Game; scores: ScoreRow[] }[]` por prop, conserva el `useState` de la tab activa, y deriva podio/tabla en memoria buscando `entries.find(e => e.game.id === tab)` (sin refetch al cambiar de tab). Estado vacío por juego cuando `scores.length === 0`. "Tu mejor marca" busca en las `scores` del juego activo la de mayor puntaje cuyo `name` coincide (case-insensitive) con `user.name`; si no hay ninguna, la sección no se renderiza. Verificación: cambiar de tab recalcula podio/tabla sin llamada de red; con sesión iniciada y sin puntuaciones propias en el juego activo, no aparece "tu mejor marca".
8. Actualizar `components/game-player.tsx`: `handleSave` pasa a ser `async`, agrega estado `saving`, deshabilita el botón mientras dura la inserción, llama `const { error } = await saveScore(...)`, y si `error` no es `null` muestra un mensaje de error en el modal en vez de marcar `saved = true` (el botón queda habilitado para reintentar). Verificación: `npx tsc --noEmit` sin errores; manualmente, jugar y guardar una puntuación exitosamente muestra el toast "PUNTUACIÓN GUARDADA" tras la resolución de la promesa (no instantáneo como antes).
9. Limpiar `lib/data.ts`: eliminar el array `GAMES`, `seededScores` y `PLAYERS` (ya sin ningún import tras los pasos 4-8); conservar `CategoryFilter`, `GameColor`, `CATS`, `Game` (con `plays: number`) y `ScoreRow`. Verificación: `grep -r "GAMES\|seededScores\|PLAYERS" app components lib` no devuelve resultados fuera de `lib/data.ts`/`lib/supabase/games.ts`; `npx tsc --noEmit` sin errores.
10. Verificación final: `npm run lint` y `npm run build` pasan sin errores. Recorrido manual: jugar y guardar 2-3 partidas en distintos juegos (incluido ROCAS), confirmar que aparecen en `/salon` (tab correspondiente) y en el mini-leaderboard de `/juego/[id]` tras recargar; confirmar que `best`/`plays` de esos juegos en `/` y `/biblioteca` reflejan las partidas guardadas; confirmar que un juego sin partidas muestra el estado vacío en vez de filas mock.

---

## Acceptance criteria

- [x] Las tablas `games` y `scores` existen en Supabase con las columnas y políticas RLS descritas (lectura pública en ambas, inserción pública solo en `scores`), verificable con `mcp__supabase__list_tables`.
- [x] `games` contiene los 8 juegos con el mismo contenido (`title`/`short`/`long`/`cat`/`cover`/`color`) que tenía el mock `GAMES` en `lib/data.ts` antes de este spec.
- [x] `/`, `/biblioteca` y `/juego/[id]` leen el catálogo desde Supabase (`getGames()`/`getGameWithScores()`), sin importar `GAMES` de `lib/data.ts`.
- [x] `/salon` lee todos los juegos y sus puntuaciones desde Supabase (`getAllGamesWithScores()`), sin importar `seededScores`/`GAMES` de `lib/data.ts`.
- [x] Guardar una puntuación desde `GamePlayer` (en cualquiera de los 8 juegos) inserta una fila real en la tabla `scores` de Supabase; `localStorage["av_scores"]` ya no se usa.
- [x] Esa puntuación guardada aparece, tras recargar, en el leaderboard del Detalle (`/juego/[id]`) y en la tab correspondiente del Salón de la Fama (`/salon`).
- [x] `best`/`plays` de un juego en Home/Biblioteca/Detalle reflejan `MAX(score)`/`COUNT(*)` reales de `scores` para ese `game_id`.
- [x] Un juego sin ninguna puntuación guardada muestra un estado vacío ("AÚN NO HAY PUNTUACIONES") en el Detalle y en el Salón, no filas de `seededScores`.
- [x] "Tu mejor marca" en el Salón solo aparece cuando existe al menos una puntuación real cuyo `player_name` coincide con el nombre de la sesión activa para el juego seleccionado.
- [x] `lib/data.ts` ya no exporta `GAMES`, `seededScores` ni `PLAYERS`.
- [x] Si la inserción en `scores` falla (por ejemplo, sin conexión), el modal de fin de partida muestra un error en vez de marcar la puntuación como guardada, y el botón permite reintentar.
- [x] `npm run build` y `npm run lint` completan sin errores de tipos ni de ESLint.

---

## Decisions

- **Sí:** crear una tabla `games` completa (catálogo íntegro: título, descripciones, categoría, portada, color), poblada por migración desde el mock actual, en vez de mantener el catálogo en código y solo agregar puntuaciones. Razón: decidido explícitamente por el usuario — "una tabla de juegos" real en Supabase, no solo estadísticas calculadas sobre un array estático.
- **Sí:** los 8 juegos (no solo ROCAS) persisten puntuaciones reales en `scores`, reutilizando el mismo flujo `GamePlayer → saveScore()` que ya usan hoy. Razón: decidido explícitamente por el usuario; los 7 juegos decorativos ya generan y guardan una puntuación (aunque con timer falso) exactamente igual que ROCAS — restringir el guardado real solo a ROCAS introduciría una rama de código especial sin necesidad.
- **Sí:** RLS tan abierto como el modelo de confianza actual (lectura e inserción pública en `scores`, sin validación de rango ni rate limiting). Razón: decidido explícitamente por el usuario — no hay autenticación real todavía (SPEC 04 la dejó fuera de alcance), así que cualquier control adicional sería una falsa sensación de seguridad; se documenta como riesgo conocido para el spec de auth futuro.
- **Sí:** `saveScore()` reemplaza `localStorage["av_scores"]` por completo (sin escritura dual). Razón: decidido explícitamente por el usuario — una sola fuente de verdad, consistente con que el Salón/Detalle ya no leen `localStorage` en ningún caso.
- **Sí:** `best`/`plays` calculados en vivo en cada request (agregando `scores` embebidas en la misma consulta a `games`), sin columnas denormalizadas ni triggers de Postgres. Razón: decidido explícitamente por el usuario — el tráfico esperado de este proyecto no justifica la complejidad adicional de mantener una caché sincronizada; siempre exacto.
- **Sí:** los leaderboards vacíos muestran un estado vacío real ("AÚN NO HAY PUNTUACIONES") en vez de rellenar con `seededScores` como filler visual. Razón: decidido explícitamente por el usuario — coherente con la filosofía ya aplicada en SPEC 05 de reemplazar mock por datos reales sin mezclarlos.
- **Sí:** las consultas de lectura (`games`/`scores`) se hacen en Server Components (`lib/supabase/server.ts`) y se pasan como props a los Client Components existentes, en vez de que estos hagan fetch client-side con `useEffect`. Razón: decidido explícitamente por el usuario — alineado con las convenciones de Next.js 16 del repo (Async Request APIs, `PageProps<>`) y evita estados de carga donde antes no los había.
- **Sí:** "tu mejor marca" en el Salón se calcula sobre datos reales (búsqueda por `player_name` == nombre de sesión) en vez de mantener el cálculo inventado que tenía el mock (`rows[5]?.score - 2400`). Razón: consecuencia directa de reemplazar `seededScores` por datos reales; mantener un cálculo ficticio sobre datos reales sería inconsistente.
- **No:** no se implementa autenticación real ni vínculo de puntuaciones a cuentas de usuario en este spec. Razón: decidido explícitamente por el usuario y ya registrado como fuera de alcance en SPEC 04; el leaderboard sigue usando el nombre de texto libre que el jugador escribe al guardar, igual que hoy.
- **No:** no se agrega ningún mecanismo anti-abuso (validación de rango, rate limiting, Edge Function de verificación). Razón: decidido explícitamente por el usuario — mismo nivel de apertura que el modelo actual de `localStorage`, que también puede editarse libremente desde DevTools.

---

## Risks

| Riesgo                                                                                                                                                                                                                                                                                                | Mitigación                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sin autenticación real, cualquiera puede insertar puntuaciones falsas directamente contra la API REST de Supabase (con la publishable key, que es pública por diseño), sin pasar por la UI del juego.                                                                                                 | Aceptado por decisión explícita del usuario — es el mismo riesgo que ya existe hoy editando `localStorage` a mano. Queda documentado para el spec futuro de autenticación real, que podría restringir la inserción a usuarios autenticados o agregar validación de rango por juego. |
| `plays` pasa de un string mock abultado (`"12.4K"`) a un conteo entero real que empezará en 0 para todos los juegos. Visualmente el catálogo se verá "vacío" hasta que se jueguen partidas reales.                                                                                                    | Aceptado como consecuencia esperada de reemplazar datos mock por datos reales; documentado explícitamente en Scope y Decisions, no es un bug.                                                                                                                                       |
| El embedding de Supabase (`games` con `scores(*)` anidado) trae **todas** las puntuaciones de un juego para calcular `best`/`plays`, no solo el top N. Si un juego acumula muchas partidas, la consulta de catálogo (`getGames()`) transfiere más datos de los necesarios solo para un `MAX`/`COUNT`. | Aceptado para el volumen esperado de este proyecto (portafolio/demo, no miles de partidas). Si se vuelve un problema real, un spec futuro puede mover el cálculo a una vista o función agregada en Postgres.                                                                        |
| `getAllGamesWithScores()` (usado por `/salon`) trae el top N de los 8 juegos en una sola consulta al montar la ruta; si el dataset de `scores` crece mucho, esa consulta inicial podría volverse lenta.                                                                                               | Aceptado para el volumen esperado; no hay paginación ni carga diferida por juego en este spec (ver Out of scope).                                                                                                                                                                   |

---

## What is **not** in this spec

- Autenticación real con Supabase Auth ni vínculo de puntuaciones a cuentas.
- Mecanismos anti-abuso (rate limiting, validación de rango, CAPTCHA, Edge Functions).
- Motores de juego reales para los 7 juegos que hoy son decorativos.
- Paginación o carga diferida del leaderboard.
- Edición o borrado de puntuaciones ya guardadas.
- Caché, revalidación incremental o denormalización de `best`/`plays`.
- Migraciones versionadas en el repo o Supabase CLI local.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
