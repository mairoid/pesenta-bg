/* Одобрение на песента през Telegram (28.11.2026)
   ─────────────────────────────────────────────────────────────────────
   Задачата на компютъра на Мирослав пише текста, генерира двете версии в
   Suno и праща съобщение в бота @pesenta_odobrenie_bot с бутони. Натискането
   идва тук (webhook) и се записва в таблица odobrenia в D1.

   Бутоните (callback_data, до 64 байта):
     v1:PSN-…  v2:PSN-…   — избрана версия        chaka_izbor → izbrana
     nanovo:PSN-…          — генерирай наново      chaka_izbor → nanovo
     otkaz:PSN-…           — ръчна обработка       chaka_izbor | chaka_izprashtane → otkaz
     izprati:PSN-…         — прати писмото         chaka_izprashtane → prashta → izpratena | greshka
     spri:PSN-…            — не пращай засега      chaka_izprashtane → spryana

   Връчването (етап 3):
     1. Задачата на компютъра сваля избраната версия, прави страницата и писмото
        и качва в R2 (PESNI): PSN-…/pismo.json и PSN-…/<име>.mp3.
     2. POST /odobrenie/gotova {order_no} с Bearer ODOBRENIE_KEY → Worker-ът
        проверява и праща в Telegram второто съобщение: преглед на писмото,
        страницата и бутоните „Изпрати“ / „Спри“. izbrana → chaka_izprashtane
     3. „Изпрати“ → Brevo от sales@, MP3-то по подписан адрес (/pesen-fail/…),
        скрито копие до NOTIFY_EMAILS; после sales.delivered_at и page_url.
   Получателят ТРЯБВА да е customer_email на поръчката в sales. Пробна поръчка
   (PSN-991231-…, няма я в sales) може да отиде само до адрес от NOTIFY_EMAILS.
   pismo.json: { to, toName, subject, html, text?, page_url, mp3: [{ key, name }] }

   Защита: Telegram праща тайната от setWebhook в заглавката
   X-Telegram-Bot-Api-Secret-Token; приема се само натискане от чата на
   Мирослав (TELEGRAM_CHAT_ID). Тайни: TELEGRAM_TOKEN, TELEGRAM_WEBHOOK_SECRET,
   TELEGRAM_CHAT_ID — с `wrangler secret put`, никога в кода (репото е публично).
   Отговорът към Telegram е винаги 200 след проверката на подписа, за да не
   ретрайва едно и също натискане.
   ───────────────────────────────────────────────────────────────────── */

const DATA_RE = /^(v1|v2|nanovo|otkaz|izprati|spri):(PSN-[0-9]{6}-[0-9]{4})$/;

const IMENA = {
  chaka_izbor: "чака избор на версия",
  izbrana: "избрана версия, чака подготовка",
  nanovo: "чака ново генериране",
  chaka_izprashtane: "чака „Изпрати“",
  prashta: "праща се в момента",
  izpratena: "пратена на клиента",
  spryana: "спряна преди пращане",
  otkaz: "за ръчна обработка",
  rachna: "за ръчна обработка",
  greshka: "грешка",
  generira: "генерира се в момента",
  zaseknata: "спряна от автомата"
};

/* Преходите — чиста логика върху D1, без Telegram. Връща
   { ok, kratko, belezhka } — kratko за изскачащия надпис, belezhka за отговор в чата. */
