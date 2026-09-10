---
name: spec-impl-game
description: Implementa un spec aprobado de un juego de Arcade Vault con el mismo flujo que /spec-impl (valida estado, crea rama, implementa paso a paso con pausas) y al terminar encadena los subagentes skin-designer y mobile-porter, uno después del otro, nunca en paralelo. Úsalo en lugar de /spec-impl cuando el spec porta un motor de juego o añade una feature a un juego existente.
disable-model-invocation: true
argument-hint: "<spec del juego: NN-slug o carpeta/NN-slug>"
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Agent, Task, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(cat:*), Bash(ls:*), Bash(find:*), Bash(npx tsc:*), Bash(npm run lint:*)
---

# /spec-impl-game — Implementador de specs de juego + cadena de agentes

Este skill es `/spec-impl` para specs de **juegos** de Arcade Vault. Hace exactamente lo mismo (las Fases 1, 2, 4 y 5 son las de `/spec-impl`, sin relajar ninguna de sus reglas) y añade dos cosas propias de este repo:

- **Fase 3** — resuelve y confirma el `game-id` del spec antes de tocar git, porque toda la fase final depende de él.
- **Fase 6** — al terminar la implementación, encadena `skin-designer` y luego `mobile-porter`, **uno después del otro**.

Si el spec no es de un juego, este no es el comando: usa `/spec-impl`.

## Session context

Estado actual del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles (búsqueda recursiva — los specs de juego pueden estar anidados):
!`find specs -name "*.md" 2>/dev/null | sort || echo "La carpeta specs/ no existe"`

Configuración de creación de ramas:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no hay archivo de configuración)"`

Motores de juego ya portados:
!`ls lib/games/ 2>/dev/null || echo "Todavía no hay ningún motor real portado"`

---

## Instrucciones

Sigue las seis fases en orden estricto. **No avances a la siguiente fase si la anterior no se completó correctamente.**

---

### Fase 1 — Identificar el spec

El argumento recibido es: `$ARGUMENTS`

Si `$ARGUMENTS` está vacío:

- Lista los specs disponibles (ya los tienes arriba, con su ruta completa).
- Pide al usuario que indique el nombre exacto del spec.
- Detente y espera respuesta. No continúes.

Si `$ARGUMENTS` tiene valor:

- Busca el archivo en **todo** `specs/**`, no solo en la raíz. Los specs de juego viven en tres formas: `specs/NN-slug.md` (numerados de la raíz), `specs/<carpeta>/NN-slug.md` (los que genera `/add-game`) y `specs/game-jam/<game-id>/NN-slug.md` (los que genera el subagente `game-jam`).
- El usuario puede haber escrito el nombre completo (`07-juego-real-tetris`), solo el número (`01`), solo el slug (`cronosalto-core`) o una ruta parcial (`frogger/01-frogger-core`). Intenta resolver cualquiera de esos casos.
- **Si el patrón coincide con más de un archivo, no adivines.** Varios specs anidados empiezan por `01`. Muestra los candidatos con su ruta completa y pide al usuario que elija. Detente hasta tener respuesta.
- Si no encuentras el archivo, muestra los specs disponibles y pide que corrija el nombre.
- Si lo encuentras y es único, continúa a la Fase 2.

---

### Fase 2 — Validar el estado del spec

Lee el archivo del spec que localizaste en la Fase 1 con la herramienta Read o `cat`.

En el contenido del archivo, busca la línea que contiene el estado del spec. La etiqueta suele ser `**Estado:**` (español) o `**Status:**` (inglés), pero puede estar en cualquier idioma. Identifícala por posición (línea de estado cerca del encabezado del spec) y por la máquina de estados que la rodea, no por la etiqueta exacta.

**Regla absoluta:** solo puedes continuar si el estado **significa "Aprobado"** — sin importar el idioma.

Trata como estado **Aprobado** cualquiera de estos (y sus equivalentes en otros idiomas) y continúa:

- Español: `Aprobado`
- Inglés: `Approved`
- Portugués: `Aprovado`
- Francés: `Approuvé`
- Alemán: `Genehmigt`
- Italiano: `Approvato`
- …o cualquier palabra de otro idioma que claramente signifique "aprobado"

Cualquier otra cosa (Draft / Borrador / Propuesto, In review / En revisión, Implemented / Implementado, Obsolete / Obsoleto, o un valor no reconocido) significa **detente** y muestra el mensaje de error de abajo.

