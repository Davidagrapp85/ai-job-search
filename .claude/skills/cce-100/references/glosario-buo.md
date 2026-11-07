# BUO — Uso del diccionario canónico

**Fuente de verdad para términos BUO:** `docs/BUO_DICCIONARIO.md` cuando se instale en el repositorio de BUO. El archivo de inicio para la instalación está en `diccionario/BUO_DICCIONARIO.md` de este paquete.

- No mantengas dos glosarios editables.
- Consulta solo el **diccionario base** como referencia para respuestas de BUO. Está marcado como base de piloto pendiente de ratificación funcional.
- Las propuestas automáticas no son reglas aprobadas y no deben incorporarse a prompts de producción.
- Si detectas una denominación nueva o un conflicto, genera una propuesta estructurada (ver `integraciones/PROMPT_EXTRACTOR_DICCIONARIO.md`).
- Si puedes modificar archivos del repositorio y la tarea lo permite, añade la propuesta con `scripts/glossary_ingest.py` sin editar las definiciones vigentes.
- No ingreses números de identidad, nombres personales privados, informes individuales ni otros datos sensibles.

Consulta `diccionario/PROCESO_DE_ACTUALIZACION.md` para el ciclo completo, la validación y los comandos.
