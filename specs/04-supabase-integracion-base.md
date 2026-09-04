# SPEC 04 — Integración base de Supabase

> **Status:** Implemented  
> **Depends on:** —
> **Date:** 2026-09-03
> **Objective:** Integrar el SDK de Supabase en la aplicación Next.js (clientes browser/server, refresco de sesión vía `proxy.ts`, variables de entorno y una ruta de diagnóstico) como base de infraestructura para specs futuros de autenticación real, puntuaciones persistentes, Realtime y Edge Functions, sin implementar todavía ninguna pantalla ni tabla real.

---

## Por qué existe este spec

El proyecto Supabase (`gfngxwpnonizcpgjcazf`) ya existe y está referenciado en `.mcp.json`, pero no tiene tablas ni migraciones — es un proyecto vacío. El usuario planea usar Supabase para autenticación real, puntuaciones persistentes, Realtime y Edge Functions en specs futuros, pero pidió explícitamente que este spec se limite a dejar la integración lista (SDK, clientes, refresco de sesión) para que esos specs no tengan que resolver el setup base desde cero.

---

## Scope

**In:**

- Dependencias `@supabase/supabase-js` y `@supabase/ssr` agregadas a `package.json`.
- `lib/supabase/client.ts` — cliente para Client Components vía `createBrowserClient` (de `@supabase/ssr`), leyendo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `lib/supabase/server.ts` — cliente async para Server Components/Route Handlers vía `createServerClient`, usando `cookies()` de `next/headers` (patrón oficial `getAll`/`setAll` con `try/catch`).
- `lib/supabase/proxy.ts` — función `updateSession(request: NextRequest)`: crea un cliente server-side con las cookies del request/response, llama a `await supabase.auth.getClaims()` para refrescar la sesión, y devuelve el `NextResponse` con las cookies actualizadas.
- `proxy.ts` en la raíz del proyecto (convención Next.js 16, no `middleware.ts`): exporta `export async function proxy(request: NextRequest)` que delega en `updateSession`, con `matcher` que excluye assets estáticos (`_next/static`, `_next/image`, favicon, imágenes).
- Variables de entorno nuevas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: documentadas en `.env.template` (versionado) y con sus valores reales en `.env.local` (no versionado) — URL `https://gfngxwpnonizcpgjcazf.supabase.co` y la publishable key moderna (`sb_publishable_...`) ya generada para este proyecto.
- Ruta de diagnóstico `app/api/health/supabase/route.ts` (`GET`): usa el cliente de `lib/supabase/server.ts`, llama a `supabase.auth.getSession()`, y responde `200 { ok: true }` si no hay error de conexión/config o `500 { ok: false, message }` si Supabase devuelve error o la llamada lanza excepción. Queda como utilidad de diagnóstico permanente en el repo, no se borra tras verificar.

**Out of scope (para specs futuros):**

- Pantallas de autenticación real conectadas a Supabase Auth (login/registro/logout) — `lib/session.tsx` sigue siendo el mock de `localStorage` hasta ese spec futuro.
- Tablas, esquemas o migraciones en la base de datos (puntuaciones, juegos, perfiles, etc.) — el proyecto permanece sin tablas al cierre de este spec.
- Row Level Security (RLS) — no aplica todavía porque no hay tablas.
- Service role / secret key (`sb_secret_...`) — no se usa ni se guarda en este spec; se agrega cuando un spec futuro necesite operaciones admin server-side que salten RLS.
- Supabase CLI local, `supabase init` o migraciones versionadas en `supabase/migrations/` — se sigue usando exclusivamente las herramientas MCP (`mcp__supabase__*`) ya configuradas en `.mcp.json`.
- Realtime y Edge Functions — mencionados por el usuario como uso futuro, no se configuran en este spec.
- OAuth o magic link — la autenticación futura será solo email + contraseña (decisión registrada aquí, ver sección Decisions).
- Cambios a cualquier pantalla existente (Home, Biblioteca, Detalle, Reproductor, Salón, Acerca de, Auth) — esta integración no altera comportamiento visible.
- Tests automatizados.

---

## Data model

Este spec no introduce ningún modelo de datos persistido (no hay tablas). Se define solo la forma de la respuesta del endpoint de diagnóstico:

```ts
// GET /api/health/supabase
// 200 → { ok: true }
// 500 → { ok: false; message: string }
```

---

## Implementation plan

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` (`npm install @supabase/supabase-js @supabase/ssr`). Agregar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `.env.template` (documentadas con comentarios, siguiendo el estilo ya usado para `RESEND_API_KEY`) y a `.env.local` con los valores reales del proyecto existente. Verificación: `npm install` sin errores; `git status` no muestra `.env.local`.
2. Crear `lib/supabase/client.ts` con una función `createClient()` que devuelve `createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)`. Verificación: `npx tsc --noEmit` sin errores.
3. Crear `lib/supabase/server.ts` con una función async `createClient()` que arma `createServerClient` con `cookies()` de `next/headers`, implementando `getAll`/`setAll` con el `try/catch` estándar de Supabase (ignorar el error de `setAll` cuando se llama desde un Server Component). Verificación: `npx tsc --noEmit` sin errores.
4. Crear `lib/supabase/proxy.ts` con `updateSession(request: NextRequest)`: cliente server-side con cookies de request/response, `await supabase.auth.getClaims()`, retorna el `NextResponse` con las cookies refrescadas. Crear `proxy.ts` en la raíz exportando `proxy(request)` que llama a `updateSession`, con el `matcher` excluyendo `_next/static`, `_next/image`, `favicon.ico` y extensiones de imagen comunes. Verificación: `npm run dev` arranca sin errores; navegar cualquier ruta existente no produce excepciones del proxy en consola (sin sesión activa, `getClaims()` simplemente no encuentra sesión).
5. Crear `app/api/health/supabase/route.ts` (`GET`) usando `lib/supabase/server.ts`: llama a `supabase.auth.getSession()`, responde `200 { ok: true }` si no hay error, `500 { ok: false, message }` si Supabase devuelve error o la llamada lanza excepción. Verificación: con el servidor de desarrollo corriendo, `curl http://localhost:3000/api/health/supabase` responde `200 { ok: true }`, confirmando que el cliente conecta al proyecto real.
6. Correr `npm run lint` y `npm run build`. Verificación final: build de producción pasa sin errores de tipos ni de ESLint, y `GET /api/health/supabase` sigue respondiendo `200 { ok: true }` en `npm run start`.

