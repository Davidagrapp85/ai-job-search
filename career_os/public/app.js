// Dashboard de Career OS. Todo dato externo entra al DOM con textContent (nunca HTML).
const ESTADOS = ["detectada", "descartada", "en preparación", "aprobada", "enviada", "entrevista", "oferta", "rechazada", "cerrada"];
const FINALES = new Set(["descartada", "rechazada", "cerrada"]);
const $ = (id) => document.getElementById(id);
let filas = [];
let actual = null;

function el(tag, props = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const h of hijos) if (h != null) n.append(h);
  return n;
}
const vaciar = (n) => { while (n.firstChild) n.firstChild.remove(); };
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

async function api(ruta, body) {
  const r = await fetch(ruta, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
  return data;
}

function avisar(texto, error = false) {
  const a = $("aviso");
  a.textContent = texto;
  a.className = error ? "aviso error" : "aviso";
  a.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { a.hidden = true; }, error ? 8000 : 4000);
}

// Pestañas
const tabs = [...document.querySelectorAll('[role="tab"]')];
tabs.forEach((t) => t.addEventListener("click", () => {
  tabs.forEach((x) => { x.setAttribute("aria-selected", String(x === t)); $(x.getAttribute("aria-controls")).hidden = x !== t; });
}));

// Resumen
const ratio = (r) => (r.de === 0 ? "N/D" : `${r.n}/${r.de}`);
async function cargarResumen() {
  const m = await api("/api/metrics");
  const k = m.kpis;
  const kpis = [
    [String(k.enviadas.n), `Enviadas (de ${k.enviadas.de} elegidas)`],
    [ratio(k.conRespuesta), "Con respuesta / enviadas"],
    [ratio(k.entrevista), "Entrevista / enviadas"],
    [ratio(k.ofertaDesdeEntrevista), "Oferta / entrevistas"],
    [k.diasPrimeraRespuesta == null ? "N/D" : `${k.diasPrimeraRespuesta} d`, "Días a primera respuesta"],
    [String(k.vencidas), "Próximas acciones vencidas", k.vencidas > 0],
  ];
  vaciar($("kpis"));
  for (const [v, t, alerta] of kpis) $("kpis").append(el("div", { class: alerta ? "kpi alerta" : "kpi" }, el("b", { text: v }), el("span", { text: t })));
  vaciar($("embudo"));
  for (const e of m.embudo) {
    const pct = e.de ? Math.round((100 * e.n) / m.embudo[0].n) : 0;
    const relleno = el("div", { class: "relleno" });
    relleno.style.width = `${pct}%`;
    $("embudo").append(el("div", { class: "etapa" }, el("span", { text: e.etapa }), el("div", { class: "pista" }, relleno), el("span", { class: "num", text: e.etapa === "detectada" ? String(e.n) : e.de === 0 ? "N/D" : `${e.n}/${e.de}` })));
  }
}

// Vacantes
function opciones(select, valores) {
  const actualV = select.value;
  [...select.options].slice(select.id === "f-estado" ? 2 : 1).forEach((o) => o.remove());
  for (const v of valores) select.append(el("option", { value: v, text: v }));
  select.value = actualV;
}

function pintarFilas() {
  const f = { empresa: $("f-empresa").value.trim().toLowerCase(), eje: $("f-eje").value, estado: $("f-estado").value, canal: $("f-canal").value, desde: $("f-desde").value, hasta: $("f-hasta").value };
  const visibles = filas.filter((x) =>
    (!f.empresa || `${x.empresa} ${x.vacante}`.toLowerCase().includes(f.empresa)) &&
    (!f.eje || x.eje === f.eje) &&
    (f.estado === "" || (f.estado === "activas" ? !FINALES.has(x.estado) : x.estado === f.estado)) &&
    (!f.canal || x.canal === f.canal) &&
    (!f.desde || x.fecha >= f.desde) && (!f.hasta || x.fecha <= f.hasta));
  vaciar($("filas"));
  const h = hoy();
  for (const x of visibles) {
    const accion = el("td", {}, x.proxima_accion || "—");
    if (x.fecha_proxima && !FINALES.has(x.estado)) {
      const txt = x.fecha_proxima < h ? `vencida ${x.fecha_proxima}` : x.fecha_proxima === h ? "vence hoy" : `para ${x.fecha_proxima}`;
      accion.append(el("span", { class: x.fecha_proxima <= h ? "vence" : "num", text: txt }));
    }
    $("filas").append(el("tr", { tabindex: "0", onclick: () => abrir(x), onkeydown: (e) => { if (e.key === "Enter") abrir(x); } },
      el("td", { class: "id", text: x.numero }), el("td", { text: x.empresa }), el("td", { text: x.vacante }), el("td", { text: x.eje }),
      el("td", {}, el("span", { class: `pill ${x.estado.replace(/ /g, "-")}`, text: x.estado })), accion));
  }
  $("sin-filas").hidden = visibles.length > 0;
}

