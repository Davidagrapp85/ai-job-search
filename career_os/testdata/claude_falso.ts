// Claude falso para pruebas: lee el prompt por stdin, reporta pasos con el CLI real y emite stream-json.
import { join } from "node:path";
const prompt = await new Response(Bun.stdin.stream()).text();
const runId = prompt.match(/RUN-[\w-]+/)?.[0];
const modo = process.env.CLAUDE_FALSO_MODO ?? "";
const cli = join(import.meta.dir, "..", "cli.ts");
const out = (o: unknown) => console.log(JSON.stringify(o));
out({ type: "system", subtype: "init", args: process.argv.slice(2) });
if (modo === "error") { console.error("fallo simulado"); process.exit(1); }
if (modo === "limite" && !process.env.ANTHROPIC_API_KEY) { console.error("Claude usage limit reached"); process.exit(1); }
const esChat = process.argv.includes("--resume") && !/Tarea: (crear el borrador|enviar el correo)/.test(prompt);
const datos = process.env.CAREER_OS_DATA ?? join(import.meta.dir, "..", "..", "05_Busqueda_Empleo");
const carpeta = join(datos, "04_Postulaciones", "099_Prueba");
const tracker = (...a: string[]) => Bun.spawnSync(["bun", cli, ...a], { env: process.env });
if (runId && prompt.includes("Tarea: crear el borrador")) {
  tracker("borrador", runId, "--draft-id", "DRAFT-DEMO");
  tracker("paso", runId, "correo", "listo", "--detalle", "Borrador listo para revisar");
}
if (runId && prompt.includes("Tarea: enviar el correo")) {
  tracker("confirmar-envio", runId, "--message-id", "MSG-DEMO", "--fecha", new Date().toISOString().slice(0, 10));
  tracker("paso", runId, "correo", "listo", "--detalle", "Enviado y verificado (simulado)");
}
if (!esChat && runId && prompt.includes("armar")) {
  const pasos = ["leer", "investigar", "encaje", "cv", "carta", "respuestas", "registro"];
  for (const p of pasos) {
    if (modo === "lento") await Bun.sleep(2000);
    const extra = p === "leer" ? ["--carpeta", "04_Postulaciones/099_Prueba"] : p === "encaje" ? ["--canal", process.env.CLAUDE_FALSO_CANAL ?? "portal"] : [];
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(carpeta, { recursive: true });
    const archivos: Record<string, string> = { leer: "vacante.md", encaje: "analisis.md", cv: "CV.docx", carta: "Carta.docx", respuestas: "respuestas.md" };
    if (archivos[p]) { writeFileSync(join(carpeta, archivos[p]), `${p} de prueba`); extra.push("--archivo", archivos[p]); }
    if (p === "registro") extra.push("--application-id", process.env.CLAUDE_FALSO_APP ?? "APP-0002");
    tracker("paso", runId, p, "listo", "--detalle", `paso ${p}`, ...extra);
    if (p === "respuestas" && (process.env.CLAUDE_FALSO_CANAL ?? "portal") === "correo") {
      writeFileSync(join(carpeta, "correo.json"), JSON.stringify({ para: ["talento@ejemplo.example"], cc: [], asunto: "Postulación — Director de Operaciones", cuerpo_html: "<p>Hola,</p><p>Adjunto mi CV y carta para el cargo de Director de Operaciones.</p><p>Saludos,<br>David</p>", adjuntos: ["CV.docx", "Carta.docx"] }));
      tracker("paso", runId, "correo", "listo", "--archivo", "correo.json", "--detalle", "Correo redactado");
    }
  }
}
out({ type: "result", subtype: "success", result: esChat ? "Listo: ajusté el perfil del CV y regeneré CV.docx." : "Postulación armada." });
