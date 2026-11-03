/* Отказ от договора (03.11.2026) — функцията по чл. 52а ЗЗП
   ─────────────────────────────────────────────────────────────────────
   В сила от 24.09.2026: за договор от разстояние с право на отказ трябва
   функция „откажете се от договора тук“ → заявление (име, номер, имейл) →
   „потвърждавам отказа“ → потвърждение на траен носител (имейл) с датата и
   часа, без излишно забавяне. При нас правото го има само ваучерът (ОУ т. 10);
   за песните е изключено по чл. 57, т. 3 и т. 13 — но заявлението се приема
   и записва от всеки, решението кое важи е наше, не на формата.

     POST /otkaz — {ime, nomer, email}; text/plain JSON като /brief

   Редът е важен: ПЪРВО записът (заявлението е доказателство и не бива да се
   губи), после спирането на ваучера, после писмата. Писмото до клиента се
   чака — страницата казва истината дали е тръгнало. Нетръгналите (и
   известията до нас) се допращат от otkazCron на всеки час.

   Ваучерът се спира сам САМО ако: намерен е, активен е, платен е преди
   по-малко от SROK_DNI дни и имейлът съвпада с този от покупката. Иначе —
   запис и известие за ръчен преглед (иначе чужд код + чуждо име биха спрели
   подарък). Парите се връщат на ръка през Stripe; vaucherPriVrashtane вижда
   „вече отменен“. Отговорът към браузъра НЕ казва какво е намерено — иначе
   формата става начин да се пробват кодове и номера.
   brevo и pratiVatreshno идват от index.js като аргументи — без кръгов импорт.
   ───────────────────────────────────────────────────────────────────── */

import { normKod, ipHash, chetiTelo, vjson, esc, EMAIL_RE, REF_RE } from "./vaucher.js";

/* 14 дни по чл. 50 + ден запас за часовата зона и плащането около полунощ. */
const SROK_DNI = 15;
/* Отделен брояч от проверките на кодове: отказът трябва да е достъпен по всяко време. */
export const OTKAZ_NA_CHAS = 10;
const OPITI_PISMO = 4;

const chistRed = (v) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

export function proveriOtkaz(telo) {
  if (!telo || typeof telo !== "object") return { ok: false, prichina: "nevaliden" };
  const ime = chistRed(telo.ime), nomer = chistRed(telo.nomer).toUpperCase();
  const email = chistRed(telo.email).toLowerCase();
  if (!ime || ime.length > 80) return { ok: false, prichina: "ime" };
  if (!nomer || nomer.length > 40) return { ok: false, prichina: "nomer" };
  if (email.length > 120 || !EMAIL_RE.test(email)) return { ok: false, prichina: "email" };
  return { ok: true, d: { ime, nomer, email } };
}

/* Същата таблица vaucher_opiti, но часът е с наставка „o“ — броячът е друг, а
   чистенето в vaucherCron (chas < вчера) пак го хваща, защото „…T12o“ < „…T13“. */
async function vLimitaOtkaz(request, env, sega) {
  const chas = (sega || new Date()).toISOString().slice(0, 13) + "o";
  const r = await env.DB.prepare(
    `INSERT INTO vaucher_opiti (ip_hash, chas, broi) VALUES (?,?,1)
     ON CONFLICT(ip_hash, chas) DO UPDATE SET broi = broi + 1 RETURNING broi`
  ).bind(await ipHash(request, env), chas).first();
  return !r || r.broi <= OTKAZ_NA_CHAS;
}

/* Номерът е код на ваучер, VCH-… или PSN-… — търси се ваучерът зад него. */
async function namerVaucher(env, nomer) {
  if (REF_RE.test(nomer)) return { vid: "vaucher", v: await env.DB.prepare("SELECT * FROM vaucheri WHERE ref = ?").bind(nomer).first() };
  if (/^PSN-\d{6}-\d{4}$/.test(nomer)) {
    const s = await env.DB.prepare("SELECT order_no, stripe_event_key FROM sales WHERE order_no = ?").bind(nomer).first();
    if (s && /^cs:/.test(String(s.stripe_event_key || ""))) {
      const v = await env.DB.prepare("SELECT * FROM vaucheri WHERE stripe_session = ?").bind(s.stripe_event_key.slice(3)).first();
      if (v) return { vid: "vaucher", v };
    }
    if (s) return { vid: "poruchka", v: null };
    /* Песен, платена с ваучер — не е в sales, а в izpolzvan_order. */
    const po = await env.DB.prepare("SELECT 1 AS da FROM vaucheri WHERE izpolzvan_order = ?").bind(nomer).first();
    return { vid: po ? "poruchka" : "nyama", v: null };
  }
  const kn = normKod(nomer);
  if (kn.length < 8) return { vid: "nyama", v: null };
  return { vid: "vaucher", v: await env.DB.prepare("SELECT * FROM vaucheri WHERE kod_norm = ?").bind(kn).first() };
}

