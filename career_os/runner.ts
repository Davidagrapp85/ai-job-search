// Lanza Claude Code en modo no interactivo, una corrida a la vez (FIFO).
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { actualizarCorrida, type Corrida, listarCorridas } from "./runs";
import { rutas } from "./store";

const REPO = resolve(import.meta.dir, "..");
export type Tipo = "armar" | "chat" | "aprendizajes" | "enviar" | "borrador" | "aplicar";
const LIMITE = /usage limit|rate limit|limit reached|quota/i;
const TIMEOUT_MS = 20 * 60_000;
// Reglas con ruta absoluta: en Claude Code "//ruta" es ruta absoluta; "./ruta" no coincide con las rutas que usa Write.
const DATOS = `/${REPO}/05_Busqueda_Empleo`;
const POSTULACIONES = `${DATOS}/04_Postulaciones/**`;
const BASE = ["Read", "Glob", "Grep", "Skill", "Bash(bun run tracker:*)", "Bash(bun run tracker *)"];
const COMPOSIO = ["mcp__composio__COMPOSIO_SEARCH_TOOLS", "mcp__composio__COMPOSIO_MULTI_EXECUTE_TOOL"];
const ambos = (ruta: string) => [`Write(${ruta})`, `Edit(${ruta})`];
const PROHIBIDO = [
  ...ambos(`${DATOS}/01_Perfil/**`), ...ambos(`${DATOS}/05_Tracker/**`), ...ambos(`${DATOS}/**/aprobado/**`),
  ...ambos(`/${REPO}/career_os/**`), ...ambos(`/${REPO}/.claude/**`),
];

/** Herramientas por tipo de corrida: solo borrador y enviar tocan el correo; solo aplicar edita el brain. */
export function herramientas(tipo: Tipo, destino?: string): { permitidas: string[]; prohibidas: string[] } {
  const escribir = [`Write(${POSTULACIONES})`, `Edit(${POSTULACIONES})`];
  const docsCmd = "node 05_Busqueda_Empleo/07_Skills/empleo-armar-postulacion/build_docs.js";
  const docs = [`Bash(${docsCmd}:*)`, `Bash(${docsCmd} *)`];
  switch (tipo) {
    case "armar": return { permitidas: [...BASE, ...escribir, ...docs, "WebFetch", "WebSearch"], prohibidas: PROHIBIDO };
    case "chat": return { permitidas: [...BASE, ...escribir, ...docs], prohibidas: PROHIBIDO };
    case "aprendizajes": return { permitidas: [...BASE, ...escribir], prohibidas: PROHIBIDO };
    case "borrador": case "enviar": return { permitidas: [...BASE, ...COMPOSIO], prohibidas: PROHIBIDO };
    case "aplicar": {
      if (!destino || !/^(01_Perfil\/[\w-]+\.md|02_Configuracion\/ejes\/[\w-]+\.md)$/.test(destino)) throw new Error("Destino no permitido");
      const f = `${DATOS}/${destino}`;
      return { permitidas: [...BASE, `Edit(${f})`, ...escribir], prohibidas: PROHIBIDO.filter((x) => !x.startsWith(`Edit(${DATOS}/01_Perfil`)) };
    }
  }
}

export function argsClaude(o: { sessionId: string; resume?: boolean; tipo?: Tipo; destino?: string }): string[] {
  const h = herramientas(o.tipo ?? "armar", o.destino);
  return ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "dontAsk",
    o.resume ? "--resume" : "--session-id", o.sessionId,
    "--allowedTools", ...h.permitidas, "--disallowedTools", ...h.prohibidas];
}

/** Al arrancar el servidor: corridas que quedaron en cola o en curso no tienen proceso; se marcan en error. */
export function recuperarHuerfanas(dataDir?: string): number {
  let n = 0;
  for (const c of listarCorridas(dataDir)) {
    if (c.estado === "en cola" || c.estado === "en curso") {
      actualizarCorrida(dataDir, c.run_id, (x) => { x.estado = "error"; x.error = "El servidor se reinició durante la corrida; vuelve a lanzarla."; });
      n++;
    }
  }
  return n;
}

export function plantilla(nombre: string, vars: Record<string, string>): string {
  let t = readFileSync(join(import.meta.dir, "prompts", nombre), "utf8");
  for (const [k, v] of Object.entries(vars)) t = t.split(`{{${k}}}`).join(v);
  return t;
}

export const promptArmar = (c: Corrida) =>
  plantilla("armar_postulacion.md", { run_id: c.run_id, entrada_tipo: c.entrada.tipo, entrada: c.entrada.valor });

