// Servidor local del dashboard. Escucha solo en 127.0.0.1. Uso: bun run dashboard:start
import { existsSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { calcularMetricas } from "./metrics";
import type { Estado } from "./model";
import { leerEventos, leerFilas, leerPropuestas } from "./store";
import { editar, resolverPropuesta, setEstado } from "./tracker";
import { rutasCorridas } from "./api_runs";
import { Runner } from "./runner";

const PUBLIC = resolve(import.meta.dir, "public");
const json = (data: unknown, status = 200) => Response.json(data, { status });

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function estatico(pathname: string): Response {
  let ruta: string;
  try { ruta = decodeURIComponent(pathname); } catch { return new Response("No encontrado", { status: 404 }); }
  if (ruta === "/") ruta = "/index.html";
  const archivo = resolve(PUBLIC, "." + ruta);
  if (!archivo.startsWith(PUBLIC + sep) || !existsSync(archivo) || !statSync(archivo).isFile()) {
    return new Response("No encontrado", { status: 404 });
  }
  return new Response(Bun.file(archivo));
}

/** Manejador HTTP sin red: el servidor lo usa y las pruebas lo llaman directo. */
export function crearManejador(opts: { dataDir?: string; port: () => number; runner?: Runner; spawn?: (a: string[]) => unknown }) {
  const d = opts.dataDir;
  const runner = opts.runner ?? new Runner({ dataDir: d });
  return async function manejar(req: Request): Promise<Response> {
      const url = new URL(req.url);
      const port = opts.port();
      const locales = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!locales.includes(req.headers.get("host") ?? "")) return json({ error: "Host no permitido" }, 403);
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin") ?? "";
        if (!locales.map((h) => `http://${h}`).includes(origin)) return json({ error: "Origen no permitido" }, 403);
      }
      try {
        const p = url.pathname;
        if (req.method === "GET" && p === "/api/applications") return json(leerFilas(d).filas);
        if (req.method === "GET" && p === "/api/events") {
          const id = url.searchParams.get("id");
          return json(leerEventos(d).filter((e) => !id || e.application_id === id));
        }
        if (req.method === "GET" && p === "/api/metrics") return json(calcularMetricas(leerFilas(d).filas, leerEventos(d), hoyLocal()));
        if (req.method === "GET" && p === "/api/proposals") {
          const estado = url.searchParams.get("estado");
          return json(leerPropuestas(d).filter((x) => !estado || x.estado === estado));
        }
        let m = p.match(/^\/api\/applications\/([^/]+)\/(estado|editar)$/);
        if (req.method === "POST" && m) {
          const b = (await req.json()) as Record<string, string>;
          const id = decodeURIComponent(m[1]);
          if (m[2] === "estado") {
            return json(setEstado({ dataDir: d, id, estado: b.estado as Estado, actor: "david", causa: b.causa || "Cambio desde el dashboard", canal: b.canal || undefined, fechaEnvio: b.fecha_envio || undefined }));
          }
          return json(editar({ dataDir: d, id, actor: "david", causa: b.causa || "Edición desde el dashboard", campos: { proxima_accion: b.proxima_accion, fecha_proxima: b.fecha_proxima, notas: b.notas } }));
        }
        m = p.match(/^\/api\/proposals\/([^/]+)\/(aprobar|rechazar)$/);
        if (req.method === "POST" && m) return json(resolverPropuesta({ dataDir: d, proposalId: decodeURIComponent(m[1]), decision: m[2] as "aprobar" | "rechazar" }));
        if (p.startsWith("/api/runs")) {
          const r = await rutasCorridas(req, p, { dataDir: d, runner, spawn: opts.spawn });
          if (r) return r;
        }
        if (p.startsWith("/api/")) return json({ error: "Ruta no encontrada" }, 404);
        if (req.method === "GET") return estatico(p);
        return json({ error: "Método no permitido" }, 405);
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        return json({ error: msg }, msg.includes("ocupado") ? 409 : 400);
      }
  };
}

export function crearServidor(opts: { dataDir?: string; port?: number } = {}) {
  let server: ReturnType<typeof Bun.serve>;
  const manejar = crearManejador({ dataDir: opts.dataDir, port: () => server.port });
  server = Bun.serve({ hostname: "127.0.0.1", port: opts.port ?? Number(process.env.CAREER_OS_PORT ?? 4173), fetch: manejar });
  return server;
}

if (import.meta.main) {
  const s = crearServidor();
  console.log(`Career OS en http://127.0.0.1:${s.port}  (Ctrl+C para detener)`);
}
