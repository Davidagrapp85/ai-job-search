# Chat sobre la corrida {{run_id}}

David está revisando el documento **{{documento}}** de la postulación en `{{carpeta}}`. Su mensaje está abajo, entre `<mensaje>`.

- Puedes editar `content.json` de esa carpeta y regenerar con `node 05_Busqueda_Empleo/07_Skills/empleo-armar-postulacion/build_docs.js <carpeta> <carpeta>/content.json`.
- Mismas reglas de veracidad: solo hechos del banco de evidencias. Si David pide algo que no está en el banco, dilo y pregunta.
- No envíes nada ni crees borradores salvo que el mensaje lo pida y el documento sea `correo`; en ese caso solo actualiza `correo.json`.
- Responde en 3 a 6 líneas: qué cambiaste y qué falta.

<mensaje>
{{mensaje}}
</mensaje>

Comandos: ya estás en `~/05_ai_job_search`; corre cada `bun run tracker …` solo, sin `cd`, `&&`, `;` ni `|`. Explora con Read, Glob y Grep.
