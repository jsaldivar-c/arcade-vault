# Game Planner — Historial de decisiones

> Mantenido automáticamente por el subagente `game-planner`. No editar manualmente sin necesidad.

## 2026-09-08

**Contexto considerado:** Primera corrida del subagente (memoria previa inexistente: `game-planner-log.md` no existía y `game-suggestions-todo.md` estaba vacío). Motor implementado hoy (confirmado en DB y en `lib/games/*`): `asteroids` (SHOOTER, yellow), `tetris` (PUZZLE, magenta), `arkanoid` (ARCADE, cyan), `snake` (ARCADE, green) — los dos últimos añadidos (SPEC 08/09) fueron ambos ARCADE. Backlog sin motor confirmado por DB (`select * from games`) e `implemented-games.md`: `gloton` (ARCADE, yellow), `invasores` (SHOOTER, green), `ranaria` (ARCADE, green), `duelo-pixel` (VERSUS, cyan). `references/started-games/` no existe (glob sin resultados) — ningún ítem del backlog tiene prototipo de referencia, así que ninguno tiene ventaja de "menor esfuerzo" por ese lado; el desempate viene de balance de categoría, reuso de patrones de motor ya construidos y claridad de score.

**Candidatos evaluados:**

- `gloton` (ARCADE, yellow) — score natural (puntos por pellet), pero repetiría ARCADE por tercera vez consecutiva (arkanoid y snake ya son ARCADE) y llevaría la categoría a 3/5 juegos (60% del catálogo).
- `ranaria` (ARCADE, green) — mismo problema de sobresaturación de ARCADE, y mecánica de score más débil (cruce/supervivencia por nivel en vez de acumulación de puntos), duplicando además el color green de `snake`.
- `invasores` (SHOOTER, green) — balancea SHOOTER a 2/5 (empatado con ARCADE en 40% cada uno), mecánica de puntaje canónica (puntos por alien destruido), reutiliza patrones de disparo/colisión de `asteroids` aunque necesita lógica nueva de formación en grilla.
- `duelo-pixel` (VERSUS, cyan) — introduce una categoría totalmente nueva (mejor balance teórico) y reutilizaría con fuerza la física de pelota/paleta ya resuelta en `arkanoid`, pero al ser un duelo 1v1-vs-CPU su "score" no es un acumulado clásico de high-score sino el resultado de una partida ganada/perdida, lo que encaja peor con el modelo de leaderboard global de `scores`.

**Recomendación:** `invasores` — mejor balance de categoría (lleva SHOOTER de 1 a 2 juegos, igualando a ARCADE, sin sobresaturar ninguna), rompe la racha de dos ARCADE consecutivos (arkanoid, snake), y tiene la mecánica de puntaje más clara y "score-able" de todo el backlog (puntos acumulados por enemigo destruido), que es justo el criterio donde `duelo-pixel` es más débil.

**Descartados:**

- `duelo-pixel` — pese a diversificar mejor la categoría (VERSUS nueva) y reutilizar la física de `arkanoid`, su modelo de "duelo vs. CPU" no se traduce de forma natural a un leaderboard de high-score acumulado; se deja en cola para una futura corrida si se define bien cómo puntuarlo (p. ej. puntos anotados antes de perder, o mejor racha).
- `gloton` / `ranaria` — descartados por sobresaturar ARCADE (ya serían 3 de 5 juegos) y por repetir el género de las dos últimas incorporaciones (arkanoid, snake).

## 2026-09-08 (batch paralelo, 10 corridas)

**Contexto:** a pedido del usuario, se lanzaron 10 corridas del subagente en paralelo (una sola vez, sin verse entre sí) para producir 10 recomendaciones. Cada corrida recibió un ángulo distinto (evaluar un ítem del backlog restante, proponer un concepto nuevo por categoría, optimizar por menor esfuerzo, optimizar por diversión) para minimizar solapamiento, dado que el backlog real solo tiene 3 ítems libres (`gloton`, `ranaria`, `duelo-pixel` — `invasores` ya recomendado arriba). Ninguna corrida escribió en este archivo ni en `game-suggestions-todo.md`; el coordinador consolidó y escribe esta única entrada.

