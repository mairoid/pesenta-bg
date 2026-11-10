/* Песента — прозорец за бисквитките и пикселът на Meta (08.11.2026)
   ─────────────────────────────────────────────────────────────────
   Рекламата във Facebook/Instagram има нужда да вижда кой поръчва, а това иска
   бисквитки. Затова: нищо от Meta не се зарежда преди „Приемам“, двата бутона са
   равностойни, а отказът се помни също като приемането.

   Докато PIXEL_ID е празен, този файл не прави нищо: няма прозорец, няма заявки. */
(function () {
  "use strict";

  var PIXEL_ID = "1134959228908052";
  var KLUCH = "pesenta_saglasie";
  var VERSIA = 1;
  var SROK_MS = 182 * 24 * 60 * 60 * 1000;
  var CENA = 19.9;

  /* Личните страници на песните носят имена и истории, а plati.html и otkaz.html —
     номер на поръчка в адреса. Meta не бива да вижда нито едно от тях. */
  var IZKLUCHENI = /^\/(pesni\/|pesen(\.html)?$|plati(\.html)?$|otkaz(\.html)?$)/;
  var STR_KUPUVANE = /^\/(blagodarim|vaucher-blagodarim|en\/thank-you)(\.html)?$/;

  if (!PIXEL_ID || IZKLUCHENI.test(location.pathname)) return;

  var EN = document.documentElement.lang === "en";
  var T = EN ? {
    tekst: "?",
    priemi: "Accept", otkaji: "Decline", poveche: "Meta ad cookies", etiket: "Cookies",
    politika: "/en/privacy.html#cookies"
  } : {
    tekst: "?",
    priemi: "Приемам", otkaji: "Отказвам", poveche: "Бисквитки за реклами", etiket: "Бисквитки",
    politika: "/poveritelnost.html#biskvitki"
  };

  /* В частен режим localStorage може да хвърли — тогава питаме при всяко посещение. */
  function chetene() {
    try {
      var z = JSON.parse(localStorage.getItem(KLUCH) || "null");
      if (z && z.v === VERSIA && Date.now() - z.d < SROK_MS) return z;
    } catch (e) { /* няма запис */ }
    return null;
  }
  function zapis(prie) {
    var star = chetene() || {};
    try {
      localStorage.setItem(KLUCH, JSON.stringify({ v: VERSIA, prie: prie, d: Date.now(), kupeno: star.kupeno }));
    } catch (e) { /* без запомняне */ }
  }

  var pusnat = false;

  function vrashtane(adres) {
    try { history.replaceState(history.state, "", adres); } catch (e) { /* адресът остава */ }
  }

  function pusni() {
    if (pusnat) return;
    pusnat = true;

    var q = new URLSearchParams(location.search);
    var sid = STR_KUPUVANE.test(location.pathname) ? q.get("session_id") : null;
    var adres = location.href;

    /* session_id отваря документа за продажбата, а Meta записва адреса на страницата.
       Затова адресът е без параметри, докато пикселът работи. Страницата вече е прочела
       номера си, а след това адресът се връща, за да не се счупи презареждането. */
    if (sid) {
      vrashtane(location.pathname);
      /* Иначе следващата страница получава адреса с номера като „откъде идваш“, а пикселът го чете. */
      var ref = document.createElement("meta");
      ref.name = "referrer";
      ref.content = "no-referrer";
      document.head.appendChild(ref);
    }

    var n = window.fbq = function () {
      if (n.callMethod) n.callMethod.apply(n, arguments); else n.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    n.disablePushState = true;

    /* autoConfig събира сам бутони и съдържание от страницата, а във формата има
       разкази за истински хора. Трябва да е изключено преди init. */
    window.fbq("set", "autoConfig", false, PIXEL_ID);
    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");

    if (sid) {
      var zap = chetene() || {};
      var belezhka = sid.slice(-12);
      /* Презареждане на страницата не бива да брои втора продажба. */
      if (zap.kupeno !== belezhka) {
        window.fbq("track", "Purchase", { value: CENA, currency: "EUR", content_type: "product" });
        try {
          zap.kupeno = belezhka;
          localStorage.setItem(KLUCH, JSON.stringify(zap));
        } catch (e) { /* без запомняне */ }
      }
    }

    var s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    function vurni() { if (sid) setTimeout(function () { vrashtane(adres); }, 3000); }
    s.onload = vurni;
    s.onerror = vurni;
    document.head.appendChild(s);
  }

  /* Само имена на събития. Пояснението към тях (d) остава при нас. */
  var SABITIYA = { "Order Form Open": "InitiateCheckout", "Voucher Checkout": "InitiateCheckout", "Order Submitted": "Lead" };
  var pratili = {};
  function kamMeta(ime) {
    var s = SABITIYA[ime];
    /* Формата вика и psnSabitie, и plausible за една и съща поръчка, затова по веднъж на страница. */
    if (!pusnat || !window.fbq || !s || pratili[s]) return;
    pratili[s] = true;
    window.fbq("track", s);
  }

  var star = window.psnSabitie;
  window.psnSabitie = function (ime, detail) {
    try { kamMeta(ime); } catch (e) { /* без Meta */ }
    if (star) star(ime, detail);
  };
  /* Съветникът в poruchka.html (order.js) не вика psnSabitie, а само това име. */
  window.plausible = function (ime) {
    if (ime === "Order Submitted") { try { kamMeta(ime); } catch (e) { /* без Meta */ } }
  };

  var prozorec = null;

  function skrii() {
    if (prozorec) prozorec.remove();
    prozorec = null;
  }

  function iztrii() {
    ["_fbp", "_fbc"].forEach(function (b) {
      document.cookie = b + "=; Max-Age=0; path=/";
      document.cookie = b + "=; Max-Age=0; path=/; domain=." + location.hostname;
    });
  }

  function stil() {
    if (document.getElementById("saglasie-stil")) return;
    var s = document.createElement("style");
    s.id = "saglasie-stil";
    s.textContent =
      ".saglasie{position:fixed;left:8px;right:8px;bottom:8px;z-index:1000;width:fit-content;max-width:calc(100% - 16px);margin:0 auto;padding:6px 6px 6px 12px;" +
      "display:flex;align-items:center;gap:8px;flex-wrap:wrap;" +
      "background:var(--bg-soft,#14132b);color:var(--text,#f4f2ff);border:1px solid var(--border,rgba(255,255,255,.1));" +
      "border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);font-size:.78rem;line-height:1.3}" +
      ".saglasie p{margin:0;flex:1 1 auto}" +
      ".saglasie a{color:var(--orange,#ffa14d);text-decoration:underline}" +
      ".saglasie-btn{display:flex;gap:6px;flex:0 0 auto}" +
      ".saglasie-btn button{min-height:32px;padding:0 10px;font:inherit;font-weight:700;cursor:pointer;" +
      "color:var(--text,#f4f2ff);background:var(--surface-strong,rgba(255,255,255,.08));" +
      "border:1px solid var(--border,rgba(255,255,255,.1));border-radius:8px}";
    document.head.appendChild(s);
  }

  function pokaji() {
    if (prozorec) return;
    stil();
    var d = document.createElement("div");
    d.className = "saglasie";
    d.setAttribute("role", "region");
    d.setAttribute("aria-label", T.etiket);

    var p = document.createElement("p");
    var a = document.createElement("a");
    a.href = T.politika;
    a.textContent = T.poveche;
    p.appendChild(a);
    p.appendChild(document.createTextNode(T.tekst));

    var b = document.createElement("div");
    b.className = "saglasie-btn";
    function buton(tekst, fn) {
      var x = document.createElement("button");
      x.type = "button";
      x.textContent = tekst;
      x.addEventListener("click", fn);
      b.appendChild(x);
    }
    buton(T.priemi, function () { zapis(true); skrii(); pusni(); });
    buton(T.otkaji, function () {
      var beshe = pusnat;
      zapis(false);
      skrii();
      iztrii();
      /* Вече зареденият пиксел не може да се махне иначе. */
      if (beshe) location.reload();
    });

    d.appendChild(p);
    d.appendChild(b);
    document.body.appendChild(d);
    prozorec = d;
  }

  /* Оттеглянето трябва да е толкова лесно, колкото приемането: бутон в политиката. */
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-saglasie-promeni]");
    if (t) { e.preventDefault(); pokaji(); }
  });

  var izbor = chetene();
  if (!izbor) pokaji();
  else if (izbor.prie) pusni();
})();
