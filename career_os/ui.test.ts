import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("app.js no inserta HTML con datos", () => {
  const js = readFileSync(join(import.meta.dir, "public", "app.js"), "utf8");
  expect(js).not.toMatch(/innerHTML\s*=\s*(?!['"]['"])/);
  expect(js).not.toMatch(/insertAdjacentHTML|outerHTML\s*=|document\.write/);
});

test("hidden gana a display de las clases", () => {
  const css = readFileSync(join(import.meta.dir, "public", "styles.css"), "utf8");
  expect(css).toContain("[hidden]{display:none!important}");
});

test("embudo muestra N/D con denominador cero", () => {
  const js = readFileSync(join(import.meta.dir, "public", "app.js"), "utf8");
  expect(js).toContain('e.de === 0 ? "N/D"');
});

test("cuerpo del correo con textContent", () => {
  const js = readFileSync(join(import.meta.dir, "public", "app.js"), "utf8");
  expect(js).toContain('$("c-cuerpo").textContent = v.cuerpo_texto');
  expect(js).not.toMatch(/innerHTML/);
});
