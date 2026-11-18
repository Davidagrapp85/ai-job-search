import { expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { abrirArchivo, aprobarDocumento, refrescarDocumentos } from "./docs";
import { crearCorrida, leerCorrida, reportarPaso } from "./runs";
import { leerEventos, leerFilas, rutas } from "./store";
import { datosTemporales, escribirCvDocx } from "./testutil";

function corridaConDocs() {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const carpeta = "04_Postulaciones/002_Beta";
  reportarPaso(d, c.run_id, "registro", "listo", { carpeta, applicationId: "APP-0002" });
  const dir = join(rutas(d).raiz, carpeta);
  mkdirSync(dir, { recursive: true });
  escribirCvDocx(join(dir, "CV.docx"), "cv v1");
  writeFileSync(join(dir, "Carta.docx"), "carta v1");
  return { d, id: c.run_id, dir };
}

test("aprobar CV y carta deja aprobada", () => {
  const { d, id, dir } = corridaConDocs();
  aprobarDocumento(d, id, "cv");
  expect(leerFilas(d).filas[1].estado).toBe("en preparación");
  const c = aprobarDocumento(d, id, "carta");
  expect(c.estado).toBe("aprobada");
  expect(leerFilas(d).filas[1].estado).toBe("aprobada");
  expect(leerEventos(d).at(-1)).toMatchObject({ actor: "david", a: "aprobada" });
  expect(existsSync(join(dir, "aprobado", "CV.docx"))).toBe(true);
});

test("respuestas existentes también deben aprobarse", () => {
  const { d, id, dir } = corridaConDocs();
  writeFileSync(join(dir, "respuestas.md"), "r");
  aprobarDocumento(d, id, "cv");
  expect(aprobarDocumento(d, id, "carta").estado).not.toBe("aprobada");
  expect(aprobarDocumento(d, id, "respuestas").estado).toBe("aprobada");
});

test("cambio después de aprobar vuelve a por revisar", () => {
  const { d, id, dir } = corridaConDocs();
  aprobarDocumento(d, id, "cv");
  escribirCvDocx(join(dir, "CV.docx"), "cv editado en Word");
  const c = refrescarDocumentos(d, leerCorrida(d, id));
  expect(c.documentos.cv.estado).toBe("por revisar");
});

test("archivo fuera de lista blanca", () => {
  const { d, id } = corridaConDocs();
  let llamado = false;
  const spawn = (() => { llamado = true; }) as any;
  expect(() => abrirArchivo(d, id, "../../05_Tracker/postulaciones.csv", spawn)).toThrow("Archivo no permitido");
  expect(llamado).toBe(false);
  abrirArchivo(d, id, "CV.docx", (args: string[]) => { llamado = true; expect(args[0]).toBe("open"); expect(args[1]).toEndWith("002_Beta/CV.docx"); });
  expect(llamado).toBe(true);
});
