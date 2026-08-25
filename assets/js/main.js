/* Песента — обща логика: аудио плейър, навигация, scroll reveal */
(function () {
  "use strict";

  /* ---------- Plausible: помощник за custom events ----------
     Само добавя събития успоредно на съществуващото поведение — никога не
     блокира и не променя нищо, ако скриптът не се е заредил (adblock,
     бавна мрежа). */
  function trackPlausible(name, props) {
    if (window.plausible) window.plausible(name, props ? { props: props } : undefined);
  }

  /* ---------- Мобилна навигация ---------- */
  var navToggle = document.querySelector(".nav-toggle");
  var mainNav = document.querySelector(".main-nav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var open = mainNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mainNav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") mainNav.classList.remove("open");
    });
  }

  /* ---------- Текуща година във футъра ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Hero видео ----------
     Само на desktop: под 860px .hero-photo е display:none, а браузърът тегли
     poster атрибута независимо от CSS — затова и poster-ът, и видеото се
     задават от JS, за да не хабят трафик на мобилни.
     Poster (39 KB) се задава веднага, видеото (266 KB) чак след load event,
     за да остане извън критичния път. При prefers-reduced-motion остава
     само неподвижният poster. */
  var heroVideo = document.querySelector(".hero-video[data-src]");
  if (heroVideo && window.matchMedia("(min-width: 861px)").matches) {
    heroVideo.poster = heroVideo.getAttribute("data-poster");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var playHeroVideo = function () {
        var p = heroVideo.play();
        /* autoplay на muted видео е разрешено, но при отказ остава poster-ът */
        if (p && p.catch) p.catch(function () {});
      };
      var startHeroVideo = function () {
        heroVideo.src = heroVideo.getAttribute("data-src");
        playHeroVideo();
        /* Браузърът паузира видео в скрит таб — възобновяваме при връщане */
        document.addEventListener("visibilitychange", function () {
          if (!document.hidden && heroVideo.paused) playHeroVideo();
        });
      };
      if (document.readyState === "complete") startHeroVideo();
      else window.addEventListener("load", startHeroVideo, { once: true });
    }
  }

  /* ---------- Scroll reveal ----------
     Елементи в една група (8-те песни, 4-те стъпки, отзивите) се появяват
     последователно, а не наведнъж — един след друг, с таван, за да не се
     чака дълго при по-дълъг списък.
     Темпото: беше 45ms/таван 270ms при 400ms анимация — Мирослав каза, че
     се усеща рязко на телефон. Сега 80ms/таван 480ms при 600ms (--dur-slow
     в style.css). Двете вървят заедно: ако се пипа едното, и другото. */
  var revealEls = document.querySelectorAll(".reveal");
  var STAGGER_MS = 80, STAGGER_MAX = 480;

  function staggerDelay(el) {
    var parent = el.parentElement;
    if (!parent) return 0;
    var group = Array.prototype.filter.call(parent.children, function (c) {
      return c.classList && c.classList.contains("reveal");
    });
    if (group.length < 2) return 0; /* самотен елемент — без закъснение */
    return Math.min(group.indexOf(el) * STAGGER_MS, STAGGER_MAX);
  }

  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var d = staggerDelay(entry.target);
            if (d) entry.target.style.transitionDelay = d + "ms";
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Аудио плейъри ---------- */
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';

  function fmt(sec) {
    if (!isFinite(sec)) return "0:00";
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  var players = [];

  document.querySelectorAll(".player[data-src]").forEach(function (wrap, i) {
    var audio = new Audio();
    audio.preload = "none";
    var srcUrl = wrap.getAttribute("data-src");
    var srcAssigned = false;
    function ensureSrc() {
      if (srcAssigned) return;
      srcAssigned = true;
      audio.preload = "metadata";
      audio.src = srcUrl;
    }
    /* Разсредоточено зареждане на метаданните (продължителност), извън критичния
       път на зареждане — 8-те едновременни заявки опашкуваха браузъра (замерено:
       loadEvent 3.3s дори при малки файлове). При клик src се задава веднага. */
    var idle = window.requestIdleCallback || function (fn) { setTimeout(fn, 300); };
    idle(function () { setTimeout(ensureSrc, i * 120); });

    var btn = wrap.querySelector(".play-btn");
    var bar = wrap.querySelector(".progress");
    var fill = wrap.querySelector(".progress-fill");
    var time = wrap.querySelector(".time");
    var titleEl = wrap.querySelector(".track-info h3");
    var trackTitle = titleEl ? titleEl.textContent.trim() : srcUrl.split("/").pop();

    function pause() {
      audio.pause();
      btn.innerHTML = ICON_PLAY;
      wrap.classList.remove("playing");
    }

    function toggle() {
      if (audio.paused) {
        // спри всички останали (и музикалния поздрав)
        if (window.__pesentaIntroStop) window.__pesentaIntroStop();
        players.forEach(function (p) { if (p.audio !== audio) p.pause(); });
        audio.play();
        trackPlausible("Demo Play", { track: trackTitle });
        btn.innerHTML = ICON_PAUSE;
        wrap.classList.add("playing");
      } else {
        pause();
      }
    }

    players.push({ audio: audio, pause: pause });

    audio.addEventListener("loadedmetadata", function () {
      time.textContent = fmt(audio.duration);
    });

    audio.addEventListener("timeupdate", function () {
      if (audio.duration) {
        var pct = (audio.currentTime / audio.duration) * 100;
        fill.style.inset = "0 " + (100 - pct) + "% 0 0";
        time.textContent = fmt(audio.currentTime);
      }
    });

    audio.addEventListener("ended", function () {
      pause();
      fill.style.inset = "0 100% 0 0";
      time.textContent = fmt(audio.duration);
    });

    /* целият ред е бутон: клик или Enter/Space пуска и спира песента */
    wrap.addEventListener("click", function (e) {
      if (e.target.closest(".progress")) return;
      ensureSrc();
      toggle();
    });
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        ensureSrc();
        toggle();
      }
    });

    bar.addEventListener("click", function (e) {
      if (!audio.duration) return;
      var rect = bar.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      audio.currentTime = Math.max(0, Math.min(1, pct)) * audio.duration;
    });
  });

  /* ---------- Демо: филтър табове по категория ----------
     Не пипа плейър логиката отгоре — само показва/скрива готови .track-row
     елементи по вече зададения им data-category. Скриването е плавно:
     .track-hide пуска CSS прехода (max-height/padding/margin → 0, свива
     кутията реално, не само fade), .track-gone (display:none) идва чак
     след него — така остатъчните карти се "вдигат" на мястото ѝ.
     Нарочно НЕ ползваме елемент.hidden: .track-row си има собствен
     display:flex (по-специфично от [hidden] в user-agent таблицата, затова
     hidden не го крие) — вместо това display:none идва през собствен клас. */
  var filterBar = document.getElementById("demo-filters");
  if (filterBar) {
    var filterChips = filterBar.querySelectorAll(".chip");
    var trackRows = document.querySelectorAll(".tracks-list .track-row");
    filterBar.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      filterChips.forEach(function (c) { c.classList.remove("selected"); });
      chip.classList.add("selected");
      var filter = chip.getAttribute("data-filter");
      trackRows.forEach(function (row) {
        var cats = (row.getAttribute("data-category") || "").split(" ");
        var show = filter === "all" || cats.indexOf(filter) > -1;
        if (show) {
          row.classList.remove("track-gone");
          void row.offsetHeight; /* форсира reflow — без него преходът няма от какво "свито" състояние да тръгне */
          row.classList.remove("track-hide");
        } else if (!row.classList.contains("track-hide")) {
          row.classList.add("track-hide");
          setTimeout(function () { row.classList.add("track-gone"); }, 240);
        }
      });
    });
  }

  /* ---------- Plausible: клик на „Поръчай“ бутоните ----------
     Добавъчни слушатели — не пипат href/click дестинациите, само отчитат
     паралелно. Всеки елемент, чийто видим текст съдържа „Поръчай“ (навигация,
     цени, CTA-тата), плюс footer линкът към poruchka.html. */
  document.querySelectorAll("a, button").forEach(function (el) {
    if (el.id === "fast-rec") return; /* стейтфул бутон — проследява се отделно по-долу */
    var label = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!/Поръчай/.test(label)) return;
    el.addEventListener("click", function () {
      trackPlausible("Order CTA Click", { label: label.slice(0, 60) });
    });
  });

  /* Hero бутонът за гласова поръчка е стейтфул (сменя надпис/клас между
     „Поръчай с глас“ → „Спри записа“ → „Запиши наново“, логиката е в
     voice-order.js). Слушателят тук е ДОБАВЪЧЕН и НЕ променя нищо в
     voice-order.js; тъй като main.js се зарежда преди voice-order.js,
     този клик стига до нас първи, докато класът все още не е сменен —
     затова classList.contains("recording") надеждно различава „старт на
     запис“ (истинската CTA стъпка) от „спри записа“/„запиши наново“. */
  var heroRecBtn = document.getElementById("fast-rec");
  if (heroRecBtn) {
    heroRecBtn.addEventListener("click", function () {
      if (!heroRecBtn.classList.contains("recording")) {
        trackPlausible("Order CTA Click", { label: "Поръчай с глас (hero запис)" });
      }
    });
  }
})();

