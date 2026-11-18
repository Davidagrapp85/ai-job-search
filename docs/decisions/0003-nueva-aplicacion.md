# 0003 — "Nueva aplicación": Claude Code como motor y envío solo con clic

**Fecha:** 19-nov-2026
**Estado:** Implementada en la rama `career-os`.
**Diseño:** `docs/superpowers/specs/2026-11-19-nueva-aplicacion-design.md`.

## Decisiones

- El dashboard lanza `claude -p` (plan de David) para armar la postulación, para el chat (misma sesión, `--resume`), para el borrador del correo, para el envío y para aprendizajes. Una corrida a la vez.
- `ANTHROPIC_API_KEY` solo se usa como reserva: se quita del entorno en el primer intento y se usa en un único reintento si el plan llega a su límite.
- El avance se reporta por CLI (`bun run tracker paso`), no interpretando la salida del modelo.
- Herramientas del agente: archivos, web, skills, `bun run tracker`, `build_docs.js` y Composio. Sin shell libre ni git.
- Correo: borrador solo tras aprobar CV y carta; envío solo con el clic de David y la huella del correo que vio; `enviada` solo con evidencia en Elementos enviados (`confirmar-envio` exige la solicitud de David).
- Aprendizajes: propuestas en `09_Aprendizajes/pendientes.jsonl`; solo los aprobados (no de tipo hecho) se aplican al brain; los de tipo hecho quedan "por validar".

## Consecuencias

- El primer uso real de `claude -p` y de Composio desde el servidor ocurre cuando David reinicia el dashboard (el sandbox de esta sesión no tiene red).
- Cada corrida consume uso del plan de David.
