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
     GET  /admin               — админ панел (иска AUDIT_TOKEN в заглавка)
     GET  /kartichka/<поръчка>?t=… — картичката „песента пътува“ за печат/телефон (подписан линк)
     GET  /p/<поръчка>?t=…      — чакалнята на песента; 302 към страницата ѝ, щом page_url е зададен
     POST /vaucher/nov, GET /vaucher/proverka, POST /vaucher/izpolzvai,
     GET  /vaucher/pdf/<ref>?t=… — ваучер за песен (vaucher.js; 15.10.2026)
     POST /snimki              — снимките за обложката → писмо с прикачени (snimki.js; 20.10.2026)

   Тайните се задават с `wrangler secret put`, никога в кода — виж README.md.
   ───────────────────────────────────────────────────────────────────── */

/* .cjs, а не .js: библиотеката е UMD/CommonJS, а package.json е с
   "type": "module". Без разширението Node и esbuild я четат като ESM и
   не намират default export. Съдържанието ѝ не е пипано. */
import qrcode from "./qrcode.cjs";
import { ADMIN_HTML } from "./admin.js";
import { renderKartichka, renderPesenChaka } from "./kartichka.js";
import {
  REF_RE as VCH_RE, generirajKod, normKod, vLimita, chetiTelo, vjson, esc,
  handleVaucherNov, handleVaucherProverka, noviRef, vaucherBlokHtml
} from "./vaucher.js";
import { handleSnimki } from "./snimki.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, shop: env.E_SHOP_N });
    }

    if (url.pathname === "/stripe-webhook" && request.method === "POST") {
      return handleWebhook(request, env, ctx);
    }

    /* Ваучер за песен (15.10.2026). Телата са text/plain JSON — без preflight, като /brief. */
    if (url.pathname === "/vaucher/nov" || url.pathname === "/vaucher/proverka" || url.pathname === "/vaucher/izpolzvai") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), env);
      if (url.pathname === "/vaucher/nov" && request.method === "POST") return cors(await handleVaucherNov(request, env), env);
      if (url.pathname === "/vaucher/proverka" && request.method === "GET") return cors(await handleVaucherProverka(request, env), env);
      if (url.pathname === "/vaucher/izpolzvai" && request.method === "POST") return cors(await handleVaucherIzpolzvai(request, env, ctx), env);
    }
    const vPdf = url.pathname.match(/^\/vaucher\/pdf\/(VCH-\d{6}-\d{4})$/);
    if (vPdf && request.method === "GET") return handleVaucherPdf(request, env, vPdf[1]);

    const auditMatch = url.pathname.match(/^\/audit\/(\d{4})-(\d{2})$/);
    if (auditMatch && request.method === "GET") {
      return handleAudit(request, env, auditMatch[1], auditMatch[2]);
    }

    const belMatch = url.pathname.match(/^\/beleshka\/([A-Za-z0-9\-]{1,64})$/);
    if (belMatch && request.method === "GET") {
      return handleBeleshka(request, env, belMatch[1]);
    }

    /* Картичката и чакалнята на песента (kartichka.js). Подписани като
       бележката — адресите носят името на получателя. */
    const karMatch = url.pathname.match(/^\/kartichka\/([A-Za-z0-9\-]{1,64})$/);
    if (karMatch && request.method === "GET") return handleKartichka(request, env, karMatch[1]);
    const pMatch = url.pathname.match(/^\/p\/([A-Za-z0-9\-]{1,64})$/);
    if (pMatch && request.method === "GET") return handlePesen(request, env, pMatch[1]);

    /* Страницата след плащане пита оттук къде е бележката на клиента.
       Отваря се от чужд домейн (pesenta.bg), затова носи CORS. */
    if (url.pathname === "/beleshka-link") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (request.method === "GET") return handleBeleshkaLink(request, env);
    }

    /* Разказът на клиента, пратен ПРЕДИ плащането. Идва от чужд домейн
       (pesenta.bg) през sendBeacon, затова носи CORS. */
    if (url.pathname === "/brief") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), env);
      if (request.method === "POST") return cors(await handleBrief(request, env), env);
    }

    /* Снимките за обложката (20.10.2026) — вместо FormSubmit, който без Referer
       (вграденият браузър на ChatGPT) мълчаливо ги губи. Виж snimki.js. */
    if (url.pathname === "/snimki") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), env);
      if (request.method === "POST") return cors(await handleSnimki(request, env), env);
    }

    /* Анонимни събития от сайта (14.10.2026): кое е натиснато, на коя страница.
       Plausible е махнат на 18.08 и кликовете не се броят никъде. Тук няма IP,
       браузър, бисквитки или номер на посетител — само име от списъка. */
    if (url.pathname === "/sabitie") {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), env);
      if (request.method === "POST") return cors(await handleSabitie(request, env), env);
    }

    /* Админ панелът. Страницата се дава без проверка — тя е празна и не
       съдържа данни. Проверката е върху /admin/data и /admin/status. */
    if (url.pathname === "/admin" && request.method === "GET") {
      return new Response(ADMIN_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "no-store"
        }
      });
    }
    if (url.pathname === "/admin/data" && request.method === "GET") {
      if (!adminOk(request, env)) return json({ error: "забранено" }, 403);
      return handleAdminData(request, env);
    }
    if (url.pathname === "/admin/status" && request.method === "POST") {
      if (!adminOk(request, env)) return json({ error: "забранено" }, 403);
      return handleAdminStatus(request, env);
    }

    return new Response("Not found", { status: 404 });
  },

  /* Веднъж на час (wrangler.toml → [triggers]): напомняне до неплатилите.
     waitUntil — за да не прекъсне пращането, ако часовникът реши, че е свършил. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(napomniNeplateni(env).catch(() => {}));
    ctx.waitUntil(vaucherCron(env).catch(() => {}));
  }
};

/* ============ Напомняне до неплатила поръчка (13.10.2026) ============
   4 от 7 души, попълнили историята, не платиха и в Stripe нямаше нито един
   отказ — затварят касата. Едно писмо 20–48 часа след брифа, с готова връзка
   за плащане. ВЕДНЪЖ на поръчка: всяко решение (пратено или защо не) се пише
   в napomnyania, за да не се гледа втори път. Пропуска: без имейл, наш адрес,
   платил с друга поръчка след брифа, мина ли датата на повода. */
const VATRESHNI = /@(russev\.net|pesenta\.bg|energieausweis-shop\.at)$/i;

export async function napomniNeplateni(env, sega) {
  sega = sega || new Date();
  if (!env.BREVO_API_KEY || !env.MAIL_SENDER || !env.PAYMENT_LINK) return { pregledani: 0, prateni: 0, prichina: "липсва настройка" };
  const ot = new Date(sega.getTime() - 48 * 3600e3).toISOString();
  const do_ = new Date(sega.getTime() - 20 * 3600e3).toISOString();
  /* Поръчка, осребрена с ваучер (15.10.2026), е платена — но не е в sales. Без таблицата
     vaucheri (базата преди миграцията) — старата заявка: тогава осребрени няма. */
  const sql = `SELECT b.order_no, b.created_at, b.vid, b.povod, b.poleta FROM briefs b
     WHERE b.created_at BETWEEN ? AND ?
       AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.order_no = b.order_no)
       AND NOT EXISTS (SELECT 1 FROM napomnyania n WHERE n.order_no = b.order_no)`;
  let redove;
  try {
    redove = (await env.DB.prepare(sql + `
       AND NOT EXISTS (SELECT 1 FROM vaucheri v WHERE v.izpolzvan_order = b.order_no)`
    ).bind(ot, do_).all()).results || [];
  } catch (e) {
    if (!/no such table/i.test(String(e && e.message || e))) throw e;
    redove = (await env.DB.prepare(sql).bind(ot, do_).all()).results || [];
  }

  let prateni = 0;
  for (const r of redove) {
    let p = {};
    try { p = JSON.parse(r.poleta || "{}") || {}; } catch (e) { p = {}; }
    const email = String(p.email || "").trim().toLowerCase();
    let prichina = "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) prichina = "без имейл";
    else if (VATRESHNI.test(email)) prichina = "вътрешен адрес";
    else if (await env.DB.prepare("SELECT 1 FROM sales WHERE lower(customer_email) = ? AND created_at >= ?")
      .bind(email, r.created_at).first()) prichina = "платил с друга поръчка";
    else if (/^\d{4}-\d{2}-\d{2}$/.test(String(p.event_date || "")) && p.event_date < sofiaParts(sega).date) prichina = "поводът мина";

    const rez = prichina ? { ok: false, error: prichina } : await pratiNapomnyane(env, r, p, email, sega);
    await env.DB.prepare("INSERT OR IGNORE INTO napomnyania (order_no, created_at, email, ok, error) VALUES (?,?,?,?,?)")
      .bind(r.order_no, sega.toISOString(), email || null, rez.ok ? 1 : 0, rez.ok ? null : String(rez.error).slice(0, 300)).run();
    if (rez.ok) prateni++;
  }
  return { pregledani: redove.length, prateni };
}

export function napomnyanePismo(env, r, p, email, sega) {
  const en = /\(EN\)/.test(String(r.vid || ""));
  const link = (en && env.PAYMENT_LINK_EN) || env.PAYMENT_LINK;
  const url = link + (link.indexOf("?") === -1 ? "?" : "&") +
    "client_reference_id=" + encodeURIComponent(r.order_no) +
    "&prefilled_email=" + encodeURIComponent(email) + "&locale=" + (en ? "auto" : "bg");
  const povod = String(r.povod || "");
  const imaPovod = povod && povod.charAt(0) !== "—";
  /* Датата на повода — само ако още не е минала; тогава казва, че има време. */
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(p.event_date || ""));
  const predi = d && p.event_date > sofiaParts(sega).date;
  const btn = (t) => '<p><a href="' + url + '" style="display:inline-block;padding:12px 22px;border-radius:999px;' +
    'background:#ff4d8d;color:#ffffff;text-decoration:none;font-weight:bold;">' + t + "</a></p>";
  if (en) {
    return {
      subject: "Your song is still waiting — " + r.order_no,
      html: "<p>Hi,</p>" +
        "<p>You told us a story for a song" + (imaPovod ? " (" + xmlEscape(povod) + ")" : "") + ". Order <strong>" + xmlEscape(r.order_no) +
        "</strong> hasn't been paid yet, so we haven't started.</p>" +
        "<p>If you'd still like it, you can pay here — €19.90, and the song is ready within 24 hours after payment:</p>" +
        btn("Pay and start my song") +
        (predi ? "<p>The occasion is on " + d[3] + "." + d[2] + "." + d[1] + " — pay today and it arrives in time.</p>" : "") +
        "<p>If something stopped you — the price, paying by card, a question — just reply to this email.</p>" +
        "<p>Pesenta · pesenta.bg</p>",
      url
    };
  }
  return {
    subject: "Песента ти още чака — " + r.order_no,
    html: "<p>Здравей,</p>" +
      "<p>Разказа ни история за песен" + (imaPovod ? " (повод: " + xmlEscape(povod) + ")" : "") + ". Поръчката <strong>" + xmlEscape(r.order_no) +
      "</strong> още не е платена, затова не сме започнали.</p>" +
      "<p>Ако все още я искаш, плащането е тук — 19,90 €, а песента е готова до 24 часа след него:</p>" +
      btn("Плащам и започвате") +
      (predi ? "<p>Поводът е на " + d[3] + "." + d[2] + "." + d[1] + " — платиш ли днес, песента е при теб навреме.</p>" : "") +
      "<p>Ако нещо те е спряло — цената, плащането с карта, въпрос — просто отговори на това писмо.</p>" +
      "<p>Песента · pesenta.bg</p>",
    url
  };
}