export async function prilozhi(db, deystvie, orderNo, nowIso) {
  let sql, args, ot, kratko, belezhka;
  if (deystvie === "v1" || deystvie === "v2") {
    const n = deystvie === "v1" ? 1 : 2;
    ot = ["chaka_izbor"];
    sql = "UPDATE odobrenia SET status='izbrana', izbrana=?, izbrano_at=?, updated_at=? WHERE order_no=? AND status='chaka_izbor'";
    args = [n, nowIso, nowIso, orderNo];
    kratko = "Избрана версия " + n;
    belezhka = "✓ " + orderNo + ": избрана версия " + n + ". Свалям я и подготвям страницата и писмото при следващото пускане.";
  } else if (deystvie === "nanovo") {
    ot = ["chaka_izbor"];
    sql = "UPDATE odobrenia SET status='nanovo', updated_at=? WHERE order_no=? AND status='chaka_izbor'";
    args = [nowIso, orderNo];
    kratko = "Ще генерирам наново";
    belezhka = "↻ " + orderNo + ": ще генерирам наново при следващото пускане (нови кредити в Suno).";
  } else if (deystvie === "otkaz") {
    ot = ["chaka_izbor", "chaka_izprashtane"];
    sql = "UPDATE odobrenia SET status='otkaz', updated_at=? WHERE order_no=? AND status IN ('chaka_izbor','chaka_izprashtane')";
    args = [nowIso, orderNo];
    kratko = "Оставена за ръчна обработка";
    belezhka = "✕ " + orderNo + ": автоматиката спира, поръчката остава за ръчна обработка.";
  } else if (deystvie === "spri") {
    ot = ["chaka_izprashtane"];
    sql = "UPDATE odobrenia SET status='spryana', updated_at=? WHERE order_no=? AND status='chaka_izprashtane'";
    args = [nowIso, orderNo];
    kratko = "Спряна, нищо не е пратено";
    belezhka = "⏸ " + orderNo + ": нищо не е пратено на клиента.";
  } else {
    return { ok: false, kratko: "Непознат бутон" };
  }

  const r = await db.prepare(sql).bind(...args).run();
  if (r.meta && r.meta.changes > 0) return { ok: true, kratko, belezhka };

  const red = await db.prepare("SELECT status FROM odobrenia WHERE order_no=?").bind(orderNo).first();
  if (!red) return { ok: false, kratko: "Няма такава поръчка в одобренията" };
  return { ok: false, kratko: "Вече е: " + (IMENA[red.status] || red.status) };
}

async function tg(env, metod, telo) {
  const r = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_TOKEN + "/" + metod, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(telo)
  });
  return r.json().catch(() => ({ ok: false }));
}

/* Оставя само бутоните с адрес (слушане), маха тези за избор — за да не се
   натисне два пъти. При ново натискане D1 и без това отказва. */
function samoAdresi(markup) {
  const redove = ((markup && markup.inline_keyboard) || [])
    .map(red => red.filter(b => b.url))
    .filter(red => red.length);
  return { inline_keyboard: redove };
}

/* ─────────────── Връчването (етап 3) ─────────────── */

const ORDER_RE = /^PSN-[0-9]{6}-[0-9]{4}$/;
const FAIL_RE = /^[a-z0-9-]{1,80}\.mp3$/;
const PROBA_RE = /^PSN-991231-[0-9]{4}$/;

