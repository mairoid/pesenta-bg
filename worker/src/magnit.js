/* Безплатните гайдове срещу имейл — „магнитите“ (11.11.2026)
   ─────────────────────────────────────────────────────────────────────
   Целта е евтина проба кой повод вади хора, преди да се плаща за поръчки
   (THIRD BRAIN/agentura/magniti-pesenta-2026-11-11.md). Човекът оставя имейл
   на страницата, тук се записва и му тръгва писмо с връзка към PDF-а.

     POST /magnit — {email, magnit, marketing, ot}; text/plain JSON като /brief

   Защо писмото е само текст: HTML писмата от нас отиват в „Промоции“ (4 от 4),
   текстовите — в основната кутия. Гайдът, който не се вижда, е изгубен имейл.

   Защо PDF-ът е по връзка, а не прикачен: прикаченият файл прави писмото тежко
   и подозрително за филтрите, а Brevo пак трябва да го тегли от някъде.

   Съгласието за още писма е ОТДЕЛНО от гайда (GDPR, чл. 7): гайдът се праща
   и без отметката, а marketing = 1 само ако човекът я е сложил сам.
   IP-то не се пази — отпечатък с сол, както при ваучера и отказа.
   ───────────────────────────────────────────────────────────────────── */

import { ipHash, chetiTelo, vjson, EMAIL_RE } from "./vaucher.js";

/* Всеки магнит: заглавие за писмото и адресът на PDF-а. Ключът идва от
   страницата; непознат ключ = отказ, за да не се пълни базата с боклук. */
export const MAGNITI = {
  "koleda-9": {
    zaglavie: "9 подаръка за човек, който има всичко",
    pdf: "https://pesenta.bg/assets/magnit/9-podaraka-za-chovek-koyto-ima-vsichko.pdf"
  }
};

/* Един човек от един адрес не пуска повече от толкова за час — иначе формата
   става начин да се пращат наши писма до чужди адреси. */
export const MAGNIT_NA_CHAS = 5;
/* Повторно натискане със същия имейл в рамките на 10 минути не праща второ писмо. */
const POVTOR_MS = 10 * 60 * 1000;

const chist = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

export function proveriMagnit(telo) {
  if (!telo || typeof telo !== "object") return { ok: false, prichina: "nevaliden" };
  const email = chist(telo.email, 200).toLowerCase();
  const magnit = chist(telo.magnit, 40);
  if (!email || email.length > 120 || !EMAIL_RE.test(email)) return { ok: false, prichina: "email" };
  if (!MAGNITI[magnit]) return { ok: false, prichina: "magnit" };
  /* „От къде е дошъл“ — само пътят и utm-ите, без имейли и имена. */
  const ot = chist(telo.ot, 300).replace(/[@<>"']/g, "");
  return { ok: true, email, magnit, marketing: telo.marketing === true ? 1 : 0, ot: ot || null };
}

export function pismoMagnit(m) {
  const tekst = [
    "Здравей,",
    "",
    "ето гайда, който поиска: „" + m.zaglavie + "“.",
    m.pdf,
    "",
    "Малък съвет отгоре: каквото и да избереш, добави два реда на ръка. Точно те се помнят.",
    "",
    "Ако искаш подаръкът да е песен с неговото име и история, отговори на това писмо с няколко реда за човека и ще ти кажем как става. Или направо: https://pesenta.bg/poruchka.html?utm_source=email&utm_campaign=magnit-koleda",
    "",
    "Поздрави,",
    "Песента · pesenta.bg",
    "",
    "Получаваш това писмо, защото остави имейла си на pesenta.bg за гайда. Ако не искаш повече писма от нас, отговори с „отпиши ме“."
  ].join("\n");
  return { subject: "Твоят гайд: " + m.zaglavie, textContent: tekst };
}

export async function handleMagnit(request, env, ctx, deps) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== "https://pesenta.bg") return vjson({ ok: false, prichina: "proizhod" }, 403);

  const { telo, greshka } = await chetiTelo(request, 2000);
  if (greshka) return greshka;
  const p = proveriMagnit(telo);
  if (!p.ok) return vjson({ ok: false, prichina: p.prichina }, 400);

  const sega = new Date();
  const h = await ipHash(request, env);
  const chasNazad = new Date(sega.getTime() - 3600e3).toISOString();
  const broi = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM magnit_zapisi WHERE ip_hash = ? AND created_at > ?"
  ).bind(h, chasNazad).first();
  if (broi && broi.n >= MAGNIT_NA_CHAS) return vjson({ ok: false, prichina: "limit" }, 429);

  /* Двойно натискане или презареждане — тихо „готово“, без второ писмо. */
  const skoro = new Date(sega.getTime() - POVTOR_MS).toISOString();
  const imaSkoro = await env.DB.prepare(
    "SELECT id FROM magnit_zapisi WHERE email = ? AND magnit = ? AND created_at > ? AND pismo_at IS NOT NULL"
  ).bind(p.email, p.magnit, skoro).first();
  if (imaSkoro) return vjson({ ok: true, povtor: true });

  /* Първо записът: имейлът не бива да се губи, дори Brevo да откаже. */
  const zapis = await env.DB.prepare(
    "INSERT INTO magnit_zapisi (magnit, email, marketing, ip_hash, ot, created_at) VALUES (?,?,?,?,?,?) RETURNING id"
  ).bind(p.magnit, p.email, p.marketing, h, p.ot, sega.toISOString()).first();

  const m = MAGNITI[p.magnit];
  const pismo = pismoMagnit(m);
  const rez = env.BREVO_API_KEY && env.MAIL_SENDER
    ? await deps.brevo(env, {
        sender: { name: env.MAIL_SENDER_NAME || "Песента", email: env.MAIL_SENDER },
        replyTo: { email: env.MAIL_SENDER },
        to: [{ email: p.email }],
        subject: pismo.subject,
        textContent: pismo.textContent,
        tags: ["magnit", p.magnit]
      })
    : { ok: false, error: "липсва BREVO_API_KEY или MAIL_SENDER" };

  await env.DB.prepare("UPDATE magnit_zapisi SET pismo_at = ?, pismo_greshka = ? WHERE id = ?")
    .bind(rez.ok ? new Date().toISOString() : null, rez.ok ? null : String(rez.error).slice(0, 300), zapis.id).run();

  /* Страницата казва истината: ако писмото не е тръгнало, показва връзката направо. */
  return vjson(rez.ok ? { ok: true } : { ok: false, prichina: "pismo", pdf: m.pdf }, rez.ok ? 200 : 502);
}
