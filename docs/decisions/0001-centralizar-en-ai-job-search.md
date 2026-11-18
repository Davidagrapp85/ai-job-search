# 0001 — Centralizar el sistema de empleo en `ai-job-search`

**Fecha:** 17-nov-2026
**Estado:** Aprobada por David.
**Modifica:** SPEC V2 §2 ("DD_Brain será la fuente de hechos y seguimiento").

## Decisión

- El repo `~/05_ai_job_search` es el único punto de arranque del sistema.
- Los datos de `DD_Brain/01_DD_personal/05_Busqueda_Empleo` se mueven a `05_Busqueda_Empleo/` en la raíz del repo.
- En DD_Brain queda un enlace simbólico a la nueva ruta. Obsidian, las skills `empleo-*` y la tarea diaria conservan sus rutas actuales.
- `05_Busqueda_Empleo/` está en `.gitignore`. Los datos personales no se suben a GitHub.

## Lo que no cambia

- Sigue habiendo un solo tracker canónico: `05_Busqueda_Empleo/05_Tracker/postulaciones.csv`.
- Las reglas de la SPEC V2 §3 siguen vigentes.

## Consecuencias

- El Escritorio parece sincronizado con iCloud. Al salir de `~/Desktop`, los datos pierden esa copia en la nube; iCloud no sigue enlaces simbólicos.
- Los datos no tienen historial en git. Pendiente: definir respaldo versionado local (SPEC V2 §12, auditoría P3.4).
- Las skills `empleo-*` siguen en `05_Busqueda_Empleo/07_Skills` y se pueden editar desde el repo.
