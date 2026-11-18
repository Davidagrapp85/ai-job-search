import { expect, test } from "bun:test";
import { join } from "node:path";
import { datosTemporales } from "./testutil";

const CLI = join(import.meta.dir, "cli.ts");
const run = (d: string, ...args: string[]) => {
  const r = Bun.spawnSync(["bun", CLI, ...args], { env: { ...process.env, CAREER_OS_DATA: d } });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
};

test("set-estado válido", () => {
  const d = datosTemporales();
  const r = run(d, "set-estado", "002", "aprobada", "--causa", "listo");
  expect(r.code).toBe(0);
  expect(JSON.parse(r.out).event_id).toMatch(/^EVT-/);
  expect(JSON.parse(r.out).actor).toBe("claude");
});

test("estado inválido", () => {
  const d = datosTemporales();
  const r = run(d, "set-estado", "002", "x", "--causa", "y");
  expect(r.code).toBe(1);
  expect(r.err).toContain("estado inválido");
});

test("propose duplicado", () => {
  const d = datosTemporales();
  const p = JSON.stringify({ application_id: "APP-0001", de: "enviada", a: "entrevista", confianza: "alta", evidencia: { message_id: "m1", remitente: "a@b.c", asunto: "x", fecha: "2026-11-18", extracto: "y" } });
  expect(run(d, "propose", "--json", p).code).toBe(0);
  expect(run(d, "propose", "--json", p).out.trim()).toBe("null");
});

test("list filtra por estado", () => {
  const d = datosTemporales();
  const r = run(d, "list", "--estado", "detectada");
  expect(JSON.parse(r.out).map((f: any) => f.numero)).toEqual(["D001"]);
});

test("pendientes", () => {
  const d = datosTemporales();
  run(d, "editar", "002", "--fecha-proxima", "2020-01-01", "--causa", "x");
  const r = run(d, "pendientes", "--hoy", "2026-11-18");
  expect(JSON.parse(r.out).map((f: any) => f.numero)).toEqual(["002"]);
});

test("help", () => {
  expect(run(datosTemporales(), "--help").out).toContain("set-estado");
});
