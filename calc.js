// Funções puras do app. Datas sempre "AAAA-MM-DD" (hora local).
export const pad = n => String(n).padStart(2, "0");
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const r2 = x => Math.round(x * 100) / 100;
export const brl = x => x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Quinzena: do salário (dia 5 ou 20) até o dia anterior ao próximo.
export function quinzena(hoje) {
  const d = parse(hoje), dia = d.getDate(), y = d.getFullYear(), m = d.getMonth();
  let ini, fim;
  if (dia >= 20) { ini = new Date(y, m, 20); fim = new Date(y, m + 1, 4); }
  else if (dia >= 5) { ini = new Date(y, m, 5); fim = new Date(y, m, 19); }
  else { ini = new Date(y, m - 1, 20); fim = new Date(y, m, 4); }
  return { ini: iso(ini), fim: iso(fim) };
}
export const diasRestantes = (hoje, fim) => Math.round((parse(fim) - parse(hoje)) / 864e5) + 1;

// Orçamento variável do mês: ajuste do mês (ex.: novembro) ou soma dos tetos variáveis.
export function orcamentoMes(estado, mes) {
  const aj = estado.ajustes?.[mes];
  if (aj != null) return aj;
  return r2(estado.categorias.filter(c => c.variavel).reduce((s, c) => s + c.teto, 0));
}

// Quanto pode gastar hoje: (orçamento da quinzena − gasto variável na quinzena) ÷ dias restantes.
export function podeGastarHoje(estado, hoje) {
  const q = quinzena(hoje), mes = q.fim.slice(0, 7);
  const orc = r2(orcamentoMes(estado, mes) / 2);
  const vars = new Set(estado.categorias.filter(c => c.variavel).map(c => c.id));
  const gasto = r2(estado.lancamentos.filter(l => vars.has(l.cat) && l.data >= q.ini && l.data <= q.fim).reduce((s, l) => s + l.valor, 0));
  const dias = diasRestantes(hoje, q.fim);
  return { ...q, orcamento: orc, gasto, saldo: r2(orc - gasto), dias, porDia: r2((orc - gasto) / dias) };
}

export function gastoCategoria(estado, cat, mes) {
  return r2(estado.lancamentos.filter(l => l.cat === cat && l.data.startsWith(mes)).reduce((s, l) => s + l.valor, 0));
}
export const status = (gasto, teto) => !teto ? (gasto > 0 ? "vermelho" : "verde") : gasto >= teto ? "vermelho" : gasto >= 0.8 * teto ? "amarelo" : "verde";

// Aviso ao lançar: devolve "passou80" / "passou100" quando o novo gasto cruza o limite.
export function alerta(antes, depois, teto) {
  if (!teto) return depois > 0 && antes <= 0 ? "passou100" : null;
  if (antes < teto && depois >= teto) return "passou100";
  if (antes < 0.8 * teto && depois >= 0.8 * teto) return "passou80";
  return null;
}

// Contas com vencimento nos próximos n dias e ainda não pagas.
export function proximas(estado, hoje, n = 3) {
  const h = parse(hoje), lim = iso(new Date(h.getFullYear(), h.getMonth(), h.getDate() + n));
  return estado.contas.filter(c => !c.pago && c.data <= lim).sort((a, b) => a.data.localeCompare(b.data));
}

// Sequência: dias consecutivos (até ontem) em que o gasto variável do dia ficou ≤ porDia da época (aproximação: orçamento do mês ÷ dias do mês).
export function sequencia(estado, hoje) {
  const vars = new Set(estado.categorias.filter(c => c.variavel).map(c => c.id));
  let n = 0, d = parse(hoje);
  while (n < 366) { // teto: sem `inicio` válido o loop varreria séculos
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); // data local: subtrair 24h erra no horário de verão
    const s = iso(d);
    if (s < (estado.inicio || "0000")) break;
    const mes = s.slice(0, 7), dm = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const limite = orcamentoMes(estado, mes) / dm;
    const g = estado.lancamentos.filter(l => l.data === s && vars.has(l.cat)).reduce((a, l) => a + l.valor, 0);
    if (g > limite) break;
    n++;
  }
  return n;
}

