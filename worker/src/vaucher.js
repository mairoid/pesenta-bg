/* Ваучер за песен (15.10.2026) — кодът, проверките и HTML-ът на ваучера
   ─────────────────────────────────────────────────────────────────────
   Тук е всичко, което не зависи от бележката и от Stripe: генериране на
   код, нормализация, валидиране на формата, ограничение на опитите,
   записът „чака“ и блокът на ваучера в писмото. Webhook-ът, осребряването
   (то пише и бриф) и PDF маршрутът са в index.js, защото ползват неговите
   подписи и известия. Нищо оттук не внася index.js — без кръгови импорти.

   Пътища (виж index.js):
     POST /vaucher/nov          — детайлите от формата, ПРЕДИ плащането (статус chaka)
     GET  /vaucher/proverka     — валиден ли е кодът (ограничено по IP-хеш)
     POST /vaucher/izpolzvai    — осребряване + бриф, атомарно (index.js)
     GET  /vaucher/pdf/<ref>?t= — PDF-ът, подписан адрес (index.js)
   ───────────────────────────────────────────────────────────────────── */

export const REF_RE = /^VCH-\d{6}-\d{4}$/;
export const DUMI = ["SERENADA", "PESEN", "KUPLET", "MELODIA", "NAZDRAVE", "HIMN", "PRIPEV"];
/* Без 0/O, 1/I/L — по телефона и на ръка се бъркат. 31 знака → 31^5 ≈ 28,6 млн. на дума. */
export const AZBUKA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const OPITI_NA_CHAS = 20;

/* ============ Транслитерация (Закон за транслитерацията, чл. 4) ============ */
const TR = {
  "А": "A", "Б": "B", "В": "V", "Г": "G", "Д": "D", "Е": "E", "Ж": "ZH", "З": "Z", "И": "I",
  "Й": "Y", "К": "K", "Л": "L", "М": "M", "Н": "N", "О": "O", "П": "P", "Р": "R", "С": "S",
  "Т": "T", "У": "U", "Ф": "F", "Х": "H", "Ц": "TS", "Ч": "CH", "Ш": "SH", "Щ": "SHT",
  "Ъ": "A", "Ь": "Y", "Ю": "YU", "Я": "YA"
};

/* Една дума → главни латински букви. „-ия“ в края на думата е „IA“ (София → SOFIA,
   Мария → MARIA), както казва законът. Латиница минава, диакритиката се маха,
   всичко друго (цифри, знаци, емоджи) изпада. */
export function translit(duma) {
  let s = String(duma || "").toUpperCase();
  s = s.replace(/ИЯ$/, "IA");
  let out = "";
  for (const ch of s) {
    if (TR[ch] !== undefined) out += TR[ch];
    else out += ch;
  }
  return out.normalize("NFD").replace(/[^A-Z]/g, "");
}

