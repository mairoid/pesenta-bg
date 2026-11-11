/* Магнитите (11.11.2026) — проверка на POST /magnit без мрежа и без истински писма.
   Същата постановка като otkaz-proba.mjs: SQLite в паметта с worker/schema.sql, Brevo
   подменен през globalThis.fetch, заявките през истинския fetch() на Worker-а.
   Адресите са измислени — репото е публично. Код 1 при FAIL.
     node tools/magnit-proba.mjs */
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/src/index.js";
import { MAGNIT_NA_CHAS } from "../worker/src/magnit.js";

let gr = 0, ok = 0;
const proveri = (u, o) => { if (u) ok++; else { gr++; console.log("    ✗ " + o); } };
const glava = (t) => console.log("  · " + t);

const db = new DatabaseSync(":memory:");
db.exec(fs.readFileSync(new URL("../worker/schema.sql", import.meta.url), "utf8"));
function izraz(sql) {
  const st = db.prepare(sql);
  let a = [];
  const o = {
    bind(...x) { a = x; return o; },
    all: async () => ({ results: st.all(...a) }),
    first: async () => st.get(...a) || null,
    run: async () => { const r = st.run(...a); return { success: true, meta: { changes: Number(r.changes) } }; }
  };
  return o;
}
const DB = { prepare: izraz };
const red = (sql, ...a) => db.prepare(sql).get(...a);

const pisma = [];
let brevo = "ok";
globalThis.fetch = async (url, o) => {
  if (!/api\.brevo\.com/.test(String(url))) throw new Error("непозволена заявка: " + url);
  pisma.push(JSON.parse(o.body));
  const zle = brevo === "fail";
  return { ok: !zle, status: zle ? 400 : 201, text: async () => (zle ? "proba greshka" : "") };
};
const env = {
  DB, BREVO_API_KEY: "proba", MAIL_SENDER: "sales@pesenta.bg", MAIL_SENDER_NAME: "Песента",
  AUDIT_TOKEN: "proba-sol-ne-e-istinska", PUBLIC_BASE: "https://proba.example"
};

let ipN = 0;
async function magnit(telo, o) {
  o = o || {};
  const h = { "content-type": "text/plain", "CF-Connecting-IP": o.ip || "198.51.100." + (++ipN) };
  if (o.origin !== null) h.Origin = o.origin || "https://pesenta.bg";
  const r = await worker.fetch(new Request("https://proba.example/magnit", {
    method: o.method || "POST", body: o.method === "OPTIONS" ? undefined : (typeof telo === "string" ? telo : JSON.stringify(telo)), headers: h
  }), env, { waitUntil() {} });
  let j = null; try { j = JSON.parse(await r.clone().text()); } catch (e) { j = null; }
  return { status: r.status, json: j, res: r };
}

glava("валиден имейл → запис, едно текстово писмо с връзката към PDF-а");
let r = await magnit({ email: " Proba.Klient@Example.com ", magnit: "koleda-9", marketing: true, ot: "/podarak-za-chovek-koyto-ima-vsichko.html?utm_source=facebook" });
proveri(r.status === 200 && r.json.ok === true, "очаквах 200 ok, дойде " + r.status + " " + JSON.stringify(r.json));
proveri(pisma.length === 1, "очаквах 1 писмо, дойдоха " + pisma.length);
const p = pisma[0];
proveri(p && p.to[0].email === "proba.klient@example.com", "адресът не е нормализиран");
proveri(p && !p.htmlContent && /9-podaraka-za-chovek-koyto-ima-vsichko\.pdf/.test(p.textContent), "писмото трябва да е само текст с връзката към PDF-а");
proveri(p && /отпиши ме/.test(p.textContent), "липсва редът за отписване");
let z = red("SELECT * FROM magnit_zapisi ORDER BY id DESC LIMIT 1");
proveri(z && z.marketing === 1 && z.pismo_at && !z.pismo_greshka, "записът трябва да е с marketing=1 и pismo_at");
proveri(z && /^[0-9a-f]{32}$/.test(z.ip_hash) && !/198\.51/.test(JSON.stringify(z)), "в базата не бива да има IP");
proveri(z && z.ot && z.ot.indexOf("@") < 0, "ot трябва да е без лични данни");
proveri(r.res.headers.get("Access-Control-Allow-Origin") === "https://pesenta.bg", "липсва CORS заглавката");

