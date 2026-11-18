import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { revisarAts } from "./ats";

function docx(parrafos: string[], extra = ""): string {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "ats-"));
  const f = join(dir, "CV.docx");
  const xml = `<w:document><w:body>${parrafos.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("")}${extra}</w:body></w:document>`;
  Bun.spawnSync(["python3", "-I", "-c", "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1],'w');z.writestr('word/document.xml',sys.argv[2]);z.close()", f, xml]);
  return f;
}
const relleno = "Ran four credit products end to end and worked with corporate clients and funders across the region. ".repeat(6);
const BUENO = ["DAVID DUARTE", "Bogotá · +57 312 000 0000 · david@example.com", "PROFESSIONAL SUMMARY", relleno, "PROFESSIONAL EXPERIENCE", "ACME Fintech | July – November 2026", relleno, "EDUCATION", "MBA", "SKILLS", "Operations, product"];

test("CV correcto da 100", () => {
  const r = revisarAts(docx(BUENO));
  expect(r.fallas).toEqual([]);
  expect(r.puntaje).toBe(100);
});

test("encabezado en otro idioma falla", () => {
  const r = revisarAts(docx(BUENO.map((p) => (p === "PROFESSIONAL SUMMARY" ? "RESUMEN PROFESIONAL" : p))));
  expect(r.puntaje).toBeLessThan(100);
  expect(r.fallas.join()).toContain("RESUMEN PROFESIONAL");
});

test("sin correo o sin teléfono falla", () => {
  expect(revisarAts(docx(BUENO.map((p) => p.replace("david@example.com", "")))).fallas.join()).toContain("Correo");
  expect(revisarAts(docx(BUENO.map((p) => p.replace("+57 312 000 0000", "")))).fallas.join()).toContain("Teléfono");
});

test("tablas, cuadros de texto o imágenes fallan", () => {
  expect(revisarAts(docx(BUENO, "<w:tbl></w:tbl>")).puntaje).toBeLessThan(100);
  expect(revisarAts(docx(BUENO, "<w:drawing></w:drawing>")).puntaje).toBeLessThan(100);
});

test("faltan secciones estándar", () => {
  expect(revisarAts(docx(BUENO.filter((p) => p !== "EDUCATION"))).fallas.join()).toContain("Educación");
});

test("archivo ilegible falla sin lanzar", () => {
  const r = revisarAts("/no/existe/CV.docx");
  expect(r.puntaje).toBe(0);
});
