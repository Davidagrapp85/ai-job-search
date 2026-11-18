import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adjunto, crearCorrida, leerCorrida, listarCorridas, reportarPaso } from "./runs";
import { rutas } from "./store";
import { datosTemporales } from "./testutil";

test("crear y leer", () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "url", valor: "https://jobs.example/1" });
  expect(c.run_id).toMatch(/^RUN-/);
  expect(c.estado).toBe("en cola");
  expect(c.pasos.map((p) => p.id)).toEqual(["leer", "investigar", "encaje", "cv", "carta", "respuestas", "registro"]);
  expect(leerCorrida(d, c.run_id).session_id).toBe(c.session_id);
  expect(listarCorridas(d).length).toBe(1);
});

test("paso inválido", () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  expect(() => reportarPaso(d, c.run_id, "xyz", "listo")).toThrow("Paso desconocido");
  expect(() => reportarPaso(d, c.run_id, "leer", "hecho" as any)).toThrow("Estado de paso");
  expect(() => reportarPaso(d, "RUN-no", "leer", "listo")).toThrow("No existe la corrida");
  expect(reportarPaso(d, c.run_id, "leer", "listo", { detalle: "ok" }).pasos[0]).toMatchObject({ estado: "listo", detalle: "ok" });
});

test("canal correo agrega paso", () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const r = reportarPaso(d, c.run_id, "encaje", "listo", { canal: "correo" });
  expect(r.pasos.map((p) => p.id)).toEqual(["leer", "investigar", "encaje", "cv", "carta", "respuestas", "correo", "registro"]);
  expect(reportarPaso(d, c.run_id, "encaje", "listo", { canal: "correo" }).pasos.length).toBe(8);
});

test("archivo fuera de lista blanca", () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  expect(() => reportarPaso(d, c.run_id, "leer", "listo", { archivo: "../x" })).toThrow("Archivo no permitido");
  expect(() => reportarPaso(d, c.run_id, "leer", "listo", { carpeta: "../../etc" })).toThrow("Carpeta no permitida");
});

test("adjunto solo de aprobado/", () => {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const carpeta = "04_Postulaciones/015_Acme";
  reportarPaso(d, c.run_id, "leer", "listo", { carpeta });
  const dir = join(rutas(d).raiz, carpeta);
  mkdirSync(join(dir, "aprobado"), { recursive: true });
  writeFileSync(join(dir, "CV.docx"), "borrador");
  expect(() => adjunto(d, c.run_id, "CV.docx")).toThrow("no está aprobado");
  writeFileSync(join(dir, "aprobado", "CV.docx"), "hola");
  expect(adjunto(d, c.run_id, "CV.docx")).toMatchObject({ nombre: "CV.docx", base64: Buffer.from("hola").toString("base64") });
  expect(() => adjunto(d, c.run_id, "../../05_Tracker/postulaciones.csv")).toThrow("Archivo no permitido");
});