function notifySpisak(env) {
  return String(env.NOTIFY_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

async function chetiPismo(env, orderNo) {
  const obj = await env.PESNI.get(orderNo + "/pismo.json");
  if (!obj) return { greshka: "няма pismo.json в R2" };
  let p;
  try { p = JSON.parse(await obj.text()); } catch (e) { return { greshka: "pismo.json не е валиден JSON" }; }
  if (!p || typeof p.to !== "string" || !p.to.includes("@")) return { greshka: "pismo.json: липсва получател" };
  if (!p.subject || !p.html) return { greshka: "pismo.json: липсва тема или html" };
  if (!Array.isArray(p.mp3) || !p.mp3.length) return { greshka: "pismo.json: няма MP3" };
  for (const f of p.mp3) {
    if (!f || !FAIL_RE.test(f.name || "") || f.key !== orderNo + "/" + f.name) return { greshka: "pismo.json: лошо име на MP3 (" + (f && f.name) + ")" };
    const h = await env.PESNI.head(f.key);
    if (!h) return { greshka: "липсва в R2: " + f.key };
    f.razmer = h.size;
  }
  return { p };
}

/* Получателят е този от плащането — писмо не тръгва към адрес, който не е платил
   за тази поръчка. Пробна поръчка — само към нас. */
async function proveriPoluchatel(env, orderNo, to) {
  const sale = await env.DB.prepare(
    "SELECT customer_email, delivered_at FROM sales WHERE order_no=? ORDER BY id LIMIT 1"
  ).bind(orderNo).first();
  const t = to.trim().toLowerCase();
  if (sale) {
    if (!sale.customer_email) return "в продажбата няма имейл на клиента";
    if (sale.customer_email.trim().toLowerCase() !== t) return "получателят в писмото (" + to + ") не е имейлът от плащането";
    return null;
  }
  if (PROBA_RE.test(orderNo) && notifySpisak(env).includes(t)) return null;
  return "няма продажба с този номер";
}

export async function pratiNaKlienta(env, orderNo, { signedToken }) {
  const sega = new Date().toISOString();
  /* Заключване: само един натиск минава от chaka_izprashtane към prashta. */
  const lock = await env.DB.prepare(
    "UPDATE odobrenia SET status='prashta', updated_at=? WHERE order_no=? AND status='chaka_izprashtane'"
  ).bind(sega, orderNo).run();
  if (!(lock.meta && lock.meta.changes > 0)) {
    const red = await env.DB.prepare("SELECT status FROM odobrenia WHERE order_no=?").bind(orderNo).first();
    return { ok: false, kratko: red ? "Вече е: " + (IMENA[red.status] || red.status) : "Няма такава поръчка в одобренията" };
  }
  const provali = async (prichina) => {
    await env.DB.prepare("UPDATE odobrenia SET status='greshka', greshka=?, updated_at=? WHERE order_no=?")
      .bind(prichina.slice(0, 500), new Date().toISOString(), orderNo).run();
    return { ok: false, kratko: "НЕ е пратено — " + prichina };
  };

  if (!env.BREVO_API_KEY || !env.AUDIT_TOKEN || !env.PUBLIC_BASE) return provali("липсва BREVO_API_KEY, AUDIT_TOKEN или PUBLIC_BASE");
  const { p, greshka } = await chetiPismo(env, orderNo);
  if (greshka) return provali(greshka);
  const zabrana = await proveriPoluchatel(env, orderNo, p.to);
  if (zabrana) return provali(zabrana);

  const prikacheni = [];
  for (const f of p.mp3) {
    const t = await signedToken("pesenfail", orderNo + "/" + f.name, env.AUDIT_TOKEN);
    prikacheni.push({ url: env.PUBLIC_BASE + "/pesen-fail/" + orderNo + "/" + f.name + "?t=" + t, name: f.name });
  }
  const skrito = notifySpisak(env).filter(a => a !== p.to.trim().toLowerCase()).map(email => ({ email }));
  const telo = {
    sender: { name: env.MAIL_SENDER_NAME || "Песента", email: env.MAIL_SENDER },
    replyTo: { email: env.MAIL_SENDER },
    to: [{ email: p.to.trim(), name: p.toName || undefined }],
    subject: p.subject,
    htmlContent: p.html,
    attachment: prikacheni,
    tags: ["dostavka"]
  };
  if (p.text) telo.textContent = p.text;
  if (skrito.length) telo.bcc = skrito;

  let messageId = "";
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify(telo)
    });
    const txt = await res.text();
    if (!res.ok) return provali("Brevo HTTP " + res.status + " " + txt.slice(0, 200));
    try { messageId = JSON.parse(txt).messageId || ""; } catch (e) { messageId = ""; }
  } catch (e) {
    return provali("Brevo: " + String(e && e.message || e));
  }

  const kraj = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE odobrenia SET status='izpratena', brevo_id=?, izprateno_at=?, page_url=COALESCE(?, page_url), greshka=NULL, updated_at=? WHERE order_no=?"
  ).bind(messageId, kraj, p.page_url || null, kraj, orderNo).run();
  await env.DB.prepare(
    "UPDATE sales SET delivered_at=?, page_url=COALESCE(page_url, ?) WHERE order_no=? AND delivered_at IS NULL"
  ).bind(kraj, p.page_url || null, orderNo).run();

  const mb = p.mp3.reduce((s, f) => s + (f.razmer || 0), 0) / 1048576;
  return {
    ok: true,
    kratko: "Пратено",
    belezhka: "✓ " + orderNo + ": пратено до " + p.to + " (" + p.mp3.map(f => f.name).join(", ") + ", " + mb.toFixed(1) +
      " MB). Brevo: " + (messageId || "без номер") + ". Отбелязана като доставена."
  };
}

