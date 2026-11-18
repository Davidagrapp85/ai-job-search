import { expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listarAprendizajes, proponerAprendizaje, resolverAprendizaje } from "./learnings";
import { rutas } from "./store";
import { datosTemporales } from "./testutil";

const base = { run_id: "RUN-1", application_id: "APP-0002", antes: "Lideré operaciones", despues: "Dirigí la operación de cobranza", motivo: "David prefiere verbos concretos", alcance: "familia" as const, destino: "01_Perfil/cv_base.md" };

function datosConPerfil() {
  const d = datosTemporales();
  mkdirSync(join(rutas(d).raiz, "01_Perfil"), { recursive: true });
  writeFileSync(join(rutas(d).raiz, "01_Perfil", "cv_base.md"), "perfil");
  return d;
}

test("pendiente no cambia el brain", () => {
  const d = datosConPerfil();
  const antes = readFileSync(join(rutas(d).raiz, "01_Perfil", "cv_base.md"), "utf8");
  const a = proponerAprendizaje(d, { ...base, tipo: "redaccion" });
  expect(a.estado).toBe("pendiente");
  expect(listarAprendizajes(d, "pendiente").length).toBe(1);
  expect(readFileSync(join(rutas(d).raiz, "01_Perfil", "cv_base.md"), "utf8")).toBe(antes);
});

test("hecho nunca se aplica", () => {
  const d = datosConPerfil();
  const a = proponerAprendizaje(d, { ...base, tipo: "hecho", destino: "01_Perfil/banco_evidencias.md" });
  const r = resolverAprendizaje(d, a.learning_id, "aprobar");
  expect(r.aplicar).toBe(false);
  expect(r.aprendizaje.estado).toBe("por validar");
});

test("redacción aprobada se marca para aplicar", () => {
  const d = datosConPerfil();
  const a = proponerAprendizaje(d, { ...base, tipo: "redaccion" });
  const r = resolverAprendizaje(d, a.learning_id, "aprobar");
  expect(r).toMatchObject({ aplicar: true, aprendizaje: { estado: "aprobado" } });
  expect(resolverAprendizaje(d, a.learning_id, "aprobar").aplicar).toBe(false);
});

test("solo vacante y rechazar no se aplican", () => {
  const d = datosConPerfil();
  const a = proponerAprendizaje(d, { ...base, tipo: "enfasis" });
  expect(resolverAprendizaje(d, a.learning_id, "solo vacante")).toMatchObject({ aplicar: false, aprendizaje: { estado: "solo vacante" } });
});

test("destino fuera de lista → error", () => {
  const d = datosConPerfil();
  expect(() => proponerAprendizaje(d, { ...base, tipo: "redaccion", destino: "../../.zshrc" })).toThrow("Destino no permitido");
  expect(() => proponerAprendizaje(d, { ...base, tipo: "inventado" as any })).toThrow("Tipo");
});
