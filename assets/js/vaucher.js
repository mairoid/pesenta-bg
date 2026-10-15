/* Песента — „Ваучер за песен“ (vaucher.html, 15.10.2026).

   Купувачът пише от кого, за кого и кратко послание; ние ги пращаме към Worker-а
   (POST /vaucher/nov, ред „chaka“) и го водим към отделната Stripe връзка
   „Ваучер за песен“ с client_reference_id = VCH-…. Кодът и PDF-ът се правят чак
   след плащането (webhook-ът на Worker-а), затова тук код няма.

   Докато връзката в payments.js е празна, бутонът само казва, че плащането се
   включва скоро — нищо не тръгва към Worker-а и нищо не пренасочва. Така
   страницата може да стои на сайта безопасно.

   Собствени копия на помощните функции (както в text-order.js): пътят на
   поръчката не бива да зависи от друг файл, освен от payments.js. */
(function () {
  "use strict";

  var form = document.getElementById("vaucher-forma");
  if (!form) return;

  /* Същият Worker като за брифа (text-order.js → BRIEF_ENDPOINT) и за събитията
     (main.js → SABITIE_URL). Сменя ли се адресът, сменя се и на трите места. */
  var WORKER = "https://pesenta-nap.pesenta-nap.workers.dev";
  var NOV_ENDPOINT = WORKER + "/vaucher/nov";
  /* Границите са тези на Worker-а (worker/src/vaucher.js → proveriNov): там дългото се
     отказва, не се реже — а beacon-ът не чака отговор. Затова се спира тук, преди касата. */
  var MAX_IME = 60, MAX_POSLANIE = 300, MAX_REDA = 8;
  /* Същото чистене като chistTekst в Worker-а: празните купчини стават един празен ред,
     интервалите около новия ред падат. Така броим каквото Worker-ът ще брои. */
  function chistPoslanie(v) {
    return String(v || "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
      .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function $(id) { return document.getElementById(id); }
  var otEl = $("v-ot"), zaEl = $("v-za"), poslEl = $("v-poslanie"), emailEl = $("v-email");
  var broyach = $("v-broyach"), errEl = $("v-error"), sendBtn = $("v-send");
  var invChk = $("v-invoice"), invBox = $("v-invoice-fields");
  var SEND_TEXT = sendBtn.textContent;

  function fail(msg, vid) {
    errEl.textContent = msg;
    errEl.className = "form-error show" + (vid ? " " + vid : "");
    errEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function clearFail() { errEl.textContent = ""; errEl.className = "form-error"; }
  function chist(el) { return (el && el.value ? el.value : "").trim(); }
  function losho(el, da) { if (el) el.classList.toggle("invalid", !!da); }

  /* VCH-ГГММДД-NNNN — по модела на PSN- номерата в text-order.js. */
  function genRef() {
    var now = new Date();
    var y = String(now.getFullYear()).slice(2);
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    var rand = String(Math.floor(1000 + Math.random() * 9000));
    return "VCH-" + y + m + day + "-" + rand;
  }

  /* ---------- Брояч и преглед на куплета ---------- */
  var pregledZa = $("v-pregled-za"), pregledOt = $("v-pregled-ot"), pregledTekst = $("v-pregled-tekst");
  var PRIMER = pregledTekst ? pregledTekst.getAttribute("data-primer") || "" : "";
  function obnovi() {
    var n = poslEl.value.length;
    if (broyach) {
      broyach.textContent = n + " / " + MAX_POSLANIE;
      broyach.classList.toggle("blizo", n > MAX_POSLANIE - 30);
    }
    if (pregledZa) pregledZa.textContent = chist(zaEl) ? "За " + chist(zaEl) : "За …";
    if (pregledOt) pregledOt.textContent = chist(otEl) ? "От " + chist(otEl) : "От …";
    if (pregledTekst) {
      /* Всеки нов ред е нов стих; празните редове отпадат. Само textContent —
         текстът е на купувача и не бива да става HTML. */
      var redove = (poslEl.value.trim() || PRIMER).split(/\r?\n/).map(function (r) { return r.trim(); }).filter(Boolean);
      pregledTekst.textContent = "";
      redove.forEach(function (r) {
        var p = document.createElement("p");
        p.textContent = r;
        pregledTekst.appendChild(p);
      });
      pregledTekst.classList.toggle("primer", !poslEl.value.trim());
    }
  }
  [otEl, zaEl, poslEl].forEach(function (el) {
    el.addEventListener("input", function () { losho(el, false); obnovi(); });
  });
  emailEl.addEventListener("input", function () { losho(emailEl, false); });
  obnovi();

  /* ---------- Фактура по желание — същите полета като в бързата форма ---------- */
  if (invChk && invBox) {
    invChk.addEventListener("change", function () {
      invBox.hidden = !invChk.checked;
      if (invChk.checked) $("v-inv-name").focus({ preventScroll: true });
    });
  }
  function invoiceData() {
    if (!invChk || !invChk.checked) return null;
    return { name: chist($("v-inv-name")), addr: chist($("v-inv-addr")), eik: chist($("v-inv-eik")) };
  }

  /* ---------- Адресът на касата ---------- */
  function vrazka() {
    var cfg = window.PESENTA_PAYMENTS;
    return (cfg && cfg.enabled && cfg.paymentLinks && cfg.paymentLinks.vaucher) || "";
  }
  function paymentUrl(link, ref, email) {
    return link + (link.indexOf("?") === -1 ? "?" : "&") +
      "client_reference_id=" + encodeURIComponent(ref) +
      (email ? "&prefilled_email=" + encodeURIComponent(email) : "") +
      "&locale=bg";
  }

  /* Връщане с „Назад“ от Stripe: страницата идва от кеша със заключен бутон. */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) { sendBtn.disabled = false; sendBtn.textContent = SEND_TEXT; }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearFail();

    var ot = chist(otEl).replace(/\s+/g, " "), za = chist(zaEl).replace(/\s+/g, " "), poslanie = chistPoslanie(poslEl.value), email = chist(emailEl);
    if (!ot) { losho(otEl, true); otEl.focus(); return fail("Напиши от кого е подаръкът — име или „Колегите от офиса“."); }
    if (ot.length > MAX_IME) { losho(otEl, true); otEl.focus(); return fail("„От кого“ е до " + MAX_IME + " знака."); }
    if (!za) { losho(zaEl, true); zaEl.focus(); return fail("Напиши за кого е ваучерът."); }
    if (za.length > MAX_IME) { losho(zaEl, true); zaEl.focus(); return fail("„За кого“ е до " + MAX_IME + " знака."); }
    if (!poslanie) { losho(poslEl, true); poslEl.focus(); return fail("Напиши кратко послание — то стои на ваучера като куплет."); }
    if (poslanie.length > MAX_POSLANIE) { losho(poslEl, true); poslEl.focus(); return fail("Посланието е до " + MAX_POSLANIE + " знака — сега е " + poslanie.length + "."); }
    var redove = poslanie.split("\n").length;
    if (redove > MAX_REDA) { losho(poslEl, true); poslEl.focus(); return fail("Посланието е до " + MAX_REDA + " реда — сега са " + redove + ". Слей някои редове."); }
    var emailOk = email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (!emailOk) { losho(emailEl, true); emailEl.focus(); return fail("Напиши имейл, на който да ти пратим ваучера."); }
    if (!$("v-consent").checked) return fail("Моля, потвърди съгласието с Общите условия.");
    var inv = invoiceData();
    if (inv && (!inv.name || !inv.addr)) return fail("За фактура са нужни име (или фирма) и адрес.");
    if (inv) {
      inv.eik = inv.eik.replace(/\s/g, "");
      if (inv.name.length > 120 || inv.addr.length > 200) return fail("Името за фактурата е до 120 знака, адресът — до 200.");
      if (inv.eik && !/^[A-Za-z0-9]{6,20}$/.test(inv.eik)) { losho($("v-inv-eik"), true); return fail("ЕИК / ДДС номерът е от цифри (и BG отпред за ДДС) — например 207427793 или BG207427793."); }
    }

    /* Без връзка за плащане нищо не тръгва: ред „chaka“ без шанс за плащане е
       само шум в базата. */
    var link = vrazka();
    if (!link) {
      return fail("Плащането за ваучери се включва съвсем скоро. Дотогава можеш да поръчаш песента направо — или ни пиши на sales@pesenta.bg и ще ти кажем веднага щом стане.", "skoro");
    }

    var ref = genRef();
    var tyalo = { ref: ref, ot_kogo: ot, za_kogo: za, poslanie: poslanie, email: email };
    if (inv) {
      tyalo.faktura = { ime: inv.name, adres: inv.addr };
      if (inv.eik) tyalo.faktura.eik = inv.eik;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Отваряме плащането…";

    /* sendBeacon — веднага след това страницата се сменя, а навигацията прекъсва
       обикновените заявки. text/plain нарочно: без preflight (както /brief). */
    var json = JSON.stringify(tyalo), tragna = false;
    try {
      if (navigator.sendBeacon) tragna = navigator.sendBeacon(NOV_ENDPOINT, new Blob([json], { type: "text/plain;charset=UTF-8" }));
    } catch (err) { tragna = false; }
    if (!tragna) {
      try { fetch(NOV_ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: json, keepalive: true }).catch(function () {}); } catch (err) {}
    }

    if (window.psnSabitie) window.psnSabitie("Voucher Checkout");
    window.location.href = paymentUrl(link, ref, email);
  });
})();