async function cargarFilas() {
  filas = await api("/api/applications");
  opciones($("f-eje"), [...new Set(filas.map((x) => x.eje).filter(Boolean))].sort());
  opciones($("f-canal"), [...new Set(filas.map((x) => x.canal).filter(Boolean))].sort());
  opciones($("f-estado"), ESTADOS);
  pintarFilas();
}
["f-empresa", "f-eje", "f-estado", "f-canal", "f-desde", "f-hasta"].forEach((id) => $(id).addEventListener("input", pintarFilas));

async function abrir(x) {
  actual = x;
  $("d-titulo").textContent = `${x.empresa} · ${x.vacante}`;
  $("d-sub").textContent = `${x.application_id} · ${x.numero} · ${x.estado}${x.canal ? ` · ${x.canal}` : ""}${x.fecha_envio ? ` · enviada ${x.fecha_envio}` : ""}`;
  const link = $("d-link");
  link.hidden = !/^https?:\/\//.test(x.link);
  if (!link.hidden) link.href = x.link;
  vaciar($("c-estado"));
  for (const s of ESTADOS) $("c-estado").append(el("option", { value: s, text: s }));
  $("c-estado").value = x.estado;
  $("c-canal").value = x.canal || "";
  $("c-fecha").value = x.fecha_envio || hoy();
  $("c-causa").value = "";
  $("c-envio").hidden = $("c-estado").value !== "enviada";
  $("e-accion").value = x.proxima_accion || "";
  $("e-fecha").value = x.fecha_proxima || "";
  vaciar($("d-historial"));
  const eventos = await api(`/api/events?id=${encodeURIComponent(x.application_id)}`);
  for (const e of eventos.slice().reverse()) {
    const que = e.tipo === "edicion" ? `Edición: ${Object.keys(e.campos || {}).join(", ")}` : e.tipo === "alta" ? `Alta como ${e.a}` : `${e.de} → ${e.a}`;
    $("d-historial").append(el("li", {}, el("span", { class: "cuando", text: `${e.at.slice(0, 16).replace("T", " ")} · ${e.actor}` }), el("br"), `${que}${e.causa ? ` — ${e.causa}` : ""}`));
  }
  if (!eventos.length) $("d-historial").append(el("li", { text: "Sin eventos todavía." }));
  if (!$("detalle").open) $("detalle").showModal();
}
$("c-estado").addEventListener("change", () => { $("c-envio").hidden = $("c-estado").value !== "enviada"; });

$("f-estado-cambio").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const estado = $("c-estado").value;
  if (estado === "enviada" && (!$("c-canal").value.trim() || !$("c-fecha").value)) { avisar("Para marcar enviada indica canal y fecha de envío.", true); return; }
  try {
    await api(`/api/applications/${encodeURIComponent(actual.application_id)}/estado`, { estado, causa: $("c-causa").value.trim(), canal: estado === "enviada" ? $("c-canal").value.trim() : undefined, fecha_envio: estado === "enviada" ? $("c-fecha").value : undefined });
    avisar(`Etapa guardada: ${actual.empresa} → ${estado}`);
    await refrescar();
    abrir(filas.find((x) => x.application_id === actual.application_id));
  } catch (e) { avisar(e.message, true); }
});

$("f-edicion").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  try {
    await api(`/api/applications/${encodeURIComponent(actual.application_id)}/editar`, { proxima_accion: $("e-accion").value, fecha_proxima: $("e-fecha").value });
    avisar("Próxima acción guardada");
    await refrescar();
    abrir(filas.find((x) => x.application_id === actual.application_id));
  } catch (e) { avisar(e.message, true); }
});

