// Almacén del tracker: única capa que toca los archivos. Escrituras atómicas, bloqueo y respaldos.
import {
  appendFileSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync,
  readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseCsv, stringifyCsv } from "./csv";
import { type Evento, type Fila, type Propuesta, validarFilas } from "./model";

const REPO = resolve(import.meta.dir, "..");
const MAX_RESPALDOS = 30;
const LOCK_HUERFANO_MS = 30_000;

export function rutas(dataDir?: string) {
  const base = join(dataDir ?? process.env.CAREER_OS_DATA ?? join(REPO, "05_Busqueda_Empleo"), "05_Tracker");
  return {
    csv: join(base, "postulaciones.csv"),
    eventos: join(base, "eventos.jsonl"),
    propuestas: join(base, "propuestas.jsonl"),
    respaldos: join(base, "respaldos"),
    lock: join(base, ".tracker.lock"),
    estadoAgente: join(base, "agente_correo_estado.json"),
    corridas: join(base, "corridas"),
    raiz: join(base, ".."),
    aprendizajes: join(base, "..", "09_Aprendizajes"),
  };
}

export function leerFilas(dataDir?: string): { columnas: string[]; filas: Fila[] } {
  const [columnas, ...resto] = parseCsv(readFileSync(rutas(dataDir).csv, "utf8"));
  const filas = resto.map((r) => Object.fromEntries(columnas.map((c, i) => [c, r[i] ?? ""])) as Fila);
  return { columnas, filas };
}

export function conLock<T>(dataDir: string | undefined, fn: () => T): T {
  const lock = rutas(dataDir).lock;
  for (let intento = 0; ; intento++) {
    try {
      closeSync(openSync(lock, "wx"));
      break;
    } catch (e: any) {
      if (e?.code !== "EEXIST") throw e;
      let edad = 0;
      try { edad = Date.now() - statSync(lock).mtimeMs; } catch { continue; }
      if (edad >= LOCK_HUERFANO_MS) { rmSync(lock, { force: true }); continue; }
      if (intento >= 20) throw new Error("El tracker está ocupado; intenta de nuevo");
      Bun.sleepSync(100);
    }
  }
  try { return fn(); } finally { rmSync(lock, { force: true }); }
}

function escribirAtomico(ruta: string, contenido: string): void {
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.${process.pid}.tmp`;
  writeFileSync(tmp, contenido);
  renameSync(tmp, ruta);
}

export function respaldar(dataDir?: string): void {
  const r = rutas(dataDir);
  if (!existsSync(r.csv)) return;
  mkdirSync(r.respaldos, { recursive: true });
  const sello = new Date().toISOString().replace(/:/g, "");
  const extra = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  copyFileSync(r.csv, join(r.respaldos, `postulaciones-${sello}-${extra}.csv`));
  const todos = readdirSync(r.respaldos).filter((f) => f.startsWith("postulaciones-")).sort();
  for (const viejo of todos.slice(0, Math.max(0, todos.length - MAX_RESPALDOS))) unlinkSync(join(r.respaldos, viejo));
}

export function escribirFilas(dataDir: string | undefined, columnas: string[], filas: Fila[]): void {
  const errores = validarFilas(filas);
  if (errores.length) throw new Error(errores.join("; "));
  respaldar(dataDir);
  escribirAtomico(rutas(dataDir).csv, stringifyCsv([columnas, ...filas.map((f) => columnas.map((c) => (f as any)[c] ?? ""))]));
}

function leerJsonl<T>(ruta: string): T[] {
  if (!existsSync(ruta)) return [];
  return readFileSync(ruta, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as T);
}

export function agregarEvento(dataDir: string | undefined, e: Evento): void {
  const ruta = rutas(dataDir).eventos;
  mkdirSync(dirname(ruta), { recursive: true });
  appendFileSync(ruta, JSON.stringify(e) + "\n");
}

export const leerEventos = (dataDir?: string) => leerJsonl<Evento>(rutas(dataDir).eventos);
export const leerPropuestas = (dataDir?: string) => leerJsonl<Propuesta>(rutas(dataDir).propuestas);

export function guardarPropuestas(dataDir: string | undefined, p: Propuesta[]): void {
  escribirAtomico(rutas(dataDir).propuestas, p.map((x) => JSON.stringify(x) + "\n").join(""));
}
