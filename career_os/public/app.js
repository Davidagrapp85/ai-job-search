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
  const badge = $("nprop");
  badge.textContent = String(props.length);
  badge.hidden = props.length === 0;
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
}

async function refrescar() {
  try { await cargarFilas(); await Promise.all([cargarResumen(), cargarPropuestas()]); }
  catch (e) { avisar(`No pude leer el tracker: ${e.message}`, true); }
}
refrescar();
