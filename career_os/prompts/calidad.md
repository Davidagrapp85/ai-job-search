# Tarea: medir la calidad del paquete — corrida {{run_id}}

La postulación está en `05_Busqueda_Empleo/{{carpeta}}`. Lee `vacante.md`, `analisis.md`, `content.json` y `respuestas.md`.

1. Corre `bun run tracker ats {{run_id}}`. Si no da 100%, corrige `content.json`, regenera con `node 05_Busqueda_Empleo/07_Skills/empleo-armar-postulacion/build_docs.js 05_Busqueda_Empleo/{{carpeta}} 05_Busqueda_Empleo/{{carpeta}}/content.json` y repite (máximo 3 intentos).
2. Califica con la rúbrica y haz las rondas de mejora.
3. Termina con una línea: ATS, nota por ronda y riesgos que quedan.

Comandos: ya estás en `~/05_ai_job_search`; corre cada comando solo, sin `cd`, `&&`, `;` ni `|`. Explora con Read, Glob y Grep.

## Calidad del paquete (después de que ATS dé 100%)

Califica el CV y las respuestas de 0 a 100 en cada variable. El total ponderado lo calcula el sistema; no lo calcules tú ni lo redondees a favor.

| Variable | Peso | 100 significa | Baja cuando |
|---|---|---|---|
| `veracidad` | 30 | Cada afirmación tiene `EV-xxx` del banco; fechas y cargos exactos | Hay algo sin evidencia, una cifra redondeada hacia arriba o un `declarado` alto sin avisar |
| `pertinencia` | 25 | Perfil y bullets responden a los requisitos de esta vacante, con sus términos | Bullets genéricos o requisitos clave sin abordar |
| `evidencia` | 20 | Logros con cifra, alcance o resultado verificable | Responsabilidades sin resultado |
| `claridad` | 15 | Frases cortas, verbo de acción, sin relleno, extensión adecuada | Párrafos largos, jerga, repeticiones |
| `coherencia` | 10 | CV, respuestas y (si hay) carta cuentan la misma historia, mismo idioma y mismas cifras | Contradicciones o idiomas mezclados |

**Cobertura:** por cada requisito de la vacante: `demostrado`, `parcial`, `no demostrado` o `desconocido`, con el `EV-xxx` si lo hay.
**Riesgos:** lo que no se puede resolver con hechos (requisito excluyente, idioma, años).

Escribe en `05_Busqueda_Empleo/<carpeta>/_calidad.json`:
`{"dimensiones":{"veracidad":0,"pertinencia":0,"evidencia":0,"claridad":0,"coherencia":0},"cobertura":[{"requisito":"…","estado":"…","evidencia":"EV-…"}],"riesgos":["…"],"cambios":"qué cambiaste en esta ronda (vacío en la primera)"}`
y corre `bun run tracker calidad {{run_id}} --json-file 05_Busqueda_Empleo/<carpeta>/_calidad.json`.

**Rondas:** si el total queda bajo 90 y hay mejoras posibles **con hechos del banco**, mejora el CV (`content.json` + `build_docs.js`), vuelve a correr `bun run tracker ats {{run_id}}` (debe seguir en 100) y califica de nuevo. Máximo 2 rondas de mejora. Nunca subas una nota sin un cambio real; si no se puede llegar a 90 con hechos, déjalo y explica por qué en `riesgos`.