async function pratiNapomnyane(env, r, p, email, sega) {
  const m = napomnyanePismo(env, r, p, email, sega);
  const en = /\(EN\)/.test(String(r.vid || ""));
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        sender: { name: en ? "Pesenta" : (env.MAIL_SENDER_NAME || "Песента"), email: env.MAIL_SENDER },
        replyTo: { email: env.MAIL_SENDER },
        to: [{ email: email }],
        subject: m.subject,
        htmlContent: m.html
      })
    });
    if (!res.ok) return { ok: false, error: "Brevo HTTP " + res.status };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

/* ============ Stripe webhook ============ */

async function handleWebhook(request, env, ctx) {
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
    /* async_payment_succeeded (13.10.2026): SEPA дебит минава след дни — при
       completed сесията е „unpaid“ и recordSale я пропуска; без това събитие
       платената продажба оставаше без бележка и извън файла за НАП. recordSale
       е идемпотентен по сесията, двойно записване няма. */
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await recordSale(env, event, ctx);
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

async function recordSale(env, event, ctx) {
  const s = event.data.object;

  /* Плащането трябва да е реално минало. Checkout сесия може да завърши
     и без плащане (напр. отложен метод) — тогава няма какво да се
     регистрира по чл. 52о. */
  if (s.payment_status !== "paid") return;

  /* Ваучер за песен (15.10.2026): по номера VCH-… или по отделната Payment Link.
     VAUCHER_PLINK е празен, докато връзката не е създадена — тогава само по номера. */
  const crid = String(s.client_reference_id || "");
  const jeVaucher = /^VCH-/.test(crid) || (!!env.VAUCHER_PLINK && s.payment_link === env.VAUCHER_PLINK);

  const key = "cs:" + s.id;
  const exists = await env.DB.prepare("SELECT 1 FROM sales WHERE stripe_event_key = ?")
    .bind(key).first();
  if (exists) {                             /* повторен webhook — вече е записан */
    /* Продажбата е записана, но ваучерът — не (записана преди миграцията или
       преди VAUCHER_PLINK). Довършва се; при вече активен — нищо. */
    if (jeVaucher) {
      const v = await aktivirajVaucher(env, s, VCH_RE.test(crid) ? crid : await svobodenRef(env), null);
      if (v && v.nov) await zadachaVaucherPismo(env, ctx, v);
    }
    return;
  }

  /* Валутата НЕ се приема на доверие.
     ------------------------------------------------------------------
     Stripe може да покаже касата в местната валута на купувача (Adaptive
     Pricing). Тогава amount_total идва в ТАЗИ валута, не в евро. Кодът
     смята всичко в евроцентове, тоест плащане в долари би влязло в
     одиторския файл като евро — с грешна сума пред НАП.

     Затова записваме валутата както е дошла и я отбелязваме, ако не е
     евро. Продажбата пак се регистрира — плащането е факт и документ се
     дължи — но несъответствието остава видимо, вместо да се скрие в
     привидно нормален отчет. */
  const currency = String(s.currency || "").toLowerCase();
  const currencyOk = currency === "eur";

  const rate = Number(env.BGN_RATE);
  const subtotalSt = eurToSt(s.amount_subtotal, rate);
  const totalSt = eurToSt(s.amount_total, rate);
  const discountSt = Math.max(0, subtotalSt - totalSt);

  const now = sofiaParts(new Date());
  const today = now.date;
  /* Ваучер без номер от формата (връзката е отворена направо) — номерът се прави тук. */
  const vRef = jeVaucher ? (VCH_RE.test(crid) ? crid : await svobodenRef(env)) : null;
  const orderNo = s.client_reference_id || vRef || ("STRIPE-" + s.id.slice(-12));

  /* От 21.09.2026 сайтът не предлага експрес и не води към втория Payment Link; разпознаването
     остава заради стари писма с тази връзка, докато тя не бъде изключена в Stripe.
     Експресната поръчка е вторият Payment Link (29,80 € вместо 19,90 €).
     Различаваме я по сумата, защото line items не идват в webhook-а без
     отделна заявка към Stripe API — а тя би изисквала таен ключ тук. */
  const isExpress = !jeVaucher && s.amount_subtotal >= 2500;
  const artName = jeVaucher ? (env.VAUCHER_ART_NAME || "Ваучер за песен по поръчка")
    : env.ART_NAME + (isExpress ? " + експресна изработка (24 ч)" : "");

  const docN = await nextDocNumber(env);

  const insSale = env.DB.prepare(
    `INSERT INTO sales (doc_n, doc_date, doc_time, order_no, order_date,
       customer_email, customer_name, art_name, art_quant, art_price_st,
       vat_rate, vat_st, discount_st, total_st,
       subtotal_eur_c, discount_eur_c, total_eur_c,
       paym, trans_n, proc_id, stripe_event_key, currency, currency_warning, created_at)
     VALUES (?,?,?,?,?,?,?,?,1,?,0,0,?,?,?,?,?,4,?,?,?,?,?,?)`
  ).bind(
    docN, today, now.time, orderNo, today,
    (s.customer_details && s.customer_details.email) || null,
    (s.customer_details && s.customer_details.name) || null,
    artName, subtotalSt, discountSt, totalSt,
    s.amount_subtotal || null,
    Math.max(0, (s.amount_subtotal || 0) - (s.amount_total || 0)),
    s.amount_total || null,
    s.payment_intent || null, env.PROC_ID, key,
    currency || null,
    currencyOk ? null :
      "ВНИМАНИЕ: плащането е в " + (currency || "неизвестна валута").toUpperCase() +
      ", не в EUR. Сумите в одиторския файл са изчислени като евро и НЕ са верни " +
      "за тази поръчка. Изключи Adaptive Pricing в Stripe и провери ръчно.",
    new Date().toISOString()
  );

  /* Ваучерът се активира в СЪЩИЯ batch с продажбата: или и двете, или нищо.
     Писмото (бележка + ваучер) е едно и тръгва след записа, във waitUntil;
     известието до нас — след писмото, за да знае дали е стигнало. */
  if (jeVaucher) {
    const v = await aktivirajVaucher(env, s, vRef, insSale);
    await zadachaVaucherPismo(env, ctx, v);
    return;
  }
  await insSale.run();

  /* Връчването е след записа, не преди: документът трябва да съществува,
     преди да го обявим на клиента. */
  /* Езикът на писмото (13.10.2026): английски само за чужд клиент — поръчал е
     от en/ или картата му е издадена извън България. Брифът може да липсва
     (тогава решава само държавата); грешка тук не бива да спира бележката. */
  let vidBrif = "";
  try {
    const b = await env.DB.prepare("SELECT vid FROM briefs WHERE order_no = ?").bind(orderNo).first();
    vidBrif = (b && b.vid) || "";
  } catch (e) { /* без брифа — по държавата */ }
  const sale = {
    doc_n: docN, order_no: orderNo,
    customer_email: (s.customer_details && s.customer_details.email) || null,
    customer_name: (s.customer_details && s.customer_details.name) || null,
    ezik: ezikNaKlienta(vidBrif, s.customer_details && s.customer_details.address && s.customer_details.address.country)
  };
  const sent = await sendBeleshkaEmail(env, sale);
  await env.DB.prepare(
    "UPDATE sales SET email_sent_at = ?, email_error = ? WHERE stripe_event_key = ?"
  ).bind(sent.ok ? new Date().toISOString() : null, sent.ok ? null : sent.error, key).run();

  /* Вътрешното известие е ПОСЛЕДНО и не може да счупи нищо преди него:
     продажбата е записана, бележката е пратена, статусът е обновен. Ако
     Brevo откаже, тук се преглъща — иначе Stripe получава 500, ретрайва с
     часове и вдига шум за писмо, което е удобство, не задължение. */
  await notifyVatreshno(env, {
    doc_n: docN, order_no: orderNo,
    customer_name: sale.customer_name, customer_email: sale.customer_email,
    amount_c: s.amount_total, currency: currency, currency_ok: currencyOk,
    express: isExpress, payment_intent: s.payment_intent,
    beleshka: sent
  });
}

async function recordRefund(env, event) {
  const ch = event.data.object;
  const key = "ch:" + ch.id + ":" + ch.amount_refunded;
  const exists = await env.DB.prepare("SELECT 1 FROM refunds WHERE stripe_event_key = ?")
    .bind(key).first();
  if (exists) return;

  /* Връзваме възстановяването с продажбата по payment_intent — това е
     единственото, което идва и в двете събития. Взимаме и данните за
     писмото: имейлът на клиента идва от Stripe при плащането, тук го няма. */
  const sale = await env.DB.prepare(
    "SELECT order_no, doc_n, customer_email, customer_name, total_eur_c FROM sales WHERE trans_n = ?"
  ).bind(ch.payment_intent).first();

  const orderNo = sale ? sale.order_no
    : ("STRIPE-" + String(ch.payment_intent || ch.id).slice(-12));

  await env.DB.prepare(
    `INSERT INTO refunds (order_no, amount_st, amount_eur_c, refund_date, r_paym,
       stripe_event_key, created_at)
     VALUES (?,?,?,?,2,?,?)`
  ).bind(
    orderNo,
    eurToSt(ch.amount_refunded, Number(env.BGN_RATE)),
    ch.amount_refunded || null,
    isoDate(new Date()), key, new Date().toISOString()
  ).run();

  /* Уведомяваме клиента. Както при бележката, провалът на писмото НЕ вдига
     грешка нагоре — връщането вече е записано, а 500 би накарало Stripe да
     ретрайва и да го запише втори път. */
  const sent = await sendRefundEmail(env, sale, ch.amount_refunded || 0);
  await env.DB.prepare(
    "UPDATE refunds SET email_sent_at = ?, email_error = ? WHERE stripe_event_key = ?"
  ).bind(sent.ok ? new Date().toISOString() : null, sent.ok ? null : sent.error, key).run();

  /* Ваучер (15.10.2026): изцяло върнат и неизползван → otmenen. Грешка тук не
     вдига 500 — връщането е записано, а повторен webhook би излязъл рано. */
  if (sale) {
    try { await vaucherPriVrashtane(env, ch); } catch (e) { /* остава видимо в админа */ }
  }
}

/* Писмо при върнати пари.
   ------------------------------------------------------------------
   НЕ се представя за данъчен документ. Дали при връщане се дължи такъв по
   чл. 52о, не е потвърдено — затова писмото само уведомява, а полето за
   документ остава празно, докато счетоводителят не каже друго.

   Частичните връщания се разпознават по сумата: схемата на НАП изрично
   говори за „изцяло или частично върнати поръчки", тоест случаят е реален
   и текстът не бива да твърди, че всичко е върнато. */
export async function sendRefundEmail(env, sale, amountC) {
  if (!env.BREVO_API_KEY) return { ok: false, error: "BREVO_API_KEY не е зададен" };
  if (!sale) return { ok: false, error: "връщането не е свързано с продажба — няма кому да се пише" };
  if (!sale.customer_email) return { ok: false, error: "продажбата няма имейл на клиента" };

  const full = sale.total_eur_c != null && amountC >= sale.total_eur_c;
  const sum = money(amountC) + " €";
  const bgn = money(eurToSt(amountC, Number(env.BGN_RATE))) + " лв.";

  const body = {
    sender: { name: env.MAIL_SENDER_NAME || "Песента", email: env.MAIL_SENDER },
    to: [{ email: sale.customer_email, name: sale.customer_name || undefined }],
    subject: (full ? "Върнахме плащането" : "Върнахме част от плащането") +
             " по поръчка " + sale.order_no + " — Песента",
    htmlContent:
      "<p>Здравей" + (sale.customer_name ? " " + xmlEscape(sale.customer_name) : "") + ",</p>" +
      "<p>" + (full
        ? "Плащането по поръчка <strong>" + xmlEscape(sale.order_no) + "</strong> е върнато изцяло."
        : "Част от плащането по поръчка <strong>" + xmlEscape(sale.order_no) + "</strong> е върната.") +
      "</p>" +
      "<p>Върната сума: <strong>" + sum + "</strong> (" + bgn + ")<br>" +
      "Документ за продажбата: <strong>" + padDoc(sale.doc_n) + "</strong></p>" +
      "<p>Сумата се връща по същата карта, с която е платено. " +
      "Банката обикновено я отразява до няколко работни дни — при някои издатели отнема " +
      "малко повече, затова не се притеснявай, ако не се появи веднага.</p>" +
      (full ? "<p>Ако връщането е по недоразумение или искаме да опитаме пак — просто отговори на това писмо.</p>" : "") +
      "<p>Песента · pesenta.bg</p>"
  };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) return { ok: false, error: "Brevo HTTP " + res.status + " " + (await res.text()).slice(0, 200) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
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

/* ============ Връчване на бележката ============ */

/* Позволяваме само нашия домейн, не „*": отговорът съдържа адрес, който
   отваря документ с име, имейл и номер на трансакция. */
/* Приемане на брифа.
   ---------------------------------------------------------------------
   Дотук разказът живееше само в имейл през FormSubmit. Бързата текстова
   поръчка обаче праща клиента към касата дори когато изпращането се
   провали — тоест платена поръчка без история, за която никой не научава.
   Тук записът е наш и не зависи от трета страна.

   Ендпойнтът е публичен по необходимост: вика го браузърът на клиента.
   Затова има три ограничения — размер, формат на номера и презапис вместо
   натрупване. Стойността му за спамър е нулева, а щетата е ограничена.

   Тялото е text/plain, а не application/json: sendBeacon с JSON тип би
   поискал preflight, а sendBeacon не може да го направи. Затова четем
   текст и разбираме JSON-а сами. */
async function handleBrief(request, env) {
  let telo;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return json({ error: "твърде голямо" }, 413);
    telo = JSON.parse(raw);
  } catch (e) {
    return json({ error: "невалиден JSON" }, 400);
  }

  const orderNo = String((telo && telo.order_no) || "");
  if (!/^PSN-[0-9]{6}-[0-9]{4}$/.test(orderNo)) return json({ error: "невалиден номер" }, 400);

  /* ON CONFLICT, защото клиентът може да прати два пъти — при повторен
     опит или при два отворени раздела. По-новото печели. */
  await env.DB.prepare(
    `INSERT INTO briefs (order_no, created_at, vid, povod, stilove, ezik, razkaz, poleta)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(order_no) DO UPDATE SET ` + BRIEF_UPSERT
  ).bind(orderNo, new Date().toISOString(), ...briefPoleta(telo)).run();

  return json({ ok: true });
}

/* Общото между /brief и осребряването на ваучер: кои колони и колко дълги. */
const BRIEF_UPSERT = `created_at = excluded.created_at, vid = excluded.vid, povod = excluded.povod,
       stilove = excluded.stilove, ezik = excluded.ezik, razkaz = excluded.razkaz,
       poleta = excluded.poleta`;
function briefPoleta(telo) {
  const kus = function (v, n) {
    if (v === undefined || v === null) return null;
    return String(v).slice(0, n || 400);
  };
  return [kus(telo.vid), kus(telo.povod), kus(telo.stilove), kus(telo.ezik),
          kus(telo.razkaz, 8000), JSON.stringify(telo).slice(0, 20000)];
}

/* Имената са тези, които сайтът праща (main.js, text-order.js). Друго име не се
   записва — чужд, който праща боклук, не може да напълни базата с измислени. */
export const SABITIYA = [
  "Order CTA Click", "Order Form Open", "Order Submitted", "Demo Play", "Style Play",
  "Hero Sample Play", "Voice Start", "Voice Recorded", "Song Page CTA",
  /* ваучерът (15.10.2026): vaucher.js на сайта и осребряването в text-order.js */
  "Voucher Checkout", "Voucher Redeem"
];

export async function handleSabitie(request, env) {
  let telo;
  try {
    const raw = await request.text();
    if (raw.length > 1000) return json({ error: "твърде голямо" }, 413);
    telo = JSON.parse(raw);
  } catch (e) {
    return json({ error: "невалиден JSON" }, 400);
  }
  const ime = String((telo && telo.e) || "");
  if (SABITIYA.indexOf(ime) < 0) return json({ error: "непознато събитие" }, 400);
  /* Само пътят, без ?параметри и #котва — в тях може да има имейл или име. */
  const stranica = String(telo.p || "").split(/[?#]/)[0].replace(/[^\w\-./]/g, "").slice(0, 120);
  const detail = telo.d == null ? null : String(telo.d).replace(/[@\r\n]/g, " ").slice(0, 80);
  await env.DB.prepare(
    "INSERT INTO sabitiya (ts, ime, stranica, detail) VALUES (?,?,?,?)"
  ).bind(new Date().toISOString(), ime, stranica || null, detail).run();
  return json({ ok: true });
}

/* ============ Админ панел ============ */

/* Токенът пътува в заглавка, не в адреса: адресите влизат в историята на
   браузъра, в логове и в Referer. Сравнението е с timingSafeEqual, за да не
   се налучква буква по буква по времето за отговор. */
function adminOk(request, env) {
  const t = request.headers.get("X-Admin-Token") || "";
  return !!env.AUDIT_TOKEN && timingSafeEqual(t, env.AUDIT_TOKEN);
}

/* Продажбите идват с разказа СГЛОБЕН — свързването става тук, не в браузъра.
   Обемът е няколко десетки реда; когато станат хиляди, ще се сложи страниране. */
async function handleAdminData(request, env) {
  const sales = (await env.DB.prepare(
    "SELECT * FROM sales ORDER BY doc_n DESC"
  ).all()).results || [];
  const briefs = (await env.DB.prepare("SELECT * FROM briefs").all()).results || [];
  const refunds = (await env.DB.prepare(
    "SELECT * FROM refunds ORDER BY id DESC"
  ).all()).results || [];

  const po = {};
  briefs.forEach(function (b) { po[b.order_no] = b; });
  sales.forEach(function (s) { s.brief = po[s.order_no] || null; });

  /* Ваучерите (15.10.2026): продадените са и в sales; осребрената поръчка е САМО
     тук (не е продажба) — с брифа ѝ, за да се напише и отбележи доставката.
     Чакащите (неплатени) не се показват. Без таблицата — празно. */
  let vaucheri = [];
  try {
    vaucheri = (await env.DB.prepare(
      "SELECT * FROM vaucheri WHERE status != 'chaka' ORDER BY platen_at DESC"
    ).all()).results || [];
  } catch (e) { vaucheri = []; }
  vaucheri.forEach(function (v) { v.brief = v.izpolzvan_order ? (po[v.izpolzvan_order] || null) : null; });

  return json({ sales: sales, refunds: refunds, vaucheri: vaucheri, generated: new Date().toISOString() });
}

/* Единственото, което панелът ПИШЕ: отметка за доставена песен и бележка.
   Всичко останало е производно на плащането и не бива да се редактира на
   ръка — сумите и документите отиват пред НАП. */
async function handleAdminStatus(request, env) {
  let telo;
  try { telo = await request.json(); } catch (e) { return json({ error: "невалиден JSON" }, 400); }

  /* Осребрен ваучер: доставката и страницата се пишат във vaucheri, не в sales. */
  if (telo && telo.ref !== undefined) {
    const ref = String(telo.ref || "");
    if (!VCH_RE.test(ref)) return json({ error: "невалиден номер" }, 400);
    if (telo.delivered !== undefined) {
      await env.DB.prepare("UPDATE vaucheri SET delivered_at = ? WHERE ref = ? AND status = 'izpolzvan'")
        .bind(telo.delivered ? new Date().toISOString() : null, ref).run();
    }
    if (telo.page_url !== undefined) {
      const u = String(telo.page_url).trim();
      if (u && !/^https:\/\/pesenta\.bg\/[A-Za-z0-9\-._\/]+$/.test(u)) return json({ error: "невалиден адрес" }, 400);
      await env.DB.prepare("UPDATE vaucheri SET page_url = ? WHERE ref = ?").bind(u || null, ref).run();
    }
    return json({ ok: true });
  }

  const orderNo = String((telo && telo.order_no) || "");
  if (!/^PSN-[0-9]{6}-[0-9]{4}$/.test(orderNo)) return json({ error: "невалиден номер" }, 400);

  if (telo.delivered !== undefined) {
    await env.DB.prepare("UPDATE sales SET delivered_at = ? WHERE order_no = ?")
      .bind(telo.delivered ? new Date().toISOString() : null, orderNo).run();
  }
  if (telo.note !== undefined) {
    const b = String(telo.note).slice(0, 2000).trim();
    await env.DB.prepare("UPDATE sales SET note = ? WHERE order_no = ?")
      .bind(b || null, orderNo).run();
  }
  /* Адресът на страницата на песента — накъде води QR-ът на картичката.
     Само наш адрес; празно = чакалнята. */
  if (telo.page_url !== undefined) {
    const u = String(telo.page_url).trim();
    if (u && !/^https:\/\/pesenta\.bg\/[A-Za-z0-9\-._\/]+$/.test(u)) return json({ error: "невалиден адрес" }, 400);
    await env.DB.prepare("UPDATE sales SET page_url = ? WHERE order_no = ?")
      .bind(u || null, orderNo).run();
  }
  return json({ ok: true });
}

function cors(res, env) {
  res.headers.set("Access-Control-Allow-Origin", "https://pesenta.bg");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Vary", "Origin");
  return res;
}

/* Клиентът се връща от Stripe с ?session_id=… и пита кой е неговият
   документ. Webhook-ът може още да не е пристигнал — тогава отговаряме
   „още не", а страницата пробва пак. */
async function handleBeleshkaLink(request, env) {
  const sid = new URL(request.url).searchParams.get("session") || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) {
    return cors(json({ error: "невалиден идентификатор на сесия" }, 400));
  }

  const sale = await env.DB.prepare(
    "SELECT order_no, doc_n FROM sales WHERE stripe_event_key = ?"
  ).bind("cs:" + sid).first();

  if (!sale) return cors(json({ ready: false }));

  const url = await beleshkaUrl(env, sale.order_no);
  /* Продажбата съществува, но липсва настройка за линка. Не лъжем клиента
     с „готово" — страницата ще му каже, че документът идва по имейл. */
  if (!url) return cors(json({ ready: false, reason: "линкът не е конфигуриран" }));

  /* pesen: адресът, към който сочи QR-ът на картичката — за проверка и за
     админ панела; сесията на Stripe е тайната, която го пази. */
  return cors(json({ ready: true, doc_n: padDoc(sale.doc_n), url: url,
                     kartichka: await kartichkaUrl(env, sale.order_no),
                     pesen: await pesenUrl(env, sale.order_no) }));
}

/* Връща null, ако липсва нещо от нужното, вместо адрес, който после ще
   даде 500. По-добре клиентът да не види линк, отколкото да види счупен. */
async function beleshkaUrl(env, orderNo) {
  if (!env.AUDIT_TOKEN || !env.PUBLIC_BASE) return null;
  return env.PUBLIC_BASE + "/beleshka/" + encodeURIComponent(orderNo) +
         "?t=" + (await beleshkaToken(orderNo, env.AUDIT_TOKEN));
}

/* ============ Картичката „песента пътува“ (11.09.2026) ============ */

async function kartichkaUrl(env, orderNo) {
  if (!env.AUDIT_TOKEN || !env.PUBLIC_BASE) return null;
  return env.PUBLIC_BASE + "/kartichka/" + encodeURIComponent(orderNo) +
         "?t=" + (await kartichkaToken(orderNo, env.AUDIT_TOKEN));
}
async function pesenUrl(env, orderNo) {
  if (!env.AUDIT_TOKEN || !env.PUBLIC_BASE) return null;
  return env.PUBLIC_BASE + "/p/" + encodeURIComponent(orderNo) +
         "?t=" + (await pesenToken(orderNo, env.AUDIT_TOKEN));
}

/* Името на получателя е в брифа (полето „Име или прякор на получателя“ от
   пълната форма). При бързата текстова поръчка го няма — тогава картичката
   оставя празен ред за писане на ръка. Никога не се гадае от разказа. */
async function briefIme(env, orderNo) {
  const b = await env.DB.prepare("SELECT poleta FROM briefs WHERE order_no = ?").bind(orderNo).first();
  if (!b || !b.poleta) return "";
  try {
    const p = JSON.parse(b.poleta);
    return String(p.recipient || "").replace(/\s+/g, " ").trim().slice(0, 40);
  } catch (e) { return ""; }
}

async function handleKartichka(request, env, orderNo) {
  if (!env.AUDIT_TOKEN) return new Response("AUDIT_TOKEN не е зададен", { status: 500 });
  const given = new URL(request.url).searchParams.get("t") || "";
  if (!timingSafeEqual(given, await kartichkaToken(orderNo, env.AUDIT_TOKEN))) return new Response("Забранено", { status: 403 });
  const sale = await env.DB.prepare("SELECT * FROM sales WHERE order_no = ?").bind(orderNo).first();
  if (!sale) return new Response("Няма такава поръчка", { status: 404 });
  const ime = await briefIme(env, orderNo);
  const qr = qrSvg(await pesenUrl(env, orderNo));
  return new Response(renderKartichka(env, sale, ime, qr), {
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" }
  });
}

/* Адресът от QR-а. Щом при връчването page_url е записан (админ панелът или
   wrangler d1), картичката вече води направо към песента. no-store, за да не
   остане чакалнята в кеша на телефона след това. */
async function handlePesen(request, env, orderNo) {
  if (!env.AUDIT_TOKEN) return new Response("AUDIT_TOKEN не е зададен", { status: 500 });
  const given = new URL(request.url).searchParams.get("t") || "";
  if (!timingSafeEqual(given, await pesenToken(orderNo, env.AUDIT_TOKEN))) return new Response("Забранено", { status: 403 });
  const sale = await env.DB.prepare("SELECT * FROM sales WHERE order_no = ?").bind(orderNo).first();
  if (!sale) return new Response("Няма такава поръчка", { status: 404 });
  if (sale.page_url && /^https:\/\/pesenta\.bg\//.test(sale.page_url)) {
    return new Response(null, { status: 302, headers: { Location: sale.page_url, "Cache-Control": "no-store" } });
  }
  const ime = await briefIme(env, orderNo);
  return new Response(renderPesenChaka(env, sale, ime), {
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" }
  });
}

/* Изпращане по имейл през Brevo — акаунтът вече се ползва за бюлетина,
   затова не въвеждаме втори доставчик само за това.

   Провалът НЕ вдига грешка нагоре: продажбата вече е записана и документът
   съществува на адрес. Ако върнем 500, Stripe ще ретрайва и рискуваме
   втори документ за същото плащане — по-лошото от двете. Грешката се
   записва в email_error, за да се види при проверка. */
/* „en“ за чужд клиент, „bg“ за всички останали. Изнесена за проверката в tools/. */
export function ezikNaKlienta(vidBrif, darzhava) {
  if (/\(EN\)/.test(String(vidBrif || ""))) return "en";
  const d = String(darzhava || "").toUpperCase();
  if (d && d !== "BG") return "en";
  return "bg";
}

async function sendBeleshkaEmail(env, sale) {
  if (!env.BREVO_API_KEY) return { ok: false, error: "BREVO_API_KEY не е зададен" };
  if (!sale.customer_email) return { ok: false, error: "клиентът няма имейл в Stripe" };

  const url = await beleshkaUrl(env, sale.order_no);
  if (!url) return { ok: false, error: "липсва AUDIT_TOKEN или PUBLIC_BASE — линкът не може да се подпише" };
  const kart = await kartichkaUrl(env, sale.order_no);

  /* Чужд клиент: писмото на английски, без картичката (тя е на български).
     Самият документ остава български — той е по Наредба Н-18. */
  const body = sale.ezik === "en" ? {
    sender: { name: "Pesenta", email: env.MAIL_SENDER },
    to: [{ email: sale.customer_email, name: sale.customer_name || undefined }],
    subject: "Sales receipt " + padDoc(sale.doc_n) + " — Pesenta",
    htmlContent:
      "<p>Hi" + (sale.customer_name ? " " + xmlEscape(sale.customer_name) : "") + ",</p>" +
      "<p>We've received your payment. Here is the sales receipt " +
      "<strong>" + padDoc(sale.doc_n) + "</strong> for order " +
      "<strong>" + xmlEscape(sale.order_no) + "</strong>:</p>" +
      '<p><a href="' + url + '">Open the receipt</a></p>' +
      "<p>The receipt is a Bulgarian fiscal document, so it is in Bulgarian.</p>" +
      "<p>Your song will arrive at this email within 24 hours, together with the lyrics.</p>" +
      "<p>Pesenta · pesenta.bg</p>"
  } : {
    sender: { name: env.MAIL_SENDER_NAME || "Песента", email: env.MAIL_SENDER },
    to: [{ email: sale.customer_email, name: sale.customer_name || undefined }],
    subject: "Документ за продажба " + padDoc(sale.doc_n) + " — Песента",
    htmlContent:
      "<p>Здравей" + (sale.customer_name ? " " + xmlEscape(sale.customer_name) : "") + ",</p>" +
      "<p>Плащането е получено. Ето документа за продажбата " +
      "<strong>" + padDoc(sale.doc_n) + "</strong> по поръчка " +
      "<strong>" + xmlEscape(sale.order_no) + "</strong>:</p>" +
      '<p><a href="' + url + '">Отвори документа</a></p>' +
      "<p>Песента пристига до 24 часа на този имейл, заедно с текста.</p>" +
      (kart ? '<p>Подаръкът е за днес? <a href="' + kart + '">Ето картичката</a> — за печат на А6 или ' +
              'направо на телефона: „Песента ти пътува. Утре е при теб.“, с името на човека и QR код, ' +
              'който води към песента, щом е готова.</p>' : "") +
      "<p>Песента · pesenta.bg</p>"
  };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) return { ok: false, error: "Brevo HTTP " + res.status + " " + (await res.text()).slice(0, 200) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

/* Известие към нас, не към клиента.
   ---------------------------------------------------------------------
   Stripe праща собствено писмо при плащане, но то е лична отметка на
   един потребител в чужд панел — на 02.08.2026 работеше, на 27.08 вече
   не, и поръчка мина без никой да разбере. Тук изпращането е наше:
   не зависи от ничии настройки и казва това, което Stripe не казва —
   номер на поръчката, документа, и дали бележката е стигнала до клиента.

   Получателите са в NOTIFY_EMAILS (запетаи). Задава се със `wrangler
   secret put NOTIFY_EMAILS` — не в wrangler.toml, защото repo-то е
   публично и лични адреси там събират спам. Без него писмото отива на
   подателя, тоест sales@pesenta.bg. */
/* Датата на повода и броя снимки ги има само в poleta (целия пратен обект). Снимките пътуват
   единствено през FormSubmit, в отделно писмо — на 06.10.2026 (PSN-261006-1422) то не дойде,
   а без този ред никой не разбра, че е имало снимка. Затова писмото за плащане ги казва. */
export function briefDopalnitelno(poleta) {
  var p = {};
  try { p = JSON.parse(poleta || "{}") || {}; } catch (e) { p = {}; }
  var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(p.event_date || ""));
  var s = parseInt(p.snimki, 10);
  return {
    data: d ? d[3] + "." + d[2] + "." + d[1] : "",
    snimki: isFinite(s) && s > 0 ? s : 0,
    snimkiIzvestni: p.snimki !== undefined && p.snimki !== null && p.snimki !== ""
  };
}

/* Изнесена за проверката в tools/ (известие с подменени DB и fetch), не за друго. */
export async function notifyVatreshno(env, n) {
  try {
    if (!env.BREVO_API_KEY || !env.MAIL_SENDER) return;

    var poluchateli = String(env.NOTIFY_EMAILS || env.MAIL_SENDER)
      .split(",").map(function (a) { return a.trim(); })
      .filter(Boolean).map(function (a) { return { email: a }; });
    if (!poluchateli.length) return;

    /* Разказът, ако е стигнал. Липсата му е новина, не дреболия: без него
       песента не може да се напише, а клиентът вече е платил. Брифът идва
       ПРЕДИ плащането, тоест до тук трябва да е в базата. */
    var brief = null;
    try {
      brief = await env.DB.prepare(
        "SELECT vid, povod, stilove, ezik, razkaz, poleta FROM briefs WHERE order_no = ?"
      ).bind(n.order_no).first();
    } catch (e) { /* дори липсваща таблица не бива да спира известието */ }
    var dop = briefDopalnitelno(brief && brief.poleta);

    var suma = typeof n.amount_c === "number"
      ? (n.amount_c / 100).toFixed(2) + " " + String(n.currency || "").toUpperCase()
      : "неизвестна сума";

    var red = function (etiket, stoinost) {
      return "<tr><td style=\"padding:4px 14px 4px 0;color:#666\">" + etiket +
             "</td><td style=\"padding:4px 0\"><strong>" + xmlEscape(String(stoinost)) +
             "</strong></td></tr>";
    };

    var redove =
      red("Поръчка", n.order_no) +
      red("Документ", padDoc(n.doc_n)) +
      red("Сума", suma) +
      red("Клиент", n.customer_name || "без име") +
      red("Имейл", n.customer_email || "няма") +
      red("Експрес", n.express ? "ДА — 24 часа" : "не");

    /* Двете предупреждения са причината писмото да съществува: и в двата
       случая някой трябва да пипне нещо на ръка, и то днес. */
    var trevogi = "";
    if (!n.currency_ok) {
      trevogi += "<p style=\"background:#FDECEA;border-left:4px solid #C0392B;padding:10px 14px\">" +
        "<strong>Валутата не е евро.</strong> Сумите в одиторския файл са смятани " +
        "като евро и НЕ са верни за тази поръчка. Изключи Adaptive Pricing и провери ръчно.</p>";
    }
    if (!n.beleshka || !n.beleshka.ok) {
      trevogi += "<p style=\"background:#FEF5E7;border-left:4px solid #B9770E;padding:10px 14px\">" +
        "<strong>Бележката НЕ стигна до клиента.</strong> " +
        xmlEscape(String((n.beleshka && n.beleshka.error) || "неизвестна причина")) +
        " — прати я на ръка.</p>";
    }

    /* Ваучер (15.10.2026): разказ няма и не трябва — той идва при осребряването. */
    var v = n.vaucher || null;
    if (v) {
      redove += red("Код", v.kod) + red("За", v.za_kogo || "—") + red("От", v.ot_kogo || "—") +
        red("Писмо с ваучера", n.beleshka && n.beleshka.ok ? (n.beleshka.bezPdf ? "пратено БЕЗ PDF" : "пратено с PDF") : "НЕ");
      if (v.bez_danni) {
        trevogi += "<p style=\"background:#FEF5E7;border-left:4px solid #B9770E;padding:10px 14px\">" +
          "<strong>Данните от формата за ваучера не стигнаха.</strong> Кодът е без име (" + xmlEscape(String(v.kod)) +
          "), на ваучера няма „За“, „От“ и послание. Пиши на купувача, ако иска да ги добави.</p>";
      }
      if (n.beleshka && n.beleshka.bezPdf) {
        trevogi += "<p style=\"background:#FEF5E7;border-left:4px solid #B9770E;padding:10px 14px\">" +
          "<strong>PDF-ът не се прикачи.</strong> " + xmlEscape(String(n.beleshka.bezPdf)) +
          " — писмото тръгна без него; прати PDF-а на ръка.</p>";
      }
      if (v.poslanie) {
        trevogi += "<p style=\"font:14px/1.6 sans-serif;background:#F6F5FA;border-left:3px solid #D2577F;" +
          "padding:12px 16px;white-space:pre-wrap\">" + xmlEscape(String(v.poslanie)) + "</p>";
      }
    }

    if (!brief && !v) {
      trevogi += "<p style=\"background:#FDECEA;border-left:4px solid #C0392B;padding:10px 14px\">" +
        "<strong>За тази поръчка НЯМА разказ.</strong> Плащането е минало, но историята " +
        "не е стигнала до нас — песента не може да се напише. Пиши на клиента да я разкаже.</p>";
    }

    if (dop.snimki) {
      trevogi += "<p style=\"background:#EAF2FB;border-left:4px solid #2E6DA4;padding:10px 14px\">" +
        "<strong>Клиентът е приложил " + dop.snimki + (dop.snimki === 1 ? " снимка" : " снимки") +
        ".</strong> Те идват САМО в отделно писмо „Снимки за обложката — " +
        xmlEscape(String(n.order_no)) + "“. Ако то липсва, поискай ги от клиента.</p>";
    }

    var razkazBlok = "";
    if (brief && !v) {
      razkazBlok =
        "<h3 style=\"font:600 15px sans-serif;margin:22px 0 8px\">Разказът на клиента</h3>" +
        "<table style=\"font:14px sans-serif;border-collapse:collapse\">" +
        (brief.vid     ? red("Вид", brief.vid)         : "") +
        (brief.povod   ? red("Повод", brief.povod)     : "") +
        (dop.data      ? red("Дата на повода", dop.data) : "") +
        (brief.stilove ? red("Стилове", brief.stilove) : "") +
        (brief.ezik    ? red("Език", brief.ezik)       : "") +
        (dop.snimkiIzvestni ? red("Снимки", dop.snimki ? dop.snimki + " (в отделно писмо)" : "няма") : "") +
        "</table>" +
        "<p style=\"font:14px/1.6 sans-serif;background:#F6F5FA;border-left:3px solid #D2577F;" +
        "padding:12px 16px;margin-top:12px;white-space:pre-wrap\">" +
        xmlEscape(String(brief.razkaz || "—")) + "</p>";
    }

    var telo = {
      sender: { name: env.MAIL_SENDER_NAME || "Песента", email: env.MAIL_SENDER },
      to: poluchateli,
      subject: (n.currency_ok ? "" : "[ВАЛУТА] ") +
               ((n.beleshka && n.beleshka.ok) ? "" : "[БЕЛЕЖКА] ") +
               (brief || v ? "" : "[БЕЗ РАЗКАЗ] ") +
               (v ? "Продаден ваучер " : "Плащане ") + suma + " · " + n.order_no,
      htmlContent:
        "<h2 style=\"font:600 18px sans-serif;margin:0 0 12px\">" + (v ? "Продаден ваучер" : "Постъпи плащане") + "</h2>" +
        trevogi +
        "<table style=\"font:14px sans-serif;border-collapse:collapse\">" + redove + "</table>" +
        "<p style=\"font:13px sans-serif;color:#666;margin-top:16px\">Payment Intent: " +
        xmlEscape(String(n.payment_intent || "—")) + "</p>" +
        razkazBlok
    };

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify(telo)
    });
  } catch (e) {
    /* Нарочно глухо: продажбата вече е записана и това е по-важно. */
  }
}

