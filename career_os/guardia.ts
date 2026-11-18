// Guardián de escrituras para las corridas de Claude (hook PreToolUse).
// Lee el evento por stdin; sale con 2 (bloquea) si Write/Edit/NotebookEdit apunta fuera de lo permitido.
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const ESCRIBEN = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/** Ruta real: resuelve enlaces simbólicos del ancestro existente más cercano. */
function real(p: string): string {
  let actual = resolve(p);
  const resto: string[] = [];
  while (!existsSync(actual) && dirname(actual) !== actual) { resto.unshift(actual.slice(dirname(actual).length + 1)); actual = dirname(actual); }
  return join(realpathSync(actual), ...resto);
}
const dentro = (f: string, base: string) => f === base || f.startsWith(base + sep);

const LECTURA = new Set(["Read", "Glob", "Grep", "Skill", "TodoWrite", "ToolSearch"]);
const COMPOSIO = new Set(["mcp__composio__COMPOSIO_SEARCH_TOOLS", "mcp__composio__COMPOSIO_MULTI_EXECUTE_TOOL", "mcp__composio__COMPOSIO_GET_TOOL_SCHEMAS"]);
const SIN_METACARACTERES = /^[^;&|`$<>\n\\]*$/;
const DOCS = "node 05_Busqueda_Empleo/07_Skills/empleo-armar-postulacion/build_docs.js ";

/** Política completa de herramientas por tipo de corrida (las corridas usan bypassPermissions + este hook). */
export function decidir(evento: { tool_name?: string; tool_input?: Record<string, any> }, env: Record<string, string | undefined>): { permitir: boolean; motivo?: string } {
  const nombre = evento.tool_name ?? "";
  const tipo = env.CAREER_OS_RUN_TIPO ?? "";
  if (LECTURA.has(nombre)) return { permitir: true };
  if (nombre === "Bash") {
    const c = String(evento.tool_input?.command ?? "").trim();
    if (!SIN_METACARACTERES.test(c)) return { permitir: false, motivo: "Corre cada comando solo, sin cd, &&, ;, |, $() ni redirecciones" };
    if (c.startsWith("bun run tracker ")) return { permitir: true };
    if (c.startsWith(DOCS) && ["armar", "chat"].includes(tipo)) return { permitir: true };
    return { permitir: false, motivo: "Solo se permiten `bun run tracker …` y build_docs.js; explora con Read, Glob y Grep" };
  }
  if (COMPOSIO.has(nombre)) return ["borrador", "enviar"].includes(tipo) ? { permitir: true } : { permitir: false, motivo: `La corrida ${tipo} no usa el correo` };
  // En este equipo WebFetch se hace a través del agente "web-fetch" (solo lectura de páginas).
  if (nombre === "Agent" || nombre === "Task") {
    return tipo === "armar" && evento.tool_input?.subagent_type === "web-fetch" ? { permitir: true } : { permitir: false, motivo: "Solo la corrida armar puede usar el agente web-fetch" };
  }
  if (nombre === "WebFetch" || nombre === "WebSearch") return tipo === "armar" ? { permitir: true } : { permitir: false, motivo: "Solo la corrida armar consulta la web" };
  if (!ESCRIBEN.has(nombre)) return { permitir: false, motivo: `Herramienta no permitida: ${nombre}` };
  const ruta = evento.tool_input?.file_path ?? evento.tool_input?.notebook_path;
  if (typeof ruta !== "string" || !ruta) return { permitir: false, motivo: "Escritura sin ruta" };
  const datos = real(env.CAREER_OS_DATA ?? join(import.meta.dir, "..", "05_Busqueda_Empleo"));
  const f = real(ruta);
  const post = join(datos, "04_Postulaciones");
  if (tipo === "aplicar" && env.CAREER_OS_DESTINO && f === real(join(datos, env.CAREER_OS_DESTINO))) return { permitir: true };
  if (!["armar", "chat", "aprendizajes", "aplicar"].includes(tipo)) return { permitir: false, motivo: `La corrida ${tipo || "desconocida"} no escribe archivos` };
  if (!dentro(f, post)) return { permitir: false, motivo: "Solo puedes escribir dentro de 05_Busqueda_Empleo/04_Postulaciones" };
  if (f.split(sep).includes("aprobado")) return { permitir: false, motivo: "Las copias aprobadas no se editan" };
  return { permitir: true };
}

if (import.meta.main) {
  try {
    const evento = JSON.parse(await new Response(Bun.stdin.stream()).text());
    const r = decidir(evento, process.env as Record<string, string>);
    if (!r.permitir) { console.error(`Bloqueado por Career OS: ${r.motivo}`); process.exit(2); }
  } catch (e: any) {
    console.error(`Bloqueado por Career OS: no pude validar la escritura (${e?.message})`);
    process.exit(2);
  }
}