/* ---------- Музикален поздрав: тих припев на началната страница ----------
   Браузърите блокират звук без взаимодействие — пробваме автоматично,
   а при отказ тръгва при първия клик/докосване. „✕“ го спира завинаги
   (запомня се в localStorage: pesenta_intro_off).                        */
(function () {
  "use strict";

  /* Плейлист за поздрава: при всяко отваряне се избира СЛУЧАЙНА песен.
     start = секундата, от която почва припевът — нагласи по ухо за всяка. */
  var INTRO_PLAYLIST = [
    { src: "assets/audio/za-teb-brate-vladi.mp3", title: "„За теб, брате Влади“",  start: 79,  duration: 26 },
    { src: "assets/audio/habibi-rusi.mp3",        title: "„Habibi Rusi“",          start: 35,  duration: 26 },
    { src: "assets/audio/rosen-abi.mp3",          title: "„Rosen Abi“",            start: 55,  duration: 26 },
    { src: "assets/audio/rocco-di-catania.mp3",   title: "„Rocco di Catania“",     start: 70,  duration: 26 },
    { src: "assets/audio/napipay-go-vladi.mp3",   title: "„Напипай го, Влади“",    start: 100, duration: 26 },
    { src: "assets/audio/api.mp3",                title: "„АПИ“",                  start: 0,   duration: 26 },
    { src: "assets/audio/za-teb-brate-tutso.mp3", title: "„За теб, брате Туцо“",   start: 46,  duration: 26 },
    { src: "assets/audio/veche-nyama-koy.mp3",    title: "„Вече няма кой…“",       start: 24,  duration: 26 }
  ];

  var INTRO = {
    enabled: true,
    volume: 0.18,   // тихо: 0–1
    delayMs: 3500   // пауза след отваряне на страницата
  };

  if (!INTRO.enabled) return;
  if (!document.querySelector(".hero")) return; // само на началната страница
  try { if (localStorage.getItem("pesenta_intro_off") === "1") return; } catch (e) {}

  var track = INTRO_PLAYLIST[Math.floor(Math.random() * INTRO_PLAYLIST.length)];
  window.__pesentaIntroTrack = track.title; // за диагностика

  /* Без src при създаването: preload="auto" + src веднага сваляше половин песен
     още при отваряне на страницата (замерено: ~5MB, извън критичния път на зареждане).
     src се присвоява едва в go(), точно когато реално ще пуснем звука. */
  var audio = new Audio();
  audio.preload = "none";
  var pill = null;
  var fadeTimer = null;
  var stopTimer = null;
  var started = false;
  var ended = false;

  function fadeTo(target, ms, done) {
    clearInterval(fadeTimer);
    var steps = 20, i = 0, from = audio.volume;
    fadeTimer = setInterval(function () {
      i++;
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * (i / steps)));
      if (i >= steps) { clearInterval(fadeTimer); if (done) done(); }
    }, ms / steps);
  }

  function stopIntro(remember) {
    if (ended) return;
    ended = true;
    clearTimeout(stopTimer);
    fadeTo(0, 700, function () { audio.pause(); });
    if (pill) {
      pill.classList.add("hide");
      setTimeout(function () { if (pill) { pill.remove(); pill = null; } }, 600);
    }
    if (remember) { try { localStorage.setItem("pesenta_intro_off", "1"); } catch (e) {} }
    window.__pesentaIntroStop = null;
  }

  window.__pesentaIntroStop = function () { stopIntro(false); };

  function showPill() {
    pill = document.createElement("div");
    pill.className = "intro-pill";
    pill.innerHTML =
      '<span class="intro-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
      "<span></span>" +
      '<button type="button" class="intro-stop" aria-label="Спри музиката" title="Спри">✕</button>';
    pill.querySelector("span + span").textContent = track.title;
    pill.querySelector(".intro-stop").addEventListener("click", function () { stopIntro(true); });
    document.body.appendChild(pill);
  }

  function begin() {
    if (started || ended) return;
    started = true;
    function playFromStart() {
      try { audio.currentTime = track.start; } catch (e) {}
      audio.volume = 0;
      var p = audio.play();
      if (p && p.then) {
        p.then(function () {
          showPill();
          fadeTo(INTRO.volume, 1500);
          stopTimer = setTimeout(function () { stopIntro(false); }, track.duration * 1000);
        }).catch(function () {
          /* autoplay блокиран — чакаме първото взаимодействие */
          started = false;
          armGesture();
        });
      }
    }
    /* src се присвоява точно тук — заявката за файла тръгва едва сега,
       не при зареждане на страницата (виж бележката горе при audio.preload). */
    audio.src = track.src;
    if (audio.readyState >= 1) playFromStart();
    else audio.addEventListener("loadedmetadata", playFromStart, { once: true });
  }

  var armed = false;
  function armGesture() {
    if (armed) return;
    armed = true;
    var kick = function (e) {
      document.removeEventListener("pointerdown", kick);
      document.removeEventListener("keydown", kick);
      armed = false; /* позволи повторно въоръжаване, ако play() пак бъде отказан */
      /* ако първото докосване е върху плейър — човекът сам си пуска музика */
      if (e && e.target && e.target.closest && e.target.closest(".player")) return;
      begin();
    };
    document.addEventListener("pointerdown", kick);
    document.addEventListener("keydown", kick);
  }

  setTimeout(begin, INTRO.delayMs);
})();