type Trabajo = { runId: string; tipo: Tipo; prompt: string; destino?: string };

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

  encolar(runId: string, tipo: Tipo, prompt: string, destino?: string): void {
    if (tipo === "aplicar") herramientas(tipo, destino);
    this.cola.push({ runId, tipo, prompt, destino });
    if (!this.actual) void this.siguiente();
  }

  cancelar(runId: string): void {
    const antes = this.cola.length;
    this.cola = this.cola.filter((t) => t.runId !== runId);
    if (this.cola.length !== antes) actualizarCorrida(this.o.dataDir, runId, (c) => { if (c.estado === "en cola" || c.estado === "en curso") c.estado = "cancelada"; });
    if (this.actual?.t.runId === runId) { this.actual.cancelado = true; this.actual.proc.kill(); }
  }

  esperar(): Promise<void> {
    if (!this.actual && !this.cola.length) return Promise.resolve();
    return new Promise((r) => this.vacio.push(r));
  }

  private entorno(conApi: boolean, t: Trabajo): Record<string, string> {
    const env: Record<string, string> = { ...(process.env as Record<string, string>), ...this.o.env };
    if (this.o.dataDir) env.CAREER_OS_DATA = this.o.dataDir;
    env.CAREER_OS_RUN_ID = t.runId;
    env.CAREER_OS_RUN_TIPO = t.tipo;
    if (!conApi) delete env.ANTHROPIC_API_KEY;
    return env;
  }

  private async siguiente(): Promise<void> {
    const t = this.cola.shift();
    if (!t) { this.actual = null; this.vacio.splice(0).forEach((r) => r()); return; }
    const d = this.o.dataDir;
    try {
      const c = actualizarCorrida(d, t.runId, (x) => { if (t.tipo === "armar") x.estado = "en curso"; });
      const resume = t.tipo !== "armar";
      const tieneClave = !!(this.o.env?.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY);
      let r = await this.lanzar(t, c, resume, false);
      if (r.code !== 0 && !this.actual?.cancelado && LIMITE.test(r.err + r.out.slice(-2000)) && tieneClave) {
        actualizarCorrida(d, t.runId, (x) => { x.reintento_api = true; });
        r = await this.lanzar(t, c, resume, true);
      }
      const cancelado = this.actual?.cancelado;
      actualizarCorrida(d, t.runId, (x) => {
        if (t.tipo === "armar") {
          if (cancelado) x.estado = "cancelada";
          else if (r.code !== 0) { x.estado = "error"; x.error = (r.err || r.out).slice(-500); }
          else if (!x.pasos.some((p) => p.estado !== "pendiente")) {
            x.estado = "error";
            x.error = `Claude terminó sin reportar ningún paso. Su mensaje: ${(r.resultado ?? r.err ?? "").slice(0, 800)}`;
          } else if (x.pasos.some((p) => p.estado === "error")) {
            x.estado = "error";
            x.error = x.pasos.filter((p) => p.estado === "error").map((p) => `${p.titulo}: ${p.detalle ?? "error"}`).join(" · ");
          } else x.estado = "esperando a David";
          return;
        }
        // Otros tipos nunca cambian el estado de la corrida: solo registran su error.
        if (cancelado || r.code !== 0) x.error = `[${t.tipo}] ${cancelado ? "cancelada" : (r.err || r.out).slice(-400)}`;
        if (t.tipo === "chat") {
          if (r.resultado && !cancelado) x.chat.push({ rol: "claude", texto: r.resultado, at: new Date().toISOString() });
          for (const k of Object.keys(x.documentos) as (keyof typeof x.documentos)[]) {
            if (x.documentos[k].estado === "en trabajo") x.documentos[k].estado = "por revisar";
          }
        }
      });
    } catch (e: any) {
      try {
        actualizarCorrida(d, t.runId, (x) => {
          if (t.tipo === "armar") x.estado = "error";
          x.error = `[${t.tipo}] ${e?.message ?? String(e)}`.slice(0, 500);
        });
      } catch {}
    } finally {
      this.actual = null;
    }
    await this.siguiente();
  }

  private async lanzar(t: Trabajo, c: Corrida, resume: boolean, conApi: boolean) {
    const proc = Bun.spawn([...this.bin, ...argsClaude({ sessionId: c.session_id, resume, tipo: t.tipo, destino: t.destino })], {
      cwd: REPO, env: this.entorno(conApi, t), stdin: new Blob([t.prompt]), stdout: "pipe", stderr: "pipe",
    });
    this.actual = { t, proc, cancelado: this.actual?.t === t ? this.actual.cancelado : false };
    const reloj = setTimeout(() => { if (this.actual) this.actual.cancelado = true; proc.kill(); }, TIMEOUT_MS);
    proc.exited.finally(() => clearTimeout(reloj));
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
