# SPEC 03 — Envío de correo de contacto con Resend

> **Status:** Implementado
> **Depends on:** SPEC 02
> **Date:** 2026-09-01
> **Objective:** Conectar el formulario de contacto de `/about` a un endpoint real (`app/api/contact/route.ts`) que envíe el mensaje por correo usando Resend, reemplazando la simulación sin red que dejó SPEC 02.

---

## Por qué existe este spec

SPEC 02 implementó el formulario de contacto de `/about` como **decorativo/simulado**, explícitamente sin llamada de red ni persistencia (ver su sección "Out of scope"). Este spec cierra ese hueco: agrega un endpoint real que envía el mensaje por correo usando Resend como proveedor.

---

## Scope

**In:**

- Nueva variable de entorno `RESEND_API_KEY` en `.env.local` (no versionado), inicialmente vacía — el usuario la completa después de crear su cuenta/API key en Resend.
- Nueva variable de entorno `CONTACT_TO_EMAIL` en `.env.local`, con valor `josedmy@gmail.com` como destino de los mensajes del formulario.
- Archivo `.env.example` (versionado) documentando ambas variables, con comentarios explicando su propósito y valores vacíos/de ejemplo.
- Dependencia `resend` (SDK oficial) agregada a `package.json`.
- Nuevo Route Handler `app/api/contact/route.ts` con método `POST`: recibe `{ name, email, msg }` en JSON, valida que los tres campos no estén vacíos y que `email` tenga formato válido, y usa el SDK de Resend para enviar un correo a `process.env.CONTACT_TO_EMAIL` desde el remitente de pruebas `onboarding@resend.dev` (no requiere dominio verificado), con `replyTo` igual al correo del usuario y el asunto/cuerpo incluyendo nombre, correo y mensaje.
- Respuestas del endpoint: `400` si la validación de campos falla, `200` si Resend confirma el envío, `500` si Resend devuelve error (API key inválida/vacía, caída del servicio, etc.) o si la llamada a Resend falla por cualquier otro motivo.
- `components/about.tsx` actualizado: `onSubmit` pasa a ser asíncrono y hace `fetch('/api/contact', { method: 'POST', ... })` en vez de resolver localmente con `setSent`. Se agregan dos estados nuevos:
  - `sending`: deshabilita el botón de envío y cambia su texto a "ENVIANDO..." mientras la petición está en curso.
  - `error`: mensaje visual de fallo (color magenta, consistente con la paleta existente) debajo del formulario, que se muestra sin ocultar los campos ni el texto ya escrito, para que el usuario pueda corregir o reintentar.
- La validación de campos vacíos existente (dispara `shake`) se mantiene igual, sin cambios de comportamiento.
- La animación de éxito (`terminal-success`) se mantiene igual visualmente; el cambio es que ahora se dispara después de que el `fetch` responde `200`, no de forma inmediata como en SPEC 02.

**Out of scope (para specs futuros):**

- Correo de confirmación automática al usuario que llenó el formulario — este spec solo notifica a `CONTACT_TO_EMAIL`.
- Verificación de un dominio propio en Resend y uso de un remitente personalizado (ej. `contacto@arcadevault.com`) — se usa el remitente de pruebas `onboarding@resend.dev` hasta que exista un dominio verificado.
- Protección anti-spam (captcha, honeypot) o rate limiting por IP/sesión.
- Persistencia de los mensajes de contacto en base de datos o almacenamiento propio.
- Tests automatizados.
- Cambios a cualquier otra pantalla (Home, Biblioteca, Detalle, Reproductor, Salón, Auth).

---

## Data model

No se introduce ningún modelo de datos persistido. Se define la forma del request/response del nuevo endpoint:

```ts
// POST /api/contact — request body
interface ContactRequestBody {
  name: string;
  email: string;
  msg: string;
}

// Responses
// 200 → { ok: true }
// 400 | 500 → { ok: false; message: string }
```

---

## Implementation plan

