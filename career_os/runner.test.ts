import { expect, test } from "bun:test";
import { join } from "node:path";
import { argsClaude, promptArmar, Runner } from "./runner";
import { crearCorrida, leerCorrida } from "./runs";
import { datosTemporales } from "./testutil";

const FALSO = join(import.meta.dir, "testdata", "claude_falso.ts");
const runner = (d: string, env: Record<string, string> = {}) => new Runner({ dataDir: d, bin: FALSO, env });

test("args sin texto de la vacante", () => {
  const a = argsClaude({ sessionId: "abc" });
  expect(a).toContain("-p");
  expect(a).toContain("--session-id");
  expect(a.join(" ")).not.toContain("Director de Fraude");
  expect(argsClaude({ sessionId: "abc", resume: true })).toContain("--resume");
});

test("corrida completa con claude falso", async () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "Director de Fraude en Acme" });
  const r = runner(d);
  r.encolar(c.run_id, "armar", promptArmar(leerCorrida(d, c.run_id)));
  await r.esperar();
  const f = leerCorrida(d, c.run_id);
  expect(f.pasos.every((p) => p.estado === "listo")).toBe(true);
  expect(f.estado).toBe("esperando a David");
  expect(f.carpeta).toBe("04_Postulaciones/099_Prueba");
});

test("proceso que termina con error marca la corrida", async () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const r = runner(d, { CLAUDE_FALSO_MODO: "error" });
  r.encolar(c.run_id, "armar", promptArmar(c));
  await r.esperar();
  const f = leerCorrida(d, c.run_id);
  expect(f.estado).toBe("error");
  expect(f.error).toContain("fallo simulado");
});

test("segunda corrida espera", async () => {
  const d = datosTemporales();
  const a = crearCorrida(d, { tipo: "texto", valor: "a" });
  const b = crearCorrida(d, { tipo: "texto", valor: "b" });
  const r = runner(d);
  r.encolar(a.run_id, "armar", promptArmar(a));
  r.encolar(b.run_id, "armar", promptArmar(b));
  expect(r.activo()).toBe(a.run_id);
  expect(leerCorrida(d, b.run_id).estado).toBe("en cola");
  await r.esperar();
  expect(leerCorrida(d, b.run_id).estado).toBe("esperando a David");
});

test("cancelar marca cancelada", async () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const r = runner(d, { CLAUDE_FALSO_MODO: "lento" });
  r.encolar(c.run_id, "armar", promptArmar(c));
  await Bun.sleep(300);
  r.cancelar(c.run_id);
  await r.esperar();
  expect(leerCorrida(d, c.run_id).estado).toBe("cancelada");
});

test("límite del plan reintenta con la API una vez", async () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const r = runner(d, { CLAUDE_FALSO_MODO: "limite", ANTHROPIC_API_KEY: "clave-de-prueba" });
  r.encolar(c.run_id, "armar", promptArmar(c));
  await r.esperar();
  const f = leerCorrida(d, c.run_id);
  expect(f.reintento_api).toBe(true);
  expect(f.estado).toBe("esperando a David");
});

test("chat guarda la respuesta de Claude", async () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const r = runner(d);
  r.encolar(c.run_id, "chat", "mensaje de David");
  await r.esperar();
  const f = leerCorrida(d, c.run_id);
  expect(f.chat.at(-1)).toMatchObject({ rol: "claude", texto: "Listo: ajusté el perfil del CV y regeneré CV.docx." });
});

test("al terminar el chat el documento en trabajo vuelve a por revisar", async () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const { actualizarCorrida } = await import("./runs");
  actualizarCorrida(d, c.run_id, (x) => { x.documentos.cv.estado = "en trabajo"; });
  const r = runner(d);
  r.encolar(c.run_id, "chat", "mensaje");
  await r.esperar();
  expect(leerCorrida(d, c.run_id).documentos.cv.estado).toBe("por revisar");
});