glava("без отметката → гайдът тръгва, marketing = 0");
pisma.length = 0;
r = await magnit({ email: "vtori@example.com", magnit: "koleda-9" });
z = red("SELECT marketing FROM magnit_zapisi WHERE email = 'vtori@example.com'");
proveri(r.status === 200 && pisma.length === 1 && z.marketing === 0, "без съгласие гайдът пак се праща, но marketing = 0");
r = await magnit({ email: "treti@example.com", magnit: "koleda-9", marketing: "true" });
z = red("SELECT marketing FROM magnit_zapisi WHERE email = 'treti@example.com'");
proveri(z.marketing === 0, "само истинско true е съгласие, не низ");

glava("повторно натискане до 10 минути → без второ писмо");
pisma.length = 0;
r = await magnit({ email: "vtori@example.com", magnit: "koleda-9" });
proveri(r.status === 200 && r.json.povtor === true && pisma.length === 0, "повторът не бива да праща писмо");

glava("лош вход");
proveri((await magnit({ email: "ne-e-imeyl", magnit: "koleda-9" })).status === 400, "невалиден имейл → 400");
proveri((await magnit({ email: "a@example.com", magnit: "nyama-takav" })).status === 400, "непознат магнит → 400");
proveri((await magnit("{не е json")).status === 400, "счупен JSON → 400");
proveri((await magnit({ email: "a@example.com", magnit: "koleda-9", ot: "x".repeat(3000) })).status === 413, "голямо тяло → 413");
proveri((await magnit({ email: "a@example.com", magnit: "koleda-9" }, { origin: "https://chuzhd.example" })).status === 403, "чужд произход → 403");
proveri((await magnit({ email: "bez-origin@example.com", magnit: "koleda-9" }, { origin: null })).status === 200, "без Origin (стари браузъри) минава");
proveri((await magnit(null, { method: "OPTIONS" })).status === 204, "OPTIONS → 204");

glava("лимит от един адрес: " + MAGNIT_NA_CHAS + " на час, следващият → 429 и без писмо");
pisma.length = 0;
for (let i = 0; i < MAGNIT_NA_CHAS; i++) await magnit({ email: "limit" + i + "@example.com", magnit: "koleda-9" }, { ip: "203.0.113.9" });
r = await magnit({ email: "limit-nad@example.com", magnit: "koleda-9" }, { ip: "203.0.113.9" });
proveri(r.status === 429 && pisma.length === MAGNIT_NA_CHAS, "очаквах 429 и " + MAGNIT_NA_CHAS + " писма, дойде " + r.status + " / " + pisma.length);
proveri((await magnit({ email: "drug-ip@example.com", magnit: "koleda-9" }, { ip: "203.0.113.10" })).status === 200, "друг адрес минава");

glava("Brevo отказва → записът остава с грешката, страницата получава връзката");
brevo = "fail";
r = await magnit({ email: "brevo-pada@example.com", magnit: "koleda-9" });
z = red("SELECT * FROM magnit_zapisi WHERE email = 'brevo-pada@example.com'");
proveri(r.status === 502 && r.json.pdf && /\.pdf$/.test(r.json.pdf), "при отказ: 502 и връзката към PDF-а");
proveri(z && !z.pismo_at && /Brevo HTTP 400/.test(z.pismo_greshka), "грешката трябва да е записана, pismo_at празно");
brevo = "ok";

glava("събитието Magnet Lead се приема от /sabitie");
const s = await worker.fetch(new Request("https://proba.example/sabitie", {
  method: "POST", body: JSON.stringify({ e: "Magnet Lead", p: "/podarak-za-chovek-koyto-ima-vsichko.html", d: "koleda-9" })
}), env, { waitUntil() {} });
proveri(s.status === 200, "/sabitie трябва да приеме Magnet Lead, дойде " + s.status);

console.log("\n  " + (gr ? "✗ " + gr + " паднаха, " : "✓ ") + ok + " минаха");
process.exit(gr ? 1 : 0);