// Por aprobar
async function cargarPropuestas() {
  const props = await api("/api/proposals?estado=pendiente");
  vaciar($("propuestas"));
  for (const p of props) {
    const f = filas.find((x) => x.application_id === p.application_id);
    const nombre = f ? `${f.empresa} · ${f.vacante}` : p.application_id;
    const extra = p.campos && p.campos.canal ? ` · canal ${p.campos.canal} · ${p.campos.fecha_envio || ""}` : "";
    const acciones = el("div", { class: "acciones" });
    const resolver = (d) => async () => {
      try { await api(`/api/proposals/${encodeURIComponent(p.proposal_id)}/${d}`, {}); avisar(d === "aprobar" ? `Aprobada: ${nombre} → ${p.a}` : "Rechazada: el tracker no cambió"); await refrescar(); }
      catch (e) { avisar(e.message, true); }
    };
    acciones.append(el("button", { class: "primario", onclick: resolver("aprobar"), text: "Aprobar" }), el("button", { onclick: resolver("rechazar"), text: "Rechazar" }));
    $("propuestas").append(el("article", { class: "prop" },
      el("div", { class: "de", text: `De: ${p.evidencia.remitente} · ${p.evidencia.fecha} · confianza ${p.confianza}` }),
      el("div", { text: `Asunto: ${p.evidencia.asunto}` }),
      el("blockquote", { text: p.evidencia.extracto }),
      el("div", {}, `${nombre} · `, el("b", { text: `${p.de} → ${p.a}` }), extra),
      acciones));
  }
  $("sin-propuestas").hidden = props.length > 0;
  return props.length;
}

async function refrescar() {
  try {
    await cargarFilas();
    const [, nProp, nApr] = await Promise.all([cargarResumen(), cargarPropuestas(), cargarAprendizajes()]);
    const badge = $("nprop");
    badge.textContent = String(nProp + nApr);
    badge.hidden = nProp + nApr === 0;
    await cargarCorridas();
  }
  catch (e) { avisar(`No pude leer el tracker: ${e.message}`, true); }
}
refrescar();


// ---------- Nueva aplicación ----------
const ICONOS = { pendiente: "○", "en curso": "◌", listo: "✓", alerta: "⚠", error: "✕" };
const NOMBRES_DOC = { cv: "CV", carta: "Carta", respuestas: "Respuestas" };
const ACTIVAS = new Set(["en cola", "en curso"]);
let corridaId = null;
let corridas = [];
let vistaCorreoActual = null;
let sondeo = null;

async function cargarCorridas() {
  corridas = await api("/api/runs");
  vaciar($("n-corridas"));
  for (const c of corridas.slice(0, 12)) {
    const nombre = c.application_id ? `${c.application_id} · ${c.estado}` : `${c.run_id.slice(4, 17)} · ${c.estado}`;
    $("n-corridas").append(el("button", { type: "button", "aria-current": String(c.run_id === corridaId), onclick: () => verCorrida(c.run_id), text: nombre }));
  }
  if (!corridaId && corridas.length) await verCorrida(corridas[0].run_id, false);
}

function programarSondeo(c) {
  clearTimeout(sondeo);
  const ocupada = ACTIVAS.has(c.estado) || c.activa || c.en_cola || c.chat.at(-1)?.rol === "david";
  if (ocupada && !$("p-nueva").hidden) sondeo = setTimeout(() => verCorrida(c.run_id, false), 2000);
}

function fila(paso, c) {
  const li = el("li", { class: paso.estado.replace(/ /g, "-") },
    el("span", { class: "icono", "aria-label": paso.estado, text: ICONOS[paso.estado] || "○" }),
    el("span", {}, paso.titulo, paso.detalle ? el("span", { class: "det", text: paso.detalle }) : null));
  const acc = el("span", { class: "acciones" });
  if (paso.archivo && c.carpeta) acc.append(el("button", { type: "button", onclick: () => abrirDoc(c.run_id, paso.archivo), text: "Abrir" }));
  li.append(acc);
  return li;
}

async function abrirDoc(id, archivo) {
  try { await api(`/api/runs/${encodeURIComponent(id)}/abrir`, { archivo }); avisar(`Abriendo ${archivo}`); }
  catch (e) { avisar(e.message, true); }
}

async function accion(ruta, body, okTexto) {
  try { await api(ruta, body); if (okTexto) avisar(okTexto); await verCorrida(corridaId, false); await refrescarSinCorridas(); }
  catch (e) { avisar(e.message, true); }
}

async function refrescarSinCorridas() {
  try { await cargarFilas(); await cargarResumen(); } catch {}
}

