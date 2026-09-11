/* Картичката „Песента ти пътува. Утре е при теб.“ и чакалнята на песента.
   ─────────────────────────────────────────────────
   Единственият начин „за днес“ да стане клиент (hukove-poslednia-moment.md,
   11.09.2026): веднага след плащането клиентът получава картичка за печат
   (А6) или за телефона — с името на човека и QR код. Връчва я днес, песента
   идва утре. QR-ът сочи към /p/<поръчка>?t=…: докато песента я няма, там е
   чакалнята; при връчване page_url в базата я праща направо към страницата.

   Прави се в Worker-а, не в браузъра: тук са номерът на поръчката, брифът
   с името на получателя, генераторът на QR от бележката и подписаните
   линкове. Страницата „благодарим“ знае само session_id.

   Шрифтовете идват от сайта (fonts.css); ако не се заредят, резервните
   стекове са същите като на сайта. Тъмният фон се печата само с включени
   „фонови графики“ — print-color-adjust: exact го иска от браузъра, но
   решението остава на потребителя; текстът е четим и на бяло. */

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/* Логото V1 (logo-domain.svg) — инлайн, за да не зависи от друг сървър. */
const LOGO = `<svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 230 44" role="img" aria-label="pesenta.bg">
  <defs><linearGradient id="lg" gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="600" y2="0">
    <stop offset="0" stop-color="#FF4D8D"/><stop offset="1" stop-color="#FFA14D"/></linearGradient></defs>
  <g transform="translate(2 5) scale(0.085)"><g fill="none" stroke="url(#lg)" stroke-linecap="round" stroke-linejoin="round">
    <path stroke-width="28" d="M30 232 H78 C88 232 92 198 104 198 S130 276 148 276 S174 118 198 118 S228 332 254 332 S284 176 308 176 S336 262 360 262 S388 226 408 232 C416 234 422 240 426 246"/>
    <path stroke-width="30" d="M536 236 V88"/><path stroke-width="28" d="M536 88 C570 96 592 118 594 152"/></g>
    <ellipse cx="500" cy="246" rx="40" ry="35" transform="rotate(-18 500 246)" fill="url(#lg)"/></g>
  <text x="60" y="30" font-family="'Unbounded','Segoe UI',sans-serif" font-size="19" font-weight="700" fill="#F4F2FF">pesenta.bg</text>
</svg>`;

/* Шрифтовете и иконата са от сайта; без иконата всяко отваряне дава 404 в конзолата. */
const FONTS = `<link rel="stylesheet" href="https://pesenta.bg/assets/css/fonts.css">
<link rel="icon" type="image/svg+xml" href="https://pesenta.bg/assets/img/favicon.svg">`;

/* s — редът от sales; ime — получателят от брифа ("" ако няма);
   qr — SVG на QR кода; pUrl — адресът, към който сочи QR-ът (за резервния ред). */