/* Задачата на компютъра казва „готово за пращане“ → второто съобщение. */
export async function handleGotova(request, env, { timingSafeEqual, signedToken }) {
  const kl = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");  if (!env.ODOBRENIE_KEY || !timingSafeEqual(kl, env.ODOBRENIE_KEY)) return Response.json({ error: "забранено" }, { status: 403 });
  let telo; try { telo = await request.json(); } catch (e) { return Response.json({ error: "не е JSON" }, { status: 400 }); }
  const orderNo = String(telo && telo.order_no || "");
  if (!ORDER_RE.test(orderNo)) return Response.json({ error: "лош номер" }, { status: 400 });

  const red = await env.DB.prepare("SELECT status FROM odobrenia WHERE order_no=?").bind(orderNo).first();
  if (!red) return Response.json({ error: "няма ред в odobrenia" }, { status: 404 });
  if (red.status !== "izbrana" && red.status !== "spryana" && red.status !== "greshka") {
    return Response.json({ error: "състоянието е " + red.status }, { status: 409 });
  }
  const { p, greshka } = await chetiPismo(env, orderNo);
  if (greshka) return Response.json({ error: greshka }, { status: 422 });
  const zabrana = await proveriPoluchatel(env, orderNo, p.to);
  if (zabrana) return Response.json({ error: zabrana }, { status: 422 });

  const pregled = env.PUBLIC_BASE + "/pismo-pregled/" + orderNo + "?t=" + await signedToken("pismo", orderNo, env.AUDIT_TOKEN);
  const mb = p.mp3.reduce((s, f) => s + (f.razmer || 0), 0) / 1048576;
  const text = "📨 " + (PROBA_RE.test(orderNo) ? "🧪 ПРОБА · " : "") + orderNo + " е готова за пращане\n\n" +
    "До: " + (p.toName ? p.toName + " <" + p.to + ">" : p.to) + "\n" +
    "Тема: " + p.subject + "\n" +
    "Прикачено: " + p.mp3.map(f => f.name).join(", ") + " (" + mb.toFixed(1) + " MB)\n\n" +
    "Отвори прегледа и страницата. Писмото тръгва чак след „Изпрати“.";
  const bt = [[{ text: "👁 Преглед на писмото", url: pregled }]];
  if (p.page_url) bt.push([{ text: "🎵 Страницата на песента", url: p.page_url }]);
  bt.push([{ text: "✓ Изпрати на клиента", callback_data: "izprati:" + orderNo }, { text: "⏸ Спри", callback_data: "spri:" + orderNo }]);
  const r = await tg(env, "sendMessage", { chat_id: String(env.TELEGRAM_CHAT_ID), text, reply_markup: { inline_keyboard: bt } });
  if (!r.ok) return Response.json({ error: "Telegram: " + (r.description || "неуспех") }, { status: 502 });

  await env.DB.prepare(
    "UPDATE odobrenia SET status='chaka_izprashtane', tg_msg2=?, page_url=COALESCE(?, page_url), greshka=NULL, updated_at=? WHERE order_no=?"
  ).bind(r.result.message_id, p.page_url || null, new Date().toISOString(), orderNo).run();
  return Response.json({ ok: true, message_id: r.result.message_id });
}

