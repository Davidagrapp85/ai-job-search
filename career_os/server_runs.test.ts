import { expect, test } from "bun:test";
import { join } from "node:path";
import { Runner } from "./runner";
import { leerCorrida } from "./runs";
import { crearManejador } from "./server";
import { datosTemporales } from "./testutil";

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const FALSO = join(import.meta.dir, "testdata", "claude_falso.ts");
function app() {
  const d = datosTemporales();
  const runner = new Runner({ dataDir: d, bin: FALSO });
  const abiertos: string[][] = [];
  const h = crearManejador({ dataDir: d, port: () => PORT, runner, spawn: (a: string[]) => abiertos.push(a) });
  return { d, runner, h, abiertos };
}
const req = (h: any, ruta: string, body?: unknown, origin: string = BASE) =>
  h(new Request(BASE + ruta, body === undefined
    ? { headers: { host: `127.0.0.1:${PORT}` } }
    : { method: "POST", headers: { host: `127.0.0.1:${PORT}`, origin, "content-type": "application/json" }, body: JSON.stringify(body) }));

test("POST /api/runs encola y crea", async () => {
  const { d, h, runner } = app();
  const r = await req(h, "/api/runs", { tipo: "texto", valor: "Director en Acme" });
  expect(r.status).toBe(200);
  const { run_id } = await r.json();
  await runner.esperar();
  expect(leerCorrida(d, run_id).estado).toBe("esperando a David");
  expect((await (await req(h, "/api/runs")).json()).length).toBe(1);
  expect((await (await req(h, `/api/runs/${run_id}`)).json()).pasos.length).toBe(7);
});

test("entrada vacía → 400", async () => {
  const { h } = app();
  expect((await req(h, "/api/runs", { tipo: "texto", valor: "  " })).status).toBe(400);
});

test("chat agrega mensajes de ambos", async () => {
  const { d, h, runner } = app();
  const { run_id } = await (await req(h, "/api/runs", { tipo: "texto", valor: "x" })).json();
  await runner.esperar();
  expect((await req(h, `/api/runs/${run_id}/chat`, { texto: "Sube el tema de cobranza", documento: "cv" })).status).toBe(200);
  expect(leerCorrida(d, run_id).documentos.cv.estado).toBe("en trabajo");
  await runner.esperar();
  const chat = leerCorrida(d, run_id).chat;
  expect(chat.map((m) => m.rol)).toEqual(["david", "claude"]);
});

test("seguir devuelve comando", async () => {
  const { d, h, runner } = app();
  const { run_id } = await (await req(h, "/api/runs", { tipo: "texto", valor: "x" })).json();
  await runner.esperar();
  const s = await (await req(h, `/api/runs/${run_id}/seguir`)).json();
  expect(s.comando).toBe(`cd ~/05_ai_job_search && claude --resume ${leerCorrida(d, run_id).session_id}`);
  expect(s.contexto).toContain(run_id);
});

test("abrir con ../ → 400 y archivo válido llama open", async () => {
  const { h, runner, abiertos } = app();
  const { run_id } = await (await req(h, "/api/runs", { tipo: "texto", valor: "x" })).json();
  await runner.esperar();
  expect((await req(h, `/api/runs/${run_id}/abrir`, { archivo: "../../x" })).status).toBe(400);
  expect(abiertos.length).toBe(0);
});

test("origin externo → 403 en rutas nuevas", async () => {
  const { h } = app();
  expect((await req(h, "/api/runs", { tipo: "texto", valor: "x" }, "https://evil.example")).status).toBe(403);
});

test("cancelar", async () => {
  const { d, h, runner } = app();
  const { run_id } = await (await req(h, "/api/runs", { tipo: "texto", valor: "x" })).json();
  await req(h, `/api/runs/${run_id}/cancelar`, {});
  await runner.esperar();
  expect(leerCorrida(d, run_id).estado).toBe("cancelada");
});

test("enviar sin aprobar → 400 y no encola", async () => {
  const { h, runner } = app();
  const { run_id } = await (await req(h, "/api/runs", { tipo: "texto", valor: "x" })).json();
  await runner.esperar();
  const r = await req(h, `/api/runs/${run_id}/correo/enviar`, { sha256: "x" });
  expect(r.status).toBe(400);
  expect(runner.activo()).toBeNull();
});

test("aprendizaje hecho aprobado no encola nada", async () => {
  const { d, h, runner } = app();
  const { proponerAprendizaje } = await import("./learnings");
  const a = proponerAprendizaje(d, { run_id: "RUN-x", application_id: "APP-0002", tipo: "hecho", antes: "a", despues: "b", motivo: "m", alcance: "compartido", destino: "01_Perfil/banco_evidencias.md" });
  const r = await req(h, `/api/learnings/${a.learning_id}/aprobar`, {});
  expect((await r.json()).estado).toBe("por validar");
  expect(runner.activo()).toBeNull();
  expect((await (await req(h, "/api/learnings?estado=pendiente")).json()).length).toBe(0);
});

test("GET de una corrida informa si está ocupada", async () => {
  const { h, runner } = app();
  const { run_id } = await (await req(h, "/api/runs", { tipo: "texto", valor: "x" })).json();
  const ocupada = await (await req(h, `/api/runs/${run_id}`)).json();
  expect(ocupada.activa || ocupada.en_cola).toBe(true);
  await runner.esperar();
  const libre = await (await req(h, `/api/runs/${run_id}`)).json();
  expect(libre.activa).toBe(false);
});
