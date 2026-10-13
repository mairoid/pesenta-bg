/* Българската страна на двуезичието (13.10.2026).
   ------------------------------------------------------------------
   1. hreflang: всяка българска страница с английско съответствие получава
      bg / en / x-default редове точно като английската. Google иска двете
      страни да се сочат взаимно — едностранен hreflang се игнорира.
      x-default е английската: за човек, който не е нито българин, нито
      англоговорящ, английският е по-полезен.
   2. Превключвател „EN“ в хедъра — на всяка българска страница с главно меню;
      без съответствие води към en/ (началната).

   Пуска се след build.mjs (той пише karta.json):  node tools/en/hreflang-bg.mjs
   Повторно пускане не дублира нищо — блокът е между маркери и се подменя. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TUK = path.dirname(fileURLToPath(import.meta.url));
const KOREN = path.resolve(TUK, "../..");
const SAIT = "https://pesenta.bg";
const karta = JSON.parse(fs.readFileSync(path.join(TUK, "karta.json"), "utf8"));
const poBg = new Map(karta.filter((x) => x.bg).map((x) => [x.bg, x.en]));

const url = (prefix, f) => SAIT + prefix + (f === "index.html" ? "" : f);
let sHreflang = 0, sSwitch = 0;

for (const f of fs.readdirSync(KOREN).filter((x) => x.endsWith(".html"))) {
  const p = path.join(KOREN, f);
  let s = fs.readFileSync(p, "utf8");
  const nl = s.includes("\r\n") ? "\r\n" : "\n";
  if (/<meta name="robots" content="noindex/.test(s)) continue;
  const en = poBg.get(f);

  /* hreflang блок */
  s = s.replace(/[ \t]*<!-- hreflang -->[\s\S]*?<!-- \/hreflang -->\r?\n/, "");
  if (en) {
    const blok = [
      "  <!-- hreflang -->",
      `  <link rel="alternate" hreflang="bg" href="${url("/", f)}">`,
      `  <link rel="alternate" hreflang="en" href="${url("/en/", en)}">`,
      `  <link rel="alternate" hreflang="x-default" href="${url("/en/", en)}">`,
      "  <!-- /hreflang -->"
    ].join(nl) + nl;
    const m = s.match(/[ \t]*<link rel="canonical"[^>]*>\r?\n/);
    if (m) { s = s.replace(m[0], m[0] + blok); sHreflang++; }
  }

  /* превключвател в менюто */
  s = s.replace(/[ \t]*<a class="lang-switch"[^>]*>EN<\/a>\r?\n/, "");
  const nav = s.match(/<nav class="main-nav[^>]*>[\s\S]*?<\/nav>/);
  if (nav) {
    const cel = "en/" + (en && en !== "index.html" ? en : "");
    const btn = nav[0].match(/([ \t]*)<a class="btn btn-primary"/);
    if (btn) {
      const red = `${btn[1]}<a class="lang-switch" href="${cel}" hreflang="en" lang="en" aria-label="English version">EN</a>${nl}`;
      const novNav = nav[0].replace(btn[0], red + btn[0]);
      s = s.replace(nav[0], novNav);
      sSwitch++;
    }
  }
  fs.writeFileSync(p, s);
}
console.log("hreflang: " + sHreflang + " страници, EN бутон: " + sSwitch);
