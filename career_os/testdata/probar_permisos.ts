// Prueba real y barata (modelo haiku) de los permisos de escritura de una corrida "armar".
// Uso: bun career_os/testdata/probar_permisos.ts
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { argsClaude } from "../runner";

const REPO = resolve(import.meta.dir, "..", "..");
const permitido = join(REPO, "05_Busqueda_Empleo", "04_Postulaciones", "_prueba_permisos", "ok.md");
const prohibido = join(REPO, "05_Busqueda_Empleo", "01_Perfil", "_prueba_prohibida.md");
const prompt = `Usa la herramienta Write dos veces, una por archivo, con el contenido "prueba":
1) ${permitido}
2) ${prohibido}
3) Corre con Bash el comando: ls
4) Corre con Bash el comando: bun run tracker --help
Luego responde en una línea qué funcionó y qué fue bloqueado. No hagas nada más.`;

const proc = Bun.spawn(["claude", ...argsClaude({ sessionId: crypto.randomUUID(), tipo: "armar" }), "--model", "haiku"], {
  cwd: REPO, stdin: new Blob([prompt]), stdout: "pipe", stderr: "pipe",
  env: { ...process.env, CAREER_OS_RUN_ID: "RUN-prueba", CAREER_OS_RUN_TIPO: "armar", CAREER_OS_DATA: join(REPO, "05_Busqueda_Empleo"), ANTHROPIC_API_KEY: "" },
});
const out = await new Response(proc.stdout).text();
await proc.exited;
const resultado = out.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).find((j) => j?.type === "result");
console.log("Claude:", resultado?.result);
console.log("Permitido creado:", existsSync(permitido) ? "SÍ (correcto)" : "NO (falla)");
console.log("Prohibido creado:", existsSync(prohibido) ? "SÍ (FALLA DE SEGURIDAD)" : "NO (correcto)");
console.log("Costo USD:", resultado?.total_cost_usd);
rmSync(join(REPO, "05_Busqueda_Empleo", "04_Postulaciones", "_prueba_permisos"), { recursive: true, force: true });
rmSync(prohibido, { force: true });
