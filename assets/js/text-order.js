/* Песента — бърза текстова поръчка: полетата излизат на СЪЩИЯ екран,
   без прехвърляне към poruchka.html. От 05.09.2026 това е ЕДИНСТВЕНИЯТ
   път за поръчка от началната страница — гласовата поръчка
   (voice-order.js) живее само в poruchka.html.

   Собствени копия на помощните функции, по същата причина като
   voice-order.js: пътят, по който влизат поръчките, не бива да зависи
   от това дали друг файл се е заредил. */
(function () {
  "use strict";

  var textBtn = document.getElementById("fast-text");
  if (!textBtn) return;

  var FORM_TARGET = "rusev.miro@gmail.com";
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/" + FORM_TARGET;
  /* Втори, независим път за разказа. FormSubmit е трета страна на безплатен
     план; тук записът е наш и стои при поръчката в базата. */
  var BRIEF_ENDPOINT = "https://pesenta-nap.pesenta-nap.workers.dev/brief";

  var fieldsWrap = document.getElementById("text-fields");
  /* На index.html двете долу са null ПО ЗАМИСЪЛ — гласовият блок и бутонът
     за запис вече не са там. Кодът, който ги ползва, остава с проверки, а
     не се маха: файлът е един и същ, ако някой ден гласът се върне на
     страница с този бутон. */
  var voiceFieldsWrap = document.getElementById("fast-fields");
  var recBtn = document.getElementById("fast-rec");
  var card = document.getElementById("voice-card");
  var sendBtn = document.getElementById("text-send");
  var errEl = document.getElementById("text-error");
  var storyEl = document.getElementById("text-story");

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function genOrderNo() {
    var now = new Date();
    var y = String(now.getFullYear()).slice(2);
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    var rand = String(Math.floor(1000 + Math.random() * 9000));
    return "PSN-" + y + m + day + "-" + rand;
  }

  function rememberOrder(orderNo) {
    try {
      var orders = JSON.parse(localStorage.getItem("pesenta_orders") || "[]");
      orders.unshift({
        no: orderNo,
        date: new Date().toISOString().slice(0, 10),
        plan: "Бърза текстова поръчка",
        total: "—",
        status: "Приета"
      });
      localStorage.setItem("pesenta_orders", JSON.stringify(orders));
    } catch (e) { /* localStorage недостъпен — не е фатално */ }
  }

  function fail(msg) { errEl.textContent = msg; errEl.classList.add("show"); }
  function clearFail() { errEl.textContent = ""; errEl.classList.remove("show"); }

  /* ============ Фактура по желание ============
     Полетата стоят скрити, докато отметката не се сложи — 90% от клиентите
     са физически лица, за които фактура не се дължи (чл. 113, ал. 3, т. 1
     ЗДДС), и няма смисъл да ги гледат. */
  var invChk = document.getElementById("text-invoice");
  var invBox = document.getElementById("text-invoice-fields");
  if (invChk && invBox) {
    invChk.addEventListener("change", function () {
      invBox.hidden = !invChk.checked;
      if (invChk.checked) document.getElementById("text-inv-name").focus({ preventScroll: true });
    });
  }

  /* Връща данните за фактура или null. Валидира само когато е поискана —
     иначе празните полета не бива да спират поръчката. */
  function invoiceData() {
    if (!invChk || !invChk.checked) return null;
    return {
      name: (document.getElementById("text-inv-name").value || "").trim(),
      addr: (document.getElementById("text-inv-addr").value || "").trim(),
      eik: (document.getElementById("text-inv-eik").value || "").trim()
    };
  }

  /* Адресът на касата за дадена поръчка.
     ------------------------------------------------------------------
     client_reference_id е това, което свързва плащането с брифа: Stripe
     го връща в webhook-а, а Worker-ът записва по него продажбата и издава
     документа със същия номер.

     Ако payments.js по някаква причина не се е заредил или плащанията са
     изключени, падаме към plati.html — там клиентът вижда обяснение и
     банков път, вместо да опре в нищо. */
  function paymentUrl(orderNo) {
    var cfg = window.PESENTA_PAYMENTS;
    var link = cfg && cfg.enabled && cfg.paymentLinks && cfg.paymentLinks.pesen;
    if (!link) return "plati.html?order=" + encodeURIComponent(orderNo) + "&plan=pesen";
    return link + (link.indexOf("?") === -1 ? "?" : "&") +
           "client_reference_id=" + encodeURIComponent(orderNo);
  }

  /* Същият проблем, същата поправка като в voice-order.js: hero-снимката
     е центрирана спрямо колоната — щом полетата излязат и колоната
     стане по-висока, я закотвяме там, където си беше. */
  function pinHeroPhoto() {
    var photo = document.querySelector(".hero-photo");
    if (!photo || !photo.offsetParent || photo.dataset.pinned) return;
    var before = photo.getBoundingClientRect().top;
    photo.style.alignSelf = "start";
    var after = photo.getBoundingClientRect().top;
    photo.style.marginTop = Math.round(before - after) + "px";
    photo.dataset.pinned = "1";
  }

  /* Кикерът/H1/lead-ът отстъпват място на формата — веднъж свити, остават
     свити (нито гласовият, нито текстовият път ги връщат). max-height
     тръгва от РЕАЛНАТА измерена височина, не от произволно голямо число:
     иначе преходът или скача, или се точи твърде дълго при кратък текст. */
  var heroIntro = document.getElementById("hero-intro");
  var heroCollapsed = false;
  function collapseHeroIntro() {
    if (heroCollapsed || !heroIntro) return;
    heroCollapsed = true;
    heroIntro.style.maxHeight = heroIntro.scrollHeight + "px";
    void heroIntro.offsetHeight; /* форсира reflow — виж бележката в main.js за филтрите */
    heroIntro.classList.add("collapsed");
  }

  /* ============ Повод / стил (чипове) ============
     Същата логика като в order.js (single vs multi select), но собствено
     копие — order.js изобщо не се зарежда на началната страница. */
  document.querySelectorAll("#text-fields .chips").forEach(function (group) {
    var single = group.hasAttribute("data-single");
    group.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      if (single) {
        group.querySelectorAll(".chip.selected").forEach(function (c) {
          if (c !== chip) c.classList.remove("selected");
        });
      }
      chip.classList.toggle("selected");
    });
  });

  function selectedOccasion() {
    var el = document.querySelector("#text-occasion-chips .chip.selected");
    return el ? el.getAttribute("data-value") : "";
  }
  function selectedStyles() {
    return Array.prototype.map.call(
      document.querySelectorAll("#text-style-chips .chip.selected, #text-style-chips-more .chip.selected"),
      function (c) { return c.getAttribute("data-value"); }
    );
  }

  /* ============ Кога е поводът → кога е готова ============
     Собствено копие на функциите от order.js — файловете нарочно не си
     споделят код (виж главата). Тук няма експрес: при близка дата редът
     праща към пълната поръчка, където експресът се избира. Срокът е плосък —
     48 часа от сега, не работни дни; датите по българско време. */
  function dostavkaDo(sega, express) {
    return new Date(sega.getTime() + (express ? 24 : 48) * 3600 * 1000);
  }
  function denBG(d) {
    try {
      return d.toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Sofia" });
    } catch (e) {
      return d.toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long" });
    }
  }
  function denNomer(d) {
    var s;
    try {
      s = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    } catch (e) {
      s = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    return Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000);
  }
  function dataOtPole(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
  }
  var eventDateEl = document.getElementById("text-event-date");
  var dostavkaRed = document.getElementById("text-dostavka-red");
  function presmetniDostavka() {
    if (!dostavkaRed) return;
    var sega = new Date();
    var sabitie = dataOtPole(eventDateEl ? eventDateEl.value : "");
    var gotova = dostavkaDo(sega, false);
    var html, blizo = false;
    if (sabitie === null) {
      html = "Готова до <strong>" + denBG(gotova) + "</strong>.";
    } else {
      var n = sabitie - denNomer(gotova);
      if (n >= 0) {
        var koga = n === 0 ? "в деня на събитието" : (n === 1 ? "ден преди събитието" : n + " дни преди събитието");
        html = "Поръчаш ли сега, песента е при теб до <strong>" + denBG(gotova) + "</strong> — " + koga + ".";
      } else if (sabitie - denNomer(dostavkaDo(sega, true)) >= 0) {
        blizo = true;
        html = "Датата е близо. <a href=\"poruchka.html\">Избери експресна изработка в пълната поръчка →</a>";
      } else {
        blizo = true;
        html = "Пиши ни на <a href=\"mailto:sales@pesenta.bg\">sales@pesenta.bg</a>, преди да платиш — ще кажем дали стигаме.";
      }
    }
    dostavkaRed.innerHTML = html;
    dostavkaRed.classList.toggle("blizo", blizo);
  }
  if (eventDateEl) eventDateEl.addEventListener("change", presmetniDostavka);

  textBtn.addEventListener("click", function () {
    /* ако гласовият запис тече, спираме го през собствения му бутон —
       той си знае как да прибере микрофона и таймера чисто */
    if (recBtn && recBtn.classList.contains("recording")) recBtn.click();
    if (voiceFieldsWrap) voiceFieldsWrap.hidden = true;
    fieldsWrap.hidden = false;
    collapseHeroIntro();
    pinHeroPhoto();
    presmetniDostavka(); /* „Готова до …“ се смята от момента на отваряне, не на зареждане */

    /* preventScroll е същественото. Обикновеният .focus() скролира веднага,
       но collapseHeroIntro() тече 600ms и през това време свива заглавието —
       съдържанието отдолу се качва СЛЕД скрола и полето отива под sticky
       хедъра. Затова: фокус без скрол сега, а нагласяне чак когато
       анимацията е приключила и разположението е окончателно. */
    storyEl.focus({ preventScroll: true });
    setTimeout(function () {
      var r = storyEl.getBoundingClientRect();
      var head = document.querySelector(".site-header");
      var top = head ? head.getBoundingClientRect().height : 0;
      /* Пипаме само ако полето наистина е скрито или извън екрана —
         иначе оставяме страницата където е, вместо да я дърпаме без нужда. */
      if (r.top < top + 8 || r.bottom > window.innerHeight) {
        storyEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 650);
  });

  /* Обратната посока (само там, където има бутон за запис): кликне ли се
     „Поръчай с глас“, докато текстовите полета стоят отворени, ги прибираме —
     иначе двете форми се виждат едновременно. voice-order.js не знае нищо за
     този файл, слушаме тук. На index.html recBtn е null и блокът не тръгва. */
  if (recBtn) {
    recBtn.addEventListener("click", function () {
      if (fieldsWrap) fieldsWrap.hidden = true;
      collapseHeroIntro();
    });
  }

  sendBtn.addEventListener("click", function () {
    clearFail();
    var story = storyEl.value.trim();
    if (!story) { fail("Разкажи накратко за кого е песента и повода."); return; }
    if (!document.getElementById("text-consent").checked) {
      fail("Моля, потвърди съгласието с Общите условия."); return;
    }
    var inv = invoiceData();
    if (inv && (!inv.name || !inv.addr)) {
      fail("За фактура са нужни име (или фирма) и адрес."); return;
    }
    /* Име и имейл НЕ се искат тук — Stripe ги събира на своята страница.
       Съгласието по чл. 57 обаче остава преди плащането: клиентът се отказва
       от правото на връщане, това не може да се потвърждава след факта. */

    var orderNo = genOrderNo();
    var occasion = selectedOccasion();
    var styles = selectedStyles();
    var language = document.getElementById("text-language").value;
    var eventDate = eventDateEl ? (eventDateEl.value || "") : "";

    var fields = {
      "_subject": "БЪРЗА заявка (ОЧАКВА ПЛАЩАНЕ) — " + orderNo,
      "_template": "box",
      "Номер на заявка": orderNo,
      "Тип": "Бърза текстова поръчка",
      /* Брифът тръгва ПРЕДИ плащането, защото след него клиентът е на
         страницата на Stripe и разказът щеше да се загуби. Затова темата
         казва „очаква плащане" — свързването става по номера на поръчката,
         който пътува със самото плащане като client_reference_id. */
      "Състояние": "ОЧАКВА ПЛАЩАНЕ — клиентът е пренасочен към Stripe",
      "Клиент": "— идва от Stripe след плащането",
      "Повод": occasion || "— не е избран, виж разказа",
      "Дата на повода": eventDate || "— не е посочена",
      "Стилове": styles.length ? styles.join(", ") : "— не са избрани, виж разказа",
      "Език": language,
      "Разказ": story,
      /* Ако няма отметка, пишем изрично „не иска" — така при преглед се вижда
         разликата между „не е поискана" и „забравили сме да я запишем". */
      "ФАКТУРА": inv
        ? (inv.eik ? "ДА — ФИРМА (задължителна)" : "ДА — физическо лице (по желание)")
        : "не е поискана — влиза в отчета по чл. 119",
      "Фактура: име / фирма": inv ? inv.name : "—",
      "Фактура: адрес": inv ? inv.addr : "—",
      "Фактура: ЕИК / ДДС номер": inv && inv.eik ? inv.eik : "—",
      "Съгласие чл. 57 ЗЗП (без право на отказ)": "потвърдено преди плащането",
      "CLAUDE BRIEF": [
        "# Бърза текстова поръчка — " + orderNo,
        "",
        "СЪСТОЯНИЕ: очаква плащане. Свери в Stripe по " + orderNo,
        "преди да започнеш работа.",
        "",
        inv
          ? ("ФАКТУРА: поискана" + (inv.eik ? " — ФИРМА " + inv.eik + " (задължителна по ЗДДС)" : " — физическо лице") +
             "\n" + inv.name + ", " + inv.addr)
          : "ФАКТУРА: не е поискана.",
        "",
        "Повод: " + (occasion || "— не е избран, виж разказа"),
        "Дата на повода: " + (eventDate || "— не е посочена"),
        "Стилове: " + (styles.length ? styles.join(", ") : "— не са избрани, виж разказа"),
        "Език: " + language,
        "",
        "## Разказ (директно от клиента, без транскрипция)",
        story,
        "",
        "## Задача",
        "Извлечи: получател, повод (ако не е избран горе), история, детайли, стилове (ако не са избрани горе), настроение."
      ].join("\n")
    };

    rememberOrder(orderNo);

    sendBtn.disabled = true;
    sendBtn.textContent = "Отваряме плащането…";

    var fd = new FormData();
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });

    /* Плащането е следващата стъпка при ВСЯКО положение. Ако брифът не
       успее да замине, пак пращаме клиента към Stripe — номерът на
       поръчката пътува с плащането, така че разказът може да се поиска
       после. Да го спрем пред касата заради наш проблем е по-лошото. */
    function toPayment() {
      if (window.plausible) window.plausible("Order Submitted", { props: { method: "text-quick" } });
      window.location.href = paymentUrl(orderNo);
    }

    /* Разказът отива И в нашата база, преди клиентът да тръгне към касата.
       sendBeacon, а не fetch: веднага след това страницата се сменя, а
       навигацията прекъсва обикновените заявки — точно затова досега се
       губеха брифове. Beacon се доставя и след напускане на страницата.

       Типът е text/plain нарочно: с application/json браузърът иска
       preflight, а sendBeacon не умее да го прави и заявката не тръгва.
       Worker-ът чете текста и сам го разбира като JSON.

       Провалът тук е тих по същата причина, по която е тих и при
       FormSubmit — клиентът не бива да спира пред касата заради нас. Но
       вече има и трети предпазител: ако до плащането разказ няма, писмото
       за плащане идва с [БЕЗ РАЗКАЗ] в темата. */
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(BRIEF_ENDPOINT, new Blob([JSON.stringify({
          order_no: orderNo,
          vid: "бърза текстова",
          povod: fields["Повод"],
          event_date: eventDate,
          stilove: fields["Стилове"],
          ezik: fields["Език"],
          razkaz: fields["Разказ"]
        })], { type: "text/plain;charset=UTF-8" }));
      }
    } catch (e) { /* без beacon оставаме на стария път */ }

    fetch(FORM_ENDPOINT, { method: "POST", headers: { "Accept": "application/json" }, body: fd })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(toPayment)
      .catch(toPayment);
  });
})();