/* MP3-то за Brevo (и за преглед) — с подпис в адреса, иначе 404. */
export async function handlePesenFail(request, env, orderNo, ime, { signedToken, timingSafeEqual }) {
  if (!env.AUDIT_TOKEN || !FAIL_RE.test(ime)) return new Response("Not found", { status: 404 });
  const t = new URL(request.url).searchParams.get("t") || "";
  const ok = await signedToken("pesenfail", orderNo + "/" + ime, env.AUDIT_TOKEN);
  if (!timingSafeEqual(t, ok)) return new Response("Not found", { status: 404 });
  const obj = await env.PESNI.get(orderNo + "/" + ime);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(obj.size),
      "Content-Disposition": "attachment; filename=\"" + ime + "\"",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

/* Прегледът на писмото — точно този html, който ще тръгне, с лента отгоре. */
export async function handlePismoPregled(request, env, orderNo, { signedToken, timingSafeEqual }) {
  if (!env.AUDIT_TOKEN) return new Response("Not found", { status: 404 });
  const t = new URL(request.url).searchParams.get("t") || "";
  if (!timingSafeEqual(t, await signedToken("pismo", orderNo, env.AUDIT_TOKEN))) return new Response("Not found", { status: 404 });
  const { p, greshka } = await chetiPismo(env, orderNo);
  if (greshka) return new Response(greshka, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const e = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const lenta = '<div style="font:14px/1.5 system-ui,sans-serif;background:#fff3cd;color:#222;padding:12px 16px;border-bottom:2px solid #d2577f">' +
    "<b>ПРЕГЛЕД — още не е пратено.</b><br>До: " + e(p.toName ? p.toName + " <" + p.to + ">" : p.to) +
    "<br>Тема: " + e(p.subject) + "<br>Прикачено: " + e(p.mp3.map(f => f.name).join(", ")) + "</div>";
  return new Response(lenta + p.html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" }
  });
}

/* ---------------- Бележка от Мирослав: отговор на съобщението на поръчката ----------------
   (28.11.2026) Текст или гласово като Reply на съобщение, в което стои номерът PSN-….
   Бележката се записва в odobrenia.belezhka и поръчката минава в „nanovo“; задачата на
   компютъра я чете при следващото генериране. Редовете са по опити: „[опит N] …“ —
   втора бележка за същия опит заменя първата (поправка на грешно чуто). */
const PSN_V_TEKST = /PSN-[0-9]{6}-[0-9]{4}/;
const BELEZHKA_MAX = 1500;
const GLAS_MAX_SEK = 180;
const GLAS_MODEL = "@cf/openai/whisper-large-v3-turbo";

export async function prilozhiBelezhka(db, orderNo, tekst, nowIso) {
  const chist = String(tekst || "").replace(/\s+/g, " ").trim().slice(0, BELEZHKA_MAX);
  if (!chist) return { ok: false, otgovor: "Празна бележка — нищо не записах." };
  const red = await db.prepare("SELECT status, opiti, belezhka FROM odobrenia WHERE order_no=?").bind(orderNo).first();
  if (!red) return { ok: false, otgovor: "Няма поръчка " + orderNo + " в одобренията." };
  if (red.status !== "chaka_izbor" && red.status !== "nanovo") {
    return { ok: false, otgovor: orderNo + " е „" + (IMENA[red.status] || red.status) + "“. Бележка приемам само докато чака избор на версия." };
  }
  const etiket = "[опит " + red.opiti + "] ";
  const redove = red.belezhka ? String(red.belezhka).split("\n") : [];
  if (redove.length && redove[redove.length - 1].startsWith(etiket)) redove.pop();
  redove.push(etiket + chist);
  const r = await db.prepare(
    "UPDATE odobrenia SET status='nanovo', belezhka=?, belezhka_at=?, updated_at=? WHERE order_no=? AND status IN ('chaka_izbor','nanovo')"
  ).bind(redove.join("\n"), nowIso, nowIso, orderNo).run();
  if (!(r.meta && r.meta.changes > 0)) return { ok: false, otgovor: orderNo + ": състоянието се смени междувременно, не записах." };
  return { ok: true, tekst: chist, opit: red.opiti };
}

async function glasVTekst(env, glas) {
  if (!env.AI) throw new Error("разпознаването на глас не е включено");
  if ((glas.duration || 0) > GLAS_MAX_SEK) throw new Error("гласовото е над " + (GLAS_MAX_SEK / 60) + " минути");
  const f = await tg(env, "getFile", { file_id: glas.file_id });
  if (!f.ok || !f.result || !f.result.file_path) throw new Error("не мога да взема файла от Telegram");
  const r = await fetch("https://api.telegram.org/file/bot" + env.TELEGRAM_TOKEN + "/" + f.result.file_path);
  if (!r.ok) throw new Error("файлът не се сваля (" + r.status + ")");
  const u8 = new Uint8Array(await r.arrayBuffer());
  const out = await env.AI.run(GLAS_MODEL, { audio: u8.toBase64(), language: "bg", task: "transcribe" });
  return String((out && out.text) || "").trim();
}

async function handleSaobshtenie(env, m) {
  const chat = m.chat.id;
  const kazhi = (text) => tg(env, "sendMessage", { chat_id: chat, text, reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true } });
  const otg = m.reply_to_message;
  const nomer = otg && PSN_V_TEKST.exec(String(otg.text || otg.caption || ""));
  const glas = m.voice || m.audio;
  if (!nomer || (!m.text && !glas)) {
    return kazhi("За бележка към песен: отговори (Reply) на съобщението на поръчката — с текст или с гласово. Иначе не знам за коя поръчка е.");
  }
  let tekst = m.text || "";
  if (glas) {
    try { tekst = await glasVTekst(env, glas); }
    catch (e) { return kazhi("⚠ Гласовото не стана: " + String(e && e.message || e) + ". Напиши го с текст."); }
    if (!tekst) return kazhi("⚠ Не разбрах нищо от гласовото. Опитай пак или го напиши.");
  }
  const rez = await prilozhiBelezhka(env.DB, nomer[0], tekst, new Date().toISOString());
  if (!rez.ok) return kazhi("⚠ " + rez.otgovor);
  return kazhi((glas ? "🎙 Чух: " : "📝 Записах: ") + "„" + rez.tekst + "“\n\n↻ " + nomer[0] +
    ": нови версии с тази бележка, тръгват след 2 минути (нови кредити в Suno). Ако съм разбрал грешно, отговори пак — важи последното.");
}

