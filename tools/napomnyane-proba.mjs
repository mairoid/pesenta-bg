/* Напомнянето до неплатила поръчка (napomniNeplateni) — проверка без пращане (13.10.2026).
   Базата е истинска SQLite в паметта (node:sqlite) със същите таблици; Brevo е подменен —
   писмата се хващат и се гледа какво щеше да тръгне. Данните са измислени (репото е публично).
   Втори аргумент — папка, където да запише българското писмо за преглед. Код 1 при FAIL. */
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { napomniNeplateni } from "../worker/src/index.js";

let gr = 0, ok = 0;
const proveri = (u, o) => { if (u) ok++; else { gr++; console.log("    ✗ " + o); } };

const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE briefs (order_no TEXT PRIMARY KEY, created_at TEXT NOT NULL, vid TEXT, povod TEXT, stilove TEXT, ezik TEXT, razkaz TEXT, poleta TEXT);
CREATE TABLE sales (order_no TEXT, customer_email TEXT, created_at TEXT);
CREATE TABLE napomnyania (order_no TEXT PRIMARY KEY, created_at TEXT NOT NULL, email TEXT, ok INTEGER NOT NULL DEFAULT 0, error TEXT);`);
/* Обвивка с интерфейса на D1: prepare().bind().all()/first()/run() */
const DB = { prepare(sql) { const st = db.prepare(sql); let a = [];
  const o = { bind(...x) { a = x; return o; },
    all: async () => ({ results: st.all(...a) }), first: async () => st.get(...a) || null, run: async () => st.run(...a) };
  return o; } };

const SEGA = new Date("2026-10-15T09:00:00Z");
const predi = (h) => new Date(SEGA.getTime() - h * 3600e3).toISOString();
const brif = (no, h, o) => db.prepare("INSERT INTO briefs VALUES (?,?,?,?,?,?,?,?)").run(no, predi(h),
  o.vid || "бърза текстова", o.povod || "Рожден ден", "", "", "разказ", JSON.stringify(Object.assign({ order_no: no }, o.poleta || {})));

brif("PSN-1", 30, { poleta: { email: "klient@example.com", event_date: "2026-10-18" } });          // праща се
brif("PSN-2", 10, { poleta: { email: "rano@example.com" } });                                         // твърде рано
brif("PSN-3", 50, { poleta: { email: "kasno@example.com" } });                                        // твърде късно
brif("PSN-4", 30, { poleta: { email: "test@russev.net" } });                                          // наш адрес
brif("PSN-5", 30, { poleta: {} });                                                                     // без имейл
brif("PSN-6", 30, { poleta: { email: "platil@example.com" } });                                       // платил с друга поръчка
db.prepare("INSERT INTO sales VALUES (?,?,?)").run("PSN-6B", "Platil@Example.com", predi(25));
brif("PSN-7", 30, { poleta: { email: "minal@example.com", event_date: "2026-10-14" } });              // поводът мина
brif("PSN-8", 30, { poleta: { email: "veche@example.com" } });                                         // вече напомнен
db.prepare("INSERT INTO napomnyania VALUES (?,?,?,?,?)").run("PSN-8", predi(5), "veche@example.com", 1, null);
brif("PSN-9", 30, { vid: "бърза текстова (EN)", povod: "Birthday", poleta: { email: "en@example.com" } }); // английски
brif("PSN-10", 30, { poleta: { email: "plateno@example.com" } });                                      // платена
db.prepare("INSERT INTO sales VALUES (?,?,?)").run("PSN-10", "plateno@example.com", predi(29));
brif("PSN-11", 30, { povod: "<b>x</b>", poleta: { email: "html@example.com" } });                       // HTML в повода
brif("PSN-12", 30, { povod: "— не е избран, виж разказа", poleta: { email: "bezpovod@example.com" } }); // без повод

const env = { DB, BREVO_API_KEY: "proba", MAIL_SENDER: "sales@pesenta.bg", MAIL_SENDER_NAME: "Песента",
  PAYMENT_LINK: "https://buy.stripe.com/proba" };
const pisma = [];
const star = globalThis.fetch;
globalThis.fetch = async (url, o) => { pisma.push({ url, telo: JSON.parse(o.body) }); return { ok: true }; };
let r1, r2;
try { r1 = await napomniNeplateni(env, SEGA); r2 = await napomniNeplateni(env, SEGA); } finally { globalThis.fetch = star; }

const za = (e) => pisma.find((p) => p.telo.to[0].email === e);
const red = (no) => db.prepare("SELECT * FROM napomnyania WHERE order_no = ?").get(no);
console.log("  първо пускане:", JSON.stringify(r1), " второ:", JSON.stringify(r2));
proveri(r1.prateni === 4, "трябваше 4 писма (PSN-1, 9, 11, 12), а са " + r1.prateni);
proveri(r2.prateni === 0 && r2.pregledani === 0, "второто пускане пак праща");
proveri(pisma.length === 4, "Brevo е викан " + pisma.length + " пъти");

const b = za("klient@example.com");
proveri(b && /Песента ти още чака — PSN-1/.test(b.telo.subject), "тема на българското");
proveri(b && b.telo.htmlContent.includes("client_reference_id=PSN-1") && b.telo.htmlContent.includes("prefilled_email=klient%40example.com") && b.telo.htmlContent.includes("locale=bg"), "връзката за плащане");
proveri(b && b.telo.htmlContent.includes("18.10.2026"), "датата на повода липсва");
proveri(b && b.telo.replyTo && b.telo.replyTo.email === "sales@pesenta.bg", "replyTo");
const e = za("en@example.com");
proveri(e && /Your song is still waiting/.test(e.telo.subject) && e.telo.htmlContent.includes("locale=auto") && e.telo.sender.name === "Pesenta", "английското писмо");
const h = za("html@example.com");
proveri(h && h.telo.htmlContent.includes("&lt;b&gt;x&lt;/b&gt;") && !h.telo.htmlContent.includes("<b>x</b>"), "HTML в повода не е екраниран");
const bp = za("bezpovod@example.com");
proveri(bp && !bp.telo.htmlContent.includes("не е избран"), "„не е избран“ влиза в писмото");

for (const [no, prichina] of [["PSN-4", "вътрешен адрес"], ["PSN-5", "без имейл"], ["PSN-6", "платил с друга поръчка"], ["PSN-7", "поводът мина"]])
  proveri(red(no) && red(no).ok === 0 && red(no).error === prichina, no + " трябваше „" + prichina + "“, а е " + JSON.stringify(red(no)));
for (const no of ["PSN-2", "PSN-3", "PSN-10"]) proveri(!red(no), no + " не бива да е пипан");
proveri(red("PSN-1") && red("PSN-1").ok === 1, "PSN-1 не е записан като пратен");

const bezLink = await napomniNeplateni({ ...env, PAYMENT_LINK: "" }, SEGA);
proveri(bezLink.prateni === 0 && bezLink.prichina, "без PAYMENT_LINK не бива да праща");

if (process.argv[2] && b) {
  fs.writeFileSync(process.argv[2] + "/napomnyane-bg.html", "<meta charset=utf-8><h3>" + b.telo.subject + "</h3>" + b.telo.htmlContent);
  fs.writeFileSync(process.argv[2] + "/napomnyane-en.html", "<meta charset=utf-8><h3>" + e.telo.subject + "</h3>" + e.telo.htmlContent);
}
console.log(gr ? "  " + ok + " минаха, " + gr + " FAIL" : "  " + ok + " проверки минаха — чисто");
process.exit(gr ? 1 : 0);
