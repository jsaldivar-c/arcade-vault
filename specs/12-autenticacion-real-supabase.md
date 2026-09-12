# SPEC 12 — Autenticación real con Supabase (email/contraseña, Google, GitHub)

> **Status:** Implementado
> **Depends on:** SPEC 04
> **Date:** 2026-09-11
> **Objective:** Reemplazar el mock de sesión en localStorage (`lib/session.tsx`) por autenticación real con Supabase Auth — registro/login con email y contraseña con verificación de correo obligatoria, recuperación de contraseña, y login social con Google y GitHub — apoyada en una nueva tabla `profiles` para el username público, manteniendo el modo invitado y el flujo de guardado de puntajes tal como existen hoy.

---

## Por qué existe este spec

SPEC 04 dejó lista la integración base de Supabase (clientes browser/server, refresco de sesión vía `proxy.ts`) pero explícitamente fuera de alcance la autenticación real: `app/auth/page.tsx` y `components/auth-form.tsx` ya existen visualmente, pero llaman a `lib/session.tsx`, un mock que solo guarda un `name` en `localStorage` sin backend ni contraseña real. Este spec conecta esas pantallas ya existentes a Supabase Auth real. También reabre, de forma explícita y a pedido del usuario, la decisión de SPEC 04 de limitar la autenticación futura a "solo email + contraseña, sin OAuth" — ahora se agrega login social con Google y GitHub.

---

## Scope

**In:**

- Nueva tabla `profiles` (`id` referenciando `auth.users.id`, `username` único) con RLS de lectura pública, creada junto con una función `handle_new_user()` y un trigger `on_auth_user_created` que la pueblan automáticamente al crearse cada usuario en `auth.users`.
- `lib/session.tsx` reescrito: `SessionProvider` basado en `supabase.auth.getSession()` / `onAuthStateChange()` (cliente de `lib/supabase/client.ts`) más una consulta a `profiles` por `id`. `useSession()` pasa a devolver `{ user, profile, logout }` (login ya no vive aquí, se hace directamente en el formulario).
- `components/auth-form.tsx` reescrito: registro con `supabase.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo } })` (con validación de username de 3–20 caracteres en el cliente) y login con `supabase.auth.signInWithPassword({ email, password })`. Tras registrarse se muestra una pantalla "revisa tu correo" en vez de iniciar sesión de inmediato. Errores de Supabase (correo no confirmado, credenciales inválidas, username duplicado) se muestran inline en español.
- Link "¿Olvidaste tu contraseña?" en el tab de login, que llama `supabase.auth.resetPasswordForEmail()`.
- Nueva ruta `app/auth/reset-password/page.tsx` + `components/reset-password-form.tsx` para capturar la nueva contraseña (`supabase.auth.updateUser({ password })`) tras seguir el link del correo de recuperación.
- Nueva ruta `app/auth/callback/route.ts` (`GET`) que resuelve `exchangeCodeForSession(code)` tanto para la confirmación de email como para el retorno de OAuth, y redirige a `/`.
- Botones "GOOGLE"/"GITHUB" (ya existentes visualmente en `auth-form.tsx`) conectados a `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })`.
- `nav.tsx` y `components/game-player.tsx` actualizados para leer `profile?.username` en vez del `user?.name` del mock, y para el `logout()` ahora asíncrono.
- Se mantiene el modo invitado ("JUGAR COMO INVITADO") y el flujo actual de `saveScore` (`lib/scores.ts`), que sigue guardando `player_name` como texto — ahora poblado desde `profile.username` cuando hay sesión activa.

**Prerrequisito manual (bloquea solo el paso de OAuth, no el resto del spec):**

- Antes de implementar el paso de Google/GitHub, el usuario debe crear las apps OAuth en Google Cloud Console y GitHub Developer Settings, y configurar sus Client ID/Secret en el dashboard de Supabase Auth (Authentication → Providers). Este spec no incluye ese trabajo de configuración externa.

**Out of scope (para specs futuros):**