1. Instalar la dependencia `resend` (`npm install resend`). Crear `.env.example` (versionado) con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=josedmy@gmail.com`, documentando en comentarios el propósito de cada variable. Crear `.env.local` (no versionado, ya cubierto por `.env*` en `.gitignore`) con las mismas claves, `RESEND_API_KEY` vacío para que el usuario lo complete después. Verificación: `npm install` termina sin errores; `git status` no muestra `.env.local`.
2. Crear `app/api/contact/route.ts` con el método `POST`: parsear el body JSON y validar que `name`/`email`/`msg` no estén vacíos y que `email` tenga formato válido (regex simple), devolviendo `400` con `{ ok: false, message }` si la validación falla. Verificación: `npx tsc --noEmit` sin errores; una petición manual con body vacío devuelve `400`.
3. Dentro del mismo Route Handler, instanciar el cliente de Resend con `process.env.RESEND_API_KEY` y llamar a `resend.emails.send(...)` con `from: "Arcade Vault <onboarding@resend.dev>"`, `to: process.env.CONTACT_TO_EMAIL`, `replyTo: email`, asunto `Nuevo mensaje de contacto — ${name}` y cuerpo con nombre, correo y mensaje. Si Resend devuelve error, responder `500` con `{ ok: false, message }`; si tiene éxito, responder `200` con `{ ok: true }`. Verificación: con `RESEND_API_KEY` vacío, la petición responde `500` de forma controlada (sin tumbar el servidor de desarrollo).
4. Actualizar `components/about.tsx`: agregar estados `sending` y `error`; convertir `onSubmit` en async, mantener el `shake` existente para campos vacíos, y en caso válido hacer `fetch('/api/contact', ...)`. En éxito (`res.ok`), setear `sent` igual que antes (dispara `terminal-success`). En fallo, setear `error` con un mensaje y mantener el formulario visible con los datos ya escritos, sin limpiar el estado. Verificación: enviar el formulario completo con `RESEND_API_KEY` vacío muestra el mensaje de error sin perder los campos.
5. Agregar el bloque CSS mínimo para el mensaje de error (nueva clase, ej. `.contact-error`, reutilizando el token `--magenta` ya definido) en `app/globals.css`. Verificación: `npm run build` sin errores de CSS/Tailwind.
6. (Paso manual, a completar por el usuario) Colocar la `RESEND_API_KEY` real en `.env.local` y probar el flujo completo end-to-end: llenar el formulario, confirmar que `josedmy@gmail.com` recibe el correo con nombre/correo/mensaje del remitente, y que la animación `terminal-success` se muestra tras la respuesta real del servidor.

---

## Acceptance criteria

- [X] `npm run build` completa sin errores de tipos ni de ESLint.
- [X] `.env.example` existe (versionado) y documenta `RESEND_API_KEY` y `CONTACT_TO_EMAIL`.
- [X] `.env.local` existe localmente (no versionado) con `CONTACT_TO_EMAIL=josedmy@gmail.com`.
- [X] Enviar el formulario con campos vacíos sigue disparando `shake`, sin llamar a `/api/contact`.
- [X] Enviar el formulario completo dispara una petición `POST` real a `/api/contact` (visible en el Network tab), en vez de resolver localmente como en SPEC 02.
- [X] Mientras la petición está en curso, el botón de envío queda deshabilitado y muestra "ENVIANDO...".
- [X] Con `RESEND_API_KEY` vacía o inválida, el envío muestra el estado de error visual y conserva los datos ya escritos en el formulario.
- [X] Con una `RESEND_API_KEY` válida configurada, enviar el formulario entrega un correo real a `CONTACT_TO_EMAIL` con nombre, correo y mensaje del remitente, y muestra la animación `terminal-success` con el nombre ingresado.

---

## Decisions

- **Sí:** Resend como proveedor de envío de correo. Razón: decidido explícitamente por el usuario.
- **Sí:** remitente de pruebas `onboarding@resend.dev` en vez de un dominio propio verificado. Razón: el usuario no tiene todavía un dominio verificado en Resend; el sandbox permite enviar sin bloquear el spec, y se puede migrar a un dominio propio en un spec futuro sin cambiar la interfaz del endpoint.
- **Sí:** `RESEND_API_KEY` se deja vacía en `.env.local` para que el usuario la complete después de este spec. Razón: decidido explícitamente por el usuario ("yo te voy a proporcionar el API después").
- **Sí:** destino fijo `CONTACT_TO_EMAIL=josedmy@gmail.com` vía variable de entorno, no hardcodeado en el código. Razón: decidido explícitamente por el usuario; mantenerlo en env var permite cambiarlo sin tocar código.
- **Sí:** estado de error visual dedicado en el formulario en vez de reusar `shake`. Razón: decidido explícitamente por el usuario — un fallo de red/API es un caso distinto de un campo vacío y merece su propio mensaje para que el usuario sepa que puede reintentar sin perder lo escrito.
- **No:** correo de confirmación automática al usuario que llena el formulario. Razón: decidido explícitamente por el usuario — solo se notifica al equipo (`CONTACT_TO_EMAIL`) por ahora; una segunda plantilla queda para un spec futuro si se necesita.
- **No:** protección anti-spam (captcha, honeypot, rate limiting). Razón: fuera del alcance discutido en este spec; se evaluaría si el formulario público empieza a recibir spam.

---

## Risks

| Riesgo | Mitigación |
|---|---|
| `RESEND_API_KEY` queda vacía hasta que el usuario la complete manualmente — el envío real no funciona hasta entonces. | Comportamiento esperado y documentado en el plan (paso 6); mientras tanto el endpoint responde `500` de forma controlada y el formulario muestra el estado de error en vez de fallar silenciosamente. |
| El remitente de pruebas `onboarding@resend.dev` puede tener límites de envío o llegar a spam más fácilmente que un dominio propio verificado. | Riesgo aceptado para este spec; migrar a un dominio propio queda como mejora futura, sin cambios en la interfaz del endpoint más allá del `from`. |
| `.env.local` no versionado: el valor real de `RESEND_API_KEY` no viaja con el repo — cualquier clon nuevo (u otro entorno) necesita configurarlo a mano. | `.env.example` documenta qué variables se necesitan y su propósito, sirviendo de checklist para nuevos entornos. |

---

## What is **not** in this spec

- Correo de confirmación automática al usuario que llenó el formulario.
- Verificación de dominio propio en Resend / remitente personalizado.
- Protección anti-spam (captcha, honeypot, rate limiting).
- Persistencia de los mensajes de contacto.
- Tests automatizados.
- Cambios a Home, Biblioteca, Detalle, Reproductor, Salón o Auth.

Cada uno de estos, si se implementa, va en su propio spec.
