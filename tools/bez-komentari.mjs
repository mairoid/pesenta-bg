/* bez-komentari.mjs — маха коментарите от HTML и CSS В КОПИЕТО за качване (20.10.2026).
   node tools/bez-komentari.mjs <папка> [--proba]

   Вика го deploy.yml след махането на работните файлове, върху checkout-а на runner-а —
   хранилището остава с коментарите (там са бележките защо нещо е така). Поводът:
   style.css блокира първия текст, а коментарите в него са 24 от 39 KB компресиран
   (Lighthouse, телефон: LCP 3,3 s). В index.html — 8 от 29 KB.

   HTML: маха <!-- … -->, но НЕ вътре в <script>, <style>, <textarea>, <pre> и не условните
   <!--[if …]>. CSS: маха блоковите коментари извън низове. JS не се пипа — там печалбата е ~0, а рискът не е.
   --proba: само брои, не пише. Код 1, ако след махането нещо е счупено (празен файл). */
import fs from "node:fs";
import path from "node:path";

const KOREN = path.resolve(process.argv[2] || ".");
const PROBA = process.argv.includes("--proba");
const PROPUSNI = new Set(["node_modules", ".git", "worker", "marketing", "docs", "nap-audit", ".github"]);

export function htmlBezKomentari(s) {
  /* Пазените блокове се изрязват, коментарите се махат от останалото, после се връщат. */
  const pazeni = [];
  const t = s.replace(/<(script|style|textarea|pre)\b[\s\S]*?<\/\1>/gi, (m) => { pazeni.push(m); return "\u0000" + (pazeni.length - 1) + "\u0000"; });
  const chist = t.replace(/<!--(?!\[if)[\s\S]*?-->/g, "").replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n");
  return chist.replace(/\u0000(\d+)\u0000/g, (_, i) => pazeni[+i]);
}

export function cssBezKomentari(s) {
  let izh = "", i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'") {               /* низ — копира се цял */
      let j = i + 1;
      while (j < s.length && s[j] !== c) j += s[j] === "\\" ? 2 : 1;
      izh += s.slice(i, j + 1); i = j + 1;
    } else if (c === "/" && s[i + 1] === "*") {  /* коментар — пропуска се */
      const kraj = s.indexOf("*/", i + 2);
      i = kraj < 0 ? s.length : kraj + 2;
    } else { izh += c; i++; }
  }
  return izh.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n");
}

function obhod(d, out) {
  for (const x of fs.readdirSync(d)) {
    if (PROPUSNI.has(x)) continue;
    const p = path.join(d, x);
    if (fs.statSync(p).isDirectory()) obhod(p, out);
    else if (/\.(html|css)$/.test(x)) out.push(p);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("bez-komentari.mjs")) {
  let predi = 0, sled = 0, broi = 0, greshki = 0;
  for (const f of obhod(KOREN, [])) {
    const s = fs.readFileSync(f, "utf8");
    const n = f.endsWith(".css") ? cssBezKomentari(s) : htmlBezKomentari(s);
    if (s.trim() && !n.trim()) { console.log("  ✗ празен след махането: " + path.relative(KOREN, f)); greshki++; continue; }
    predi += Buffer.byteLength(s); sled += Buffer.byteLength(n);
    if (n !== s) { broi++; if (!PROBA) fs.writeFileSync(f, n); }
  }
  console.log(`  ${PROBA ? "[проба] " : ""}${broi} файла, ${Math.round(predi / 1024)} → ${Math.round(sled / 1024)} KB (сурово)`);
  process.exit(greshki ? 1 : 0);
}