/* Първото име: първата дума с поне две букви след транслитерацията. */
function parvoIme(tekst) {
  const dumi = String(tekst || "").split(/[\s,.;:!?()"'„“”«»\/\\\-–—_+&]+/);
  for (const d of dumi) {
    const t = translit(d);
    if (t.length >= 2) return t.slice(0, 10);
  }
  return "";
}

/* ИМЕ: на получателя, иначе на подаряващия, иначе PODARAK. */
export function imeZaKod(zaKogo, otKogo) {
  return parvoIme(zaKogo) || parvoIme(otKogo) || "PODARAK";
}

/* Случайно число 0..n-1 без изместване по модул (отхвърля байтовете над прага). */
function sluchaino(n, rnd) {
  const prag = 256 - (256 % n);
  const b = new Uint8Array(1);
  for (;;) {
    (rnd || crypto.getRandomValues.bind(crypto))(b);
    if (b[0] < prag) return b[0] % n;
  }
}

export function noviSufiks(rnd) {
  let s = "";
  for (let i = 0; i < 5; i++) s += AZBUKA[sluchaino(AZBUKA.length, rnd)];
  return s;
}

/* rnd — по избор, за пробата (подменен генератор → умишлен сблъсък). */
export function generirajKod(zaKogo, otKogo, rnd) {
  return imeZaKod(zaKogo, otKogo) + "-" + DUMI[sluchaino(DUMI.length, rnd)] + "-" + noviSufiks(rnd);
}

/* Сравнение без значение за малки/главни, интервали и тирета. Кирилица изпада
   (кодът е само латиница) — такъв вход просто не се намира, не гърми. */
export function normKod(s) {
  return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 40);
}

/* ============ Помощни ============ */
export function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function vjson(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

/* Управляващи знаци вън, поредици от интервали — един. Имената са на един ред. */
const chistRed = (v) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
/* Посланието пази новите редове (то е куплет), но без празни купчини. */
const chistTekst = (v) => String(v == null ? "" : v).replace(/\r\n?/g, "\n")
  .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ")
  .replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* Проверка на тялото от формата. Дълго — отказ, не рязане: рязаното
   послание би излязло на ваучера наполовина, без купувачът да разбере. */
export function proveriNov(telo) {
  if (!telo || typeof telo !== "object") return { ok: false, prichina: "nevaliden" };
  const ref = String(telo.ref || "");
  if (!REF_RE.test(ref)) return { ok: false, prichina: "ref" };
  const ot = chistRed(telo.ot_kogo), za = chistRed(telo.za_kogo), pos = chistTekst(telo.poslanie);
  const email = chistRed(telo.email).toLowerCase();
  if (!ot || ot.length > 60) return { ok: false, prichina: "ot_kogo" };
  if (!za || za.length > 60) return { ok: false, prichina: "za_kogo" };
  if (pos.length > 300 || pos.split("\n").length > 8) return { ok: false, prichina: "poslanie" };
  if (email.length > 120 || !EMAIL_RE.test(email)) return { ok: false, prichina: "email" };
  let faktura = null;
  if (telo.faktura) {
    const f = telo.faktura;
    const ime = chistRed(f.ime || f.name), adres = chistRed(f.adres || f.addr), eik = chistRed(f.eik).replace(/\s/g, "");
    if (!ime || ime.length > 120 || !adres || adres.length > 200) return { ok: false, prichina: "faktura" };
    if (eik && !/^[A-Za-z0-9]{6,20}$/.test(eik)) return { ok: false, prichina: "faktura" };
    faktura = JSON.stringify(eik ? { ime, adres, eik } : { ime, adres });
  }
  return { ok: true, d: { ref, ot_kogo: ot, za_kogo: za, poslanie: pos, email, faktura } };
}

async function chetiTelo(request, max) {
  const raw = await request.text();
  if (raw.length > max) return { greshka: vjson({ ok: false, prichina: "golyamo" }, 413) };
  try { return { telo: JSON.parse(raw) }; } catch (e) { return { greshka: vjson({ ok: false, prichina: "nevaliden" }, 400) }; }
}
export { chetiTelo };

/* ============ Ограничение на опитите ============ */
/* IP-то не се пази: SHA-256 от него + сол (AUDIT_TOKEN), по часове. Връща true,
   ако заявката е в лимита. Броят се и проверките, и осребряванията. */
export async function ipHash(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "nyama";
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "|" + (env.AUDIT_TOKEN || "")));
  return [...new Uint8Array(d)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function vLimita(request, env, sega) {
  const chas = (sega || new Date()).toISOString().slice(0, 13);
  const h = await ipHash(request, env);
  const r = await env.DB.prepare(
    `INSERT INTO vaucher_opiti (ip_hash, chas, broi) VALUES (?,?,1)
     ON CONFLICT(ip_hash, chas) DO UPDATE SET broi = broi + 1 RETURNING broi`
  ).bind(h, chas).first();
  return !r || r.broi <= OPITI_NA_CHAS;
}

/* ============ POST /vaucher/nov ============ */
/* Детайлите идват ПРЕДИ плащането (sendBeacon). Повторно със същия ref
   обновява, докато е „chaka“; платен ваучер не се пренаписва. */
export async function handleVaucherNov(request, env) {
  const { telo, greshka } = await chetiTelo(request, 4000);
  if (greshka) return greshka;
  const p = proveriNov(telo);
  if (!p.ok) return vjson({ ok: false, prichina: p.prichina }, 400);
  const d = p.d;
  await env.DB.prepare(
    `INSERT INTO vaucheri (ref, status, ot_kogo, za_kogo, poslanie, email, faktura, created_at)
     VALUES (?, 'chaka', ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ref) DO UPDATE SET ot_kogo = excluded.ot_kogo, za_kogo = excluded.za_kogo,
       poslanie = excluded.poslanie, email = excluded.email, faktura = excluded.faktura,
       created_at = excluded.created_at
     WHERE vaucheri.status = 'chaka'`
  ).bind(d.ref, d.ot_kogo, d.za_kogo, d.poslanie, d.email, d.faktura, new Date().toISOString()).run();
  return vjson({ ok: true });
}

/* ============ GET /vaucher/proverka?kod= ============ */
/* Имената се казват само за активен код — за използван/отменен само причината. */
export async function handleVaucherProverka(request, env) {
  if (!(await vLimita(request, env))) return vjson({ ok: false, prichina: "mnogo_opiti" }, 429);
  const kn = normKod(new URL(request.url).searchParams.get("kod"));
  if (kn.length < 8) return vjson({ ok: false, prichina: "nyama" });
  const v = await env.DB.prepare("SELECT status, za_kogo, ot_kogo FROM vaucheri WHERE kod_norm = ?").bind(kn).first();
  if (!v || v.status === "chaka") return vjson({ ok: false, prichina: "nyama" });
  if (v.status === "aktiven") return vjson({ ok: true, za_kogo: v.za_kogo || "", ot_kogo: v.ot_kogo || "" });
  return vjson({ ok: false, prichina: v.status === "izpolzvan" ? "izpolzvan" : "otmenen" });
}

/* ============ Нов ref, когато формата не е дала (връзка без client_reference_id
   или второ плащане за вече платен ref) ============ */
export function noviRef(sega) {
  const d = (sega || new Date()).toISOString();
  const b = new Uint8Array(2);
  crypto.getRandomValues(b);
  const n = String(((b[0] << 8) | b[1]) % 10000).padStart(4, "0");
  return "VCH-" + d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10) + "-" + n;
}

/* ============ Блокът на ваучера в писмото ============ */
/* Таблици и инлайн стилове (Gmail, Outlook), явен фон на всяка клетка (тъмни
   режими). БЕЗ цена — тя е само в бележката. Картината е статична; имената,
   посланието и кодът са текст, за да се четат и при спрени картинки. */
export function vaucherLink(kod) {
  return "https://pesenta.bg/?kod=" + encodeURIComponent(kod) + "#order";
}

export function vaucherBlokHtml(v) {
  const F = "font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;";
  const link = vaucherLink(v.kod);
  const posl = v.poslanie ? esc(v.poslanie).replace(/\n/g, "<br>") : "";
  return (
    '<tr><td bgcolor="#12101F" style="background-color:#12101F;padding:0;">' +
      '<img src="https://pesenta.bg/assets/img/vaucher-mail.jpg" width="600" alt="Ваучер за песен по поръчка" ' +
      'style="display:block;width:100%;max-width:600px;height:auto;border:0;' + F + 'font-size:18px;color:#F4F2FF;">' +
    "</td></tr>" +
    '<tr><td bgcolor="#12101F" align="center" style="background-color:#12101F;padding:28px 32px 6px 32px;">' +
      '<p style="margin:0 0 4px 0;' + F + 'font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#A9A4C9;">Подарък: песен по поръчка</p>' +
      (v.za_kogo ? '<p style="margin:0 0 6px 0;' + F + 'font-size:24px;line-height:1.3;font-weight:bold;color:#F4F2FF;">За ' + esc(v.za_kogo) + "</p>" : "") +
      (v.ot_kogo ? '<p style="margin:0 0 18px 0;' + F + 'font-size:15px;color:#D9D5EE;">От ' + esc(v.ot_kogo) + "</p>" : "") +
      (posl ? '<p style="margin:0 0 22px 0;font-family:Georgia,\'Times New Roman\',serif;font-size:17px;line-height:1.6;font-style:italic;color:#F4F2FF;">' + posl + "</p>" : "") +
      '<p style="margin:0 0 6px 0;' + F + 'font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#A9A4C9;">Кодът</p>' +
      '<p style="margin:0 0 22px 0;font-family:Consolas,\'Courier New\',monospace;font-size:26px;line-height:1.2;font-weight:bold;letter-spacing:0.06em;color:#FFA14D;">' + esc(v.kod) + "</p>" +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>' +
        '<td bgcolor="#FF4D8D" style="background-color:#FF4D8D;border-radius:999px;">' +
          '<a href="' + esc(link) + '" style="display:inline-block;padding:13px 26px;' + F + 'font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Осребри подаръка</a>' +
        "</td></tr></table>" +
      '<p style="margin:10px 0 0 0;' + F + 'font-size:12px;color:#A9A4C9;">Не се отваря? <a href="' + esc(link) + '" style="color:#A9A4C9;">' + esc(link) + "</a></p>" +
    "</td></tr>" +
    '<tr><td bgcolor="#12101F" style="background-color:#12101F;padding:22px 32px 8px 32px;">' +
      '<p style="margin:0 0 8px 0;' + F + 'font-size:14px;font-weight:bold;color:#F4F2FF;">Как се ползва</p>' +
      '<p style="margin:0;' + F + 'font-size:14px;line-height:1.62;color:#D9D5EE;">' +
        "1. Подари ваучера — препрати писмото или дай прикачения PDF.<br>" +
        "2. Който го получи, натиска „Осребри подаръка“ (кодът е вече попълнен) и разказва историята си.<br>" +
        "3. Важи за една песен, веднъж. Без срок.</p>" +
    "</td></tr>"
  );
}
