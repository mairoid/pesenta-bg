/* Песента — НАП Worker
   ─────────────────────────────────────────────────────────────────────
   Задача: при постъпило картово плащане да се регистрира продажбата
   (чл. 52о) и да има от какво да се произведе месечният одиторски файл
   (Приложение №38). Сайтът остава статичен на GitHub Pages; тук идва
   само това, което не може да живее в браузъра.

   Пътища:
     POST /stripe-webhook      — Stripe известява за плащане/възстановяване
     GET  /audit/YYYY-MM       — одиторски XML за месеца (иска AUDIT_TOKEN)
     GET  /health              — жив ли е Worker-ът

   Тайните се задават с `wrangler secret put`, никога в кода — виж README.md.
   ───────────────────────────────────────────────────────────────────── */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, shop: env.E_SHOP_N });
    }

    if (url.pathname === "/stripe-webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    const auditMatch = url.pathname.match(/^\/audit\/(\d{4})-(\d{2})$/);
    if (auditMatch && request.method === "GET") {
      return handleAudit(request, env, auditMatch[1], auditMatch[2]);
    }

    const belMatch = url.pathname.match(/^\/beleshka\/([A-Za-z0-9\-]{1,64})$/);
    if (belMatch && request.method === "GET") {
      return handleBeleshka(request, env, belMatch[1]);
    }

    return new Response("Not found", { status: 404 });
  }
};

/* ============ Stripe webhook ============ */

async function handleWebhook(request, env) {
  const raw = await request.text();
  const sig = request.headers.get("Stripe-Signature");

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: "STRIPE_WEBHOOK_SECRET не е зададен" }, 500);
  }
  if (!sig || !(await verifyStripe(raw, sig, env.STRIPE_WEBHOOK_SECRET))) {
    /* Без валиден подпис заявката не е от Stripe. Не се логва тяло — може
       да е опит за подхвърляне на измислена продажба. */
    return json({ error: "невалиден подпис" }, 400);
  }

  let event;
  try { event = JSON.parse(raw); } catch (e) { return json({ error: "невалиден JSON" }, 400); }

  try {
    if (event.type === "checkout.session.completed") {
      await recordSale(env, event);
    } else if (event.type === "charge.refunded") {
      await recordRefund(env, event);
    }
    /* Останалите събития се потвърждават без действие — Stripe спира да ги
       праща само при 2xx, иначе ретрайва часове наред. */
    return json({ received: true });
  } catch (err) {
    /* 500 кара Stripe да опита пак — точно каквото искаме при временен
       проблем с базата. Идемпотентността пази от двоен запис. */
    return json({ error: String(err && err.message || err) }, 500);
  }
}

async function recordSale(env, event) {
  const s = event.data.object;

  /* Плащането трябва да е реално минало. Checkout сесия може да завърши
     и без плащане (напр. отложен метод) — тогава няма какво да се
     регистрира по чл. 52о. */
  if (s.payment_status !== "paid") return;

  const key = "cs:" + s.id;
  const exists = await env.DB.prepare("SELECT 1 FROM sales WHERE stripe_event_key = ?")
    .bind(key).first();
  if (exists) return;                       /* повторен webhook — вече е записан */

  const rate = Number(env.BGN_RATE);
  const subtotalSt = eurToSt(s.amount_subtotal, rate);
  const totalSt = eurToSt(s.amount_total, rate);
  const discountSt = Math.max(0, subtotalSt - totalSt);

  const today = isoDate(new Date());
  const orderNo = s.client_reference_id || ("STRIPE-" + s.id.slice(-12));

  /* Експресната поръчка е вторият Payment Link (29,80 € вместо 19,90 €).
     Различаваме я по сумата, защото line items не идват в webhook-а без
     отделна заявка към Stripe API — а тя би изисквала таен ключ тук. */
  const isExpress = s.amount_subtotal >= 2500;
  const artName = env.ART_NAME + (isExpress ? " + експресна изработка (24 ч)" : "");

  const docN = await nextDocNumber(env);

  await env.DB.prepare(
    `INSERT INTO sales (doc_n, doc_date, order_no, order_date, customer_email,
       customer_name, art_name, art_quant, art_price_st, vat_rate, vat_st,
       discount_st, total_st, total_eur_c, paym, trans_n, proc_id,
       stripe_event_key, created_at)
     VALUES (?,?,?,?,?,?,?,1,?,0,0,?,?,?,4,?,?,?,?)`
  ).bind(
    docN, today, orderNo, today,
    (s.customer_details && s.customer_details.email) || null,
    (s.customer_details && s.customer_details.name) || null,
    artName, subtotalSt, discountSt, totalSt, s.amount_total || null,
    s.payment_intent || null, env.PROC_ID, key, new Date().toISOString()
  ).run();
}