async function verCorrida(id, scroll = true) {
  corridaId = id;
  let c;
  try { c = await api(`/api/runs/${encodeURIComponent(id)}`); } catch (e) { avisar(e.message, true); return; }
  [...$("n-corridas").children].forEach((b, i) => b.setAttribute("aria-current", String(corridas[i]?.run_id === id)));
  $("n-detalle").hidden = false;
  const f = filas.find((x) => x.application_id === c.application_id);
  $("n-titulo").textContent = f ? `${f.empresa} · ${f.vacante}` : c.entrada.tipo === "url" ? c.entrada.valor : "Vacante pegada como texto";
  $("n-sub").textContent = `${c.run_id} · ${c.estado}${c.canal ? ` · canal ${c.canal}` : ""}${c.reintento_api ? " · con API" : ""}`;
  $("n-cancelar").hidden = !(ACTIVAS.has(c.estado) || c.en_cola);
  $("n-error").hidden = !c.error;
  $("n-error").textContent = c.error ? `Claude terminó con error: ${c.error}` : "";

  vaciar($("n-pasos"));
  for (const p of c.pasos) $("n-pasos").append(fila(p, c));

  vaciar($("n-docs"));
  for (const k of ["cv", "carta", "respuestas"]) {
    const d = c.documentos[k];
    const paso = c.pasos.find((p) => p.id === k);
    if (!paso || paso.estado === "pendiente") continue;
    const caja = el("div", { class: "doc" }, el("b", { text: NOMBRES_DOC[k] }),
      el("span", { class: `pill ${d.estado === "aprobado" ? "aprobada" : ""}`, text: d.estado }));
    if (c.carpeta) {
      caja.append(el("button", { type: "button", onclick: () => abrirDoc(c.run_id, d.archivo), text: "Abrir en Word" }));
      caja.append(el("a", { href: `/api/runs/${encodeURIComponent(c.run_id)}/archivo/${encodeURIComponent(d.archivo)}`, download: d.archivo, text: "Descargar" }));
    }
    if (d.estado !== "aprobado") caja.append(el("button", { type: "button", class: "primario", onclick: () => accion(`/api/runs/${encodeURIComponent(c.run_id)}/aprobar`, { doc: k }, `${NOMBRES_DOC[k]} aprobada`), text: "Aprobar" }));
    caja.append(el("button", { type: "button", onclick: () => { $("ch-doc").value = k; $("ch-texto").focus(); }, text: "Trabajar con Claude" }));
    $("n-docs").append(caja);
  }
  if (!$("n-docs").children.length) $("n-docs").append(el("p", { class: "vacio", text: "Los documentos aparecen cuando Claude los genera." }));

  await pintarCorreo(c);

  vaciar($("n-chat"));
  for (const m of c.chat) $("n-chat").append(el("div", { class: `msg ${m.rol}`, text: m.texto }));
  if (c.chat.at(-1)?.rol === "david") $("n-chat").append(el("div", { class: "msg claude pensando", text: "Claude está trabajando…" }));
  $("n-chat").scrollTop = $("n-chat").scrollHeight;
  $("n-cerrar").disabled = !c.carpeta || ACTIVAS.has(c.estado);
  if (scroll) $("n-detalle").scrollIntoView({ behavior: "smooth", block: "start" });
  programarSondeo(c);
}

async function pintarCorreo(c) {
  const caja = $("n-correo");
  const paso = c.pasos.find((p) => p.id === "correo");
  caja.hidden = c.canal !== "correo" || !paso || paso.estado === "pendiente";
  $("c-confirmar").hidden = true;
  if (caja.hidden) return;
  try { vistaCorreoActual = await api(`/api/runs/${encodeURIComponent(c.run_id)}/correo`); }
  catch (e) { caja.hidden = true; return; }
  const v = vistaCorreoActual;
  $("c-para").textContent = [...v.para, ...v.cc.map((x) => `cc ${x}`)].join(", ");
  $("c-asunto").textContent = v.asunto;
  $("c-adjuntos").textContent = v.adjuntos.map((a) => `${a.nombre}${a.aprobado ? ` (${Math.round(a.bytes / 1024)} KB)` : " (sin aprobar)"}`).join(", ") || "—";
  $("c-cuerpo").textContent = v.cuerpo_texto;
  $("c-motivo").hidden = !v.motivo;
  $("c-motivo").textContent = v.envio ? `Enviado el ${v.envio.fecha}.` : v.motivo || "";
  $("c-borrador").hidden = !!v.draft_id && !/cambió/.test(v.motivo || "");
  $("c-enviar").disabled = !v.puedeEnviar;
}

