/* „Лента“ — хоризонтална върволица, която пълзи сама и се влачи на ръка.
   Ползва се от рождениците, от отзивите и от поводите.

   Защо истински скрол, а не CSS анимация върху transform: пръстът и
   анимацията се борят за едно и също свойство и едното винаги губи, тоест
   човек няма как да отмести картите, за да види следващите. Като скрол
   влаченето с пръст го върши самият браузър — с инерцията и всичко останало
   — а бавното пълзене е scrollLeft, добавян всеки кадър отгоре.

   Извиква се: lenta(rail, track, { skorost: 38 })
   rail  — кутията с overflow-x: auto
   track — вътрешната редица; децата ѝ се дублират за безкрайния шев */
(function () {
  "use strict";

  var TISHINA = 1500; /* колко милисекунди мълчим, след като човек е пипал */

  function klonirai(track) {
    /* Копията са само декор — екранен четец трябва да прочете съдържанието
       веднъж, не два пъти. */
    Array.prototype.slice.call(track.children).forEach(function (k) {
      var kopie = k.cloneNode(true);
      kopie.setAttribute("aria-hidden", "true");
      kopie.setAttribute("tabindex", "-1");
      /* Клонингът може да съдържа и свои фокусируеми деца — линкове, бутони. */
      Array.prototype.slice.call(kopie.querySelectorAll("a, button, [tabindex]"))
        .forEach(function (v) { v.setAttribute("tabindex", "-1"); });
      track.appendChild(kopie);
    });
  }

  function dvizhi(rail, track, skorost) {
    var tih = window.matchMedia("(prefers-reduced-motion: reduce)");
    var vidimo = true, nadvesen = false, vlacha = false;
    var pipano = 0, posleden = 0, pozicia = rail.scrollLeft;
    var startX = 0, baza = 0, premesteno = 0;

    function polovina() { return track.scrollWidth / 2; }

    /* Шевът: щом стигнем началото на второто копие, връщаме се с точно една
       половина. Съдържанието там е същото, значи окото не вижда скок.
       Наляво се приземяваме две точки ПРЕДИ половината, а не точно на нея:
       точно на нея е самата граница и следващият кадър веднага я разпознава
       като „стигнахме шева“, тоест дърпането наляво не води наникъде. */
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
        /* Докато човекът командва, лентата е негова. Ние само гледаме къде я
           оставя и завъртаме шева вместо него, за да не опре в стена. При
           влачене с мишка шева го върши pointermove, защото там трябва да се
           премести и опорната точка. */
        if (!vlacha) shev();
        pozicia = rail.scrollLeft;
      } else if (dt && vidimo && !nadvesen && !document.hidden && !tih.matches) {
        /* Позицията се пази ТУК, в число с дробна част, и чак после се подава
           на браузъра. При 60 кадъра добавката е 0.6 пиксела, а scrollLeft се
           закръгля до цял: „+= 0.6“ става 0, на следващия кадър пак 0.6 върху
           0 — и лентата стои неподвижна завинаги. */
        var p = polovina();
        pozicia += skorost * dt;
        if (p > 1 && pozicia >= p) pozicia -= p;
        rail.scrollLeft = pozicia;
      }
      requestAnimationFrame(tik);
    }
    requestAnimationFrame(tik);

    /* Кое значи „човекът пипна“: самите му действия. Първо го правех със
       сравнение на позиции — къде оставихме лентата срещу къде е сега — но
       браузърът невинаги нанася scrollLeft в същия кадър, всяко разминаване
       се четеше като „човекът превърта“ и лентата сама си слагаше спирачка:
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
       за мишка хващаме влаченето ръчно, а за пръст не пипаме нищо.

       НАРОЧНО без setPointerCapture (махнат на 06.09.2026). С капчър браузърът
       праща mouseup на лентата, а click отива при общия родител на mousedown
       (картата) и mouseup (лентата) — тоест на лентата. Картата-линк никога
       не получаваше click и нито един повод не се отваряше с мишка; с пръст
       работеше, защото капчърът беше само за мишка. Доказано с истински
       кликове през DevTools Protocol, не с element.click() — той не минава
       през това правило и лъже, че всичко е наред.
       Движението и пускането се слушат на window: така влаченето продължава
       и след като мишката излезе от лентата, без капчър. */
    rail.addEventListener("pointerdown", function (e) {
      pipna();
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      vlacha = true;
      premesteno = 0;
      startX = e.clientX;
      baza = rail.scrollLeft;
      rail.classList.add("vlacha");
    });
    window.addEventListener("pointermove", function (e) {
      if (!vlacha) return;
      /* Пусната извън прозореца: pointerup не идва, но при връщане бутонът е
         вдигнат — приключваме влаченето, вместо лентата да тръгне след мишката. */
      if (!e.buttons) { kray(); return; }
      var d = e.clientX - startX;
      if (Math.abs(d) > premesteno) premesteno = Math.abs(d);
      rail.scrollLeft = baza - d;
      shev();
      /* Опорната точка се мести по действителната позиция: така и след шева,
         и след като браузърът е опрял в края, движението продължава гладко
         вместо да подскочи. */
      baza = rail.scrollLeft + d;
      pozicia = rail.scrollLeft;
    });
    function kray() {
      if (!vlacha) return;
      pipna();
      vlacha = false;
      rail.classList.remove("vlacha");
    }
    rail.addEventListener("pointerup", pipna);   /* и пръстът е „пипане“ */
    window.addEventListener("pointerup", kray);
    window.addEventListener("pointercancel", kray);

    /* Картите често са линкове. Без това всяко влачене завършва в отворена
       страница, защото браузърът праща click при пускането. Пет пиксела, за
       да не наказваме треперещата ръка. */
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

  window.lenta = function (rail, track, nastroiki) {
    if (!rail || !track || !track.children.length) return;
    klonirai(track);
    dvizhi(rail, track, (nastroiki && nastroiki.skorost) || 38);
  };
})();
