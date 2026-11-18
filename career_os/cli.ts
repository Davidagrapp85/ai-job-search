// CLI del tracker para skills y agentes. Salida JSON; error → código 1 y mensaje en stderr.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { type Actor, type Estado } from "./model";
import { leerFilas } from "./store";
import { editar, proponer, setEstado, upsert } from "./tracker";
import { adjunto, type EstadoPaso, reportarPaso } from "./runs";
import { confirmarEnvio, registrarBorrador } from "./correo";
import { marcarAplicado, proponerAprendizaje } from "./learnings";
import { registrarAts, registrarCalidad } from "./calidad";

const AYUDA = `Uso: bun run tracker <comando> [opciones]
  list [--estado X]
  set-estado <id> <estado> --causa "…" [--canal X] [--fecha-envio AAAA-MM-DD] [--actor claude|david]
  editar <id> [--proxima-accion …] [--fecha-proxima …] [--notas …] [--canal …] [--fecha-envio …] --causa "…"
  upsert --json '<fila parcial>' --causa "…"
  propose --json-file <ruta.json>   (o --json '<…>'; los agentes usan --json-file)
  pendientes [--hoy AAAA-MM-DD]
  paso <run_id> <paso_id> <pendiente|en curso|listo|alerta|error> [--detalle] [--archivo] [--carpeta] [--application-id] [--canal portal|correo]
  ats <run_id>   (legibilidad ATS del CV; debe dar 100)
  calidad <run_id> --json-file X   (nota de 5 variables; ver prompts/armar_postulacion.md)
  adjunto <run_id> <archivo>   (base64 de un archivo aprobado de la corrida)
  borrador <run_id> --draft-id X
  aprendizaje --json-file X
  aprendizaje-aplicado <learning_id> --diff-file X
  confirmar-envio <run_id> --message-id X --fecha AAAA-MM-DD   (solo tras el clic de David en Enviar)
<id> acepta application_id (APP-0001) o numero (001, D002).`;