| Categoría de estado                            | Ejemplos (cualquier idioma)                       | Acción                                                      |
| ---------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Aprobado                                       | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continúa a la Fase 3.                                       |
| Borrador                                       | `Draft`, `Borrador`, `Propuesto`, …               | Detente. Muestra el mensaje de error.                       |
| En revisión                                    | `In review`, `En revisión`, …                     | Detente. Muestra el mensaje de error.                       |
| Implementado                                   | `Implemented`, `Implementado`, …                  | Detente. Muestra el mensaje de error.                       |
| Obsoleto                                       | `Obsolete`, `Obsoleto`, …                         | Detente. Muestra el mensaje de error.                       |
| Línea de estado no encontrada / valor ilegible | —                                                 | Detente. El archivo no sigue el formato esperado. Dilo así. |

Si dudas de si un valor significa "aprobado", **no asumas**. Detente y pide al usuario que aclare o que actualice el spec a la redacción canónica.

**Mensaje de error estándar cuando el estado no significa Aprobado:**

```
❌ No puedo implementar este spec.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado signifique "Aprobado" (p. ej. `Aprobado`,
`Approved`, o el equivalente en otro idioma).

Para continuar tienes dos opciones:
  1. Si el spec está listo para implementarse, ábrelo y cambia el estado
     a "Aprobado" (o el término equivalente que use tu equipo) manualmente.
     Ese cambio lo hace el humano, no el agente.
  2. Si el spec todavía necesita trabajo, usa /spec [nombre] para retomarlo.
```

No ofrezcas alternativas, no sugieras "puedo empezar igual si quieres". El bloqueo es intencional. **Un spec no aprobado tampoco dispara los agentes de la Fase 6.**

---

### Fase 3 — Resolver y confirmar el `game-id`

Esta fase es exclusiva de este comando y va **antes** de crear la rama, porque toda la Fase 6 depende de su resultado. El subagente `skin-designer` se niega a trabajar si no se le nombra un juego explícito, así que el id tiene que quedar fijado y confirmado desde el principio.

Busca el `game-id` dentro del spec en este orden, y quédate con el primero que encuentres:

1. El `id` del `INSERT INTO games (...)` de la sección de data model del spec (p. ej. `cronosalto`).
2. Las rutas que menciona el plan de implementación: `lib/games/<id>/engine.ts` o `components/games/<id>-canvas.tsx`.
3. El nombre de la carpeta que contiene el spec (`specs/game-jam/frogger/…` → `frogger`, `specs/game-jam/cronosalto/…` → `cronosalto`) o, para specs de la raíz, el slug del archivo (`07-juego-real-tetris` → `tetris`).

Contrasta el id candidato con la lista de motores portados del Session context (`ls lib/games/`) — sirve para distinguir un spec que **crea** el juego de uno que **añade una feature** a un juego que ya existe.

Después, confirma el id con `AskUserQuestion`, diciendo de dónde lo sacaste y si el juego ya está portado o no. No continúes con un id que el usuario no haya confirmado.

**Si el spec no es de un juego** (no hay `INSERT` en `games`, no toca `lib/games/` ni `components/games/`, y la carpeta no corresponde a ningún juego): detente y di que ese spec se implementa con `/spec-impl`, no con este comando. No crees rama ni toques código.

---

### Fase 4 — Crear la rama de git y cambiar a ella

Una vez confirmados el estado `Aprobado` y el `game-id`:

0. **Revisa primero el working tree.** Mira la salida de `git status --short` del Session context. Si **no está vacía**, detente, muestra los cambios pendientes y pregunta:

   ```
   ⚠️ Hay cambios sin commitear en el working tree.
   Cambiar de rama se los llevaría. ¿Qué quieres hacer?
     1. Commitearlos o guardarlos tú mismo y volver a lanzar el comando  (recomendado)
     2. Continuar igual — los cambios viajan a la rama nueva
   ```

   Espera la respuesta. **No hagas stash ni commit por cuenta del usuario** salvo que lo pida explícitamente. Si el working tree está limpio, pasa directo al paso 1 sin mencionarlo.

1. Deriva el nombre de la rama del nombre del archivo del spec, sin extensión, con prefijo `spec-`. Para specs anidados, antepón la carpeta **más específica** que lo contiene (no la ruta completa):

   - `specs/07-juego-real-tetris.md` → rama `spec-07-juego-real-tetris`
   - `specs/game-jam/frogger/01-frogger-core.md` → rama `spec-frogger-01-frogger-core`
   - `specs/game-jam/cronosalto/01-cronosalto-core.md` → rama `spec-cronosalto-01-cronosalto-core`