**Resultado:** 10 corridas produjeron 9 conceptos únicos (las corridas de "menor esfuerzo" y "máxima diversión" convergieron en candidatos ya evaluados por otras corridas — `ranaria` y `gloton` respectivamente — reforzando esas posiciones en vez de aportar ideas nuevas).

**Ranking consolidado (razonamiento del coordinador, no de una corrida individual):**

1. **`invasores`** (SHOOTER, green) — ya recomendado arriba; sigue siendo el pick inmediato.
2. **`duelo-pixel`** (VERSUS, cyan) — única categoría vacía del catálogo; alto reuso de física de `arkanoid`. Diseño de score que resuelve el bloqueo anterior: partida a N puntos o tiempo fijo contra la CPU, el score enviado a `scores` es el conteo de puntos anotados por el jugador antes de terminar (no un booleano ganar/perder), alcance acotado a 1 jugador vs CPU (el contrato `GameHandle` actual no soporta 2 jugadores humanos).
3. **`ranaria`** (ARCADE, green) — el de mayor reuso de motor de todo el backlog (~1:1 con `snake/engine.ts`: grid, loop de tick, input direccional, `GameHandle`); buena score-ability (puntos por avance de fila + bonus). Conviene secuenciarlo después de diversificar color/categoría (saturaría green/ARCADE si va justo después de invasores).
4. **`gloton`** (ARCADE, yellow) — el de mayor potencial de "engagement": combo multiplicador tras power pellet (200→400→800→1600) genera el gancho de "una vuelta más". Rompe la racha de green, pero satura ARCADE (sería 3/5) y requiere IA de fantasmas nueva (mayor esfuerzo que el resto del backlog).
5. **"Rebote Rival"** (concepto nuevo, VERSUS) — Pong de supervivencia con IA escalante y una sola vida; score = puntos acumulados antes de que la CPU anote, con multiplicador por racha. Resuelve el mismo problema de score que `duelo-pixel` con un enfoque distinto (sin partida a puntos fijos). Redundante con `duelo-pixel` si este avanza primero — tratarlo como variante/alternativa, no sumarlo aparte.
6. **"Bastión"** (concepto nuevo, SHOOTER, magenta) — torreta fija con rotación 360°, oleadas desde los bordes hacia el centro. Reutiliza casi directo el patrón de proyectiles/colisión/oleadas de `asteroids/engine.ts`; se diferencia de `asteroids` (nave libre) e `invasores` (grilla) por su modelo de defensa de punto fijo.
7. **"Cascada de Gemas"** (concepto nuevo, PUZZLE, yellow) — match-3 de gemas cayendo por pares (estilo Puyo/Columns) con combos en cadena. Diversifica PUZZLE (hoy solo `tetris`) reutilizando casi 1:1 el grid/gravedad/tick de `tetris/engine.ts`, con mecánica de scoring distinta (matches de color vs. líneas completas).
8. **"Saltarín de Neón"** (concepto nuevo, categoría PLATFORMER — inexistente hoy) — scroll lateral automático, salto/doble salto, monedas. Abre un género completamente nuevo para el catálogo (progresión de habilidad/distancia en vez de reflejos/duelo), ensanchando el público.
9. **"Trepacielos"** (concepto nuevo, plataformas verticales estilo Doodle Jump) — mecánica de escalada infinita con score = altura alcanzada. Se solapa en género con "Saltarín de Neón" (ambos son plataformas); tratar como alternativa entre sí, no construir ambos.

**Nota de proceso:** correr 10 instancias en paralelo sin memoria compartida funcionó para explorar ángulos distintos, pero produjo redundancia real entre conceptos nuevos (`duelo-pixel`/"Rebote Rival" ambos VERSUS-Pong; "Saltarín de Neón"/"Trepacielos" ambos plataformas) — evidencia de que el espacio de conceptos "obvios" para las categorías vacías converge rápido incluso sin coordinación entre corridas.
