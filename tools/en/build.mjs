/* Английската версия на сайта (13.10.2026) — генерира en/*.html.
   ------------------------------------------------------------------
   Защо генератор, а не ръчно писани страници като българските: 40 страници с
   един и същ хедър, подвал и hreflang ред се разминават при първата ръчна
   поправка. Тук общото е на едно място, а съдържанието е в данни.

   Пуска се:  node tools/en/build.mjs
   Пипа САМО en/. Българските страници не се пипат оттук — техните hreflang
   редове и превключвателят „EN“ ги слага tools/en/hreflang-bg.mjs.

   Съдържанието е в:
     povodi.mjs   — страниците за повод / за кого / празници
     nachalo.mjs  — началната страница (en/index.html)
     pravni.mjs   — About, Terms, Privacy, Thank you

   Цената, имейлът и телефонът са константи тук — смени ли се цената, сменя се
   на едно място и за 40-те страници. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POVODI, GRUPI } from "./povodi.mjs";
import { nachalo } from "./nachalo.mjs";
import { PRAVNI } from "./pravni.mjs";
import { CENA, EMAIL, esc, enUrl, bgUrl, demoRed, bezTagove, DEMO_EN } from "./obshto.mjs";
import crypto from "node:crypto";

const TUK = path.dirname(fileURLToPath(import.meta.url));
const KOREN = path.resolve(TUK, "../..");
const IZHOD = path.join(KOREN, "en");
const SAIT = "https://pesenta.bg";

/* ---------- Глава ---------- */
function glava(p) {
  const en = enUrl(p.file);
  const alt = p.bg
    ? `  <link rel="alternate" hreflang="en" href="${en}">
  <link rel="alternate" hreflang="bg" href="${bgUrl(p.bg)}">
  <link rel="alternate" hreflang="x-default" href="${en}">`
    : `  <link rel="alternate" hreflang="en" href="${en}">`;
  const ld = (p.ld || []).map((o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script>document.documentElement.classList.add("js");setTimeout(function(){if(!window.__reveal)document.documentElement.classList.remove("js")},4000)</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
  <meta name="theme-color" content="#0b0a1a">
  <meta name="application-name" content="Pesenta">
  <meta name="apple-mobile-web-app-title" content="Pesenta">
  <title>${esc(p.title)}</title>
  <meta name="description" content="${esc(p.desc)}">
  <link rel="canonical" href="${en}">
${alt}
  <link rel="icon" type="image/svg+xml" href="../assets/img/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/img/favicon-32.png">
  <link rel="apple-touch-icon" href="../assets/img/apple-touch-icon.png">
${p.noindex ? '  <meta name="robots" content="noindex">\n' : ""}
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_GB">
  <meta property="og:locale:alternate" content="bg_BG">
  <meta property="og:site_name" content="Pesenta">
  <meta property="og:title" content="${esc(p.title)}">
  <meta property="og:description" content="${esc(p.desc)}">
  <meta property="og:url" content="${en}">
  <meta property="og:image" content="${SAIT}/assets/img/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(p.title)}">
  <meta name="twitter:description" content="${esc(p.desc)}">
  <meta name="twitter:image" content="${SAIT}/assets/img/og-image.jpg">

  <!-- Само латинските подмножества: на английската страница кирилица почти
       няма, а fonts.css тегли кирилските сам, ако потрябват (unicode-range). -->
  <link rel="preload" href="../assets/fonts/unbounded-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../assets/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../assets/css/fonts.css">
  <link rel="stylesheet" href="../assets/css/style.css">
${ld}
  <script type="module" src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "902a1340b733442da0ef0ebfe90903dc"}'></script>
</head>
<body>
${p.noti ? '  <canvas id="noti-bg" aria-hidden="true"></canvas>\n' : ""}  <a class="skip-link" href="#main">Skip to content</a>
`;
}

/* ---------- Хедър ----------
   Началната има пълното меню; вътрешните — само „Home“, езика и поръчката,
   както и българските вътрешни страници. */
function hedar(p) {
  const bgLink = `<a class="lang-switch" href="../${p.bg && p.bg !== "index.html" ? p.bg : ""}" hreflang="bg" lang="bg" aria-label="На български">BG</a>`;
  if (p.file === "index.html") {
    return `<header class="site-header">
  <div class="container header-in">
    <a class="logo" href="./" aria-label="Pesenta — home">
      <img src="../assets/img/logo-en.svg" alt="Pesenta — custom songs" width="190" height="44">
    </a>
    <button class="nav-toggle" aria-label="Menu" aria-expanded="false">☰</button>
    <nav class="main-nav" aria-label="Main navigation">
      <a href="#demo">Samples</a>
      <a href="#povodi">Occasions</a>
      <a href="#kak-raboti">How it works</a>
      <a href="#ceni">Pricing</a>
      <a href="#vaprosi">FAQ</a>
      ${bgLink}
      <a class="btn btn-primary" href="#order">Order a song</a>
    </nav>
  </div>
</header>
`;
  }
  return `<header class="site-header">
  <div class="container header-in">
    <a class="logo" href="./" aria-label="Pesenta — home">
      <img src="../assets/img/logo-en.svg" alt="Pesenta — custom songs" width="190" height="44">
    </a>
    <nav class="main-nav open" aria-label="Main navigation" style="display:flex;position:static;padding:0;background:none;border:none;box-shadow:none;">
      <a href="./">Home</a>
      ${bgLink}
      <a class="btn btn-primary" href="${p.poruchka || "./#order"}">Order a song</a>
    </nav>
  </div>
</header>
`;
}

/* ---------- Подвал ---------- */
const SOCIAL = fs.readFileSync(path.join(TUK, "social.html"), "utf8").trim();

function podval() {
  const kolona = (ime, grupa) => {
    const spisak = POVODI.filter((x) => x.grupa === grupa);
    return `      <div class="footer-col">
        <details class="footer-fold">
          <summary>${ime} <span class="n">(${spisak.length})</span><span class="arrow" aria-hidden="true">▾</span></summary>
          <div class="footer-links">
${spisak.map((x) => `            <a href="${x.file}">${esc(x.menu)}</a>`).join("\n")}
          </div>
        </details>
      </div>`;
  };
  return `<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col" style="max-width: 320px;">
        <img src="../assets/img/logo-en.svg" alt="Pesenta" width="160" style="margin-bottom: 1rem;">
        <p>Custom songs for every occasion. Your story, our music.</p>
        <div class="footer-social">
${SOCIAL}
        </div>
      </div>
      <div class="footer-col">
        <details class="footer-fold">
          <summary>Explore <span class="n">(6)</span><span class="arrow" aria-hidden="true">▾</span></summary>
          <div class="footer-links">
            <a href="./#kak-raboti">How it works</a>
            <a href="./#demo">Song samples</a>
            <a href="./#ceni">Pricing</a>
            <a href="about.html">About us</a>
            <a href="last-minute-gift.html">Last-minute gift</a>
            <a href="./#order">Order a song</a>
          </div>
        </details>
      </div>
${GRUPI.map((g) => kolona(g.ime, g.kod)).join("\n")}
      <div class="footer-col">
        <details class="footer-fold">
          <summary>Contact <span class="n">(4)</span><span class="arrow" aria-hidden="true">▾</span></summary>
          <div class="footer-links">
            <a href="mailto:${EMAIL}">${EMAIL}</a>
            <a href="terms.html">Terms</a>
            <a href="privacy.html">Privacy</a>
            <a href="../" hreflang="bg" lang="bg">На български</a>
          </div>
        </details>
      </div>
    </div>
    <div class="footer-bottom">
      © <span id="year">2026</span> Pesenta.bg — BAUFIZIK EOOD („БАУФИЗИК“ ЕООД), company no. 207427793, Veliko Tarnovo, Bulgaria. All rights reserved. No tracking cookies.
    </div>
  </div>
</footer>
`;
}

const PLAVASHT = `<a class="float-contact float-contact--mobile" href="mailto:${EMAIL}" aria-label="Email us">
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
</a>
<a class="float-contact float-contact--desktop" href="mailto:${EMAIL}" aria-label="Email us">
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
</a>`;

/* ?v= с първите 8 знака от SHA на файла — като в pesni/: сменен скрипт под
   същото име иначе стои стар в кеша на браузъра. */
function v(ime) {
  const f = path.join(KOREN, "assets/js", ime);
  return crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 8);
}

function stranica(p) {
  const skriptove = (p.scripts || ["main.js"]).map((s) => `<script src="../assets/js/${s}?v=${v(s)}" defer></script>`).join("\n");
  return glava(p) + hedar(p) + `\n<main id="main"${p.mainClass ? ` class="${p.mainClass}"` : ""}>\n${p.body}\n</main>\n\n` +
    podval() + "\n" + skriptove + "\n" + (p.inline || "") + PLAVASHT + "\n</body>\n</html>\n";
}

/* ---------- Страница за повод ---------- */
const OBSHTI_FAQ = [
  ["Can the song be in English?", "Yes. We write songs in English, Bulgarian, German, French, Italian, Spanish, Greek, Serbian, Macedonian, Romanian, Turkish, Russian, Ukrainian and Arabic — or a mix. Pick the language in the order form."],
  ["How fast will I get it?", "Within 24 hours of payment you get the MP3 and the lyrics by email. If you need it sooner, write to " + EMAIL + " before you pay — when we can, it's ready the same day."]
];

function povodStranica(x) {
  const poruchka = "./" + (x.chip ? "?povod=" + encodeURIComponent(x.chip) : "") + "#order";
  const vsichkiFaq = x.faq.concat(OBSHTI_FAQ);
  const svarzani = (x.related || []).map((k) => POVODI.find((y) => y.key === k)).filter(Boolean);
  const ld = [
    {
      "@context": "https://schema.org", "@type": "Service",
      serviceType: "Custom song gift", name: bezTagove(x.h1), description: x.desc,
      provider: { "@type": "Organization", name: "Pesenta", url: SAIT + "/en/", email: EMAIL },
      areaServed: "Worldwide", inLanguage: "en",
      offers: { "@type": "Offer", price: "19.90", priceCurrency: "EUR", url: enUrl("index.html") + "#order", availability: "https://schema.org/InStock" }
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: enUrl("index.html") },
        { "@type": "ListItem", position: 2, name: bezTagove(x.h1) }
      ]
    },
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: vsichkiFaq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: bezTagove(a) } }))
    }
  ];
  const body = `  <article class="article" style="padding-bottom:0;">
    <span class="kicker">${esc(x.kicker)}</span>
    <h1>${x.h1}</h1>
    <p class="nakratko"><strong>In short:</strong> ${x.short}</p>

${x.paras.map((t) => `    <p>${t}</p>`).join("\n\n")}

    <div class="article-cta">
      <p><strong>${x.ctaLine}</strong></p>
      <a class="btn btn-primary" href="${poruchka}">${esc(x.ctaBtn || "Order your song")} — ${CENA}</a>
    </div>
  </article>

  <section class="section" id="demo">
    <div class="container">
      <div class="section-head reveal">
        <span class="kicker">Listen first</span>
        <h2>Songs we made for real people</h2>
        <p>Each one was written for someone's real story — three in Italian, Turkish and Arabic, one in Bulgarian. Yours can be in English or in any of 13 other languages.</p>
      </div>
      <div class="tracks-list">
${DEMO_EN.map((k) => demoRed(k)).join("\n")}
      </div>
    </div>
  </section>

  <section class="section" id="vaprosi">
    <div class="container">
      <div class="section-head reveal">
        <span class="kicker">Ask away</span>
        <h2>Frequently asked questions</h2>
      </div>
      <div class="faq-list reveal">
${vsichkiFaq.map(([q, a]) => `        <details class="faq-item">
          <summary>${esc(q)}</summary>
          <div class="faq-body">${a}</div>
        </details>`).join("\n")}
      </div>
    </div>
  </section>
${svarzani.length ? `
  <section class="section svarzani" id="svarzani">
    <div class="container">
      <div class="section-head">
        <h2>More occasions</h2>
      </div>
      <ul class="svarzani-list">
${svarzani.map((y) => `        <li><a href="${y.file}">${esc(y.menu)}</a> <span>— ${esc(y.teaser)}</span></li>`).join("\n")}
      </ul>
    </div>
  </section>
` : ""}
  <section class="section">
    <div class="container">
      <div class="cta-band reveal">
        <h2>${esc(x.bandH || "Give a gift nobody else can give")}</h2>
        <p>${esc(x.bandP || "Flowers fade and vouchers expire. A song with their name in it stays.")}</p>
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
          <a class="btn btn-primary btn-lg" href="${poruchka}">Order now — ${CENA}</a>
          <a class="btn btn-ghost btn-lg" href="./#povodi">All occasions</a>
        </div>
      </div>
    </div>
  </section>`;
  return stranica({ ...x, ld, body, poruchka });
}

/* ---------- Пускане ---------- */
fs.mkdirSync(IZHOD, { recursive: true });
/* Какво имаше преди пускането — за lastmod в sitemap-а: сменя се само на
   страниците, чийто HTML наистина се е променил. */
const predniVersii = new Map(fs.readdirSync(IZHOD).filter((f) => f.endsWith(".html"))
  .map((f) => [f, fs.readFileSync(path.join(IZHOD, f), "utf8")]));
const napraveni = [];
function zapishi(file, html) {
  fs.writeFileSync(path.join(IZHOD, file), html);
  napraveni.push(file);
}

zapishi("index.html", stranica(nachalo()));
for (const x of PRAVNI()) zapishi(x.file, stranica(x));
for (const x of POVODI) zapishi(x.file, povodStranica(x));

/* Карта за hreflang-bg.mjs и за sitemap-а: кой английски файл на кой български
   съответства. Пише се от тук, за да не се поддържа на две места. */
const karta = [{ en: "index.html", bg: "index.html" }]
  .concat(PRAVNI().filter((x) => !x.noindex).map((x) => ({ en: x.file, bg: x.bg || null })))
  .concat(POVODI.map((x) => ({ en: x.file, bg: x.bg || null })));
fs.writeFileSync(path.join(TUK, "karta.json"), JSON.stringify(karta, null, 2) + "\n");

/* sitemap.xml: английските адреси стоят между двата маркера и се подменят
   изцяло при всяко пускане. lastmod е датата на файла в git, ако го има там,
   иначе днешната — за да не „остарява“ цялата група при всяко пускане. */
const smPath = path.join(KOREN, "sitemap.xml");
let sm = fs.readFileSync(smPath, "utf8");
const dnes = new Date().toISOString().slice(0, 10);
const staro = new Map([...sm.matchAll(/<loc>(https:\/\/pesenta\.bg\/en\/[^<]*)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));
const prioritet = (f) => f === "index.html" ? "0.9" : (f === "terms.html" || f === "privacy.html") ? "0.3" : f === "about.html" ? "0.5" : "0.7";
const redove = karta.map((x) => {
  const u = enUrl(x.en);
  const html = fs.readFileSync(path.join(IZHOD, x.en), "utf8");
  const promenen = !staro.has(u) || staro.get(u) === dnes || predniVersii.get(x.en) !== html;
  return `  <url>
    <loc>${u}</loc>
    <lastmod>${promenen ? dnes : staro.get(u)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${prioritet(x.en)}</priority>
  </url>`;
});
const blok = `  <!-- EN:SITEMAP — английската версия (en/), пише я tools/en/build.mjs; не пипай на ръка -->\n${redove.join("\n")}\n  <!-- /EN:SITEMAP -->\n`;
sm = sm.replace(/  <!-- EN:SITEMAP[\s\S]*?<!-- \/EN:SITEMAP -->\n/, "");
sm = sm.replace("</urlset>", blok + "</urlset>");
fs.writeFileSync(smPath, sm);

/* llms.txt: английски раздел накрая — за AI търсачките, които питат на
   английски. Също между маркери, подменя се цял. */
const llmsPath = path.join(KOREN, "llms.txt");
let llms = fs.readFileSync(llmsPath, "utf8").replace(/\n?<!-- EN:LLMS -->[\s\S]*?<!-- \/EN:LLMS -->\n?/, "");
const red = (x) => `- [${x.menu}](${enUrl(x.file)}): ${x.short.replace(/<[^>]+>/g, "").replace(/^a /, "A ")}`;
const enBlok = `
<!-- EN:LLMS -->
## English version

> Pesenta (pesenta.bg/en/) writes personalised custom songs as gifts, for customers worldwide: original lyrics and music from the customer's story, ${CENA}, delivered by email within 24 hours, in English or 13 other languages.

- Price: ${CENA} per song, paid by card via Stripe when ordering; Stripe may show the price in the customer's local currency.
- Delivery: MP3 and lyrics by email within 24 hours, plus a personal song page; one free revision.
- Languages: English, Bulgarian, German, French, Italian, Spanish, Greek, Serbian, Macedonian, Romanian, Turkish, Russian, Ukrainian, Arabic, or a mix.
- Made to order, so the 14-day right of withdrawal does not apply (Art. 16(m) of Directive 2011/83/EU); full refund if not delivered.
- Seller: BAUFIZIK EOOD, company no. 207427793, Veliko Tarnovo, Bulgaria. Email ${EMAIL}.

### Main pages
- [Home and order form](${enUrl("index.html")}): How it works, song samples, price, FAQ and the order form.
- [About us](${enUrl("about.html")}): Who makes the songs and how.
- [Terms](${enUrl("terms.html")}), [Privacy](${enUrl("privacy.html")}).

### Songs by occasion
${POVODI.filter((x) => x.grupa === "occasion" || x.grupa === "extra").map(red).join("\n")}

### Songs by person
${POVODI.filter((x) => x.grupa === "person").map(red).join("\n")}

### Holidays
${POVODI.filter((x) => x.grupa === "holiday").map(red).join("\n")}
<!-- /EN:LLMS -->
`;
fs.writeFileSync(llmsPath, llms.replace(/\s*$/, "\n") + enBlok);

console.log("en/: " + napraveni.length + " страници, в sitemap: " + redove.length);
