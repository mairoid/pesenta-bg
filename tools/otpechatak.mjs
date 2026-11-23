/* otpechatak.mjs — слага ?v= на CSS и JS без версия В КОПИЕТО за качване (23.11.2026).
   node tools/otpechatak.mjs <папка> [--proba]

   Вика го deploy.yml СЛЕД bez-komentari.mjs, върху checkout-а на runner-а; хранилището
   остава без отпечатъци и нищо не трябва да се помни на ръка.

   Поводът: style.css, main.js и saglasie.js се зареждаха без ?v=, а GitHub Pages ги пази
   10 минути (max-age=600). На 23.11.2026 новият HTML с менюто ☰ тръгна със стария CSS от
   кеша на браузъра — двоен бутон на компютър и шапка, която излиза встрани на телефон.
   С отпечатък от съдържанието сменен файл получава нов адрес и браузърът го тегли веднага.

   Отпечатъкът са първите 8 знака от SHA-256 на файла, КАКТО ЩЕ БЪДЕ КАЧЕН (вече без
   коментари), с LF редове — същото правило като в tools/en/build.mjs. Пресмята се и там,
   където ?v= вече има (koleda.js, EN страниците): стойността е същата, освен ако файлът
   се е сменил при качването. Липсващ файл = предупреждение, адресът остава както е.

   Ред: първо JS файловете, после HTML. main.js зарежда saglasie.js с адрес в кода си —
   този адрес получава отпечатък първо, и чак тогава се смята отпечатъкът на main.js.
   --proba: само брои, не пише. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const KOREN = path.resolve(process.argv[2] || ".");
const PROBA = process.argv.includes("--proba");
const PROPUSNI = new Set(["node_modules", ".git", "worker", "marketing", "docs", "nap-audit", ".github", "tools"]);

const kesh = new Map();
function otpechatak(abs) {
  if (!kesh.has(abs)) {
    kesh.set(abs, fs.existsSync(abs)
      ? crypto.createHash("sha256").update(fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n")).digest("hex").slice(0, 8)
      : null);
  }
  return kesh.get(abs);
}

/* src="…assets/js/x.js" или href="…assets/css/x.css", с или без ?v=xxxxxxxx. */
const ADRES = /((?:src|href)=")([^"?#]*?assets\/(?:css|js)\/[^"?#\/]+\.(?:css|js))(?:\?v=[0-9a-f]{8})?(")/g;
/* В JS: низ "/assets/js/x.js" (main.js → saglasie.js). Само абсолютни адреси от корена. */
const ADRES_JS = /(["'])(\/assets\/js\/[^"'?#\/]+\.js)(?:\?v=[0-9a-f]{8})?(["'])/g;

const JS_PAPKA = path.join(KOREN, "assets/js");
let jsAdresi = 0;
if (fs.existsSync(JS_PAPKA)) {
  for (const x of fs.readdirSync(JS_PAPKA).filter((n) => n.endsWith(".js"))) {
    const f = path.join(JS_PAPKA, x);
    const s = fs.readFileSync(f, "utf8");
    const n = s.replace(ADRES_JS, (cel, k1, url, k2) => {
      const v = otpechatak(path.join(KOREN, url));
      if (!v) return cel;
      jsAdresi++;
      return `${k1}${url}?v=${v}${k2}`;
    });
    if (n !== s && !PROBA) fs.writeFileSync(f, n);
  }
}
/* JS файловете може да са се сменили — отпечатъците им се смятат наново за HTML-а. */
kesh.clear();

function obhod(d, out) {
  for (const x of fs.readdirSync(d)) {
    if (PROPUSNI.has(x)) continue;
    const p = path.join(d, x);
    if (fs.statSync(p).isDirectory()) obhod(p, out);
    else if (x.endsWith(".html")) out.push(p);
  }
  return out;
}

let stranici = 0, adresi = 0;
const lipsvat = new Set();
for (const f of obhod(KOREN, [])) {
  const s = fs.readFileSync(f, "utf8");
  const n = s.replace(ADRES, (cel, pred, url, sled) => {
    let abs;
    if (/^https?:\/\//.test(url)) {
      if (!url.startsWith("https://pesenta.bg/")) return cel;
      abs = path.join(KOREN, url.slice("https://pesenta.bg/".length));
    } else if (url.startsWith("/")) abs = path.join(KOREN, url);
    else abs = path.resolve(path.dirname(f), url);
    const v = otpechatak(abs);
    if (!v) { lipsvat.add(path.relative(KOREN, abs)); return cel; }
    adresi++;
    return `${pred}${url}?v=${v}${sled}`;
  });
  if (n !== s) { stranici++; if (!PROBA) fs.writeFileSync(f, n); }
}
for (const l of lipsvat) console.log("  ! липсва файл: " + l);
const spisak = [...kesh].filter(([, v]) => v).map(([k, v]) => path.relative(KOREN, k).replace(/\\/g, "/") + "=" + v).join(", ");
console.log(`  ${PROBA ? "[проба] " : ""}${adresi} адреса в ${stranici} страници, ${jsAdresi} в JS · ${spisak}`);
