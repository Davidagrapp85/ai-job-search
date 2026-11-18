// Corridas de "Nueva aplicación": una vacante procesada por Claude, con pasos y documentos.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { nuevoId } from "./model";
import { conLock, rutas } from "./store";

export const ARCHIVOS = ["vacante.md", "analisis.md", "CV.docx", "Carta.docx", "respuestas.md", "correo.json"] as const;
export const ESTADOS_PASO = ["pendiente", "en curso", "listo", "alerta", "error"] as const;
const TITULOS: Record<string, string> = {
  leer: "Leer la vacante", investigar: "Investigar la empresa", encaje: "Encaje y alertas", cv: "CV",
  carta: "Carta", respuestas: "Respuestas de formulario", correo: "Correo de postulación", registro: "Registro en tracker",
};
const BASE = ["leer", "investigar", "encaje", "cv", "carta", "respuestas", "registro"];

export type EstadoPaso = (typeof ESTADOS_PASO)[number];
export type Paso = { id: string; titulo: string; estado: EstadoPaso; detalle?: string; archivo?: string; at?: string };
export type Doc = "cv" | "carta" | "respuestas" | "correo";
export type Corrida = {
  run_id: string; creada: string; entrada: { tipo: "url" | "texto"; valor: string }; session_id: string;
  estado: "en cola" | "en curso" | "esperando a David" | "aprobada" | "enviada" | "cerrada" | "error" | "cancelada";
  canal?: "portal" | "correo"; application_id?: string; carpeta?: string; pasos: Paso[];
  documentos: Record<Doc, { archivo: string; estado: "por revisar" | "aprobado" | "en trabajo"; sha256?: string }>;
  chat: { rol: "david" | "claude"; texto: string; at: string }[];
  envio_solicitado?: { at: string; sha256_correo: string }; draft_id?: string; sha256_borrador?: string; envio?: { message_id: string; fecha: string }; error?: string; reintento_api?: boolean;
};

const archivoCorrida = (d: string | undefined, id: string) => {
  if (!/^RUN-[\w-]+$/.test(id)) throw new Error(`No existe la corrida ${id}`);
  return join(rutas(d).corridas, `${id}.json`);
};

function guardar(d: string | undefined, c: Corrida): void {
  mkdirSync(rutas(d).corridas, { recursive: true });
  const f = archivoCorrida(d, c.run_id);
  writeFileSync(`${f}.tmp`, JSON.stringify(c, null, 2));
  renameSync(`${f}.tmp`, f);
}

export function crearCorrida(d: string | undefined, entrada: Corrida["entrada"]): Corrida {
  const c: Corrida = {
    run_id: nuevoId("EVT").replace(/^EVT/, "RUN"), creada: new Date().toISOString(), entrada,
    session_id: crypto.randomUUID(), estado: "en cola",
    pasos: BASE.map((id) => ({ id, titulo: TITULOS[id], estado: "pendiente" })),
    documentos: {
      cv: { archivo: "CV.docx", estado: "por revisar" }, carta: { archivo: "Carta.docx", estado: "por revisar" },
      respuestas: { archivo: "respuestas.md", estado: "por revisar" }, correo: { archivo: "correo.json", estado: "por revisar" },
    },
    chat: [],
  };
  conLock(d, () => guardar(d, c));
  return c;
}

export function leerCorrida(d: string | undefined, id: string): Corrida {
  const f = archivoCorrida(d, id);
  if (!existsSync(f)) throw new Error(`No existe la corrida ${id}`);
  return JSON.parse(readFileSync(f, "utf8"));
}

export function listarCorridas(d?: string): Corrida[] {
  const dir = rutas(d).corridas;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^RUN-.*\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Corrida)
    .sort((a, b) => b.creada.localeCompare(a.creada));
}

export function actualizarCorrida(d: string | undefined, id: string, fn: (c: Corrida) => void): Corrida {
  return conLock(d, () => {
    const c = leerCorrida(d, id);
    fn(c);
    guardar(d, c);
    return c;
  });
}

export function validarArchivo(nombre: string): void {
  if (!(ARCHIVOS as readonly string[]).includes(nombre)) throw new Error("Archivo no permitido");
}

/** Ruta absoluta de la carpeta de la corrida; verifica que esté dentro de 04_Postulaciones. */
export function carpetaAbs(d: string | undefined, carpeta: string): string {
  const base = resolve(rutas(d).raiz, "04_Postulaciones");
  const abs = resolve(rutas(d).raiz, carpeta);
  if (!abs.startsWith(base + sep)) throw new Error("Carpeta no permitida");
  return abs;
}

export function reportarPaso(
  d: string | undefined, id: string, pasoId: string, estado: EstadoPaso,
  o: { detalle?: string; archivo?: string; carpeta?: string; applicationId?: string; canal?: "portal" | "correo" } = {},
): Corrida {
  if (!(ESTADOS_PASO as readonly string[]).includes(estado)) throw new Error(`Estado de paso inválido: ${estado}`);
  if (o.archivo) validarArchivo(o.archivo);
  if (o.carpeta) carpetaAbs(d, o.carpeta);
  if (o.canal && !["portal", "correo"].includes(o.canal)) throw new Error(`Canal inválido: ${o.canal}`);
  return actualizarCorrida(d, id, (c) => {
    if (o.canal) {
      c.canal = o.canal;
      if (o.canal === "correo" && !c.pasos.some((p) => p.id === "correo")) {
        c.pasos.splice(c.pasos.findIndex((p) => p.id === "registro"), 0, { id: "correo", titulo: TITULOS.correo, estado: "pendiente" });
      }
    }
    const p = c.pasos.find((x) => x.id === pasoId);
    if (!p) throw new Error(`Paso desconocido: ${pasoId}`);
    p.estado = estado;
    p.at = new Date().toISOString();
    if (o.detalle !== undefined) p.detalle = o.detalle.slice(0, 300);
    if (o.archivo) p.archivo = o.archivo;
    if (o.carpeta) c.carpeta = o.carpeta;
    if (o.applicationId) c.application_id = o.applicationId;
    if (c.estado === "en cola") c.estado = "en curso";
  });
}

export function adjunto(d: string | undefined, id: string, nombre: string): { nombre: string; mime: string; base64: string } {
  validarArchivo(nombre);
  const c = leerCorrida(d, id);
  if (!c.carpeta) throw new Error("La corrida no tiene carpeta");
  const f = join(carpetaAbs(d, c.carpeta), "aprobado", nombre);
  if (!existsSync(f)) throw new Error(`${nombre} no está aprobado`);
  const mime = nombre.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain";
  return { nombre, mime, base64: readFileSync(f).toString("base64") };
}
