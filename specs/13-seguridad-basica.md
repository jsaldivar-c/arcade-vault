# SPEC 13 — Medidas de seguridad básicas (checklist)

> **Status:** Implemented
> **Depends on:** SPEC 04, SPEC 06, SPEC 12
> **Date:** 2026-09-11
> **Objective:** Cerrar los puntos del checklist de seguridad en `references/security/security-checklist.md` — verificar RLS, endurecer las funciones `SECURITY DEFINER` expuestas por RPC, agregar headers de seguridad en Next.js, y documentar como prerrequisito manual el resto de la configuración de Supabase Auth (mínimo de contraseña, protección de contraseñas filtradas, límite de signups por IP).

---

## Por qué existe este spec

`references/security/security-checklist.md` es un snapshot de advisories de Supabase (`2026-09-12T02:01:43.111Z`) más una checklist manual, generado después de SPEC 12 (autenticación real). Reúne 5 puntos básicos más 3 hallazgos del linter de Supabase con más detalle. Este spec es la implementación de esa checklist: lo que es código (headers, revocar `EXECUTE`) se implementa aquí; lo que es configuración del dashboard de Supabase Auth (sin equivalente en las herramientas MCP disponibles hoy) se documenta como prerrequisito manual, siguiendo el mismo patrón que la configuración de OAuth en SPEC 12.

Verificación previa a este spec (vía `mcp__supabase__list_tables` y `mcp__supabase__get_advisors`):

- RLS ya está habilitado (`rls_enabled: true`) en `games`, `scores` y `profiles` — el punto 1 del checklist ya está cumplido, no requiere migración.
- El advisor de seguridad confirma exactamente los 3 WARN documentados en el checklist: `handle_new_user()` y `rls_auto_enable()` ejecutables por `anon`/`authenticated` vía RPC, y "Leaked Password Protection Disabled".

---

## Scope

**In:**

- Migración que revoca `EXECUTE` sobre `public.handle_new_user()` y `public.rls_auto_enable()` para los roles `anon` y `authenticated`. Ninguna de las dos funciones está pensada para invocarse vía `/rest/v1/rpc/...`: `handle_new_user()` solo debe dispararse desde el trigger `on_auth_user_created` (SPEC 12) y `rls_auto_enable()` es una función de `event trigger` preexistente que solo se ejecuta automáticamente al crear tablas. Revocar el `EXECUTE` no cambia su comportamiento normal.
- Headers de seguridad en `next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, aplicados a todas las rutas (`source: "/(.*)"`) — exactamente el set del checklist, sin ampliar.
- Verificación (sin cambios de código) de que RLS sigue habilitado en `games` y `scores`, documentada como criterio de aceptación.
- Documentación explícita, dentro de este spec, de 3 pasos manuales pendientes en el dashboard de Supabase (Authentication → Policies / Rate Limits), como prerrequisito no bloqueante para el resto del plan:
  - Mínimo de contraseña: 8 caracteres (hoy el default de Supabase es 6, ver SPEC 12).
  - Activar "Leaked Password Protection" (verificación contra HaveIBeenPwned.org).
  - Configurar un límite de signups por IP (anti-bot).
- Re-ejecutar `mcp__supabase__get_advisors` (`type: security`) al final del plan para confirmar que los 2 WARN de `SECURITY DEFINER` desaparecen (el de "Leaked Password Protection" solo desaparece cuando se completa el prerrequisito manual).

**Out of scope (para specs futuros):**

- Ejecutar la configuración manual del dashboard de Supabase (mínimo de contraseña, leaked password protection, rate limit de signups) — este spec la documenta como prerrequisito, no la ejecuta. La ejecuta el usuario directamente en el dashboard.
- Cambiar `handle_new_user()` o `rls_auto_enable()` a `SECURITY INVOKER`, o mover cualquiera de las dos fuera del schema `public` — la mitigación elegida es revocar `EXECUTE`, no reescribir las funciones.
- Auditar el contenido de las políticas RLS existentes (por ejemplo `WITH CHECK (true)` en `scores`) — ya están documentadas como comportamiento intencional en el mismo checklist (mismo modelo de confianza de SPEC 04/06), no se tocan en este spec.
- Cualquier header de seguridad adicional (`Strict-Transport-Security`, `Permissions-Policy`, CSP, etc.) más allá de los 3 del checklist.
- Rate limiting a nivel de aplicación (por ejemplo en `app/api/contact/route.ts`) — el checklist solo pide el límite de signups de Supabase Auth.
- Tests automatizados.

---

## Data model

Este feature no introduce estructuras de datos nuevas. Modifica permisos (`GRANT`/`REVOKE`) sobre funciones ya existentes de SPEC 12 y sobre infraestructura preexistente (`rls_auto_enable`), y no toca `games`, `scores` ni `profiles`.

```sql
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
```

---

## Implementation plan

1. Aplicar la migración de `REVOKE EXECUTE` sobre `handle_new_user()` y `rls_auto_enable()` vía `mcp__supabase__apply_migration`. Verificación: `mcp__supabase__get_advisors(type: "security")` ya no lista `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable` para estas dos funciones.
2. Verificación manual (sin cambios): confirmar con `mcp__supabase__list_tables` que `rls_enabled` sigue en `true` para `games` y `scores`. No se escribe código para este paso.
3. Registrar una cuenta nueva de prueba (email + contraseña) para confirmar que el trigger `on_auth_user_created` sigue poblando `profiles` correctamente después del `REVOKE` del paso 1 — el trigger corre con privilegios del dueño de la función, no depende del `EXECUTE` de `anon`/`authenticated`. Verificación: la fila aparece en `profiles` igual que antes de SPEC 12.
4. Agregar la función `headers()` en `next.config.ts` con los 3 headers del checklist aplicados a `source: "/(.*)"`. Verificación: `npm run dev`, inspeccionar la respuesta de `/` en el panel de red del navegador y confirmar los 3 headers presentes.
5. Actualizar `references/security/security-checklist.md`: marcar los checkboxes de RLS y headers como hechos, y anotar junto a los 3 pendientes (mínimo de contraseña, leaked password protection, límite de signups) que quedan como configuración manual pendiente en el dashboard de Supabase. Verificación: el archivo refleja el estado real tras este spec.
6. `npm run lint` y `npm run build`. Verificación final: build de producción sin errores; `mcp__supabase__get_advisors(type: "security")` solo conserva el WARN de "Leaked Password Protection Disabled" (pendiente del prerrequisito manual documentado).

---

## Acceptance criteria

- [ ] `mcp__supabase__get_advisors(type: "security")` ya no reporta `handle_new_user()` ni `rls_auto_enable()` como ejecutables por `anon`/`authenticated`.
- [ ] Registrar una cuenta nueva sigue creando su fila en `profiles` automáticamente (el `REVOKE` no rompe el trigger de SPEC 12).
- [ ] `rls_enabled` sigue en `true` para `games` y `scores` (verificado, no modificado).
- [ ] La respuesta HTTP de cualquier ruta incluye `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] `references/security/security-checklist.md` refleja qué puntos quedaron resueltos por este spec y cuáles siguen pendientes de configuración manual.
- [ ] `npm run build` completa sin errores de tipos ni de ESLint.
- [ ] Documentado explícitamente (no ejecutado) el prerrequisito manual: mínimo de contraseña 8 caracteres, Leaked Password Protection activado, y límite de signups por IP configurado en el dashboard de Supabase.

