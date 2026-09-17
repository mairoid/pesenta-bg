/* „Свързани“ — блок с 3 повода, 1 човек и 1 статия в тялото на всяка страница за
   повод, човек, календар, сезон и последния момент (17.09.2026). Данните са в
   svarzani-danni.json (клъстери + един ред „защо“ на цел); блокът стои между маркери
   <!-- svarzani --> … <!-- /svarzani --> след секцията с въпросите, за да е повторим.

   node tools/svarzani.js            — пренаписва блока във всички целеви файлове
   node tools/svarzani.js proba      — само печата матрицата и сираците, нищо не пише

   Защо в тялото: подвалът носи 56 връзки, но тежи малко; страниците на позиции 15–50
   (юбилей, годеж, рожден ден) нямаха нито една връзка от текст. Всяка цел получава
   връзки ОТ поне 3 други — скриптът спира, ако някоя остане сирак. */
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, ".."), PROBA = process.argv[2] === "proba";
const D = JSON.parse(fs.readFileSync(path.join(__dirname, "svarzani-danni.json"), "utf8"));
const K = D.klasteri, S = D.stranici, Z = D.zashto;
const POSLEDEN = "podarak-v-poslednia-moment";
let gr = 0; const lo = m => { gr++; console.log("  ✗ " + m); };
Object.keys(Z).forEach(t => { if (!fs.existsSync(path.join(R, t + ".html"))) lo("няма файл за цел " + t); });

/* планът: източник → [цели]. Кандидатите са поводите и хората от всеки клъстер, в който
   страницата участва (+ последният момент навсякъде); избира се този с най-малко
   входящи дотук, при равенство — по реда в клъстера (сортирането е стабилно). Така
   никой не събира по 20 връзки. После поправка: цел с < 3 входящи взима мястото на
   най-натоварената цел от същия вид в източник, чийто кръг я съдържа. */