async function recordRefund(env, event) {
  const ch = event.data.object;
  const key = "ch:" + ch.id + ":" + ch.amount_refunded;
  const exists = await env.DB.prepare("SELECT 1 FROM refunds WHERE stripe_event_key = ?")
    .bind(key).first();
  if (exists) return;

  /* Връзваме възстановяването с продажбата по payment_intent — това е
     единственото, което идва и в двете събития. */
  const sale = await env.DB.prepare("SELECT order_no FROM sales WHERE trans_n = ?")
    .bind(ch.payment_intent).first();

  await env.DB.prepare(
    `INSERT INTO refunds (order_no, amount_st, refund_date, r_paym, stripe_event_key, created_at)
     VALUES (?,?,?,2,?,?)`
  ).bind(
    sale ? sale.order_no : ("STRIPE-" + String(ch.payment_intent || ch.id).slice(-12)),
    eurToSt(ch.amount_refunded, Number(env.BGN_RATE)),
    isoDate(new Date()), key, new Date().toISOString()
  ).run();
}

/* Атомарно взимане на следващ номер. UPDATE … RETURNING е едно изявление,
   тоест две едновременни плащания не могат да получат един и същи номер —
   за разлика от MAX(doc_n)+1. */
async function nextDocNumber(env) {
  const row = await env.DB.prepare(
    "UPDATE counters SET value = value + 1 WHERE name = 'doc_n' RETURNING value"
  ).first();
  if (!row) throw new Error("броячът doc_n липсва — пусни schema.sql");
  return row.value;
}

/* ============ Одиторски файл (Приложение №38) ============ */

async function handleAudit(request, env, year, month) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!env.AUDIT_TOKEN || !timingSafeEqual(token, env.AUDIT_TOKEN)) {
    return new Response("Забранено", { status: 403 });
  }

  const prefix = year + "-" + month + "%";
  const sales = (await env.DB.prepare(
    "SELECT * FROM sales WHERE doc_date LIKE ? ORDER BY doc_n"
  ).bind(prefix).all()).results || [];
  const refunds = (await env.DB.prepare(
    "SELECT * FROM refunds WHERE refund_date LIKE ? ORDER BY id"
  ).bind(prefix).all()).results || [];

  /* Схемата на НАП изисква <order> с поне един <orderenum> — месец без
     продажби няма как да даде валиден файл. По-добре ясно съобщение,
     отколкото XML, който порталът ще отхвърли при подаването. */
  if (!sales.length) {
    return json({
      error: "няма продажби за " + year + "-" + month,
      note: "Схемата (Приложение №38) не допуска файл без нито една поръчка. " +
            "За месец без продажби провери със счетоводителя дали изобщо се подава файл."
    }, 409);
  }

  const xml = buildAuditXml(env, year, month, sales, refunds);

  return new Response(cp1251(xml), {
    headers: {
      "Content-Type": "application/xml; charset=windows-1251",
      "Content-Disposition":
        `attachment; filename="audit_pesenta_${year}-${month}.xml"`
    }
  });
}

export function buildAuditXml(env, year, month, sales, refunds) {
  const L = [];
  L.push('<?xml version="1.0" encoding="windows-1251"?>');
  L.push("<audit>");
  L.push(tag("eik", env.EIK));
  L.push(tag("e_shop_n", env.E_SHOP_N));
  L.push(tag("domain_name", env.DOMAIN_NAME));
  L.push(tag("e_shop_type", env.E_SHOP_TYPE));
  L.push(tag("creation_date", isoDate(new Date())));
  L.push(tag("mon", month));
  L.push(tag("god", year));

  L.push("<order>");
  for (const s of sales) {
    L.push("<orderenum>");
    L.push(tag("ord_n", s.order_no));
    L.push(tag("ord_d", s.order_date));
    /* Номерът се изписва с водещи нули (0000001012) — същият низ, който
       стои и на фактурата. Проверено: xs:integer в схемата на НАП приема
       водещите нули, файлът валидира с 0 грешки. */
    L.push(tag("doc_n", padDoc(s.doc_n)));
    L.push(tag("doc_date", s.doc_date));
    L.push("<art><artenum>");
    L.push(tag("art_name", s.art_name));
    L.push(tag("art_quant", String(s.art_quant)));
    L.push(tag("art_price", money(s.art_price_st)));
    L.push(tag("art_vat_rate", String(s.vat_rate)));
    L.push(tag("art_vat", money(s.vat_st)));
    L.push(tag("art_sum", money(s.art_price_st * s.art_quant)));
    L.push("</artenum></art>");
    L.push(tag("ord_total1", money(s.art_price_st * s.art_quant)));
    L.push(tag("ord_disc", money(s.discount_st)));
    L.push(tag("ord_vat", money(s.vat_st)));
    L.push(tag("ord_total2", money(s.total_st)));
    L.push(tag("paym", String(s.paym)));
    /* При банков превод (paym=1) няма ДПУ трансакция — в пробния файл на
       НАП двете полета просто липсват за такава поръчка. */
    if (s.paym === 4) {
      if (s.trans_n) L.push(tag("trans_n", s.trans_n));
      if (s.proc_id) L.push(tag("proc_id", s.proc_id));
    }
    L.push("</orderenum>");
  }
  L.push("</order>");

  L.push(tag("r_ord", String(refunds.length)));
  if (refunds.length) {
    L.push("<rorder>");
    for (const r of refunds) {
      L.push("<rorderenum>");
      L.push(tag("r_ord_n", r.order_no));
      L.push(tag("r_amount", money(r.amount_st)));
      L.push(tag("r_date", r.refund_date));
      L.push(tag("r_paym", String(r.r_paym)));
      L.push("</rorderenum>");
    }
    L.push("</rorder>");
  }
  L.push(tag("r_total", money(refunds.reduce((a, r) => a + r.amount_st, 0))));
  L.push("</audit>");
  return L.join("\n");
}