export function renderKartichka(env, s, ime, qr) {
  const ot = String(s.customer_name || "").trim().split(/\s+/)[0];
  return `<!doctype html>
<html lang="bg"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Картичка за ${esc(ime || "подаръка")} — Песента</title>
${FONTS}
<style>
  @page { size: A6; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { background: #050409; color: #F4F2FF; font-family: "Manrope", "Segoe UI", Helvetica, Arial, sans-serif;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ui { max-width: 560px; margin: 0 auto; padding: 28px 20px 8px; text-align: center; }
  .ui h1 { font-family: "Unbounded", "Segoe UI Semibold", "Segoe UI", sans-serif; font-size: 1.35rem; margin: 0 0 .5rem; }
  .ui p { color: #A9A4C9; margin: 0 0 1rem; line-height: 1.55; font-size: .97rem; }
  .btn { display: inline-block; background: #FF4D8D; color: #16091C; font-weight: 700; text-decoration: none;
         border: 0; border-radius: 999px; padding: .8rem 1.5rem; font-size: 1rem; cursor: pointer; font-family: inherit; }
  .btn:hover { background: #ff67a0; }
  .scena { display: flex; justify-content: center; padding: 16px 12px 40px; overflow: auto; }
  .kartichka { width: 105mm; height: 148mm; box-sizing: border-box; padding: 9mm 9mm 8mm; flex: none;
               background: #0B0A1A radial-gradient(60mm 60mm at 85% 10%, rgba(255,77,141,.28), transparent 70%);
               display: flex; flex-direction: column; justify-content: space-between;
               box-shadow: 0 20px 60px rgba(0,0,0,.6); border-radius: 3mm; }
  .logo { width: 44mm; height: auto; display: block; }
  .kicker { margin: 3mm 0 0; font-size: 2.5mm; letter-spacing: .18em; text-transform: uppercase; color: #8F8AB0; }
  .glavno { margin: 0; font-family: "Unbounded", "Segoe UI Semibold", "Segoe UI", sans-serif; font-weight: 700;
            font-size: 7.6mm; line-height: 1.14; letter-spacing: -.01em; }
  .glavno .utre { color: #FFA14D; }
  .za { margin: 6mm 0 0; font-size: 5.6mm; font-weight: 700; line-height: 1.2; }
  .za .etiket { font-weight: 500; color: #A9A4C9; font-size: 4mm; display: block; margin-bottom: 1mm; }
  .za .praznо { display: inline-block; width: 58mm; border-bottom: .4mm dotted #8F8AB0; height: 6mm; vertical-align: bottom; }
  .ot { margin: 2mm 0 0; font-size: 3.8mm; color: #D9D5EE; }
  .dolu { display: flex; align-items: flex-end; gap: 5mm; }
  .qr { width: 30mm; height: 30mm; background: #fff; border-radius: 2mm; padding: 2mm; box-sizing: border-box; flex: none; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .skaniraj { font-size: 3.3mm; line-height: 1.45; color: #A9A4C9; margin: 0; }
  .skaniraj strong { color: #F4F2FF; }
  .poruchka { margin: 3mm 0 0; font-size: 2.6mm; color: #6F6A8E; letter-spacing: .04em; }
  /* На телефон картичката (105 mm ≈ 397 px) е по-широка от екрана — смалява се
     леко вместо да се превърта; печатът не е засегнат. */
  @media (max-width: 440px) { .scena { padding: 8px 0 32px; } .kartichka { zoom: .88; } }
  @media print {
    body { background: #0B0A1A; }
    .ui, .scena { display: block; padding: 0; margin: 0; }
    .ui { display: none; }
    .kartichka { box-shadow: none; border-radius: 0; margin: 0; }
  }
</style></head>
<body>
<div class="ui">
  <h1>Картичката за днес</h1>
  <p>Отпечатай я на А6 (или на А4 и отрежи), или я покажи направо от телефона.
     Който я получи, сканира кода утре — и песента е там.</p>
  <button class="btn" type="button" onclick="window.print()">Печат</button>
</div>
<div class="scena">
<div class="kartichka">
  <div>
    ${LOGO}
    <p class="kicker">Песен по поръчка</p>
  </div>
  <div>
    <p class="glavno">Песента ти пътува.<br><span class="utre">Утре е при теб.</span></p>
    <p class="za"><span class="etiket">За</span>${ime ? esc(ime) : '<span class="praznо"></span>'}</p>
    ${ot ? `<p class="ot">от ${esc(ot)}</p>` : ""}
  </div>
  <div>
    <div class="dolu">
      <div class="qr">${qr}</div>
      <p class="skaniraj"><strong>Сканирай, когато е готова.</strong><br>Там ще е песента — с текста, за слушане и за сваляне.</p>
    </div>
    <p class="poruchka">${esc(s.order_no)} · pesenta.bg</p>
  </div>
</div>
</div>
</body></html>`;
}

/* Чакалнята: адресът от QR-а, докато page_url още е празен. */
export function renderPesenChaka(env, s, ime) {
  return `<!doctype html>
<html lang="bg"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Песента пътува — Песента</title>
${FONTS}
<style>
  html, body { margin: 0; padding: 0; }
  body { min-height: 100vh; background: #0B0A1A radial-gradient(70vw 70vw at 80% 0%, rgba(255,77,141,.22), transparent 70%);
         color: #F4F2FF; font-family: "Manrope", "Segoe UI", Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  /* width: 100% + box-sizing: иначе на 375 px блокът остава 520 и се реже отдясно */
  main { width: 100%; max-width: 520px; box-sizing: border-box; padding: 40px 24px; text-align: center; }
  .logo { width: 180px; height: auto; margin: 0 auto 28px; display: block; }
  h1 { font-family: "Unbounded", "Segoe UI Semibold", "Segoe UI", sans-serif; font-size: 1.7rem; line-height: 1.2; margin: 0 0 14px; }
  h1 span { color: #FFA14D; }
  p { color: #A9A4C9; line-height: 1.6; margin: 0 0 12px; font-size: 1.02rem; }
  a { color: #FF4D8D; }
</style></head>
<body><main>
  ${LOGO}
  <h1>Песента${ime ? " за " + esc(ime) : ""} пътува.<br><span>Още не е стигнала.</span></h1>
  <p>Готова е до 48 часа от поръчката, с експрес — до 24. Тогава този адрес ще води направо към нея: с текста, за слушане и за сваляне.</p>
  <p>Сканирай картичката пак по-късно или запази адреса.</p>
  <p><a href="https://pesenta.bg">pesenta.bg</a></p>
</main></body></html>`;
}
