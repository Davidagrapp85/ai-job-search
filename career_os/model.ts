// Modelo del tracker: columnas, estados, tipos y validación.

export const COLUMNAS_BASE = [
  "numero", "empresa", "vacante", "eje", "link", "fecha", "puntaje", "version_cv",
  "version_carta", "estado", "proxima_accion", "fecha_proxima", "notas",
] as const;
export const COLUMNAS_NUEVAS = ["application_id", "decision", "canal", "fecha_envio"] as const;
export const COLUMNAS = [...COLUMNAS_BASE, ...COLUMNAS_NUEVAS] as const;

export const ESTADOS = [
  "detectada", "descartada", "en preparación", "aprobada", "enviada",
  "entrevista", "oferta", "rechazada", "cerrada",
] as const;
export type Estado = (typeof ESTADOS)[number];
export type Columna = (typeof COLUMNAS)[number];
export type Fila = Record<Columna, string>;

export type Actor = "david" | "claude" | "agente_correo" | "migracion";
export type Evento = {
  event_id: string; application_id: string; at: string;
  tipo: "alta" | "cambio_estado" | "edicion";
  de?: string; a?: string; actor: Actor; causa: string; ref?: string;
  campos?: Record<string, string>;
};
export type Propuesta = {
  proposal_id: string; creada: string; application_id: string; de: string; a: string;
  campos?: Record<string, string>;
  evidencia: { message_id: string; remitente: string; asunto: string; fecha: string; extracto: string };
  confianza: "alta" | "media" | "baja";
  estado: "pendiente" | "aprobada" | "rechazada"; resuelta?: string;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const clave = (f: Fila) => `${f.empresa.trim().toLowerCase()}|${f.vacante.trim().toLowerCase()}`;

export function validarFilas(filas: Fila[]): string[] {
  const errores: string[] = [];
  const claves = new Map<string, string>();
  const ids = new Set<string>();
  for (const f of filas) {
    const n = f.numero || "(sin número)";
    if (!(ESTADOS as readonly string[]).includes(f.estado)) errores.push(`${n}: estado inválido "${f.estado}"`);
    if (f.estado === "enviada") {
      if (!f.canal?.trim()) errores.push(`${n}: enviada exige canal`);
      if (!FECHA.test(f.fecha_envio ?? "")) errores.push(`${n}: enviada exige fecha_envio AAAA-MM-DD`);
    }
    const k = clave(f);
    if (claves.has(k)) errores.push(`${n}: duplicado empresa+vacante con ${claves.get(k)}`);
    else claves.set(k, n);
    if (f.application_id) {
      if (ids.has(f.application_id)) errores.push(`${n}: application_id duplicado ${f.application_id}`);
      ids.add(f.application_id);
    }
  }
  return errores;
}

export function nuevoId(prefijo: "EVT" | "PRP", ahora: Date = new Date()): string {
  const ts = ahora.toISOString().replace(/[-:]/g, "").slice(0, 15);
  const hex = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${prefijo}-${ts}-${hex}`;
}
