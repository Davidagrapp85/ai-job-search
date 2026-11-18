import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringifyCsv } from "./csv";
import { COLUMNAS, type Fila } from "./model";

export function fila(p: Partial<Fila>): Fila {
  const f = Object.fromEntries(COLUMNAS.map((c) => [c, ""])) as Fila;
  return { ...f, ...p };
}

/** Crea un directorio de datos temporal con un tracker de 3 filas (ya migrado). */
export function datosTemporales(filas?: Fila[]): string {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "career-os-"));
  mkdirSync(join(dir, "05_Tracker"), { recursive: true });
  const fs = filas ?? [
    fila({ numero: "001", empresa: "Acme", vacante: "Director", estado: "enviada", canal: "Lever", fecha_envio: "2026-11-01", fecha: "2026-11-01", application_id: "APP-0001", decision: "user_selected", eje: "banca" }),
    fila({ numero: "002", empresa: "Beta", vacante: "COO", estado: "en preparación", application_id: "APP-0002", decision: "user_selected", eje: "revenue", fecha: "2026-11-02" }),
    fila({ numero: "D001", empresa: "Gamma", vacante: "Ops Lead", estado: "detectada", application_id: "APP-0003", decision: "discovery", eje: "banca", fecha: "2026-11-03" }),
  ];
  writeFileSync(join(dir, "05_Tracker", "postulaciones.csv"), stringifyCsv([[...COLUMNAS], ...fs.map((f) => COLUMNAS.map((c) => f[c]))]));
  return dir;
}
