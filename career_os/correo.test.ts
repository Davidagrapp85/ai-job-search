import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { aprobarDocumento } from "./docs";
import { confirmarEnvio, registrarBorrador, solicitarEnvio, vistaCorreo } from "./correo";
import { crearCorrida, leerCorrida, reportarPaso } from "./runs";
import { leerFilas, rutas } from "./store";
import { datosTemporales, escribirCvDocx } from "./testutil";

function corrida(canal: "portal" | "correo") {
  const d = datosTemporales();
  const c = crearCorrida(d, { tipo: "texto", valor: "x" });
  const carpeta = "04_Postulaciones/002_Beta";
  reportarPaso(d, c.run_id, "encaje", "listo", { canal, carpeta, applicationId: "APP-0002" });
  const dir = join(rutas(d).raiz, carpeta);
  mkdirSync(dir, { recursive: true });
  escribirCvDocx(join(dir, "CV.docx"), "cv");
  writeFileSync(join(dir, "Carta.docx"), "carta");
  writeFileSync(join(dir, "correo.json"), JSON.stringify({ para: ["rh@beta.example"], cc: [], asunto: "Postulación COO", cuerpo_html: "<p>Hola,</p><script>alert(1)</script><p>adjunto mi CV &amp; carta</p>", adjuntos: ["CV.docx", "Carta.docx"] }));
  return { d, id: c.run_id, dir };
}

test("canal portal sin paso correo", () => {
  const { d, id } = corrida("portal");
  expect(leerCorrida(d, id).pasos.some((p) => p.id === "correo")).toBe(false);
});

test("vista convierte HTML a texto", () => {
  const { d, id } = corrida("correo");
  const v = vistaCorreo(d, id);
  expect(v.cuerpo_texto).not.toContain("<");
  expect(v.cuerpo_texto).toContain("adjunto mi CV & carta");
  expect(v.cuerpo_texto).not.toContain("alert(1)");
  expect(v.para).toEqual(["rh@beta.example"]);
});

test("enviar exige aprobados vigentes", () => {
  const { d, id, dir } = corrida("correo");
  registrarBorrador(d, id, "DRAFT-1");
  let v = vistaCorreo(d, id);
  expect(v.puedeEnviar).toBe(false);
  expect(() => solicitarEnvio(d, id, v.sha256)).toThrow("Aprueba la CV y la carta");
  aprobarDocumento(d, id, "cv");
  aprobarDocumento(d, id, "carta");
  v = vistaCorreo(d, id);
  expect(v.puedeEnviar).toBe(true);
  escribirCvDocx(join(dir, "CV.docx"), "cv editado");
  expect(vistaCorreo(d, id).puedeEnviar).toBe(false);
});

test("correo cambiado después de la vista previa no se envía", () => {
  const { d, id, dir } = corrida("correo");
  aprobarDocumento(d, id, "cv");
  aprobarDocumento(d, id, "carta");
  registrarBorrador(d, id, "DRAFT-1");
  const v = vistaCorreo(d, id);
  writeFileSync(join(dir, "correo.json"), JSON.stringify({ para: ["otro@x.example"], cc: [], asunto: "x", cuerpo_html: "x", adjuntos: [] }));
  expect(() => solicitarEnvio(d, id, v.sha256)).toThrow("cambió");
});

test("confirmar-envio sin solicitud falla", () => {
  const { d, id } = corrida("correo");
  expect(() => confirmarEnvio(d, id, "MSG-1", "2026-11-19")).toThrow("sin solicitud de envío");
  expect(leerFilas(d).filas[1].estado).toBe("en preparación");
});

test("envío confirmado marca enviada con canal correo", () => {
  const { d, id } = corrida("correo");
  aprobarDocumento(d, id, "cv");
  aprobarDocumento(d, id, "carta");
  registrarBorrador(d, id, "DRAFT-1");
  solicitarEnvio(d, id, vistaCorreo(d, id).sha256);
  confirmarEnvio(d, id, "MSG-1", "2026-11-19");
  expect(leerFilas(d).filas[1]).toMatchObject({ estado: "enviada", canal: "correo", fecha_envio: "2026-11-19" });
  expect(leerCorrida(d, id).estado).toBe("enviada");
});

test("I2: un adjunto aprobado alterado bloquea el envío y el adjunto", () => {
  const { d, id, dir } = corrida("correo");
  aprobarDocumento(d, id, "cv");
  aprobarDocumento(d, id, "carta");
  registrarBorrador(d, id, "DRAFT-1");
  writeFileSync(join(dir, "aprobado", "CV.docx"), "alterado");
  expect(vistaCorreo(d, id).puedeEnviar).toBe(false);
  const { adjunto } = require("./runs");
  expect(() => adjunto(d, id, "CV.docx")).toThrow("cambió");
});

test("I4: no se puede solicitar el envío dos veces", () => {
  const { d, id } = corrida("correo");
  aprobarDocumento(d, id, "cv");
  aprobarDocumento(d, id, "carta");
  registrarBorrador(d, id, "DRAFT-1");
  const sha = vistaCorreo(d, id).sha256;
  solicitarEnvio(d, id, sha);
  expect(() => solicitarEnvio(d, id, sha)).toThrow("ya");
  expect(vistaCorreo(d, id).puedeEnviar).toBe(false);
});
