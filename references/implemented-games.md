# Juegos implementados

Datos obtenidos de la tabla `games` en Supabase, filtrados a los juegos que tienen motor real (`lib/games/<id>/engine.ts`) y componente de canvas registrado en `lib/games/registry.ts` (`GAME_CANVAS_REGISTRY`).

## ASTEROIDS

- **Categoría:** SHOOTER
- **Color:** yellow
- **Resumen:** Pulveriza asteroides en gravedad cero.
- **Descripción:** Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir asteroides en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.

## TETRIS

- **Categoría:** PUZZLE
- **Color:** magenta
- **Resumen:** Encaja las piezas antes de que el techo te aplaste.
- **Descripción:** Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.

## ARKANOID

- **Categoría:** ARCADE
- **Color:** cyan
- **Resumen:** Rebota la pelota y destruye muros de neón.
- **Descripción:** Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?

## SNAKE

- **Categoría:** ARCADE
- **Color:** green
- **Resumen:** Crece sin morder tu propia cola.
- **Descripción:** Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.

---

**No implementados aún** (existen en la tabla `games` pero sin motor/canvas): `gloton`, `invasores`, `ranaria`, `duelo-pixel`.
