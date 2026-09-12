## Checklist de seguridad básico

- [x] RLS: Row Level Security habilitado en ambas tablas: `games` y `scores` — verificado con `mcp__supabase__list_tables` (SPEC 13), ya estaba habilitado desde antes, sin cambios necesarios.
- [ ] Minimum password length — mínimo 8 caracteres — **pendiente, configuración manual** en el dashboard de Supabase (Authentication → Policies). No hay herramienta MCP disponible hoy para configurarlo.
- [ ] Leaked password protection — (el warning 4) — **pendiente, configuración manual** en el dashboard de Supabase (Authentication → Policies). No hay herramienta MCP disponible hoy para configurarlo.
- [ ] Max signup rate — limitar signups por IP (anti-bot) — **pendiente, configuración manual** en el dashboard de Supabase (Authentication → Rate Limits). No hay herramienta MCP disponible hoy para configurarlo.
- [x] Headers de seguridad en Next.js — implementado en `next.config.ts` (SPEC 13), verificado con `curl -I` contra el servidor de desarrollo.

Ej:

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

// En la config de Next.js:
headers: async () => [{ source: "/(.*)", headers: securityHeaders }];
```

## Por el lado de Supabase

### 1. RLS Policy Always True — `public.scores`

- **Nivel:** WARN · **Categoría:** SECURITY
- La política `anyone can insert a score` en `INSERT` tiene `WITH CHECK (true)`, sin restricciones — bypassa RLS para ese comando.
- **Nota:** esperado. Es el mismo modelo de confianza que el mock anterior en `localStorage` (SPEC 04/06): inserción pública intencional en `scores`.
- [Doc del linter](https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy)

### 2. Funciones `SECURITY DEFINER` ejecutables públicamente — ✅ resuelto (SPEC 13)

- **Nivel:** WARN · **Categoría:** SECURITY

| Función                    | Rol                     | Vía                            |
| -------------------------- | ----------------------- | ------------------------------ |
| `public.handle_new_user()` | `anon`, `authenticated` | `/rest/v1/rpc/handle_new_user` |
| `public.rls_auto_enable()` | `anon`, `authenticated` | `/rest/v1/rpc/rls_auto_enable` |

- `handle_new_user()` se creó en SPEC 12 como trigger de `auth.users` — no está pensada para llamarse directo vía RPC. Evaluar revocar `EXECUTE` a `anon`/`authenticated` o mover la función fuera del schema expuesto.
- `rls_auto_enable()` es preexistente, no relacionada con SPEC 12.
- **Resuelto:** `REVOKE EXECUTE` sobre ambas funciones para `anon`, `authenticated` **y `PUBLIC`**. La revocación explícita a `anon`/`authenticated` no era suficiente por sí sola: Postgres otorga `EXECUTE` a `PUBLIC` por defecto al crear una función, y `anon`/`authenticated` heredan ese grant como miembros del pseudo-rol `PUBLIC`. `mcp__supabase__get_advisors` confirma que ambos WARN desaparecieron tras revocar también de `PUBLIC`. Se registró una cuenta de prueba para confirmar que el trigger `on_auth_user_created` sigue funcionando (corre con privilegios del dueño de la función, no de `anon`/`authenticated`).
- [Doc del linter (anon)](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Doc del linter (authenticated)](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)

### 3. Leaked Password Protection deshabilitada — ⏳ pendiente (configuración manual)

- **Nivel:** WARN · **Categoría:** SECURITY
- Supabase Auth no está verificando contraseñas filtradas contra HaveIBeenPwned.org.
- Activar en el dashboard de Supabase (Authentication → Policies).
- [Doc](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

_Último snapshot de advisories: 2026-09-12T02:01:43.111Z. Tras SPEC 13, `mcp__supabase__get_advisors(type: "security")` solo reporta este WARN — los otros dos (`SECURITY DEFINER` ejecutable por `anon`/`authenticated`) ya no aparecen._
