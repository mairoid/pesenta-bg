/* „Родени на този ден" — седем имена в плъзгаща лента.
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
      return { godina: Number(ch[0]), mesec: Number(ch[1]), den: Number(ch[2]) };
    } catch (e) {
      var d = new Date();
      return { godina: d.getFullYear(), mesec: d.getMonth() + 1, den: d.getDate() };
    }
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* 7% от имената носят пояснение в скоби: „Румен Николов (футболист)" или
     „Димитър Георгиев (футболист, р. 1992)". Професията и без това стои на
     реда отдолу, а годината е точно това, което картата вече не показва.
     Затова скобата се маха — НО само когато е излишна. Ако вътре има нещо
     различно от професията, то е там, за да различи двама съименници, и
     остава. Данните не се пипат; чисти се само показаното. */
  /* Данните носят година на раждане, но НЕ и година на смъртта. Затова
     възрастта може да твърди, че някой е жив, когато не е — „103 г." е
     твърдение за настоящето, каквото „р. 1923" не беше.
     Над 90 отпадат: 3,4% от записите са над 100, още 3,5% са между 90 и 99,
     тоест без този праг на всеки трети-четвърти ден щеше да излиза някой,
     за когото твърдението е невярно. Не е гаранция — и на 85 се умира —
     затова и текстът на секцията вече не казва „празнуват". */
  var MAX_VAZRAST = 90;

  function jiv(p, godina) {
    var v = godina - Number(p.godina);
    return v > 0 && v < MAX_VAZRAST;
  }

  function ime(p) {
    var m = String(p.ime).match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (!m) return p.ime;
    var vatre = m[2].replace(/,?\s*р\.\s*\d{4}/, "").trim();
    if (!vatre || vatre.toLowerCase() === String(p.pole).toLowerCase()) return m[1].trim();
    return m[1].trim() + " (" + vatre + ")";
  }

  /* Двата знака са SVG, не емоджи и не CSS ленти.
     Не емоджи, защото 🇧🇬 се рисува от два „regional indicator" знака и на
     Windows излиза като буквите BG, а не като знаме — тогава двата знака
     нямаше да са в сходен стил, а в никакъв.
     Не CSS ленти, защото знамето имаше рамка, а долната му лента е червена:
     отдолу оставаше бяла черта, точно тя, която дразнеше.
     БЕЗ clipPath, макар да е очевидното решение — той иска id, а знаците се
     повтарят по всяка карта и щяхме да получим дублирани идентификатори в
     страницата. Затова долната лента е път със заоблени само долни ъгли,
     изчислен да съвпадне с радиуса на основата. */
  var ZNAK_BG =
    '<svg class="rojden-znak" viewBox="0 0 26 18" aria-hidden="true">' +
      '<rect x="0.5" y="0.5" width="25" height="17" rx="3" fill="#fff"/>' +
      '<rect x="0.5" y="6.17" width="25" height="5.66" fill="#00966E"/>' +
      '<path d="M0.5 11.83 H25.5 V14.5 A3 3 0 0 1 22.5 17.5 H3.5' +
        ' A3 3 0 0 1 0.5 14.5 Z" fill="#D62612"/>' +
      '<rect x="0.5" y="0.5" width="25" height="17" rx="3" fill="none"' +
        ' stroke="rgba(0,0,0,.4)" stroke-width="1"/>' +
    "</svg>";

  /* Линиите на сушата стоят навътре от ръба на кръга: при радиус 8 и дебелина
     на щриха 1.5 всичко след x≈19.5 или преди x≈6.5 щеше да се подава извън
     синьото. */
  var ZNAK_SVYAT =
    '<svg class="rojden-znak" viewBox="0 0 26 18" aria-hidden="true">' +
      '<circle cx="13" cy="9" r="8" fill="#2A6FB0"/>' +
      '<path d="M7.4 6.2c1.4.4 2 1.4 3.1 1.3 1-.1 1.3-1 2.4-.9.9.1 1 .9 2 1' +
        ' .8.1 1.4-.5 2.2-.3" fill="none" stroke="#4ADE80" stroke-width="1.5"' +
        ' stroke-linecap="round"/>' +
      '<path d="M7 11.2c1.1-.5 1.8.3 2.8.2.9-.1 1.1-.8 2-.6 1 .2.9 1.2 2 1.4' +
        ' 1.1.2 1.6-.7 2.6-.4" fill="none" stroke="#4ADE80" stroke-width="1.5"' +
        ' stroke-linecap="round"/>' +
      '<circle cx="13" cy="9" r="8" fill="none" stroke="rgba(0,0,0,.4)"' +
        ' stroke-width="1"/>' +
    "</svg>";

  function karta(p, godina) {
    var bg = p.tip === "българска";
    var vazrast = godina - Number(p.godina);
    var znak = bg ? ZNAK_BG : ZNAK_SVYAT;
    var etiket = bg ? "българска" : "световна";
    /* Цялата карта е връзка към поръчка с предизбран повод „Рожден ден" —
       човек, който е спрял на нечий рожден ден, е на една мисъл от това да
       се сети за свой. Копията в лентата се правят с tabindex -1 в lenta(),
       за да не се минава два пъти през едни и същи връзки с клавиатура. */
    return '<a class="rojden-card" href="poruchka.html?povod=rojden-den"' +
             ' aria-label="Поръчай песен за рожден ден">' +
             '<span class="rojden-top" title="' + etiket + '">' + znak +
               '<span class="rojden-age">' + vazrast + "</span>" +
             "</span>" +
             "<h3>" + esc(ime(p)) + "</h3>" +
             '<p class="rojden-meta">' + esc(p.pole) + "</p>" +
           "</a>";
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
    /* Седем, а не четирите с top:true — лентата се движи и иска повече неща,
       за да не се повтаря видимо. Ако денят има по-малко, взима колкото има:
       най-малкият ден в данните е с шест записа. */
    var dnes = sofiaDnes();
    var podredeni = den.filter(function (p) { return jiv(p, dnes.godina); }).sort(bgParvo);
    var top = podredeni.slice(0, 7);
    if (!top.length) return false;

    /* НЕ „празнуват" — данните нямат година на смъртта, значи не можем да
       твърдим, че някой е жив. „Родени на този ден" е вярно и в двата
       случая, а възрастта до името си остава разбираема. */
    title.textContent = "Родени на " + dnes.den + " " + MESECI[dnes.mesec - 1] + ":";
    /* НЕ map(karta) — map подава индекса като втори аргумент и той щеше
       да влезе на мястото на годината. */
    var risuvai = function (p) { return karta(p, dnes.godina); };
    grid.innerHTML = top.map(risuvai).join("");

    /* Разгъването показва ЦЕЛИЯ ден, включително седемте отгоре — така
       броят в надписа съвпада с това, което човекът вижда, като разгъне. */
    toggle.textContent = "Виж всички от този ден (" + podredeni.length + ") →";
    all.innerHTML = podredeni.map(risuvai).join("");

    toggle.addEventListener("click", function () {
      var otvoreno = all.hidden;
      all.hidden = !otvoreno;
      toggle.setAttribute("aria-expanded", String(otvoreno));
      toggle.textContent = otvoreno
        ? "Скрий ↑"
        : "Виж всички от този ден (" + podredeni.length + ") →";
    });

    sec.hidden = false;

    /* Лентата се пуска СЛЕД показването на секцията: докато е hidden, тя е
       display:none и наблюдателят не би се задействал никога. */
    lenta();
    return true;
  }

  /* Същият похват като при отзивите: картите се дублират и лентата се
     превърта до −50%, тоест до началото на второто копие — шевът съвпада
     точно и движението изглежда безкрайно. Копията са aria-hidden, за да не
     ги прочете екранен четец два пъти. */
  function lenta() {
    var rail = document.getElementById("rojdendni-rail");
    if (!rail || !grid.children.length) return;
    var karti = Array.prototype.slice.call(grid.children);
    karti.forEach(function (k) {
      var kopie = k.cloneNode(true);
      kopie.setAttribute("aria-hidden", "true");
      kopie.setAttribute("tabindex", "-1");
      grid.appendChild(kopie);
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {
        e.forEach(function (x) { grid.classList.toggle("rolling", x.isIntersecting); });
      }, { threshold: 0.2 }).observe(rail);
    } else {
      grid.classList.add("rolling");
    }
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
