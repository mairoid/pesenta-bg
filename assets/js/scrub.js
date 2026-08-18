/* Кинематичен вход: скролът превърта видеото кадър по кадър.
 *
 * Секцията стои hidden и се показва САМО ако всичко се получи: десктоп,
 * без prefers-reduced-motion, видеото се е изтеглило навреме и може да
 * превърта. Всеки друг изход я оставя скрита и посетителят вижда директно
 * същинския hero с формата за поръчка — тоест пътят към поръчка никога не
 * зависи от това дали 2,95 MB видео са пристигнали.
 */
(function () {
  "use strict";

  var SRC = "assets/video/hero-scrub.mp4";
  var TIMEOUT = 4000;   /* по-бавно от това не си струва чакането */
  var LERP = 0.08;      /* колкото по-малко, толкова по-меко и по-бавно догонва */
  var FPS = 24;         /* кадри в секунда на hero-scrub.mp4 */

  var sec = document.getElementById("scrub");
  var vid = document.getElementById("scrub-video");
  if (!sec || !vid) return;

  var mqMobile = window.matchMedia("(max-width: 767px)");
  var mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (mqMobile.matches || mqMotion.matches) return;

  var bands = [].slice.call(sec.querySelectorAll(".scrub-band")).map(function (el) {
    return { el: el, from: parseFloat(el.dataset.from), to: parseFloat(el.dataset.to), live: false };
  });

  var duration = 0;
  var target = 0;      /* където иска скролът */
  var current = 0;     /* където е видеото в момента */
  var seeking = false;
  var running = false;

  /* ---- прогрес на скрола ---- */

  function progress() {
    var r = sec.getBoundingClientRect();
    var patut = sec.offsetHeight - window.innerHeight;
    if (patut <= 0) return 0;
    var p = -r.top / patut;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  /* Всяка банда има плато: между from и to е плътна, а влиза и излиза за
     FADE от прогреса. Без платото при бърз скрол текстът само мига.
     0.03, а не повече: най-тясната пролука между две банди е 0.06 (0.18→0.24),
     а всички банди стоят на едно и също място в центъра. При по-широк преход
     изходящият и входящият текст светят едновременно и се наслагват —
     измерено беше 9,7% от скрола с два текста един върху друг. */
  var FADE = 0.03;

  function bandOpacity(b, p) {
    if (p <= b.from - FADE || p >= b.to + FADE) return 0;
    if (p < b.from) return (p - (b.from - FADE)) / FADE;
    if (p > b.to)   return ((b.to + FADE) - p) / FADE;
    return 1;
  }

  /* ---- цикълът ---- */

  function tick() {
    var p = progress();

    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      var o = bandOpacity(b, p);
      b.el.style.opacity = o;
      /* Бутонът в последната банда трябва да е кликаем само когато се вижда,
         иначе прихваща кликове през прозрачния слой. */
      var live = o > 0.5;
      if (live !== b.live) { b.live = live; b.el.classList.toggle("is-live", live); }
    }

    target = p * duration;
    current += (target - current) * LERP;

    /* Превърта се по КАДРИ, не по секунди. Предишният праг беше половин
       кадър и заради това искахме нов кадър дори когато целта още сочи
       същия — декодерът получаваше заявки, които не сменят нищо на екрана,
       и се задръстваше. Сега се сравняват номера на кадри: няма ли нов
       номер, няма и заявка. */
    var желан = Math.round(current * FPS);
    var показан = Math.round(vid.currentTime * FPS);
    if (!seeking && желан !== показан) {
      seeking = true;
      try { vid.currentTime = желан / FPS; } catch (e) { seeking = false; }
    }

    requestAnimationFrame(tick);
  }

  vid.addEventListener("seeked", function () { seeking = false; });
  vid.addEventListener("error", function () { seeking = false; });

  /* ---- зареждане ---- */

  function start() {
    duration = vid.duration;
    if (!isFinite(duration) || duration <= 0) return;   /* без времетраене няма какво да мапваме */
    sec.hidden = false;
    /* Първият кадър се показва веднага, за да няма черен екран между
       показването на секцията и първия seek. */
    try { vid.currentTime = 0; } catch (e) {}
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function zaredi() {
    var otkazano = false;
    var ctrl = ("AbortController" in window)
      ? new AbortController()
      : { abort: function () {}, signal: undefined };

    var chasovnik = setTimeout(function () {
      /* Прекратяваме тегленето: иначе 2,95 MB продължават да ядат от
         честотната лента на човек, който вече е решил да гледа формата. */
      otkazano = true;
      try { ctrl.abort(); } catch (e) {}
    }, TIMEOUT);

    /* БЕЗ cache: "force-cache". Той значи „ползвай кешираното, дори да е
       остаряло, без да питаш сървъра" — при подмяна на видеото връщащите се
       посетители остават със стария файл, докато кешът им изтече. Хванато на
       живо: кешът връщаше стария файл, а сървърът новия.
       Без опция браузърът ползва нормалните HTTP правила и ревалидира по
       ETag — един лек 304 срещу сигурността, че се гледа верният файл. */
    fetch(SRC, { signal: ctrl.signal })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.blob();
      })
      .then(function (blob) {
        clearTimeout(chasovnik);
        if (otkazano) return;
        vid.src = URL.createObjectURL(blob);
        if (vid.readyState >= 1) start();
        else vid.addEventListener("loadedmetadata", start, { once: true });
      })
      .catch(function () {
        clearTimeout(chasovnik);
        /* Тихо. Секцията остава скрита, страницата работи както преди нея. */
      });
  }

  /* Видеото чака страницата да се зареди: до момента, в който човек стигне
     до скролване, формата и hero-то вече трябва да са готови. */
  if (document.readyState === "complete") zaredi();
  else window.addEventListener("load", zaredi, { once: true });
})();
