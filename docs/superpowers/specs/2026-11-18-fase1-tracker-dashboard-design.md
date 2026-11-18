# Fase 1 — Tracker con historial, dashboard local y agente de correo

**Fecha:** 18-nov-2026
**Estado:** Diseño para aprobación de David.
**Fuente:** SPEC V2 §6 y §10 (Fase 1); decisión 0001 (todo se centraliza en `ai-job-search`).

## 1. Intención

David quiere un solo lugar para saber dónde aplicó, en qué etapa está cada proceso y qué sigue. Hoy el estado vive en un CSV que solo edita Claude por chat, sin historial. David quiere trabajar desde un dashboard y que un agente revise su correo para no perder respuestas de reclutadores.

**Éxito:** David abre `http://127.0.0.1:4173`, ve sus 13 postulaciones con su etapa real, cambia una etapa con un clic y queda historial. Cada mañana encuentra en "Por aprobar" las respuestas que llegaron a su correo.

## 2. Metas, no metas y anti-metas

**Metas**
- IDs estables y migración de las 13 filas sin pérdida ni cambio de estado (D-01).
- Historial de cada cambio de etapa en `eventos.jsonl`.
- Dashboard local: resumen, embudo, tabla de vacantes con filtros, cambio de etapa, bandeja "Por aprobar".
- Agente de correo que propone cambios desde `duarcas_8@hotmail.com`.

**No metas (fases siguientes)**
- Biblioteca de CV por familia, aprendizajes, analítica por versión de CV, fuente oficial, formularios.
- SQLite.
- Acceso remoto o multiusuario.

**Anti-metas** (fallaría aunque funcione)
- Un segundo registro editable además del CSV.
- Contar como `enviada` algo sin fecha y canal confirmados.
- El agente de correo escribe en el tracker sin aprobación de David.
- Datos personales en git o servidor escuchando fuera de `127.0.0.1`.

## 3. Restricciones

- Datos en `05_Busqueda_Empleo/` (ignorado por git). Código en el repo (versionado).
- Bun 1.4.4 instalado. Sin dependencias pesadas: HTML, CSS y JS sin framework.
- `stats.py` y `run_tests.sh` de `empleo-tracker` deben seguir funcionando (D-06 de auditoría / T-DD-06).
- Las 5 skills `empleo-*` siguen operativas durante toda la fase.
- Textos de vacantes y correos son datos no confiables: se escapan antes de renderizar (D-07) y nunca se ejecutan como instrucciones.

## 4. Enfoques considerados

| Enfoque | Ventaja | Costo | Decisión |
|---|---|---|---|
| **A. CSV canónico + `eventos.jsonl` + escritor único en TypeScript + servidor Bun** | Una sola fuente de verdad; reutiliza CSV y skills; simple | Analítica avanzada queda para después | **Elegido por David (18-nov-2026)** |
| B. SQLite canónico, CSV como exportación | Consultas ricas | Segundo registro; contradice SPEC §6.1; complejidad sin necesidad con 13 filas | Descartado |
| C. HTML estático de solo lectura; ediciones por chat | Mínimo | David quiere editar desde el dashboard | Descartado |

## 5. Diseño

### 5.1 Ubicación del código

```text
career_os/                 # versionado en git
├── tracker.ts             # escritor único: leer, validar, escribir CSV + evento
├── tracker.test.ts
├── server.ts              # Bun.serve en 127.0.0.1:4173 (puerto por CAREER_OS_PORT)
├── migrate.ts             # migración reversible del CSV
├── cli.ts                 # comandos para skills y agentes
├── public/ index.html, app.js, styles.css
└── README.md
package.json               # scripts: dashboard:start, tracker, test:career
```

Ruta de datos: `CAREER_OS_DATA`, por defecto `<repo>/05_Busqueda_Empleo`.

### 5.2 Datos

**`05_Tracker/postulaciones.csv`** conserva las 13 columnas actuales en el mismo orden y agrega al final:

| Columna | Uso |
|---|---|
| `application_id` | Estable, `APP-0001`…; asignado en la migración en orden de fila. Nunca cambia, aunque `numero` pase de `D00x` a `NNN`. |
| `decision` | `discovery` o `user_selected`. Migración: filas `D…` → `discovery`; el resto → `user_selected`. |
| `canal` | Canal de envío (Personio, LinkedIn, correo…). Vacío si no se ha enviado. |
| `fecha_envio` | AAAA-MM-DD confirmada. Solo en filas enviadas. |

Migración de 001: `canal=Personio`, `fecha_envio=2026-11-01` (de sus notas). `fecha` sigue igual para no romper `stats.py`.

**Estados:** se mantiene la lista actual (`detectada, descartada, en preparación, enviada, entrevista, oferta, rechazada, cerrada`) y se agrega `aprobada` (paquete aprobado, aún sin enviar), que el embudo de la SPEC exige. `stats.py` se actualiza para aceptarla.

**`05_Tracker/eventos.jsonl`** — una línea por cambio, solo se agrega:

