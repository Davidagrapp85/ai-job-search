import { expect, test } from "bun:test";
import { COLUMNAS, type Fila, nuevoId, validarFilas } from "./model";

function fila(p: Partial<Fila>): Fila {
  const f = Object.fromEntries(COLUMNAS.map((c) => [c, ""])) as Fila;
  return { ...f, numero: "001", empresa: "Acme", vacante: "Director", estado: "en preparación", application_id: "APP-0001", decision: "user_selected", ...p };
}

test("estado inválido", () => {
  const e = validarFilas([fila({ estado: "x" })]);
  expect(e.join()).toContain("estado inválido");
  expect(e.join()).toContain("001");
});

test("enviada sin canal o con fecha mal formada", () => {
  expect(validarFilas([fila({ estado: "enviada", fecha_envio: "2026-11-01" })]).join()).toContain("canal");
  expect(validarFilas([fila({ estado: "enviada", canal: "Lever", fecha_envio: "1-nov" })]).join()).toContain("fecha_envio");
  expect(validarFilas([fila({ estado: "enviada", canal: "Lever", fecha_envio: "2026-11-01" })])).toEqual([]);
});

test("duplicado empresa+vacante", () => {
  const e = validarFilas([fila({}), fila({ numero: "002", application_id: "APP-0002", empresa: " acme ", vacante: "DIRECTOR" })]);
  expect(e.join()).toContain("duplicado");
});

test("application_id duplicado", () => {
  expect(validarFilas([fila({}), fila({ numero: "002", vacante: "Otra" })]).join()).toContain("application_id");
});

test("aprobada es válido", () => {
  expect(validarFilas([fila({ estado: "aprobada" })])).toEqual([]);
});

test("nuevoId", () => {
  expect(nuevoId("EVT", new Date("2026-11-18T10:00:00Z"))).toMatch(/^EVT-20261118T100000-[0-9a-f]{4}$/);
});