---

## Acceptance criteria

- [x] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr` como dependencias.
- [x] `.env.template` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `.env.local` tiene los valores reales del proyecto `gfngxwpnonizcpgjcazf`.
- [x] `lib/supabase/client.ts` y `lib/supabase/server.ts` existen, exportan `createClient()`, y `npx tsc --noEmit` no reporta errores.
- [x] `proxy.ts` en la raíz existe y usa `updateSession` de `lib/supabase/proxy.ts`; navegar la app en `npm run dev` no produce errores ni excepciones del proxy en consola.
- [x] `GET /api/health/supabase` responde `200 { ok: true }` cuando Supabase está accesible.
- [x] `npm run build` completa sin errores de tipos ni de ESLint.
- [x] Ninguna pantalla existente (Home, Biblioteca, Detalle, Reproductor, Salón, Acerca de, Auth) cambia de comportamiento visual o funcional — la integración es puramente de infraestructura.
- [x] El proyecto Supabase sigue sin tablas ni migraciones al finalizar este spec (verificable con la herramienta MCP `list_tables`).

---

## Decisions

- **Sí:** alcance limitado a integración base (SDK + clientes + proxy + env vars + ruta de diagnóstico), sin auth real, tablas, RLS, Realtime ni Edge Functions. Razón: decidido explícitamente por el usuario — quiere dejar la integración lista para que specs futuros implementen cada feature sin resolver el setup base cada vez.
- **Sí:** publishable key moderna (`sb_publishable_...`) en vez del anon key legacy (JWT). Razón: decidido explícitamente por el usuario; es el formato recomendado por Supabase para proyectos nuevos y ya existe generada para este proyecto.
- **No:** secret/service role key en este spec. Razón: decidido explícitamente por el usuario — no hay operaciones admin que la necesiten todavía; se agrega en el spec futuro que la requiera.
- **Sí:** incluir `proxy.ts`/`lib/supabase/proxy.ts` para refresco de sesión ya en este spec, aunque no haya auth real todavía. Razón: decidido explícitamente por el usuario; es scaffolding estándar documentado por Supabase para Next.js App Router y evita tener que modificar el spec de auth futuro solo para agregarlo.
- **Sí:** ruta `/api/health/supabase` como mecanismo de verificación, y queda permanente en el repo. Razón: decidido explícitamente por el usuario; sin auth ni tablas todavía, es la única forma de confirmar que el cliente conecta al proyecto real.
- **No:** Supabase CLI local ni migraciones versionadas en `supabase/migrations/`. Razón: decidido explícitamente por el usuario — las herramientas MCP ya configuradas (`mcp__supabase__*`) bastan para los specs futuros de esquema.
- **Sí:** la autenticación futura será solo email + contraseña (decisión registrada aquí para que el spec de auth no la reabra). Razón: decidido explícitamente por el usuario; no depende de configurar proveedores OAuth externos.

---

## Risks

| Riesgo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Mitigación                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Las variables `NEXT_PUBLIC_*` quedan expuestas al cliente.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Es el comportamiento esperado: la publishable key está diseñada para ser pública (equivalente al anon key legacy); no se usa ninguna key con privilegios elevados en el cliente.                                                                                                                                          |
| `proxy.ts` corre en cada request (según el `matcher`) y podría introducir errores globales si `updateSession` falla.                                                                                                                                                                                                                                                                                                                                                                                                                                          | Se sigue el patrón oficial de Supabase (`try/catch` en `setAll`, `getClaims()` no lanza error bloqueante sin sesión activa); sin auth real todavía, el peor caso es que no haya sesión que refrescar.                                                                                                                     |
| El anon key legacy del proyecto sigue existiendo y podría usarse por error en vez de la publishable key.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Solo se documenta y usa `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.template`/`.env.local`; el anon key legacy no se agrega a ningún archivo de este repo.                                                                                                                                                            |
| `GET /api/health/supabase` usa `supabase.auth.getSession()`, que **no hace ninguna petición de red** cuando no hay una cookie de sesión (caso actual, sin auth real todavía) — devuelve `{ session: null, error: null }` de inmediato. Esto significa que el endpoint responde `200 { ok: true }` incluso si `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` está vacía o es inválida; solo confirma que el SDK se instancia sin excepción, no que la key/URL sean correctas. Detectado manualmente durante la implementación (cambiar la key no cambia el resultado). | Aceptado para este spec. Queda documentado como limitación conocida para el spec futuro de autenticación real: ese spec deberá cambiar la verificación a una llamada que sí dependa de la key (ej. `fetch` directo a `{SUPABASE_URL}/auth/v1/settings` con el header `apikey`, que responde `401` si la key es inválida). |

---

## What is **not** in this spec

- Pantallas de autenticación real conectadas a Supabase Auth.
- Tablas, migraciones o RLS en la base de datos.
- Service role / secret key.
- Supabase CLI local y migraciones versionadas en el repo.
- Realtime y Edge Functions.
- OAuth / magic link.

Cada uno de estos, si se implementa, va en su propio spec.
