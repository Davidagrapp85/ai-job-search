// Correo de postulación: vista previa segura, borrador y envío solo con el clic de David.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { refrescarDocumentos, rutaSegura, sha256 } from "./docs";
import { actualizarCorrida, carpetaAbs, type Corrida, leerCorrida } from "./runs";
import { setEstado } from "./tracker";

type CorreoJson = { para: string[]; cc?: string[]; asunto: string; cuerpo_html: string; adjuntos: string[] };

export function htmlATexto(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "‹").replace(/&gt;/g, "›").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n").trim();
}

function motivoNoEnviar(d: string | undefined, c: Corrida, sha: string): string | undefined {
  if (c.canal !== "correo") return "Esta vacante no se postula por correo";
  if (c.estado === "enviada" || c.envio) return "Ya se envió";
  if (c.envio_solicitado) return "El envío ya se solicitó; revisa Elementos enviados antes de reintentar";
  const fresca = refrescarDocumentos(d, c);
  if (fresca.documentos.cv.estado !== "aprobado" || fresca.documentos.carta.estado !== "aprobado") return "Aprueba la CV y la carta (vigentes) antes de enviar";
  for (const k of ["cv", "carta"] as const) {
    const ap = join(carpetaAbs(d, c.carpeta!), "aprobado", fresca.documentos[k].archivo);
    if (!existsSync(ap) || sha256(ap) !== fresca.documentos[k].sha256) return `La copia aprobada de ${fresca.documentos[k].archivo} cambió; apruébala de nuevo`;
  }
  if (!c.draft_id) return "Falta crear el borrador en Outlook";
  if (c.sha256_borrador !== sha) return "El correo cambió después de crear el borrador; vuelve a crearlo";
  return undefined;
}

export function vistaCorreo(d: string | undefined, runId: string) {
  const c = leerCorrida(d, runId);
  const f = rutaSegura(d, c, "correo.json");
  if (!existsSync(f)) throw new Error("Todavía no hay correo redactado");
  const j = JSON.parse(readFileSync(f, "utf8")) as CorreoJson;
  const dir = carpetaAbs(d, c.carpeta!);
  const adjuntos = (j.adjuntos ?? []).map((nombre) => {
    const ap = join(dir, "aprobado", nombre);
    return { nombre, bytes: existsSync(ap) ? statSync(ap).size : null, aprobado: existsSync(ap) };
  });
  const sha = sha256(f);
  const motivo = motivoNoEnviar(d, leerCorrida(d, runId), sha);
  return {
    para: j.para ?? [], cc: j.cc ?? [], asunto: j.asunto ?? "", cuerpo_texto: htmlATexto(j.cuerpo_html ?? ""),
    adjuntos, draft_id: c.draft_id, sha256: sha, puedeEnviar: !motivo, motivo, envio: c.envio,
  };
}

export function registrarBorrador(d: string | undefined, runId: string, draftId: string): Corrida {
  const c = leerCorrida(d, runId);
  const sha = sha256(rutaSegura(d, c, "correo.json"));
  return actualizarCorrida(d, runId, (x) => { x.draft_id = draftId; x.sha256_borrador = sha; });
}

export function solicitarEnvio(d: string | undefined, runId: string, shaVisto: string): Corrida {
  const c0 = refrescarDocumentos(d, leerCorrida(d, runId));
  const sha = sha256(rutaSegura(d, c0, "correo.json"));
  if (sha !== shaVisto) throw new Error("El correo cambió desde la vista previa; revísalo de nuevo");
  const motivo = motivoNoEnviar(d, c0, sha);
  if (motivo) throw new Error(motivo);
  // Verificar y marcar dentro del mismo bloqueo: dos clics no producen dos envíos.
  return actualizarCorrida(d, runId, (x) => {
    if (x.envio_solicitado || x.envio) throw new Error("El envío ya se solicitó");
    x.envio_solicitado = { at: new Date().toISOString(), sha256_correo: sha };
  });
}

export function confirmarEnvio(d: string | undefined, runId: string, messageId: string, fecha: string): Corrida {
  const c = leerCorrida(d, runId);
  if (!c.envio_solicitado) throw new Error("Corrida sin solicitud de envío de David; no se registra");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("fecha debe ser AAAA-MM-DD");
  if (!c.application_id) throw new Error("La corrida no está registrada en el tracker");
  try {
    setEstado({ dataDir: d, id: c.application_id, estado: "enviada", actor: "claude", causa: `Correo enviado y verificado (${runId})`, canal: "correo", fechaEnvio: fecha, ref: messageId });
  } catch (e: any) { if (e?.message !== "Sin cambios") throw e; }
  return actualizarCorrida(d, runId, (x) => { x.estado = "enviada"; x.envio = { message_id: messageId, fecha }; });
}