async function imeylNaKupuvacha(env, v) {
  const m = new Set([String(v.email || "").toLowerCase()]);
  if (v.stripe_session) {
    const s = await env.DB.prepare("SELECT customer_email FROM sales WHERE stripe_event_key = ?").bind("cs:" + v.stripe_session).first();
    if (s && s.customer_email) m.add(String(s.customer_email).toLowerCase());
  }
  m.delete("");
  return m;
}

export function noviOtkazId(sega) {
  const d = (sega || new Date()).toISOString();
  const b = new Uint8Array(2);
  crypto.getRandomValues(b);
  return "OTK-" + d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10) + "-" + String(((b[0] << 8) | b[1]) % 10000).padStart(4, "0");
}

export const sofiaVreme = (iso) => new Date(iso).toLocaleString("bg-BG", {
  timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
});

export async function handleOtkaz(request, env, ctx, dep) {
  if (!(await vLimitaOtkaz(request, env))) return vjson({ ok: false, prichina: "mnogo_opiti" }, 429);
  const { telo, greshka } = await chetiTelo(request, 2000);
  if (greshka) return greshka;
  const p = proveriOtkaz(telo);
  if (!p.ok) return vjson({ ok: false, prichina: p.prichina }, 400);
  const d = p.d, sega = new Date(), segaIso = sega.toISOString();

  /* 1. Записът — преди всичко друго. */
  let id = noviOtkazId(sega);
  for (let i = 0; ; i++) {
    try {
      await env.DB.prepare(
        "INSERT INTO otkazi (id, created_at, ime, nomer, email, deystvie) VALUES (?,?,?,?,?, 'priet')"
      ).bind(id, segaIso, d.ime, d.nomer, d.email).run();
      break;
    } catch (e) {
      if (i >= 4) return vjson({ ok: false, prichina: "zapis" }, 500);
      id = noviOtkazId(sega);
    }
  }

  /* 2. Какво е и спиране на ваучера, ако всичко съвпада. Грешка тук не губи заявлението. */
  let deystvie = "greshka", v = null;
  try {
    const n = await namerVaucher(env, d.nomer);
    v = n.v;
    if (n.vid === "poruchka") deystvie = "pesen";
    else if (!v || v.status === "chaka") deystvie = "nenameren";
    else if (v.status === "izpolzvan") deystvie = "izpolzvan";
    else if (v.status === "otmenen") deystvie = "veche_otmenen";
    else if (!v.platen_at || sega - new Date(v.platen_at) > SROK_DNI * 86400e3) deystvie = "sled_sroka";
    else if (!(await imeylNaKupuvacha(env, v)).has(d.email)) deystvie = "drug_imeyl";
    else {
      const r = await env.DB.prepare("UPDATE vaucheri SET status = 'otmenen', otmenen_at = ? WHERE ref = ? AND status = 'aktiven'")
        .bind(segaIso, v.ref).run();
      if (r && r.meta && r.meta.changes === 1) deystvie = "otmenen";
      else {
        /* Някой го е сменил между четенето и UPDATE-а — казваме какво е сега. */
        const sg = await env.DB.prepare("SELECT status FROM vaucheri WHERE ref = ?").bind(v.ref).first();
        deystvie = sg && sg.status === "izpolzvan" ? "izpolzvan" : "veche_otmenen";
      }
    }
  } catch (e) { deystvie = "greshka"; }
  await env.DB.prepare("UPDATE otkazi SET vaucher_ref = ?, v_status = ?, deystvie = ? WHERE id = ?")
    .bind(v ? v.ref : null, v ? v.status : null, deystvie, id).run().catch(() => {});

  /* 3. Потвърждението до клиента — чака се; известието до нас — във фон. */
  const z = { id, created_at: segaIso, ime: d.ime, nomer: d.nomer, email: d.email, deystvie, vaucher_ref: v ? v.ref : null, v_status: v ? v.status : null,
              kod: v ? v.kod : null, platen_at: v ? v.platen_at : null };
  const pismo = await pratiPotvarzhdenie(env, dep, z);
  const izv = pratiIzvestie(env, dep, z, pismo).catch(() => {});
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(izv); else await izv;

  return vjson({ ok: true, id, vreme: sofiaVreme(segaIso), pismo: pismo.ok });
}