// .ics com as contas do mês (alarme 1 dia antes, 09:00).
export function ics(contas) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NaLinha//PT"];
  contas.forEach((c, i) => {
    const d = c.data.replaceAll("-", "");
    L.push("BEGIN:VEVENT", `UID:nalinha-${c.id || i}@local`, `DTSTAMP:${d}T000000Z`, `DTSTART;VALUE=DATE:${d}`,
      `SUMMARY:${c.nome} ${brl(c.valor)}`, "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${c.nome}`, "TRIGGER:-P1DT0H", "END:VALARM", "END:VEVENT");
  });
  return L.concat("END:VCALENDAR").join("\r\n");
}

// Valor em reais digitado pelo usuário: "1.234,56", "12,5", "12.5". Qualquer outra coisa vira NaN.
export function num(s) {
  s = String(s ?? "").trim();
  let n = NaN;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$|^-?\d+(,\d+)?$/.test(s)) n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  else if (/^-?\d+\.\d{1,2}$/.test(s)) n = parseFloat(s);
  return isFinite(n) && Math.abs(n) <= 1e9 ? n : NaN; // 1e9: acima disso é erro de digitação, e evita Infinity
}

// Valida um arquivo de estado ANTES de substituir os dados. Lança Error se algo estiver errado.
export function validar(j) {
  const ok = (c, m) => { if (!c) throw new Error(m); };
  const obj = x => x && typeof x === "object" && !Array.isArray(x);
  const fin = x => typeof x === "number" && isFinite(x);
  const dt = x => typeof x === "string" && /^\d{4}-\d\d-\d\d$/.test(x) && iso(parse(x)) === x;
  const pos = x => fin(x) && x > 0 && x <= 1e9;
  const str = x => typeof x === "string" && x.length > 0;
  ok(obj(j), "não é um objeto");
  for (const k of ["categorias", "lancamentos", "contas"]) ok(Array.isArray(j[k]), `falta a lista "${k}"`);
  ok(j.categorias.length > 0, "precisa de ao menos uma categoria");
  for (const k of ["dividas", "fluxo", "historico"]) { j[k] ??= []; ok(Array.isArray(j[k]), `"${k}" inválido`); }
  j.ajustes ??= {}; ok(obj(j.ajustes) && Object.values(j.ajustes).every(fin), "ajustes inválidos");
  const ids = (l, nome) => { ok(new Set(l.map(x => x.id)).size === l.length, `ids repetidos em ${nome}`); };
  j.categorias.forEach(x => ok(obj(x) && str(x.id) && str(x.nome) && typeof x.icone === "string" && fin(x.teto) && x.teto >= 0 && x.teto <= 1e9 && typeof x.variavel === "boolean", "categoria inválida"));
  j.lancamentos.forEach(x => ok(obj(x) && str(x.id) && dt(x.data) && pos(x.valor) && typeof x.cat === "string" && j.categorias.some(k => k.id === x.cat), "lançamento inválido"));
  j.contas.forEach(x => ok(obj(x) && str(x.id) && str(x.nome) && dt(x.data) && pos(x.valor) && typeof x.pago === "boolean" && (x.cat == null || j.categorias.some(k => k.id === x.cat)), "conta inválida"));
  j.dividas.forEach(x => ok(obj(x) && str(x.nome) && fin(x.saldo), "dívida inválida"));
  j.fluxo.forEach(x => ok(obj(x) && str(x.mes) && fin(x.previsto) && (x.real == null || fin(x.real)), "fluxo inválido"));
  j.historico.forEach(x => ok(obj(x) && str(x.nome) && fin(x.valor), "histórico inválido"));
  ["categorias", "lancamentos", "contas"].forEach(k => ids(j[k], k));
  j.inicio ??= iso(new Date()); ok(dt(j.inicio), "inicio inválido");
  j.tetoGlobal ??= 3800; ok(fin(j.tetoGlobal), "tetoGlobal inválido");
  return j;
}
