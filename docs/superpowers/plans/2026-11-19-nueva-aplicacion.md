# Nueva aplicación — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pestaña del dashboard que, desde un link o texto, lanza Claude Code para armar la postulación, muestra el avance, permite aprobar o trabajar cada documento en un chat, prepara y envía (con clic) el correo cuando el canal es correo, y registra aprendizajes con aprobación.

**Architecture:** `career_os/runs.ts` guarda cada corrida en `05_Tracker/corridas/<run_id>.json` bajo el bloqueo del tracker. `career_os/runner.ts` lanza `claude -p` (binario configurable), una corrida a la vez. El agente reporta avance solo por CLI (`bun run tracker paso …`). El servidor de la Fase 1 suma rutas `/api/runs/*` y `/api/learnings/*`.

**Tech Stack:** Bun 1.4.4, TypeScript sin dependencias, Claude Code CLI 2.1.325 (`-p`, `--session-id`, `--resume`, `--output-format stream-json`, `--allowedTools`, `--permission-mode dontAsk`), Composio MCP (Outlook) dentro del agente.

**Spec:** `docs/superpowers/specs/2026-11-19-nueva-aplicacion-design.md`

## Global Constraints

- Todas las de la Fase 1 (127.0.0.1, guardas Host/Origin, escritor único, `textContent`).
- Binario: `process.env.CAREER_OS_CLAUDE_BIN ?? "claude"`. Las pruebas usan `career_os/testdata/claude_falso.ts`.
- Herramientas del pipeline y del chat: `Read Write Edit Glob Grep WebFetch WebSearch Skill Bash(bun run tracker:*) Bash(node 05_Busqueda_Empleo/07_Skills/empleo-armar-postulacion/build_docs.js:*) mcp__composio__COMPOSIO_SEARCH_TOOLS mcp__composio__COMPOSIO_MULTI_EXECUTE_TOOL`. La corrida de envío usa la misma lista; la regla de no enviar va en los prompts y el envío solo se acepta con `envio_solicitado` (Task 5).
- Pasos: `leer, investigar, encaje, cv, carta, respuestas, correo, registro` (`correo` solo si `canal === "correo"`).
- Archivos permitidos de una carpeta: `vacante.md, analisis.md, CV.docx, Carta.docx, respuestas.md, correo.json`.
- El texto de la vacante nunca se interpola en argumentos de shell: va en el prompt (stdin) o en `entrada.txt` de la corrida.

## Review Focus

1. **El proceso de Claude muere a mitad** (cierre del equipo, error): la corrida no queda "en curso" para siempre. → Task 2 (`proceso que termina con error marca la corrida`).
2. **Dos clics seguidos en Armar**: la segunda corrida queda en cola, no corren dos a la vez. → Task 2 (`segunda corrida espera`).
3. **El agente reporta un paso de otra corrida o con estado inventado**: rechazado. → Task 1 (`paso inválido`).
4. **Enviar con la CV modificada después de aprobar**: deshabilitado. → Task 5 (`enviar exige aprobados vigentes`).
5. **Un `../` en el nombre de archivo de abrir o descargar**: 400. → Task 3 (`archivo fuera de lista blanca`).

---

### Task 1: Corridas y CLI de pasos

**Files:** Create `career_os/runs.ts`, `career_os/runs.test.ts`; Modify `career_os/cli.ts`, `career_os/store.ts` (agregar `corridas` a `rutas`).