2. Lee el flag `AutoCreateBranch` de la **configuración de creación de ramas** del Session context.

   - Si el archivo de configuración no existe, el valor falta, o no se reconoce → trátalo como `true` (el default).
   - Solo un `false` explícito (en cualquier capitalización) desactiva la creación automática de rama.

   **Si `AutoCreateBranch` es `true` (default):** procede sin preguntar.

   - Si la rama **no existe**: créala con `git checkout -b <rama>`.
   - Si **ya existe**: significa que se está retomando trabajo previo. Cambia a ella, lee `git log --oneline` de la rama y dile al usuario qué pasos del plan parecen ya hechos y desde cuál propones retomar. Espera confirmación del punto de reanudación antes de implementar nada.
   - En ambos casos: cambia a la rama con `git checkout <rama>` y confirma que el cambio fue exitoso antes de continuar.

   **Si `AutoCreateBranch` es `false`:** pregunta antes de tocar git. Muestra:

   ```
   AutoCreateBranch está en false.
   ¿Crear y cambiar a la rama <rama>? [y/N]
   ```

   - Si responde **sí**: crea/cambia a la rama exactamente como en el caso `true`.
   - Si responde **no** o deja vacío: **no crees ninguna rama.** Di que implementarás sobre la rama actual (la del Session context) y pide confirmación explícita para continuar ahí. No improvises — espera la respuesta.

3. Confirma visualmente al usuario que el spec está listo, qué rama está activa y qué juego se resolvió:

   ```
   ✅ Listo para implementar.

   Spec:   specs/<ruta-completa>.md
   Rama:   <rama>  (activa)   (← o la rama actual, si no se creó ninguna)
   Estado: Aprobado   (← repite el valor real encontrado en el spec)
   Juego:  <game-id>  (← el confirmado en la Fase 3)

   Al terminar la implementación lanzaré, en este orden y de uno en uno:
     1. skin-designer  → 3 skins (neon / retro / clasico) para <game-id>
     2. mobile-porter  → auditoría responsive
   ```

4. **Todavía no empieces a implementar.** Primero muestra el resumen del spec para que el usuario lo tenga fresco. Extrae y muestra:
   - El **objetivo** (la línea después de `**Objetivo:**` / `**Objective:**` / etiqueta equivalente).
   - El **alcance** (la sección `## Scope` / `## Alcance` / equivalente).
   - El **plan de implementación** (la sección con los pasos numerados).
   - Los **criterios de aceptación** (el checklist).

Identifica los encabezados por significado, no por redacción exacta — el spec puede estar escrito en cualquier idioma.

---

### Fase 5 — Implementar paso a paso

Después de mostrar el resumen del spec, di al usuario:

```
Voy a implementar el spec siguiendo el plan de implementación al pie de la letra.
Haré una pausa después de cada paso para que revises el diff.

¿Empezamos con el Paso 1?
```

Espera confirmación explícita ("sí", "dale", "adelante", o equivalente). No empieces sin ella.

Una vez confirmado, sigue estas reglas durante toda la implementación:

**Nunca commitees automáticamente.** Ni por paso, ni al final. Tú escribes el código y muestras el diff; commitear es decisión y comando del usuario. Solo commitea si lo pide explícitamente.

**Una regla por encima de todas:** implementa lo que dice el spec. Si algo del spec te parece subóptimo, menciónalo como observación pero implementa lo acordado. Los cambios al spec van en el spec, no en el código por sorpresa.

**Ritmo de trabajo:**

- Implementa un paso del plan.
- Muestra un resumen de qué archivos tocaste y qué hiciste.
- Di: `Paso N completado. ¿Revisas el diff y me dices si sigo con el Paso N+1?`
- Espera confirmación antes de continuar.

**Si durante la implementación encuentras una ambigüedad** que el spec no resuelve:

- Detente.
- Describe la ambigüedad exactamente.
- Presenta dos o tres opciones concretas.
- Espera la decisión del usuario.
- No improvises.

**Si el usuario pide algo fuera del alcance del spec:**

- Recuérdale que está fuera del alcance de este spec.
- Sugiere anotarlo para el siguiente spec.
- No lo implementes en esta rama.

**Al terminar el último paso** — no cierres el comando aquí, a diferencia de `/spec-impl`. Anuncia la Fase 6:

```
✅ Todos los pasos del plan están implementados.

Ahora viene la fase de post-implementación de este comando:
  1. skin-designer  → skins neon / retro / clasico para <game-id>
  2. mobile-porter  → auditoría responsive de la app

Los lanzo de uno en uno, pidiéndote confirmación antes de cada uno.
```

---

### Fase 6 — Cadena de subagentes (skin-designer → mobile-porter)

Esta fase es el motivo de existir de este comando. Es **estrictamente secuencial**: primero `skin-designer`, y solo cuando ese haya terminado y hayas retransmitido su reporte, `mobile-porter`.

