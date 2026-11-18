import { expect, test } from "bun:test";
import { calcularMetricas } from "./metrics";
import type { Evento } from "./model";
import { fila } from "./testutil";

const ev = (id: string, de: string, a: string, at: string): Evento =>
  ({ event_id: `E${id}${a}`, application_id: id, at, tipo: "cambio_estado", de, a, actor: "david", causa: "x" });

test("sin enviadas: denominadores en cero", () => {
  const filas = [
    fila({ application_id: "A1", estado: "en preparación", decision: "user_selected" }),
    fila({ application_id: "A2", estado: "detectada", decision: "discovery" }),
  ];
  const m = calcularMetricas(filas, [], "2026-11-18");
  expect(m.kpis.enviadas).toEqual({ n: 0, de: 1 });
  expect(m.kpis.conRespuesta).toEqual({ n: 0, de: 0 });
  expect(m.embudo[0]).toEqual({ etapa: "detectada", n: 2, de: 2 });
  expect(m.embudo.find((e) => e.etapa === "elegida")).toEqual({ etapa: "elegida", n: 1, de: 2 });
});

test("etapa histórica: rechazada después de enviada cuenta en enviada y respuesta", () => {
  const filas = [fila({ application_id: "A1", estado: "rechazada", decision: "user_selected", fecha_envio: "2026-11-01", canal: "Lever" })];
  const eventos = [ev("A1", "en preparación", "enviada", "2026-11-01T10:00:00Z"), ev("A1", "enviada", "rechazada", "2026-11-11T10:00:00Z")];
  const m = calcularMetricas(filas, eventos, "2026-11-18");
  const n = (e: string) => m.embudo.find((x) => x.etapa === e)!.n;
  expect(n("enviada")).toBe(1);
  expect(n("respuesta")).toBe(1);
  expect(n("entrevista")).toBe(0);
  expect(m.kpis.conRespuesta).toEqual({ n: 1, de: 1 });
  expect(m.kpis.diasPrimeraRespuesta).toBe(10);
});

test("vencidas solo en activas", () => {
  const filas = [
    fila({ application_id: "A1", estado: "en preparación", fecha_proxima: "2026-11-10" }),
    fila({ application_id: "A2", estado: "cerrada", fecha_proxima: "2026-11-10" }),
    fila({ application_id: "A3", estado: "en preparación", fecha_proxima: "2026-11-18" }),
  ];
  expect(calcularMetricas(filas, [], "2026-11-18").kpis.vencidas).toBe(1);
});
