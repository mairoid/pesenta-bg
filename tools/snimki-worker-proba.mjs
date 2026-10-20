/* snimki-worker-proba.mjs — POST /snimki на Worker-а (20.10.2026), без мрежа.
   node tools/snimki-worker-proba.mjs
   Вика истинския handleSnimki с подменени DB и fetch: хваща заявката към Brevo и гледа
   какво щеше да тръгне. Нищо не се праща. Код 1 при FAIL. */
import { handleSnimki, SNIMKI_MAX_BAJTA } from "../worker/src/snimki.js";
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
broi = 12;
r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-261020-1234"], ["snimka_1", jpg1]]), env));
ok("13-та заявка от същия IP за часа → 429", r.s === 429 && r.j.prichina === "mnogo_opiti");
broi = 0; brevoStatus = 400;
r = await chetI(await handleSnimki(zayavka([["order_no", "PSN-261020-1234"], ["snimka_1", jpg1]]), env));
ok("Brevo отказва → 502 и ok:false (сайтът минава към резервния път)", r.s === 502 && r.j.ok === false);

R.forEach((x) => console.log("  " + x));
const f = R.filter((x) => x.startsWith("FAIL")).length;
console.log(f ? "  " + f + " FAIL" : "  всичко минава"); process.exit(f ? 1 : 0);
