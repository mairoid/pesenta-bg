/* About, Terms, Privacy, Thank you — английските версии (13.10.2026).
   ------------------------------------------------------------------
   Terms и Privacy са ПРЕВОД на usloviya.html и poveritelnost.html. Те НЕ четат
   legal-config.js (той е на български) — затова при промяна на обработващ,
   срок или дата в legal-config.js тук се сменя на ръка. Пише го и в самите
   страници като коментар. Преводът е за преглед от юрист преди да се разчита
   на него. */
import { CENA, EMAIL, esc } from "./obshto.mjs";

const FIRMA = "BAUFIZIK EOOD („БАУФИЗИК“ ЕООД)";
const ADRES = "39 Tsanko Tserkovski St., office 214, 5000 Veliko Tarnovo, Bulgaria";
const EIK = "207427793";
const UPRAVITEL = "Avram Rusev Avramov";

const legal = (h, s) => `  <h1>${h}</h1>
${s}`;

export function PRAVNI() {
  return [
    /* ---------- About ---------- */
    {
      file: "about.html", bg: "za-nas.html",
      title: "About Pesenta — Who Makes the Songs",
      desc: "Pesenta is a small Bulgarian custom-song studio run by Miro from Veliko Tarnovo. Over 50 songs written from real stories, €19.90, ready within 24 hours.",
      ld: [{
        "@context": "https://schema.org", "@type": "AboutPage", name: "About Pesenta", inLanguage: "en",
        about: { "@id": "https://pesenta.bg/#org" }
      }],
      body: `  <article class="article" style="padding-bottom:0;">
    <span class="kicker">From friends, for friends</span>
    <h1>About us: who makes the songs</h1>
    <p class="nakratko"><strong>In short:</strong> Pesenta (pesenta.bg) is a Bulgarian custom-song service operated by ${esc(FIRMA)} from Veliko Tarnovo. We write a song from the story you tell us — original lyrics and music, ${CENA}, ready within 24 hours, in English, Bulgarian or 12 other languages. So far we've made more than 50 songs.</p>

    <h2>How it started</h2>
    <p>Pesenta started as a gift between friends: songs for birthdays, bachelor parties and weddings of people we know. Some of them are on the home page — “For You, Brother Vladi”, “Habibi Rusi”, “Rosen Abi”. They aren't samples made for a website; they're presents that were actually given. The website grew out of them.</p>

    <h2>Who's behind it</h2>
    <p>Behind Pesenta is Miro from Veliko Tarnovo, Bulgaria. He reads every story, makes sure the lyrics sound like the person they're about rather than a greeting card, and listens to every song before it goes out to you. If a name is sung wrong, the song gets redone.</p>

    <h2>How a song is made</h2>
    <ol>
      <li><strong>You tell us.</strong> In the form you write about the person and the occasion — who they are, how you met, what makes them laugh. About five minutes.</li>
      <li><strong>We write the lyrics.</strong> From your details: names, nicknames, inside jokes. Nothing is invented — if something's missing, it doesn't go in.</li>
      <li><strong>We make the music.</strong> In the style you picked — from a ballad to Balkan brass — using digital music production tools.</li>
      <li><strong>We listen and fix.</strong> Pronunciation, names and stresses are checked by ear.</li>
      <li><strong>You get the song.</strong> Within 24 hours: the MP3 and the lyrics by email, plus a personal song page with a cover illustration. One revision is free.</li>
    </ol>

    <h2>The company</h2>
    <p>${esc(FIRMA)}, company no. ${EIK}, ${esc(ADRES)}; managing director Eng. Avram Avramov. Pesenta.bg is a registered online shop; after every payment you receive an electronic sales receipt by email.</p>
    <p>Write to us at <a href="mailto:${EMAIL}">${EMAIL}</a>. The order conditions are in our <a href="terms.html">Terms</a>.</p>
  </article>

  <section class="section">
    <div class="container">
      <div class="cta-band reveal">
        <h2>Got a story? We've got a melody.</h2>
        <p>Five minutes for the story, up to 24 hours for the song.</p>
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
          <a class="btn btn-primary btn-lg" href="./#order">Order a song — ${CENA}</a>
          <a class="btn btn-ghost btn-lg" href="./#demo">Hear samples</a>
        </div>
      </div>
    </div>
  </section>`
    },

    /* ---------- Terms ---------- */
    {
      file: "terms.html", bg: "usloviya.html", mainClass: "container legal",
      title: "Terms and Conditions | Pesenta",
      desc: "Terms and conditions for ordering a custom song from Pesenta.bg: what we deliver, price and payment, the right of withdrawal, revisions and rights to the song.",
      body: legal("Terms and Conditions", `    <!-- Превод на usloviya.html (в сила от 14.10.2026). Сменят ли се българските
         условия, сменя се и тук. -->
    <p class="updated">Effective from 14 October 2026 (the previous version, from 5 July 2026, applies to orders placed before that date). This is the English version of our Bulgarian terms; both have the same content.</p>

    <h2>1. Who runs Pesenta.bg</h2>
    <p>The website pesenta.bg is operated by ${esc(FIRMA)}, company no. ${EIK}, registered office: ${esc(ADRES)}, represented by its manager ${esc(UPRAVITEL)} (“we”, “the Provider”).</p>
    <p>Contact: <a href="mailto:${EMAIL}">${EMAIL}</a></p>

    <h2>2. What we offer</h2>
    <p>We create personalised songs to individual order — original lyrics and a musical composition made specifically from the story, names and instructions provided by the customer. The finished song is delivered electronically (an MP3 file and the lyrics) to the email address given by the customer. The song is digital content not supplied on a tangible medium and made to the customer's individual specifications.</p>

    <h2>3. Ordering and delivery</h2>
    <ul>
      <li>Orders are placed through the form on the website and paid in advance. The contract is concluded at the moment of payment.</li>
      <li>From the information you provide we create the song — original lyrics and music in the styles you choose.</li>
      <li>With the song you get one free revision within 7 days of delivery if something doesn't match the information you gave us.</li>
      <li>We deliver the final files (MP3 and lyrics) to the email address you provided.</li>
      <li>Delivery time: within 24 hours, counted from receipt of payment and of the complete order information. Same-day delivery is possible on request at ${EMAIL} — when we can, at no extra cost; it is not a promised deadline.</li>
    </ul>

    <h2>4. Prices and payment</h2>
    <ul>
      <li>Prices are in euro (EUR) and are final. No VAT is charged under Art. 113(9) in conjunction with Art. 97a of the Bulgarian VAT Act — the company is registered under Art. 97a, not under the general procedure. Our payment provider (Stripe) may show the amount converted into your local currency; any conversion fee shown by Stripe is applied by Stripe.</li>
      <li>Payment is made in advance, when the order is placed — by card online, or by bank transfer against an invoice. Work starts once the amount is received, and delivery times run from that moment.</li>
      <li>Promotional codes apply at the time of the order and under the conditions of the promotion.</li>
    </ul>

    <h2>5. Right of withdrawal — important</h2>
    <p>The 14-day right of withdrawal does not apply to ordered songs, pursuant to Art. 16(c) and (m) of Directive 2011/83/EU and Art. 57(3) and (13) of the Bulgarian Consumer Protection Act (goods or services made to the consumer's specifications; digital content not supplied on a tangible medium, where performance has begun with the consumer's prior express consent and acknowledgement that the right of withdrawal is thereby lost).</p>
    <p>By placing an order and ticking the express consent box in the form, you confirm that: (a) you want performance to start immediately after payment; (b) you know you lose your right of withdrawal; (c) the song is made specifically for you to your instructions and cannot be returned or refunded after delivery. Without this express consent we do not accept the order.</p>
    <p>Because payment is made in advance, instead of a right of withdrawal you have the following:</p>
    <ul>
      <li><strong>Free revision.</strong> If anything in the lyrics or music doesn't match the information you gave us, let us know within 7 days of delivery and we will revise the song at no extra charge.</li>
      <li><strong>Refund if we fail to deliver.</strong> If we don't deliver the song on time or at all, the amount paid is refunded in full by the same payment method within 14 days.</li>
      <li><strong>Cancellation before work starts.</strong> If you cancel before we have started working on the song, the amount is refunded in full.</li>
    </ul>
    <p>A subjective “I don't like it” after delivery is not a ground for a refund — the song is made to individual order. That's why the form asks for details and why we offer the free revision.</p>

    <h2>6. Song content and the customer's responsibility</h2>
    <ul>
      <li>You are responsible for the accuracy of the information you provide and declare that you have the right to share the personal data and facts about third parties included in your story.</li>
      <li>We do not create content that is defamatory, discriminatory or infringes the rights of others. We reserve the right to refuse such an order and will let you know.</li>
      <li>Explicit or spicy language is used only if you expressly ask for it in your order (18+). In that case you are responsible for not presenting the song to persons under 18 or to unsuitable audiences.</li>
    </ul>

    <h2>7. Copyright and use</h2>
    <ul>
      <li>After full payment you receive an unlimited right of personal use of the song: to give it as a gift, share it on social media and play it at personal and family events.</li>
      <li>Commercial use (advertising, monetised content, resale) only by separate written agreement with us.</li>
      <li>We do not publish your song or use it for promotion without your express consent.</li>
    </ul>

    <h2>8. Personal data</h2>
    <p>The controller of personal data is ${esc(FIRMA)}. How we collect, use and keep your data — including the full list of providers, retention periods and your rights under the GDPR — is described in our <a href="privacy.html">Privacy Policy</a>, which forms part of these terms.</p>

    <h2>9. Complaints and disputes</h2>
    <p>If there is a problem with the files you received (a technical defect, a missing file), contact us and we will fix it free of charge. As a consumer you may also complain to the Bulgarian Commission for Consumer Protection (kzp.bg) or to the consumer authority of your country. Bulgarian law applies; if you are a consumer living in another EU country, this does not take away the protection of the mandatory consumer law of your country of residence.</p>

    <h2>10. Changes</h2>
    <p>We may update these terms by publishing the new version on this page with its effective date. Orders already placed are governed by the terms in force at the time of the order.</p>`)
    },

    /* ---------- Privacy ---------- */
    {
      file: "privacy.html", bg: "poveritelnost.html", mainClass: "container legal",
      title: "Privacy Policy | Pesenta",
      desc: "How Pesenta.bg collects, uses and protects your personal data: what we collect and why, our processors, retention periods, cookies and your GDPR rights.",
      body: legal("Privacy Policy", `    <!-- Превод на poveritelnost.html (версия 1.1, 18.08.2026). Българската страница
         се пълни от assets/js/legal-config.js; тази НЕ — при промяна там (нов
         обработващ, срок) смени и тук на ръка. -->
    <p class="updated">Version 1.1 · last updated: 18 August 2026 (English version: 13 October 2026)</p>
    <div class="box"><p><strong>In short:</strong> we collect only what we need to make your song and issue your receipt or invoice. No advertising cookies, no tracking, no selling of data. Fonts and content load from our own server; the only external thing on the page is a visit counter that uses no cookies. We don't pass your data to third parties for marketing.</p></div>

    <h2>1. Data controller</h2>
    <p><strong>${esc(FIRMA)}</strong>, company no. ${EIK}, ${esc(ADRES)}, represented by ${esc(UPRAVITEL)}.</p>
    <p>Contact for all personal data questions: <a href="mailto:${EMAIL}">${EMAIL}</a></p>

    <h2>2. What data we collect and why</h2>
    <table>
      <thead><tr><th>Data</th><th>Purpose</th><th>Legal basis (GDPR)</th></tr></thead>
      <tbody>
        <tr><td>Name, email, phone (optional)</td><td>performing your order, issuing the sales receipt, sending the finished song, contacting you — including a reminder if a payment wasn't completed</td><td>Art. 6(1)(b) — performance of a contract and steps before it</td></tr>
        <tr><td>Your story and the details for the song (may include personal data about you and third parties)</td><td>writing the lyrics and creating the music with music-generation software (Suno, USA)</td><td>Art. 6(1)(b); for third parties' data — you declare that you have the right to share it</td></tr>
        <tr><td>Invoicing data</td><td>issuing an invoice and accounting</td><td>Art. 6(1)(c) — legal obligation</td></tr>
        <tr><td>IP address and technical logs</td><td>technical operation and security of hosting</td><td>Art. 6(1)(f) — legitimate interest</td></tr>
      </tbody>
    </table>
    <p>We do not knowingly collect data about children; orders are accepted only from persons over 18. We do not profile and do not make automated decisions.</p>
    <p><strong>Where you came from.</strong> We remember the first page you opened and where you arrived from — only for the duration of your visit and only in your browser, without cookies — and send it with your order so we know which pages are useful.</p>
    <p><strong>Photos for the cover.</strong> If you upload photos with your order, they reach us as attachments to the order email, resized by your browser. We use them only for the song's cover and personal page and keep them as long as the order itself.</p>
    <p><strong>Telling the story by voice.</strong> If you use "Or tell it by voice", the recording of your voice reaches us as an attachment and is used for the same purpose as your written story (making the song). Turning speech into text is done by your browser — in some browsers (e.g. Google Chrome) through the speech service of its maker, under that maker's privacy policy. It is entirely optional; you can type the story instead.</p>

    <h2>3. Who has access to the data (processors)</h2>
    <p>We use a small number of providers without which the service can't work. Data is shared with them only as far as necessary:</p>
    <table>
      <thead><tr><th>Provider</th><th>What for</th><th>What data</th><th>Policy</th></tr></thead>
      <tbody>
        <tr><td>Suno (Suno, Inc., USA)</td><td>generating the music and vocals from the song's lyrics</td><td>the lyrics and style instructions; NO email, phone or payment data is sent</td><td><a href="https://suno.com/privacy-policy" target="_blank" rel="noopener">policy</a></td></tr>
        <tr><td>FormSubmit (formsubmit.co)</td><td>receiving orders from the order form and delivering them to our email</td><td>all data entered in the form</td><td><a href="https://formsubmit.co/privacy" target="_blank" rel="noopener">policy</a></td></tr>
        <tr><td>Google (Gmail)</td><td>the mailbox where we receive and keep correspondence</td><td>order data and follow-up communication</td><td><a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policy</a></td></tr>
        <tr><td>Cloudflare (Web Analytics; Workers)</td><td>counting page visits without cookies; storing your order story and issuing the sales receipt</td><td>IP address (processed instantly, not stored), page address, referrer, browser and device type; the order story and order number</td><td><a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">policy</a></td></tr>
        <tr><td>GitHub Pages (hosting)</td><td>technical operation of the website; standard server logs</td><td>IP address and technical data when loading the site</td><td><a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener">policy</a></td></tr>
        <tr><td>Stripe Payments Europe</td><td>processing card payments</td><td>payment data — entered directly with Stripe, not with us</td><td><a href="https://stripe.com/privacy" target="_blank" rel="noopener">policy</a></td></tr>
      </tbody>
    </table>
    <p>We do not sell or rent data to third parties for marketing purposes.</p>

    <h2>4. How long we keep data</h2>
    <ul>
      <li>unfulfilled or declined orders — up to 12 months from submission</li>
      <li>data on issued invoices and receipts — 10 years, as required by accounting law</li>
    </ul>

    <h2>5. Cookies and local storage</h2>
    <p>The website uses no cookies — not for tracking, analytics or advertising — so there's no cookie banner either. To count visits we use Cloudflare Web Analytics, which sets no cookies, stores nothing in your browser and doesn't track individual visitors. The only things we keep are functional entries in your device's localStorage (they are not sent to us):</p>
    <table>
      <thead><tr><th>Key</th><th>Purpose</th><th>How long</th></tr></thead>
      <tbody>
        <tr><td><code>pesenta_orders</code></td><td>a “My orders” list, visible only on your device</td><td>until you clear your browser data</td></tr>
        <tr><td><code>pesenta_lang</code></td><td>remembers that you ordered from the English site, so the page after payment is in English</td><td>until you clear your browser data</td></tr>
      </tbody>
    </table>
    <p>You can delete them at any time in your browser settings. Stripe may set its own cookies on its payment page — they are described in Stripe's policy.</p>

    <h2>6. Your rights</h2>
    <p>At any time you can ask us for access to your data, rectification, erasure (“the right to be forgotten” — except data the law requires us to keep), restriction of processing, portability, and you can object. Write to the email above — we reply within 30 days.</p>
    <p>If you believe we process your data unlawfully, you have the right to lodge a complaint with the Bulgarian Commission for Personal Data Protection (cpdp.bg, 2 Prof. Tsvetan Lazarov Blvd., 1592 Sofia) or with the data protection authority of your EU country of residence.</p>

    <h2>7. Security</h2>
    <p>The website is served over HTTPS. Orders are kept in a protected mailbox with two-factor authentication. Only the people working on your song have access to the data.</p>

    <h2>8. Changes to this policy</h2>
    <p>When we change it, we publish the new version here with a new date and version number. We will mark significant changes visibly on the website.</p>`)
    },

    /* ---------- Thank you ----------
       Stripe връща винаги на blagodarim.html (адресът е в настройката на
       Payment Link-а); тя препраща тук, ако поръчката е от английския сайт. */
    {
      file: "thank-you.html", bg: "blagodarim.html", noindex: true,
      title: "Thank you — Pesenta",
      desc: "Your order has been received.",
      mainClass: "container order-wrap",
      body: `  <div class="success-box">
    <div class="check">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16091c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
    </div>
    <h2>Order received! 🎶</h2>
    <p id="thanks-text">Thank you! Your order has been received. Your song arrives within 24 hours after payment, as an MP3 with the lyrics.</p>
    <div id="beleshka-box" hidden style="margin-top:1.5rem;">
      <p id="beleshka-wait">Issuing your sales receipt…</p>
      <p id="beleshka-ready" hidden>
        <a class="btn btn-primary" id="beleshka-link" href="#" target="_blank" rel="noopener">Open your sales receipt</a>
        <span class="hint" style="display:block;margin-top:.5rem;">The receipt is a Bulgarian fiscal document, so it's in Bulgarian.</span>
      </p>
      <p id="beleshka-late" hidden class="hint">The receipt is issued within a minute and arrives in your inbox. If it doesn't, write to us at <a href="mailto:${EMAIL}" style="color:var(--orange);text-decoration:underline;">${EMAIL}</a>.</p>
    </div>
    <p style="margin-top:1.5rem;"><a class="btn btn-primary" href="./">← Back to the home page</a></p>
  </div>`,
      inline: `<script>
/* Същото като в blagodarim.html: Stripe връща с ?session_id=, а webhook-ът,
   който издава документа, може да закъснее секунда-две — питаме няколко пъти. */
(function () {
  "use strict";
  var WORKER = "https://pesenta-nap.pesenta-nap.workers.dev";
  var sid = new URLSearchParams(location.search).get("session_id");
  if (!sid) return;
  document.getElementById("thanks-text").textContent = "Thank you! Your payment has been received and we're starting work. " +
    "Your sales receipt is on its way to your inbox. The song arrives within 24 hours, as an MP3 with the lyrics.";
  document.querySelector(".success-box h2").textContent = "Payment successful! 🎶";
  var box = document.getElementById("beleshka-box"), wait = document.getElementById("beleshka-wait"),
      ready = document.getElementById("beleshka-ready"), late = document.getElementById("beleshka-late");
  box.hidden = false;
  var delays = [800, 1500, 2500, 4000, 6000], i = 0;
  function ask() {
    fetch(WORKER + "/beleshka-link?session=" + encodeURIComponent(sid))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ready && d.url) {
          document.getElementById("beleshka-link").href = d.url;
          wait.hidden = true; ready.hidden = false; return;
        }
        next();
      })
      .catch(next);
  }
  function next() {
    if (i >= delays.length) { wait.hidden = true; late.hidden = false; return; }
    setTimeout(ask, delays[i++]);
  }
  ask();
})();
</script>
`
    }
  ];
}
