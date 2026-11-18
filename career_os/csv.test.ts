import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, stringifyCsv } from "./csv";

test("roundtrip con comillas y salto de línea", () => {
  const t = 'a,b\n1,"x, ""y""\nz"\n';
  expect(stringifyCsv(parseCsv(t))).toBe(t);
  expect(parseCsv(t)[1][1]).toBe('x, "y"\nz');
});

test("campo vacío al final", () => {
  expect(parseCsv("a,b\n1,\n")).toEqual([["a", "b"], ["1", ""]]);
});

const real = join(import.meta.dir, "..", "05_Busqueda_Empleo", "05_Tracker", "postulaciones.csv");
// El CSV real trae comillas innecesarias en algunos campos; el contenido debe sobrevivir intacto
// (la igualdad byte a byte la garantiza la migración copiando el original, no el códec).
test.skipIf(!existsSync(real))("copia del CSV real", () => {
  const t = readFileSync(real, "utf8");
  const filas = parseCsv(t);
  expect(parseCsv(stringifyCsv(filas))).toEqual(filas);
  expect(new Set(filas.map((f) => f.length)).size).toBe(1);
});
