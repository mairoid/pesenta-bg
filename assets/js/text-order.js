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
    storyEl.focus();
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
    var name = document.getElementById("text-name").value.trim();
    var email = document.getElementById("text-email").value.trim();
    if (!story) { fail("Разкажи накратко за кого е песента и повода."); return; }
    if (!name) { fail("Напиши името си."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { fail("Въведи валиден имейл — там ще получиш песента."); return; }
    if (!document.getElementById("text-consent").checked) {
      fail("Моля, потвърди съгласието с Общите условия."); return;
    }

    var orderNo = genOrderNo();
    var occasion = selectedOccasion();
    var styles = selectedStyles();
    var language = document.getElementById("text-language").value;

    var fields = {
      "_subject": "БЪРЗА текстова заявка за песен — " + orderNo,
      "_template": "box",
      "Номер на заявка": orderNo,
      "Тип": "Бърза текстова поръчка",
      "Клиент": name,
      "Имейл": email,
      "Повод": occasion || "— не е избран, виж разказа",
      "Стилове": styles.length ? styles.join(", ") : "— не са избрани, виж разказа",
      "Език": language,
      "Разказ": story,
      "Съгласие чл. 57 ЗЗП (без право на отказ)": "потвърдено",
      "CLAUDE BRIEF": [
        "# Бърза текстова поръчка — " + orderNo,
        "",
        "Клиент: " + name + " <" + email + ">",
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
    sendBtn.textContent = "Изпращане…";

    var fd = new FormData();
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });

    fetch(FORM_ENDPOINT, { method: "POST", headers: { "Accept": "application/json" }, body: fd })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function () {
        if (window.plausible) window.plausible("Order Submitted", { props: { method: "text-quick" } });
        card.innerHTML =
          '<div class="success-box" style="padding:1.5rem 1rem;">' +
          '<div class="check"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16091c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg></div>' +
          "<h2>Бързата поръчка е приета!</h2>" +
          '<div class="order-no">' + esc(orderNo) + "</div>" +
          "<p>Разказът ти стигна до нас. До няколко часа получаваш имейл с потвърждение и фактура. Щом плащането постъпи, песента е готова до 48 часа.</p>" +
          "</div>";
        card.scrollIntoView({ behavior: "smooth" });
      })
      .catch(function () {
        sendBtn.disabled = false;
        sendBtn.textContent = "Изпрати бързата поръчка";
        fail("Няма връзка със сървъра за заявки — опитай пак след минута.");
      });
  });
})();
