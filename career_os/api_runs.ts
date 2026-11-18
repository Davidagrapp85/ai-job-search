// Rutas /api/runs/* de "Nueva aplicación". Devuelven null si la ruta no es suya.
import { existsSync } from "node:fs";
import { abrirArchivo, aprobarDocumento, refrescarDocumentos, rutaSegura } from "./docs";
import { plantilla, promptArmar, type Runner } from "./runner";
import { actualizarCorrida, crearCorrida, type Doc, leerCorrida, listarCorridas } from "./runs";
import { solicitarEnvio, vistaCorreo } from "./correo";
import { listarAprendizajes, resolverAprendizaje } from "./learnings";
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { carpetaAbs } from "./runs";

export type Ctx = { dataDir?: string; runner: Runner; spawn?: (a: string[]) => unknown };
const json = (data: unknown, status = 200) => Response.json(data, { status });
const DOCS: Doc[] = ["cv", "carta", "respuestas", "correo"];

export async function rutasCorridas(req: Request, p: string, ctx: Ctx): Promise<Response | null> {
  const d = ctx.dataDir;
  if (p === "/api/runs" && req.method === "GET") {
    return json(listarCorridas(d).map((c) => ({ ...c, en_cola: ctx.runner.pendientes().includes(c.run_id), activa: ctx.runner.activo() === c.run_id })));
  }
  if (p === "/api/runs" && req.method === "POST") {
    const b = (await req.json()) as { tipo?: string; valor?: string };
    const valor = (b.valor ?? "").trim();
    if (!valor) throw new Error("Pega el link o el texto de la vacante");
    if (valor.length > 60_000) throw new Error("El texto es demasiado largo (máximo 60.000 caracteres)");
    const tipo = /^https?:\/\/\S+$/.test(valor) ? "url" : "texto";
    const c = crearCorrida(d, { tipo, valor });
    ctx.runner.encolar(c.run_id, "armar", promptArmar(c));
    return json(c);
  }
  if (p === "/api/learnings" && req.method === "GET") return json(listarAprendizajes(d, new URL(req.url).searchParams.get("estado") ?? undefined));
  const ml = p.match(/^\/api\/learnings\/(APR-[\w-]+)\/(aprobar|solo-vacante|rechazar)$/);
  if (ml && req.method === "POST") {
    const r = resolverAprendizaje(d, ml[1], ml[2] === "solo-vacante" ? "solo vacante" : (ml[2] as "aprobar" | "rechazar"));
    if (r.aplicar) {
      const a = r.aprendizaje;
      ctx.runner.encolar(a.run_id, "aplicar", plantilla("aplicar_aprendizaje.md", { learning_id: a.learning_id, destino: a.destino, tipo: a.tipo, alcance: a.alcance, antes: a.antes, despues: a.despues, motivo: a.motivo }));
    }
    return json(r.aprendizaje);
  }
  const m = p.match(/^\/api\/runs\/(RUN-[\w-]+)(?:\/(.+))?$/);
  if (!m) return null;
  const [, id, sub] = m;
  if (!sub && req.method === "GET") return json(refrescarDocumentos(d, leerCorrida(d, id)));
  if (sub === "seguir" && req.method === "GET") {
    const c = leerCorrida(d, id);
    const pasos = c.pasos.map((x) => `- ${x.titulo}: ${x.estado}${x.detalle ? ` (${x.detalle})` : ""}`).join("\n");
    return json({
      comando: `cd ~/05_ai_job_search && claude --resume ${c.session_id}`,
      contexto: `Sigamos con la postulación de la corrida ${c.run_id} (${c.application_id ?? "sin registrar"}).\nCarpeta: 05_Busqueda_Empleo/${c.carpeta ?? "(pendiente)"}\nEstado: ${c.estado}\n${pasos}\nUsa las skills empleo-armar-postulacion y empleo-tracker; el tracker solo con bun run tracker.`,
    });
  }
  const archivo = sub?.match(/^archivo\/([^/]+)$/);
  if (archivo && req.method === "GET") {
    const nombre = decodeURIComponent(archivo[1]);
    const f = rutaSegura(d, leerCorrida(d, id), nombre);
    if (!existsSync(f)) return json({ error: "Todavía no existe" }, 404);
    return new Response(Bun.file(f), { headers: { "content-disposition": `attachment; filename="${nombre}"` } });
  }
  if (sub === "correo" && req.method === "GET") return json(vistaCorreo(d, id));
  if (req.method !== "POST") return null;
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  switch (sub) {
    case "cancelar": ctx.runner.cancelar(id); return json(leerCorrida(d, id));
    case "aprobar":
      if (!DOCS.includes(b.doc as Doc)) throw new Error("Documento inválido");
      return json(aprobarDocumento(d, id, b.doc as Doc));
    case "correo/borrador": {
      const c = refrescarDocumentos(d, leerCorrida(d, id));
      if (c.documentos.cv.estado !== "aprobado" || c.documentos.carta.estado !== "aprobado") throw new Error("Aprueba la CV y la carta antes de crear el borrador");
      vistaCorreo(d, id);
      ctx.runner.encolar(id, "borrador", plantilla("borrador_correo.md", { run_id: id, carpeta: c.carpeta ?? "" }));
      return json({ ok: true });
    }
    case "correo/enviar": {
      const c = solicitarEnvio(d, id, b.sha256 ?? "");
      const v = vistaCorreo(d, id);
      ctx.runner.encolar(id, "enviar", plantilla("enviar_correo.md", { run_id: id, draft_id: c.draft_id ?? "", asunto: v.asunto, para: v.para.join(", ") }));
      return json({ ok: true });
    }
    case "cerrar": {
      const c = leerCorrida(d, id);
      if (!c.carpeta) throw new Error("La corrida no tiene carpeta");
      const dir = carpetaAbs(d, c.carpeta);
      if (!existsSync(join(dir, "content.v1.json")) && existsSync(join(dir, "content.json"))) copyFileSync(join(dir, "content.json"), join(dir, "content.v1.json"));
      ctx.runner.encolar(id, "aprendizajes", plantilla("aprendizajes.md", { run_id: id, carpeta: c.carpeta, application_id: c.application_id ?? "" }));
      return json(actualizarCorrida(d, id, (x) => { if (x.estado !== "enviada") x.estado = "cerrada"; }));
    }
    case "abrir": abrirArchivo(d, id, b.archivo ?? "", ctx.spawn); return json({ ok: true });
    case "chat": {
      const texto = (b.texto ?? "").trim();
      if (!texto) throw new Error("Escribe un mensaje");
      const doc = DOCS.includes(b.documento as Doc) ? (b.documento as Doc) : "cv";
      const c = actualizarCorrida(d, id, (x) => {
        x.chat.push({ rol: "david", texto: texto.slice(0, 4000), at: new Date().toISOString() });
        x.documentos[doc].estado = "en trabajo";
      });
      ctx.runner.encolar(id, "chat", plantilla("chat.md", { run_id: id, documento: doc, carpeta: `05_Busqueda_Empleo/${c.carpeta ?? ""}`, mensaje: texto }));
      return json(c);
    }
  }
  return null;
}
