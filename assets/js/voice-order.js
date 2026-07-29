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
    var name = document.getElementById("fast-name").value.trim();
    var email = document.getElementById("fast-email").value.trim();
    if (!name) { fail("Напиши името си."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { fail("Въведи валиден имейл — там ще получиш песента."); return; }
    if (!document.getElementById("fast-consent").checked) {
      fail("Моля, потвърди съгласието с Общите условия."); return;
    }

    var orderNo = genOrderNo();
    var fileName = "glasovo-" + orderNo + "." + audioExt(blob);
    var transcript = trEl ? trEl.value.trim() : "";

    var fields = {
      "_subject": "ГЛАСОВА заявка за песен — " + orderNo,
      "_template": "box",
      "_captcha": "false",
      "_next": THANKS_URL,
      "Номер на заявка": orderNo,
      "Тип": "Гласова бърза поръчка",
      "Клиент": name,
      "Имейл": email,
      "Транскрипция": transcript || "— няма (виж записа)",
      "Аудио запис": fileName + " (прикачен)",
      "Съгласие чл. 57 ЗЗП (без право на отказ)": "потвърдено",
      "CLAUDE BRIEF": [
        "# Гласова поръчка — " + orderNo,
        "",
        "Клиент: " + name + " <" + email + ">",
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
        var dl = URL.createObjectURL(blob);
        card.innerHTML =
          '<div class="success-box" style="padding:1.5rem 1rem;">' +
          '<div class="check"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16091c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg></div>' +
          "<h2>Гласовата поръчка е приета!</h2>" +
          '<div class="order-no">' + esc(orderNo) + "</div>" +
          "<p>Текстът стигна до нас. Браузърът ти обаче не успя да прикачи самия запис — " +
          "свали го оттук и ни го прати на <strong>" + ORDER_EMAIL + "</strong>, за да сверим имената по гласа ти.</p>" +
          '<p><a href="' + dl + '" download="' + esc(fileName) + '" class="btn btn-primary">Свали записа</a></p>' +
          "<p>До няколко часа получаваш имейл с потвърждение и фактура. Щом плащането постъпи, песента е готова до 48 часа.</p>" +
          "</div>";
        card.scrollIntoView({ behavior: "smooth" });
      })
      .catch(function () {
        sendBtn.disabled = false;
        sendBtn.textContent = "Изпрати гласовата поръчка";
        var vurl = URL.createObjectURL(blob);
        fail("Няма връзка със сървъра за заявки — опитай пак след минута, записът ти е запазен тук. ");
        errEl.innerHTML += '<a href="' + vurl + '" download="' + esc(fileName) + '" style="color:#ffd36e;font-weight:700;">Или свали записа и ни го прати на ' + ORDER_EMAIL + " →</a>";
      });
  });
})();
