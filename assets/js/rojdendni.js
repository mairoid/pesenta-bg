/* „Днес празнуват" — показва четиримата с top:true за днешната дата.
 *
 * Секцията в index.html стои с hidden. Показва се САМО ако данните дойдат и
 * днешната дата съществува в тях. Всеки друг изход — мрежова грешка, счупен
 * JSON, липсващ ден — оставя секцията скрита. По-добре я няма, отколкото
 * празна рамка с обещание за имена, които не идват.
 */
(function () {
  "use strict";

  var SRC = "assets/data/rojdendni.json";
  var MESECI = ["януари", "февруари", "март", "април", "май", "юни",
                "юли", "август", "септември", "октомври", "ноември", "декември"];

  var sec = document.getElementById("rojdendni");
  if (!sec) return;

  var grid   = document.getElementById("rojdendni-grid");
  var title  = document.getElementById("rojdendni-title");
  var toggle = document.getElementById("rojdendni-toggle");
  var all    = document.getElementById("rojdendni-all");

  /* „Днес" значи днес В БЪЛГАРИЯ, не при посетителя. Иначе българин в Чикаго
     вижда вчерашните рожденици, защото там още не е настъпил денят.
     sv-SE дава ISO подредба (2026-08-14), от която датата се вади сигурно.
     Ако браузърът не познава часовата зона, пада обратно на локалното време —
     по-добре леко разминаване, отколкото скрита секция. */
  function sofiaDnes() {
    try {
      var s = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
      var ch = s.split("-");
      return { mesec: Number(ch[1]), den: Number(ch[2]) };
    } catch (e) {
      var d = new Date();
      return { mesec: d.getMonth() + 1, den: d.getDate() };
    }
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function karta(p) {
    var bg = p.tip === "българска";
    return '<article class="rojden-card">' +
             '<span class="rojden-badge ' + (bg ? "is-bg" : "is-svyat") + '">' +
               (bg ? "БГ" : "Свят") +
             "</span>" +
             "<h3>" + esc(p.ime) + "</h3>" +
             '<p class="rojden-meta">' + esc(p.pole) + ", р. " + esc(p.godina) + "</p>" +
           "</article>";
  }

  /* Българските top картите вървят първи, останалите запазват реда си от
     файла. Стабилно сортиране — Array.prototype.sort е стабилен от ES2019,
     а и на практика във всички браузъри, които поддържат fetch. */
  function bgParvo(a, b) {
    var A = a.tip === "българска" ? 0 : 1;
    var B = b.tip === "българска" ? 0 : 1;
    return A - B;
  }

  function pokaji(den) {
    var top = den.filter(function (p) { return p.top === true; }).sort(bgParvo);
    if (!top.length) return false;

    var dnes = sofiaDnes();
    title.textContent = "Днес, " + dnes.den + " " + MESECI[dnes.mesec - 1] + ", празнуват:";
    grid.innerHTML = top.map(karta).join("");

    /* Разгъването показва ЦЕЛИЯ ден, включително четиримата отгоре — така
       броят в надписа съвпада с това, което човекът вижда, като разгъне. */
    toggle.textContent = "Виж всички днешни (" + den.length + ") →";
    all.innerHTML = den.slice().sort(bgParvo).map(karta).join("");

    toggle.addEventListener("click", function () {
      var otvoreno = all.hidden;
      all.hidden = !otvoreno;
      toggle.setAttribute("aria-expanded", String(otvoreno));
      toggle.textContent = otvoreno
        ? "Скрий ↑"
        : "Виж всички днешни (" + den.length + ") →";
    });

    sec.hidden = false;
    return true;
  }

  function zaredi() {
    /* Без cache: "force-cache" — той пропуска ревалидацията и при подмяна на
       файла връщащите се посетители остават със старите данни. Нормалните HTTP
       правила ревалидират по ETag: 304 е няколкостотин байта, а грешният
       списък с имена се вижда. */
    fetch(SRC)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var dnes = sofiaDnes();
        var kluch = pad(dnes.mesec) + "-" + pad(dnes.den);
        var den = data && data[kluch];
        if (Array.isArray(den) && den.length) pokaji(den);
      })
      .catch(function () {
        /* Нарочно тихо: секцията си остава скрита. Грешка в конзолата тук
           само би плашила — няма какво да се поправи от страна на клиента. */
      });
  }

  /* Файлът е ~53 KB по мрежата и не му е мястото в надпреварата с hero-то,
     затова чака страницата да се зареди.
     НЕ се ползва IntersectionObserver върху самата секция: тя е hidden, тоест
     display:none, няма кутия и наблюдателят не би се задействал никога —
     секцията щеше да остане скрита завинаги. */
  if (document.readyState === "complete") zaredi();
  else window.addEventListener("load", zaredi, { once: true });
})();