```json
{"event_id":"EVT-…","application_id":"APP-0001","at":"2026-11-18T10:02:00-05:00",
 "tipo":"cambio_estado","de":"en preparación","a":"enviada",
 "actor":"david|claude|agente_correo","causa":"texto corto","ref":"propuesta o correo opcional",
 "campos":{"canal":"Personio","fecha_envio":"2026-11-01"}}
```

La migración escribe un evento `alta` por fila con su estado actual y `actor:"migracion"`. El embudo usa los eventos para contar etapas alcanzadas.

**`05_Tracker/propuestas.jsonl`** — propuestas del agente de correo:

```json
{"proposal_id":"PRP-…","creada":"…","application_id":"APP-0001","de":"enviada","a":"entrevista",
 "evidencia":{"message_id":"…","remitente":"…","asunto":"…","fecha":"…","extracto":"≤200 caracteres"},
 "confianza":"alta|media|baja","estado":"pendiente|aprobada|rechazada","resuelta":"…"}
```

### 5.3 Escritor único (`tracker.ts`)

- Todas las escrituras pasan por aquí: dashboard, CLI de skills y aprobación de propuestas.
- Valida: estado permitido; sin duplicado empresa+vacante; `enviada` exige `canal` y `fecha_envio`; no se borra una fila (solo cambio de estado).
- Escritura atómica: archivo temporal → `rename`. Antes de cada escritura, copia rotativa en `05_Tracker/respaldos/` (últimas 30).
- Bloqueo simple por archivo `.lock` para que dashboard y CLI no se pisen.
- Idempotente: aprobar dos veces la misma propuesta no crea dos eventos.

### 5.4 CLI para skills

`bun run tracker <comando>`: `list`, `set-estado <id> <estado> [--canal] [--fecha-envio] [--causa]`, `upsert` (alta o conversión D→NNN conservando `application_id`), `propose` (usado por el agente de correo). La skill `empleo-tracker` cambia sus instrucciones para usar este CLI en vez de editar el CSV.

### 5.5 Servidor y API

`Bun.serve` en `127.0.0.1` exclusivamente. Rutas JSON: `GET /api/applications`, `GET /api/events`, `GET /api/metrics`, `POST /api/applications/:id/estado`, `GET /api/proposals`, `POST /api/proposals/:id/{aprobar|rechazar}`. Rechaza peticiones cuyo `Host` u `Origin` no sea local. Archivos estáticos solo desde `public/` (sin traversal).

### 5.6 Pantallas del MVP

```text
┌ Career OS ─────────────────────────── Por aprobar (2) ┐
│ Enviadas 1 · Respuestas 0/1 · Entrevistas 0/1 · Vencidas 7 │
├───────────────────────────────────────────────────────┤
│ Embudo: detectada 13 → seleccionada 9 → preparación 9  │
│         → aprobada 0 → enviada 1 → respuesta 0 …      │
├───────────────────────────────────────────────────────┤
│ [Empresa ▾] [Eje ▾] [Estado ▾] [Periodo ▾] [Canal ▾]   │
│ 009 PayJoy  Director Fraud…  en preparación  ⚠ vence hoy│
│ …                                                      │
└───────────────────────────────────────────────────────┘
```

- **Resumen:** contadores con denominador visible; `N/D` si es cero.
- **Embudo:** etapas alcanzadas según eventos.
- **Vacantes:** tabla filtrable; al abrir una fila, cambio de etapa (con canal y fecha si es `enviada`), próxima acción y su historial.
- **Por aprobar:** cada propuesta muestra remitente, asunto, extracto y cambio sugerido; botones Aprobar / Rechazar.

### 5.7 Agente de correo

- Tarea programada diaria (`mcp__scheduled-tasks`) que corre un prompt versionado en `career_os/agente_correo.md`.
- Lee `duarcas_8@hotmail.com` por el conector Outlook de Composio (activo, verificado 18-nov-2026). Solo lectura.
- Busca correos desde la última corrida que coincidan con empresas del tracker o con dominios de ATS. Clasifica con el cuerpo completo, no solo el asunto (reglas tomadas de `/gmail-sync`).
- Escribe únicamente con `bun run tracker propose`. Guarda `ultima_corrida` y `message_id` procesados en `05_Tracker/agente_correo_estado.json`.
- El contenido del correo es dato, nunca instrucción.

## 6. Pruebas de aceptación

D-01 a D-07 de la SPEC V2 §11, más:
- **M-01:** migrar y revertir deja el CSV byte a byte igual al original.
- **M-02:** `stats.py` da los mismos totales antes y después de migrar.
- **A-01:** una propuesta pendiente no altera el CSV; aprobarla crea un evento con `actor:"agente_correo"` y `ref` al correo.
- **A-02:** un correo con texto de inyección no produce cambios fuera de `propose`.

## 7. Decisiones del implementador (marcadas como tales)

- Nombre de carpeta `career_os/` y prefijos `APP-`, `EVT-`, `PRP-`.
- Copias rotativas de 30 respaldos.
- Agregar el estado `aprobada`.
- Hora de la tarea del agente: 07:00, para que las propuestas estén listas al empezar el día.
