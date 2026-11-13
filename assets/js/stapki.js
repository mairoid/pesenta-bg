/* poruchay.html — по един въпрос на екран (13.11.2026).
   Изпращането, черновата, брифът и плащането са в order.js и не се пипат оттук.
   Този файл само води човека през стъпките: чипове вместо падащо меню, само
   преминаване напред след избор, подсказки за разказа и брояч на стъпките.
   Зарежда се СЛЕД order.js — тогава черновата вече е възстановена. */
(function () {
  "use strict";

  var form = document.getElementById("order-form");
  var btnNext = document.getElementById("btn-next");
  if (!form || !btnNext) return;
  var stapki = form.querySelectorAll(".wizard-step");
  var OBSHTO = stapki.length;

  function tekushta() {
    var s = form.querySelector(".wizard-step.current");
    return s ? Number(s.getAttribute("data-step")) : 1;
  }

  /* ---------- „Какъв ти е този човек“: чипове върху скритото меню ----------
     order.js чете #relation (select) — и за брифа, и за черновата, и за ?za=.
     Затова менюто остава в страницата, а чиповете само му задават стойността. */
  var relSelect = document.getElementById("relation");
  var relChips = document.getElementById("relation-chips");
  function relKamChipove() {
    if (!relSelect || !relChips) return;
    relChips.querySelectorAll(".chip").forEach(function (c) {
      c.classList.toggle("selected", c.getAttribute("data-value") === relSelect.value);
    });
  }
  if (relSelect && relChips) {
    relKamChipove();
    relChips.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      /* order.js вече е превключил .selected (слуша всички .chips) */
      relSelect.value = chip.classList.contains("selected") ? chip.getAttribute("data-value") : "";
      /* input, не change: черновата в order.js се пази на input на формата */
      relSelect.dispatchEvent(new Event("input", { bubbles: true }));
      /* На телефон полето за името е под дванайсетте чипа, извън екрана. След
         избора то идва в средата — иначе човек вижда само чиповете и „Напред“. */
      var ime = document.getElementById("recipient");
      if (ime && !ime.value && chip.classList.contains("selected")) {
        ime.scrollIntoView({ block: "center", behavior: "smooth" });
        ime.focus({ preventScroll: true });
      }
    });
  }

  /* ---------- Език: няколко наведнъж ----------
     order.js чете #language като текст (бриф, писмо, чернова). Чиповете пишат
     там „Български + Английски“. Без нито един избран остава български — песен
     без език няма. При връщане с чернова чиповете се палят от записания текст. */
  var ezikPole = document.getElementById("language");
  var ezikChips = document.getElementById("language-chips");
  var ezikRed = document.getElementById("language-izbor");
  function ezikOtPole() {
    if (!ezikPole || !ezikChips) return;
    var izbrani = (ezikPole.value || "Български").split(" + ");
    ezikChips.querySelectorAll(".chip").forEach(function (c) {
      c.classList.toggle("selected", izbrani.indexOf(c.getAttribute("data-value")) !== -1);
    });
    if (!ezikChips.querySelector(".chip.selected")) ezikChips.querySelector(".chip").classList.add("selected");
    ezikKamPole(true);
  }
  function ezikKamPole(tiho) {
    var izbrani = Array.prototype.map.call(ezikChips.querySelectorAll(".chip.selected"), function (c) { return c.getAttribute("data-value"); });
    if (!izbrani.length) {
      ezikChips.querySelector(".chip").classList.add("selected");
      izbrani = ["Български"];
    }
    ezikPole.value = izbrani.join(" + ");
    if (ezikRed) ezikRed.textContent = izbrani.length > 1 ? "Песента ще смесва: " + izbrani.join(" + ") : "Песента ще е на: " + izbrani[0];
    if (!tiho) ezikPole.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (ezikPole && ezikChips) {
    ezikOtPole();
    ezikChips.addEventListener("click", function (e) { if (e.target.closest(".chip")) ezikKamPole(false); });
  }

  /* ---------- Напред сам след избор ----------
     Само където на екрана има един въпрос с един отговор (data-auto). Кратко
     забавяне, за да се види кой чип е избран, преди екранът да се смени. */
  form.querySelectorAll(".chips[data-auto]").forEach(function (group) {
    group.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      /* Върнал се човек с пазена чернова натиска вече избрания чип, за да продължи.
         order.js току-що го е изключил (превключва при всяко натискане) — тук изборът
         се връща: на този екран второто натискане значи „да, този“, не „махни го“. */
      if (!chip.classList.contains("selected")) {
        chip.classList.add("selected");
        group.dispatchEvent(new Event("input", { bubbles: true }));
      }
      var ot = tekushta();
      setTimeout(function () { if (tekushta() === ot) btnNext.click(); }, 260);
    });
  });

  /* ---------- Поводите: най-честите отпред, останалите зад бутон ----------
     27 чипа са два екрана на телефон преди следващия въпрос. Ако човекът идва
     с ?povod=, order.js вече е свил списъка по своя начин (.svito) — тогава
     нашето свиване не се включва, за да няма два бутона. */
  /* Същото важи и за роднинствата на първия екран (дванайсет чипа бутаха полето
     за името под екрана). Всеки бутон казва в data-za коя група разгъва. Избран
     рядък чип се вижда и в свито състояние — виж .kratko в страницата. */
  form.querySelectorAll(".povod-oshte[data-za]").forEach(function (oshteBtn) {
    var grupa = document.getElementById(oshteBtn.getAttribute("data-za"));
    if (!grupa) return;
    if (grupa.classList.contains("svito")) { oshteBtn.hidden = true; return; }
    grupa.classList.add("kratko");
    oshteBtn.addEventListener("click", function () {
      grupa.classList.remove("kratko");
      oshteBtn.hidden = true;
    });
  });

  /* ---------- Името в заглавието на разказа ---------- */
  var imeEl = document.getElementById("recipient");
  var zaglRazkaz = document.getElementById("zagl-razkaz");
  function imeVZaglavie() {
    if (!zaglRazkaz) return;
    var ime = imeEl ? imeEl.value.trim() : "";
    zaglRazkaz.textContent = ime ? "Разкажи ни за " + ime : "Разкажи ни за човека";
  }
  if (imeEl) {
    imeEl.addEventListener("input", imeVZaglavie);
    /* Enter в единственото поле на екрана значи „напред“, не изпращане */
    imeEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); btnNext.click(); }
    });
  }
  imeVZaglavie();

  /* ---------- Подсказки за разказа ----------
     Празното поле е най-трудният въпрос във формата. Подсказката слага начало
     на ред в полето — човек довършва изречение, вместо да започва от нищо. */
  var story = document.getElementById("story");
  form.querySelectorAll(".podskazka").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!story) return;
      var nachalo = b.getAttribute("data-nachalo") || "";
      var v = story.value;
      story.value = v + (v && !/\n$/.test(v) ? "\n" : "") + nachalo;
      story.dispatchEvent(new Event("input", { bubbles: true }));
      story.focus();
      story.setSelectionRange(story.value.length, story.value.length);
      b.classList.add("polzvana");
    });
  });

  /* ---------- Брояч и надписи на бутоните ----------
     order.js сменя .current; тук само се следи. На първия екран „Назад“ не
     заема място, а на последния бутонът носи сумата. */
  var broyach = document.getElementById("stapka-broi");
  var btnBack = document.getElementById("btn-back");
  var nav = form.querySelector(".wizard-nav");
  var predishna = tekushta(), otIstoriya = false;
  function osvezhi() {
    var n = tekushta();
    if (broyach && broyach.textContent !== "Стъпка " + n + " от " + OBSHTO) broyach.textContent = "Стъпка " + n + " от " + OBSHTO;
    if (nav) nav.classList.toggle("parva", n === 1);
    form.classList.toggle("posledna", n === OBSHTO);
    /* Системният бутон „назад“ на телефона. Без запис в историята той изхвърля
       човека от формата насред въпросите; с него връща един въпрос назад. */
    if (n > predishna && !otIstoriya) { try { history.pushState({ stapka: n }, ""); } catch (e) { /* без история */ } }
    predishna = n; otIstoriya = false;
    if (btnBack) btnBack.textContent = "←";
    if (n === OBSHTO) {
      /* докато върви изпращането, order.js пише друго на бутона — не го затриваме */
      if (btnNext.disabled) return;
      var suma = form.querySelector("#order-summary .row.total span:last-child");
      var nadpis = "Продължи към плащане";
      /* order.js пише „€19,90“; навсякъде другаде в сайта е „19,90 €“ */
      var sumaTekst = suma ? suma.textContent.trim().replace(/^€\s*([\d.,]+)$/, "$1 €") : "";
      var iskan = sumaTekst ? nadpis + " · " + sumaTekst : nadpis;
      /* сравнението пази от безкраен цикъл: смяната на текста не е смяна на клас,
         но обобщението се преначертава и вика osvezhi отново */
      if (btnNext.textContent !== iskan) btnNext.textContent = iskan;
    }
  }
  new MutationObserver(osvezhi).observe(form, { subtree: true, attributes: true, attributeFilter: ["class"] });
  var summary = document.getElementById("order-summary");
  if (summary) new MutationObserver(osvezhi).observe(summary, { childList: true, subtree: true });
  if (btnBack) btnBack.setAttribute("aria-label", "Назад");
  window.addEventListener("popstate", function () {
    if (tekushta() > 1 && btnBack && !form.hidden) { otIstoriya = true; btnBack.click(); }
  });
  osvezhi();
})();
