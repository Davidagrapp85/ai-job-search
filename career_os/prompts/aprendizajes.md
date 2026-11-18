# Tarea: registrar aprendizajes — corrida {{run_id}}

David cerró la postulación en `05_Busqueda_Empleo/{{carpeta}}`. Detecta qué cambió entre lo que generaste y lo final, y propón aprendizajes. **No edites el brain.**

1. Compara `content.v1.json` (primera versión) con `content.json` (final), y el chat de esta conversación. Si David editó los `.docx` a mano, compara su texto con el que generaste.
2. Por cada cambio con sentido (no cada coma), clasifica `tipo`: `hecho` (cifra, cargo, fecha, título, certificación), `redaccion`, `enfasis`, `estructura`, `keyword`, `correccion` o `estilo`.
3. Elige `alcance`: `vacante` (solo esta), `familia` (próximos CV del mismo eje), `compartido` (afecta el banco) o `experimental`.
4. Elige `destino`: `01_Perfil/banco_evidencias.md`, `01_Perfil/cv_base.md`, `01_Perfil/narrativa.md` o `02_Configuracion/ejes/<eje>.md`.
5. Escribe el JSON con tu herramienta de archivos en `05_Busqueda_Empleo/{{carpeta}}/_aprendizaje.json` (solo puedes escribir dentro de esa carpeta) — `{"run_id":"{{run_id}}","application_id":"{{application_id}}","tipo":"…","antes":"…","despues":"…","motivo":"…","alcance":"…","destino":"…"}` — y corre `bun run tracker aprendizaje --json-file 05_Busqueda_Empleo/{{carpeta}}/_aprendizaje.json`. Uno por cambio.
6. Un cambio tipo `hecho` nunca prueba un hecho nuevo: proponlo igual; David lo valida contra evidencia.

Termina con una línea: cuántos aprendizajes propusiste, por tipo.