export async function handleTelegram(request, env, pom) {
  const { timingSafeEqual } = pom;
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET || !env.TELEGRAM_CHAT_ID) {
    return new Response("not configured", { status: 503 });
  }
  const tayna = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  if (!timingSafeEqual(tayna, env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const upd = await request.json();
    const moyChat = String(env.TELEGRAM_CHAT_ID);
    const cq = upd.callback_query;

    if (!cq) {
      const m = upd.message;
      if (m && String(m.chat && m.chat.id) === moyChat) {
        await handleSaobshtenie(env, m);
      }
      return new Response("ok");
    }

    if (String(cq.from && cq.from.id) !== moyChat) {
      await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Нямаш права." });
      return new Response("ok");
    }

    const m = DATA_RE.exec(cq.data || "");
    let rez;
    if (!m) rez = { ok: false, kratko: "Непознат бутон" };
    else if (m[1] === "izprati") {
      /* Отговорът на бутона идва веднага — пращането може да отнеме секунди. */
      await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Пращам…" });
      rez = await pratiNaKlienta(env, m[2], pom);
      rez.vecheOtgovoreno = true;
    } else rez = await prilozhi(env.DB, m[1], m[2], new Date().toISOString());

    if (!rez.vecheOtgovoreno) await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: rez.kratko });
    else if (!rez.ok && cq.message) {
      await tg(env, "sendMessage", {
        chat_id: cq.message.chat.id,
        text: "⚠ " + m[2] + ": " + rez.kratko,
        reply_parameters: { message_id: cq.message.message_id }
      });
    }
    if (rez.ok && cq.message) {
      await tg(env, "editMessageReplyMarkup", {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        reply_markup: samoAdresi(cq.message.reply_markup)
      });
      await tg(env, "sendMessage", {
        chat_id: cq.message.chat.id,
        text: rez.belezhka,
        reply_parameters: { message_id: cq.message.message_id }
      });
    }
  } catch (e) {
    console.log("telegram:", String(e && e.message || e));
  }
  return new Response("ok");
}
