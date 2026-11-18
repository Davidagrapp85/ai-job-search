import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { PESOS, registrarAts, registrarCalidad } from "./calidad";
import { aprobarDocumento } from "./docs";
import { crearCorrida, leerCorrida, reportarPaso } from "./runs";
import { rutas } from "./store";
import { datosTemporales } from "./testutil";

function docxEn(dir: string, encabezado = "PROFESSIONAL SUMMARY") {
  const relleno = "Ran four credit products end to end and worked with corporate clients and funders across the region. ".repeat(6);
  const ps = ["DAVID", "+57 312 000 0000 · d@example.com", encabezado, relleno, "PROFESSIONAL EXPERIENCE", relleno, "EDUCATION", "MBA", "SKILLS", "Ops"];
  const xml = `<w:document><w:body>${ps.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`;
  Bun.spawnSync(["python3", "-I", "-c", "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1],'w');z.writestr('word/document.xml',sys.argv[2]);z.close()", join(dir, "CV.docx"), xml]);
}
function corrida(encabezado?: string) {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const carpeta = "04_Postulaciones/002_Beta";
  reportarPaso(d, c.run_id, "registro", "listo", { carpeta, applicationId: "APP-0002" });
  const dir = join(rutas(d).raiz, carpeta);
  mkdirSync(dir, { recursive: true });
  docxEn(dir, encabezado);
  return { d, id: c.run_id };
}
const dims = { veracidad: 100, pertinencia: 80, evidencia: 90, claridad: 70, coherencia: 100 };

test("pesos suman 100 y el total es determinístico", () => {
  expect(Object.values(PESOS).reduce((a, b) => a + b, 0)).toBe(100);
  const { d, id } = corrida();
  const c = registrarCalidad(d, id, { dimensiones: dims, cobertura: [{ requisito: "SQL", estado: "parcial" }, { requisito: "Fintech", estado: "demostrado" }], riesgos: ["Inglés fluido"] });
  expect(c.calidad!.at(-1)!.total).toBe(Math.round(100 * 0.3 + 80 * 0.25 + 90 * 0.2 + 70 * 0.15 + 100 * 0.1));
  expect(c.cobertura_pct).toBe(75);
  expect(leerCorrida(d, id).pasos.find((p) => p.id === "calidad")!.estado).toBe("alerta");
});

test("rondas se acumulan y ≥90 deja el paso listo", () => {
  const { d, id } = corrida();
  registrarCalidad(d, id, { dimensiones: dims, cobertura: [], riesgos: [] });
  const c = registrarCalidad(d, id, { dimensiones: { veracidad: 100, pertinencia: 95, evidencia: 90, claridad: 90, coherencia: 95 }, cobertura: [], riesgos: [], cambios: "Perfil enfocado en cobranza" });
  expect(c.calidad!.map((x) => x.ronda)).toEqual([1, 2]);
  expect(c.pasos.find((p) => p.id === "calidad")!.estado).toBe("listo");
});

test("valores fuera de rango o estados inventados se rechazan", () => {
  const { d, id } = corrida();
  expect(() => registrarCalidad(d, id, { dimensiones: { ...dims, veracidad: 120 }, cobertura: [], riesgos: [] })).toThrow("0 y 100");
  expect(() => registrarCalidad(d, id, { dimensiones: dims, cobertura: [{ requisito: "x", estado: "casi" as any }], riesgos: [] })).toThrow("Estado de cobertura");
});

test("ATS 100 deja el paso listo; con fallas queda en error", () => {
  const ok = corrida();
  expect(registrarAts(ok.d, ok.id).ats!.puntaje).toBe(100);
  expect(leerCorrida(ok.d, ok.id).pasos.find((p) => p.id === "ats")!.estado).toBe("listo");
  const mal = corrida("RESUMEN PROFESIONAL");
  const c = registrarAts(mal.d, mal.id);
  expect(c.ats!.puntaje).toBeLessThan(100);
  expect(c.pasos.find((p) => p.id === "ats")).toMatchObject({ estado: "error" });
});

test("no se aprueba un CV que no pasa ATS al 100%", () => {
  const mal = corrida("RESUMEN PROFESIONAL");
  expect(() => aprobarDocumento(mal.d, mal.id, "cv")).toThrow("ATS");
  const ok = corrida();
  expect(aprobarDocumento(ok.d, ok.id, "cv").documentos.cv.estado).toBe("aprobado");
});