---

## Decisions

- **Sí:** revocar `EXECUTE` de `anon`/`authenticated` sobre `handle_new_user()` y `rls_auto_enable()`, en vez de cambiarlas a `SECURITY INVOKER` o moverlas de schema. Razón: decidido explícitamente por el usuario; es la mitigación que recomienda el propio doc del linter de Supabase, y no requiere reescribir la lógica de ninguna función.
- **Sí:** el mínimo de contraseña, leaked password protection, y el límite de signups por IP quedan como prerrequisito manual documentado, no como código de este spec. Razón: decidido explícitamente por el usuario; ninguna herramienta MCP de Supabase disponible hoy expone configuración de Auth, y el mismo patrón ya se usó en SPEC 12 para la config de providers OAuth.
- **Sí:** el set de headers de seguridad es exactamente el del checklist (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), sin ampliar con `Strict-Transport-Security` o `Permissions-Policy`. Razón: decidido explícitamente por el usuario; no inventar alcance más allá de lo pedido en el documento fuente.
- **Sí:** el punto de RLS se trata como verificación/documentación únicamente, sin auditar el contenido de las políticas existentes. Razón: decidido explícitamente por el usuario; `list_tables` ya confirma `rls_enabled: true` en ambas tablas, y las políticas permisivas (`WITH CHECK (true)` en `scores`) ya están documentadas como intencionales en el propio checklist.
- **No:** rate limiting a nivel de aplicación (Next.js/API routes) o headers adicionales de hardening. Razón: fuera del checklist original; queda para un spec futuro si se necesita.

---

## Risks

| Riesgo                                                                                                                                   | Mitigación                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revocar `EXECUTE` sobre `handle_new_user()` rompe el registro de usuarios si el trigger dependiera indirectamente de ese grant.          | Paso 3 del plan valida con un registro de prueba real antes de dar el spec por terminado; el trigger se ejecuta con privilegios del dueño de la función, no de `anon`/`authenticated`. |
| El prerrequisito manual (dashboard de Supabase) no se completa, dejando el WARN de "Leaked Password Protection" abierto indefinidamente. | Se documenta como pendiente explícito en el checklist actualizado y en los criterios de aceptación, sin bloquear el resto del spec (igual que OAuth en SPEC 12).                       |

---

## What is **not** in this spec

- Ejecutar la configuración manual en el dashboard de Supabase Auth (mínimo de contraseña, leaked password protection, límite de signups por IP) — solo se documenta como prerrequisito.
- Reescribir `handle_new_user()` o `rls_auto_enable()` a `SECURITY INVOKER`, o moverlas de schema.
- Auditar el contenido de las políticas RLS existentes.
- Headers de seguridad adicionales fuera de los 3 del checklist.
- Rate limiting a nivel de aplicación.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
