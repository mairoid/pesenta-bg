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

  /* Знаците живеят в znamena.js: набор от трийсет знамена в една и съща кутия
     26 на 18, плюс глобус за тези, чиято държава не знаем. Тук само ги викаме.
     Не емоджи, защото 🇧🇬 се рисува от два „regional indicator“ знака и на
     Windows излиза като буквите BG, а не като знаме. */

  /* Иконка по професия. ТУК емоджи е добре, за разлика от знамето: ⚽ и 🎤 са
     единични знака и се рисуват навсякъде, докато 🇧🇬 е двойка „regional
     indicator" и на Windows излиза като буквите BG.
     Търси се по част от думата, защото данните имат десетки варианти на едно
     и също — „певец", „певица", „народна певица". Редът има значение:
     по-конкретните са преди по-общите. */
  var IKONI = [
    ["футболен треньор", "📋"], ["треньор", "📋"],
    ["американски футболист", "🏈"], ["футбол", "⚽"],
    ["баскетбол", "🏀"], ["волейбол", "🏐"], ["хокеист", "🏒"],
    ["бейзбол", "⚾"], ["крикет", "🏏"], ["тенис", "🎾"],
    ["бокс", "🥊"], ["борец", "🤼"], ["щангист", "🏋"],
    ["гимнаст", "🤸"], ["плувец", "🏊"], ["ски", "⛷"],
    ["биатлон", "⛷"], ["фигурист", "⛸"], ["колоездач", "🚴"],
    ["мотоциклетист", "🏍"], ["автосъстезател", "🏁"],
    ["лекоатлет", "🏃"], ["атлет", "🏃"], ["шахмат", "♟"],
    ["спортист", "🏅"],
    ["певец", "🎤"], ["певица", "🎶"], ["рапър", "🎤"], ["диджей", "🎧"],
    ["китарист", "🎸"], ["пианист", "🎹"], ["диригент", "🎼"],
    ["композитор", "🎼"], ["продуцент", "🎚"], ["музикант", "🎵"],
    ["актьор", "🎭"], ["актриса", "🎭"], ["режисьор", "🎬"],
    ["сценарист", "🎬"], ["танцьор", "💃"], ["шоумен", "🎪"],
    ["артист", "🎨"], ["модел", "📸"],
    ["писател", "✍"], ["историч", "📜"],
    ["телевизион", "📺"], ["телеводещ", "📺"], ["инфлуенсър", "📱"],
    ["политик", "🏛"], ["генерал", "🎖"], ["духовник", "⛪"],
    ["химик", "🔬"], ["геолог", "🪨"]
  ];

  function ikona(pole) {
    var p = String(pole).toLowerCase();
    for (var i = 0; i < IKONI.length; i++) {
      if (p.indexOf(IKONI[i][0]) > -1) return IKONI[i][1];
    }
    return "🎂";
  }

  /* Четирилъчева звезда за покойниците. SVG, а не знакът ✦ от шрифта: него го
     няма във всеки шрифт и рискът да излезе празно квадратче не си струва —
     същата причина, поради която знамената не са емоджи. */
  var ZVEZDA =
    '<svg class="rojden-zvezda" viewBox="0 0 10 10" aria-hidden="true">' +
      '<path d="M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8Z"/>' +
    "</svg>";

  function karta(p, godina) {
    var vazrast = godina - Number(p.godina);
    /* Българите нямат поле strana — типът им я казва. За чужденците тя е
       разчетена на ръка и записана в данните; ако липсва или знамето го няма
       в набора, остава глобусът: липсата на данни трябва да изглежда като
       липса на данни, а не като чужда държава. */
    var kod = p.tip === "българска" ? "BG" : String(p.strana || "");
    var znak = window.zname(kod);
    var etiket = window.znameIme(kod);
    /* Числото си остава и за покойниците: заглавието казва „Родени на 11
       септември“, тоест то е възрастта, която човекът ЩЕШЕ да навърши днес.
       Смяната е в тона — градиентът пада до тихо сребро — и в звездата след
       него. Годините стоят в подсказката, където не пречат на подредбата. */
    var pochinal = Number(p.pochinal) || 0;
    if (pochinal) etiket += " · " + p.godina + " – " + pochinal;
    /* Цялата карта е връзка към поръчка с предизбран повод „Рожден ден" —
       човек, който е спрял на нечий рожден ден, е на една мисъл от това да
       се сети за свой. Копията в лентата се правят с tabindex -1 в lenta(),
       за да не се минава два пъти през едни и същи връзки с клавиатура. */
    return '<a class="rojden-card" href="poruchka.html?povod=rojden-den"' +
             ' aria-label="Поръчай песен за рожден ден">' +
             '<span class="rojden-top" title="' + esc(etiket) + '">' + znak +
               '<span class="rojden-vazrast' + (pochinal ? " pochinal" : "") + '">' +
                 '<span class="rojden-age">' + vazrast + "</span>" +
                 (pochinal ? ZVEZDA : "") +
               "</span>" +
             "</span>" +
             "<h3>" + esc(ime(p)) + "</h3>" +
             '<p class="rojden-meta">' + esc(p.pole) +
               ' <span class="rojden-ikona" aria-hidden="true">' + ikona(p.pole) + "</span></p>" +
           "</a>";
  }

  /* Легендата излиза само ако в лентата наистина има покоен. Иначе редът е
     обяснение на нещо, което го няма на екрана. */
  function legenda(pokazani) {
    var el = document.getElementById("rojdendni-legenda");
    if (!el) return;
    var ima = pokazani.some(function (p) { return Number(p.pochinal); });
    el.hidden = !ima;
    el.innerHTML = ima ? ZVEZDA + "<span>вече не е сред нас</span>" : "";
  }

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
    legenda(top);

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

    window.znameDefs(sec);
    sec.hidden = false;

    /* Пуска се СЛЕД показването на секцията: докато е hidden, тя е
       display:none и нищо не може да се измери в нея. */
    pusni();
    return true;
  }

  /* Лентата е обща за трите върволици на сайта — рождениците, отзивите и
     поводите. Механизмът ѝ живее в lenta.js; тук само я пускаме, след като
     картите вече са в разметката. */
  function pusni() {
    var rail = document.getElementById("rojdendni-rail");
    if (rail && window.lenta) window.lenta(rail, grid, { skorost: 38 });
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