- Configurar las apps OAuth en las consolas de Google/GitHub (ver prerrequisito arriba) — trabajo manual fuera del código.
- Edición de perfil (cambiar username, avatar, correo) después del registro.
- `scores.user_id` o cualquier cambio al esquema de la tabla `scores` — se mantiene `player_name` como texto, sin vincular el score al usuario autenticado más allá de tomar el nombre del profile al momento de guardar.
- Rutas protegidas o login obligatorio para jugar — se mantiene el acceso invitado a todas las rutas de juego.
- Reglas de complejidad de contraseña más allá del mínimo default de Supabase (6 caracteres).
- Roles, permisos administrativos o cualquier autorización más allá de "hay sesión o no hay sesión".
- Deduplicación automática de username cuando el fallback de OAuth colisiona con uno existente (ver Riesgos).
- Tests automatizados.

---

## Data model

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Perfiles son de lectura pública"
  on public.profiles for select
  using (true);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Forma de sesión en el cliente (`lib/session.tsx`):

```ts
import type { User } from "@supabase/supabase-js";

interface SessionValue {
  user: User | null;
  profile: { username: string } | null;
  logout: () => Promise<void>;
}
```

`username` en `signUp` (registro con email+contraseña) se pasa en `options.data.username`; el trigger lo usa como primera opción. Para login social (Google/GitHub) no hay campo de username propio, por lo que el trigger usa como fallback el nombre del proveedor (`user_name`/`full_name`) o la parte local del correo.

---

## Implementation plan

1. Crear la migración de `profiles` (tabla, RLS de lectura pública, función `handle_new_user()` y trigger `on_auth_user_created`) vía `mcp__supabase__apply_migration`. Verificación: `mcp__supabase__list_tables` muestra `profiles`; un `signUp` de prueba crea la fila correspondiente automáticamente.
2. Reescribir `lib/session.tsx` con el `SessionProvider` basado en Supabase (`getSession`/`onAuthStateChange` + consulta a `profiles`). Verificación: `npx tsc --noEmit` sin errores; en `npm run dev`, sin sesión activa, `user` y `profile` son `null`.
3. Actualizar `nav.tsx` y `components/game-player.tsx` para usar `profile?.username` en vez de `user?.name`, y adaptar el `logout()` ahora asíncrono. Verificación: sin sesión, el comportamiento visual es idéntico al actual; build sin errores de tipos.
4. Reescribir `components/auth-form.tsx`: registro (`signUp` con `emailRedirectTo` a `/auth/callback`, pantalla "revisa tu correo") y login (`signInWithPassword`, redirige a `/` en éxito), con validación de username y errores inline en español. Se mantiene "JUGAR COMO INVITADO" sin cambios. Verificación manual: registrar una cuenta muestra la pantalla de confirmación; iniciar sesión sin confirmar muestra el error de Supabase; con una cuenta confirmada, el login redirige a `/` y el nav muestra el username.
5. Crear `app/auth/callback/route.ts`: recibe `code`, llama `exchangeCodeForSession(code)` con el cliente de `lib/supabase/server.ts`, redirige a `/` en éxito o a `/auth?error=...` en fallo. Verificación manual: confirmar el correo de una cuenta recién creada vía el link recibido deja la sesión activa en `/`.
6. Agregar "¿Olvidaste tu contraseña?" en el tab de login (`resetPasswordForEmail` con `redirectTo` a `/auth/reset-password`) y crear `app/auth/reset-password/page.tsx` + `components/reset-password-form.tsx` (`updateUser({ password })`, redirige a `/` en éxito). Verificación manual: flujo completo correo → link → nueva contraseña → login con la contraseña nueva funciona.
7. Conectar los botones "GOOGLE"/"GITHUB" a `signInWithOAuth({ provider, options: { redirectTo } })`. Requiere que el prerrequisito manual (configuración de providers en Supabase) ya esté hecho. Verificación manual: con los providers configurados, cada botón completa el login social y crea/reutiliza el profile correspondiente.
8. `npm run lint` y `npm run build`. Verificación final: build de producción sin errores de tipos ni de ESLint; flujo completo (registro, confirmación, login, guardar score autenticado, logout, modo invitado, recuperación de contraseña, y login social si los providers están configurados) probado manualmente en `npm run dev`.

---

## Acceptance criteria

