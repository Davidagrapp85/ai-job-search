// Legibilidad para ATS: chequeo determinístico del CV (.docx). Debe dar 100 para aprobar.
import { existsSync } from "node:fs";

export type ResultadoAts = { puntaje: number; chequeos: { nombre: string; ok: boolean; detalle?: string }[]; fallas: string[]; idioma: "es" | "en" | "?"; texto_chars: number };

const ES = ["RESUMEN PROFESIONAL", "PERFIL PROFESIONAL", "RESUMEN", "PERFIL", "EXPERIENCIA PROFESIONAL", "EXPERIENCIA", "EDUCACIÓN", "FORMACIÓN", "FORMACIÓN ACADÉMICA", "HABILIDADES", "COMPETENCIAS", "HERRAMIENTAS", "IDIOMAS", "CERTIFICACIONES", "LOGROS", "PUBLICACIONES", "PREMIOS", "REFERENCIAS"];
const EN = ["PROFESSIONAL SUMMARY", "SUMMARY", "PROFILE", "PROFESSIONAL EXPERIENCE", "EXPERIENCE", "WORK EXPERIENCE", "EDUCATION", "SKILLS", "CORE SKILLS", "TECHNICAL SKILLS", "TOOLS", "LANGUAGES", "CERTIFICATIONS", "ACHIEVEMENTS", "PUBLICATIONS", "AWARDS", "REFERENCES"];
const SECCIONES: [string, string[]][] = [
  ["Experiencia", ["EXPERIENCIA PROFESIONAL", "EXPERIENCIA", "PROFESSIONAL EXPERIENCE", "EXPERIENCE", "WORK EXPERIENCE"]],
  ["Educación", ["EDUCACIÓN", "FORMACIÓN", "FORMACIÓN ACADÉMICA", "EDUCATION"]],
  ["Habilidades", ["HABILIDADES", "COMPETENCIAS", "HERRAMIENTAS", "SKILLS", "CORE SKILLS", "TECHNICAL SKILLS", "TOOLS"]],
];

function xmlATexto(xml: string): string {
  return xml.replace(/<w:tab\/>/g, " ").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function idioma(texto: string): "es" | "en" | "?" {
  const palabras = texto.toLowerCase().match(/[a-záéíóúñ]+/g) ?? [];
  const en = palabras.filter((w) => ["the", "and", "of", "to", "with", "for", "in", "where", "i"].includes(w)).length;
  const es = palabras.filter((w) => ["el", "la", "de", "y", "con", "para", "los", "las", "en", "que"].includes(w)).length;
  if (en + es < 10) return "?";
  return en > es ? "en" : "es";
}

export function revisarAts(docx: string): ResultadoAts {
  const r = Bun.spawnSync(["unzip", "-p", docx, "word/document.xml"]);
  const xml = existsSync(docx) && r.exitCode === 0 ? r.stdout.toString() : "";
  const texto = xmlATexto(xml);
  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const encabezados = lineas.filter((l) => l.length < 45 && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{4}/.test(l) && [...ES, ...EN].includes(l));
  const cuerpo = lineas.filter((l) => l.length > 60).join(" ");
  const lang = idioma(cuerpo);
  const otros = lang === "en" ? encabezados.filter((h) => ES.includes(h) && !EN.includes(h)) : lang === "es" ? encabezados.filter((h) => EN.includes(h) && !ES.includes(h)) : [];

  const chequeos = [
    { nombre: "Archivo legible y con texto extraíble", ok: texto.length >= 400, detalle: `${texto.length} caracteres` },
    { nombre: "Correo como texto en el cuerpo", ok: /[\w.+-]+@[\w-]+\.[\w.]+/.test(texto) },
    { nombre: "Teléfono como texto en el cuerpo", ok: /\+?\d[\d\s-]{8,}\d/.test(texto) },
    { nombre: "Sin tablas, cuadros de texto ni imágenes", ok: !/<w:tbl>|txbxContent|<w:drawing|<w:pict/.test(xml) },
    ...SECCIONES.map(([nombre, nombres]) => ({ nombre: `Sección estándar: ${nombre}`, ok: encabezados.some((h) => nombres.includes(h)) })),
    { nombre: "Encabezados en el idioma del CV", ok: otros.length === 0, detalle: otros.length ? `En otro idioma: ${otros.join(", ")}` : undefined },
  ];
  const fallas = chequeos.filter((c) => !c.ok).map((c) => (c.detalle && !c.ok ? `${c.nombre} (${c.detalle})` : c.nombre));
  const puntaje = xml ? Math.round((100 * chequeos.filter((c) => c.ok).length) / chequeos.length) : 0;
  return { puntaje, chequeos, fallas, idioma: lang, texto_chars: texto.length };
}