/* ============ Ваучер за песен (15.10.2026) ============
   Кодът, проверките и блокът на писмото са във vaucher.js. Тук е това, което
   ползва бележката, подписите и известията: активирането при плащане (в batch-а
   с продажбата), писмото, осребряването, PDF маршрутът, cron-ът и връщането. */

/* D1 връща { meta: { changes } }; node:sqlite в пробата — { changes }. */
const promeni = (r) => (r && r.meta ? r.meta.changes : (r && r.changes)) || 0;

/* Нов VCH- номер, който още не е зает (иначе бихме „взели“ чужда чакаща форма). */
async function svobodenRef(env) {
  for (let i = 0; i < 20; i++) {
    const ref = noviRef();
    if (!(await env.DB.prepare("SELECT 1 FROM vaucheri WHERE ref = ?").bind(ref).first())) return ref;
  }
  throw new Error("няма свободен VCH- номер");
}

/* Кодът се прави от имената в реда „chaka“; без ред (beacon-ът се е изгубил) —
   ред с празни имена и код PODARAK-…, за да не остане купувачът без код.
   Вече платен ref, платен втори път (друга сесия) — нов ref със същите имена:
   два плащания, два кода. При UNIQUE на kod_norm — нов код и нов опит; batch-ът
   е атомарен, тоест и продажбата се връща и влиза пак със същия doc_n. */
