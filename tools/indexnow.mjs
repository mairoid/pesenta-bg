/* IndexNow (08.10.2026): казва на Bing (и на другите търсачки в IndexNow) кои страници са нови
   или сменени — търсенето на ChatGPT стъпва на Bing, а без това нова страница чака седмици.
   Вика се от .github/workflows/deploy.yml СЛЕД качването, с двата комита на push-а:
     node tools/indexnow.mjs <преди> <след>          — праща
     node tools/indexnow.mjs <преди> <след> --proba  — само печата какво би пратил
   Праща само адреси, които са в sitemap.xml: частните страници (pesni/, plati, blagodarim…)
   не са там и не тръгват. Ключът е публичен по замисъл — файлът <ключ>.txt стои в корена. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const KEY = "dadbf1a58c108bbafe3c6a2ea6a9ec75";
const HOST = "pesenta.bg";
const [predi, sled, flag] = process.argv.slice(2);

if (!predi || !sled || /^0+$/.test(predi)) { console.log("indexnow: няма предишен комит — нищо за пращане"); process.exit(0); }

let imena;
try {
  imena = execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", predi, sled], { encoding: "utf8" })
    .split("\n").filter(Boolean);
} catch (e) { console.log("indexnow: git diff не мина — " + e.message.split("\n")[0]); process.exit(0); }

const sitemap = fs.readFileSync("sitemap.xml", "utf8");
const vKartata = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));
const adresi = [...new Set(imena
  .filter((f) => f.endsWith(".html") || f === "sitemap.xml")
  .map((f) => f === "sitemap.xml" ? null
    : "https://" + HOST + "/" + f.replace(/(^|\/)index\.html$/, "$1"))
  .filter((u) => u && vKartata.has(u)))];

if (!adresi.length) { console.log("indexnow: няма сменени страници от картата на сайта"); process.exit(0); }
console.log("indexnow: " + adresi.length + " адреса\n  " + adresi.join("\n  "));
if (flag === "--proba") process.exit(0);

const telo = { host: HOST, key: KEY, keyLocation: "https://" + HOST + "/" + KEY + ".txt", urlList: adresi.slice(0, 10000) };
try {
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(telo)
  });
  console.log("indexnow: отговор " + r.status + " " + r.statusText);
} catch (e) {
  /* Провалът тук не бива да чупи качването на сайта — страниците вече са горе. */
  console.log("indexnow: заявката не мина — " + e.message);
}