- [ ] `profiles` existe en Supabase con RLS de lectura pública, constraint `UNIQUE` en `username`, y el trigger `on_auth_user_created` crea la fila automáticamente al registrarse.
- [ ] Registrarse con email + contraseña + usuario muestra la pantalla "revisa tu correo" y no inicia sesión hasta confirmar el correo.
- [ ] Confirmar el correo vía el link recibido activa la sesión y redirige a `/`.
- [ ] Iniciar sesión con credenciales válidas y correo confirmado redirige a `/`, y el nav muestra el `username` del profile.
- [ ] Intentar registrarse con un username ya existente muestra el error "Ese usuario ya existe, elige otro" sin romper la app.
- [ ] "¿Olvidaste tu contraseña?" envía el correo de recuperación, y el flujo hasta `/auth/reset-password` permite establecer una nueva contraseña que funciona para iniciar sesión.
- [ ] "JUGAR COMO INVITADO" sigue funcionando exactamente igual que hoy (sin sesión, nombre libre al guardar score).
- [ ] Guardar un score estando autenticado usa `profile.username` como `player_name`.
- [ ] Cerrar sesión limpia `user`/`profile`, y el nav vuelve a mostrar "Iniciar Sesión".
- [ ] Con Google/GitHub ya configurados en el dashboard de Supabase, los botones sociales completan el login y crean/reutilizan el profile correspondiente.
- [ ] `npm run build` completa sin errores de tipos ni de ESLint.

---

## Decisions

- **Sí:** Supabase Auth con email + contraseña, verificación de correo obligatoria, y login social con Google/GitHub. Razón: decidido explícitamente por el usuario, reabriendo a propósito la restricción de SPEC 04 ("solo email + contraseña, sin OAuth").
- **Sí:** un solo spec cubre email+contraseña y OAuth, con la configuración manual de providers como prerrequisito gateado dentro del plan (bloquea solo el paso 7, no el resto). Razón: decidido explícitamente por el usuario para no fragmentar el seguimiento en dos specs.
- **Sí:** tabla `profiles` nueva (`id`, `username`) con trigger `handle_new_user()`, en vez de guardar el username solo en `user_metadata`. Razón: decidido explícitamente por el usuario; garantiza unicidad vía constraint y permite leerlo desde Server Components sin depender de la sesión del cliente.
- **Sí:** `scores.player_name` se mantiene como texto (sin `user_id`), poblado desde `profile.username` cuando hay sesión. Razón: decidido explícitamente por el usuario; no toca el esquema ya funcionando de `scores`.
- **Sí:** se mantiene el modo invitado ("JUGAR COMO INVITADO") sin sesión. Razón: decidido explícitamente por el usuario; no restringe el acceso actual a los juegos.
- **Sí:** confirmación de correo bloqueante (no se puede iniciar sesión sin confirmar). Razón: decidido explícitamente por el usuario; es el comportamiento default de Supabase Auth.
- **Sí:** contraseña mínima de 6 caracteres (default de Supabase), sin reglas de complejidad adicionales. Razón: decidido explícitamente por el usuario.
- **No:** edición de perfil, roles/permisos, `scores.user_id`, tests automatizados. Razón: fuera del pedido original; quedan para specs futuros si se necesitan.

---

## Risks

| Riesgo                                                                                                                                                                                | Mitigación                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El trigger `handle_new_user()` falla si el username de fallback en login social (nombre del proveedor o parte local del correo) colisiona con uno ya existente (constraint `UNIQUE`). | El login social falla con el error de Supabase en ese caso poco frecuente; queda documentado como limitación conocida, sin deduplicación automática en este spec. |
| Los botones de Google/GitHub quedan visualmente activos pero fallan si el prerrequisito manual (configuración de providers) no se completó.                                           | Se documenta como prerrequisito explícito en el plan; el error de Supabase se muestra tal cual, el botón no se oculta ni se deshabilita.                          |
| `app/auth/callback/route.ts` atiende dos flujos distintos (confirmación de email y retorno de OAuth) con la misma lógica de `exchangeCodeForSession`.                                 | Es el patrón oficial de Supabase para App Router; ambos flujos comparten el mismo mecanismo de `code` en la URL, sin lógica condicional adicional.                |

---

## What is **not** in this spec

- Configuración de las apps OAuth en Google Cloud Console / GitHub Developer Settings (trabajo manual del usuario, prerrequisito documentado arriba).
- Edición de perfil (username, avatar, correo) después del registro.
- `scores.user_id` o cualquier cambio al esquema de `scores`.
- Rutas protegidas o login obligatorio para jugar.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