async function aktivirajVaucher(env, s, ref, insSale) {
  const sega = new Date().toISOString();
  if (!insSale) {
    const veche = await env.DB.prepare("SELECT * FROM vaucheri WHERE stripe_session = ?").bind(s.id).first();
    if (veche) return Object.assign(veche, { nov: false });
  }
  const red = await env.DB.prepare("SELECT * FROM vaucheri WHERE ref = ?").bind(ref).first();
  let kopie = false;
  if (red && red.status !== "chaka") { ref = await svobodenRef(env); kopie = true; }
  const email = (s.customer_details && s.customer_details.email) || null;
  const d = red || { ot_kogo: "", za_kogo: "", poslanie: "", email: email, faktura: null, created_at: sega };

  for (let i = 0; i < 8; i++) {
    const kod = generirajKod(d.za_kogo, d.ot_kogo);
    const st = env.DB.prepare(
      `INSERT INTO vaucheri (ref, kod, kod_norm, status, ot_kogo, za_kogo, poslanie, email, faktura,
         bez_danni, created_at, platen_at, stripe_session)
       VALUES (?,?,?,'aktiven',?,?,?,?,?,?,?,?,?)
       ON CONFLICT(ref) DO UPDATE SET kod = excluded.kod, kod_norm = excluded.kod_norm,
         status = 'aktiven', platen_at = excluded.platen_at, stripe_session = excluded.stripe_session
       WHERE vaucheri.status = 'chaka'`
    ).bind(ref, kod, normKod(kod), d.ot_kogo || "", d.za_kogo || "", d.poslanie || "",
           d.email || email, d.faktura || null, red ? 0 : 1, d.created_at || sega, sega, s.id);
    try {
      await env.DB.batch(insSale ? [insSale, st] : [st]);
    } catch (e) {
      const m = String(e && e.message || e);
      if (/UNIQUE/i.test(m) && /kod_norm/i.test(m)) continue;
      throw e;
    }
    const v = await env.DB.prepare("SELECT * FROM vaucheri WHERE ref = ?").bind(ref).first();
    return Object.assign(v || { ref: ref, kod: kod }, { nov: true, kopie: kopie });
  }
  throw new Error("не намерих свободен код за ваучера след 8 опита");
}

