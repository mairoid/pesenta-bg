/* Английската начална страница (en/index.html).
   Формата за поръчка има СЪЩИТЕ id-та като на българската — text-order.js е
   един файл за двата езика и разпознава езика по <html lang="en">.
   Стойностите на чиповете за повод са точно тези, които ползват страниците
   по повод в povodi.mjs (полето chip) — сменя ли се едното, сменя се и другото.
   Секциите, които са само български (кино-входът със scrub, промо кодът по
   имейл, „Родени на този ден“), тук ги няма. */
import { POVODI } from "./povodi.mjs";
import { CENA, EMAIL, esc, demoRed, enUrl, DEMO_EN } from "./obshto.mjs";

const CHIPS_POVOD = ["Birthday", "Wedding", "Bachelor party", "Bachelorette party", "Anniversary", "New baby", "Christening", "Milestone birthday"];
const CHIPS_POVOD_OSHTE = ["Retirement", "Engagement", "Prom / school graduation", "18th birthday", "Company event", "Graduation", "Housewarming", "For a teacher", "For mom", "For dad", "Christmas", "New Year", "Valentine's Day", "Just for fun / surprise"];
const STILOVE = ["Pop", "Ballad", "Rock", "Rap / Hip-hop", "Acoustic guitar", "Disco / Retro", "Country", "R&B / Soul"];
const STILOVE_OSHTE = ["EDM / Dance", "Jazz / Swing", "Latin / Reggaeton", "Balkan pop-folk", "Kyuchek (Balkan dance)", "Bulgarian folk", "Oriental", "Metal", "Children's song", "Crooner / Chanson", "Cinematic / Epic"];
const EZITSI = ["English", "Bulgarian", "German", "French", "Italian", "Spanish", "Greek", "Serbian", "Macedonian", "Romanian", "Turkish", "Russian", "Ukrainian", "Arabic", "Mixed (a combination of languages)", "Other (tell us in your story)"];

const chip = (v) => `<span class="chip" data-value="${esc(v)}">${esc(v)}</span>`;

/* Картите в „Occasions“ — снимките са общите povod-*.jpg (без надписи). */
const KARTI = [
  ["birthday", "rojden-den", "A gift that celebrates the person, not the shelf next to the other presents."],
  ["wedding", "svatba", "A song the couple will remember longer than the menu."],
  ["bachelor", "ergensko", "An anthem for the crew — with every name and every joke."],
  ["bachelorette", "mominsko", "An anthem for the girls — names included, censorship optional."],
  ["anniversary", "godishnina", "Proof that the years add up, not count down."],
  ["baby", "bebe", "The first gift a child will listen to for life."],
  ["milestone", "jubilej", "A round number deserves more than another card."],
  ["retirement", "pensionirane", "The last working day deserves more than cake in the kitchen."],
  ["engagement", "godej", "The yes has been said. The song remembers the details."],
  ["mom", "mama", "The one person you can't buy anything for. Except this."],
  ["eighteenth", "palnoletie", "Eighteen, keys in the pocket — and a song for the road so far."],
  ["corporate", "firmeno", "A team anthem — with an invoice, if you need one."],
  ["graduation", "diplomirane", "Years of study, one song that knows what they cost."],
  ["housewarming", "nov-dom", "The first music in new walls — for the people, not the walls."]
];