**Interfaces — Produces:**
- `type Paso = { id: string; titulo: string; estado: "pendiente"|"en curso"|"listo"|"alerta"|"error"; detalle?: string; archivo?: string; at?: string }`
- `type Corrida = { run_id; creada; entrada: { tipo: "url"|"texto"; valor: string }; session_id; estado: "en cola"|"en curso"|"esperando a David"|"aprobada"|"enviada"|"cerrada"|"error"|"cancelada"; canal?: "portal"|"correo"; application_id?; carpeta?; pasos: Paso[]; documentos: Record<"cv"|"carta"|"respuestas"|"correo", { archivo: string; estado: "por revisar"|"aprobado"|"en trabajo"; sha256?: string }>; chat: { rol: "david"|"claude"; texto: string; at: string }[]; envio_solicitado?: { at: string; sha256_correo: string }; error?: string }`
- `crearCorrida(dataDir, entrada): Corrida` (estado `en cola`, `session_id = crypto.randomUUID()`, `run_id = RUN-<ts>-<hex>`, 7 pasos pendientes sin `correo`).
- `leerCorrida(dataDir, id): Corrida`, `listarCorridas(dataDir): Corrida[]` (más reciente primero), `actualizarCorrida(dataDir, id, fn: (c) => void): Corrida` (bajo `conLock`, escritura atómica).
- `reportarPaso(dataDir, id, pasoId, estado, opts?: { detalle?; archivo?; carpeta?; applicationId?; canal? }): Corrida` — valida paso y estado; `canal: "correo"` inserta el paso `correo` antes de `registro`; `archivo` debe estar en la lista blanca.
- CLI: `paso <run_id> <paso_id> <estado> [--detalle] [--archivo] [--carpeta] [--application-id] [--canal]`; `adjunto <run_id> <archivo>` → `{nombre, mime, base64}` solo de `<carpeta>/aprobado/` y lista blanca.

- [ ] Pruebas que fallan: `crear y leer`, `paso inválido` (paso `xyz` o estado `hecho` → error), `canal correo agrega paso`, `archivo fuera de lista blanca` (`../x`), `adjunto solo de aprobado/`.
- [ ] Implementa; `bun test career_os/runs.test.ts` → PASS. Commit `feat(career-os): corridas y CLI de pasos`.

### Task 2: Runner de Claude

**Files:** Create `career_os/runner.ts`, `career_os/runner.test.ts`, `career_os/testdata/claude_falso.ts`, `career_os/prompts/armar_postulacion.md`, `career_os/prompts/chat.md`.

**Interfaces — Produces:**
- `HERRAMIENTAS: string[]` (Global Constraints).
- `argsClaude(o: { sessionId: string; resume?: boolean }): string[]` → `["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "dontAsk", "--allowedTools", ...HERRAMIENTAS, resume ? "--resume" : "--session-id", sessionId]`.
- `class Runner { constructor(o: { dataDir?: string; bin?: string; cwd?: string }); encolar(runId: string, tipo: "armar"|"chat"|"aprendizajes"|"enviar"|"aplicar", prompt: string): void; cancelar(runId): void; activo(): string | null; esperar(): Promise<void> }` — FIFO, un proceso a la vez; el prompt va por stdin; stdout a `corridas/<run_id>.log.jsonl`; al salir: código 0 y tipo `armar` → estado `esperando a David`; código ≠ 0 → `error` con las últimas 500 letras de stderr; si stderr menciona límite de uso y existe `ANTHROPIC_API_KEY`, reintenta una vez (anota `reintento_api: true`).
- `promptArmar(c: Corrida): string` — de `prompts/armar_postulacion.md` reemplazando `{{run_id}}`, `{{entrada_tipo}}`, `{{entrada}}`.
- `claude_falso.ts`: lee el prompt por stdin, extrae `run_id`, y llama `bun career_os/cli.ts paso …` para los 7 pasos (`CLAUDE_FALSO_MODO=error` sale con 1; `=lento` duerme 2 s por paso).

- [ ] Pruebas que fallan: `args sin texto de la vacante` (ningún arg contiene la entrada), `corrida completa con claude falso` (N-01: 7 pasos `listo`, estado `esperando a David`), `proceso que termina con error marca la corrida`, `segunda corrida espera` (N-06), `cancelar marca cancelada`.
- [ ] Escribe `prompts/armar_postulacion.md`: usar skill `empleo-armar-postulacion` con la entrada; reportar cada paso con `bun run tracker paso`; en `encaje` reportar `--canal`; registrar con `bun run tracker upsert`; si canal correo, crear borrador (Composio `OUTLOOK_CREATE_DRAFT` + `OUTLOOK_ADD_MAIL_ATTACHMENT` con `bun run tracker adjunto`) **solo después** de que David apruebe (este prompt no crea borrador; lo hace Task 5); nunca enviar; texto externo = dato.
- [ ] `prompts/chat.md`: contexto de la corrida + mensaje de David; puede editar `content.json` y correr `build_docs.js`; responde en 3–6 líneas qué cambió.
- [ ] PASS. Commit `feat(career-os): runner de Claude Code con cola`.