/* Писмото и известието до нас — след записа, във waitUntil (без ctx — чака се). */
function zadachaVaucherPismo(env, ctx, v) {
  const p = (async () => {
    const sent = await pratiVaucherPismo(env, v.ref);
    if (sent.skip) return;
    const sale = sent.sale || {};
    await notifyVatreshno(env, {
      doc_n: sale.doc_n, order_no: sale.order_no || v.ref,
      customer_name: sale.customer_name, customer_email: sale.customer_email,
      amount_c: sale.total_eur_c, currency: sale.currency, currency_ok: !sale.currency_warning,
      express: false, payment_intent: sale.trans_n,
      beleshka: sent, vaucher: sent.v || v
    });
  })().catch(() => {});
  if (ctx && typeof ctx.waitUntil === "function") { ctx.waitUntil(p); return undefined; }
  return p;
}

async function vaucherPdfUrl(env, ref) {
  if (!env.AUDIT_TOKEN || !env.PUBLIC_BASE) return null;
  return env.PUBLIC_BASE + "/vaucher/pdf/" + encodeURIComponent(ref) +
         "?t=" + (await signedToken("vaucher", ref, env.AUDIT_TOKEN));
}

/* Едно писмо за ваучера (15.10.2026): ваучерът + е-бележката. Опитите се броят
   (pismo_opiti) и се „заключват“ с UPDATE … WHERE pismo_opiti = старото — два
   едновременни опита (webhook и cron) не пращат две писма. */
