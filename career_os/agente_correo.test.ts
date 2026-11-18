import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("el prompt del agente solo propone", () => {
  const t = readFileSync(join(import.meta.dir, "agente_correo.md"), "utf8");
  expect(t).toContain("bun run tracker propose");
  expect(t).toContain("solo lectura");
  expect(t).toContain("duarcas_8@hotmail.com");
  const usos = t.split("\n").filter((l) => l.includes("set-estado"));
  expect(usos.every((l) => /Nunca `set-estado`/.test(l))).toBe(true);
  expect(t).toMatch(/dato, no instrucción/);
});