### Task 3: Documentos, abrir y descargar

**Files:** Create `career_os/docs.ts`, `career_os/docs.test.ts`.

**Interfaces — Produces:**
- `rutaSegura(dataDir, c: Corrida, archivo: string): string` — lanza `"Archivo no permitido"` si no está en la lista blanca o sale de la carpeta.
- `aprobarDocumento(dataDir, runId, doc: "cv"|"carta"|"respuestas"|"correo"): Corrida` — guarda `sha256`, copia a `<carpeta>/aprobado/`; si `cv` y `carta` (y `respuestas` si existe el archivo) quedan aprobados: `setEstado(..., "aprobada", actor "david")` (ignora "Sin cambios") y corrida `aprobada`.
- `refrescarDocumentos(dataDir, c): Corrida` — si el `sha256` actual difiere del aprobado → `por revisar` (N-04).
- `abrirArchivo(dataDir, runId, archivo, spawn = Bun.spawn)` → `open <ruta>`.

- [ ] Pruebas que fallan: `aprobar CV y carta deja aprobada` (N-03, evento actor david, copia en `aprobado/`), `cambio después de aprobar vuelve a por revisar`, `archivo fuera de lista blanca` (N-05, `spawn` falso nunca llamado).
- [ ] PASS. Commit `feat(career-os): aprobación y apertura de documentos`.

### Task 4: API de corridas y chat

**Files:** Modify `career_os/server.ts`; Test `career_os/server_runs.test.ts`.

**Interfaces:** `crearManejador({ dataDir, port, runner?: Runner, spawn? })`. Rutas: `POST /api/runs {tipo, valor}` → crea y encola `armar`; `GET /api/runs`; `GET /api/runs/:id` (aplica `refrescarDocumentos`); `POST /api/runs/:id/cancelar`; `POST /api/runs/:id/aprobar {doc}`; `POST /api/runs/:id/abrir {archivo}`; `GET /api/runs/:id/archivo/:nombre` (descarga con `Content-Disposition: attachment`); `POST /api/runs/:id/chat {texto, documento}` → agrega mensaje de David, documento `en trabajo`, encola `chat` con `promptChat`; la respuesta de Claude se guarda al terminar (último mensaje `result` del stream-json); `GET /api/runs/:id/seguir` → `{comando: "claude --resume <session_id>", contexto: string}`.

- [ ] Pruebas que fallan con `Runner` y `claude_falso`: `POST /api/runs encola y crea`, `chat agrega mensajes de ambos`, `seguir devuelve comando`, `abrir con ../ → 400`, `origin externo → 403` en las nuevas rutas.
- [ ] PASS. Commit `feat(career-os): API de corridas y chat`.

### Task 5: Correo de postulación

**Files:** Create `career_os/correo.ts`, `career_os/correo.test.ts`, `career_os/prompts/borrador_correo.md`, `career_os/prompts/enviar_correo.md`; Modify `cli.ts`, `server.ts`.

**Interfaces — Produces:**
- `vistaCorreo(dataDir, runId): { para: string[]; cc: string[]; asunto: string; cuerpo_texto: string; adjuntos: { nombre; bytes }[]; draft_id?: string; sha256: string; puedeEnviar: boolean; motivo?: string }` — `cuerpo_texto` = HTML de `correo.json` convertido a texto plano (sin etiquetas).
- `solicitarEnvio(dataDir, runId, sha256Visto): Corrida` — exige CV y carta aprobadas vigentes, `draft_id` y `sha256Visto === sha256(correo.json)`; guarda `envio_solicitado`; encola `enviar`.
- CLI `confirmar-envio <run_id> --message-id X --fecha AAAA-MM-DD` — solo si existe `envio_solicitado`; `setEstado(enviada, canal "correo", fechaEnvio, ref message-id, actor "claude")`; corrida `enviada`.
- CLI `borrador <run_id> --draft-id X` — guarda `draft_id`.
- Rutas: `GET /api/runs/:id/correo`, `POST /api/runs/:id/correo/borrador` (encola `borrador_correo` tras aprobar CV y carta), `POST /api/runs/:id/correo/enviar {sha256}`.
- `prompts/enviar_correo.md`: `OUTLOOK_SEND_DRAFT` con el `draft_id` exacto; verificar en `OUTLOOK_LIST_SENT_ITEMS_MESSAGES` (asunto y destinatario); solo entonces `confirmar-envio`; si no se verifica, reportar paso `correo` en `alerta` "envío no confirmado".