export async function pratiVaucherPismo(env, ref) {
  const v = await env.DB.prepare("SELECT * FROM vaucheri WHERE ref = ?").bind(ref).first();
  if (!v) return { ok: false, error: "няма такъв ваучер", skip: true };
  if (v.pismo_at) return { ok: true, skip: true };
  const sale = v.stripe_session
    ? await env.DB.prepare("SELECT * FROM sales WHERE stripe_event_key = ?").bind("cs:" + v.stripe_session).first()
    : null;
  const zakl = await env.DB.prepare(
    "UPDATE vaucheri SET pismo_opiti = pismo_opiti + 1 WHERE ref = ? AND pismo_at IS NULL AND pismo_opiti = ?"
  ).bind(ref, v.pismo_opiti || 0).run();
  if (promeni(zakl) !== 1) return { ok: false, error: "друг опит вече праща", skip: true };

  const rez = await sendVaucherEmail(env, sale, v);
  const sega = new Date().toISOString();
  await env.DB.prepare("UPDATE vaucheri SET pismo_at = ?, pismo_greshka = ? WHERE ref = ?").bind(
    rez.ok ? sega : null,
    rez.ok ? (rez.bezPdf ? ("без PDF: " + rez.bezPdf).slice(0, 300) : null) : String(rez.error).slice(0, 300), ref
  ).run();
  /* Писмото Е бележката — без това админът би казал „бележката НЕ е изпратена“. */
  if (sale) {
    await env.DB.prepare("UPDATE sales SET email_sent_at = ?, email_error = ? WHERE stripe_event_key = ?")
      .bind(rez.ok ? sega : null, rez.ok ? null : rez.error, sale.stripe_event_key).run();
  }
  return Object.assign(rez, { sale: sale, v: v });
}