$("f-nueva").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const valor = $("n-entrada").value.trim();
  if (!valor) { avisar("Pega el link o el texto de la vacante.", true); return; }
  try {
    const c = await api("/api/runs", { valor });
    $("n-entrada").value = "";
    avisar("Claude empezó a armar la postulación. Esto toma unos minutos.");
    corridaId = c.run_id;
    await cargarCorridas();
    await verCorrida(c.run_id);
  } catch (e) { avisar(e.message, true); }
});

$("f-chat").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const texto = $("ch-texto").value.trim();
  if (!texto || !corridaId) return;
  $("ch-texto").value = "";
  await accion(`/api/runs/${encodeURIComponent(corridaId)}/chat`, { texto, documento: $("ch-doc").value });
  await cargarCorridas();
});

$("n-cancelar").addEventListener("click", () => accion(`/api/runs/${encodeURIComponent(corridaId)}/cancelar`, {}, "Corrida cancelada"));
$("n-cerrar").addEventListener("click", () => accion(`/api/runs/${encodeURIComponent(corridaId)}/cerrar`, {}, "Claude está revisando tus cambios para proponer aprendizajes"));
$("c-borrador").addEventListener("click", () => accion(`/api/runs/${encodeURIComponent(corridaId)}/correo/borrador`, {}, "Claude está creando el borrador en Outlook"));
$("c-editar").addEventListener("click", () => { $("ch-doc").value = "correo"; $("ch-texto").focus(); });
$("c-enviar").addEventListener("click", () => {
  if (!vistaCorreoActual?.puedeEnviar) return;
  $("c-confirmar-texto").textContent = `Se enviará «${vistaCorreoActual.asunto}» a ${vistaCorreoActual.para.join(", ")} desde tu Hotmail.`;
  $("c-confirmar").hidden = false;
});
$("c-confirmar-no").addEventListener("click", () => { $("c-confirmar").hidden = true; });
$("c-confirmar-si").addEventListener("click", () => {
  if ($("c-confirmar").hidden || !vistaCorreoActual?.puedeEnviar) return;
  $("c-confirmar").hidden = true;
  accion(`/api/runs/${encodeURIComponent(corridaId)}/correo/enviar`, { sha256: vistaCorreoActual.sha256 }, "Enviando y verificando en Elementos enviados…");
});

$("n-seguir").addEventListener("click", async () => {
  try {
    const s = await api(`/api/runs/${encodeURIComponent(corridaId)}/seguir`);
    const texto = `${s.comando}\n\n${s.contexto}`;
    $("n-seguir-texto").textContent = texto;
    $("n-seguir-texto").hidden = false;
    try { await navigator.clipboard.writeText(texto); avisar("Copiado: pega el comando en tu terminal o el contexto en una sesión nueva de Claude."); }
    catch { avisar("Copia el texto que aparece abajo."); }
  } catch (e) { avisar(e.message, true); }
});

document.getElementById("t-nueva").addEventListener("click", () => { if (corridaId) verCorrida(corridaId, false); });

// ---------- Aprendizajes ----------
async function cargarAprendizajes() {
  const xs = await api("/api/learnings?estado=pendiente");
  vaciar($("aprendizajes"));
  for (const a of xs) {
    const resolver = (d) => async () => {
      try { await api(`/api/learnings/${encodeURIComponent(a.learning_id)}/${d}`, {}); avisar(d === "aprobar" ? (a.tipo === "hecho" ? "Queda por validar contra evidencia" : "Aprobado: Claude lo aplicará a tu brain") : "Listo"); await refrescar(); }
      catch (e) { avisar(e.message, true); }
    };
    $("aprendizajes").append(el("article", { class: "apr" },
      el("div", { class: "de", text: `${a.tipo} · alcance ${a.alcance} · destino ${a.destino} · ${a.application_id}` }),
      el("div", { class: "cambio" }, el("span", { text: "Antes" }), el("span", { text: a.antes }), el("span", { text: "Después" }), el("span", { text: a.despues })),
      el("div", { class: "nota", text: a.motivo }),
      el("div", { class: "acciones" },
        el("button", { type: "button", class: "primario", onclick: resolver("aprobar"), text: "Aprobar" }),
        el("button", { type: "button", onclick: resolver("solo-vacante"), text: "Solo esta vacante" }),
        el("button", { type: "button", onclick: resolver("rechazar"), text: "Rechazar" }))));
  }
  $("sin-aprendizajes").hidden = xs.length > 0;
  return xs.length;
}
