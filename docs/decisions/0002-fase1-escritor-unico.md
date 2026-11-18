# 0002 — Fase 1: escritor único, estado `aprobada` y agente que solo propone

**Fecha:** 18-nov-2026
**Estado:** Implementada en la rama `career-os`.
**Diseño:** `docs/superpowers/specs/2026-11-18-fase1-tracker-dashboard-design.md`.

## Decisiones

- `postulaciones.csv` sigue siendo el único registro. Solo `career_os/tracker.ts` lo escribe (dashboard, CLI y agente). Cada cambio queda en `05_Tracker/eventos.jsonl`.
- Columnas nuevas al final: `application_id` (estable), `decision`, `canal`, `fecha_envio`. `enviada` exige canal y fecha.
- Estado nuevo `aprobada`: paquete listo, aún sin enviar.
- El agente de correo lee `duarcas_8@hotmail.com` en solo lectura y escribe solo propuestas (`propuestas.jsonl`). David aprueba en el dashboard.
- Migración del 18-nov-2026: 14 filas, estados sin cambios, `stats.py` con los mismos totales. Copia previa en `05_Tracker/postulaciones.pre_fase1.csv` y respaldo completo en `99_Archivo/backup_pre_fase1_2026-11-18.tar.gz`. Reversible con `bun career_os/migrate.ts --revert`.

## Consecuencias

- Las skills que escriben el tracker deben usar `bun run tracker`; editar el CSV a mano rompe la regla de historial.
- El dashboard corre mientras el proceso local esté encendido; no es un servicio en la nube.
