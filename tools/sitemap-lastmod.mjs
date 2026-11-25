/* lastmod в sitemap.xml = датата на последната промяна на файла в git (24.11.2026).
   Датите стояха от септември–октомври, а страниците са пипани след това; Google ползва
   lastmod като слаб сигнал кога да мине пак, но само ако му вярва — затова датата идва
   от git, не се пише на ръка. Английският блок (между маркерите EN:SITEMAP) не се пипа:
   него го пише tools/en/build.mjs.

   node tools/sitemap-lastmod.mjs          — пренаписва sitemap.xml
   node tools/sitemap-lastmod.mjs proba    — само печата какво би сменил

   Датата само расте: ако git каже по-стара от записаната, остава записаната. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const KOREN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROBA = process.argv[2] === "proba";
const smPath = path.join(KOREN, "sitemap.xml");
let sm = fs.readFileSync(smPath, "utf8");


const fajlZa = (loc) => {
  let f = loc.replace("https://pesenta.bg/", "");
  if (f === "" || f.endsWith("/")) f += "index.html";
  return f;
};
const gitData = (f) => {
  try { return execFileSync("git", ["log", "-1", "--format=%cs", "--", f], { cwd: KOREN, encoding: "utf8" }).trim(); }
  catch { return ""; }
};

let smeneni = 0;
const nova = sm.replace(/(<loc>)([^<]+)(<\/loc>\s*<lastmod>)([^<]+)(<\/lastmod>)/g, (cyalo, a, loc, b, stara, c) => {
  if (loc.includes("pesenta.bg/en/")) return cyalo;
  const f = fajlZa(loc.trim());
  if (!fs.existsSync(path.join(KOREN, f))) { console.log("  ✗ няма файл за " + loc); return cyalo; }
  const d = gitData(f);
  if (!d || d <= stara) return cyalo;
  smeneni++;
  if (PROBA) console.log("  " + f + ": " + stara + " → " + d);
  return a + loc + b + d + c;
});

console.log("lastmod: сменени " + smeneni + " адреса" + (PROBA ? " (проба, нищо не е записано)" : ""));
if (!PROBA && smeneni) fs.writeFileSync(smPath, nova);
