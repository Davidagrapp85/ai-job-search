// Operaciones del tracker. Todas las escrituras pasan por aquí, dentro del bloqueo.
import { type Actor, COLUMNAS, type Estado, type Evento, type Fila, nuevoId, type Propuesta } from "./model";
import { agregarEvento, conLock, escribirFilas, guardarPropuestas, leerFilas, leerPropuestas } from "./store";

type Editable = "proxima_accion" | "fecha_proxima" | "notas" | "canal" | "fecha_envio";

function cargar(dataDir?: string) {
  const t = leerFilas(dataDir);
  if (!t.columnas.includes("application_id")) throw new Error("El tracker no está migrado; corre bun career_os/migrate.ts");
  return t;
}

function buscar(filas: Fila[], id: string): Fila {
  const f = filas.find((x) => x.application_id === id || x.numero === id);
  if (!f) throw new Error(`No existe la postulación ${id}`);
  return f;
}

function evento(f: Fila, parcial: Omit<Evento, "event_id" | "application_id" | "at">): Evento {
  return { event_id: nuevoId("EVT"), application_id: f.application_id, at: new Date().toISOString(), ...parcial };
}

type SetEstadoOpts = {
  dataDir?: string; id: string; estado: Estado; actor: Actor; causa: string;
  canal?: string; fechaEnvio?: string; ref?: string;
};

function setEstadoSinLock(o: SetEstadoOpts): Evento {
  const { columnas, filas } = cargar(o.dataDir);
  const f = buscar(filas, o.id);
  if (f.estado === o.estado) throw new Error("Sin cambios");
  const de = f.estado;
  const campos: Record<string, string> = {};
  if (o.canal !== undefined) { f.canal = o.canal; campos.canal = o.canal; }
  if (o.fechaEnvio !== undefined) { f.fecha_envio = o.fechaEnvio; campos.fecha_envio = o.fechaEnvio; }
  f.estado = o.estado;
  escribirFilas(o.dataDir, columnas, filas);
  const e = evento(f, { tipo: "cambio_estado", de, a: o.estado, actor: o.actor, causa: o.causa, ref: o.ref, campos: Object.keys(campos).length ? campos : undefined });
  agregarEvento(o.dataDir, e);
  return e;
}

export function setEstado(o: SetEstadoOpts): Evento {
  return conLock(o.dataDir, () => setEstadoSinLock(o));
}

export function editar(o: { dataDir?: string; id: string; campos: Partial<Pick<Fila, Editable>>; actor: Actor; causa: string }): Evento {
  return conLock(o.dataDir, () => {
    const { columnas, filas } = cargar(o.dataDir);
    const f = buscar(filas, o.id);
    const permitidos: Editable[] = ["proxima_accion", "fecha_proxima", "notas", "canal", "fecha_envio"];
    const campos: Record<string, string> = {};
    for (const k of permitidos) if (o.campos[k] !== undefined) { f[k] = o.campos[k]!; campos[k] = o.campos[k]!; }
    if (!Object.keys(campos).length) throw new Error("Sin cambios");
    escribirFilas(o.dataDir, columnas, filas);
    const e = evento(f, { tipo: "edicion", actor: o.actor, causa: o.causa, campos });
    agregarEvento(o.dataDir, e);
    return e;
  });
}

const clave = (empresa = "", vacante = "") => `${empresa.trim().toLowerCase()}|${vacante.trim().toLowerCase()}`;

export function upsert(o: { dataDir?: string; fila: Partial<Fila>; actor: Actor; causa: string }): { fila: Fila; evento: Evento } {
  return conLock(o.dataDir, () => {
    const { columnas, filas } = cargar(o.dataDir);
    const k = clave(o.fila.empresa, o.fila.vacante);
    const existente = filas.find((x) => clave(x.empresa, x.vacante) === k);
    if (existente) {
      const de = existente.estado;
      const { application_id: _ignorado, ...resto } = o.fila;
      Object.assign(existente, resto);
      escribirFilas(o.dataDir, columnas, filas);
      const e = evento(existente, de !== existente.estado
        ? { tipo: "cambio_estado", de, a: existente.estado, actor: o.actor, causa: o.causa, campos: resto as Record<string, string> }
        : { tipo: "edicion", actor: o.actor, causa: o.causa, campos: resto as Record<string, string> });
      agregarEvento(o.dataDir, e);
      return { fila: existente, evento: e };
    }
    const max = filas.reduce((m, x) => Math.max(m, Number(x.application_id.replace("APP-", "")) || 0), 0);
    const nueva = Object.fromEntries(COLUMNAS.map((c) => [c, ""])) as Fila;
    Object.assign(nueva, o.fila, { application_id: `APP-${String(max + 1).padStart(4, "0")}` });
    if (!nueva.decision) nueva.decision = nueva.numero.startsWith("D") ? "discovery" : "user_selected";
    filas.push(nueva);
    escribirFilas(o.dataDir, columnas, filas);
    const e = evento(nueva, { tipo: "alta", a: nueva.estado, actor: o.actor, causa: o.causa });
    agregarEvento(o.dataDir, e);
    return { fila: nueva, evento: e };
  });
}

export function proponer(o: { dataDir?: string; p: Omit<Propuesta, "proposal_id" | "creada" | "estado"> }): Propuesta | null {
  return conLock(o.dataDir, () => {
    const todas = leerPropuestas(o.dataDir);
    if (todas.some((x) => x.evidencia.message_id === o.p.evidencia.message_id)) return null;
    buscar(cargar(o.dataDir).filas, o.p.application_id);
    const p: Propuesta = {
      ...o.p,
      evidencia: { ...o.p.evidencia, extracto: o.p.evidencia.extracto.slice(0, 200) },
      proposal_id: nuevoId("PRP"), creada: new Date().toISOString(), estado: "pendiente",
    };
    guardarPropuestas(o.dataDir, [...todas, p]);
    return p;
  });
}

export function resolverPropuesta(o: { dataDir?: string; proposalId: string; decision: "aprobar" | "rechazar" }): Propuesta {
  return conLock(o.dataDir, () => {
    const todas = leerPropuestas(o.dataDir);
    const p = todas.find((x) => x.proposal_id === o.proposalId);
    if (!p) throw new Error(`No existe la propuesta ${o.proposalId}`);
    if (p.estado !== "pendiente") return p;
    if (o.decision === "aprobar") {
      try {
        setEstadoSinLock({
          dataDir: o.dataDir, id: p.application_id, estado: p.a as Estado, actor: "agente_correo",
          causa: `Correo: ${p.evidencia.asunto}`.slice(0, 120), ref: p.proposal_id,
          canal: p.campos?.canal, fechaEnvio: p.campos?.fecha_envio,
        });
      } catch (e: any) {
        if (e?.message !== "Sin cambios") throw e;
      }
    }
    p.estado = o.decision === "aprobar" ? "aprobada" : "rechazada";
    p.resuelta = new Date().toISOString();
    guardarPropuestas(o.dataDir, todas);
    return p;
  });
}
