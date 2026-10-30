import * as C from "./calc.js";
const { brl, r2, num } = C;

// ---- armazenamento: um único objeto no IndexedDB (estado) e a chave do OpenRouter à parte (fora do backup) ----
const db = new Promise((ok, no) => { const r = indexedDB.open("nalinha", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const kv = {
  get: async k => { const d = await db; return new Promise(ok => { const q = d.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => ok(q.result); }); },
  set: async (k, v) => { const d = await db; return new Promise((ok, no) => { const t = d.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = ok; t.onerror = t.onabort = () => no(t.error || new Error("gravação abortada")); }); },
};
let E = await kv.get("estado");
window.addEventListener("unhandledrejection", e => alert("Não consegui salvar: " + (e.reason?.message || e.reason) + ". Exporte um backup."));
let CFG = (await kv.get("config")) || { modelo: "google/gemini-2.5-flash", chave: "" };
const salvar = () => kv.set("estado", E);
const hoje = () => C.iso(new Date());
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const dm = s => s.slice(8) + "/" + s.slice(5, 7);
const cat = id => E.categorias.find(c => c.id === id) || { nome: "?", icone: "•" };

let aba = "hoje";
const ABAS = [["hoje", "Hoje"], ["cat", "Categorias"], ["contas", "Contas"], ["plano", "Plano"], ["ajustes", "Ajustes"]];

function render() {
  $("#tabs").innerHTML = ABAS.map(([k, n]) => `<button class="${k === aba ? "on" : ""}" data-aba="${k}">${n}</button>`).join("");
  $("#fab").hidden = !E;
  $("#app").innerHTML = !E ? telaVazia() : { hoje: telaHoje, cat: telaCat, contas: telaContas, plano: telaPlano, ajustes: telaAjustes }[aba]();
}

const telaVazia = () => `<h1>Na Linha</h1><div class="card">Nenhum dado ainda. Importe o <b>seed.json</b> (ou um backup) para começar.<input type="file" accept=".json" id="imp"></div>`;

function telaHoje() {
  const h = hoje(), p = C.podeGastarHoje(E, h), mes = h.slice(0, 7);
  const prox = C.proximas(E, h, 3);
  const vars = E.categorias.filter(c => c.variavel);
  const gMes = r2(vars.reduce((s, c) => s + C.gastoCategoria(E, c.id, mes), 0)), oMes = C.orcamentoMes(E, mes);
  const cl = C.status(gMes, oMes), seq = C.sequencia(E, h);
  const ult = [...E.lancamentos].sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id)).slice(0, 6);
  return `<h1>Na Linha</h1>
  ${prox.map(c => `<div class="banner">⏰ ${esc(c.nome)} ${brl(c.valor)} — ${dm(c.data)}</div>`).join("")}
  <div class="card"><div class="mut">Pode gastar hoje (variável)</div>
    <div class="big ${p.porDia < 0 ? "vermelho" : p.porDia < 20 ? "amarelo" : "verde"}">${brl(p.porDia)}</div>
    <div class="mut">Quinzena ${dm(p.ini)}–${dm(p.fim)}: sobra ${brl(p.saldo)} de ${brl(p.orcamento)} · ${p.dias} dia(s)</div></div>
  <div class="card"><div class="row"><b>Mês (variável)</b><span class="${cl}">${brl(gMes)} / ${brl(oMes)}</span></div>
    <div class="bar ${cl}"><i style="width:${Math.min(100, oMes ? gMes / oMes * 100 : 0)}%"></i></div>
    <div class="mut" style="margin-top:8px">🔥 ${seq} dia(s) seguidos dentro do limite diário</div></div>
  <h2>Últimos lançamentos</h2>
  ${ult.map(l => `<div class="card row"><span>${esc(cat(l.cat).icone)} ${esc(l.desc || cat(l.cat).nome)}<br><span class="mut">${dm(l.data)} · ${esc(l.meio || "")}</span></span><b>${brl(l.valor)}</b></div>`).join("") || `<div class="mut">Nada lançado ainda.</div>`}`;
}

function telaCat() {
  const mes = hoje().slice(0, 7);
  return `<h1>Categorias — ${mes.slice(5)}/${mes.slice(0, 4)}</h1>` + E.categorias.map(c => {
    const g = C.gastoCategoria(E, c.id, mes), s = C.status(g, c.teto);
    return `<div class="card"><div class="row"><b>${esc(c.icone)} ${esc(c.nome)}</b><span class="${s}">${brl(g)} / ${brl(c.teto)}</span></div>
    <div class="bar ${s}"><i style="width:${Math.min(100, c.teto ? g / c.teto * 100 : g ? 100 : 0)}%"></i></div></div>`;
  }).join("");
}

function telaContas() {
  const ord = [...E.contas].sort((a, b) => a.data.localeCompare(b.data));
  const mesAtual = ord.find(c => !c.pago)?.data.slice(0, 7);
  const falta = r2(ord.filter(c => !c.pago && c.data.startsWith(mesAtual)).reduce((s, c) => s + c.valor, 0));
  let ult = "";
  return `<h1>Contas</h1><div class="card">Falta pagar em ${mesAtual ? mesAtual.slice(5) + "/" + mesAtual.slice(0, 4) : "—"}: <b>${brl(falta)}</b>
    <button class="btn sec" data-act="ics">📅 Exportar para o Google Agenda (.ics)</button></div>` +
    ord.map(c => { const m = c.data.slice(0, 7), h = m !== ult ? `<h2>${m.slice(5)}/${m.slice(0, 4)}</h2>` : ""; ult = m;
      return h + `<div class="card chk ${c.pago ? "pago" : ""}"><input type="checkbox" aria-label="Pago: ${esc(c.nome)}" data-conta="${esc(c.id)}" ${c.pago ? "checked" : ""}>
      <div style="flex:1">${esc(c.nome)}<br><span class="mut">${dm(c.data)}${c.pago ? " · pago " + brl(c.valorPago ?? c.valor) : ""}</span></div><b>${brl(c.valor)}</b></div>`; }).join("");
}

function telaPlano() {
  const mx = Math.max(...E.fluxo.map(f => Math.max(f.previsto, f.real ?? 0)), 1);
  return `<h1>Plano</h1><h2>Dívidas (valores do plano de 30/10)</h2>` + E.dividas.map(d => `<div class="card"><div class="row"><b>${esc(d.nome)}</b><span>${brl(d.saldo)}</span></div>
    <div class="mut">${esc(d.obs || "")}</div></div>`).join("") +
    `<h2>Reserva: previsto × real (saldo no fim do mês)</h2>` + E.fluxo.map(f => `<div class="card"><div class="row"><b>${esc(f.mes)}</b><span>${brl(f.previsto)}${f.real != null ? ` · real ${brl(f.real)}` : ""}</span></div>
    <div class="bar"><i style="width:${Math.max(0, f.previsto / mx * 100)}%"></i></div>
    <input inputmode="decimal" placeholder="Saldo real no fim do mês" data-real="${esc(f.mes)}" value="${f.real ?? ""}"></div>`).join("") +
    (E.historico?.length ? `<h2>Histórico jul–out (média/mês, consumo)</h2>` + E.historico.map(h => `<div class="card row"><span>${esc(h.nome)}</span><b>${brl(h.valor)}</b></div>`).join("") : "");
}

function telaAjustes() {
  const soma = r2(E.categorias.reduce((s, c) => s + c.teto, 0));
  return `<h1>Ajustes</h1><h2>Tetos por categoria</h2><div class="card row"><span>Soma dos tetos</span><b id="soma" class="${soma > E.tetoGlobal ? "vermelho" : "verde"}">${brl(soma)} / ${brl(E.tetoGlobal)}</b></div>` + E.categorias.map(c => `<div class="card row"><span>${esc(c.icone)} ${esc(c.nome)}${c.variavel ? "" : " (fixo)"}</span>
    <input style="width:110px" aria-label="Teto de ${esc(c.nome)}" inputmode="decimal" data-teto="${esc(c.id)}" value="${c.teto}"></div>`).join("") +
    `<div class="card"><b>Nova categoria</b><input id="ncn" placeholder="Nome"><input id="nct" inputmode="decimal" placeholder="Teto mensal">
    <button class="btn" data-act="novacat">Adicionar</button></div>
    <div class="card"><b>Nova conta</b><input id="nkn" placeholder="Nome"><input id="nkv" inputmode="decimal" placeholder="Valor"><input id="nkd" type="date"><select id="nkc" aria-label="Categoria da conta"><option value="">Sem categoria (ex.: dívida)</option>${E.categorias.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join("")}</select>
    <button class="btn" data-act="novaconta">Adicionar</button></div>
    <h2>Foto do comprovante (OpenRouter)</h2><div class="card"><input id="cfm" placeholder="Modelo com visão" value="${esc(CFG.modelo)}"><input id="cfk" type="password" placeholder="Chave OpenRouter (fica só neste aparelho)" value="${esc(CFG.chave)}">
    <button class="btn sec" data-act="cfg">Salvar</button></div>
    <h2>Dados</h2><div class="card"><button class="btn" data-act="exp">Exportar backup</button><input type="file" accept=".json" id="imp"></div>`;
}

// ---- lançar ----
function lancar() {
  let escolhida = (E.categorias.find(c => c.variavel) || E.categorias[0])?.id;
  const m = $("#modal"); m.hidden = false;
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Novo gasto"><div class="row"><b>Novo gasto</b><button class="chip" data-x aria-label="Fechar">✕</button></div>
  <input class="valor" id="lv" aria-label="Valor em reais" inputmode="decimal" placeholder="0,00" autofocus>
  <div class="chips">${E.categorias.map(c => `<button class="chip ${c.id === escolhida ? "on" : ""}" data-c="${esc(c.id)}">${esc(c.icone)} ${esc(c.nome)}</button>`).join("")}</div>
  <input id="ld" aria-label="Descrição" placeholder="Descrição / favorecido"><input id="ldt" aria-label="Data" type="date" value="${hoje()}">
  <select id="lm" aria-label="Meio de pagamento"><option>Pré-pago</option><option>Santander</option><option>Mercado Pago</option><option>Dinheiro</option></select>
  <label class="btn sec" style="display:block;text-align:center">📷 Ler comprovante<input type="file" accept="image/*" capture="environment" id="lf" hidden></label>
  <div id="lmsg" class="mut"></div><button class="btn" id="lok">Salvar</button></div>`;
  m.onclick = async ev => {
    const t = ev.target;
    if (t.dataset.x !== undefined || t === m) return fechar();
    if (t.dataset.c) { escolhida = t.dataset.c; m.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === escolhida)); }
    if (t.id === "lok") {
      const v = num($("#lv").value);
      if (!escolhida) return ($("#lmsg").textContent = "Crie uma categoria em Ajustes primeiro.");
      if (!(r2(v) > 0)) return ($("#lmsg").textContent = "Informe um valor válido maior que zero (ex.: 12,50).");
      const data = $("#ldt").value || hoje(), mes = data.slice(0, 7), c = cat(escolhida);
      const antes = C.gastoCategoria(E, escolhida, mes);
      E.lancamentos.push({ id: uid(), data, valor: r2(v), cat: escolhida, desc: $("#ld").value.trim(), meio: $("#lm").value });
      await salvar(); fechar();
      const a = C.alerta(antes, r2(antes + v), c.teto);
      if (a) alert(a === "passou100" ? `⛔ ${c.nome} passou do teto (${brl(c.teto)}).` : `⚠️ ${c.nome} chegou a 80% do teto.`);
      render();
    }
  };
  $("#lf").onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    if (!CFG.chave) return ($("#lmsg").textContent = "Configure a chave do OpenRouter em Ajustes.");
    $("#lmsg").textContent = "Lendo…";
    try {
      const url = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST",
        headers: { Authorization: "Bearer " + CFG.chave, "Content-Type": "application/json" },
        body: JSON.stringify({ model: CFG.modelo, messages: [{ role: "user", content: [
          { type: "text", text: `Leia o comprovante e responda SÓ JSON: {"valor":número,"favorecido":texto,"data":"AAAA-MM-DD","categoria":uma de ${JSON.stringify(E.categorias.map(c => c.id))}}` },
          { type: "image_url", image_url: { url } }] }] }) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const txt = (await res.json()).choices[0].message.content, j = JSON.parse(txt.match(/\{[\s\S]*\}/)[0]);
      if (j.valor > 0) $("#lv").value = String(j.valor).replace(".", ",");
      if (j.favorecido) $("#ld").value = j.favorecido;
      if (/^\d{4}-\d\d-\d\d$/.test(j.data)) $("#ldt").value = j.data;
      if (E.categorias.some(c => c.id === j.categoria)) { escolhida = j.categoria; m.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === escolhida)); }
      $("#lmsg").textContent = "Confira os campos antes de salvar.";
    } catch (e) { $("#lmsg").textContent = "Falhou ao ler: " + e.message; }
  };
}
const fechar = () => { $("#modal").hidden = true; $("#modal").innerHTML = ""; $("#fab").focus(); tick(); };
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) fechar(); });

// ---- eventos ----
document.addEventListener("click", async ev => {
  const t = ev.target;
  if (t.dataset.aba) { aba = t.dataset.aba; render(); }
  else if (t.id === "fab") lancar();
  else if (t.dataset.act === "ics") baixar("contas.ics", C.ics(E.contas.filter(c => !c.pago)), "text/calendar");
  else if (t.dataset.act === "exp") baixar(`nalinha-backup-${hoje()}.json`, JSON.stringify(E), "application/json");
  else if (t.dataset.act === "cfg") { CFG = { modelo: $("#cfm").value.trim(), chave: $("#cfk").value.trim() }; await kv.set("config", CFG); alert("Salvo."); }
  else if (t.dataset.act === "novacat") {
    const n = $("#ncn").value.trim(), v = num($("#nct").value); if (!n || isNaN(v) || v < 0) return alert("Nome e teto válidos (teto ≥ 0).");
    E.categorias.push({ id: uid(), nome: n, icone: "🏷️", teto: v, variavel: true }); await salvar(); render();
  } else if (t.dataset.act === "novaconta") {
    const n = $("#nkn").value.trim(), v = num($("#nkv").value), d = $("#nkd").value; if (!n || !(r2(v) > 0) || !d) return alert("Nome, valor maior que zero e data.");
    E.contas.push({ id: uid(), nome: n, valor: r2(v), data: d, cat: $("#nkc").value || null, pago: false }); await salvar(); render();
  }
});
document.addEventListener("change", async ev => {
  const t = ev.target;
  if (t.dataset.conta) {
    const c = E.contas.find(x => x.id === t.dataset.conta);
    if (t.checked) {
      const v = num(prompt("Valor pago:", String(c.valor).replace(".", ","))); if (!(r2(v) > 0)) { t.checked = false; return; }
      c.pago = true; c.valorPago = r2(v);
      if (c.cat) E.lancamentos.push({ id: uid(), data: hoje(), valor: r2(v), cat: c.cat, desc: c.nome, meio: "Conta", conta: c.id });
    } else { c.pago = false; delete c.valorPago; E.lancamentos = E.lancamentos.filter(l => l.conta !== c.id); }
    await salvar(); render();
  } else if (t.dataset.teto) { const c = E.categorias.find(x => x.id === t.dataset.teto), v = num(t.value); if (!isNaN(v) && v >= 0) { c.teto = r2(v); await salvar(); const z = $("#soma"); if (z) { const s = r2(E.categorias.reduce((x, k) => x + k.teto, 0)); z.textContent = `${brl(s)} / ${brl(E.tetoGlobal)}`; z.className = s > E.tetoGlobal ? "vermelho" : "verde"; } } }
  else if (t.dataset.real) { const f = E.fluxo.find(x => x.mes === t.dataset.real), v = num(t.value); f.real = isNaN(v) ? null : r2(v); await salvar(); render(); }
  else if (t.id === "imp") {
    const f = t.files[0]; if (!f) return;
    try {
      const j = C.validar(JSON.parse(await f.text()));
      if (E && !confirm("Substituir os dados atuais pelo arquivo?")) return;
      E = j; await salvar(); render();
    } catch (e) { alert("Arquivo inválido: " + e.message); }
  }
});
function baixar(nome, txt, tipo) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: tipo })); a.download = nome; a.click(); }

let dia = hoje();
const tick = () => { if (E && hoje() !== dia && $("#modal").hidden) { dia = hoje(); render(); } };
setInterval(tick, 60000); document.addEventListener("visibilitychange", tick);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
render();
