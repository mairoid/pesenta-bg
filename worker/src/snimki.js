/* Снимките за обложката — POST /snimki (20.10.2026)
   ─────────────────────────────────────────────────────────────────────
   Досега снимките пътуваха само през FormSubmit, с обикновен (no-cors) POST.
   FormSubmit разпознава формата по заглавката Referer; без нея връща страница
   „Make sure you open this page through a web server“ — с код 200, тоест
   сайтът не разбира, че нищо не е стигнало. Вграденият браузър на ChatGPT не
   праща Referer: и трите поръчки със снимки, дошли от chatgpt.com (29.09,
   PSN-261006-1422, PSN-261018-5637), останаха без снимки, а всички от „/“ — с тях.

   Тук снимките идват направо при нас (CORS, с истински отговор) и тръгват към
   NOTIFY_EMAILS като прикачени файлове през Brevo. До 28.11.2026 нищо не се
   пазеше и писмото беше единственото копие; оттогава всяка снимка се записва
   и в R2 (кофа SNIMKI, ключ PSN-…/snimka-PSN-…-N.jpg) преди писмото.

   Пази се от злоупотреба: само PSN-номер, само JPEG (по първите байтове, не по
   името), най-много SNIMKI_BROI файла и SNIMKI_MAX_BAJTA общо на заявка, до NA_CHAS заявки на час от IP.

   04.11.2026: до SNIMKI_NOMER_MAX (30) снимки на поръчка — сайтът ги праща на групи до 5
   (полетата носят общия номер: snimka_6…snimka_10), всяка група е отделно писмо с
   „(6–10 от 30)“ в темата. Base64 — с вградения Uint8Array.toBase64(): проба 04.11 на
   временен Worker — 5 снимки по 500 KB струваха 5–9 ms CPU срещу 20–36 ms с JS цикъла. */

import { ipHash } from "./vaucher.js";

export const SNIMKI_BROI = 5;        // на заявка (= на писмо)
export const SNIMKI_NOMER_MAX = 30;  // на поръчка — полетата snimka_1…snimka_30
/* Сайтът ги смалява до 1600 px, JPEG 0,85 — обикновено 200–700 KB една. */
export const SNIMKI_MAX_BAJTA = 6 * 1024 * 1024;
export const NA_CHAS = 30; // 30 снимки = 6–9 заявки; остава място за повторен опит

function sjson(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

/* JPEG започва с FF D8 FF. Сайтът праща само JPEG (canvas.toBlob „image/jpeg“). */
export function eJpeg(u8) {
  return u8 && u8.length > 3 && u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF;
}

function base64(u8) {
  if (typeof u8.toBase64 === "function") return u8.toBase64();
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

async function vLimitaSnimki(request, env) {
  const chas = new Date().toISOString().slice(0, 13);
  const h = "snimki:" + (await ipHash(request, env));
  const r = await env.DB.prepare(
    `INSERT INTO vaucher_opiti (ip_hash, chas, broi) VALUES (?,?,1)
     ON CONFLICT(ip_hash, chas) DO UPDATE SET broi = broi + 1 RETURNING broi`
  ).bind(h, chas).first();
  return !r || r.broi <= NA_CHAS;
}

export async function handleSnimki(request, env, deps) {
  const dalzhina = parseInt(request.headers.get("content-length") || "0", 10);
  if (dalzhina > SNIMKI_MAX_BAJTA + 64 * 1024) return sjson({ ok: false, prichina: "golyamo" }, 413);
  if (!/^multipart\/form-data/i.test(request.headers.get("content-type") || "")) {
    return sjson({ ok: false, prichina: "nevaliden" }, 400);
  }

  let fd;
  try { fd = await request.formData(); } catch (e) { return sjson({ ok: false, prichina: "nevaliden" }, 400); }

  const orderNo = String(fd.get("order_no") || "");
  if (!/^PSN-[0-9]{6}-[0-9]{4}$/.test(orderNo)) return sjson({ ok: false, prichina: "nomer" }, 400);

  const failove = [];
  let obshto = 0;
  for (let i = 1; i <= SNIMKI_NOMER_MAX; i++) {
    const f = fd.get("snimka_" + i);
    if (!f || typeof f === "string") continue;
    if (failove.length >= SNIMKI_BROI) return sjson({ ok: false, prichina: "mnogo" }, 400);
    const u8 = new Uint8Array(await f.arrayBuffer());
    if (!eJpeg(u8)) return sjson({ ok: false, prichina: "ne_e_jpeg" }, 415);
    obshto += u8.length;
    if (obshto > SNIMKI_MAX_BAJTA) return sjson({ ok: false, prichina: "golyamo" }, 413);
    failove.push({ name: "snimka-" + orderNo + "-" + i + ".jpg", u8: u8, content: base64(u8), kb: Math.round(u8.length / 1024), nomer: i });
  }
  if (!failove.length) return sjson({ ok: false, prichina: "nyama_snimki" }, 400);

  if (!(await vLimitaSnimki(request, env))) return sjson({ ok: false, prichina: "mnogo_opiti" }, 429);

  /* 28.11.2026: първо в R2 (кофа SNIMKI), после писмото. На 27.11 писмото със
     снимката за PSN-261127-8627 се изгуби по пътя sales@ → Gmail и друго копие
     нямаше. Запазят ли се тук, клиентът получава „ок“ и без писмо. */
  let zapazeni = false;
  if (env.SNIMKI) {
    try {
      await Promise.all(failove.map((f) => env.SNIMKI.put(orderNo + "/" + f.name, f.u8, {
        httpMetadata: { contentType: "image/jpeg" }
      })));
      zapazeni = true;
    } catch (e) { zapazeni = false; }
  }
  const spisak = zapazeni && deps && deps.snimkiUrl ? await deps.snimkiUrl(env, orderNo) : null;

  if (!env.BREVO_API_KEY || !env.MAIL_SENDER) {
    return zapazeni ? sjson({ ok: true, broi: failove.length, pismo: false }) : sjson({ ok: false, prichina: "pismo" }, 503);
  }
  const poluchateli = String(env.NOTIFY_EMAILS || env.MAIL_SENDER)
    .split(",").map((a) => a.trim()).filter(Boolean).map((a) => ({ email: a }));

  const tip = String(fd.get("tip") || "бърза").slice(0, 40);
  /* Част от повече писма → „(6–10 от 30)“ в темата и в текста. */
  const vsichko = parseInt(String(fd.get("obshto") || ""), 10);
  const nomera = failove.map((f) => f.nomer);
  const chast = vsichko > failove.length && vsichko <= SNIMKI_NOMER_MAX
    ? " (" + (nomera.length > 1 ? nomera[0] + "–" + nomera[nomera.length - 1] : nomera[0]) + " от " + vsichko + ")" : "";
  const html =
    "<p>Снимки за обложката към поръчка <strong>" + orderNo + "</strong>" + chast + " (" + tip.replace(/[<>&"]/g, "") + " форма).</p>" +
    "<ul>" + failove.map((f) => "<li>" + f.name + " — " + f.kb + " KB</li>").join("") + "</ul>" +
    (spisak ? "<p>Копие на сървъра: <a href=\"" + spisak + "\">всички снимки към " + orderNo + "</a></p>" : "") +
    "<p style=\"color:#666\">Дошли през Worker-а (/snimki), не през FormSubmit.</p>";

  let res;
  try {
    res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        sender: { name: env.MAIL_SENDER_NAME || "Песента", email: env.MAIL_SENDER },
        to: poluchateli,
        subject: "Снимки за обложката — " + orderNo + chast,
        htmlContent: html,
        attachment: failove.map((f) => ({ name: f.name, content: f.content }))
      })
    });
  } catch (e) {
    return zapazeni ? sjson({ ok: true, broi: failove.length, pismo: false }) : sjson({ ok: false, prichina: "pismo" }, 502);
  }
  if (!res.ok) {
    return zapazeni ? sjson({ ok: true, broi: failove.length, pismo: false })
                    : sjson({ ok: false, prichina: "pismo", brevo: res.status }, 502);
  }
  return sjson({ ok: true, broi: failove.length });
}

