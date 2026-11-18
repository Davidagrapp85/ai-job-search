import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { agregarEvento, conLock, escribirFilas, leerEventos, leerFilas, rutas } from "./store";
import { datosTemporales } from "./testutil";
import type { Evento } from "./model";

const ev = (id: string): Evento => ({ event_id: id, application_id: "APP-0001", at: "2026-11-18T10:00:00Z", tipo: "edicion", actor: "claude", causa: "prueba" });

test("escritura atómica", () => {
  const d = datosTemporales();
  const { columnas, filas } = leerFilas(d);
  filas[1].notas = 'texto, con "comillas"';
  escribirFilas(d, columnas, filas);
  expect(readdirSync(rutas(d).csv.replace(/[^/]+$/, "")).some((f) => f.endsWith(".tmp"))).toBe(false);
  expect(leerFilas(d).filas[1].notas).toBe('texto, con "comillas"');
});

test("respaldo rotativo", () => {
  const d = datosTemporales();
  const { columnas, filas } = leerFilas(d);
  for (let i = 0; i < 32; i++) { filas[1].notas = `n${i}`; escribirFilas(d, columnas, filas); }
  expect(readdirSync(rutas(d).respaldos).length).toBe(30);
});

test("rechaza inválidas", () => {
  const d = datosTemporales();
  const antes = readFileSync(rutas(d).csv, "utf8");
  const { columnas, filas } = leerFilas(d);
  filas[0].estado = "x";
  expect(() => escribirFilas(d, columnas, filas)).toThrow("estado inválido");
  expect(readFileSync(rutas(d).csv, "utf8")).toBe(antes);
});

test("lock ocupado", () => {
  const d = datosTemporales();
  writeFileSync(rutas(d).lock, "otro");
  expect(() => conLock(d, () => 1)).toThrow("El tracker está ocupado");
  const viejo = Date.now() / 1000 - 60;
  utimesSync(rutas(d).lock, viejo, viejo);
  expect(conLock(d, () => 42)).toBe(42);
  expect(existsSync(rutas(d).lock)).toBe(false);
});

test("eventos solo se agregan", () => {
  const d = datosTemporales();
  agregarEvento(d, ev("EVT-1"));
  const primera = readFileSync(rutas(d).eventos, "utf8").split("\n")[0];
  agregarEvento(d, ev("EVT-2"));
  expect(leerEventos(d).length).toBe(2);
  expect(readFileSync(rutas(d).eventos, "utf8").split("\n")[0]).toBe(primera);
});