async function pratiPotvarzhdenie(env, dep, z) {
  let pismo;
  try {
    pismo = await dep.brevo(env, {
      sender: { name: env.MAIL_SENDER_NAME || "Песента", email: env.MAIL_SENDER },
      replyTo: { email: env.MAIL_SENDER },
      to: [{ email: z.email, name: z.ime }],
      subject: "Потвърждение: получихме отказа ви от договора · " + z.id,
      htmlContent: potvarzhdenieHtml(z, z.id, z.created_at, z.deystvie)
    });
  } catch (e) { pismo = { ok: false, error: String(e && e.message || e) }; }
  await env.DB.prepare(
    "UPDATE otkazi SET pismo_at = ?, pismo_greshka = ?, pismo_opiti = pismo_opiti + 1 WHERE id = ?"
  ).bind(pismo.ok ? new Date().toISOString() : null, pismo.ok ? null : String(pismo.error || "").slice(0, 300), z.id).run().catch(() => {});
  return pismo;
}

async function pratiIzvestie(env, dep, z, pismo) {
  const r = await dep.pratiVatreshno(env, (z.deystvie === "otmenen" ? "Отказ от ваучер — ВЪРНИ ПАРИТЕ · " : "Отказ от договора — ПРЕГЛЕДАЙ · ") + z.id,
    izvestieHtml(z, pismo));
  if (r && r.ok) await env.DB.prepare("UPDATE otkazi SET izvestie_at = ? WHERE id = ?").bind(new Date().toISOString(), z.id).run();
  return r;
}

/* Cron (всеки час): допраща потвърждението (до 4 опита) и известието до нас,
   ако не са тръгнали. След последния неуспешен опит за потвърждение — отделно
   известие „прати на ръка ДНЕС“ (срокът по чл. 52а е краят на работния ден). */
export async function otkazCron(env, dep) {
  const redove = (await env.DB.prepare(
    `SELECT * FROM otkazi WHERE created_at > ? AND ((pismo_at IS NULL AND pismo_opiti < ?) OR izvestie_at IS NULL)
     ORDER BY created_at LIMIT 20`
  ).bind(new Date(Date.now() - 7 * 86400e3).toISOString(), OPITI_PISMO).all()).results || [];
  for (const z of redove) {
    let pismo = { ok: !!z.pismo_at, error: z.pismo_greshka };
    if (!z.pismo_at && z.pismo_opiti < OPITI_PISMO) {
      if (z.vaucher_ref) {
        const v = await env.DB.prepare("SELECT kod, platen_at FROM vaucheri WHERE ref = ?").bind(z.vaucher_ref).first();
        if (v) { z.kod = v.kod; z.platen_at = v.platen_at; }
      }
      pismo = await pratiPotvarzhdenie(env, dep, z);
      if (!pismo.ok && z.pismo_opiti + 1 >= OPITI_PISMO) {
        await dep.pratiVatreshno(env, "[ОТКАЗ] Потвърждението не тръгна след " + OPITI_PISMO + " опита · " + z.id,
          "<p>Потвърждението до <strong>" + esc(z.email) + "</strong> за заявление <strong>" + esc(z.id) +
          "</strong> не тръгна: " + esc(String(pismo.error || "")) + ". Прати го на ръка ДНЕС (дата и час на подаване: " +
          esc(sofiaVreme(z.created_at)) + ").</p>").catch(() => {});
      }
    }
    if (!z.izvestie_at) await pratiIzvestie(env, dep, z, pismo).catch(() => {});
  }
  return { pregledani: redove.length };
}

const SLED = {
  otmenen: "Ваучерът е спрян и кодът вече не важи. Ще върнем цялата сума по същия начин на плащане до 14 дни.",
  izpolzvan: "Кодът по този номер вече е използван за поръчка на песен. Ще прегледаме заявлението и ще ви пишем.",
  pesen: "Номерът е на поръчка на песен. Ще прегледаме заявлението и ще ви пишем.",
  default: "Ще прегледаме заявлението и ще ви пишем."
};

