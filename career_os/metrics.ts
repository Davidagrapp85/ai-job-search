// Métricas del dashboard: KPIs con denominador y embudo por etapas alcanzadas (históricas).
import type { Evento, Fila } from "./model";

type Ratio = { n: number; de: number };
export type Metricas = {
  kpis: { enviadas: Ratio; conRespuesta: Ratio; entrevista: Ratio; ofertaDesdeEntrevista: Ratio; vencidas: number; diasPrimeraRespuesta: number | null };
  embudo: { etapa: string; n: number; de: number }[];
};

const RANGO: Record<string, number> = { detectada: 0, "en preparación": 1, aprobada: 2, enviada: 3, rechazada: 3, entrevista: 4, oferta: 5 };
const RESPUESTA = new Set(["entrevista", "oferta", "rechazada"]);
const FINALES = new Set(["descartada", "rechazada", "cerrada"]);

function alcanzados(f: Fila, eventos: Evento[]): Set<string> {
  const s = new Set<string>([f.estado]);
  for (const e of eventos) if (e.application_id === f.application_id && e.a) s.add(e.a);
  return s;
}

const rangoMax = (s: Set<string>) => Math.max(-1, ...[...s].map((x) => RANGO[x] ?? -1));

export function calcularMetricas(filas: Fila[], eventos: Evento[], hoy: string): Metricas {
  const info = filas.map((f) => {
    const s = alcanzados(f, eventos);
    return { f, r: rangoMax(s), respuesta: [...s].some((x) => RESPUESTA.has(x)), entrevista: s.has("entrevista") || s.has("oferta"), oferta: s.has("oferta") };
  });
  const cuenta = (p: (x: (typeof info)[number]) => boolean) => info.filter(p).length;
  const total = filas.length;
  const elegidas = cuenta((x) => x.f.decision === "user_selected");
  const prep = cuenta((x) => x.r >= 1);
  const aprob = cuenta((x) => x.r >= 2);
  const enviadas = cuenta((x) => x.r >= 3);
  const respuesta = cuenta((x) => x.respuesta);
  const entrevista = cuenta((x) => x.entrevista);
  const oferta = cuenta((x) => x.oferta);

  const dias: number[] = [];
  for (const x of info) {
    if (!x.respuesta || !x.f.fecha_envio) continue;
    const primera = eventos
      .filter((e) => e.application_id === x.f.application_id && e.a && RESPUESTA.has(e.a))
      .map((e) => e.at.slice(0, 10)).sort()[0];
    if (primera) dias.push((Date.parse(primera) - Date.parse(x.f.fecha_envio)) / 86_400_000);
  }

  return {
    kpis: {
      enviadas: { n: enviadas, de: elegidas },
      conRespuesta: { n: respuesta, de: enviadas },
      entrevista: { n: entrevista, de: enviadas },
      ofertaDesdeEntrevista: { n: oferta, de: entrevista },
      vencidas: filas.filter((f) => !FINALES.has(f.estado) && f.fecha_proxima && f.fecha_proxima < hoy).length,
      diasPrimeraRespuesta: dias.length ? Math.round((dias.reduce((a, b) => a + b, 0) / dias.length) * 10) / 10 : null,
    },
    embudo: [
      { etapa: "detectada", n: total, de: total },
      { etapa: "elegida", n: elegidas, de: total },
      { etapa: "en preparación", n: prep, de: elegidas },
      { etapa: "aprobada", n: aprob, de: prep },
      { etapa: "enviada", n: enviadas, de: aprob },
      { etapa: "respuesta", n: respuesta, de: enviadas },
      { etapa: "entrevista", n: entrevista, de: respuesta },
      { etapa: "oferta", n: oferta, de: entrevista },
    ],
  };
}