export const FINALES = new Set(["descartada", "rechazada", "cerrada"]);

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function main(argv: string[]): unknown {
  const { values: v, positionals: p } = parseArgs({
    args: argv, allowPositionals: true,
    options: {
      estado: { type: "string" }, causa: { type: "string" }, canal: { type: "string" },
      "fecha-envio": { type: "string" }, actor: { type: "string" }, json: { type: "string" },
      "proxima-accion": { type: "string" }, "fecha-proxima": { type: "string" }, notas: { type: "string" },
      hoy: { type: "string" }, help: { type: "boolean" }, "json-file": { type: "string" },
      detalle: { type: "string" }, archivo: { type: "string" }, carpeta: { type: "string" },
      "application-id": { type: "string" }, puntaje: { type: "string" }, "draft-id": { type: "string" }, "message-id": { type: "string" },
      fecha: { type: "string" }, "diff-file": { type: "string" },
    },
  });
  const [cmd, ...args] = p;
  if (v.help || !cmd) { console.log(AYUDA); return undefined; }
  const leerJson = () => {
    if (v["json-file"]) return JSON.parse(readFileSync(v["json-file"], "utf8"));
    if (v.json) return JSON.parse(v.json);
    throw new Error("Falta --json o --json-file");
  };
  const causa = () => { if (!v.causa) throw new Error("Falta --causa"); return v.causa; };
  const actor = (v.actor ?? "claude") as Actor;
  if (!["claude", "david"].includes(actor)) throw new Error("--actor debe ser claude o david");
  const agente = process.env.CAREER_OS_RUN_ID;
  const tipoAgente = process.env.CAREER_OS_RUN_TIPO;
  const soloMiCorrida = (id: string) => { if (agente && id !== agente) throw new Error("No puedes escribir en otra corrida"); };
  const exigeTipo = (tipo: string, cmdNombre: string) => {
    if (tipoAgente !== tipo) throw new Error(`${cmdNombre} se usa solo en la corrida de ${tipo === "enviar" ? "envío" : tipo}`);
  };
  if (["paso", "adjunto", "borrador", "confirmar-envio", "ats", "calidad"].includes(cmd)) soloMiCorrida(args[0] ?? "");
  if (cmd === "adjunto" || cmd === "borrador") exigeTipo("borrador", cmd);
  if (cmd === "confirmar-envio") exigeTipo("enviar", cmd);
  if (cmd === "aprendizaje-aplicado") exigeTipo("aplicar", cmd);
  switch (cmd) {
    case "list": {
      const filas = leerFilas().filas;
      return v.estado ? filas.filter((f) => f.estado === v.estado) : filas;
    }
    case "set-estado":
      if (args.length < 2) throw new Error("Uso: set-estado <id> <estado>");
      return setEstado({ id: args[0], estado: args[1] as Estado, actor, causa: causa(), canal: v.canal, fechaEnvio: v["fecha-envio"] });
    case "editar":
      if (!args[0]) throw new Error("Uso: editar <id>");
      return editar({ id: args[0], actor, causa: causa(), campos: {
        proxima_accion: v["proxima-accion"], fecha_proxima: v["fecha-proxima"], notas: v.notas,
        canal: v.canal, fecha_envio: v["fecha-envio"],
      } });
    case "upsert":
      return upsert({ fila: leerJson(), actor, causa: causa() });
    case "propose":
      return proponer({ p: leerJson() });
    case "pendientes": {
      const hoy = v.hoy ?? new Date().toISOString().slice(0, 10);
      const limite = sumarDias(hoy, 7);
      return leerFilas().filas.filter((f) => !FINALES.has(f.estado) && f.fecha_proxima && f.fecha_proxima <= limite);
    }
    case "paso":
      if (args.length < 3) throw new Error("Uso: paso <run_id> <paso_id> <estado>");
      return reportarPaso(undefined, args[0], args[1], args[2] as EstadoPaso, {
        detalle: v.detalle, archivo: v.archivo, carpeta: v.carpeta, applicationId: v["application-id"],
        canal: v.canal as "portal" | "correo" | undefined, puntaje: v.puntaje !== undefined ? Number(v.puntaje) : undefined,
      });
    case "ats":
      if (!args[0]) throw new Error("Uso: ats <run_id>");
      return registrarAts(undefined, args[0]);
    case "calidad":
      if (!args[0]) throw new Error("Uso: calidad <run_id> --json-file X");
      return registrarCalidad(undefined, args[0], leerJson());
    case "adjunto":
      if (args.length < 2) throw new Error("Uso: adjunto <run_id> <archivo>");
      return adjunto(undefined, args[0], args[1]);
    case "borrador":
      if (!args[0] || !v["draft-id"]) throw new Error("Uso: borrador <run_id> --draft-id X");
      return registrarBorrador(undefined, args[0], v["draft-id"]);
    case "confirmar-envio":
      if (!args[0] || !v["message-id"] || !v.fecha) throw new Error("Uso: confirmar-envio <run_id> --message-id X --fecha AAAA-MM-DD");
      return confirmarEnvio(undefined, args[0], v["message-id"], v.fecha);
    case "aprendizaje": {
      const a = leerJson();
      if (agente && a.run_id !== agente) throw new Error("No puedes escribir en otra corrida");
      return proponerAprendizaje(undefined, a);
    }
    case "aprendizaje-aplicado":
      if (!args[0] || !v["diff-file"]) throw new Error("Uso: aprendizaje-aplicado <learning_id> --diff-file X");
      return marcarAplicado(undefined, args[0], readFileSync(v["diff-file"], "utf8"));
    default:
      throw new Error(`Comando desconocido: ${cmd}\n${AYUDA}`);
  }
}

if (import.meta.main) {
  try {
    const r = main(process.argv.slice(2));
    if (r !== undefined) console.log(JSON.stringify(r, null, 2));
  } catch (e: any) {
    console.error(e?.message ?? String(e));
    process.exit(1);
  }
}