async function brevo(env, body) {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let t = ""; try { t = (await res.text()).slice(0, 200); } catch (e) { t = ""; }
      return { ok: false, error: "Brevo HTTP " + res.status + (t ? " " + t : "") };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

/* PDF-ът е по адрес (Brevo го тегли от нас). Не тръгне ли писмото с него —
   второ без него: бележката е задължителна, PDF-ът — не; известието казва. */
async function sendVaucherEmail(env, sale, v) {
  if (!env.BREVO_API_KEY) return { ok: false, error: "BREVO_API_KEY не е зададен" };
  if (!sale) return { ok: false, error: "няма продажба за този ваучер" };
  const to = sale.customer_email || v.email;
  if (!to) return { ok: false, error: "клиентът няма имейл" };
  const belUrl = await beleshkaUrl(env, sale.order_no);
  if (!belUrl) return { ok: false, error: "липсва AUDIT_TOKEN или PUBLIC_BASE — линкът не може да се подпише" };
  const pdfUrl = await vaucherPdfUrl(env, v.ref);
  const osnova = {
    sender: { name: env.MAIL_SENDER_NAME || "Песента", email: env.MAIL_SENDER },
    replyTo: { email: env.MAIL_SENDER },
    to: [{ email: to, name: sale.customer_name || undefined }],
    subject: (v.za_kogo ? "Ваучерът за песен за " + v.za_kogo + " е готов" : "Ваучерът за песен е готов") +
             " · документ " + padDoc(sale.doc_n)
  };
  const s = await brevo(env, Object.assign({}, osnova, {
    htmlContent: vaucherPismoHtml(sale, v, belUrl, true),
    attachment: [{ url: pdfUrl, name: "vaucher-" + v.kod + ".pdf" }]
  }));
  if (s.ok) return { ok: true };
  const bez = await brevo(env, Object.assign({}, osnova, { htmlContent: vaucherPismoHtml(sale, v, belUrl, false) }));
  if (bez.ok) return { ok: true, bezPdf: s.error };
  return { ok: false, error: bez.error };
}

/* По образеца на писмото при доставка: тъмно, таблици, лого-картинка. Без
   „Песента пристига до 24 часа“ и без картичката — песента още не е поръчана. */
export function vaucherPismoHtml(sale, v, belUrl, sPdf) {
  const F = "font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;";
  const td = (vatre, pad) => '<tr><td bgcolor="#12101F" style="background-color:#12101F;padding:' + pad + ';">' + vatre + "</td></tr>";
  const p = (t, st) => '<p style="margin:0 0 14px 0;' + F + 'font-size:15px;line-height:1.62;color:#D9D5EE;' + (st || "") + '">' + t + "</p>";
  return '<!DOCTYPE html><html lang="bg"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="color-scheme" content="dark light"><title>Ваучер за песен</title></head>' +
    '<body style="margin:0;padding:0;background-color:#0B0A1A;" bgcolor="#0B0A1A">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#0B0A1A" style="background-color:#0B0A1A;">' +
    '<tr><td align="center" bgcolor="#0B0A1A" style="background-color:#0B0A1A;padding:28px 12px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="#12101F" style="width:600px;max-width:600px;background-color:#12101F;">' +
      '<tr><td bgcolor="#0B0A1A" style="background-color:#0B0A1A;padding:26px 32px 22px 32px;">' +
        '<a href="https://pesenta.bg" style="text-decoration:none;"><img src="https://pesenta.bg/assets/img/logo-mail-v1.png" width="230" height="44" alt="pesenta.bg" ' +
        'style="display:block;width:230px;height:44px;border:0;' + F + 'font-size:22px;font-weight:bold;color:#F4F2FF;"></a>' +
      "</td></tr>" +
      '<tr><td bgcolor="#D2577F" height="3" style="background-color:#D2577F;height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>' +
      td('<p style="margin:0 0 14px 0;' + F + 'font-size:20px;line-height:1.3;font-weight:bold;color:#F4F2FF;">Здравей' +
           (sale.customer_name ? ", " + esc(sale.customer_name) : "") + ",</p>" +
         p("Плащането е получено и ваучерът е готов. " + (sPdf
           ? "Прикачен е и като PDF — за печат или за препращане."
           : "Ако искаш да го препратиш, просто препрати това писмо.")), "32px 32px 10px 32px") +
      vaucherBlokHtml(v) +
      td('<p style="margin:0 0 8px 0;' + F + 'font-size:14px;font-weight:bold;color:#F4F2FF;">Документ за продажбата</p>' +
         p("Документ <strong>" + esc(padDoc(sale.doc_n)) + "</strong> по поръчка <strong>" + esc(sale.order_no) + "</strong>: " +
           '<a href="' + esc(belUrl) + '" style="color:#FFA14D;">Отвори документа</a>', "font-size:14px;"),
         "22px 32px 8px 32px") +
      td(p("Песента · pesenta.bg", "font-size:13px;color:#A9A4C9;"), "10px 32px 26px 32px") +
    "</table></td></tr></table></body></html>";
}

/* POST /vaucher/izpolzvai — осребряване. UPDATE … WHERE status = 'aktiven' е
   единственото място, което решава: от два едновременни опита само един има
   changes = 1. Брифът е в СЪЩИЯ batch, но се пише само ако тази поръчка е
   осребрила кода (EXISTS след UPDATE-а) — неуспешен опит не оставя „неплатен“
   бриф, на който напомнянето после да пише „плати“. */
async function handleVaucherIzpolzvai(request, env, ctx) {
  if (!(await vLimita(request, env))) return vjson({ ok: false, prichina: "mnogo_opiti" }, 429);
  const { telo, greshka } = await chetiTelo(request, 20000);
  if (greshka) return greshka;
  const orderNo = String((telo && telo.order_no) || "");
  if (!/^PSN-[0-9]{6}-[0-9]{4}$/.test(orderNo)) return vjson({ ok: false, prichina: "order_no" }, 400);
  if (!telo.brief || typeof telo.brief !== "object" || Array.isArray(telo.brief)) return vjson({ ok: false, prichina: "brief" }, 400);
  const kn = normKod(telo.kod);
  if (kn.length < 8) return vjson({ ok: false, prichina: "nyama" }, 409);

  const sega = new Date().toISOString();
  const brief = Object.assign({}, telo.brief, { order_no: orderNo, vaucher: String(telo.kod).toUpperCase().slice(0, 40) });
  const rez = await env.DB.batch([
    env.DB.prepare(
      "UPDATE vaucheri SET status = 'izpolzvan', izpolzvan_at = ?, izpolzvan_order = ? WHERE kod_norm = ? AND status = 'aktiven'"
    ).bind(sega, orderNo, kn),
    env.DB.prepare(
      `INSERT INTO briefs (order_no, created_at, vid, povod, stilove, ezik, razkaz, poleta)
       SELECT ?,?,?,?,?,?,?,? WHERE EXISTS
         (SELECT 1 FROM vaucheri WHERE kod_norm = ? AND status = 'izpolzvan' AND izpolzvan_order = ?)
       ON CONFLICT(order_no) DO UPDATE SET ` + BRIEF_UPSERT
    ).bind(orderNo, sega, ...briefPoleta(brief), kn, orderNo)
  ]);

  const v = await env.DB.prepare("SELECT * FROM vaucheri WHERE kod_norm = ?").bind(kn).first();
  if (promeni(rez[0]) === 1 && v) {
    const p = notifyOsrebren(env, v, orderNo).catch(() => {});
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(p); else await p;
    return vjson({ ok: true });
  }
  /* Същата поръчка, пратена втори път (двоен клик, мрежа) — вече е успяла. */
  if (v && v.status === "izpolzvan" && v.izpolzvan_order === orderNo) return vjson({ ok: true, povtorno: true });
  const prichina = !v || v.status === "chaka" ? "nyama" : (v.status === "izpolzvan" ? "izpolzvan" : "otmenen");
  return vjson({ ok: false, prichina: prichina }, 409);
}

async function pratiVatreshno(env, subject, html) {
  if (!env.BREVO_API_KEY || !env.MAIL_SENDER) return { ok: false, error: "липсва настройка" };
  const poluchateli = String(env.NOTIFY_EMAILS || env.MAIL_SENDER).split(",")
    .map(function (a) { return a.trim(); }).filter(Boolean).map(function (a) { return { email: a }; });
  if (!poluchateli.length) return { ok: false, error: "няма получатели" };
  return brevo(env, { sender: { name: env.MAIL_SENDER_NAME || "Песента", email: env.MAIL_SENDER },
                      to: poluchateli, subject: subject, htmlContent: html });
}

/* Осребрен ваучер: няма Stripe, няма бележка — това писмо е единственият знак. */
async function notifyOsrebren(env, v, orderNo) {
  let b = null;
  try {
    b = await env.DB.prepare("SELECT vid, povod, stilove, ezik, razkaz, poleta FROM briefs WHERE order_no = ?").bind(orderNo).first();
  } catch (e) { b = null; }
  const dop = briefDopalnitelno(b && b.poleta);
  let pl = {};
  try { pl = JSON.parse((b && b.poleta) || "{}") || {}; } catch (e) { pl = {}; }
  const red = (k, s) => s ? "<tr><td style=\"padding:4px 14px 4px 0;color:#666\">" + k +
    "</td><td style=\"padding:4px 0\"><strong>" + xmlEscape(String(s)) + "</strong></td></tr>" : "";
  const html =
    "<h2 style=\"font:600 18px sans-serif;margin:0 0 12px\">Осребрен ваучер</h2>" +
    "<p style=\"background:#EAF2FB;border-left:4px solid #2E6DA4;padding:10px 14px\">Поръчката е платена с ваучер — " +
    "няма плащане в Stripe и няма нова бележка. Не е в продажбите; доставката се отбелязва в админа, раздел „Ваучери“.</p>" +
    "<table style=\"font:14px sans-serif;border-collapse:collapse\">" +
      red("Код", v.kod) + red("Поръчка", orderNo) + red("Ваучер", v.ref) +
      red("Ваучерът е за", v.za_kogo) + red("От", v.ot_kogo) + red("Имейл (поръчката)", pl.email) +
      red("Вид", b && b.vid) + red("Повод", b && b.povod) + red("Дата на повода", dop.data) +
      red("Стилове", b && b.stilove) + red("Език", b && b.ezik) +
      (dop.snimkiIzvestni ? red("Снимки", dop.snimki ? dop.snimki + " (в отделно писмо)" : "няма") : "") +
    "</table>" +
    (b ? "<p style=\"font:14px/1.6 sans-serif;background:#F6F5FA;border-left:3px solid #D2577F;padding:12px 16px;" +
         "margin-top:12px;white-space:pre-wrap\">" + xmlEscape(String(b.razkaz || "—")) + "</p>"
       : "<p style=\"background:#FDECEA;border-left:4px solid #C0392B;padding:10px 14px\"><strong>Брифът не е записан.</strong></p>");
  return pratiVatreshno(env, (b ? "" : "[БЕЗ РАЗКАЗ] ") + "Осребрен ваучер " + v.kod + " → " + orderNo, html);
}

/* GET /vaucher/pdf/<ref>?t= — само за платен ваучер (aktiven/izpolzvan). PDF модулът
   се зарежда лениво: pdf-lib и шрифтовете не тежат на никоя друга заявка. */
async function handleVaucherPdf(request, env, ref) {
  if (!env.AUDIT_TOKEN) return new Response("AUDIT_TOKEN не е зададен", { status: 500 });
  const given = new URL(request.url).searchParams.get("t") || "";
  if (!timingSafeEqual(given, await signedToken("vaucher", ref, env.AUDIT_TOKEN))) return new Response("Забранено", { status: 403 });
  const v = await env.DB.prepare("SELECT * FROM vaucheri WHERE ref = ?").bind(ref).first();
  if (!v || (v.status !== "aktiven" && v.status !== "izpolzvan") || !v.kod) return new Response("Няма такъв ваучер", { status: 404 });
  let mod;
  try { mod = await import("./vaucher-pdf.js"); } catch (e) { return new Response("PDF модулът липсва", { status: 503 }); }
  /* Фонът — кадър от СЦЕНА (aurora-ribbons, 15.10.2026), стои на сайта. JPEG-ът се
     вгражда без декодиране, затова не тежи на CPU. Не дойде ли — тъмният фон по подразбиране. */
  let fon;
  try {
    const r = await fetch("https://pesenta.bg/assets/img/vaucher-fon.jpg", { cf: { cacheTtl: 86400, cacheEverything: true } });
    if (r.ok) fon = new Uint8Array(await r.arrayBuffer());
  } catch (e) { /* без фон */ }
  const bytes = await mod.vaucherPdf({
    kod: v.kod, za_kogo: v.za_kogo || "", ot_kogo: v.ot_kogo || "", poslanie: v.poslanie || "",
    link: "https://pesenta.bg/?kod=" + encodeURIComponent(v.kod) + "#order", fon, voal: 0.45
  });
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="vaucher-' + v.kod + '.pdf"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

/* Cron (веднъж на час): допращане на писмото за платен ваучер без pismo_at,
   по-стар от 10 минути (първият опит е от webhook-а; общо до 4 опита — 1 + 3
   от cron-а); чистене на неплатените „chaka“ след 30 дни и на броячите след ден. */
export async function vaucherCron(env, sega) {
  sega = sega || new Date();
  const predi10 = new Date(sega.getTime() - 10 * 60e3).toISOString();
  const redove = (await env.DB.prepare(
    `SELECT ref, pismo_opiti FROM vaucheri WHERE platen_at IS NOT NULL AND platen_at < ?
       AND pismo_at IS NULL AND pismo_opiti < 4 AND status IN ('aktiven', 'izpolzvan')`
  ).bind(predi10).all()).results || [];
  let prateni = 0;
  for (const r of redove) {
    const rez = await pratiVaucherPismo(env, r.ref);
    if (rez.ok && !rez.skip) prateni++;
    else if (!rez.skip && (r.pismo_opiti || 0) + 1 >= 4) {
      await pratiVatreshno(env, "[ВАУЧЕР] Писмото не тръгна след 4 опита · " + r.ref,
        "<p>Писмото с ваучера и бележката за <strong>" + xmlEscape(r.ref) + "</strong> не тръгна: " +
        xmlEscape(String(rez.error || "")) + ". Прати го на ръка (кодът е в админа).</p>");
    }
  }
  const predi30 = new Date(sega.getTime() - 30 * 86400e3).toISOString();
  const iztriti = promeni(await env.DB.prepare("DELETE FROM vaucheri WHERE status = 'chaka' AND created_at < ?").bind(predi30).run());
  await env.DB.prepare("DELETE FROM vaucher_opiti WHERE chas < ?")
    .bind(new Date(sega.getTime() - 86400e3).toISOString().slice(0, 13)).run();
  return { pregledani: redove.length, prateni: prateni, iztriti: iztriti };
}

/* Връщане на пари за ваучер: изцяло върнат и неизползван → otmenen. Осребрен —
   статусът остава (песента е поръчана), само известието казва. Частично
   върнат — остава какъвто е (виж отчета). */
async function vaucherPriVrashtane(env, ch) {
  const s = await env.DB.prepare("SELECT stripe_event_key, total_eur_c, order_no FROM sales WHERE trans_n = ?")
    .bind(ch.payment_intent).first();
  if (!s || !/^cs:/.test(String(s.stripe_event_key || ""))) return null;
  const v = await env.DB.prepare("SELECT * FROM vaucheri WHERE stripe_session = ?").bind(s.stripe_event_key.slice(3)).first();
  if (!v) return null;
  const cqlo = s.total_eur_c == null || (ch.amount_refunded || 0) >= s.total_eur_c;
  let kakvo;
  if (v.status === "izpolzvan") kakvo = "вече е ОСРЕБРЕН (" + v.izpolzvan_order + ") — статусът НЕ е сменен";
  else if (v.status === "otmenen") kakvo = "вече беше отменен";
  else if (!cqlo) kakvo = "частично връщане — ваучерът остава активен";
  else {
    await env.DB.prepare("UPDATE vaucheri SET status = 'otmenen', otmenen_at = ? WHERE ref = ? AND status IN ('aktiven', 'chaka')")
      .bind(new Date().toISOString(), v.ref).run();
    kakvo = "отменен — кодът вече не важи";
  }
  await pratiVatreshno(env, "Върнати пари за ваучер " + (v.kod || v.ref) + " — " + kakvo.split(" — ")[0],
    "<p>Върнати пари за ваучер <strong>" + xmlEscape(String(v.kod || "")) + "</strong> (" + xmlEscape(v.ref) +
    ", поръчка " + xmlEscape(String(s.order_no)) + "): " + xmlEscape(kakvo) + ".</p>");
  return kakvo;
}

/* ============ Одиторски файл (Приложение №38) ============ */

async function handleAudit(request, env, year, month) {
  const url = new URL(request.url);
  /* Токенът се приема и от заглавка, защото адресите влизат в историята на
     браузъра, в логовете и в Referer. Заявката от админ панела минава по
     заглавката; ?token= остава за ръчно теглене и за curl. */
  const token = request.headers.get("X-Admin-Token") ||
                url.searchParams.get("token") || "";
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
     продажби няма как да даде валиден файл. Потвърдено от счетоводителя
     (01.08.2026): за такъв месец НЕ се подава нищо. Затова липсата на
     продажби не е грешка, а нормално състояние. */
  if (!sales.length) {
    return json({
      ok: true,
      nothing_to_submit: true,
      period: year + "-" + month,
      note: "Няма продажби за този месец — файл не се подава. " +
            "Схемата (Приложение №38) и без това не допуска файл без нито една поръчка."
    }, 200);
  }

  /* Ако месецът съдържа продажба в чужда валута, файлът НЕ се произвежда.
     Сумите му биха били тихо грешни, а това е отчет пред НАП — по-добре
     да няма файл и да се разбере, отколкото да има файл, на който не може
     да се вярва. */
  const bad = sales.filter((s) => s.currency_warning);
  if (bad.length) {
    return json({
      error: "файлът не е генериран — има продажби в чужда валута",
      period: year + "-" + month,
      broi: bad.length,
      porachki: bad.map((s) => ({ order_no: s.order_no, currency: s.currency })),
      kakvo_da_napravish: "Изключи Adaptive Pricing в Stripe, за да не се повтаря. " +
        "За тези поръчки провери реалните суми в Stripe и ги коригирай в базата, " +
        "после изчисти currency_warning."
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

/* В коя валута излиза одиторският файл.
   ------------------------------------------------------------------
   От 01.01.2026 основната валута в България е еврото. Схемата на НАП
   обаче е от 06.06.2022, няма поле за валута и към момента НЯМА
   публикувано указание какво се очаква след въвеждането на еврото —
   проверено на страницата със спецификацията, качена е само версията
   от 2022 г.

   Затова стойността е превключвател, а не зашита в кода: подразбира се
   EUR (официалната валута), но се сменя на BGN с една дума в
   wrangler.toml, ако счетоводителят или НАП кажат друго. И двете суми
   се пазят в базата, така че смяната не изисква преизчисляване. */
function amountsIn(env) {
  return String(env.AUDIT_CURRENCY || "EUR").toUpperCase() === "BGN"
    ? { unit: (s) => s.art_price_st, disc: (s) => s.discount_st,
        total: (s) => s.total_st, refund: (r) => r.amount_st }
    : { unit: (s) => s.subtotal_eur_c, disc: (s) => s.discount_eur_c,
        total: (s) => s.total_eur_c, refund: (r) => r.amount_eur_c };
}

export function buildAuditXml(env, year, month, sales, refunds) {
  const A = amountsIn(env);
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
    L.push(tag("art_price", money(A.unit(s))));
    L.push(tag("art_vat_rate", String(s.vat_rate)));
    L.push(tag("art_vat", money(s.vat_st)));
    L.push(tag("art_sum", money(A.unit(s) * s.art_quant)));
    L.push("</artenum></art>");
    L.push(tag("ord_total1", money(A.unit(s) * s.art_quant)));
    L.push(tag("ord_disc", money(A.disc(s))));
    L.push(tag("ord_vat", money(s.vat_st)));
    L.push(tag("ord_total2", money(A.total(s))));
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
      L.push(tag("r_amount", money(A.refund(r))));
      L.push(tag("r_date", r.refund_date));
      L.push(tag("r_paym", String(r.r_paym)));
      L.push("</rorderenum>");
    }
    L.push("</rorder>");
  }
  L.push(tag("r_total", money(refunds.reduce((a, r) => a + A.refund(r), 0))));
  L.push("</audit>");
  return L.join("\n");
}

/* ============ Е-бележка (чл. 52о) ============ */

/* Адресът на бележката трябва да е неотгатваем — вътре има име, имейл и
   номер на трансакция. Токенът се извежда от номера на поръчката с
   AUDIT_TOKEN, вместо да се пази в базата: така няма какво да изтече и
   няма миграция на схемата. */
export async function signedToken(prefix, orderNo, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(prefix + ":" + orderNo));
  return [...new Uint8Array(mac)].slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}
/* Три различни префикса: линкът към бележката не отваря картичката и обратно. */
export const beleshkaToken = (orderNo, secret) => signedToken("beleshka", orderNo, secret);
export const kartichkaToken = (orderNo, secret) => signedToken("kartichka", orderNo, secret);
export const pesenToken = (orderNo, secret) => signedToken("pesen", orderNo, secret);

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

/* QR по Приложение №18а — шест полета, разделени със звездичка:
     <номер от НАП>*<номер на поръчката>*<референтен номер на трансакцията>
     *<дата ГГГГ-ММ-ДД>*<час ЧЧ:ММ:СС>*<сума>

   Кодировката по наредбата е ISO/IEC 8859-5, но за нас въпросът е без
   значение: всички шест полета са ASCII (RF…, PSN-…, pi_…, дати, числа),
   а там 8859-5 съвпада байт по байт с ASCII.

   Сумата следва СЪЩАТА валута като одиторския файл (AUDIT_CURRENCY) —
   двата документа описват една и съща продажба и не бива да се разминават,
   ако НАП ги сверява. */
export function qrPayload(env, s) {
  return [
    env.E_SHOP_N,
    s.order_no,
    s.trans_n || "",
    s.doc_date,
    s.doc_time || "00:00:00",
    money(amountsIn(env).total(s))
  ].join("*");
}

/* Генерира се тук, а не в браузъра на клиента: бележката е документ по
   чл. 52о и трябва да е пълна сама по себе си, независимо дали сайтът и
   външните скриптове са достъпни в момента на отварянето ѝ. */
export function qrSvg(payload) {
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 8, scalable: true });
}

export function renderBeleshka(env, s) {
  const e = xmlEscape;
  /* Еврото е основната валута от 01.01.2026; левовата равностойност се
     показва информативно и отпада на 08.08.2026. Датата се сравнява с
     датата на документа, а не с „днес" — стар документ, отворен по-късно,
     трябва да изглежда както е издаден. */
  const showBgn = String(s.doc_date || "") < "2026-08-08";
  const eur = (c) => money(c == null ? 0 : c);
  const bgn = (c) => money(eurToSt(c == null ? 0 : c, Number(env.BGN_RATE)));
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
  /* Наредбата иска кодът да е не по-малък от 18 × 18 мм. Размерът е зададен
     в милиметри, а не в пиксели, за да важи и при печат. */
  .qr { margin: 1.5rem 0; }
  .qr svg { display: block; width: 24mm; height: 24mm; }
  .qr p { font-size: .75rem; color: #666; margin: .35rem 0 0; }
  @media print { body { padding: 0; } .noprint { display: none; } }
</style></head><body><div class="doc">

<h1>Електронна бележка за продажба № ${e(padDoc(s.doc_n))}</h1>
<p class="sub">Документ по чл. 52о, ал. 1 от Наредба № Н-18 · издаден на ${e(s.doc_date)} ${e(s.doc_time || "")}</p>

<table>
  ${row("Продавач", env.SELLER_NAME)}
  ${row("ЕИК", env.EIK)}
  ${row("Адрес", env.SELLER_ADDRESS)}
  ${env.SELLER_VAT ? row("ДДС номер", env.SELLER_VAT) : ""}
  ${env.VAT_EXEMPT_NOTE ? row("Данъчен режим", env.VAT_EXEMPT_NOTE) : ""}
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
    <td class="num">${e(eur(s.subtotal_eur_c))} €</td>
    <td class="num">${e(eur(s.subtotal_eur_c))} €</td>
  </tr>
  ${s.discount_eur_c ? `<tr><td colspan="4">Отстъпка</td>
    <td class="num">−${e(eur(s.discount_eur_c))} €</td></tr>` : ""}
  ${/* Редът съществува само ако наистина се начислява данък. При чл. 97а
        ставката е 0 и чл. 113, ал. 9 ЗДДС забранява данъкът да се посочва —
        затова условието е ставката, а не наличието на ДДС номер (номерът е
        валиден и стои горе). */ ""}
  ${Number(s.vat_rate) > 0 ? `<tr><td colspan="4">ДДС (${e(String(s.vat_rate))}%)</td>
      <td class="num">${e(money(s.vat_st))} €</td></tr>` : ""}
  <tr class="total"><td colspan="4">Общо</td>
      <td class="num">${e(eur(s.total_eur_c))} €</td></tr>
  ${showBgn ? `<tr><td colspan="4">Равностойност в лева
      <span style="color:#888">(информативно)</span></td>
      <td class="num">${e(bgn(s.total_eur_c))} лв.</td></tr>` : ""}
</table>

<div class="qr">
  ${qrSvg(qrPayload(env, s))}
  <p>Двумерен баркод по Приложение №18а</p>
</div>

<p class="foot">
  ${showBgn ? `Сумите са в евро; равностойността в лева е по фиксирания курс
  1 € = ${e(env.BGN_RATE)} лв. ` : ""}Документът е издаден по електронен път
  и е валиден без подпис и печат.
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

/* Дата и час в софийско време, не в UTC.
   Worker-ите вървят на UTC, а България е +2/+3. Продажба в 02:00 софийско
   на 1 септември е 23:00 UTC на 31 август — с toISOString() тя щеше да
   влезе в одиторския файл за ГРЕШНИЯ месец. Затова часовата зона се задава
   изрично. Локалът sv-SE дава точно „ГГГГ-ММ-ДД ЧЧ:ММ:СС". */
export function sofiaParts(d) {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Sofia",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(d);
  const [date, time] = s.split(" ");
  return { date, time };
}

function isoDate(d) {
  return sofiaParts(d).date;
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
