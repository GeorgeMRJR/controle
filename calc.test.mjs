import assert from "node:assert/strict";
import * as c from "./calc.js";
assert.deepEqual(c.quinzena("2026-11-07"), { ini: "2026-11-05", fim: "2026-11-19" });
assert.deepEqual(c.quinzena("2026-11-25"), { ini: "2026-11-20", fim: "2026-12-04" });
assert.deepEqual(c.quinzena("2026-11-02"), { ini: "2026-10-20", fim: "2026-11-04" });
assert.equal(c.diasRestantes("2026-11-19", "2026-11-19"), 1);
const cats = [{ id: "mercado", teto: 1000, variavel: true }, { id: "pets", teto: 80, variavel: true }, { id: "moradia", teto: 1117, variavel: false }];
const e = { categorias: cats, lancamentos: [{ cat: "mercado", valor: 100, data: "2026-11-06" }, { cat: "moradia", valor: 400, data: "2026-11-10" }], ajustes: {}, contas: [], inicio: "2026-11-01" };
assert.equal(c.orcamentoMes(e, "2026-11"), 1080);
const p = c.podeGastarHoje(e, "2026-11-07"); // orç quinzena 540, gasto 100, 13 dias
assert.equal(p.saldo, 440); assert.equal(p.dias, 13); assert.equal(p.porDia, c.r2(440 / 13));
e.ajustes["2026-11"] = 869.1; assert.equal(c.orcamentoMes(e, "2026-11"), 869.1);
assert.equal(c.status(79, 100), "verde"); assert.equal(c.status(80, 100), "amarelo"); assert.equal(c.status(100, 100), "vermelho"); assert.equal(c.status(101, 100), "vermelho");
assert.equal(c.alerta(70, 85, 100), "passou80"); assert.equal(c.alerta(95, 105, 100), "passou100"); assert.equal(c.alerta(10, 20, 100), null); assert.equal(c.alerta(99, 100, 100), "passou100"); assert.equal(c.alerta(0, 5, 0), "passou100");
e.contas = [{ nome: "A", data: "2026-11-09", pago: false }, { nome: "B", data: "2026-11-30", pago: false }, { nome: "C", data: "2026-11-08", pago: true }];
assert.deepEqual(c.proximas(e, "2026-11-07", 3).map(x => x.nome), ["A"]);
assert.equal(c.sequencia(e, "2026-11-07"), 0); // 6/11 gastou 100 > 869.1/30
assert.equal(c.sequencia(e, "2026-11-05"), 4); // dias 1 a 4 sem gasto
assert.ok(c.ics([{ nome: "A", data: "2026-11-09", valor: 10 }]).includes("DTSTART;VALUE=DATE:20261109"));
for (const [a, b] of [["1.234,56", 1234.56], ["12,5", 12.5], ["12.5", 12.5], ["12.50", 12.5], ["1.234", 1234], ["0", 0], ["-5", -5]]) assert.equal(c.num(a), b, a);
for (const x of ["9".repeat(309), "9".repeat(12), "", "abc", "12abc", "1e3", "1,2,3", "1..2", null]) assert.ok(isNaN(c.num(x)), String(x));
const seed = () => ({ categorias: [{ id: "a", nome: "A", icone: "x", teto: 1, variavel: true }], lancamentos: [], contas: [] });
assert.ok(c.validar(seed()).tetoGlobal === 3800);
for (const f of [j => (j.categorias = [null]), j => (j.categorias[0].teto = -1), j => (j.lancamentos = [{ id: "1", data: "x", valor: 1, cat: "a" }]),
  j => (j.contas = [{ id: "1", nome: "n", data: "2026-01-01", valor: 1, pago: false }, { id: "1", nome: "n", data: "2026-01-01", valor: 1, pago: false }]), j => (j.fluxo = [{ mes: "m", previsto: "x" }]), j => (j.ajustes = { a: "x" })])
  { const j = seed(); f(j); assert.throws(() => c.validar(j)); }
const sj = seed(); sj.inicio = "xx"; assert.throws(() => c.validar(sj));
assert.ok(c.sequencia({ categorias: [], lancamentos: [] }, "2026-11-07") <= 366); // sem inicio não trava
for (const f of [j => (j.lancamentos = [{ id: "1", data: "2026-02-30", valor: 1, cat: "a" }]), j => (j.lancamentos = [{ id: "1", data: "2026-02-01", valor: -1, cat: "a" }]),
  j => (j.lancamentos = [{ id: "1", data: "2026-02-01", valor: 1, cat: "zz" }]), j => (j.contas = [{ id: "1", nome: "n", data: "2026-02-01", valor: 0, pago: false }])])
  { const j = seed(); f(j); assert.throws(() => c.validar(j)); }
assert.equal(c.alerta(99, c.r2(99 + 0.995), 100), "passou100");
{ const j = seed(); j.categorias = []; assert.throws(() => c.validar(j)); }
assert.throws(() => c.validar(null)); assert.throws(() => c.validar({}));
// horário de verão: sequência sem gastos entre 2018-11-04 e 05 = 1 dia (limite inicio)
process.env.TZ = "America/Sao_Paulo";
console.log("calc ok");