/* ---------- Отзиви и поводи: непрекъснати ленти ----------
   Механизмът е общ за трите върволици на сайта и живее в lenta.js — там е и
   обяснението защо е истински скрол, а не CSS анимация. Тук само посочваме
   кои са кутиите и колко бързо да вървят.

   Удвояването на картите го прави lenta.js, не разметката: иначе текстът на
   отзивите щеше да стои на две места в index.html и поправка в единия
   екземпляр тихо разминава двата. */
(function () {
  "use strict";
  if (!window.lenta) return;

  var otzivi = document.getElementById("quotes-rail");
  /* Отзивите вървят по-бавно от рождениците — те се четат, а не се разглеждат. */
  if (otzivi) window.lenta(otzivi, document.getElementById("quotes-track"), { skorost: 26 });

  var povodi = document.getElementById("povodi-rail");
  if (povodi) window.lenta(povodi, document.getElementById("povodi-track"), { skorost: 34 });
})();

/* ---------- Липсващо изображение не бива да личи ----------
   Новите кадри (hero за телефон, илюстрациите по повод) се добавят от
   Мирослав. Докато някой от тях го няма, браузърът рисува счупена икона —
   по-грозно от липсата му. Затова при неуспешно зареждане елементът просто
   се маха и разположението се затваря около него.

   Отнася се САМО за тези две места. Обложките на песните и логото не се
   пипат: там липсващ файл е бъг, който трябва да се вижда. */
