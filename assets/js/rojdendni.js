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

  /* Знамето е плосък правоъгълник с тъмен ринг. Ако отсреща сложим кръгъл
     глобус, в един и същ ред застават два различни ПРЕДМЕТА — знаме и
     картинка — и окото го чете като чуждо тяло. Затова световният знак е
     същият правоъгълник: „знаме на никоя държава“, в нашия розово-оранжев
     градиент, с решетка от меридиан и паралели вместо шарка.
     Двата предишни опита бяха синьо кръгче — и единственото синьо на сайта. */
  var GRAD_ID = "rojden-svyat-grad";
  var ZNAK_SVYAT =
    '<svg class="rojden-znak" viewBox="0 0 26 18" aria-hidden="true">' +
      '<rect x="0.5" y="0.5" width="25" height="17" rx="3" fill="url(#' + GRAD_ID + ')"/>' +
      '<g stroke="#fff" stroke-opacity=".9" stroke-width=".9" fill="none">' +
        '<path d="M1.1 9h23.8M2 4.4h22M2 13.6h22" stroke-linecap="round"/>' +
        '<ellipse cx="13" cy="9" rx="5.4" ry="8"/>' +
      "</g>" +
      '<rect x="0.5" y="0.5" width="25" height="17" rx="3" fill="none"' +
        ' stroke="rgba(0,0,0,.4)" stroke-width="1"/>' +
    "</svg>";

  /* Градиентът се дефинира ВЕДНЪЖ за цялата секция, не вътре в знака: картите
     се клонират за безкрайната лента, тоест id-то вътре в тях щеше да се
     повтори четиринайсет пъти. Тук стои един-единствен, извън тях. */
  function gradient(sec) {
    if (document.getElementById(GRAD_ID)) return;
    var kutiya = document.createElement("div");
    kutiya.innerHTML =
      '<svg width="0" height="0" aria-hidden="true" style="position:absolute">' +
        '<defs><linearGradient id="' + GRAD_ID + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#ff4d8d"/>' +
          '<stop offset="1" stop-color="#ffa14d"/>' +
        "</linearGradient></defs></svg>";
    sec.insertBefore(kutiya.firstChild, sec.firstChild);
  }

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
             '<p class="rojden-meta">' + esc(p.pole) +
               ' <span class="rojden-ikona" aria-hidden="true">' + ikona(p.pole) + "</span></p>" +
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

    gradient(sec);
    sec.hidden = false;

    /* Лентата се пуска СЛЕД показването на секцията: докато е hidden, тя е
       display:none и наблюдателят не би се задействал никога. */
    lenta();
    return true;
  }

  /* Картите се дублират и лентата се превърта до средата, тоест до началото на
     второто копие — шевът съвпада точно и движението изглежда безкрайно.
     Копията са aria-hidden, за да не ги прочете екранен четец два пъти. */
  function lenta() {
    var rail = document.getElementById("rojdendni-rail");
    if (!rail || !grid.children.length) return;
    Array.prototype.slice.call(grid.children).forEach(function (k) {
      var kopie = k.cloneNode(true);
      kopie.setAttribute("aria-hidden", "true");
      kopie.setAttribute("tabindex", "-1");
      grid.appendChild(kopie);
    });
    dvizhi(rail);
  }

  var SKOROST = 38;   /* пиксела в секунда — със същото темпо вървеше анимацията */
  var TISHINA = 1500; /* колко милисекунди мълчим, след като човек е пипал лентата */

  /* Движението е scrollLeft, добавен всеки кадър, а не CSS анимация върху
     transform. С transform пръстът и анимацията се борят за едно и също
     свойство и едното винаги губи — затова досега картите не се местеха.
     Като истински скрол влаченето с пръст го върши браузърът, с инерцията и
     всичко останало, а ние само добавяме бавното пълзене отгоре. */
  function dvizhi(rail) {
    var tih = window.matchMedia("(prefers-reduced-motion: reduce)");
    var vidimo = true, nadvesen = false, vlacha = false;
    var pipano = 0, posleden = 0, pozicia = rail.scrollLeft;
    var startX = 0, baza = 0, premesteno = 0;

    function polovina() { return grid.scrollWidth / 2; }

    /* Шевът: щом стигнем началото на второто копие, връщаме се с точно една
       половина. Съдържанието там е същото, значи окото не вижда скок.
       Наляво се приземяваме две точки ПРЕДИ половината, а не точно на нея:
       точно на нея е самата граница и следващият кадър веднага я разпознава
       като „стигнахме шева“. */
    function shev() {
      var p = polovina();
      if (p < 1) return;
      if (rail.scrollLeft >= p) rail.scrollLeft -= p;
      else if (rail.scrollLeft <= 0) rail.scrollLeft = p - 2;
    }

    function tik(t) {
      var dt = posleden ? (t - posleden) / 1000 : 0;
      posleden = t;
      /* Връщане от друг раздел на браузъра дава огромно dt — не бива да скача. */
      if (dt > 0.1) dt = 0.1;

      if (vlacha || t - pipano < TISHINA) {
        /* Докато човекът командва — с пръст, колелце или влачене — лентата е
           негова. Ние само гледаме къде я оставя и завъртаме шева вместо него,
           за да не опре в стена. При влачене с мишка шева го върши самото
           pointermove, защото там трябва да се премести и опорната точка. */
        if (!vlacha) shev();
        pozicia = rail.scrollLeft;
      } else if (dt && vidimo && !nadvesen && !document.hidden && !tih.matches) {
        /* Позицията се пази ТУК, в число с дробна част, и чак после се подава
           на браузъра. При 60 кадъра добавката е 0.6 пиксела, а scrollLeft се
           закръгля до цял: „+= 0.6“ става 0, на следващия кадър пак 0.6 върху
           0 — и лентата стои неподвижна завинаги. */
        var p = polovina();
        pozicia += SKOROST * dt;
        if (p > 1 && pozicia >= p) pozicia -= p;
        rail.scrollLeft = pozicia;
      }
      requestAnimationFrame(tik);
    }
    requestAnimationFrame(tik);

    /* Кое значи „човекът пипна“: самите му действия. Първо го правех със
       сравнение на позиции — къде оставихме лентата срещу къде е сега — но
       браузърът невинаги нанася scrollLeft в същия кадър, всяко разминаване се
       четеше като „човекът превърта“ и лентата сама си слагаше спирачка:
       вместо 38 пиксела в секунда вървеше по 5. */
    function pipna() { pipano = performance.now(); }
    rail.addEventListener("wheel", pipna, { passive: true });
    rail.addEventListener("touchstart", pipna, { passive: true });
    rail.addEventListener("touchmove", pipna, { passive: true });
    rail.addEventListener("keydown", pipna);
    /* Стигане до карта с Tab също превърта лентата — не бива да я дърпаме
       обратно изпод човека, който се движи с клавиатура. */
    rail.addEventListener("focusin", pipna);

    /* Мишката не превърта контейнер сама — това го умее само пръстът. Затова
       за мишка хващаме влаченето ръчно, а за пръст не пипаме нищо. */
    rail.addEventListener("pointerdown", function (e) {
      pipna();
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      vlacha = true;
      premesteno = 0;
      startX = e.clientX;
      baza = rail.scrollLeft;
      rail.classList.add("vlacha");
      try { rail.setPointerCapture(e.pointerId); } catch (x) {}
    });
    rail.addEventListener("pointermove", function (e) {
      if (!vlacha) return;
      var d = e.clientX - startX;
      if (Math.abs(d) > premesteno) premesteno = Math.abs(d);
      rail.scrollLeft = baza - d;
      shev();
      /* Опорната точка се мести по действителната позиция: така и след шева, и
         след като браузърът е опрял в края, следващото движение продължава
         гладко вместо да подскочи. */
      baza = rail.scrollLeft + d;
      pozicia = rail.scrollLeft;
    });
    function kray(e) {
      pipna();
      if (!vlacha) return;
      vlacha = false;
      rail.classList.remove("vlacha");
      try { rail.releasePointerCapture(e.pointerId); } catch (x) {}
    }
    rail.addEventListener("pointerup", kray);
    rail.addEventListener("pointercancel", kray);

    /* Картите са линкове. Без това всяко влачене завършва в поръчката, защото
       браузърът праща click при пускането. Пет пиксела, за да не наказваме
       треперещата ръка. */
    rail.addEventListener("click", function (e) {
      if (premesteno > 5) { e.preventDefault(); e.stopPropagation(); premesteno = 0; }
    }, true);
    rail.addEventListener("dragstart", function (e) { e.preventDefault(); });

    /* Спиране при надвесена мишка — само там, където мишка изобщо има. На
       телефон mouseenter се обажда при докосване, а mouseleave може никога да
       не дойде: лентата щеше да замръзне завинаги. */
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      rail.addEventListener("mouseenter", function () { nadvesen = true; });
      rail.addEventListener("mouseleave", function () { nadvesen = false; });
    }

    /* Наблюдателят само ГАСИ движението, когато лентата излезе от екрана — не
       го пали. Ако тръгвахме от „невидимо“ и някъде наблюдателят не се обади
       (стар браузър, среда без композиране), лентата оставаше замръзнала
       завинаги. По-евтината грешка е да е повървяла малко извън екрана. */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {
        e.forEach(function (x) { vidimo = x.isIntersecting; });
      }, { threshold: 0.2 }).observe(rail);
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