test("C1: solo borrador y enviar tienen Composio", () => {
  for (const tipo of ["armar", "chat", "aprendizajes", "aplicar"] as const) {
    expect(argsClaude({ sessionId: "s", tipo, destino: "01_Perfil/cv_base.md" }).join(" ")).not.toContain("composio");
  }
  expect(argsClaude({ sessionId: "s", tipo: "borrador" }).join(" ")).toContain("mcp__composio__COMPOSIO_MULTI_EXECUTE_TOOL");
  expect(argsClaude({ sessionId: "s", tipo: "enviar" }).join(" ")).toContain("mcp__composio__COMPOSIO_MULTI_EXECUTE_TOOL");
});

test("I1: escritura limitada a 04_Postulaciones y brain/corridas/aprobado denegados", () => {
  const a = argsClaude({ sessionId: "s", tipo: "chat" });
  expect(a).not.toContain("Write");
  expect(a).not.toContain("Edit");
  const raiz = "/" + require("node:path").resolve(import.meta.dir, "..");
  expect(a).toContain(`Edit(${raiz}/05_Busqueda_Empleo/04_Postulaciones/**)`);
  expect(a).toContain(`Write(${raiz}/05_Busqueda_Empleo/04_Postulaciones/**)`);
  const deny = a.slice(a.indexOf("--disallowedTools") + 1).join(" ");
  for (const p of ["01_Perfil/**", "05_Tracker/**", "aprobado/**"]) expect(deny).toContain(p);
  const ap = argsClaude({ sessionId: "s", tipo: "aplicar", destino: "01_Perfil/cv_base.md" });
  expect(ap).toContain(`Edit(${raiz}/05_Busqueda_Empleo/01_Perfil/cv_base.md)`);
});

test("I5: un binario inexistente no traba la cola", async () => {
  const d = datosTemporales();
  const a = crearCorrida(d, { tipo: "texto", valor: "a" });
  const b = crearCorrida(d, { tipo: "texto", valor: "b" });
  const r = new Runner({ dataDir: d, bin: "/no/existe/claude" });
  r.encolar(a.run_id, "armar", promptArmar(a));
  r.encolar(b.run_id, "armar", promptArmar(b));
  await r.esperar();
  expect(leerCorrida(d, a.run_id).estado).toBe("error");
  expect(leerCorrida(d, b.run_id).estado).toBe("error");
  expect(r.activo()).toBeNull();
});

test("I5: huérfanas tras reinicio quedan en error", async () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const { recuperarHuerfanas } = await import("./runner");
  expect(recuperarHuerfanas(d)).toBe(1);
  expect(leerCorrida(d, c.run_id)).toMatchObject({ estado: "error" });
});

test("I4: un error en una corrida que no es armar no cambia el estado", async () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const { actualizarCorrida } = await import("./runs");
  actualizarCorrida(d, c.run_id, (x) => { x.estado = "enviada"; });
  const r = runner(d, { CLAUDE_FALSO_MODO: "error" });
  r.encolar(c.run_id, "aprendizajes", "x");
  await r.esperar();
  const f = leerCorrida(d, c.run_id);
  expect(f.estado).toBe("enviada");
  expect(f.error).toContain("aprendizajes");
});

test("armar que termina sin reportar pasos queda en error con el mensaje de Claude", async () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const r = runner(d, { CLAUDE_FALSO_MODO: "sin_pasos" });
  r.encolar(c.run_id, "armar", promptArmar(c));
  await r.esperar();
  const f = leerCorrida(d, c.run_id);
  expect(f.estado).toBe("error");
  expect(f.error).toContain("Postulación armada");
});

test("los comandos permitidos aceptan ambas sintaxis de Bash", () => {
  const a = argsClaude({ sessionId: "s", tipo: "armar" });
  expect(a).toContain("Bash(bun run tracker:*)");
  expect(a).toContain("Bash(bun run tracker *)");
});

test("el prompt explica cómo usar los comandos", () => {
  const p = promptArmar(crearCorrida(datosTemporales(), { tipo: "texto", valor: "x" }));
  expect(p).toContain("nunca antepongas `cd`");
});


test("un paso en error deja la corrida en error", async () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const r = runner(d, { CLAUDE_FALSO_MODO: "paso_error" });
  r.encolar(c.run_id, "armar", promptArmar(c));
  await r.esperar();
  expect(leerCorrida(d, c.run_id).estado).toBe("error");
});
