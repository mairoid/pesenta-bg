/* Песента — поръчков wizard: стъпки, валидация, промо кодове, изпращане на заявка */
(function () {
  "use strict";

  /* ============ Конфигурация (редактирай тук) ============ */

  var FORM_ENDPOINT = "https://formsubmit.co/ajax/rusev.miro@gmail.com";
  var ORDER_EMAIL = "rusev.miro@gmail.com";
  var BGN_RATE = 1.95583;

  var PLANS = {
    mini: { label: "Мини", price: 9.9, desc: "кратка песен до 2 мин, 1 стил, 1 версия, MP3" },
    solo: { label: "Соло", price: 24.9, desc: "1 песен, 1 стил, 2 версии, 1 корекция" },
    hit: { label: "Хит", price: 39.9, desc: "2 стила, до 4 версии, лирик видео, 3 корекции" },
    spektakal: { label: "Спектакъл", price: 69.9, desc: "3 стила, 2 варианта на текста, лично съгласуване" }
  };
  var EXPRESS_PRICE = 9.9;

  /* Повод от URL (?povod=...) → чип във формата */
  var POVOD_MAP = {
    "rojden-den": "Рожден ден",
    "svatba": "Сватба",
    "ergensko": "Ергенско / Моминско",
    "godishnina": "Годишнина",
    "bebe": "Бебе / Кръщене",
    "firmeno": "Фирмено събитие"
  };

  /* Промо кодове: код → процент отстъпка */
  var PROMOS = {
    "PESEN10": 10,
    "PRIYATELI20": 20
  };

  /* ============ Състояние ============ */

  var state = {
    step: 1,
    plan: "hit",
    express: false,
    promoCode: null,
    promoPct: 0
  };
  var TOTAL_STEPS = 3;

  var form = document.getElementById("order-form");
  var errBox = document.getElementById("form-error");
  var btnNext = document.getElementById("btn-next");
  var btnBack = document.getElementById("btn-back");

  /* ============ Помощни ============ */

  function eur(n) {
    return "€" + n.toFixed(2).replace(".", ",");
  }
  function bgn(n) {
    return (n * BGN_RATE).toFixed(2).replace(".", ",") + " лв.";
  }
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }
  function chipValues(containerId) {
    return Array.prototype.map.call(
      document.querySelectorAll("#" + containerId + " .chip.selected"),
      function (c) { return c.getAttribute("data-value"); }
    );
  }
  function showError(msg) {
    errBox.textContent = msg;
    errBox.classList.add("show");
  }
  function clearError() {
    errBox.textContent = "";
    errBox.classList.remove("show");
  }

  /* ============ Чипове ============ */

  document.querySelectorAll(".chips").forEach(function (group) {
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
      if (group.id === "style-chips") updateStyleCount();
      saveDraft();
    });
  });

  function updateStyleCount() {
    var n = chipValues("style-chips").length;
    var el = document.getElementById("style-count");
    if (el) el.textContent = "Избрани стилове: " + n;
  }

  /* ============ Пакети ============ */

  var planPick = document.getElementById("plan-pick");

  function selectPlan(plan) {
    if (!PLANS[plan]) return;
    state.plan = plan;
    planPick.querySelectorAll(".plan-option").forEach(function (opt) {
      opt.classList.toggle("selected", opt.getAttribute("data-plan") === plan);
    });
    renderSummary();
    saveDraft();
  }

  planPick.addEventListener("click", function (e) {
    var opt = e.target.closest(".plan-option");
    if (opt) selectPlan(opt.getAttribute("data-plan"));
  });
  planPick.addEventListener("keydown", function (e) {
    var opt = e.target.closest(".plan-option");
    if (opt && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      selectPlan(opt.getAttribute("data-plan"));
    }
  });

  document.getElementById("express").addEventListener("change", function (e) {
    state.express = e.target.checked;
    renderSummary();
    saveDraft();
  });

  /* ============ Промо код ============ */

  var promoMsg = document.getElementById("promo-msg");

  document.getElementById("promo-apply").addEventListener("click", applyPromo);
  document.getElementById("promo").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); applyPromo(); }
  });

  function applyPromo() {
    var code = val("promo").toUpperCase();
    if (!code) {
      state.promoCode = null;
      state.promoPct = 0;
      promoMsg.textContent = "";
      promoMsg.className = "promo-msg";
      renderSummary();
      return;
    }
    if (PROMOS[code]) {
      state.promoCode = code;
      state.promoPct = PROMOS[code];
      promoMsg.textContent = "✔ Кодът е приложен: −" + state.promoPct + "% отстъпка";
      promoMsg.className = "promo-msg ok";
    } else {
      state.promoCode = null;
      state.promoPct = 0;
      promoMsg.textContent = "✖ Невалиден промо код";
      promoMsg.className = "promo-msg err";
    }
    renderSummary();
    saveDraft();
  }

  /* ============ Обобщение на цената ============ */

  function calcTotal() {
    var base = PLANS[state.plan].price;
    var express = state.express ? EXPRESS_PRICE : 0;
    var sub = base + express;
    var discount = sub * (state.promoPct / 100);
    return { base: base, express: express, sub: sub, discount: discount, total: sub - discount };
  }

  function renderSummary() {
    var box = document.getElementById("order-summary");
    var t = calcTotal();
    var html = "";
    html += '<div class="row"><span>Пакет „' + PLANS[state.plan].label + '“</span><span>' + eur(t.base) + "</span></div>";
    if (t.express) {
      html += '<div class="row"><span>Експресна изработка (24 ч)</span><span>' + eur(t.express) + "</span></div>";
    }
    if (t.discount > 0) {
      html += '<div class="row discount"><span>Промо код ' + state.promoCode + " (−" + state.promoPct + "%)</span><span>−" + eur(t.discount) + "</span></div>";
    }
    html += '<div class="row total"><span>Общо</span><span>' + eur(t.total) + " <small style=\"color:var(--muted);font-size:0.75em;font-weight:400;\">(" + bgn(t.total) + ")</small></span></div>";
    html += '<div class="row" style="font-size:0.85rem;"><span>Плащане след одобрение — фактура при завършена поръчка</span><span></span></div>';
    box.innerHTML = html;
  }

  /* ============ Навигация между стъпките ============ */

  function goTo(step) {
    state.step = step;
    document.querySelectorAll(".wizard-step").forEach(function (s) {
      s.classList.toggle("current", Number(s.getAttribute("data-step")) === step);
    });
    document.querySelectorAll(".wizard-progress .seg").forEach(function (seg) {
      seg.classList.toggle("active", Number(seg.getAttribute("data-seg")) <= step);
    });
    btnBack.style.visibility = step === 1 ? "hidden" : "visible";
    btnNext.textContent = step === TOTAL_STEPS ? "Изпрати заявката" : "Напред →";
    clearError();
    if (step === 3) {
      renderSummary();
      renderReview();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* Задължителни са само име, имейл и съгласие — всичко останало е по желание */
  function validateStep(step) {
    if (step === 3) {
      if (!val("cust-name")) return "Напиши името си — трябва ни за фактурата и демото.";
      var email = val("cust-email");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Въведи валиден имейл — там ще получиш демото.";
      if (!document.getElementById("consent").checked) return "Моля, потвърди, че си запознат с Общите условия.";
      if (!document.getElementById("consent-digital").checked) return "Моля, потвърди изричното съгласие за започване на изпълнението (загуба на правото на отказ) — без него не можем да стартираме поръчката.";
    }
    return null;
  }

  btnNext.addEventListener("click", function () {
    var err = validateStep(state.step);
    if (err) { showError(err); return; }
    if (state.step < TOTAL_STEPS) {
      goTo(state.step + 1);
    } else {
      submitOrder();
    }
  });

  btnBack.addEventListener("click", function () {
    if (state.step > 1) goTo(state.step - 1);
  });

  /* ============ Преглед преди изпращане ============ */

  function collectData() {
    return {
      occasion: chipValues("occasion-chips")[0] || "",
      recipient: val("recipient"),
      relation: val("relation"),
      event_date: val("event-date"),
      story: val("story"),
      qualities: val("qualities"),
      jokes: val("jokes"),
      must_have: val("must-have"),
      avoid: val("avoid"),
      styles: chipValues("style-chips"),
      mood: chipValues("mood-chips")[0] || "",
      tempo: chipValues("tempo-chips")[0] || "",
      voice: chipValues("voice-chips")[0] || "",
      language: val("language"),
      reference: val("reference"),
      explicit: document.getElementById("explicit").checked,
      name: val("cust-name"),
      email: val("cust-email"),
      phone: val("cust-phone"),
      notes: val("notes")
    };
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function renderReview() {
    var d = collectData();
    var t = calcTotal();
    var rows = [
      ["Повод", d.occasion || "—"],
      ["За", (d.recipient || "—") + (d.relation ? " (" + d.relation + ")" : "")],
      ["Събитие", d.event_date || "—"],
      ["Стилове", d.styles.join(", ") || "по препоръка на продуцента"],
      ["Настроение", d.mood || "—"],
      ["Вокал", d.voice || "—"],
      ["Нецензурни изрази", d.explicit ? "разрешени (18+)" : "не"],
      ["Пакет", PLANS[state.plan].label + (state.express ? " + Експрес 24ч" : "")],
      ["Общо", eur(t.total) + " (" + bgn(t.total) + ")" + (state.promoCode ? " с код " + state.promoCode : "")]
    ];
    var html = "<h3>Преглед на заявката</h3><dl>";
    rows.forEach(function (r) {
      html += "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>";
    });
    html += "</dl>";
    document.getElementById("review-box").innerHTML = html;
  }

  /* ============ Claude бриф (за композиране на текста и стила) ============ */

  function buildBrief(d, orderNo) {
    var t = calcTotal();
    return [
      "# Бриф за песен — " + orderNo,
      "",
      "## Повод и получател",
      "- Повод: " + (d.occasion || "не е посочен"),
      "- Получател: " + (d.recipient || "не е посочен") + (d.relation ? " (" + d.relation + " на клиента)" : ""),
      "- Дата на събитието: " + (d.event_date || "не е посочена"),
      "",
      "## Историята",
      d.story || "—",
      "",
      "## Качества и навици",
      d.qualities || "—",
      "",
      "## Смешни случки и вътрешни шеги",
      d.jokes || "—",
      "",
      "## Задължителни думи/имена",
      d.must_have || "—",
      "",
      "## Да се избягва",
      d.avoid || "—",
      "",
      "## Музикални указания",
      "- Стилове: " + (d.styles.join(", ") || "по преценка на продуцента"),
      "- Настроение: " + (d.mood || "по преценка"),
      "- Темпо: " + (d.tempo || "по преценка"),
      "- Вокал: " + (d.voice || "по преценка"),
      "- Език: " + d.language,
      "- Референция: " + (d.reference || "—"),
      "- Нецензурни изрази: " + (d.explicit ? "РАЗРЕШЕНИ (клиентът е дал изрично съгласие, 18+)" : "НЕ — текстът да е напълно цензурен"),
      "",
      "## Пакет",
      "- " + PLANS[state.plan].label + " (" + PLANS[state.plan].desc + ")" + (state.express ? " + Експрес 24ч" : ""),
      "- Обща цена: " + eur(t.total) + (state.promoCode ? " (промо код " + state.promoCode + ", −" + state.promoPct + "%)" : ""),
      "",
      "## Бележки от клиента",
      d.notes || "—"
    ].join("\n");
  }

  /* ============ Изпращане ============ */

  function genOrderNo() {
    var now = new Date();
    var y = String(now.getFullYear()).slice(2);
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    var rand = String(Math.floor(1000 + Math.random() * 9000));
    return "PSN-" + y + m + day + "-" + rand;
  }

  function submitOrder() {
    var err = validateStep(5);
    if (err) { showError(err); return; }

    var d = collectData();
    var t = calcTotal();
    var orderNo = genOrderNo();
    var brief = buildBrief(d, orderNo);

    var payload = {
      _subject: "Нова заявка за песен — " + orderNo,
      _template: "box",
      "Номер на заявка": orderNo,
      "Клиент": d.name,
      "Имейл": d.email,
      "Телефон": d.phone || "—",
      "Повод": d.occasion || "—",
      "Получател": (d.recipient || "—") + (d.relation ? " (" + d.relation + ")" : ""),
      "Дата на събитието": d.event_date || "—",
      "Стилове": d.styles.join(", ") || "по преценка",
      "Настроение / Темпо / Вокал": (d.mood || "—") + " / " + (d.tempo || "—") + " / " + (d.voice || "—"),
      "Език": d.language,
      "Референция": d.reference || "—",
      "Нецензурни изрази (18+)": d.explicit ? "ДА — разрешени" : "не",
      "Съгласие чл. 57 ЗЗП (без право на отказ)": "потвърдено",
      "Линк за плащане (изпрати след одобрение)": "https://pesenta.bg/plati.html?order=" + orderNo + "&plan=" + state.plan + (state.express ? "&express=1" : ""),
      "Пакет": PLANS[state.plan].label + (state.express ? " + Експрес 24ч" : ""),
      "Промо код": state.promoCode ? state.promoCode + " (−" + state.promoPct + "%)" : "—",
      "Обща цена": eur(t.total) + " / " + bgn(t.total),
      "Бележки": d.notes || "—",
      "CLAUDE BRIEF": brief
    };

    btnNext.disabled = true;
    btnNext.textContent = "Изпращане…";

    fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function () {
        onSuccess(orderNo, t);
      })
      .catch(function () {
        /* Резервен вариант: имейл клиент с попълнен бриф */
        btnNext.disabled = false;
        btnNext.textContent = "Изпрати заявката";
        var mailto =
          "mailto:" + ORDER_EMAIL +
          "?subject=" + encodeURIComponent("Нова заявка за песен — " + orderNo) +
          "&body=" + encodeURIComponent(brief);
        showError("Няма връзка със сървъра за заявки. Данните ти са запазени на това устройство — можеш да опиташ пак след минута.");
        errBox.innerHTML +=
          ' <a href="' + mailto + '" style="color:#ffd36e;font-weight:700;">Или изпрати заявката през имейл приложението си →</a>';
      });
  }

  function onSuccess(orderNo, t) {
    /* запази в „Моите заявки“ */
    try {
      var orders = JSON.parse(localStorage.getItem("pesenta_orders") || "[]");
      orders.unshift({
        no: orderNo,
        date: new Date().toISOString().slice(0, 10),
        plan: PLANS[state.plan].label + (state.express ? " + Експрес" : ""),
        total: eur(t.total),
        status: "Приета"
      });
      localStorage.setItem("pesenta_orders", JSON.stringify(orders));
      localStorage.removeItem("pesenta_draft");
    } catch (e) { /* localStorage недостъпен — не е фатално */ }

    document.getElementById("success-no").textContent = orderNo;
    document.getElementById("success-eta").textContent = state.express ? "24 часа" : "48 часа";
    form.hidden = true;
    document.querySelector(".wizard-progress").hidden = true;
    document.querySelector(".order-head").hidden = true;
    document.getElementById("success-box").hidden = false;
    renderMyOrders();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ============ Моите заявки ============ */

  function renderMyOrders() {
    var wrap = document.getElementById("my-orders");
    var list = document.getElementById("orders-list");
    var orders = [];
    try {
      orders = JSON.parse(localStorage.getItem("pesenta_orders") || "[]");
    } catch (e) { orders = []; }
    if (!orders.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    list.innerHTML = orders
      .map(function (o) {
        return (
          '<div class="order-item">' +
          '<span class="no">' + esc(o.no) + "</span>" +
          '<span class="meta">' + esc(o.date) + " · " + esc(o.plan) + " · " + esc(o.total) + "</span>" +
          '<span class="status-pill">' + esc(o.status) + "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  /* ============ Чернова (autosave) ============ */

  var DRAFT_FIELDS = ["recipient", "relation", "event-date", "story", "qualities", "jokes", "must-have", "avoid", "language", "reference", "cust-name", "cust-email", "cust-phone", "notes", "promo"];
  var CHIP_GROUPS = ["occasion-chips", "style-chips", "mood-chips", "tempo-chips", "voice-chips"];

  function saveDraft() {
    try {
      var draft = { fields: {}, chips: {}, plan: state.plan, express: state.express, explicit: document.getElementById("explicit").checked };
      DRAFT_FIELDS.forEach(function (id) { draft.fields[id] = val(id); });
      CHIP_GROUPS.forEach(function (id) { draft.chips[id] = chipValues(id); });
      localStorage.setItem("pesenta_draft", JSON.stringify(draft));
    } catch (e) { /* ок */ }
  }

  function restoreDraft() {
    var raw;
    try { raw = localStorage.getItem("pesenta_draft"); } catch (e) { return; }
    if (!raw) return;
    try {
      var draft = JSON.parse(raw);
      Object.keys(draft.fields || {}).forEach(function (id) {
        var el = document.getElementById(id);
        if (el && draft.fields[id]) el.value = draft.fields[id];
      });
      Object.keys(draft.chips || {}).forEach(function (gid) {
        (draft.chips[gid] || []).forEach(function (v) {
          var chip = document.querySelector("#" + gid + ' .chip[data-value="' + v.replace(/"/g, '\\"') + '"]');
          if (chip) chip.classList.add("selected");
        });
      });
      if (draft.plan && PLANS[draft.plan]) state.plan = draft.plan;
      if (draft.express) {
        state.express = true;
        document.getElementById("express").checked = true;
      }
      if (draft.explicit) document.getElementById("explicit").checked = true;
      updateStyleCount();
    } catch (e) { /* повредена чернова — игнорирай */ }
  }

  form.addEventListener("input", saveDraft);

  /* ============ Инициализация ============ */

  /* предизбрани план и повод от URL: poruchka.html?plan=hit&povod=svatba */
  var params = new URLSearchParams(window.location.search);
  var urlPlan = params.get("plan");
  var urlPovod = params.get("povod");

  restoreDraft();
  if (urlPovod && POVOD_MAP[urlPovod] && chipValues("occasion-chips").length === 0) {
    var povodChip = document.querySelector('#occasion-chips .chip[data-value="' + POVOD_MAP[urlPovod] + '"]');
    if (povodChip) povodChip.classList.add("selected");
  }
  selectPlan(urlPlan && PLANS[urlPlan] ? urlPlan : state.plan);
  renderSummary();
  renderMyOrders();

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
