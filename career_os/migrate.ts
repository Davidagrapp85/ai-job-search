// Migración reversible del tracker a las columnas de la Fase 1.
// Uso: bun career_os/migrate.ts [--revert]
import { copyFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { COLUMNAS, type Fila, nuevoId } from "./model";
import { agregarEvento, conLock, escribirFilas, leerFilas, rutas } from "./store";

const original = (dataDir?: string) => join(rutas(dataDir).csv.replace(/[^/]+$/, ""), "postulaciones.pre_fase1.csv");

export function migrar(dataDir?: string): { filas: number } {
  return conLock(dataDir, () => {
    const { columnas, filas } = leerFilas(dataDir);
    if (columnas.includes("application_id")) throw new Error("Ya migrado");
    copyFileSync(rutas(dataDir).csv, original(dataDir));
    const nuevas: Fila[] = filas.map((f, i) => {
      const n = { ...f, application_id: `APP-${String(i + 1).padStart(4, "0")}`, decision: f.numero.startsWith("D") ? "discovery" : "user_selected", canal: "", fecha_envio: "" } as Fila;
      if (n.estado === "enviada") {
        n.fecha_envio = n.fecha;
        n.canal = n.notas.match(/vía (\S+)/)?.[1]?.replace(/[.,;]$/, "") ?? "";
        if (!n.canal) throw new Error(`${n.numero}: enviada sin canal en notas; agrégalo antes de migrar`);
      }
      return n;
    });
    escribirFilas(dataDir, [...COLUMNAS], nuevas);
    const at = new Date().toISOString();
    for (const f of nuevas) {
      agregarEvento(dataDir, { event_id: nuevoId("EVT"), application_id: f.application_id, at, tipo: "alta", a: f.estado, actor: "migracion", causa: "Migración Fase 1", campos: f.estado === "enviada" ? { canal: f.canal, fecha_envio: f.fecha_envio } : undefined });
    }
    return { filas: nuevas.length };
  });
}

export function revertir(dataDir?: string): void {
  conLock(dataDir, () => {
    if (!existsSync(original(dataDir))) throw new Error("No hay copia previa a la migración");
    copyFileSync(original(dataDir), rutas(dataDir).csv);
    const ev = rutas(dataDir).eventos;
    if (existsSync(ev)) renameSync(ev, ev.replace(/\.jsonl$/, `.revertido-${new Date().toISOString().replace(/:/g, "")}.jsonl`));
  });
}

if (import.meta.main) {
  try {
    if (process.argv.includes("--revert")) { revertir(); console.log(JSON.stringify({ revertido: true })); }
    else console.log(JSON.stringify(migrar()));
  } catch (e: any) { console.error(e.message); process.exit(1); }
}
