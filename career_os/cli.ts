// CLI del tracker para skills y agentes. Salida JSON; error → código 1 y mensaje en stderr.
import { parseArgs } from "node:util";
import { type Actor, type Estado } from "./model";
import { leerFilas } from "./store";
import { editar, proponer, setEstado, upsert } from "./tracker";

const AYUDA = `Uso: bun run tracker <comando> [opciones]
  list [--estado X]
  set-estado <id> <estado> --causa "…" [--canal X] [--fecha-envio AAAA-MM-DD] [--actor claude|david]
  editar <id> [--proxima-accion …] [--fecha-proxima …] [--notas …] [--canal …] [--fecha-envio …] --causa "…"
  upsert --json '<fila parcial>' --causa "…"
  propose --json '<propuesta sin id>'
  pendientes [--hoy AAAA-MM-DD]
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
      hoy: { type: "string" }, help: { type: "boolean" },
    },
  });
  const [cmd, ...args] = p;
  if (v.help || !cmd) { console.log(AYUDA); return undefined; }
  const causa = () => { if (!v.causa) throw new Error("Falta --causa"); return v.causa; };
  const actor = (v.actor ?? "claude") as Actor;
  if (!["claude", "david"].includes(actor)) throw new Error("--actor debe ser claude o david");
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
      if (!v.json) throw new Error("Falta --json");
      return upsert({ fila: JSON.parse(v.json), actor, causa: causa() });
    case "propose":
      if (!v.json) throw new Error("Falta --json");
      return proponer({ p: JSON.parse(v.json) });
    case "pendientes": {
      const hoy = v.hoy ?? new Date().toISOString().slice(0, 10);
      const limite = sumarDias(hoy, 7);
      return leerFilas().filas.filter((f) => !FINALES.has(f.estado) && f.fecha_proxima && f.fecha_proxima <= limite);
    }
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
