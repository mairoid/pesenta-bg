/* Песента — гласова поръчка: запис + диктовка + изпращане.
   ------------------------------------------------------------------
   Стои в отделен файл, защото върви на ДВЕ страници: в hero-а на
   началната (поръчка без прескачане към втора страница) и в картата
   на poruchka.html. order.js обслужва само съветника от три стъпки и
   пада веднага на начална страница, защото търси негови елементи.

   Модулът си носи собствени копия на помощните функции вместо да ги
   заема от order.js. Дублирането е съзнателно: така пътят, по който
   влизат поръчките, не зависи от това дали другият файл се е заредил. */
(function () {
  "use strict";

  var recBtn = document.getElementById("fast-rec");
  if (!recBtn) return;

  /* ============ Конфигурация ============ */

  /* Същият (вече активиран) адрес в два вида ендпойнт: нативният POST е
     единственият, по който FormSubmit пренася прикачени файлове; AJAX-ът
     е резервен, за браузъри без DataTransfer. Смениш ли адреса, смени го
     тук — на едно място за двата. */
  var FORM_TARGET = "rusev.miro@gmail.com";
  var FORM_ENDPOINT = "https://formsubmit.co/ajax/" + FORM_TARGET;
  var FORM_ENDPOINT_NATIVE = "https://formsubmit.co/" + FORM_TARGET;
  var THANKS_URL = "https://pesenta.bg/blagodarim.html";
  var ORDER_EMAIL = "sales@pesenta.bg";
  var MAX_SEC = 180;

  /* ============ Елементи ============ */

  var label = document.getElementById("fast-rec-label");
  var statusEl = document.getElementById("fast-status");
  var playWrap = document.getElementById("fast-play");
  var audioEl = document.getElementById("fast-audio");
  var delBtn = document.getElementById("fast-del");
  var sendBtn = document.getElementById("fast-send");
  var errEl = document.getElementById("fast-error");
  var trWrap = document.getElementById("fast-transcript-wrap");
  var trEl = document.getElementById("fast-transcript");
  var trHint = document.getElementById("fast-transcript-hint");

  /* Полетата под бутона: в hero-а стоят скрити, докато човек не натисне
     записа — страницата не бива да посреща с формуляр. На poruchka.html
     тази обвивка липсва и полетата са видими от самото начало. */
  var fieldsWrap = document.getElementById("fast-fields");
  var card = document.getElementById("voice-card") || document.getElementById("glas");
  var fallback = document.getElementById("voice-fallback");

  /* ============ Състояние ============ */

  var blob = null;
  var mediaRecorder = null;
  var chunks = [];
  var stream = null;
  var recording = false;
  var maxTimer = null;

  /* Диктовката и записът вървят паралелно и се подсигуряват взаимно:
     текстът е за четене и поправяне от клиента, записът е оригиналът,
     по който се сверява какво наистина е казано. */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null;
  var trBase = "";
  var finalText = "";

  if (!navigator.mediaDevices || !window.MediaRecorder) {
    /* Без микрофонно API гласовата поръчка е невъзможна. В hero-а обаче не
       можем просто да скрием блока — това би оставило началната страница
       без нито една покана. Затова се показва изходът към формата. */
    if (fallback) {
      fallback.hidden = false;
      recBtn.hidden = true;
      if (statusEl) statusEl.hidden = true;
    } else if (card) {
      card.style.display = "none";
    }
    return;
  }

  /* ============ Помощни ============ */

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

  function audioExt(b) {
    var t = b && b.type ? b.type : "";
    if (t.indexOf("ogg") > -1) return "ogg";
    if (t.indexOf("mp4") > -1 || t.indexOf("m4a") > -1) return "mp4";
    if (t.indexOf("mpeg") > -1) return "mp3";
    return "webm";
  }

  /* Може ли браузърът да сглоби файл за <input type="file">?
     Safari под 14.1 няма DataTransfer конструктор. */
  function canAttach() {
    try { return !!new DataTransfer(); } catch (e) { return false; }
  }

  /* Нативен multipart POST — единственият път, по който FormSubmit приема
     прикачени файлове. Страницата се сменя с THANKS_URL, затова всичко,
     което трябва да остане на устройството, се записва ПРЕДИ това. */
  function postWithAttachment(fields, b, filename) {
    var f = document.createElement("form");
    f.method = "POST";
    f.action = FORM_ENDPOINT_NATIVE;
    f.enctype = "multipart/form-data";
    f.acceptCharset = "UTF-8";
    f.style.display = "none";

    Object.keys(fields).forEach(function (k) {
      var v = String(fields[k] == null ? "" : fields[k]);
      /* многоредовите стойности (брифът) минават през textarea —
         <input> нормализира новите редове и ги губи */
      var el = v.indexOf("\n") > -1 ? document.createElement("textarea") : document.createElement("input");
      if (el.tagName === "INPUT") el.type = "hidden";
      el.name = k;
      el.value = v;
      f.appendChild(el);
    });

    var fi = document.createElement("input");
    fi.type = "file";
    fi.name = "attachment";
    var dt = new DataTransfer();
    dt.items.add(new File([b], filename, { type: b.type || "audio/webm" }));
    fi.files = dt.files;
    f.appendChild(fi);

    document.body.appendChild(f);
    f.submit();
  }

  /* Адресът на касата за дадена поръчка.
     client_reference_id е това, което свързва плащането с брифа: Stripe го
     връща в webhook-а, а Worker-ът записва по него продажбата и издава
     документа. Ако payments.js липсва или плащанията са изключени, падаме
     към plati.html — там клиентът вижда обяснение, вместо да опре в нищо. */
  function paymentUrl(orderNo) {
    var cfg = window.PESENTA_PAYMENTS;
    var link = cfg && cfg.enabled && cfg.paymentLinks && cfg.paymentLinks.pesen;
    if (!link) return "https://pesenta.bg/plati.html?order=" + encodeURIComponent(orderNo) + "&plan=pesen";
    return link + (link.indexOf("?") === -1 ? "?" : "&") +
           "client_reference_id=" + encodeURIComponent(orderNo);
  }

  function rememberOrder(orderNo) {
    try {
      var orders = JSON.parse(localStorage.getItem("pesenta_orders") || "[]");
      orders.unshift({
        no: orderNo,
        date: new Date().toISOString().slice(0, 10),
        plan: "Гласова поръчка",
        total: "—",
        status: "Приета"
      });
      localStorage.setItem("pesenta_orders", JSON.stringify(orders));
    } catch (e) { /* localStorage недостъпен — не е фатално */ }
  }

  /* Hero-гридът е с align-items: center. Щом полетата излязат, лявата
     колона става двойно по-висока и снимката се пре-центрира — на десктоп
     слизаше с близо 400 пиксела. Затова я заковаваме точно там, където е
     била: минава на подравняване отгоре, а разликата ѝ се връща като
     margin. Измерваме, вместо да гадаем — офсетът зависи от височината на
     текста, тоест от ширината на екрана. */
  function pinHeroPhoto() {
    var photo = document.querySelector(".hero-photo");
    if (!photo || !photo.offsetParent) return;   /* скрита на телефон */
    if (photo.dataset.pinned) return;
    var before = photo.getBoundingClientRect().top;
    photo.style.alignSelf = "start";
    var after = photo.getBoundingClientRect().top;
    photo.style.marginTop = Math.round(before - after) + "px";
    photo.dataset.pinned = "1";
  }

  /* Смени ли се ширината, старата стойност вече не важи. Премерваме наново
     при СКРИТИ полета, за да хванем истинската покойна позиция. */
  var pinTimer = null;
  window.addEventListener("resize", function () {
    var photo = document.querySelector(".hero-photo");
    if (!photo || !photo.dataset.pinned || !fieldsWrap) return;
    clearTimeout(pinTimer);
    pinTimer = setTimeout(function () {
      var wasHidden = fieldsWrap.hidden;
      photo.style.alignSelf = "";
      photo.style.marginTop = "";
      delete photo.dataset.pinned;
      fieldsWrap.hidden = true;
      pinHeroPhoto();
      fieldsWrap.hidden = wasHidden;
    }, 150);
  });

  /* ============ Фактура по желание ============
     Виж бележката в text-order.js — същата логика, същите полета. Скрити,
     докато отметката не се сложи: физическите лица, за които фактура не се
     дължи, не бива да ги гледат. */
  var invChk = document.getElementById("fast-invoice");
  var invBox = document.getElementById("fast-invoice-fields");
  if (invChk && invBox) {
    invChk.addEventListener("change", function () {
      invBox.hidden = !invChk.checked;
      if (invChk.checked) document.getElementById("fast-inv-name").focus({ preventScroll: true });
    });
  }

  function invoiceData() {
    if (!invChk || !invChk.checked) return null;
    return {
      name: (document.getElementById("fast-inv-name").value || "").trim(),
      addr: (document.getElementById("fast-inv-addr").value || "").trim(),
      eik: (document.getElementById("fast-inv-eik").value || "").trim()
    };
  }

  function setStatus(msg, cls) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = "voice-status" + (cls ? " " + cls : "");
  }
  function fail(msg) { errEl.textContent = msg; errEl.classList.add("show"); }
  function clearFail() { errEl.textContent = ""; errEl.classList.remove("show"); }

  /* ============ Запис ============ */

  function stopRec() {
    recording = false;
    clearTimeout(maxTimer);
    if (recognition) { try { recognition.stop(); } catch (e) {} }
    recBtn.classList.remove("recording");
    if (mediaRecorder && mediaRecorder.state !== "inactive") { try { mediaRecorder.stop(); } catch (e) {} }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    label.textContent = blob ? "Запиши наново" : "Поръчай с глас";
  }

  function startRec() {
    clearFail();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      stream = s;
      chunks = [];
      /* 32 kbps стигат за глас: 3 минути ≈ 0,7 MB, далеч под лимита от 10 MB */
      try { mediaRecorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 }); } catch (e) {
        try { mediaRecorder = new MediaRecorder(stream); } catch (e2) {
          setStatus("Записът не тръгна на този браузър — ползвай формата.", "err");
          return;
        }
      }
      mediaRecorder.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
      mediaRecorder.onstop = function () {
        if (!chunks.length) return;
        blob = new Blob(chunks, { type: chunks[0].type || "audio/webm" });
        if (audioEl.src) URL.revokeObjectURL(audioEl.src);
        audioEl.src = URL.createObjectURL(blob);
        playWrap.hidden = false;
        label.textContent = "Запиши наново";
        setStatus("Записът е готов (" + Math.round(blob.size / 1024) + " KB). Прослушай го — или направо го изпрати.", null);
      };
      mediaRecorder.start();

      /* полетата и текстът излизат заедно със записа: клиентът вижда какво
         сме чули и оправя имената, преди да натисне „Изпрати“ */
      pinHeroPhoto();
      if (fieldsWrap) fieldsWrap.hidden = false;
      trWrap.hidden = false;
      trBase = trEl.value ? trEl.value.replace(/\s+$/, "") + " " : "";
      finalText = "";
      if (SR) {
        recognition = new SR();
        recognition.lang = "bg-BG";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = function (ev) {
          var interim = "";
          for (var i = ev.resultIndex; i < ev.results.length; i++) {
            var tr = ev.results[i][0].transcript;
            if (ev.results[i].isFinal) finalText += tr + " ";
            else interim += tr;
          }
          trEl.value = (trBase + finalText + interim).replace(/[ \t]+/g, " ");
        };
        recognition.onerror = function (ev) {
          if ((ev.error === "not-allowed" || ev.error === "service-not-allowed") && trHint) {
            trHint.textContent = "Разпознаването на реч не е разрешено — можеш да напишеш текста тук сам. Записът пристига при нас така или иначе.";
          }
        };
        recognition.onend = function () {
          if (recording) { try { recognition.start(); } catch (e) {} }
        };
        try { recognition.start(); } catch (e) {}
      } else if (trHint) {
        trHint.textContent = "Този браузър не разпознава реч — ако искаш, напиши накратко за кого е песента. Записът пристига при нас така или иначе.";
      }

      recording = true;
      recBtn.classList.add("recording");
      label.textContent = "Спри записа";
      setStatus(SR
        ? "Слушам… кажи за кого е песента, повода, историята и стила. Текстът се появява отдолу — после го прегледай."
        : "Записвам… кажи за кого е песента, повода, историята и стила. Натисни „Спри записа“, щом свършиш.", "rec");
      maxTimer = setTimeout(stopRec, MAX_SEC * 1000);
    }).catch(function () {
      setStatus("Няма достъп до микрофона — разреши го от браузъра или ползвай формата.", "err");
    });
  }

  recBtn.addEventListener("click", function () { if (recording) stopRec(); else startRec(); });

  if (delBtn) {
    delBtn.addEventListener("click", function () {
      blob = null;
      if (audioEl.src) { URL.revokeObjectURL(audioEl.src); audioEl.removeAttribute("src"); }
      playWrap.hidden = true;
      label.textContent = "Поръчай с глас";
      setStatus("Записът е изтрит — можеш да запишеш наново.", null);
    });
  }

  /* ============ Изпращане ============ */

  sendBtn.addEventListener("click", function () {
    clearFail();
    if (recording) stopRec();
    if (!blob) { fail("Първо запиши гласовото си съобщение."); return; }
    if (!document.getElementById("fast-consent").checked) {
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
    var fileName = "glasovo-" + orderNo + "." + audioExt(blob);
    var transcript = trEl ? trEl.value.trim() : "";

    var fields = {
      "_subject": "ГЛАСОВА заявка (ОЧАКВА ПЛАЩАНЕ) — " + orderNo,
      "_template": "box",
      "_captcha": "false",
      /* Нативният POST навигира сам след изпращането. Вместо към страницата
         за благодарност, го пращаме право на касата — така записът стига до
         нас И клиентът стига до плащането с едно действие. */
      "_next": paymentUrl(orderNo),
      "Номер на заявка": orderNo,
      "Тип": "Гласова бърза поръчка",
      "Състояние": "ОЧАКВА ПЛАЩАНЕ — клиентът е пренасочен към Stripe",
      "Клиент": "— идва от Stripe след плащането",
      "Транскрипция": transcript || "— няма (виж записа)",
      "Аудио запис": fileName + " (прикачен)",
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
        "# Гласова поръчка — " + orderNo,
        "",
        "СЪСТОЯНИЕ: очаква плащане. Свери в Stripe по " + orderNo,
        "преди да започнеш работа.",
        "",
        inv
          ? ("ФАКТУРА: поискана" + (inv.eik ? " — ФИРМА " + inv.eik + " (задължителна по ЗДДС)" : " — физическо лице") +
             "\n" + inv.name + ", " + inv.addr)
          : "ФАКТУРА: не е поискана.",
        "",
        "## Транскрипция (автоматична, прегледана от клиента)",
        transcript || "— няма текст: браузърът не разпозна реч. Всичко е в записа.",
        "",
        "## Оригинален запис",
        "Прикаченият файл " + fileName + " е първоизточникът. Сверявай имената по него —",
        "разпознаването греши точно по собствените имена.",
        "",
        "## Задача",
        "Извлечи: получател, повод, история, детайли, стилове, настроение, език."
      ].join("\n")
    };

    /* заявката се записва ПРЕДИ изпращането: нативният POST сменя страницата */
    rememberOrder(orderNo);

    sendBtn.disabled = true;
    sendBtn.textContent = "Изпращане…";

    /* нормалният път — текстът и записът в едно писмо */
    if (canAttach()) {
      postWithAttachment(fields, blob, fileName);
      return;
    }

    /* стар браузър без DataTransfer: пращаме текста по AJAX и даваме записа
       за сваляне, за да не се загуби */
    fields["Аудио запис"] = "НЕ е прикачен — браузърът на клиента не го поддържа; поискай го по имейл";
    var fd = new FormData();
    Object.keys(fields).forEach(function (k) {
      if (k !== "_next" && k !== "_captcha") fd.append(k, fields[k]);
    });

    fetch(FORM_ENDPOINT, { method: "POST", headers: { "Accept": "application/json" }, body: fd })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function () {
        /* Тук НЕ пренасочваме автоматично: клиентът първо трябва да си свали
           записа, а тръгне ли към Stripe, страницата се сменя и обектният
           URL умира заедно с нея. Затова му даваме двата бутона по ред. */
        var dl = URL.createObjectURL(blob);
        card.innerHTML =
          '<div class="success-box" style="padding:1.5rem 1rem;">' +
          '<div class="check"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16091c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg></div>' +
          "<h2>Още една стъпка</h2>" +
          '<div class="order-no">' + esc(orderNo) + "</div>" +
          "<p>Разказът ти стигна до нас. Браузърът ти обаче не успя да прикачи самия запис — " +
          "свали го оттук и ни го прати на <strong>" + ORDER_EMAIL + "</strong>, за да сверим имената по гласа ти.</p>" +
          '<p><a href="' + dl + '" download="' + esc(fileName) + '" class="btn btn-ghost">1. Свали записа</a></p>' +
          '<p><a href="' + paymentUrl(orderNo) + '" class="btn btn-primary btn-lg">2. Плати 19,90 € и започваме</a></p>' +
          "<p>Работата тръгва веднага след плащането — песента е готова до 48 часа.</p>" +
          "</div>";
        card.scrollIntoView({ behavior: "smooth" });
      })
      .catch(function () {
        sendBtn.disabled = false;
        sendBtn.textContent = "Продължи към плащане · 19,90 €";
        var vurl = URL.createObjectURL(blob);
        fail("Няма връзка със сървъра за заявки — опитай пак след минута, записът ти е запазен тук. ");
        errEl.innerHTML += '<a href="' + vurl + '" download="' + esc(fileName) + '" style="color:#ffd36e;font-weight:700;">Или свали записа и ни го прати на ' + ORDER_EMAIL + " →</a>";
      });
  });
})();
