/* snimki-worker-proba.mjs — POST /snimki на Worker-а (20.10.2026), без мрежа.
   node tools/snimki-worker-proba.mjs
   Вика истинския handleSnimki с подменени DB и fetch: хваща заявката към Brevo и гледа
   какво щеше да тръгне. Нищо не се праща. Код 1 при FAIL. */
import { handleSnimki, SNIMKI_MAX_BAJTA, SNIMKI_BROI, NA_CHAS } from "../worker/src/snimki.js";
import fs from "node:fs";

const R = []; const ok = (n, c, e) => R.push((c ? "OK   " : "FAIL ") + n + (e !== undefined ? "  [" + e + "]" : ""));
const IMG = new URL("../assets/img/", import.meta.url);
const jpg1 = fs.readFileSync(new URL("cover-tutso-400.jpg", IMG));
const jpg2 = fs.readFileSync(new URL("cover-habibi-400.jpg", IMG));

let brevo = [], broi = 0, brevoStatus = 201;
globalThis.fetch = async (u, o) => { brevo.push({ url: String(u), tyalo: JSON.parse(o.body) }); return { ok: brevoStatus < 300, status: brevoStatus }; };
const env = {
  BREVO_API_KEY: "proba", MAIL_SENDER: "sales@pesenta.bg", MAIL_SENDER_NAME: "Песента",
  NOTIFY_EMAILS: "a@primer.bg, b@primer.bg", AUDIT_TOKEN: "sol",
  DB: { prepare: () => ({ bind: () => ({ first: async () => ({ broi: ++broi }) }) }) }
};
const zayavka = (polya) => {
  const fd = new FormData();
  for (const [k, v] of polya) {
    if (v instanceof Uint8Array) fd.append(k, new Blob([v], { type: "image/jpeg" }), k + ".jpg");
    else fd.append(k, v);
  }
  return new Request("https://w.primer/snimki", { method: "POST", body: fd, headers: { "CF-Connecting-IP": "1.2.3.4" } });
};
const chetI = async (r) => ({ s: r.status, j: await r.json() });

/* 1) две снимки → едно писмо с два прикачени файла, към двата адреса */
brevo = [];
let r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-261020-1234"], ["tip", "бърза"], ["snimka_1", jpg1], ["snimka_2", jpg2]]), env));
const p = brevo[0] && brevo[0].tyalo;
ok("2 JPEG → 200 {ok, broi:2}", r.s === 200 && r.j.ok === true && r.j.broi === 2, r.s + " " + JSON.stringify(r.j));
ok("едно писмо към Brevo, до NOTIFY_EMAILS, тема „Снимки за обложката — PSN-…“", brevo.length === 1 && /api\.brevo\.com\/v3\/smtp\/email$/.test(brevo[0].url) && p.to.length === 2 && p.subject === "Снимки за обложката — PSN-261020-1234", p && p.subject);
ok("прикачените са байт по байт същите, с имена snimka-PSN-…-N.jpg", !!p && p.attachment.length === 2 &&
  Buffer.from(p.attachment[0].content, "base64").equals(jpg1) && Buffer.from(p.attachment[1].content, "base64").equals(jpg2) &&
  p.attachment[0].name === "snimka-PSN-261020-1234-1.jpg" && p.attachment[1].name === "snimka-PSN-261020-1234-2.jpg", p && p.attachment.map((a) => a.name).join(", "));

/* 1б) група от поръчка с 30 снимки (04.11.2026): полетата носят общия номер, темата — частта */
brevo = [];
r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-261104-1234"], ["tip", "пълна"], ["obshto", "30"],
  ...[6, 7, 8, 9, 10].map((n) => ["snimka_" + n, n % 2 ? jpg1 : jpg2])]), env));