/* GET /snimki/PSN-…?t=…            — страница със запазените снимки към поръчката
   GET /snimki/PSN-…/snimka-…jpg?t=… — самият файл
   Подписът е като при бележката (signedToken „snimki“), различен за всяка поръчка. */
export async function handleSnimkiPregled(request, env, orderNo, fail, deps) {
  const noindex = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };
  if (!env.AUDIT_TOKEN) return new Response("AUDIT_TOKEN не е зададен", { status: 500 });
  if (!env.SNIMKI) return new Response("Кофата за снимки не е вързана", { status: 500 });
  const given = new URL(request.url).searchParams.get("t") || "";
  const want = await deps.signedToken("snimki", orderNo, env.AUDIT_TOKEN);
  if (!deps.timingSafeEqual(given, want)) return new Response("Забранено", { status: 403 });

  if (fail) {
    const o = await env.SNIMKI.get(orderNo + "/" + fail);
    if (!o) return new Response("Няма такава снимка", { status: 404 });
    return new Response(o.body, {
      headers: Object.assign({ "Content-Type": "image/jpeg", "Content-Disposition": "inline; filename=\"" + fail + "\"" }, noindex)
    });
  }

  const l = await env.SNIMKI.list({ prefix: orderNo + "/" });
  const imena = l.objects.map((o) => o.key.slice(orderNo.length + 1))
    .sort((a, b) => parseInt(a.replace(/^.*-(\d+)\.jpg$/, "$1"), 10) - parseInt(b.replace(/^.*-(\d+)\.jpg$/, "$1"), 10));
  const html = "<!doctype html><html lang=\"bg\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>Снимки — " + orderNo + "</title>" +
    "<body style=\"font-family:Arial,sans-serif;margin:24px;color:#111\"><h1 style=\"font-size:20px\">Снимки към " + orderNo + " (" + imena.length + ")</h1>" +
    (imena.length ? imena.map((n) => {
      const u = "/snimki/" + orderNo + "/" + n + "?t=" + want;
      return "<p><a href=\"" + u + "\" download=\"" + n + "\">" + n + "</a><br><img src=\"" + u + "\" alt=\"\" style=\"max-width:480px;width:100%;height:auto;margin-top:6px\"></p>";
    }).join("") : "<p>Към тази поръчка няма запазени снимки.</p>") +
    "</body></html>";
  return new Response(html, { headers: Object.assign({ "Content-Type": "text/html; charset=utf-8" }, noindex) });
}