#### 6.1 — Precondición de `skin-designer`

`skin-designer` solo trabaja sobre juegos ya portados. Comprueba que existan `lib/games/<game-id>/engine.ts` y una entrada para `<game-id>` en `lib/games/registry.ts`.

- Si **existen**: continúa al 6.2.
- Si **no existen** (típicamente porque el spec era de una feature complementaria y el motor lo porta otro spec): **salta `skin-designer`**, di explícitamente por qué lo saltas, y pasa directo al 6.4 con `mobile-porter`.

#### 6.2 — Lanzar `skin-designer`

Pide confirmación primero, nombrando el juego:

```
Voy a lanzar skin-designer sobre <game-id> para aplicar las 3 skins
(neon / retro / clasico=default). ¿Lo lanzo?
```

Al aceptar, haz **una sola** llamada al tool `Agent` con `subagent_type: "skin-designer"` y un prompt que nombre **únicamente** ese `game-id` — nunca varios juegos, nunca "y los que falten". El agente rechaza trabajar sin un juego explícito y tiene prohibido skinear juegos que no se le nombren.

#### 6.3 — Esperar y retransmitir

**Espera a que `skin-designer` termine antes de hacer cualquier otra cosa.** Su reporte no le llega al usuario: retransmíteselo tú, con los archivos creados/modificados y la línea de resumen de cada skin.

Si `skin-designer` se detuvo sin completar (p. ej. `npx tsc --noEmit` falló, o el juego no estaba portado), dilo y **pregunta al usuario si aun así sigues con `mobile-porter`**. No lo des por hecho.

#### 6.4 — Lanzar `mobile-porter`

Pide confirmación:

```
skin-designer terminó. ¿Lanzo ahora mobile-porter para auditar el responsive?
```

Al aceptar, haz **una sola** llamada al tool `Agent` con `subagent_type: "mobile-porter"`, en un mensaje distinto al de `skin-designer`. El prompt debe pedir que priorice las pantallas del juego recién implementado — `/juego/<game-id>`, `/juego/<game-id>/jugar` y su card en `/biblioteca` — y que además revise que el resto de la app (nav, home, about, salón, auth) no haya sufrido regresiones.

#### 6.5 — Retransmitir y cerrar

Retransmite el reporte de `mobile-porter`: qué revisó, qué corrigió con `archivo:línea`, y qué dejó pendiente. Luego cierra:

```
✅ Implementación + skins + auditoría móvil completadas.

Siguientes pasos (tuyos, no míos):
  1. Verifica los criterios de aceptación del spec uno por uno.
  2. Pruébalo a mano en el navegador: /juego/<game-id>/jugar, y con el device
     toolbar de Chrome DevTools para lo móvil. Ni skin-designer ni mobile-porter
     tienen navegador — nada de lo visual está verificado.
  3. Si todo pasa, cambia el estado del spec a "Implementado" y haz el commit
     final antes de mergear la rama.
```

---

## Resumen del comportamiento esperado

```
/spec-impl-game game-jam/cronosalto/01-cronosalto-core

  Fase 1  →  Encuentra specs/game-jam/cronosalto/01-cronosalto-core.md
  Fase 2  →  Lee el estado → "Aprobado" → ✅ continúa
  Fase 3  →  Resuelve game-id "cronosalto" del INSERT en games → lo confirma
  Fase 4  →  git checkout -b spec-cronosalto-01-cronosalto-core
             Muestra objetivo, alcance, plan y criterios
  Fase 5  →  Implementa paso a paso con pausas
  Fase 6  →  skin-designer(cronosalto) → espera → reporte
             mobile-porter → espera → reporte → cierre

/spec-impl-game frogger/01-frogger-core   (estado: Propuesto)

  Fase 1  →  Encuentra specs/game-jam/frogger/01-frogger-core.md
  Fase 2  →  Lee el estado → "Propuesto" → ❌ se detiene
             Muestra el mensaje de error estándar
             No crea rama, no toca código, no lanza ningún agente
```

---

## Hard rules

- **Nunca lances los dos subagentes en paralelo ni en el mismo mensaje.** `mobile-porter` no arranca hasta tener el reporte de `skin-designer`.
- Nunca invoques `skin-designer` sin un `game-id` explícito confirmado en la Fase 3, y nunca con más de un juego.
- Nunca commitees ni hagas stash por cuenta propia, en ninguna fase.
- Nunca te saltes la Fase 2: un spec que no está aprobado no se implementa ni dispara agentes.
- Nunca implementes más de un spec por corrida.
- Nunca afirmes que las skins o el layout móvil "se ven bien": ningún agente de la Fase 6 tiene navegador.
