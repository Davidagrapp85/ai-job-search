// Documentos de una corrida: aprobar (con huella sha256), detectar cambios y abrir en el equipo.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { actualizarCorrida, carpetaAbs, type Corrida, type Doc, leerCorrida, validarArchivo } from "./runs";
import { setEstado } from "./tracker";

export const sha256 = (f: string) => new Bun.CryptoHasher("sha256").update(readFileSync(f)).digest("hex");

export function rutaSegura(d: string | undefined, c: Corrida, archivo: string): string {
  validarArchivo(archivo);
  if (!c.carpeta) throw new Error("La corrida todavía no tiene carpeta");
  return join(carpetaAbs(d, c.carpeta), archivo);
}

const requeridos = (d: string | undefined, c: Corrida): Doc[] => {
  const r: Doc[] = ["cv", "carta"];
  if (existsSync(rutaSegura(d, c, "respuestas.md"))) r.push("respuestas");
  return r;
};

export function aprobarDocumento(d: string | undefined, runId: string, doc: Doc): Corrida {
  const c0 = leerCorrida(d, runId);
  const f = rutaSegura(d, c0, c0.documentos[doc].archivo);
  if (!existsSync(f)) throw new Error(`${c0.documentos[doc].archivo} todavía no existe`);
  const dir = join(carpetaAbs(d, c0.carpeta!), "aprobado");
  mkdirSync(dir, { recursive: true });
  copyFileSync(f, join(dir, c0.documentos[doc].archivo));
  const huella = sha256(f);
  const c = actualizarCorrida(d, runId, (x) => { x.documentos[doc] = { ...x.documentos[doc], estado: "aprobado", sha256: huella }; });
  const listos = requeridos(d, c).every((k) => c.documentos[k].estado === "aprobado");
  if (!listos || c.estado === "aprobada" || c.estado === "enviada") return c;
  if (c.application_id) {
    try { setEstado({ dataDir: d, id: c.application_id, estado: "aprobada", actor: "david", causa: `Paquete aprobado en ${runId}` }); }
    catch (e: any) { if (e?.message !== "Sin cambios") throw e; }
  }
  return actualizarCorrida(d, runId, (x) => { x.estado = "aprobada"; });
}

export function refrescarDocumentos(d: string | undefined, c: Corrida): Corrida {
  if (!c.carpeta) return c;
  const vencidos = (Object.keys(c.documentos) as Doc[]).filter((k) => {
    const doc = c.documentos[k];
    if (doc.estado !== "aprobado" || !doc.sha256) return false;
    const f = rutaSegura(d, c, doc.archivo);
    return !existsSync(f) || sha256(f) !== doc.sha256;
  });
  if (!vencidos.length) return c;
  return actualizarCorrida(d, c.run_id, (x) => {
    for (const k of vencidos) x.documentos[k].estado = "por revisar";
    if (x.estado === "aprobada") x.estado = "esperando a David";
  });
}

export function abrirArchivo(d: string | undefined, runId: string, archivo: string, spawn: (args: string[]) => unknown = (a) => Bun.spawn(a)): void {
  const f = rutaSegura(d, leerCorrida(d, runId), archivo);
  if (!existsSync(f)) throw new Error(`${archivo} todavía no existe`);
  spawn(["open", f]);
}