const plan = {}, krag = {}, vhodyashti = {};
const izberi = (arr, n) => { const out = []; for (let i = 0; i < n; i++) { const c = arr.filter(x => out.indexOf(x) < 0).sort((a, b) => (vhodyashti[a] || 0) - (vhodyashti[b] || 0))[0]; if (!c) break; out.push(c); vhodyashti[c] = (vhodyashti[c] || 0) + 1; } return out; };
Object.keys(S).forEach(src => {
  const dom = K[S[src]]; if (!dom) { lo(src + ": непознат клъстер " + S[src]); return; }
  const kl = Object.keys(K).filter(n => n === S[src] || K[n].povodi.indexOf(src) > -1 || K[n].hora.indexOf(src) > -1);
  const uniq = a => a.filter((x, i) => a.indexOf(x) === i && x !== src);
  krag[src] = { povodi: uniq([].concat(...kl.map(n => K[n].povodi), [POSLEDEN])), hora: uniq([].concat(...kl.map(n => K[n].hora))) };
  plan[src] = izberi(krag[src].povodi, 3).concat(izberi(krag[src].hora, 1), [dom.statia]);
  vhodyashti[dom.statia] = (vhodyashti[dom.statia] || 0) + 1;
});
const celiVsichki = Object.keys(Z).filter(t => !/^novini\//.test(t));
for (let p = 0; p < 40; p++) {
  const s = celiVsichki.filter(t => (vhodyashti[t] || 0) < 3)[0]; if (!s) break;
  let naj = null;
  Object.keys(plan).forEach(src => {
    const vid = krag[src].hora.indexOf(s) > -1 ? "hora" : krag[src].povodi.indexOf(s) > -1 ? "povodi" : null;
    if (!vid || plan[src].indexOf(s) > -1) return;
    plan[src].forEach((c, i) => { if (krag[src][vid].indexOf(c) > -1 && (vhodyashti[c] || 0) > 3 && (!naj || vhodyashti[c] > vhodyashti[naj.c])) naj = { src, i, c }; });
  });
  if (!naj) { lo("не мога да поправя " + s + " (никой източник няма по-натоварена цел за размяна)"); break; }
  plan[naj.src][naj.i] = s; vhodyashti[naj.c]--; vhodyashti[s] = (vhodyashti[s] || 0) + 1;
}
/* сираци: цел с < 3 входящи */
const siraci = celiVsichki.filter(t => (vhodyashti[t] || 0) < 3);
console.log("  източници: " + Object.keys(plan).length + "; входящи по цел: " + Object.keys(Z).map(t => t.replace(/^(podarak-pesen-za-|podarak-za-|novini\/)/, "") + " " + (vhodyashti[t] || 0)).join(", "));
if (siraci.length) lo("сираци (< 3 входящи): " + siraci.join(", "));
if (PROBA) { Object.keys(plan).forEach(s => console.log("  " + s + " → " + plan[s].map(c => c.replace(/^(podarak-pesen-za-|podarak-za-|novini\/)/, "")).join(", "))); console.log(gr ? "  " + gr + " ГРЕШКИ" : "  чисто (проба, нищо не е писано)"); process.exit(gr ? 1 : 0); }
if (gr) { console.log("  " + gr + " ГРЕШКИ — нищо не е записано"); process.exit(1); }

/* блокът */
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
let zapisani = 0;
Object.keys(plan).forEach(src => {
  const f = path.join(R, src + ".html");
  let s = fs.readFileSync(f, "utf8"); const eol = s.indexOf("\r\n") > -1 ? "\r\n" : "\n"; s = s.replace(/\r\n/g, "\n");
  const chovekLi = /^podarak-za-(?!tsvetnitsa|gergyovden|nikulden|ivanovden|dimitrovden|koleda|nova-godina|sveti-valentin)/.test(src);
  const zagl = chovekLi ? "Още идеи" : "Още поводи";
  const li = plan[src].map(c => '        <li><a href="' + c + '.html">' + esc(Z[c][0]) + "</a> <span>— " + esc(Z[c][1]) + "</span></li>").join("\n");
  const blok = '  <!-- svarzani -->\n  <section class="section svarzani" id="svarzani">\n    <div class="container">\n      <div class="section-head">\n        <h2>' + zagl + "</h2>\n      </div>\n      <ul class=\"svarzani-list\">\n" + li + "\n      </ul>\n    </div>\n  </section>\n  <!-- /svarzani -->\n";
  if (s.indexOf("<!-- svarzani -->") > -1) {
    s = s.replace(/  <!-- svarzani -->[\s\S]*?<!-- \/svarzani -->\n/, blok);
  } else {
    const i = s.indexOf('id="vaprosi"'); if (i < 0) { lo(src + ": няма секция с въпроси"); return; }
    const j = s.indexOf("\n  </section>\n", i); if (j < 0) { lo(src + ": не намирам края на въпросите"); return; }
    const kraj = j + "\n  </section>\n".length;
    s = s.slice(0, kraj) + "\n" + blok + s.slice(kraj);
  }
  fs.writeFileSync(f, s.split("\n").join(eol), "utf8"); zapisani++;
});
/* контрола: всяка връзка в блоковете сочи към съществуващ файл; точно по един блок */
let lipsi = 0, dvojni = 0;
Object.keys(plan).forEach(src => {
  const s = fs.readFileSync(path.join(R, src + ".html"), "utf8");
  if ((s.match(/<!-- svarzani -->/g) || []).length !== 1) dvojni++;
  const b = (s.match(/<!-- svarzani -->[\s\S]*?<!-- \/svarzani -->/) || [""])[0];
  (b.match(/href="([^"]+)"/g) || []).forEach(h => { const u = h.slice(6, -1); if (!fs.existsSync(path.join(R, u))) { lipsi++; console.log("  ✗ " + src + " → " + u + " не съществува"); } });
});
console.log("  записани " + zapisani + " страници; счупени връзки: " + lipsi + "; файлове с ≠ 1 блок: " + dvojni);
process.exit(lipsi || dvojni || gr ? 1 : 0);
