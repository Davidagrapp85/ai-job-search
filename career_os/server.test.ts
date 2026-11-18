import { expect, test } from "bun:test";
import { crearManejador, crearServidor } from "./server";
import { leerEventos } from "./store";
import { datosTemporales } from "./testutil";
import { proponer } from "./tracker";

// El manejador se prueba sin abrir puertos (el sandbox puede bloquear la escucha).
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const app = (d: string) => crearManejador({ dataDir: d, port: () => PORT });
const get = (h: ReturnType<typeof app>, ruta: string, headers: Record<string, string> = {}) =>
  h(new Request(BASE + ruta, { headers: { host: `127.0.0.1:${PORT}`, ...headers } }));
const post = (h: ReturnType<typeof app>, ruta: string, body: unknown, origin: string | null = BASE) =>
  h(new Request(BASE + ruta, { method: "POST", headers: { host: `127.0.0.1:${PORT}`, "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }));

let puedeEscuchar = true;
try { crearServidor({ port: 0 }).stop(true); } catch { puedeEscuchar = false; }

test.skipIf(!puedeEscuchar)("escucha solo en 127.0.0.1", () => {
  const s = crearServidor({ dataDir: datosTemporales(), port: 0 });
  expect(s.hostname).toBe("127.0.0.1");
  s.stop(true);
});

test("GET aplicaciones y métricas", async () => {
  const h = app(datosTemporales());
  expect((await (await get(h, "/api/applications")).json()).length).toBe(3);
  expect((await (await get(h, "/api/metrics")).json()).kpis.enviadas.n).toBe(1);
});

test("POST estado con origin local", async () => {
  const d = datosTemporales();
  expect((await post(app(d), "/api/applications/APP-0002/estado", { estado: "aprobada", causa: "listo" })).status).toBe(200);
  expect(leerEventos(d)[0]).toMatchObject({ actor: "david", a: "aprobada" });
});

test("error de validación → 400", async () => {
  const r = await post(app(datosTemporales()), "/api/applications/APP-0002/estado", { estado: "enviada", causa: "x" });
  expect(r.status).toBe(400);
  expect((await r.json()).error).toContain("canal");
});

test("origin externo", async () => {
  const h = app(datosTemporales());
  expect((await post(h, "/api/applications/APP-0002/estado", { estado: "aprobada", causa: "x" }, "https://evil.example")).status).toBe(403);
  expect((await post(h, "/api/applications/APP-0002/estado", { estado: "aprobada", causa: "x" }, null)).status).toBe(403);
});

test("host externo", async () => {
  expect((await get(app(datosTemporales()), "/api/applications", { host: "evil.example" })).status).toBe(403);
});

test("traversal", async () => {
  const h = app(datosTemporales());
  for (const ruta of ["/%2e%2e/package.json", "/..%2fpackage.json", "/%2e%2e%2fstore.ts", "/public/../store.ts"]) {
    // Se fija la URL cruda para que ningún cliente normalice el ".." antes de llegar al manejador.
    const req = new Request(BASE + "/", { headers: { host: `127.0.0.1:${PORT}` } });
    Object.defineProperty(req, "url", { value: BASE + ruta });
    expect((await h(req)).status).toBe(404);
  }
  expect((await get(h, "/")).status).toBe(200);
});

test("persiste tras reinicio", async () => {
  const d = datosTemporales();
  await post(app(d), "/api/applications/APP-0002/estado", { estado: "aprobada", causa: "x" });
  const filas = await (await get(app(d), "/api/applications")).json();
  expect(filas[1].estado).toBe("aprobada");
});

test("aprobar propuesta por API", async () => {
  const d = datosTemporales();
  const p = proponer({ dataDir: d, p: { application_id: "APP-0001", de: "enviada", a: "entrevista", confianza: "alta", evidencia: { message_id: "m", remitente: "r", asunto: "a", fecha: "f", extracto: "e" } } })!;
  const h = app(d);
  expect((await (await get(h, "/api/proposals?estado=pendiente")).json()).length).toBe(1);
  expect((await post(h, `/api/proposals/${p.proposal_id}/aprobar`, {})).status).toBe(200);
  expect((await (await get(h, "/api/proposals?estado=pendiente")).json()).length).toBe(0);
});