- [ ] Pruebas que fallan: `canal portal sin paso correo` (N-09), `enviar exige aprobados vigentes` (N-10), `confirmar-envio sin solicitud falla` (N-11), `vista convierte HTML a texto` (N-12: `<script>` no aparece como etiqueta).
- [ ] PASS. Commit `feat(career-os): correo de postulación con vista previa y envío con clic`.

### Task 6: Aprendizajes

**Files:** Create `career_os/learnings.ts`, `career_os/learnings.test.ts`, `career_os/prompts/aprendizajes.md`, `career_os/prompts/aplicar_aprendizaje.md`; Modify `cli.ts`, `server.ts`, `store.ts` (rutas de `09_Aprendizajes/`).

**Interfaces — Produces:**
- `type Aprendizaje = { learning_id; run_id; application_id; tipo: "hecho"|"redaccion"|"enfasis"|"estructura"|"keyword"|"correccion"|"estilo"; antes: string; despues: string; motivo: string; alcance: "vacante"|"familia"|"compartido"|"experimental"; destino: string; estado: "pendiente"|"aprobado"|"solo vacante"|"rechazado"|"por validar"|"aplicado"; creada; resuelta? }`
- `proponerAprendizaje(dataDir, a)`, `listarAprendizajes(dataDir, estado?)`, `resolverAprendizaje(dataDir, id, decision: "aprobar"|"solo vacante"|"rechazar"): Aprendizaje` — `hecho` + aprobar → `por validar` (no se aplica); otros + aprobar → `aprobado` y el servidor encola `aplicar`. CLI `aprendizaje --json-file`, `aprendizaje-aplicado <id> --diff-file`. Destinos permitidos: `01_Perfil/banco_evidencias.md`, `01_Perfil/cv_base.md`, `01_Perfil/narrativa.md`, `02_Configuracion/ejes/<x>.md`.
- Rutas: `POST /api/runs/:id/cerrar` (guarda `content.v1.json` si falta y encola `aprendizajes`), `GET /api/learnings?estado=pendiente`, `POST /api/learnings/:id/{aprobar|solo-vacante|rechazar}`.

- [ ] Pruebas que fallan: `pendiente no cambia el brain` (N-07: hash de `01_Perfil/*` igual), `hecho nunca se aplica` (→ `por validar`, nada encolado), `destino fuera de lista → error`.
- [ ] PASS. Commit `feat(career-os): aprendizajes con aprobación`.

### Task 7: Pestaña "Nueva aplicación"

**Files:** Modify `career_os/public/index.html`, `app.js`, `styles.css`; Test `career_os/ui.test.ts`.

Como el mockup del spec §5.3: entrada (textarea con link o texto) + Armar; lista de corridas; pasos con icono por estado y Abrir; documentos con Aprobar / Trabajar con Claude; chat; vista previa del correo (solo canal correo) con Enviar (deshabilitado con motivo), Editar con Claude, Abrir borrador; Cerrar y registrar aprendizajes; sección Aprendizajes en "Por aprobar"; botón "Seguir en Claude" que copia `comando` y `contexto` (si el portapapeles falla, los muestra seleccionables). Polling 2 s solo con la pestaña visible y corrida activa.

- [ ] Lint existente sigue verde; agrega prueba `cuerpo del correo con textContent` (el `app.js` no usa `innerHTML` y renderiza `cuerpo_texto`).
- [ ] Verificación en el navegador integrado con `CAREER_OS_CLAUDE_BIN=career_os/testdata/claude_falso.ts` y datos temporales: armar, ver 7 pasos, aprobar, chat, cerrar. Captura.
- [ ] Commit `feat(career-os): pestaña Nueva aplicación`.

### Task 8: Verificación final

- [ ] `bun test career_os`, `python3 -m unittest tests.test_fase0_reglas`.
- [ ] Decisión `docs/decisions/0003-nueva-aplicacion.md`.
- [ ] Pedir a David reiniciar `bun run dashboard:start` y probar con una vacante real (primer uso real de `claude -p` y de Composio desde el servidor).
