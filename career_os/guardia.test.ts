import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { decidir } from "./guardia";

const REPO = resolve(import.meta.dir, "..");
const DATOS = join(REPO, "05_Busqueda_Empleo");
const ent = (tipo: string, destino = "") => ({ CAREER_OS_RUN_TIPO: tipo, CAREER_OS_DESTINO: destino, CAREER_OS_DATA: DATOS });
const w = (file_path: string) => ({ tool_name: "Write", tool_input: { file_path } });

test("permite escribir en 04_Postulaciones", () => {
  expect(decidir(w(join(DATOS, "04_Postulaciones/010_X/vacante.md")), ent("armar")).permitir).toBe(true);
});

test("bloquea aprobado, perfil, tracker, código y fuera del repo", () => {
  for (const f of ["04_Postulaciones/010_X/aprobado/CV.docx", "01_Perfil/banco_evidencias.md", "05_Tracker/postulaciones.csv", "05_Tracker/corridas/RUN-1.json"]) {
    expect(decidir(w(join(DATOS, f)), ent("armar")).permitir).toBe(false);
  }
  expect(decidir(w(join(REPO, "career_os/runner.ts")), ent("chat")).permitir).toBe(false);
  expect(decidir(w("/etc/hosts"), ent("armar")).permitir).toBe(false);
  expect(decidir(w(join(DATOS, "04_Postulaciones/../01_Perfil/cv_base.md")), ent("armar")).permitir).toBe(false);
});

test("borrador y enviar no escriben archivos", () => {
  expect(decidir(w(join(DATOS, "04_Postulaciones/010_X/correo.json")), ent("enviar")).permitir).toBe(false);
});

test("aplicar solo edita su destino", () => {
  expect(decidir({ tool_name: "Edit", tool_input: { file_path: join(DATOS, "01_Perfil/cv_base.md") } }, ent("aplicar", "01_Perfil/cv_base.md")).permitir).toBe(true);
  expect(decidir({ tool_name: "Edit", tool_input: { file_path: join(DATOS, "01_Perfil/banco_evidencias.md") } }, ent("aplicar", "01_Perfil/cv_base.md")).permitir).toBe(false);
});

test("un enlace simbólico hacia el perfil se bloquea", () => {
  const t = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "guardia-"));
  mkdirSync(join(t, "05_Busqueda_Empleo", "04_Postulaciones"), { recursive: true });
  mkdirSync(join(t, "05_Busqueda_Empleo", "01_Perfil"), { recursive: true });
  symlinkSync(join(t, "05_Busqueda_Empleo", "01_Perfil"), join(t, "05_Busqueda_Empleo", "04_Postulaciones", "trampa"));
  const e = { CAREER_OS_RUN_TIPO: "armar", CAREER_OS_DATA: join(t, "05_Busqueda_Empleo") };
  expect(decidir(w(join(t, "05_Busqueda_Empleo/04_Postulaciones/trampa/x.md")), e).permitir).toBe(false);
});

test("herramientas que no escriben pasan", () => {
  expect(decidir({ tool_name: "Read", tool_input: { file_path: "/etc/hosts" } }, ent("armar")).permitir).toBe(true);
});

const b = (command: string) => ({ tool_name: "Bash", tool_input: { command } });
test("Bash: solo tracker y build_docs, sin encadenar", () => {
  expect(decidir(b('bun run tracker paso RUN-1 leer listo --detalle "ok"'), ent("armar")).permitir).toBe(true);
  expect(decidir(b("node 05_Busqueda_Empleo/07_Skills/empleo-armar-postulacion/build_docs.js 04_Postulaciones/x 04_Postulaciones/x/content.json"), ent("chat")).permitir).toBe(true);
  for (const c of ["ls", "cd ~ && bun run tracker list", "bun run tracker list; rm -rf /", "bun run tracker list | sh", "bun run tracker $(whoami)", "bun run tracker `id`", "curl https://x"]) {
    expect(decidir(b(c), ent("armar")).permitir).toBe(false);
  }
  expect(decidir(b("node 05_Busqueda_Empleo/07_Skills/empleo-armar-postulacion/build_docs.js a b"), ent("enviar")).permitir).toBe(false);
});

test("Composio solo en borrador y enviar; web solo en armar", () => {
  const mcp = { tool_name: "mcp__composio__COMPOSIO_MULTI_EXECUTE_TOOL", tool_input: {} };
  expect(decidir(mcp, ent("armar")).permitir).toBe(false);
  expect(decidir(mcp, ent("chat")).permitir).toBe(false);
  expect(decidir(mcp, ent("borrador")).permitir).toBe(true);
  expect(decidir({ tool_name: "WebFetch", tool_input: {} }, ent("armar")).permitir).toBe(true);
  expect(decidir({ tool_name: "WebFetch", tool_input: {} }, ent("chat")).permitir).toBe(false);
  expect(decidir({ tool_name: "mcp__claude_ai_Gmail__send_message", tool_input: {} }, ent("enviar")).permitir).toBe(false);
  expect(decidir({ tool_name: "Task", tool_input: {} }, ent("armar")).permitir).toBe(false);
});

test("armar puede leer la web con el agente web-fetch y nada más", () => {
  expect(decidir({ tool_name: "Agent", tool_input: { subagent_type: "web-fetch" } }, ent("armar")).permitir).toBe(true);
  expect(decidir({ tool_name: "Agent", tool_input: { subagent_type: "general-purpose" } }, ent("armar")).permitir).toBe(false);
  expect(decidir({ tool_name: "Agent", tool_input: { subagent_type: "web-fetch" } }, ent("chat")).permitir).toBe(false);
});