(function () {
  "use strict";

  function drop(img) {
    var wrap = img.closest(".hero-photo-mobile");
    (wrap || img).remove();
  }

  document.querySelectorAll(".occasion-photo, .hero-photo-mobile img").forEach(function (img) {
    /* Скриптът е с defer, тоест тръгва СЛЕД разбора на HTML — дотогава
       част от изображенията вече са се провалили и събитието „error" е
       минало. Затова първо проверяваме свършилите (complete с нулева
       ширина = провал), и чак после слушаме за предстоящите. */
    if (img.complete && img.naturalWidth === 0) { drop(img); return; }
    img.addEventListener("error", function () { drop(img); });
  });
})();

/* ---------- Залавяне на имейл срещу промо код ----------
   Кодът се показва НА ЕКРАНА, не се праща по имейл. Причината е в самия
   FormSubmit: _autoresponse не работи при AJAX подаване (тяхна
   документация). Проверено на живо — заявката пристига при нас, автоотговор
   до клиента няма.

   Нативният POST би дал автоотговор, но сменя страницата и изхвърля човека
   от четивото. Затова обратното решение: AJAX + кодът веднага пред очите му.
   Обещанието се удържа на място и не зависи от доставка на поща. */
(function () {
  "use strict";

  var form = document.getElementById("promo-form");
  if (!form) return;

  var TARGET = "sales@pesenta.bg";
  var input = document.getElementById("promo-email");
  var btn = document.getElementById("promo-send");
  var err = document.getElementById("promo-error");
  var done = document.getElementById("promo-done");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    err.textContent = "";
    err.classList.remove("show");

    var email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      err.textContent = "Въведи валиден имейл — там ще дойде кодът.";
      err.classList.add("show");
      input.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = "Изпращане…";

    var fd = new FormData();
    fd.append("_subject", "Промо код -10%");
    fd.append("_template", "box");
    fd.append("email", email);
    fd.append("Заявка", "иска промо код за -10% от началната страница");

    fetch("https://formsubmit.co/ajax/" + TARGET, {
      method: "POST",
      headers: { "Accept": "application/json" },
      body: fd
    })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function () {
        if (window.plausible) window.plausible("Promo Requested");
        form.hidden = true;
        done.hidden = false;
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = "Изпрати ми кода";
        err.textContent = "Нещо се обърка — опитай пак след минута.";
        err.classList.add("show");
      });
  });
})();
