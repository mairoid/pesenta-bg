/* Песента — бърза текстова поръчка: полетата излизат на СЪЩИЯ екран,
   без прехвърляне към poruchka.html. От 05.09.2026 това е ЕДИНСТВЕНИЯТ
   път за поръчка от началната страница. Гласовата бърза поръчка
   (voice-order.js) отпадна на 14.09.2026; от 14.10.2026 гласът е и тук — като
   „Или го разкажи с глас“ под полето за разказа (виж „Гласов разказ“ долу).

   Собствени копия на помощните функции: пътят, по който влизат
   поръчките, не бива да зависи от това дали друг файл се е заредил. */
(function () {
  "use strict";

  var textBtn = document.getElementById("fast-text");
  if (!textBtn) return;

  /* Английската версия (en/, 13.10.2026) ползва СЪЩИЯ файл: двата езика се
     различават само по надписите, а пътят на поръчката трябва да е един —
     поправка тук да важи и за двете. Брифът към нас остава на български. */
  var EN = document.documentElement.lang === "en";
  function t(bg, en) { return EN ? en : bg; }

  var FORM_TARGET = "rusev.miro@gmail.com";
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/" + FORM_TARGET;
  /* Нативният ендпойнт — само за снимките: AJAX-ът дава 500 при прикачен файл (проба
     23.09.2026). Заявката е multipart с mode no-cors: отговорът е непрозрачен, но писмото
     тръгва; FormSubmit пази по един файл на име на поле, затова snimka_1..3. */
  var FORM_ENDPOINT_NATIVE = "https://formsubmit.co/" + FORM_TARGET;
  /* Втори, независим път за разказа. FormSubmit е трета страна на безплатен
     план; тук записът е наш и стои при поръчката в базата. */
  var BRIEF_ENDPOINT = "https://pesenta-nap.pesenta-nap.workers.dev/brief";
  var SNIMKI_ENDPOINT = "https://pesenta-nap.pesenta-nap.workers.dev/snimki";
  /* Ваучер за песен (15.10.2026): същият Worker — адресът идва от BRIEF_ENDPOINT,
     за да не се зашива втори път. */
  var WORKER = BRIEF_ENDPOINT.replace(/\/brief$/, "");
  /* Проверен код от ваучер: { kod, za_kogo, ot_kogo } или null (обикновената поръчка). */
  var vaucher = null;

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
  var SEND_TEXT = sendBtn.textContent; /* „Продължи към плащане · 19,90 €“ — връща се при махнат код */
  /* Снимки за обложката: [{ blob, name, url }] — смалени копия. Собствено копие на
     функциите от order.js — файловете нарочно не си споделят код (виж главата). */
  var snimki = [];
  var SNIMKI_MAX = 3, SNIMKI_PX = 1600, SNIMKI_MB = 6;
  function smaliSnimka(file) {
    return new Promise(function (res) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        try {
          var k = Math.min(1, SNIMKI_PX / Math.max(img.naturalWidth, img.naturalHeight));
          var c = document.createElement("canvas");
          c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (b) { URL.revokeObjectURL(url); res(b || null); }, "image/jpeg", 0.85);
        } catch (e) { URL.revokeObjectURL(url); res(null); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }
  function renderSnimki() {
    var box = document.getElementById("text-snimki-preview"), st = document.getElementById("text-snimki-status"), add = document.getElementById("text-snimki-add");
    if (!box) return;
    box.innerHTML = "";
    var kb = 0;
    snimki.forEach(function (s, i) {
      kb += s.blob.size / 1024;
      var d = document.createElement("div"); d.className = "snimki-thumb";
      var im = document.createElement("img"); im.src = s.url; im.alt = "Снимка " + (i + 1);
      var x = document.createElement("button"); x.type = "button"; x.className = "snimki-x"; x.setAttribute("aria-label", t("Махни снимка ", "Remove photo ") + (i + 1)); x.textContent = "×";
      x.addEventListener("click", function () { URL.revokeObjectURL(s.url); snimki.splice(i, 1); renderSnimki(); });
      d.appendChild(im); d.appendChild(x); box.appendChild(d);
    });
    if (st) {
      st.classList.remove("err");
      st.textContent = snimki.length
        ? snimki.length + (snimki.length === 1 ? t(" снимка", " photo") : t(" снимки", " photos")) + ", " + Math.round(kb) + t(" KB — пътуват с поръчката.", " KB — they travel with your order.")
        : t("JPG или PNG от телефона — смаляваме ги сами.", "JPG or PNG from your phone — we resize them for you.");
    }
    if (add) { add.textContent = snimki.length ? t("Добави още", "Add more") : t("Добави снимки", "Add photos"); add.hidden = snimki.length >= SNIMKI_MAX; }
  }
  (function () {
    var inp = document.getElementById("text-snimki"), add = document.getElementById("text-snimki-add"), st = document.getElementById("text-snimki-status");
    if (!inp || !add) return;
    add.addEventListener("click", function () { inp.click(); });
    inp.addEventListener("change", function () {
      var files = Array.prototype.slice.call(inp.files || []);
      inp.value = "";
      var mesta = SNIMKI_MAX - snimki.length, predupr = null;
      if (files.length > mesta) { files = files.slice(0, mesta); predupr = t("До " + SNIMKI_MAX + " снимки — взехме първите " + mesta + ".", "Up to " + SNIMKI_MAX + " photos — we took the first " + mesta + "."); }
      if (!files.length) return;
      add.disabled = true;
      Promise.all(files.map(function (f) {
        return smaliSnimka(f).then(function (b) {
          if (!b && f.size <= SNIMKI_MB * 1048576) b = f;
          if (!b) { predupr = t("„" + f.name + "“ не се отваря или е над " + SNIMKI_MB + " MB — пробвай друга.", "“" + f.name + "” won't open or is over " + SNIMKI_MB + " MB — try another one."); return; }
          snimki.push({ blob: b, name: f.name, url: URL.createObjectURL(b) });
        });
      })).then(function () {
        add.disabled = false; renderSnimki();
        if (predupr && st) { st.textContent = predupr + " " + st.textContent; st.classList.add("err"); }
      });
    });
  })();
  /* ============ Гласов разказ (14.10.2026) ============ */
  /* Едно и също натискане прави две неща: записва гласа (MediaRecorder) и изписва
     думите в полето за разказа (Web Speech API), за да ги види клиентът и да ги
     поправи. Без разпознаване (напр. Firefox) остава само записът — пак стига до нас.
     Мястото на гласа е тук, в полето, а не отделна „гласова поръчка“: тя плашеше
     (отпадна на 14.09.2026). Логиката е по „Разкажи с гласово“ от order.js. */
  var glasBlob = null;
  var GLAS_MAX_S = 180; /* 3 минути — стига за история, а файлът остава малък */
  function glasExt(b) {
    var ty = b && b.type ? b.type : "";
    if (ty.indexOf("ogg") > -1) return "ogg";
    if (ty.indexOf("mp4") > -1 || ty.indexOf("m4a") > -1) return "m4a";
    return "webm";
  }
  (function () {
    var box = document.getElementById("text-glas");
    if (!box || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return;
    var btn = document.getElementById("text-glas-btn"), label = document.getElementById("text-glas-label");
    var st = document.getElementById("text-glas-status"), play = document.getElementById("text-glas-play");
    var audio = document.getElementById("text-glas-audio"), del = document.getElementById("text-glas-del");
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = null, mr = null, stream = null, chunks = [], zapisva = false, osnova = "", gotovo = "", timer = null, sekundi = 0;
    box.hidden = false;

    function status(msg, cls) { st.textContent = msg; st.className = "voice-status" + (cls ? " " + cls : ""); }
    function mmss(s) { return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

    function spri() {
      zapisva = false;
      clearInterval(timer);
      btn.classList.remove("recording");
      label.textContent = glasBlob ? t("Запиши наново", "Record again") : t("Или го разкажи с глас", "Or tell it by voice");
      if (rec) { try { rec.stop(); } catch (e) {} }
      if (mr && mr.state !== "inactive") { try { mr.stop(); } catch (e) {} }
      if (stream) { stream.getTracks().forEach(function (x) { x.stop(); }); stream = null; }
    }

    function zapochni() {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s; chunks = [];
        try { mr = new MediaRecorder(stream); } catch (e) { mr = null; }
        if (mr) {
          mr.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
          mr.onstop = function () {
            if (!chunks.length) return;
            glasBlob = new Blob(chunks, { type: chunks[0].type || "audio/webm" });
            if (window.psnSabitie) window.psnSabitie("Voice Recorded", sekundi + " s" + (SR ? "" : ", без текст"));
            if (audio.src) URL.revokeObjectURL(audio.src);
            audio.src = URL.createObjectURL(glasBlob);
            play.hidden = false;
            label.textContent = t("Запиши наново", "Record again");
            status(t("Записът е готов и идва при нас с поръчката. Прегледай текста горе — можеш да го поправиш.",
                     "Your recording is ready and comes to us with the order. Check the text above — you can edit it."));
          };
          mr.start();
        }
        /* Записът наново замества стария, но текстът, който вече е в полето, остава —
           новите думи се добавят след него. */
        osnova = storyEl.value ? storyEl.value.replace(/\s+$/, "") + " " : "";
        gotovo = "";
        if (SR) {
          rec = new SR();
          rec.lang = EN ? (navigator.language && /^en/i.test(navigator.language) ? navigator.language : "en-US") : "bg-BG";
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = function (ev) {
            var tek = "";
            for (var i = ev.resultIndex; i < ev.results.length; i++) {
              if (ev.results[i].isFinal) gotovo += ev.results[i][0].transcript + " ";
              else tek += ev.results[i][0].transcript;
            }
            storyEl.value = (osnova + gotovo + tek).replace(/[ \t]+/g, " ");
            storyEl.classList.remove("invalid");
          };
          rec.onerror = function (ev) {
            if (ev.error === "not-allowed" || ev.error === "service-not-allowed" || ev.error === "audio-capture") {
              status(t("Думите не се изписват в този браузър, но гласът се записва и идва при нас.",
                       "Your words can't be typed out in this browser, but your voice is recorded and reaches us."), "rec");
            }
          };
          /* Chrome спира разпознаването след пауза — пускаме го пак, докато записът тече */
          rec.onend = function () { if (zapisva) { try { rec.start(); } catch (e) {} } };
          try { rec.start(); } catch (e) {}
        }
        zapisva = true; sekundi = 0;
        if (window.psnSabitie) window.psnSabitie("Voice Start", SR ? "с текст" : "само запис");
        btn.classList.add("recording");
        label.textContent = t("Спри записа", "Stop recording");
        var podskazka = SR ? t("Слушам… Думите ти се появяват горе.", "Listening… your words appear above.")
                           : t("Записвам гласа ти.", "Recording your voice.");
        status(podskazka + " 0:00", "rec");
        timer = setInterval(function () {
          sekundi++;
          if (sekundi >= GLAS_MAX_S) { spri(); return; }
          if (st.classList.contains("rec") && st.textContent.indexOf(podskazka) === 0) status(podskazka + " " + mmss(sekundi), "rec");
        }, 1000);
      }).catch(function () {
        status(t("Няма достъп до микрофона. Разреши го от браузъра — или просто напиши историята.",
                 "No access to the microphone. Allow it in your browser — or just type the story."), "err");
      });
    }

    btn.addEventListener("click", function () { if (zapisva) spri(); else zapochni(); });
    del.addEventListener("click", function () {
      glasBlob = null;
      if (audio.src) { URL.revokeObjectURL(audio.src); audio.removeAttribute("src"); }
      play.hidden = true;
      label.textContent = t("Или го разкажи с глас", "Or tell it by voice");
      status(t("Записът е изтрит. Текстът в полето остава.", "Recording deleted. The text in the box stays."));
    });
    /* преди касата: ако човек натисне „Продължи“ по време на запис, записът се прибира първо */
    window.__glasSpri = function () {
      if (!zapisva) return Promise.resolve();
      return new Promise(function (res) {
        if (mr && mr.state !== "inactive") { var stara = mr.onstop; mr.onstop = function () { if (stara) stara(); res(); }; }
        else setTimeout(res, 0);
        spri();
        setTimeout(res, 1500);
      });
    };
  })();

  /* Снимките и гласът тръгват в отделна заявка, преди поръчката. Отговорът е непрозрачен (no-cors),
     затова не чакаме повече от 8 секунди — клиентът не бива да стои пред касата заради нас. */
  /* Снимките първо през нашия Worker (20.10.2026): FormSubmit разпознава формата по Referer,
     а вграденият браузър на ChatGPT не го праща — и снимките от chatgpt.com тихо се губеха
     (код 200 със страница за грешка). Worker-ът отговаря истински, затова чакаме отговора
     (до 30 s) и падаме към FormSubmit само ако той откаже. */
  function snimkiKamWorker(orderNo) {
    if (!snimki.length) return Promise.resolve(false);
    var fd = new FormData();
    fd.append("order_no", orderNo);
    fd.append("tip", "бърза");
    snimki.forEach(function (s, i) { fd.append("snimka_" + (i + 1), s.blob, "snimka-" + orderNo + "-" + (i + 1) + ".jpg"); });
    var ac = window.AbortController ? new AbortController() : null;
    var spri = setTimeout(function () { if (ac) ac.abort(); }, 30000);
    sendBtn.textContent = t("Качваме снимките…", "Uploading photos…");
    return fetch(SNIMKI_ENDPOINT, { method: "POST", body: fd, signal: ac ? ac.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : { ok: false }; })
      .then(function (j) { return !!(j && j.ok); })
      .catch(function () { return false; })
      .then(function (ok) { clearTimeout(spri); return ok; });
  }

  function pratiSnimki(orderNo) {
    if (!snimki.length && !glasBlob) return Promise.resolve();
    return snimkiKamWorker(orderNo).then(function (snimkiStignaha) {
      if (snimkiStignaha && !glasBlob) return;
      return pratiPrezFormSubmit(orderNo, snimkiStignaha ? [] : snimki);
    });
  }

  function pratiPrezFormSubmit(orderNo, snimki) {
    if (!snimki.length && !glasBlob) return Promise.resolve();
    var fd = new FormData();
    fd.append("_subject", (glasBlob ? (snimki.length ? "Гласов разказ и снимки — " : "Гласов разказ — ") : "Снимки за обложката — ") + orderNo);
    fd.append("_captcha", "false");
    fd.append("_template", "box");
    fd.append("Към заявка", orderNo);
    fd.append("Тип", (glasBlob ? "Гласов разказ" + (snimki.length ? " и снимки за обложката" : "") : "Снимки за обложката") + " към бърза текстова поръчка");
    if (glasBlob) fd.append("glasovo", glasBlob, "glasovo-" + orderNo + "." + glasExt(glasBlob));
    snimki.forEach(function (s, i) { fd.append("snimka_" + (i + 1), s.blob, "snimka-" + orderNo + "-" + (i + 1) + ".jpg"); });
    return Promise.race([
      /* referrerPolicy изрично: без Referer FormSubmit не приема (вж. горе) — това спасява
         гласовия запис, ако браузърът по подразбиране не го праща. */
      fetch(FORM_ENDPOINT_NATIVE, { method: "POST", mode: "no-cors", body: fd, referrerPolicy: "strict-origin-when-cross-origin" }).catch(function () {}),
      /* гласът е до няколко MB — на мобилни данни качването иска повече време */
      new Promise(function (res) { setTimeout(res, glasBlob ? 25000 : 8000); })
    ]);
  }

  /* Откъде е дошъл човекът — записано от main.js при първата страница. */
  function atr(k) { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }

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

  function rememberOrder(orderNo, plan) {
    try {
      var orders = JSON.parse(localStorage.getItem("pesenta_orders") || "[]");
      orders.unshift({
        no: orderNo,
        date: new Date().toISOString().slice(0, 10),
        plan: plan || "Бърза текстова поръчка",
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
  function paymentUrl(orderNo, email) {
    var cfg = window.PESENTA_PAYMENTS;
    /* Английският сайт има своя връзка (продукт „Custom song“ вместо „Песен по
       поръчка“); докато я няма в payments.js — общата. */
    var link = cfg && cfg.enabled && cfg.paymentLinks &&
               ((EN && cfg.paymentLinks.pesenEn) || cfg.paymentLinks.pesen);
    if (!link) return "plati.html?order=" + encodeURIComponent(orderNo) + "&plan=pesen";
    /* prefilled_email: имейлът от формата идва попълнен в касата (13.10.2026). */
    /* locale (13.10.2026): от българския сайт касата е винаги на български —
       иначе българин с английски браузър вижда „Subtotal“. От английския е
       „auto“: Stripe я показва на езика на клиента, а ако не го поддържа — на
       английски (решение на Мирослав: езикът на държавата, иначе английски). */
    return link + (link.indexOf("?") === -1 ? "?" : "&") +
           "client_reference_id=" + encodeURIComponent(orderNo) +
           (email ? "&prefilled_email=" + encodeURIComponent(email) : "") +
           "&locale=" + (EN ? "auto" : "bg");
  }

  /* Hero-снимката
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
        /* Поводите са в две групи (видимите 8 и „Покажи още поводи“) — изборът е един
           през двете, иначе може да се маркират два повода (21.09.2026). */
        var obhvat = /^text-occasion-chips/.test(group.id) ? document.querySelectorAll("#text-occasion-chips .chip.selected, #text-occasion-chips-more .chip.selected") : group.querySelectorAll(".chip.selected");
        obhvat.forEach(function (c) {
          if (c !== chip) c.classList.remove("selected");
        });
      }
      chip.classList.toggle("selected");
    });
  });

  function selectedOccasion() {
    var el = document.querySelector("#text-occasion-chips .chip.selected, #text-occasion-chips-more .chip.selected");
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
     споделят код (виж главата). Срокът е плосък — 24 часа от сега (до 21.09.2026 беше 48,
     с платен вариант за 24), не работни дни; датите по българско време. При близка дата
     редът кани на имейл или телефон — при възможност песента става още същия ден. */
  function dostavkaDo(sega) {
    return new Date(sega.getTime() + 24 * 3600 * 1000);
  }
  function denBG(d) {
    var loc = t("bg-BG", "en-GB");
    try {
      return d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Sofia" });
    } catch (e) {
      return d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });
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
  /* Английският сайт: езикът на песента идва предложен по езика на браузъра
     (германец вижда „German“), иначе English. Само предложение — сменя се. */
  (function () {
    var sel = document.getElementById("text-language");
    if (!EN || !sel) return;
    var KARTA = { en: "English", bg: "Bulgarian", de: "German", fr: "French", it: "Italian", es: "Spanish",
      el: "Greek", sr: "Serbian", mk: "Macedonian", ro: "Romanian", tr: "Turkish", ru: "Russian", uk: "Ukrainian", ar: "Arabic" };
    var ezitsi = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (var i = 0; i < ezitsi.length; i++) {
      var ime = KARTA[String(ezitsi[i]).slice(0, 2).toLowerCase()];
      if (ime) { sel.value = ime; return; }
    }
  })();

  var eventDateEl = document.getElementById("text-event-date");
  var dostavkaRed = document.getElementById("text-dostavka-red");
  function presmetniDostavka() {
    if (!dostavkaRed) return;
    var sega = new Date();
    var sabitie = dataOtPole(eventDateEl ? eventDateEl.value : "");
    var gotova = dostavkaDo(sega);
    var html, blizo = false;
    if (sabitie === null) {
      html = t("Готова до ", "Ready by ") + "<strong>" + denBG(gotova) + "</strong>.";
    } else {
      var n = sabitie - denNomer(gotova);
      if (n >= 0) {
        var koga = EN
          ? (n === 0 ? "on the day itself" : (n === 1 ? "a day before the event" : n + " days before the event"))
          : (n === 0 ? "в деня на събитието" : (n === 1 ? "ден преди събитието" : n + " дни преди събитието"));
        html = t("Поръчаш ли сега, песента е при теб до ", "Order now and the song is yours by ") + "<strong>" + denBG(gotova) + "</strong> — " + koga + ".";
      } else {
        blizo = true;
        html = t("Датата е близо. Пиши ни на ", "That's soon. Email us at ") + "<a href=\"mailto:sales@pesenta.bg\">sales@pesenta.bg</a>" +
          t(" или се обади на <a href=\"tel:+359899456326\">+359 899 456 326</a>" + (vaucher ? "" : ", преди да платиш") + " — при възможност е готова още същия ден.",
            (vaucher ? " — when we can" : " before you pay — when we can") + ", it's ready the same day.");
      }
    }
    dostavkaRed.innerHTML = html;
    dostavkaRed.classList.toggle("blizo", blizo);
  }
  if (eventDateEl) eventDateEl.addEventListener("change", presmetniDostavka);

  /* ============ Код от ваучер за песен (15.10.2026) ============
     Получателят на ваучер не плаща: проверява кода тук (GET /vaucher/proverka), а
     при изпращане Worker-ът ПЪРВО отбелязва кода като използван (POST
     /vaucher/izpolzvai, атомарно, и записва брифа) и чак тогава тръгва известието
     — без Stripe. Без валиден код пътят е точно старият. На en/ блокът го няма в
     страницата (kodBox е null) и нищо от това не се включва. Имената от Worker-а
     влизат само през textContent. */
  var kodBox = document.getElementById("text-kod-box");
  var kodPole = document.getElementById("text-kod-pole");
  var kodToggle = document.getElementById("text-kod-toggle");
  var kodInp = document.getElementById("text-kod");
  var kodBtn = document.getElementById("text-kod-proveri");
  var kodMsg = document.getElementById("text-kod-msg");
  var kodMahni = document.getElementById("text-kod-mahni");
  var KOD_PRICHINI = {
    nyama: "Няма такъв код. Провери буквите — или отвори връзката от ваучера, там кодът е попълнен.",
    izpolzvan: "Този код вече е използван — всеки ваучер важи за една песен. Ако е грешка, пиши ни на sales@pesenta.bg.",
    otmenen: "Този ваучер е отменен. Ако е грешка, пиши ни на sales@pesenta.bg.",
    mnogo_opiti: "Много опити за кратко време. Изчакай малко и опитай пак."
  };
  function kodPrichina(p) {
    return KOD_PRICHINI[p] || "Не успяхме да проверим кода. Опитай пак след малко или ни пиши на sales@pesenta.bg.";
  }
  function kodSaobshtenie(msg, cls) {
    if (!kodMsg) return;
    kodMsg.textContent = msg || "";
    kodMsg.className = "promo-msg" + (cls ? " " + cls : "");
  }
  function podarakTekst(v) {
    var za = v && v.za_kogo ? " за " + v.za_kogo : "", ot = v && v.ot_kogo ? " от " + v.ot_kogo : "";
    return "Подарък" + za + ot + " — песента е платена";
  }
  /* Горе, в полето за разказа: подаръкът или — при ?kod= от връзката — защо кодът не става. */
  function vaucherBanner(tekst, greshka) {
    var ban = document.getElementById("text-vaucher-banner");
    if (!ban) return;
    ban.hidden = !tekst;
    ban.classList.toggle("err", !!greshka);
    var bt = document.getElementById("text-vaucher-banner-tekst"), bh = document.getElementById("text-vaucher-banner-hint");
    if (bt) bt.textContent = tekst || "";
    if (bh) bh.hidden = !!greshka;
  }
  function otvoriKod() {
    if (!kodPole) return;
    kodPole.hidden = false;
    if (kodToggle) { kodToggle.setAttribute("aria-expanded", "true"); kodToggle.hidden = true; }
  }
  /* Включва/изключва „подаръчния“ вид на формата: без фактура и без плащане. */
  function vaucherRezhim(v) {
    vaucher = v || null;
    var vkl = !!vaucher;
    var invRow = document.getElementById("text-invoice-row");
    if (invRow) invRow.hidden = vkl;
    if (vkl && invChk) invChk.checked = false;
    if (invBox) invBox.hidden = vkl || !(invChk && invChk.checked);
    var payHint = document.getElementById("text-pay-hint"), vHint = document.getElementById("text-vaucher-hint");
    if (payHint) payHint.hidden = vkl;
    if (vHint) vHint.hidden = !vkl;
    /* Съгласието: получателят не плаща — текстът за плащането се сменя с този за ваучера. */
    var sPl = document.getElementById("text-consent-plashtane"), sVa = document.getElementById("text-consent-vaucher");
    if (sPl && sVa) { sPl.hidden = vkl; sVa.hidden = !vkl; }
    vaucherBanner(vkl ? podarakTekst(vaucher) : "");
    if (kodInp) kodInp.readOnly = vkl;
    if (kodBtn) kodBtn.hidden = vkl;
    if (kodMahni) kodMahni.hidden = !vkl;
    if (!sendBtn.disabled) sendBtn.textContent = vkl ? "Изпрати разказа" : SEND_TEXT;
    presmetniDostavka();
  }
  function proveriKod(kod, otVrazka) {
    kod = String(kod || "").replace(/\s+/g, "").toUpperCase();
    if (kodInp) kodInp.value = kod;
    var losh = !kod ? "Напиши кода от ваучера." :
      (kod.length > 40 || !/^[A-Z0-9-]+$/.test(kod)) ? "Кодът е от латински букви, цифри и тирета — както е на ваучера." : "";
    if (losh) { kodSaobshtenie(losh, "err"); if (otVrazka) vaucherBanner(losh, true); return Promise.resolve(false); }
    kodSaobshtenie("Проверяваме кода…");
    if (kodBtn) kodBtn.disabled = true;
    return fetch(WORKER + "/vaucher/proverka?kod=" + encodeURIComponent(kod))
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          d = d || {};
          if (r.status === 429) d = { ok: false, prichina: "mnogo_opiti" };
          return d;
        });
      })
      .then(function (d) {
        if (kodBtn) kodBtn.disabled = false;
        if (d.ok === true) {
          vaucherRezhim({ kod: kod, za_kogo: String(d.za_kogo || "").slice(0, 60), ot_kogo: String(d.ot_kogo || "").slice(0, 60) });
          kodSaobshtenie(podarakTekst(vaucher), "ok");
          clearFail();
          return true;
        }
        vaucherRezhim(null);
        kodSaobshtenie(kodPrichina(d.prichina), "err");
        if (otVrazka) vaucherBanner(kodPrichina(d.prichina), true);
        return false;
      })
      .catch(function () {
        if (kodBtn) kodBtn.disabled = false;
        vaucherRezhim(null);
        kodSaobshtenie(kodPrichina(""), "err");
        if (otVrazka) vaucherBanner(kodPrichina(""), true);
        return false;
      });
  }
  if (kodBox && kodInp) {
    if (kodToggle) kodToggle.addEventListener("click", function () { otvoriKod(); kodInp.focus(); });
    if (kodBtn) kodBtn.addEventListener("click", function () { proveriKod(kodInp.value); });
    kodInp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); if (!vaucher) proveriKod(kodInp.value); }
    });
    if (kodMahni) kodMahni.addEventListener("click", function () {
      vaucherRezhim(null);
      kodInp.value = "";
      kodSaobshtenie("");
      kodInp.focus();
    });
  }

  textBtn.addEventListener("click", function () {
    /* ако гласовият запис тече, спираме го през собствения му бутон —
       той си знае как да прибере микрофона и таймера чисто */
    if (recBtn && recBtn.classList.contains("recording")) recBtn.click();
    if (voiceFieldsWrap) voiceFieldsWrap.hidden = true;
    /* „Чуй 15 секунди“ е покана, а човекът вече е решил — прибираме я, за да не
       стои между бутона и полетата (и я спираме, ако свири). */
    var proba = document.querySelector(".hero-proba");
    if (proba) { if (proba.getAttribute("aria-pressed") === "true") proba.click(); proba.hidden = true; }
    /* броим само първото отваряне на страница — повторен клик не е нов човек */
    if (fieldsWrap.hidden && window.psnSabitie) window.psnSabitie("Order Form Open", (new URLSearchParams(location.search).get("povod") ? "с повод" : "") || (location.hash === "#order" ? "от връзка" : "бутон"));
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
      /* Разказът е първото поле (21.09.2026): слагаме го точно под шапката, за да се
         виждат под него поводът, стилът и езикът. Преди се центрираше, а те бяха над него. */
      var pole = storyEl.closest(".field") || storyEl;
      var pr = pole.getBoundingClientRect();
      if (pr.top < top + 8 || r.bottom > window.innerHeight) {
        window.scrollTo({ top: Math.max(0, window.scrollY + pr.top - top - 12), behavior: "smooth" });
      }
    }, 650);
  });

  /* Обратната посока (само там, където има бутон за запис): кликне ли се
     „Поръчай с глас“, докато текстовите полета стоят отворени, ги прибираме —
     иначе двете форми се виждат едновременно. Бутон за запис вече няма никъде
     (14.09.2026) — recBtn е null и блокът не тръгва; остава с проверката. */
  if (recBtn) {
    recBtn.addEventListener("click", function () {
      if (fieldsWrap) fieldsWrap.hidden = true;
      collapseHeroIntro();
    });
  }

  /* Страниците за повод водят тук с ?povod=<стойността на чипа>#order: поводът
     идва избран и формата е отворена, вместо човек да го търси наново. Засега
     само от en/ — poruchka.html си има собствен ?povod= за българските. */
  /* От 14.10.2026 и ?stil=<стил>: бутоните на стиловете и „Поръчай“ по целия сайт
     водят тук, а не към poruchka.html (пълната форма нямаше нито една поръчка). */
  (function () {
    var q = new URLSearchParams(location.search);
    function izberi(grupi, v) {
      if (!v) return;
      var chips = document.querySelectorAll(grupi);
      /* поводът е един — новият сменя стария; стиловете се трупат */
      if (grupi.indexOf("occasion") > -1) for (var j = 0; j < chips.length; j++) chips[j].classList.remove("selected");
      for (var i = 0; i < chips.length; i++) {
        if (chips[i].getAttribute("data-value") === v) {
          chips[i].classList.add("selected");
          /* всички обвиващи групи — „Покажи още…“ и „Добави детайли“ (14.10.2026) */
          for (var d = chips[i].closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true;
          break;
        }
      }
    }
    izberi("#text-occasion-chips .chip, #text-occasion-chips-more .chip", q.get("povod"));
    izberi("#text-style-chips .chip, #text-style-chips-more .chip", q.get("stil"));
    /* ?kod= от връзката във ваучера (15.10.2026): формата се отваря с попълнен и
       проверен код. Кодът носи име, затова излиза от адреса веднага (replaceState) —
       не остава в историята, в споделен адрес или в Referer-а нататък. */
    var kodUrl = q.get("kod");
    if (kodUrl && kodBox && kodInp) {
      q.delete("kod");
      var ostatak = q.toString();
      history.replaceState(null, "", location.pathname + (ostatak ? "?" + ostatak : "") + "#order");
      otvoriKod();
      proveriKod(kodUrl, true);
    }
    if (location.hash === "#order") textBtn.click();
    /* Връзка към #order на същата страница не презарежда — само сменя котвата.
       Хващаме я тук, за да отвори формата, вместо да скролне до затворен бутон. */
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || a.hash !== "#order" || a.origin !== location.origin) return;
      if (a.pathname.replace(/index\.html$/, "") !== location.pathname.replace(/index\.html$/, "")) return;
      e.preventDefault();
      /* стил или повод от самата страница (облакът със стиловете) — без презареждане */
      var aq = new URLSearchParams(a.search);
      izberi("#text-occasion-chips .chip, #text-occasion-chips-more .chip", aq.get("povod"));
      izberi("#text-style-chips .chip, #text-style-chips-more .chip", aq.get("stil"));
      if (location.hash !== "#order") history.replaceState(null, "", location.pathname + location.search + "#order");
      textBtn.click();
    });
  })();

  sendBtn.addEventListener("click", function () {
    clearFail();
    /* Запис, който още тече, се приключва първо — иначе последните думи и самият
       файл не стигат до нас. После същото натискане продължава отначало. */
    var glasBtn = document.getElementById("text-glas-btn");
    if (window.__glasSpri && glasBtn && glasBtn.classList.contains("recording")) {
      window.__glasSpri().then(function () { sendBtn.click(); });
      return;
    }
    var story = storyEl.value.trim();
    if (!story) { fail(t("Разкажи накратко за кого е песента и повода.", "Tell us briefly who the song is for and the occasion.")); return; }
    var emailEl = document.getElementById("text-email");
    var email = emailEl ? emailEl.value.trim() : "";
    if (emailEl) {
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      emailEl.classList.toggle("invalid", !emailOk);
      if (!emailOk) { fail(t("Напиши имейл, на който да ти изпратим песента.", "Enter the email where we should send your song.")); emailEl.focus(); return; }
    }
    if (!document.getElementById("text-consent").checked) {
      fail(t("Моля, потвърди съгласието с Общите условия.", "Please confirm that you agree to the Terms.")); return;
    }
    var inv = invoiceData();
    if (inv && (!inv.name || !inv.addr)) {
      fail(t("За фактура са нужни име (или фирма) и адрес.", "For an invoice we need a name (or company) and an address.")); return;
    }
    /* Името НЕ се иска тук — Stripe го събира на своята страница. Имейлът
       се иска от 13.10.2026, за да може на неплатила поръчка да се пише.
       Съгласието по чл. 57 остава преди плащането: клиентът се отказва
       от правото на връщане, това не може да се потвърждава след факта. */

    var orderNo = genOrderNo();
    /* Снимка на кода в момента на изпращане — „Махни кода“ по средата не бива да
       смени пътя на вече тръгнала поръчка. */
    var vch = vaucher;
    var vchOpis = vch ? vch.kod + " — подарък" + (vch.za_kogo ? " за " + vch.za_kogo : "") + (vch.ot_kogo ? " от " + vch.ot_kogo : "") : "";
    var occasion = selectedOccasion();
    var styles = selectedStyles();
    var language = document.getElementById("text-language").value;
    var eventDate = eventDateEl ? (eventDateEl.value || "") : "";

    var fields = {
      "_subject": vch ? "БЪРЗА заявка (ПЛАТЕНО С ВАУЧЕР " + vch.kod + ") — " + orderNo : "БЪРЗА заявка (ОЧАКВА ПЛАЩАНЕ) — " + orderNo,
      "_template": "box",
      "Номер на заявка": orderNo,
      "Тип": "Бърза текстова поръчка" + (EN ? " — от АНГЛИЙСКИЯ сайт (en/)" : "") + (vch ? " — ПЛАТЕНА С ВАУЧЕР" : ""),
      "Език на сайта": EN ? "английски — пиши на клиента на английски" : "български",
      /* Брифът тръгва ПРЕДИ плащането, защото след него клиентът е на
         страницата на Stripe и разказът щеше да се загуби. Затова темата
         казва „очаква плащане" — свързването става по номера на поръчката,
         който пътува със самото плащане като client_reference_id. */
      "Състояние": vch ? "ПЛАТЕНО С ВАУЧЕР " + vchOpis + ". Без Stripe — Worker-ът отбеляза кода като използван." : "ОЧАКВА ПЛАЩАНЕ — клиентът е пренасочен към Stripe",
      "Клиент": vch ? "— получател на ваучер; името е в разказа" : "— името идва от Stripe след плащането",
      "Имейл": email || "—",
      "_replyto": email,
      "Повод": occasion || "— не е избран, виж разказа",
      "Дата на повода": eventDate || "— не е посочена",
      "Стилове": styles.length ? styles.join(", ") : "— не са избрани, виж разказа",
      "Език": language,
      "Разказ": story,
      "Снимки за обложката": snimki.length ? "ДА — " + snimki.length + ", в ОТДЕЛНО писмо със snimka-" + orderNo + "-N.jpg" : "не",
      "Гласов разказ": glasBlob ? "ДА — glasovo-" + orderNo + "." + glasExt(glasBlob) + " в ОТДЕЛНО писмо; разказът горе е автоматичният препис, свери го със записа" : "не",
      /* Ако няма отметка, пишем изрично „не иска" — така при преглед се вижда
         разликата между „не е поискана" и „забравили сме да я запишем". */
      "ФАКТУРА": vch ? "не — платено с ваучер (продажбата е при купувача на ваучера)" : inv
        ? (inv.eik ? "ДА — ФИРМА (задължителна)" : "ДА — физическо лице (по желание)")
        : "не е поискана — влиза в отчета по чл. 119",
      "Фактура: име / фирма": inv ? inv.name : "—",
      "Фактура: адрес": inv ? inv.addr : "—",
      "Фактура: ЕИК / ДДС номер": inv && inv.eik ? inv.eik : "—",
      "Съгласие чл. 57 ЗЗП (без право на отказ)": vch ? "потвърдено от получателя на ваучера преди изпращането" : "потвърдено преди плащането",
      "CLAUDE BRIEF": [
        "# Бърза текстова поръчка — " + orderNo,
        "",
        vch ? "СЪСТОЯНИЕ: ПЛАТЕНО С ВАУЧЕР " + vchOpis + "." : "СЪСТОЯНИЕ: очаква плащане. Свери в Stripe по " + orderNo,
        vch ? "В Stripe плащане няма и не се чака — започвай работа." : "преди да започнеш работа.",
        (EN ? "\nКЛИЕНТЪТ Е ОТ АНГЛИЙСКИЯ САЙТ — писмото и страницата на песента на английски.\n" : ""),
        inv
          ? ("ФАКТУРА: поискана" + (inv.eik ? " — ФИРМА " + inv.eik + " (задължителна по ЗДДС)" : " — физическо лице") +
             "\n" + inv.name + ", " + inv.addr)
          : "ФАКТУРА: не е поискана.",
        "",
        "Повод: " + (occasion || "— не е избран, виж разказа"),
        "Дата на повода: " + (eventDate || "— не е посочена"),
        "Стилове: " + (styles.length ? styles.join(", ") : "— не са избрани, виж разказа"),
        "Език: " + language,
        "Имейл: " + (email || "—"),
        "",
        (snimki.length ? "(!) Клиентът е приложил " + snimki.length + " снимки за обложката — идват в отделно писмо, файлове snimka-" + orderNo + "-N.jpg. Ползвай ги за корицата и за личната страница.\n" : ""),
        (glasBlob ? "(!) Клиентът е разказал С ГЛАС — файлът glasovo-" + orderNo + "." + glasExt(glasBlob) + " идва в отделно писмо. Разказът долу е автоматичен препис (може да е дописан ръчно) — имената и детайлите свери със записа.\n" : ""),
        glasBlob ? "## Разказ (автоматичен препис от гласа — свери със записа)" : "## Разказ (директно от клиента, без транскрипция)",
        story,
        "",
        "## Задача",
        "Извлечи: получател, повод (ако не е избран горе), история, детайли, стилове (ако не са избрани горе), настроение."
      ].join("\n")
    };
    if (vch) fields["Ваучер"] = vchOpis;

    /* С ваучер поръчката се помни чак когато Worker-ът приеме кода (долу). */
    if (!vch) rememberOrder(orderNo);

    sendBtn.disabled = true;
    sendBtn.textContent = vch ? "Изпращаме разказа…" : t("Отваряме плащането…", "Opening checkout…");
    /* blagodarim.html е една за двата езика (там връща Stripe) — по този запис
       праща английския клиент на en/thank-you.html. */
    try { localStorage.setItem("pesenta_lang", EN ? "en" : "bg"); } catch (e) {}

    var fd = new FormData();
    Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });

    /* Брифът за нашата база — едно и също тяло за /brief (beacon долу) и за
       /vaucher/izpolzvai (там Worker-ът го записва в същата транзакция с кода). */
    function briefTyalo() {
      return {
        order_no: orderNo,
        vid: (EN ? "бърза текстова (EN)" : "бърза текстова") + (vch ? " (ваучер)" : ""),
        povod: fields["Повод"],
        event_date: eventDate,
        stilove: fields["Стилове"],
        ezik: fields["Език"],
        /* Worker-ът не знае за глас — бележката е в самия разказ, за да стигне до
           писмото за плащане без нова версия на Worker-а. */
        razkaz: (vch ? "[ПЛАТЕНО С ВАУЧЕР " + vchOpis + "]\n" : "") +
                (glasBlob ? "[ИМА ГЛАСОВ ЗАПИС — glasovo-" + orderNo + "." + glasExt(glasBlob) + ", в отделно писмо; текстът е автоматичен препис]\n" : "") + fields["Разказ"],
        email: email,
        snimki: snimki.length,
        landing: atr("psn_landing"),
        ref_parvi: atr("psn_ref"),
        ref_posleden: document.referrer || ""
      };
    }

    /* С ваучер: ПЪРВО кодът (чакаме отговора), после снимките/гласа и
       известието, и благодарим.html?vaucher=1 — без Stripe. Отказ (409/429/мрежа)
       → съобщение и нищо не тръгва. Брифът към /brief НЕ се праща отделно:
       Worker-ът го е записал при осребряването. */
    if (vch) {
      var vrati = function (msg) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Изпрати разказа";
        fail(msg);
      };
      fetch(WORKER + "/vaucher/izpolzvai", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ kod: vch.kod, order_no: orderNo, brief: briefTyalo() })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { st: r.status, d: d || {} }; });
      }).then(function (o) {
        if (o.st === 200 && o.d.ok === true) {
          rememberOrder(orderNo, "Песен с ваучер за подарък");
          if (window.psnSabitie) window.psnSabitie("Voucher Redeem", "бърза" + (glasBlob ? " + глас" : "") + (snimki.length ? " + снимки" : ""));
          var kamBlagodarim = function () { window.location.href = "blagodarim.html?vaucher=1"; };
          pratiSnimki(orderNo).then(function () {
            return fetch(FORM_ENDPOINT, { method: "POST", headers: { "Accept": "application/json" }, body: fd });
          }).then(kamBlagodarim).catch(kamBlagodarim);
          return;
        }
        var pr = o.st === 429 ? "mnogo_opiti" : o.d.prichina;
        vrati(kodPrichina(pr) + " Разказът ти не е изпратен.");
        /* кодът вече не става — формата се връща към обикновената поръчка */
        if (pr === "izpolzvan" || pr === "otmenen" || pr === "nyama") {
          vaucherRezhim(null);
          kodSaobshtenie(kodPrichina(pr), "err");
        }
      }).catch(function () {
        vrati("Не успяхме да се свържем, за да приложим кода. Разказът ти не е изпратен — опитай пак след малко.");
      });
      return;
    }

    /* Плащането е следващата стъпка при ВСЯКО положение. Ако брифът не
       успее да замине, пак пращаме клиента към Stripe — номерът на
       поръчката пътува с плащането, така че разказът може да се поиска
       после. Да го спрем пред касата заради наш проблем е по-лошото. */
    function toPayment() {
      if (window.plausible) window.plausible("Order Submitted", { props: { method: "text-quick" } });
      if (window.psnSabitie) window.psnSabitie("Order Submitted", "бърза" + (glasBlob ? " + глас" : "") + (snimki.length ? " + снимки" : "") + (EN ? " · en" : ""));
      window.location.href = paymentUrl(orderNo, email);
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
        navigator.sendBeacon(BRIEF_ENDPOINT, new Blob([JSON.stringify(briefTyalo())], { type: "text/plain;charset=UTF-8" }));
      }
    } catch (e) { /* без beacon оставаме на стария път */ }

    pratiSnimki(orderNo).then(function () {
      return fetch(FORM_ENDPOINT, { method: "POST", headers: { "Accept": "application/json" }, body: fd })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        });
    }).then(toPayment).catch(toPayment);
  });
})();
