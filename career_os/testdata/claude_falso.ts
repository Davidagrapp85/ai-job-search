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
const esChat = process.argv.includes("--resume");
if (!esChat && runId && prompt.includes("armar")) {
  const pasos = ["leer", "investigar", "encaje", "cv", "carta", "respuestas", "registro"];
  for (const p of pasos) {
    if (modo === "lento") await Bun.sleep(2000);
    const extra = p === "leer" ? ["--carpeta", "04_Postulaciones/099_Prueba"] : p === "encaje" ? ["--canal", process.env.CLAUDE_FALSO_CANAL ?? "portal"] : [];
    Bun.spawnSync(["bun", cli, "paso", runId, p, "listo", "--detalle", `paso ${p}`, ...extra], { env: process.env });
  }
}
out({ type: "result", subtype: "success", result: esChat ? "Listo: ajusté el perfil del CV y regeneré CV.docx." : "Postulación armada." });
