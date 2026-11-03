/* Отказ от договора (03.11.2026) — проверка на POST /otkaz без мрежа и без истински писма.
   Същата постановка като vaucher-proba.mjs: SQLite в паметта с worker/schema.sql, Brevo
   подменен през globalThis.fetch, заявките през истинския fetch() на Worker-а.
   Имената са измислени — репото е публично. Код 1 при FAIL. */
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/src/index.js";
import { otkazCron } from "../worker/src/otkaz.js";

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
const DB = { prepare: izraz, batch: async () => { throw new Error("batch не се очаква"); } };
const red = (sql, ...a) => db.prepare(sql).get(...a);

const pisma = [];
let brevo = "ok";
const starFetch = globalThis.fetch;
globalThis.fetch = async (url, o) => {
  if (!/api\.brevo\.com/.test(String(url))) throw new Error("непозволена заявка: " + url);
  pisma.push(JSON.parse(o.body));
  const zle = brevo === "fail";
  return { ok: !zle, status: zle ? 400 : 201, text: async () => (zle ? "proba greshka" : "") };
};
const env = {
  DB, BREVO_API_KEY: "proba", MAIL_SENDER: "sales@pesenta.bg", MAIL_SENDER_NAME: "Песента",
  NOTIFY_EMAILS: "miro@example.com", AUDIT_TOKEN: "proba-sol-ne-e-istinska", PUBLIC_BASE: "https://proba.example"
};
const kam = (adres) => pisma.filter((m) => m.to[0].email === adres);
const isprazni = () => { pisma.length = 0; };

let ipN = 0;
async function otkaz(telo, o) {
  o = o || {};
  const l = [];
  const ctx = { waitUntil(p) { l.push(p); } };
  const r = await worker.fetch(new Request("https://proba.example/otkaz", {
    method: o.method || "POST", body: o.method === "OPTIONS" ? undefined : JSON.stringify(telo),
    headers: { "content-type": "text/plain", "CF-Connecting-IP": o.ip || "198.51.100." + (++ipN) }
  }), env, ctx);
  await Promise.all(l);
  let j = null; try { j = JSON.parse(await r.clone().text()); } catch (e) { j = null; }
  if (j && j.id) j.deystvie = red("SELECT deystvie FROM otkazi WHERE id = ?", j.id).deystvie;
  return { status: r.status, json: j, res: r };
}

