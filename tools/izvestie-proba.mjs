/* Писмото „Постъпи плащане“ (notifyVatreshno) — проверка без пращане (06.10.2026).
   DB и fetch са подменени: заявката към Brevo се хваща и се гледа какво щеше да тръгне.
   Данните са измислени — репото е публично. С аргумент — изходът на
     wrangler d1 execute pesenta-nap --remote --json --command "SELECT vid, povod, stilove, ezik, razkaz, poleta FROM briefs WHERE order_no = '…'"
   — минава и с истински запис (без да го печата), за да се види, че колоните съвпадат.
   Втори аргумент — папка, където да запише HTML-а на първия случай за преглед. Код 1 при FAIL. */
import fs from "node:fs";
import { notifyVatreshno, briefDopalnitelno } from "../worker/src/index.js";

let gr = 0, ok = 0;
const proveri = (uslovie, opisanie) => { if (uslovie) ok++; else { gr++; console.log("    ✗ " + opisanie); } };

async function pusni(red, n) {
  const sqlove = [];
  let hvanato = null;
  const env = {
    BREVO_API_KEY: "proba", MAIL_SENDER: "sales@pesenta.bg", MAIL_SENDER_NAME: "Песента",
    DB: { prepare(sql) { sqlove.push(sql); return { bind() { return { first: async () => red }; } }; } }
  };
  const star = globalThis.fetch;
  globalThis.fetch = async (url, o) => { hvanato = { url, headers: o.headers, telo: JSON.parse(o.body) }; return { ok: true }; };
  try { await notifyVatreshno(env, n); } finally { globalThis.fetch = star; }
  return { sqlove, hvanato };
}

const plashtane = {
  order_no: "PSN-261006-0000", doc_n: 1018, amount_c: 1990, currency: "eur", currency_ok: true,
  customer_name: "Проба Пробова", customer_email: "proba@example.com", express: false,
  payment_intent: "pi_proba", beleshka: { ok: true }
};
const razkaz = { vid: "бърза текстова", povod: "Рожден ден", stilove: "Поп", ezik: "Български",
  razkaz: "Измислен разказ за проба — колежка, кухня, капачки." };
const poleta = (o) => JSON.stringify(Object.assign({ order_no: plashtane.order_no }, o));

const sluchai = [
  { ime: "дата + 1 снимка", red: { ...razkaz, poleta: poleta({ event_date: "2026-10-19", snimki: 1 }) },
    ima: ["Дата на повода", "19.10.2026", "1 (в отделно писмо)", "приложил 1 снимка", "Снимки за обложката — PSN-261006-0000", ">Вид<", "бърза текстова", razkaz.razkaz],
    няма: ["[БЕЗ РАЗКАЗ]"] },
  { ime: "3 снимки", red: { ...razkaz, poleta: poleta({ event_date: "2026-12-24", snimki: 3 }) },
    ima: ["24.12.2026", "приложил 3 снимки", "3 (в отделно писмо)"], няма: [] },
  { ime: "без снимки и без дата", red: { ...razkaz, poleta: poleta({ event_date: "", snimki: 0 }) },
    ima: [">Снимки<", ">няма<"], няма: ["Дата на повода", "приложил"] },
  { ime: "стар бриф без poleta", red: { ...razkaz, poleta: null },
    ima: [razkaz.razkaz, ">Повод<"], няма: ["Дата на повода", ">Снимки<", "приложил"] },
  { ime: "счупен JSON в poleta", red: { ...razkaz, poleta: "{не е json" },
    ima: [razkaz.razkaz], няма: ["Дата на повода", ">Снимки<"] },
  { ime: "грешна дата", red: { ...razkaz, poleta: poleta({ event_date: "19/10", snimki: "2" }) },
    ima: ["приложил 2 снимки"], няма: ["Дата на повода", "19/10"] },
  { ime: "опит за HTML в полетата", red: { ...razkaz, povod: "<b>x</b>", poleta: poleta({ snimki: 1 }) },
    ima: ["&lt;b&gt;x&lt;/b&gt;"], няма: ["<b>x</b>"] },
  { ime: "няма бриф", red: null,
    ima: ["НЯМА разказ"], няма: ["приложил", ">Снимки<"], tema: "[БЕЗ РАЗКАЗ] " }
];

let parvi = null;
for (const s of sluchai) {
  console.log("  == " + s.ime + " ==");
  const { sqlove, hvanato } = await pusni(s.red, plashtane);
  proveri(sqlove.some((q) => /SELECT[^]*poleta[^]*FROM briefs/.test(q)), "заявката не чете poleta");
  proveri(hvanato && hvanato.url === "https://api.brevo.com/v3/smtp/email", "не е стигнало до Brevo");
  if (!hvanato) continue;
  const h = hvanato.telo.htmlContent;
  if (!parvi) parvi = h;
  s.ima.forEach((t) => proveri(h.includes(t), "липсва: " + t));
  s.няма.forEach((t) => proveri(!h.includes(t), "не бива да го има: " + t));
  proveri(hvanato.telo.subject === (s.tema || "") + "Плащане 19.90 EUR · PSN-261006-0000", "темата е „" + hvanato.telo.subject + "“");
  proveri(hvanato.headers["api-key"] === "proba", "ключът не е минал");
}

/* briefDopalnitelno отделно — границите */
const b = briefDopalnitelno;
proveri(b(undefined).snimki === 0 && b(undefined).data === "" && !b(undefined).snimkiIzvestni, "празно → нищо");
proveri(b('{"snimki":-1}').snimki === 0, "отрицателни снимки");
proveri(b('{"snimki":0}').snimkiIzvestni === true, "0 снимки е известно");
proveri(b('{"event_date":"2026-02-30x"}').data === "", "дата с опашка");

/* истински запис от D1, ако е подаден — без печатане на съдържанието */
if (process.argv[2]) {
  console.log("  == истински запис от D1 ==");
  const j = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const red = j[0] && j[0].results && j[0].results[0];
  proveri(!!red, "няма ред в изхода на wrangler");
  if (red) {
    proveri("poleta" in red && "razkaz" in red, "колоните vid…poleta не са дошли");
    const { hvanato } = await pusni(red, plashtane);
    const d = briefDopalnitelno(red.poleta);
    const h = hvanato.telo.htmlContent;
    proveri(!d.data || h.includes(d.data), "датата от записа не е в писмото");
    proveri(!d.snimki || h.includes("приложил " + d.snimki), "снимките от записа не са в писмото");
    console.log("    дата: " + (d.data || "—") + ", снимки: " + d.snimki);
  }
}

if (process.argv[3] && parvi) {
  fs.writeFileSync(process.argv[3].replace(/[\\/]*$/, "/") + "izvestie-proba.html",
    "<!DOCTYPE html><meta charset=\"UTF-8\"><body style=\"margin:24px;max-width:720px\">" + parvi);
}
console.log("\n  " + ok + " проверки минаха" + (gr ? ", " + gr + " FAIL" : " — чисто"));
process.exitCode = gr ? 1 : 0;
