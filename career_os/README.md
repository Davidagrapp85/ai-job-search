# Career OS

Escritor único del tracker de postulaciones, dashboard local y agente de correo.
Diseño: `docs/superpowers/specs/2026-11-18-fase1-tracker-dashboard-design.md`.

- Datos: `CAREER_OS_DATA` (por defecto `<repo>/05_Busqueda_Empleo`, ignorado por git).
- Dashboard: `bun run dashboard:start` → `http://127.0.0.1:4173` (puerto: `CAREER_OS_PORT`).
- Tracker por línea de comandos: `bun run tracker --help`.
- Pruebas: `bun run test:career`.

Nadie edita `postulaciones.csv` a mano: todo cambio pasa por `tracker.ts` y queda en `eventos.jsonl`.
