import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrar, revertir } from "./migrate";
import { leerEventos, leerFilas, rutas } from "./store";

const ORIGINAL =
  "numero,empresa,vacante,eje,link,fecha,puntaje,version_cv,version_carta,estado,proxima_accion,fecha_proxima,notas\n" +
  '001,Acme,Director,banca,https://x,2026-11-01,,CV.docx,,enviada,Seguimiento,2026-11-14,Enviada por David vía Personio\n' +
  '002,Beta,COO,revenue,,2026-11-02,40,,,en preparación,"Revisar, enviar",,"Nivel B"\n' +
  "D001,Gamma,Ops Lead,banca,,2026-11-03,58,,,detectada,Decidir,,\n" +
  "003,Delta,CFO,banca,,2026-11-04,55,,,descartada,,,\n";

function datos(): string {
  const d = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "career-os-mig-"));
  mkdirSync(join(d, "05_Tracker"));
  writeFileSync(join(d, "05_Tracker", "postulaciones.csv"), ORIGINAL);
  return d;
}

test("D-01 conserva filas y estados", () => {
  const d = datos();
  expect(migrar(d)).toEqual({ filas: 4 });
  const { filas } = leerFilas(d);
  expect(filas.map((f) => f.estado)).toEqual(["enviada", "en preparación", "detectada", "descartada"]);
  expect(filas.map((f) => f.application_id)).toEqual(["APP-0001", "APP-0002", "APP-0003", "APP-0004"]);
  expect(filas.map((f) => f.decision)).toEqual(["user_selected", "user_selected", "discovery", "user_selected"]);
  const ev = leerEventos(d);
  expect(ev.length).toBe(4);
  expect(ev.every((e) => e.tipo === "alta" && e.actor === "migracion")).toBe(true);
});

test("canal y fecha de la enviada", () => {
  const d = datos();
  migrar(d);
  expect(leerFilas(d).filas[0]).toMatchObject({ canal: "Personio", fecha_envio: "2026-11-01" });
});

test("M-01 migrar y revertir deja el CSV byte a byte igual", () => {
  const d = datos();
  migrar(d);
  revertir(d);
  expect(readFileSync(rutas(d).csv, "utf8")).toBe(ORIGINAL);
});

test("ya migrado", () => {
  const d = datos();
  migrar(d);
  expect(() => migrar(d)).toThrow("Ya migrado");
});

test("revertir no borra cambios posteriores sin --force y respalda antes", () => {
  const d = datos();
  migrar(d);
  require("node:fs").appendFileSync(rutas(d).eventos, JSON.stringify({ event_id: "E", application_id: "APP-0002", at: "x", tipo: "edicion", actor: "david", causa: "x" }) + "\n");
  expect(() => revertir(d)).toThrow("cambios posteriores");
  revertir(d, { force: true });
  expect(readFileSync(rutas(d).csv, "utf8")).toBe(ORIGINAL);
  expect(require("node:fs").readdirSync(rutas(d).respaldos).length).toBeGreaterThan(0);
});
