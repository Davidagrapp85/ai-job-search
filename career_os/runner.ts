// Lanza Claude Code en modo no interactivo, una corrida a la vez (FIFO).
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { actualizarCorrida, type Corrida } from "./runs";
import { rutas } from "./store";

const REPO = resolve(import.meta.dir, "..");
export const HERRAMIENTAS = [
  "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch", "Skill",
  "Bash(bun run tracker:*)",
  "Bash(node 05_Busqueda_Empleo/07_Skills/empleo-armar-postulacion/build_docs.js:*)",
  "mcp__composio__COMPOSIO_SEARCH_TOOLS", "mcp__composio__COMPOSIO_MULTI_EXECUTE_TOOL",
];
export type Tipo = "armar" | "chat" | "aprendizajes" | "enviar" | "borrador" | "aplicar";
const LIMITE = /usage limit|rate limit|limit reached|quota/i;

export function argsClaude(o: { sessionId: string; resume?: boolean }): string[] {
  return ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "dontAsk",
    "--allowedTools", ...HERRAMIENTAS, o.resume ? "--resume" : "--session-id", o.sessionId];
}

export function plantilla(nombre: string, vars: Record<string, string>): string {
  let t = readFileSync(join(import.meta.dir, "prompts", nombre), "utf8");
  for (const [k, v] of Object.entries(vars)) t = t.split(`{{${k}}}`).join(v);
  return t;
}

export const promptArmar = (c: Corrida) =>
  plantilla("armar_postulacion.md", { run_id: c.run_id, entrada_tipo: c.entrada.tipo, entrada: c.entrada.valor });

type Trabajo = { runId: string; tipo: Tipo; prompt: string };

export class Runner {
  private cola: Trabajo[] = [];
  private actual: { t: Trabajo; proc: ReturnType<typeof Bun.spawn>; cancelado: boolean } | null = null;
  private vacio: (() => void)[] = [];
  private bin: string[];
  constructor(private o: { dataDir?: string; bin?: string; env?: Record<string, string> } = {}) {
    const b = o.bin ?? process.env.CAREER_OS_CLAUDE_BIN ?? "claude";
    this.bin = b.endsWith(".ts") ? ["bun", b] : [b];
  }

  activo(): string | null { return this.actual?.t.runId ?? null; }
  pendientes(): string[] { return this.cola.map((t) => t.runId); }

  encolar(runId: string, tipo: Tipo, prompt: string): void {
    this.cola.push({ runId, tipo, prompt });
    if (!this.actual) void this.siguiente();
  }

  cancelar(runId: string): void {
    const antes = this.cola.length;
    this.cola = this.cola.filter((t) => t.runId !== runId);
    if (this.cola.length !== antes) actualizarCorrida(this.o.dataDir, runId, (c) => { c.estado = "cancelada"; });
    if (this.actual?.t.runId === runId) { this.actual.cancelado = true; this.actual.proc.kill(); }
  }

  esperar(): Promise<void> {
    if (!this.actual && !this.cola.length) return Promise.resolve();
    return new Promise((r) => this.vacio.push(r));
  }

  private entorno(conApi: boolean): Record<string, string> {
    const env: Record<string, string> = { ...(process.env as Record<string, string>), ...this.o.env };
    if (this.o.dataDir) env.CAREER_OS_DATA = this.o.dataDir;
    if (!conApi) delete env.ANTHROPIC_API_KEY;
    return env;
  }

  private async siguiente(): Promise<void> {
    const t = this.cola.shift();
    if (!t) { this.actual = null; this.vacio.splice(0).forEach((r) => r()); return; }
    const d = this.o.dataDir;
    const c = actualizarCorrida(d, t.runId, (x) => { if (t.tipo === "armar") x.estado = "en curso"; });
    const resume = t.tipo !== "armar";
    const tieneClave = !!(this.o.env?.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY);
    let r = await this.lanzar(t, c, resume, false);
    if (r.code !== 0 && !this.actual?.cancelado && LIMITE.test(r.err) && tieneClave) {
      actualizarCorrida(d, t.runId, (x) => { x.reintento_api = true; });
      r = await this.lanzar(t, c, resume, true);
    }
    const cancelado = this.actual?.cancelado;
    actualizarCorrida(d, t.runId, (x) => {
      if (cancelado) { x.estado = "cancelada"; return; }
      if (r.code !== 0) { x.estado = "error"; x.error = (r.err || r.out).slice(-500); return; }
      if (t.tipo === "armar") x.estado = "esperando a David";
      if (t.tipo === "chat" && r.resultado) x.chat.push({ rol: "claude", texto: r.resultado, at: new Date().toISOString() });
    });
    await this.siguiente();
  }

  private async lanzar(t: Trabajo, c: Corrida, resume: boolean, conApi: boolean) {
    const proc = Bun.spawn([...this.bin, ...argsClaude({ sessionId: c.session_id, resume })], {
      cwd: REPO, env: this.entorno(conApi), stdin: new Blob([t.prompt]), stdout: "pipe", stderr: "pipe",
    });
    this.actual = { t, proc, cancelado: this.actual?.t === t ? this.actual.cancelado : false };
    const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    mkdirSync(rutas(this.o.dataDir).corridas, { recursive: true });
    appendFileSync(join(rutas(this.o.dataDir).corridas, `${t.runId}.log.jsonl`), out);
    let resultado: string | undefined;
    for (const linea of out.split("\n").reverse()) {
      try { const j = JSON.parse(linea); if (j.type === "result") { resultado = j.result; break; } } catch {}
    }
    return { code, out, err, resultado };
  }
}
