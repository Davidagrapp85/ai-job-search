// Calidad del paquete: (1) legibilidad ATS determinística, debe ser 100; (2) nota de 5 variables con rondas.
import { join } from "node:path";
import { revisarAts } from "./ats";
import { actualizarCorrida, carpetaAbs, type Corrida, leerCorrida, reportarPaso } from "./runs";

export const PESOS = { veracidad: 30, pertinencia: 25, evidencia: 20, claridad: 15, coherencia: 10 } as const;
export const META = 90;
const ESTADOS_COB = ["demostrado", "parcial", "no demostrado", "desconocido"] as const;
type Dim = keyof typeof PESOS;

export function revisarAtsCorrida(d: string | undefined, c: Corrida) {
  if (!c.carpeta) throw new Error("La corrida no tiene carpeta");
  return revisarAts(join(carpetaAbs(d, c.carpeta), "CV.docx"));
}

export function registrarAts(d: string | undefined, runId: string): Corrida {
  const r = revisarAtsCorrida(d, leerCorrida(d, runId));
  actualizarCorrida(d, runId, (x) => { x.ats = { puntaje: r.puntaje, chequeos: r.chequeos, idioma: r.idioma, at: new Date().toISOString() }; });
  return reportarPaso(d, runId, "ats", r.puntaje === 100 ? "listo" : "error", {
    detalle: r.puntaje === 100 ? "100% · todos los chequeos pasan" : `${r.puntaje}% · corrige: ${r.fallas.join("; ")}`,
  });
}

export function registrarCalidad(d: string | undefined, runId: string, e: {
  dimensiones: Record<Dim, number>; cobertura: { requisito: string; estado: (typeof ESTADOS_COB)[number]; evidencia?: string }[];
  riesgos: string[]; cambios?: string;
}): Corrida {
  for (const k of Object.keys(PESOS) as Dim[]) {
    const v = e.dimensiones?.[k];
    if (typeof v !== "number" || v < 0 || v > 100) throw new Error(`${k} debe ir entre 0 y 100`);
  }
  for (const x of e.cobertura ?? []) if (!(ESTADOS_COB as readonly string[]).includes(x.estado)) throw new Error(`Estado de cobertura inválido: ${x.estado}`);
  const total = Math.round((Object.keys(PESOS) as Dim[]).reduce((s, k) => s + (PESOS[k] * e.dimensiones[k]) / 100, 0));
  const cob = e.cobertura ?? [];
  const pct = cob.length ? Math.round((100 * cob.reduce((s, x) => s + (x.estado === "demostrado" ? 1 : x.estado === "parcial" ? 0.5 : 0), 0)) / cob.length) : undefined;
  const c = actualizarCorrida(d, runId, (x) => {
    x.calidad = [...(x.calidad ?? []), { ronda: (x.calidad?.length ?? 0) + 1, total, dimensiones: { ...e.dimensiones }, cambios: e.cambios?.slice(0, 300), at: new Date().toISOString() }];
    x.cobertura = cob.map((y) => ({ ...y, requisito: y.requisito.slice(0, 200), evidencia: y.evidencia?.slice(0, 200) }));
    x.cobertura_pct = pct;
    x.riesgos = (e.riesgos ?? []).map((r) => r.slice(0, 300)).slice(0, 20);
  });
  const hist = c.calidad!.map((x) => x.total).join(" → ");
  return reportarPaso(d, runId, "calidad", total >= META ? "listo" : "alerta", { detalle: `${hist}/100${pct !== undefined ? ` · cobertura ${pct}%` : ""}` });
}
