/* Песента — бърза текстова поръчка: полетата излизат на СЪЩИЯ екран,
   по аналогия на гласовата поръчка (voice-order.js), но без запис — за
   клиенти, които не искат или не могат да говорят.

   Собствени копия на помощните функции, по същата причина като
   voice-order.js: пътят, по който влизат поръчките, не бива да зависи
   от това дали друг файл се е заредил. */
(function () {
  "use strict";

  var textBtn = document.getElementById("fast-text");
  if (!textBtn) return;

  var FORM_TARGET = "rusev.miro@gmail.com";
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/" + FORM_TARGET;

  var fieldsWrap = document.getElementById("text-fields");
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

  textBtn.addEventListener("click", function () {
    /* ако гласовият запис тече, спираме го през собствения му бутон —
       той си знае как да прибере микрофона и таймера чисто */
    if (recBtn && recBtn.classList.contains("recording")) recBtn.click();
    if (voiceFieldsWrap) voiceFieldsWrap.hidden = true;
    fieldsWrap.hidden = false;
    collapseHeroIntro();
    pinHeroPhoto();

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

  /* Обратната посока: кликне ли се "Поръчай с глас", докато текстовите
     полета стоят отворени, ги прибираме — иначе двете форми се виждат
     едновременно. voice-order.js не знае нищо за този файл, слушаме тук. */
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
    /* Име и имейл НЕ се искат тук — Stripe ги събира на своята страница.
       Съгласието по чл. 57 обаче остава преди плащането: клиентът се отказва
       от правото на връщане, това не може да се потвърждава след факта. */

    var orderNo = genOrderNo();
    var occasion = selectedOccasion();
    var styles = selectedStyles();
    var language = document.getElementById("text-language").value;

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
      "Стилове": styles.length ? styles.join(", ") : "— не са избрани, виж разказа",
      "Език": language,
      "Разказ": story,
      "Съгласие чл. 57 ЗЗП (без право на отказ)": "потвърдено преди плащането",
      "CLAUDE BRIEF": [
        "# Бърза текстова поръчка — " + orderNo,
        "",
        "СЪСТОЯНИЕ: очаква плащане. Свери в Stripe по " + orderNo,
        "преди да започнеш работа.",
        "",
        "Повод: " + (occasion || "— не е избран, виж разказа"),
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

    fetch(FORM_ENDPOINT, { method: "POST", headers: { "Accept": "application/json" }, body: fd })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(toPayment)
      .catch(toPayment);
  });
})();
