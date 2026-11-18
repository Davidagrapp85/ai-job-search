// Aprendizajes: propuestas derivadas de los cambios de David; solo se aplican con su aprobación.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nuevoId } from "./model";
import { conLock, rutas } from "./store";

export const TIPOS = ["hecho", "redaccion", "enfasis", "estructura", "keyword", "correccion", "estilo"] as const;
export const ALCANCES = ["vacante", "familia", "compartido", "experimental"] as const;
const DESTINO = /^(01_Perfil\/(banco_evidencias|cv_base|narrativa)\.md|02_Configuracion\/ejes\/[a-z0-9-]+\.md)$/;

export type Aprendizaje = {
  learning_id: string; run_id: string; application_id: string; tipo: (typeof TIPOS)[number];
  antes: string; despues: string; motivo: string; alcance: (typeof ALCANCES)[number]; destino: string;
  estado: "pendiente" | "aprobado" | "solo vacante" | "rechazado" | "por validar" | "aplicado"; creada: string; resuelta?: string;
};

const archivo = (d?: string) => join(rutas(d).aprendizajes, "pendientes.jsonl");

function leer(d?: string): Aprendizaje[] {
  const f = archivo(d);
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
function guardar(d: string | undefined, xs: Aprendizaje[]): void {
  mkdirSync(rutas(d).aprendizajes, { recursive: true });
  writeFileSync(`${archivo(d)}.tmp`, xs.map((x) => JSON.stringify(x) + "\n").join(""));
  renameSync(`${archivo(d)}.tmp`, archivo(d));
}

export function proponerAprendizaje(d: string | undefined, a: Omit<Aprendizaje, "learning_id" | "estado" | "creada">): Aprendizaje {
  if (!(TIPOS as readonly string[]).includes(a.tipo)) throw new Error(`Tipo inválido: ${a.tipo}`);
  if (!(ALCANCES as readonly string[]).includes(a.alcance)) throw new Error(`Alcance inválido: ${a.alcance}`);
  if (!DESTINO.test(a.destino)) throw new Error(`Destino no permitido: ${a.destino}`);
  return conLock(d, () => {
    const nuevo: Aprendizaje = {
      ...a, antes: a.antes.slice(0, 2000), despues: a.despues.slice(0, 2000), motivo: a.motivo.slice(0, 500),
      learning_id: nuevoId("PRP").replace(/^PRP/, "APR"), estado: "pendiente", creada: new Date().toISOString(),
    };
    guardar(d, [...leer(d), nuevo]);
    return nuevo;
  });
}

export const listarAprendizajes = (d?: string, estado?: string) => leer(d).filter((x) => !estado || x.estado === estado);

/** Devuelve si hay que lanzar la corrida que aplica el cambio al brain. */
export function resolverAprendizaje(d: string | undefined, id: string, decision: "aprobar" | "solo vacante" | "rechazar"): { aprendizaje: Aprendizaje; aplicar: boolean } {
  return conLock(d, () => {
    const xs = leer(d);
    const a = xs.find((x) => x.learning_id === id);
    if (!a) throw new Error(`No existe el aprendizaje ${id}`);
    if (a.estado !== "pendiente") return { aprendizaje: a, aplicar: false };
    a.estado = decision === "rechazar" ? "rechazado" : decision === "solo vacante" ? "solo vacante" : a.tipo === "hecho" ? "por validar" : "aprobado";
    a.resuelta = new Date().toISOString();
    guardar(d, xs);
    appendFileSync(join(rutas(d).aprendizajes, "decisiones.jsonl"), JSON.stringify({ learning_id: id, decision, estado: a.estado, at: a.resuelta }) + "\n");
    return { aprendizaje: a, aplicar: a.estado === "aprobado" };
  });
}

export function marcarAplicado(d: string | undefined, id: string, diff: string): Aprendizaje {
  return conLock(d, () => {
    const xs = leer(d);
    const a = xs.find((x) => x.learning_id === id);
    if (!a || a.estado !== "aprobado") throw new Error("Solo se aplica un aprendizaje aprobado");
    a.estado = "aplicado";
    guardar(d, xs);
    appendFileSync(join(rutas(d).aprendizajes, "decisiones.jsonl"), JSON.stringify({ learning_id: id, decision: "aplicado", diff: diff.slice(0, 5000), at: new Date().toISOString() }) + "\n");
    return a;
  });
}
