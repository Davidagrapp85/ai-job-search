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
