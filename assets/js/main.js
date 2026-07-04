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

    btn.addEventListener("click", function () {
      if (audio.paused) {
        // спри всички останали
        players.forEach(function (p) { if (p.audio !== audio) p.pause(); });
        audio.play();
        btn.innerHTML = ICON_PAUSE;
      } else {
        pause();
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