/* ============ Е-бележка (чл. 52о) ============ */

/* Адресът на бележката трябва да е неотгатваем — вътре има име, имейл и
   номер на трансакция. Токенът се извежда от номера на поръчката с
   AUDIT_TOKEN, вместо да се пази в базата: така няма какво да изтече и
   няма миграция на схемата. */
export async function beleshkaToken(orderNo, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode("beleshka:" + orderNo));
  return [...new Uint8Array(mac)].slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleBeleshka(request, env, orderNo) {
  if (!env.AUDIT_TOKEN) return new Response("AUDIT_TOKEN не е зададен", { status: 500 });

  const given = new URL(request.url).searchParams.get("t") || "";
  const want = await beleshkaToken(orderNo, env.AUDIT_TOKEN);
  if (!timingSafeEqual(given, want)) return new Response("Забранено", { status: 403 });

  const sale = await env.DB.prepare("SELECT * FROM sales WHERE order_no = ?")
    .bind(orderNo).first();
  if (!sale) return new Response("Няма такъв документ", { status: 404 });

  return new Response(renderBeleshka(env, sale), {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

const PAYM_LABEL = {
  1: "банков превод",
  4: "карта през доставчик на платежни услуги (Stripe)"
};

export function renderBeleshka(env, s) {
  const e = xmlEscape;
  /* Реално таксуваното от Stripe. Ако по някаква причина липсва (стар запис),
     се пада обратно към изчисление от левовата сума — с ясно обозначение,
     че е приблизително, вместо да се представя за точно. */
  const eurExact = s.total_eur_c != null;
  const eurStr = eurExact
    ? money(s.total_eur_c)
    : money(Math.round(s.total_st / Number(env.BGN_RATE)));
  const row = (k, v) =>
    `<tr><th>${e(k)}</th><td>${e(v)}</td></tr>`;

  return `<!doctype html>
<html lang="bg"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Електронна бележка № ${e(padDoc(s.doc_n))} — Pesenta.bg</title>
<style>
  body { font-family: system-ui, "Segoe UI", sans-serif; color: #16091c;
         background: #fff; margin: 0; padding: 2rem 1rem; line-height: 1.5; }
  .doc { max-width: 640px; margin: 0 auto; }
  h1 { font-size: 1.15rem; margin: 0 0 .25rem; }
  .sub { color: #666; font-size: .85rem; margin: 0 0 1.5rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
  th, td { text-align: left; padding: .45rem .5rem; border-bottom: 1px solid #e5e5e5;
           font-size: .9rem; vertical-align: top; }
  th { font-weight: 600; color: #555; width: 42%; }
  .items th { color: #555; }
  .items td.num, .items th.num { text-align: right; }
  .total { font-weight: 700; font-size: 1.05rem; }
  .foot { color: #666; font-size: .8rem; border-top: 1px solid #e5e5e5; padding-top: 1rem; }
  @media print { body { padding: 0; } .noprint { display: none; } }
</style></head><body><div class="doc">

<h1>Електронна бележка за продажба № ${e(padDoc(s.doc_n))}</h1>
<p class="sub">Документ по чл. 52о, ал. 1 от Наредба № Н-18 · издаден на ${e(s.doc_date)}</p>

<table>
  ${row("Продавач", env.SELLER_NAME)}
  ${row("ЕИК", env.EIK)}
  ${row("Адрес", env.SELLER_ADDRESS)}
  ${row("ДДС номер", env.SELLER_VAT)}
  ${row("Електронен магазин", env.DOMAIN_NAME)}
  ${row("Уникален номер на е-магазина", env.E_SHOP_N)}
</table>

<table>
  ${row("Номер на клиентската поръчка", s.order_no)}
  ${row("Дата на поръчката", s.order_date)}
  ${row("Начин на плащане", PAYM_LABEL[s.paym] || String(s.paym))}
  ${s.trans_n ? row("Референтен номер на трансакцията", s.trans_n) : ""}
  ${s.proc_id ? row("Идентификатор на ДПУ", s.proc_id) : ""}
</table>

<table class="items">
  <tr>
    <th>Услуга</th><th class="num">Дан. гр.</th><th class="num">Кол.</th>
    <th class="num">Ед. цена</th><th class="num">Сума</th>
  </tr>
  <tr>
    <td>${e(s.art_name)}</td>
    <td class="num">${e(env.TAX_GROUP)}</td>
    <td class="num">${e(String(s.art_quant))}</td>
    <td class="num">${e(money(s.art_price_st))} лв.</td>
    <td class="num">${e(money(s.art_price_st * s.art_quant))} лв.</td>
  </tr>
  ${s.discount_st ? `<tr><td colspan="4">Отстъпка</td>
    <td class="num">−${e(money(s.discount_st))} лв.</td></tr>` : ""}
  <tr><td colspan="4">ДДС (${e(String(s.vat_rate))}%)</td>
      <td class="num">${e(money(s.vat_st))} лв.</td></tr>
  <tr class="total"><td colspan="4">Общо</td>
      <td class="num">${e(money(s.total_st))} лв.</td></tr>
  <tr><td colspan="4">Платено в евро${eurExact ? "" : " (приблизително)"}</td>
      <td class="num">${e(eurStr)} €</td></tr>
</table>

<!-- QR по Приложение №18а — още НЕ е вграден. Изчаква потвърждение от
     счетоводителя дали е задължителен за е-магазин в алтернативен режим и
     какво точно съдържа. Библиотеката вече е в репото (assets/js/qrcode.js),
     добавянето е малко. Виж worker/README.md. -->

<p class="foot">
  Сумите са в лева по фиксирания курс 1 € = ${e(env.BGN_RATE)} лв.
  Документът е издаден по електронен път и е валиден без подпис и печат.
</p>
</div></body></html>`;
}

/* ============ Помощни ============ */

/* Еврото на Stripe идва в центове; одиторският файл иска левове. Умножава
   се по фиксирания курс и се закръгля ДО СТОТИНКА, преди каквото и да е
   събиране — иначе сумите в XML-а не се връзват аритметично. */
export function eurToSt(eurCents, rate) {
  return Math.round((eurCents || 0) * rate);
}

export function money(st) {
  const neg = st < 0;
  const v = Math.abs(Math.round(st));
  return (neg ? "-" : "") + Math.floor(v / 100) + "." + String(v % 100).padStart(2, "0");
}

export function padDoc(n) {
  return String(n).padStart(10, "0");
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function tag(name, value) {
  return "<" + name + ">" + xmlEscape(String(value == null ? "" : value)) + "</" + name + ">";
}

function xmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

/* windows-1251 — схемата на НАП и официалният примерен файл са в тази
   кодировка, а TextEncoder в Workers прави само UTF-8. Кирилицата ляга
   линейно (А=0xC0 … я=0xFF); типографските знаци имат нужда от таблица.
   Каквото не се побере, излиза като числова XML референция — валидно е
   и не губи данни, за разлика от заместване с „?". */
const CP1251_EXTRA = {
  0x201a: 0x82, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x2030: 0x89, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94,
  0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x00a0: 0xa0, 0x00ab: 0xab,
  0x00bb: 0xbb, 0x00b0: 0xb0, 0x2116: 0xb9, 0x00ad: 0xad
};

export function cp1251(str) {
  const bytes = [];
  for (const ch of str) {
    const c = ch.codePointAt(0);
    if (c < 0x80) bytes.push(c);
    else if (c >= 0x410 && c <= 0x44f) bytes.push(c - 0x410 + 0xc0);
    else if (CP1251_EXTRA[c] !== undefined) bytes.push(CP1251_EXTRA[c]);
    else for (const d of "&#" + c + ";") bytes.push(d.charCodeAt(0));
  }
  return new Uint8Array(bytes);
}

/* ============ Подпис на Stripe ============ */

export async function verifyStripe(raw, header, secret) {
  let t = null;
  const v1 = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") t = v;
    else if (k === "v1") v1.push(v);
  }
  if (!t || !v1.length) return false;

  /* Отхвърляме стари подписи: иначе прихванат валиден webhook може да се
     пусне повторно по всяко време. 5 минути е прозорецът, който Stripe
     препоръчва. */
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(t + "." + raw));
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  return v1.some((v) => timingSafeEqual(v, expected));
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
