/* Песента — обща логика: аудио плейър, навигация, scroll reveal */
(function () {
  "use strict";

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

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
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

  document.querySelectorAll(".player[data-src]").forEach(function (wrap) {
    var audio = new Audio();
    audio.preload = "metadata";
    audio.src = wrap.getAttribute("data-src");

    var btn = wrap.querySelector(".play-btn");
    var bar = wrap.querySelector(".progress");
    var fill = wrap.querySelector(".progress-fill");
    var time = wrap.querySelector(".time");

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
      toggle();
    });
    wrap.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
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

  var audio = new Audio(track.src);
  audio.preload = "auto";
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
    function go() {
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
    if (audio.readyState >= 1) go();
    else audio.addEventListener("loadedmetadata", go, { once: true });
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