export function nachalo() {
  const karti = KARTI.map(([k, img, t]) => {
    const x = POVODI.find((y) => y.key === k);
    return `        <a class="occasion-card" href="${x.file}">
          <img class="occasion-photo" src="../assets/img/povod-${img}.jpg" loading="lazy" decoding="async" width="600" height="400" alt="${esc(x.menu)}">
          <h3>${esc(x.chip || x.menu)}</h3>
          <p>${esc(t)}</p>
        </a>`;
  }).join("\n");

  const faq = [
    ["How long does it take?", "The song is ready within 24 hours after we receive your story and payment. Need it the same day? Email " + EMAIL + " before you pay — when we can, we do it. For weddings and company events we suggest ordering a week ahead so there's time for calm revisions."],
    ["How do I pay?", "You pay the full " + CENA + " when you order, by card through Stripe's secure checkout (Apple Pay, Google Pay and other local methods may also appear). Stripe can show the price in your local currency. Right after payment you get an electronic sales receipt by email."],
    ["What languages can the song be in?", "English, Bulgarian, German, French, Italian, Spanish, Greek, Serbian, Macedonian, Romanian, Turkish, Russian, Ukrainian, Arabic — or a mix of two. If you need another language, write it in your story and ask."],
    ["Can I choose more than one music style?", "Yes. Tick as many styles as you like in the form and tell us in your story which one should lead."],
    ["What if I don't like it?", "If a name, a detail or the sound isn't right, tell us within 7 days and we'll revise it for free. That's why the form asks for details — the more you give us, the closer we get first time."],
    ["Can I get a refund after delivery?", "The song is digital content made to your personal order, so the 14-day right of withdrawal doesn't apply once work has started with your explicit consent (Art. 16(m) of EU Directive 2011/83/EU, Art. 57 of the Bulgarian Consumer Protection Act). You confirm this with a checkbox when ordering. Instead you get a free revision — and if we don't deliver, you get your money back in full. Details in the <a href=\"terms.html\" style=\"color:var(--orange);\">Terms</a>."],
    ["Can it be a surprise?", "Yes — completely confidential. We only talk to you, and the song isn't published anywhere."],
    ["What can I do with the song?", "It's yours for personal use without limits: give it, share it on social media, play it at events. For commercial use (ads, monetised content) write to us first."],
    ["Who are you?", "Pesenta is a small Bulgarian studio run by Miro from Veliko Tarnovo, operated by BAUFIZIK EOOD. We started by writing songs for friends' birthdays and bachelor parties. More on the <a href=\"about.html\" style=\"color:var(--orange);\">About</a> page."]
  ];

  const ld = [{
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization", "@id": "https://pesenta.bg/#org", name: "Pesenta", alternateName: "Песента",
        url: "https://pesenta.bg/", email: EMAIL, logo: "https://pesenta.bg/assets/img/og-image.jpg",
        description: "Personalised custom songs for every occasion — birthday, wedding, bachelor party, anniversary.",
        sameAs: ["https://www.tiktok.com/@pesentabg", "https://www.instagram.com/pesenta.bg/", "https://www.facebook.com/pesenta.bg", "https://www.youtube.com/@pesenta", "https://www.trustpilot.com/review/pesenta.bg"]
      },
      { "@type": "WebSite", "@id": "https://pesenta.bg/en/#site", url: enUrl("index.html"), name: "Pesenta", inLanguage: "en", publisher: { "@id": "https://pesenta.bg/#org" } },
      {
        "@type": "Service", name: "Custom song", serviceType: "Personalised song as a gift", provider: { "@id": "https://pesenta.bg/#org" },
        areaServed: "Worldwide",
        description: "An original personalised song written from your story: lyrics, composition and production. 19 styles, 14 languages, delivered within 24 hours.",
        offers: { "@type": "Offer", name: "Custom song", price: "19.90", priceCurrency: "EUR" }
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a.replace(/<[^>]+>/g, "") } }))
      }
    ]
  }];

  const body = `
  <section class="hero">
    <div class="container hero-grid">
      <div>
        <div id="hero-intro">
          <span class="kicker">From friends, for friends</span>
          <h1>Your story, turned into a <span class="grad-text">song</span> for ${CENA}</h1>
          <p class="lead">Tell us about the person and the occasion. We write the lyrics — word by word, from your story — and make the music in the style you choose. <strong class="garancia">Yours within 24 hours — or your money back.</strong></p>
        </div>
        <div id="voice-card">
          <div class="hero-ctas" id="order">
            <button type="button" class="btn btn-primary btn-lg" id="fast-text">Order a song</button>
            <a class="btn btn-ghost btn-lg hero-demo-link" href="#demo">Hear samples</a>
          </div>
          <a class="hero-proba" href="#demo" data-proba-src="../assets/audio/rocco-di-catania.mp3" data-start="70" data-len="15">
            <img src="../assets/img/cover-rocco-112.jpg" width="56" height="56" alt="">
            <span class="hero-proba-tekst"><strong>Hear 15 seconds</strong> of a song for Rocco</span>
            <span class="hero-proba-ikona" aria-hidden="true"></span>
          </a>
          <p class="hero-late"><a href="last-minute-gift.html">Need it fast? →</a></p>
          <noscript>
            <p class="voice-status">Ordering needs JavaScript. Email us your story at <a href="mailto:${EMAIL}" style="color:var(--orange);text-decoration:underline;">${EMAIL}</a>.</p>
          </noscript>

          <div id="text-fields" hidden>
            <div class="field">
              <label for="text-story">Tell us the story
                <span class="hint">Who the song is for, the occasion, your story and the details. The more you share, the more personal the song.</span>
              </label>
              <textarea id="text-story" placeholder="e.g. For my colleague Dan — he turns 40 next Saturday, loves fishing and still talks about the time he…"></textarea>
              <div class="glas-razkaz" id="text-glas" hidden>
                <div class="voice-row">
                  <button type="button" class="btn btn-ghost voice-btn" id="text-glas-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
                    <span id="text-glas-label">Or tell it by voice</span>
                  </button>
                  <span class="voice-status" id="text-glas-status" aria-live="polite">Just talk — your words appear in the box above, and you can fix them.</span>
                </div>
                <div class="voice-play" id="text-glas-play" hidden>
                  <audio controls id="text-glas-audio"></audio>
                  <button type="button" class="btn btn-ghost glas-del" id="text-glas-del">Delete recording</button>
                </div>
              </div>
            </div>

            <details class="detaili" id="text-detaili">
              <summary>Add details <span class="hint">optional — occasion, date, style, photos</span></summary>
              <div class="detaili-body">
            <div class="field">
              <label>Occasion <span class="hint">Optional — if it isn't clear from the story</span></label>
              <div class="chips" id="text-occasion-chips" data-single>
                ${CHIPS_POVOD.map(chip).join("\n                ")}
              </div>
              <details class="more-fields" style="margin-top:0.6rem;">
                <summary>Show more occasions <span class="hint">(${CHIPS_POVOD.length + CHIPS_POVOD_OSHTE.length} in total)</span></summary>
                <div class="more-fields-body">
                  <div class="chips" id="text-occasion-chips-more" data-single>
                    ${CHIPS_POVOD_OSHTE.map(chip).join("\n                    ")}
                  </div>
                </div>
              </details>
            </div>

            <div class="field">
              <label for="text-event-date">When is the occasion? <span class="hint">Optional — so we can tell you when it will be ready</span></label>
              <input type="date" id="text-event-date" name="text-event-date">
              <p class="dostavka-red" id="text-dostavka-red" aria-live="polite"></p>
            </div>

            <div class="field">
              <label>Style <span class="hint">Optional, you can pick more than one</span></label>
              <div class="chips" id="text-style-chips">
                ${STILOVE.map(chip).join("\n                ")}
              </div>
              <details class="more-fields" style="margin-top:0.6rem;">
                <summary>Show more styles <span class="hint">(${STILOVE.length + STILOVE_OSHTE.length} in total)</span></summary>
                <div class="more-fields-body">
                  <div class="chips" id="text-style-chips-more">
                    ${STILOVE_OSHTE.map(chip).join("\n                    ")}
                  </div>
                </div>
              </details>
            </div>

            <div class="field snimki-box" id="text-snimki-box">
              <label for="text-snimki">Photos for the cover
                <span class="hint">Optional — up to 3 photos of the person or the group. We use them for the song's cover and its personal page.</span>
              </label>
              <input type="file" id="text-snimki" name="text-snimki" accept="image/*" multiple hidden>
              <div class="snimki-row">
                <button type="button" class="btn btn-ghost snimki-btn" id="text-snimki-add">Add photos</button>
                <span class="voice-status" id="text-snimki-status">JPG or PNG from your phone — we resize them for you.</span>
              </div>
              <div class="snimki-preview" id="text-snimki-preview" aria-live="polite"></div>
            </div>
              </div>
            </details>

            <div class="field">
              <label for="text-language">Language of the song</label>
              <select id="text-language" name="text-language">
                ${EZITSI.map((e) => `<option>${esc(e)}</option>`).join("\n                ")}
              </select>
            </div>

            <div class="field">
              <label for="text-email">Email where we should send your song *</label>
              <input type="email" id="text-email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required>
            </div>

            <!-- Съгласието е преводът на българското: отказът от правото на
                 връщане трябва да е изричен и преди плащането (чл. 57, т. 13 ЗЗП /
                 чл. 16, б. „м“ от Директива 2011/83/ЕС). -->
            <label class="consent">
              <input type="checkbox" id="text-consent">
              <span>I have read the <a href="terms.html" target="_blank" style="color:var(--orange);text-decoration:underline;">Terms</a> and the <a href="privacy.html" target="_blank" style="color:var(--orange);text-decoration:underline;">Privacy Policy</a> and agree that my data is used to make the song. I expressly agree that work starts right after payment and confirm that I <strong>lose the 14-day right of withdrawal</strong> (Art. 16(m) of Directive 2011/83/EU; Art. 57 of the Bulgarian Consumer Protection Act) — the song is made personally for me, to my instructions, and I pay in advance so the work can begin.</span>
            </label>

            <label class="consent" style="margin-top:0.4rem;">
              <input type="checkbox" id="text-invoice">
              <span>I need an invoice <span class="hint" style="display:inline;">(required for companies; optional for private customers)</span></span>
            </label>
            <div id="text-invoice-fields" hidden>
              <div class="field">
                <label for="text-inv-name">Name or company *</label>
                <input type="text" id="text-inv-name" autocomplete="organization" placeholder="e.g. Example Ltd or Jane Smith">
              </div>
              <div class="field">
                <label for="text-inv-addr">Address *</label>
                <input type="text" id="text-inv-addr" autocomplete="street-address" placeholder="street, number, city, country">
              </div>
              <div class="field">
                <label for="text-inv-eik">Company or VAT number
                  <span class="hint">Companies only — leave empty if you're a private person</span>
                </label>
                <input type="text" id="text-inv-eik" placeholder="e.g. DE123456789">
              </div>
            </div>

            <div class="form-error" id="text-error" role="alert"></div>
            <button type="button" class="btn btn-primary btn-lg" id="text-send" style="width:100%;margin-top:0.8rem;">Continue to payment · ${CENA}</button>
            <p class="hint" style="margin-top:0.6rem;"><strong class="garancia">Your song within 24 hours — or your money back.</strong><br>Secure payment by Stripe — your email is filled in there, you just add your name and card.<br>Need it today? Email <a href="mailto:${EMAIL}" style="color:var(--orange);text-decoration:underline;">${EMAIL}</a> before you pay — when we can, we make it the same day.</p>
          </div>
        </div>
        <p class="hero-sub">Original lyrics · Ready within 24 hours · No subscription</p>
      </div>
      <div class="hero-photo">
        <video class="hero-video" muted loop playsinline preload="none"
               data-poster="../assets/img/hero-poster-ergensko.webp"
               data-src="../assets/video/hero-ergensko.mp4"
               width="800" height="800"
               aria-label="Friends at a bachelor party listening to a custom song about the groom"></video>
      </div>
    </div>
  </section>

  <section class="section" id="demo">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-eyebrow">
          <span class="sec-no" aria-hidden="true">01</span>
          <span class="kicker">Listen first</span>
        </span>
        <h2>Songs that already made someone's day</h2>
        <p>Every one of these was written for a real person — Rocco in Italian, Rosen in Turkish, Rusi in Arabic, Krasi in Bulgarian. Yours can be in English or any of 13 other languages. Tap a song to play it.</p>
      </div>
      <div class="tracks-list">
${DEMO_EN.map((k) => demoRed(k)).join("\n")}
      </div>
      <button type="button" class="btn btn-ghost tracks-more" id="tracks-more" hidden>More songs</button>
    </div>
  </section>

  <section class="section" id="povodi">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-eyebrow">
          <span class="sec-no" aria-hidden="true">02</span>
          <span class="kicker">What people order songs for</span>
        </span>
        <h2>Got an occasion? Got a song.</h2>
        <p>The most common ones — but we've also written songs about lost bets, won matches and cats with attitude.</p>
      </div>
      <div class="lenta-rail povodi-rail" id="povodi-rail">
        <div class="povodi-track" id="povodi-track">
${karti}
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="kak-raboti">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-eyebrow">
          <span class="sec-no" aria-hidden="true">03</span>
          <span class="kicker">It's simple</span>
        </span>
        <h2>How it works</h2>
        <p>From your story to a finished song — three steps, zero hassle.</p>
      </div>
      <ol class="steps-short reveal">
        <li><span class="step-num" aria-hidden="true">1</span><p><strong>Tell us</strong> who it's for and why — in words or by voice — and pay ${CENA}.</p></li>
        <li><span class="step-num" aria-hidden="true">2</span><p><strong>We make it.</strong> A person writes the lyrics from your story; the music comes in the style you pick.</p></li>
        <li><span class="step-num" aria-hidden="true">3</span><p><strong>You get it</strong> by email within 24 hours — or your money back. Not quite right? Free revision.</p></li>
      </ol>
    </div>
  </section>

  <section class="section" id="stilove">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-eyebrow">
          <span class="sec-no" aria-hidden="true">04</span>
          <span class="kicker">You choose the sound</span>
        </span>
        <h2>19 styles, 14 languages — mix freely</h2>
        <p>A ballad for mum, rap for your best friend, Balkan brass for the stag party? It can be in Turkish, Greek, Italian or English too — or a mix.</p>
      </div>
      <div class="styles-cloud styles-row reveal">
        <span class="style-group">
          <button type="button" class="style-play" aria-label="Hear a sample: Rock" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
          <span class="style-chip" data-demo="../assets/audio/angel-s-torbata.mp3" data-start="0">Rock</span>
        </span>
        <span class="style-group">
          <button type="button" class="style-play" aria-label="Hear a sample: Rap / Hip-hop" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
          <span class="style-chip" data-demo="../assets/audio/za-teb-brate-vladi.mp3" data-start="0">Rap / Hip-hop</span>
        </span>
        <span class="style-group">
          <button type="button" class="style-play" aria-label="Hear a sample: Oriental" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
          <span class="style-chip" data-demo="../assets/audio/rosen-abi.mp3" data-start="0">Oriental</span>
        </span>
        <span class="style-group">
          <button type="button" class="style-play" aria-label="Hear a sample: Crooner / Chanson" aria-pressed="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
          <span class="style-chip" data-demo="../assets/audio/rocco-di-catania.mp3" data-start="0">Crooner / Chanson</span>
        </span>
        <span class="style-chip">Pop</span>
        <span class="style-chip">Ballad</span>
        <span class="style-chip">Balkan pop-folk</span>
        <span class="style-chip">Kyuchek</span>
        <span class="style-chip">Bulgarian folk</span>
        <span class="style-chip">Disco / Retro</span>
        <span class="style-chip">EDM / Dance</span>
        <span class="style-chip">R&amp;B / Soul</span>
        <span class="style-chip">Jazz / Swing</span>
        <span class="style-chip">Country</span>
        <span class="style-chip">Latin / Reggaeton</span>
        <span class="style-chip">Acoustic guitar</span>
        <span class="style-chip">Metal</span>
        <span class="style-chip">Children's song</span>
        <span class="style-chip">Cinematic / Epic</span>
      </div>
    </div>
  </section>

  <section class="section" id="ceni">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-eyebrow">
          <span class="sec-no" aria-hidden="true">05</span>
          <span class="kicker">One clear price</span>
        </span>
        <h2>One song, one price</h2>
        <p>No packages, no hidden fees. One price, paid up front, and the song gets started.</p>
      </div>
      <p class="proof-count reveal"><strong>50+ songs</strong> written so far — for friends, weddings and bachelor parties.</p>
      <div class="pricing-grid pricing-single">
        <div class="price-card featured reveal">
          <h3>Custom song</h3>
          <div class="price-line"><span class="amount">${CENA}</span></div>
          <div class="price-note">final price</div>
          <ul>
            <li>Original lyrics from your story</li>
            <li>A full song in the style you choose</li>
            <li>A personal song page with cover art</li>
            <li>Free revision</li>
            <li>MP3 + lyrics by email within 24 hours</li>
          </ul>
          <a class="btn btn-primary" href="#order">Order now</a>
          <p class="price-guarantee">Not with you within 24 hours? Money back.<br>Not quite right? We fix it for free.</p>
        </div>
      </div>
      <div class="pricing-note reveal">
        <strong>You pay when you order; the song arrives within 24 hours — or your money back.</strong> If something isn't right, we revise it for free. Need it the same day? Email ${EMAIL} — when we can, we do it.
      </div>
    </div>
  </section>

  <section class="section" id="vaprosi">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-eyebrow">
          <span class="sec-no" aria-hidden="true">06</span>
          <span class="kicker">Ask away</span>
        </span>
        <h2>Frequently asked questions</h2>
      </div>
      <div class="faq-list reveal">
${faq.map(([q, a]) => `        <details class="faq-item">
          <summary>${esc(q)}</summary>
          <div class="faq-body">${a}</div>
        </details>`).join("\n")}
      </div>
    </div>
  </section>

  <section class="section" id="istorii">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-eyebrow">
          <span class="sec-no" aria-hidden="true">07</span>
          <span class="kicker">Behind the scenes</span>
        </span>
        <h2>How the songs are born</h2>
        <p>It started as a gift between friends — then friends of friends began asking, “can you do one for us?” We can.</p>
      </div>
      <div class="founder-story reveal">
        <div class="founder-photo">
          <img src="../assets/img/osnovatel.png" alt="The founder of Pesenta" loading="lazy" width="120" height="120">
        </div>
        <div class="founder-text">
          <h3>How Pesenta started</h3>
          <p>It all began with a bachelor party. A childhood friend was getting married, and as a surprise we ordered a song from someone who writes songs to order.</p>
          <p>The song arrived, I played it — and honestly, I didn't like it at all. Was that how we were going to surprise the groom?</p>
          <details class="founder-more">
            <summary>Read the whole story</summary>
            <p>So I decided to try writing our own. In a day, a few were ready. I thought they were bad and that nobody would like them.</p>
            <p>We played them at the bachelor party. People started having fun.</p>
            <p class="founder-accent">Then everyone climbed onto the tables and started singing along to the new hits.</p>
            <p>The next night the same songs played until late. And two weeks later, at the wedding itself, around midnight, we surprised the groom with one of them.</p>
            <p class="founder-accent">He asked the DJ to play it three more times — one after another.</p>
            <p>It happened again at my brother's bachelor party: brand-new songs, a whole night of singing — even though nobody had heard them before.</p>
            <p>That's when I understood: a song isn't for the radio. It's for the table where everyone sings along. That's why Pesenta exists.</p>
            <p class="founder-sign">— Miro, founder</p>
          </details>
        </div>
      </div>
      <div class="studio-pair reveal">
        <img src="../assets/img/studio-1.jpg" width="800" height="600" loading="lazy" decoding="async"
             alt="A home studio at night: a condenser microphone with a pop filter, headphones on a stand and a laptop showing a song's waveform, lit by a warm desk lamp">
        <img src="../assets/img/studio-2.jpg" width="800" height="600" loading="lazy" decoding="async"
             alt="A hand on the knob of a compact audio interface, amber indicator lights in the dark">
      </div>
      <!-- Отзивите са истинските от българската страница, преведени. Пише го
           изрично под тях — превод не бива да минава за оригинален английски отзив. -->
      <div class="lenta-rail quotes-rail reveal" id="quotes-rail">
        <div class="quotes-track" id="quotes-track">
          <figure class="quote-card"><div class="quote-mark">“</div><blockquote>I want to thank you from the bottom of my heart — the song is perfect, I have no words. Thank you so much!</blockquote><figcaption class="who">Gergana S.</figcaption></figure>
          <figure class="quote-card"><div class="quote-mark">“</div><blockquote>Great job, bravo!</blockquote><figcaption class="who">Ivaylo D.</figcaption></figure>
          <figure class="quote-card"><div class="quote-mark">“</div><blockquote>It's amazing, thank you so much!</blockquote><figcaption class="who">Krasimira G.</figcaption></figure>
          <figure class="quote-card"><div class="quote-mark">“</div><blockquote>Miro, thank you so much, brother! Your songs make the party! ❤️</blockquote><figcaption class="who">Vladimir N.</figcaption></figure>
          <figure class="quote-card"><div class="quote-mark">“</div><blockquote>Next step… producer 😁 so many weak songs out there lately. I play the one for Vladi in the car 🤣</blockquote><figcaption class="who">Nikolay M.</figcaption></figure>
          <figure class="quote-card"><div class="quote-mark">“</div><blockquote>Even though I don't understand most of the lyrics, this beat really gets me and takes me to the Turkish Riviera! Keep making tracks like this 😎🙌</blockquote><figcaption class="who">Dr Ivan V.</figcaption></figure>
        </div>
      </div>
      <p class="hint reveal" style="text-align:center;margin-top:0.8rem;">Reviews from Bulgarian customers, translated from Bulgarian.</p>
      <p class="otzivi-vanshni reveal"><a href="https://www.trustpilot.com/review/pesenta.bg" target="_blank" rel="noopener">See our reviews on Trustpilot →</a></p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="cta-band cta-band-photo reveal">
        <h2>Give something they won't forget</h2>
        <p>Flowers wilt, vouchers expire. A song stays — and gets played at every family get-together.</p>
        <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
          <a class="btn btn-primary btn-lg" href="#order">Order a song</a>
          <a class="btn btn-ghost btn-lg" href="#demo">Hear samples</a>
        </div>
      </div>
    </div>
  </section>
`;

  return {
    file: "index.html", bg: "index.html", noti: true,
    title: "Custom Song Gift from Your Story — €19.90, Ready in 24h | Pesenta",
    desc: "An original personalised song written from your story — €19.90, ready within 24 hours, delivered by email. Lyrics, music, 19 styles, 14 languages.",
    ld, body,
    scripts: ["lenta.js", "main.js", "noti-bg.js", "payments.js", "text-order.js"]
  };
}