const dni = (n) => new Date(Date.now() - n * 86400e3).toISOString();
function vaucher(ref, kod, status, platen, email, sesia) {
  db.prepare(`INSERT INTO vaucheri (ref, kod, kod_norm, status, ot_kogo, za_kogo, email, created_at, platen_at, stripe_session)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(ref, kod, kod.replace(/[^A-Z0-9]/g, ""), status, "Пробан Купувач", "Пробна Получателка",
    email, platen || dni(1), platen, sesia || null);
}
let docN = 7000;
function prodazhba(orderNo, email, sesia) {
  db.prepare(`INSERT INTO sales (doc_n, doc_date, order_no, order_date, customer_email, art_name, art_price_st, total_st, paym, stripe_event_key, created_at, trans_n)
    VALUES (?, '2026-11-01', ?, '2026-11-01', ?, 'Песен', 3892, 3892, 4, ?, ?, ?)`).run(++docN, orderNo, email, sesia ? "cs:" + sesia : "pi:" + orderNo, new Date().toISOString(), "pi_" + docN);
}

try {
  vaucher("VCH-261101-0001", "PROBA-PESEN-AAAAA", "aktiven", dni(2), "kupuvach@example.com", "cs_a");
  vaucher("VCH-261101-0002", "PROBA-HIMN-BBBBB", "aktiven", dni(2), "forma@example.com", "cs_b");
  prodazhba("PSN-261101-0002", "stripe@example.com", "cs_b");
  vaucher("VCH-261001-0003", "PROBA-KUPLET-CCCCC", "aktiven", dni(20), "kupuvach@example.com", "cs_c");
  vaucher("VCH-261101-0004", "PROBA-PRIPEV-DDDDD", "izpolzvan", dni(3), "kupuvach@example.com", "cs_d");
  vaucher("VCH-261101-0005", "PROBA-MELODIA-EEEEE", "aktiven", dni(1), "kupuvach@example.com", "cs_e");
  prodazhba("PSN-261101-0009", "pesen@example.com", null);

  glava("валиден отказ от ваучер → спрян, две писма");
  let r = await otkaz({ ime: "Пробан Купувач", nomer: "proba-pesen-aaaaa", email: "Kupuvach@Example.com" });
  proveri(r.status === 200 && r.json.ok && /^OTK-\d{6}-\d{4}$/.test(r.json.id) && r.json.deystvie === "otmenen" && r.json.pismo === true, "ok, OTK-…, otmenen, pismo:true (" + JSON.stringify(r.json) + ")");
  proveri(/\d{2}\.\d{2}\.\d{4}/.test(r.json.vreme), "времето е по софийски, четимо (" + r.json.vreme + ")");
  proveri(red("SELECT status FROM vaucheri WHERE ref = 'VCH-261101-0001'").status === "otmenen", "ваучерът е otmenen");
  const z = red("SELECT * FROM otkazi WHERE id = ?", r.json.id);
  proveri(z && z.vaucher_ref === "VCH-261101-0001" && z.v_status === "aktiven" && z.pismo_at && !z.pismo_greshka, "записът с ваучера, статуса и pismo_at");
  const kl = kam("kupuvach@example.com");
  proveri(kl.length === 1 && kl[0].subject.includes(r.json.id), "потвърждение до клиента с номера в темата");
  const h = kl[0] && kl[0].htmlContent || "";
  proveri(h.includes(r.json.vreme) && h.includes("PROBA-PESEN-AAAAA") && h.includes("Пробан Купувач") && h.includes("207427793"),
    "в писмото: дата и час, номер, име, ЕИК");
  proveri(/кодът вече не важи/.test(h), "писмото казва, че кодът е спрян");
  proveri(kam("miro@example.com").length === 1 && /ВЪРНИ ПАРИТЕ/.test(kam("miro@example.com")[0].subject), "известие до Мирослав: върни парите");
  proveri(r.res.headers.get("Access-Control-Allow-Origin") !== null, "CORS заглавка има");

  glava("повторен отказ за същия код → veche_otmenen, нищо не се чупи");
  r = await otkaz({ ime: "Пробан Купувач", nomer: "PROBA-PESEN-AAAAA", email: "kupuvach@example.com" });
  proveri(r.json.ok && r.json.deystvie === "veche_otmenen", "veche_otmenen (" + r.json.deystvie + ")");

  glava("по PSN номера на продажбата и имейла от Stripe");
  isprazni();
  r = await otkaz({ ime: "Друг Пробен", nomer: "psn-261101-0002", email: "stripe@example.com" });
  proveri(r.json.ok && r.json.deystvie === "otmenen", "PSN на ваучерна продажба + имейл от Stripe → otmenen (" + r.json.deystvie + ")");

  glava("чужд имейл → не се спира");
  isprazni();
  r = await otkaz({ ime: "Някой Друг", nomer: "VCH-261101-0005", email: "chuzhd@example.com" });
  proveri(r.json.ok && r.json.deystvie === "drug_imeyl", "drug_imeyl (" + r.json.deystvie + ")");
  proveri(red("SELECT status FROM vaucheri WHERE ref = 'VCH-261101-0005'").status === "aktiven", "ваучерът остава aktiven");
  proveri(kam("chuzhd@example.com").length === 1 && /ПРЕГЛЕДАЙ/.test(kam("miro@example.com")[0].subject), "потвърждение пак тръгва; известие „прегледай“");

  glava("след срока, използван, песен, непознат");
  r = await otkaz({ ime: "Пробан", nomer: "PROBA-KUPLET-CCCCC", email: "kupuvach@example.com" });
  proveri(r.json.deystvie === "sled_sroka" && red("SELECT status FROM vaucheri WHERE ref = 'VCH-261001-0003'").status === "aktiven", "20 дни → sled_sroka, не е спрян");
  r = await otkaz({ ime: "Пробан", nomer: "PROBA-PRIPEV-DDDDD", email: "kupuvach@example.com" });
  proveri(r.json.deystvie === "izpolzvan", "използван → izpolzvan");
  r = await otkaz({ ime: "Пробан", nomer: "PSN-261101-0009", email: "pesen@example.com" });
  proveri(r.json.deystvie === "pesen", "поръчка на песен → pesen (" + r.json.deystvie + ")");
  r = await otkaz({ ime: "Пробан", nomer: "НЯМА-ТАКЪВ", email: "x@example.com" });
  proveri(r.json.ok && r.json.deystvie === "nenameren", "непознат номер → приет, nenameren");
  proveri(red("SELECT count(*) n FROM otkazi").n === 8, "всички 8 заявления са записани");

  glava("лош вход");
  proveri((await otkaz({ ime: "", nomer: "X", email: "a@b.bg" })).json.prichina === "ime", "без име → ime");
  proveri((await otkaz({ ime: "А", nomer: "", email: "a@b.bg" })).json.prichina === "nomer", "без номер → nomer");
  r = await otkaz({ ime: "А", nomer: "X", email: "не-е-имейл" });
  proveri(r.status === 400 && r.json.prichina === "email", "лош имейл → 400 email");
  proveri((await otkaz(null, { method: "OPTIONS" })).status === 204, "OPTIONS → 204");

  glava("отговорът не издава какво има в базата");
  const sus = await otkaz({ ime: "А", nomer: "PROBA-PRIPEV-DDDDD", email: "x@example.com" });
  const nyama = await otkaz({ ime: "А", nomer: "НЕСЪЩЕСТВУВА-1", email: "x@example.com" });
  const kl1 = Object.keys(sus.json).filter((k) => k !== "id" && k !== "vreme" && k !== "deystvie").sort().join(",");
  const kl2 = Object.keys(nyama.json).filter((k) => k !== "id" && k !== "vreme" && k !== "deystvie").sort().join(",");
  proveri(kl1 === kl2 && kl1 === "ok,pismo", "съществуващ и несъществуващ код → еднакви полета (" + kl1 + " / " + kl2 + ")");

  glava("песен, платена с ваучер (не е в sales) → pesen");
  db.prepare("UPDATE vaucheri SET izpolzvan_order = 'PSN-261102-0077' WHERE ref = 'VCH-261101-0004'").run();
  r = await otkaz({ ime: "Пробан", nomer: "PSN-261102-0077", email: "x@example.com" });
  proveri(r.json.deystvie === "pesen", "pesen (" + r.json.deystvie + ")");

  glava("Brevo не работи → записано, страницата знае, cron-ът допраща");
  brevo = "fail";
  isprazni();
  vaucher("VCH-261101-0006", "PROBA-NAZDRAVE-FFFFF", "aktiven", dni(1), "kupuvach@example.com", "cs_f");
  r = await otkaz({ ime: "Пробан", nomer: "PROBA-NAZDRAVE-FFFFF", email: "kupuvach@example.com" });
  let zf = red("SELECT * FROM otkazi WHERE id = ?", r.json.id);
  proveri(r.json.ok && r.json.pismo === false && zf.pismo_greshka && !zf.pismo_at && zf.pismo_opiti === 1 && !zf.izvestie_at,
    "ok:true, pismo:false, грешката и опитът записани, известието не е тръгнало");
  proveri(red("SELECT status FROM vaucheri WHERE ref = 'VCH-261101-0006'").status === "otmenen", "ваучерът пак е спрян (записът е преди писмата)");
  brevo = "ok";
  isprazni();
  const dep = { brevo: async (e, b) => { const x = await globalThis.fetch("https://api.brevo.com/v3/smtp/email", { body: JSON.stringify(b) }); return { ok: x.ok, error: x.ok ? null : "fail" }; },
                pratiVatreshno: async (e, subj, html) => { const x = await globalThis.fetch("https://api.brevo.com/v3/smtp/email", { body: JSON.stringify({ to: [{ email: "miro@example.com" }], subject: subj, htmlContent: html }) }); return { ok: x.ok }; } };
  await otkazCron(env, dep);
  zf = red("SELECT * FROM otkazi WHERE id = ?", r.json.id);
  proveri(zf.pismo_at && !zf.pismo_greshka && zf.izvestie_at, "cron: потвърждението и известието тръгнаха");
  proveri(kam("kupuvach@example.com").length === 1 && kam("miro@example.com").some((m) => /ВЪРНИ ПАРИТЕ/.test(m.subject)), "писмото до клиента + „върни парите“");
  isprazni();
  await otkazCron(env, dep);
  proveri(pisma.length === 0, "втори cron — нищо повторно");

  glava("4 неуспешни опита → известие „прати на ръка“");
  brevo = "fail";
  r = await otkaz({ ime: "Пробан", nomer: "НЕСЪЩЕСТВУВА-2", email: "y@example.com" });
  for (let i = 0; i < 4; i++) await otkazCron(env, dep);
  zf = red("SELECT * FROM otkazi WHERE id = ?", r.json.id);
  proveri(zf.pismo_opiti === 4 && !zf.pismo_at, "спира на 4 опита (" + zf.pismo_opiti + ")");
  proveri(pisma.some((m) => /\[ОТКАЗ\] Потвърждението не тръгна/.test(m.subject)), "опит за известие „прати на ръка“");
  brevo = "ok";

  glava("ограничение на опитите — отделно от проверките на кодове");
  for (let i = 0; i < 20; i++) {
    await worker.fetch(new Request("https://proba.example/vaucher/proverka?kod=NYAMA-TAKAV-KOD", { headers: { "CF-Connecting-IP": "192.0.2.77" } }), env, { waitUntil() {} });
  }
  const sled20 = await otkaz({ ime: "А", nomer: "X", email: "x@example.com" }, { ip: "192.0.2.77" });
  proveri(sled20.status === 200, "20 проверки на кодове не блокират отказа (" + sled20.status + ")");
  let posleden;
  for (let i = 0; i < 10; i++) posleden = await otkaz({ ime: "А", nomer: "X", email: "x@example.com" }, { ip: "192.0.2.77" });
  proveri(posleden.status === 429, "11-и отказ от същото IP за час → 429");

  glava("гонка: ваучерът осребрен между четенето и UPDATE-а");
  vaucher("VCH-261101-0008", "PROBA-SERENADA-GGGGG", "aktiven", dni(1), "kupuvach@example.com", "cs_g");
  const star = DB.prepare;
  DB.prepare = (sql) => {
    if (/UPDATE vaucheri SET status = 'otmenen'/.test(sql)) db.prepare("UPDATE vaucheri SET status = 'izpolzvan' WHERE ref = 'VCH-261101-0008'").run();
    return star(sql);
  };
  r = await otkaz({ ime: "Пробан", nomer: "PROBA-SERENADA-GGGGG", email: "kupuvach@example.com" });
  DB.prepare = star;
  proveri(r.json.deystvie === "izpolzvan", "казва „izpolzvan“ според истинския статус (" + r.json.deystvie + ")");

  glava("грешка при проверката → заявлението остава записано, ваучерът не е пипан");
  DB.prepare = (sql) => { if (/FROM vaucheri WHERE kod_norm/.test(sql)) throw new Error("D1 падна"); return star(sql); };
  r = await otkaz({ ime: "Пробан", nomer: "PROBA-ESHTE-HHHHH", email: "kupuvach@example.com" });
  DB.prepare = star;
  proveri(r.json.ok && r.json.deystvie === "greshka", "ok, записано като greshka (" + r.json.deystvie + ")");

  glava("линкът в писмото с ваучера носи кода");
  const { vaucherPismoHtml } = await import("../worker/src/index.js");
  const ph = vaucherPismoHtml({ customer_name: "", doc_n: 1, order_no: "PSN-261101-0001" }, { kod: "PROBA-PESEN-AAAAA", za_kogo: "", ot_kogo: "" }, "https://x", false);
  proveri(ph.includes("https://pesenta.bg/otkaz.html?kod=PROBA-PESEN-AAAAA"), "otkaz.html?kod=… в писмото");
} finally {
  globalThis.fetch = starFetch;
}
console.log(gr ? "  " + ok + " минаха, " + gr + " FAIL" : "  " + ok + " проверки минаха — чисто");
process.exit(gr ? 1 : 0);
