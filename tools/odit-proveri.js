/* Проверка на подадения одиторски файл. Пише се във ФАЙЛ, а не през node -e:
   обратните наклонени черти в регексите се изяждат от шела на Windows. */
var fs = require("fs");
var P = "D:/My Documents 2026/Cyber Hora/pesenta.bg/nap-audit/audit_pesenta_2026-08.xml";
var b = fs.readFileSync(P);
var s = b.toString("latin1");
var gr = [];

function v(t, x) { var m = (x || s).match(new RegExp("<" + t + ">([^<]*)</" + t + ">")); return m ? m[1] : null; }
function vsi(t, x) {
  var r = [], re = new RegExp("<" + t + ">([\\s\\S]*?)</" + t + ">", "g"), m;
  while ((m = re.exec(x || s))) r.push(m[1]);
  return r;
}

if (!/encoding="windows-1251"/.test(s)) gr.push("кодировката не е windows-1251");
var kir = 0; for (var i = 0; i < b.length; i++) if (b[i] >= 0xC0) kir++;

console.log("  ЕИК             : " + v("eik") + (v("eik") === "207427793" ? "  ✓" : "  ✗"));
console.log("  номер е-магазин : " + v("e_shop_n"));
console.log("  домейн          : " + v("domain_name"));
console.log("  вид магазин     : " + v("e_shop_type"));
console.log("  период          : " + v("mon") + "/" + v("god") + (v("mon") === "08" && v("god") === "2026" ? "  ✓" : "  ✗"));
console.log("  създаден        : " + v("creation_date"));
console.log("  кирилски байтове: " + kir + " (windows-1251, не UTF-8)");

var por = vsi("orderenum"), sbor = 0, dn = [];
console.log("  поръчки         : " + por.length);
por.forEach(function (p) {
  var t1 = +v("ord_total1", p), d = +v("ord_disc", p), dds = +v("ord_vat", p), t2 = +v("ord_total2", p);
  var art = +v("art_sum", p), q = +v("art_quant", p), c = +v("art_price", p);
  var dd = v("ord_d", p), dc = v("doc_date", p);
  sbor += t2; dn.push(v("doc_n", p));
  var b1 = Math.abs(q * c - art) < 0.005;
  var b2 = Math.abs(t1 - d + dds - t2) < 0.005;
  var b3 = Math.abs(art - t1) < 0.005;
  var vp = /^2026-08-/.test(dd) && /^2026-08-/.test(dc);
  var st = /^pi_/.test(v("trans_n", p) || "");
  console.log("    " + v("ord_n", p) + "  док " + v("doc_n", p) + "  " + t2.toFixed(2) + " EUR  " +
    (b1 && b2 && b3 ? "сметки ✓" : "СМЕТКИ ✗") + "  " + (vp ? "в август ✓" : "ИЗВЪН АВГУСТ ✗") +
    "  paym=" + v("paym", p) + "  " + (st ? "истински Stripe ID ✓" : "ТЕСТОВ ID ✗"));
  if (!(b1 && b2 && b3)) gr.push("сметки в " + v("ord_n", p));
  if (!vp) gr.push("дата извън август в " + v("ord_n", p));
  if (!st) gr.push("нереален trans_n в " + v("ord_n", p));
});
console.log("  сбор продажби   : " + sbor.toFixed(2) + " EUR");

var pod = dn.map(Number), red = pod.every(function (x, i) { return i === 0 || x === pod[i - 1] + 1; });
console.log("  номера на док.  : " + dn.join(", ") + (red ? "  последователни ✓" : "  С ПРЕКЪСВАНЕ ✗"));
if (!red) gr.push("номерата на документите не са последователни");

var vr = vsi("rorderenum"), rs = 0;
console.log("  възстановявания : обявени " + v("r_ord") + ", записани " + vr.length +
  (+v("r_ord") === vr.length ? "  ✓" : "  ✗"));
if (+v("r_ord") !== vr.length) gr.push("r_ord не съвпада с броя записи");
vr.forEach(function (r) {
  rs += +v("r_amount", r);
  var im = por.some(function (p) { return v("ord_n", p) === v("r_ord_n", r); });
  console.log("    " + v("r_ord_n", r) + "  " + v("r_amount", r) + " EUR  " + v("r_date", r) +
    (im ? "  сочи поръчка от файла ✓" : "  СОЧИ НЕСЪЩЕСТВУВАЩА ПОРЪЧКА ✗"));
  if (!im) gr.push("възстановяване без поръчка: " + v("r_ord_n", r));
});
console.log("  r_total         : " + v("r_total") +
  (Math.abs(rs - +v("r_total")) < 0.005 ? "  съвпада със сбора ✓" : "  НЕ СЪВПАДА ✗"));
if (Math.abs(rs - +v("r_total")) >= 0.005) gr.push("r_total не съвпада");
console.log("  нето за месеца  : " + (sbor - rs).toFixed(2) + " EUR");
console.log("");
console.log(gr.length ? "  ГРЕШКИ: " + gr.join("; ") : "  вътрешно съгласуван, без разминавания");