const p6 = brevo[0] && brevo[0].tyalo;
ok("snimka_6…10 от 30 → 200 {broi:5}, имена -6…-10, тема „… (6–10 от 30)“", r.s === 200 && r.j.broi === 5 && !!p6 &&
  p6.attachment.map((a) => a.name).join(",") === [6, 7, 8, 9, 10].map((n) => "snimka-PSN-261104-1234-" + n + ".jpg").join(",") &&
  p6.subject === "Снимки за обложката — PSN-261104-1234 (6–10 от 30)" && p6.htmlContent.includes("(6–10 от 30)"), p6 && p6.subject);
brevo = [];
await handleSnimki(zayavka([["order_no", "PSN-261104-1234"], ["obshto", "7"], ["snimka_6", jpg1], ["snimka_7", jpg2]]), env);
ok("последната група от 7 → тема „… (6–7 от 7)“", brevo[0] && brevo[0].tyalo.subject === "Снимки за обложката — PSN-261104-1234 (6–7 от 7)", brevo[0] && brevo[0].tyalo.subject);
brevo = [];
r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-261104-1234"], ["obshto", "6"], ...[1, 2, 3, 4, 5, 6].map((n) => ["snimka_" + n, jpg1])]), env));
ok(SNIMKI_BROI + 1 + " снимки в една заявка → 400 mnogo, без писмо", r.s === 400 && r.j.prichina === "mnogo" && brevo.length === 0, r.s + " " + r.j.prichina);
/* вграденият toBase64 (го има в Worker-а; в Node 24 — не): ако го има, ползва се той */
let vgr = 0;
const bez = Uint8Array.prototype.toBase64;
Uint8Array.prototype.toBase64 = function () { vgr++; return Buffer.from(this).toString("base64"); };
brevo = [];
await handleSnimki(zayavka([["order_no", "PSN-261104-1234"], ["snimka_1", jpg1], ["snimka_2", jpg2]]), env);
ok("с вграден toBase64 → ползва се той, байтовете пак са същите", vgr === 2 && !!brevo[0] &&
  Buffer.from(brevo[0].tyalo.attachment[0].content, "base64").equals(jpg1) && Buffer.from(brevo[0].tyalo.attachment[1].content, "base64").equals(jpg2), vgr);
if (bez) Uint8Array.prototype.toBase64 = bez; else delete Uint8Array.prototype.toBase64;

/* 2) отказите — и нито едно писмо при тях */
brevo = [];
r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-1"], ["snimka_1", jpg1]]), env));
ok("невалиден номер → 400 nomer", r.s === 400 && r.j.prichina === "nomer");
r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-261020-1234"], ["snimka_1", new TextEncoder().encode("<html>не е снимка</html>")]]), env));
ok("не-JPEG (по байтовете) → 415", r.s === 415 && r.j.prichina === "ne_e_jpeg");
r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-261020-1234"]]), env));
ok("без снимки → 400 nyama_snimki", r.s === 400 && r.j.prichina === "nyama_snimki");
const golyama = new Uint8Array(SNIMKI_MAX_BAJTA + 10); golyama.set([0xFF, 0xD8, 0xFF]);
r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-261020-1234"], ["snimka_1", golyama]]), env));
ok("над 6 MB → 413", r.s === 413, r.s);
ok("при отказите не тръгва писмо", brevo.length === 0, brevo.length);

/* 3) лимитът на час и провал на Brevo */
broi = NA_CHAS;
r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-261020-1234"], ["snimka_1", jpg1]]), env));
ok(NA_CHAS + 1 + "-ва заявка от същия IP за часа → 429", r.s === 429 && r.j.prichina === "mnogo_opiti");
broi = 0; brevoStatus = 400;
r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-261020-1234"], ["snimka_1", jpg1]]), env));
ok("Brevo отказва → 502 и ok:false (сайтът минава към резервния път)", r.s === 502 && r.j.ok === false);

R.forEach((x) => console.log("  " + x));
const f = R.filter((x) => x.startsWith("FAIL")).length;
console.log(f ? "  " + f + " FAIL" : "  всичко минава"); process.exit(f ? 1 : 0);
