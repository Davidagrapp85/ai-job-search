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

/** Escribe un CV.docx mínimo que pasa la legibilidad ATS (texto distinto según `marca`). */
export function escribirCvDocx(archivo: string, marca = "v1"): void {
  const relleno = `Ran four credit products end to end and worked with corporate clients and funders across the region ${marca}. `.repeat(6);
  const ps = ["DAVID", "+57 312 000 0000 · d@example.com", "PROFESSIONAL SUMMARY", relleno, "PROFESSIONAL EXPERIENCE", relleno, "EDUCATION", "MBA", "SKILLS", "Ops"];
  const xml = `<w:document><w:body>${ps.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`;
  Bun.spawnSync(["python3", "-I", "-c", "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1],'w');z.writestr('word/document.xml',sys.argv[2]);z.close()", archivo, xml]);
}