/* Трайният носител: самото писмо носи съдържанието, датата и часа. */
export function potvarzhdenieHtml(d, id, iso, deystvie) {
  const F = "font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;";
  const red = (k, s) => '<tr><td style="padding:4px 14px 4px 0;color:#555;' + F + 'font-size:14px;">' + k +
    '</td><td style="padding:4px 0;' + F + 'font-size:14px;"><strong>' + esc(s) + "</strong></td></tr>";
  return '<!DOCTYPE html><html lang="bg"><head><meta charset="UTF-8"><title>Потвърждение за отказ</title></head>' +
    '<body style="margin:0;padding:24px;background:#ffffff;color:#1a1a1a;">' +
    '<p style="' + F + 'font-size:16px;margin:0 0 14px;">Здравейте, ' + esc(d.ime) + ",</p>" +
    '<p style="' + F + 'font-size:15px;line-height:1.6;margin:0 0 14px;">Потвърждаваме, че получихме заявлението ви за отказ от договора, подадено през pesenta.bg.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">' +
      red("Номер на заявлението", id) + red("Подадено на", sofiaVreme(iso) + " ч. (българско време)") +
      red("Име", d.ime) + red("Номер на поръчка / код", d.nomer) + red("Имейл за отговор", d.email) +
    "</table>" +
    '<p style="' + F + 'font-size:15px;line-height:1.6;margin:0 0 14px;"><strong>Съдържание на заявлението:</strong> „С настоящото се отказвам от договора по поръчка / код ' +
      esc(d.nomer) + ".“</p>" +
    '<p style="' + F + 'font-size:15px;line-height:1.6;margin:0 0 14px;">' + esc(SLED[deystvie] || SLED.default) + "</p>" +
    '<p style="' + F + 'font-size:13px;line-height:1.6;color:#555;margin:18px 0 0;">„БАУФИЗИК“ ЕООД, ЕИК 207427793 · pesenta.bg · sales@pesenta.bg<br>Запазете това писмо — то е потвърждението на отказа ви.</p>' +
    "</body></html>";
}

const OBYASNENIE = {
  otmenen: "Ваучерът е СПРЯН автоматично (активен, в срока, имейлът съвпада). Върни парите в Stripe до 14 дни.",
  izpolzvan: "Ваучерът вече е ОСРЕБРЕН — отказ по т. 10 не важи. Отговори на клиента.",
  veche_otmenen: "Ваучерът вече е отменен. Провери дали парите са върнати.",
  sled_sroka: "Ваучерът е платен преди повече от 14 дни (с ден запас) — НЕ е спрян. Провери срока на ръка (заявление, подадено в срок, важи).",
  drug_imeyl: "Имейлът НЕ съвпада с този от покупката — НЕ е спрян. Провери кой е купувачът.",
  pesen: "Номерът е на поръчка на песен (без право на отказ по чл. 57). Отговори на клиента.",
  nenameren: "Номерът/кодът не е намерен. Отговори на клиента.",
  greshka: "Грешка при проверката — заявлението е записано, ваучерът НЕ е пипан. Провери на ръка.",
  priet: "Заявлението е записано, проверката не е довършена. Провери на ръка."
};

function izvestieHtml(z, pismo) {
  const red = (k, s) => s ? '<tr><td style="padding:4px 14px 4px 0;color:#666">' + k + '</td><td style="padding:4px 0"><strong>' + esc(s) + "</strong></td></tr>" : "";
  return '<h2 style="font:600 18px sans-serif;margin:0 0 12px">Отказ от договора · ' + esc(z.id) + "</h2>" +
    '<p style="background:' + (z.deystvie === "otmenen" ? "#FDECEA;border-left:4px solid #C0392B" : "#EAF2FB;border-left:4px solid #2E6DA4") +
    ';padding:10px 14px;font:14px sans-serif">' + esc(OBYASNENIE[z.deystvie] || z.deystvie) + "</p>" +
    '<table style="font:14px sans-serif;border-collapse:collapse">' +
      red("Подадено", sofiaVreme(z.created_at)) + red("Име", z.ime) + red("Номер / код", z.nomer) + red("Имейл", z.email) +
      red("Ваучер", z.vaucher_ref && ((z.kod || "") + " (" + z.vaucher_ref + ")")) + red("Статус преди", z.v_status) + red("Платен", z.platen_at) +
      red("Потвърждение до клиента", pismo.ok ? "пратено" : "НЕ ТРЪГНА: " + (pismo.error || "") + " — cron-ът опитва пак на всеки час") +
    "</table>";
}
