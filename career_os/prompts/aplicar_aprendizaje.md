# Tarea: aplicar un aprendizaje aprobado — {{learning_id}}

David aprobó este aprendizaje. Aplícalo **solo** en `05_Busqueda_Empleo/{{destino}}`.

- Tipo: {{tipo}} · Alcance: {{alcance}}
- Antes: «{{antes}}»
- Después: «{{despues}}»
- Motivo: {{motivo}}

1. Haz el cambio mínimo que refleje el aprendizaje en ese archivo. No toques otros archivos. No agregues hechos nuevos.
2. Escribe con tu herramienta de archivos un resumen del cambio (líneas antes y después) en `05_Busqueda_Empleo/{{carpeta}}/_diff.txt`.
3. Corre `bun run tracker aprendizaje-aplicado {{learning_id}} --diff-file 05_Busqueda_Empleo/{{carpeta}}/_diff.txt`.

Comandos: ya estás en `~/05_ai_job_search`; corre cada `bun run tracker …` solo, sin `cd`, `&&`, `;` ni `|`. Explora con Read, Glob y Grep.
