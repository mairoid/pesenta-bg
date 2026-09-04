/* Pesenta.bg — фон „Ноти“ v3 (за сайта):
   1) Динамично петолиние — линиите вълнуват и се изкривяват около курсора
   2) Еквалайзер в основата — стълбовете реагират на движението на мишката
   3) Ноти по пътя на курсора — „Ода на радостта“, всяка нота на своя тон;
      при отдалечаване на курсора се замъгляват и избледняват

   Прозрачен canvas зад съдържанието — тъмният фон на сайта си остава същият.

   Интеграция (само index.html):
     <canvas id="noti-bg" aria-hidden="true"></canvas>  веднага след <body>
     <script src="assets/js/noti-bg.js" defer></script> при другите скриптове
     CSS: #noti-bg { position: fixed; inset: 0; z-index: -1; pointer-events: none; }
   z-index е -1, не 0: html няма собствен фон, затова фонът на body се
   рисува върху viewport-а и платното ляга над него, но под всичко в потока.
   При z-index 0 платното щеше да е НАД неоразмерените елементи на main.

   Разлики от v2 (KIMI):
   - Няма подмяна на курсора. cursor: … !important върху html/body
     прегазваше настройките на системата за уголемен/контрастен курсор.
   - Сол ключът се рисува само ако шрифтът го има. 𝄞 е U+1D11E; на Android
     и Linux без Noto Music излизаше празно каре насред екрана.
   - Петолинието не минава зад бутоните в героя: мери групата .hero .hero-ctas
     и застава в по-голямата свободна ивица над или под нея. Само в героя —
     .btn-primary има и в хедъра, а querySelector връща първия по документ. */
(function () {
  "use strict";

  var platno = document.getElementById("noti-bg");
  if (!platno) return;

  /* Уважаваме prefers-reduced-motion и touch-устройства без курсор */
  var namaleno = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var bezKursor = window.matchMedia("(pointer: coarse)").matches;
  if (namaleno || bezKursor) return;

  var ctx = platno.getContext("2d");
  if (!ctx) return;
  var imaFilter = "filter" in ctx; /* за blur на отдалечените ноти */

  /* ---------- Настройки ---------- */
  var NASTROIKI = {
    cvyatOtx: [255, 77, 141],   /* --pink   #ff4d8d */
    cvyatDo:  [255, 161, 77],   /* --orange #ffa14d */

    /* Динамично петолиние — едно единствено */
    liniiaGrupa: 5,
    liniiaRazstoqnie: 14,
    liniiaAlpha: 0.085,     /* една идея по-видими линии */
    vulnaAmplituda: 5,      /* px амплитуда на собствената вълна */
    vulnaSkorost: 0.5,      /* скорост на вълнуването */
    zavoiSila: 22,          /* px колко се изкривяват линиите около курсора */
    zavoiObhvat: 110,       /* px хоризонтален обхват на изкривяването */
    paralaks: 0.025,        /* дял от отместването на курсора — цялото петолиние се мести */
    kliuchX: 34,            /* px позиция на големия сол ключ от левия край */
    kliuchAlpha: 0.11,      /* прозрачност на сол ключа */
    liniiaNachalo: 105,     /* px от къде започват линиите (след ключа) */

    /* Позиция на петолинието. В демото беше на 50% от височината и на живо
       минаваше зад основния бутон. Сега мери групата бутони в героя
       (.hero-ctas — двата розови и „Чуй примери“) и застава в по-голямата
       свободна ивица — под нея или над нея. Само .hero — в хедъра също има
       .btn-primary. querySelector връща първия по документ, а групата
       предхожда бутоните в нея; резервата е самият основен бутон. */
    izbyagvai: ".hero .hero-ctas, .hero .btn-primary",
    petolinieOtstup: 40,    /* px въздух между петолинието и бутона */
    eqRezerv: 150,          /* px запазени отдолу за еквалайзера */
    gornaGranica: 96,       /* px под хедъра, над които не се качва */

    /* Еквалайзер в долната част */
    eqShirina: 6,           /* px ширина на стълб */
    eqPraznina: 8,          /* px между стълбовете */
    eqBaza: 5,              /* px минимална височина */
    eqSvobodno: 12,         /* px амплитуда в покой (бавно „дишане“) */
    eqReakciia: 110,        /* px максимална реакция около курсора */
    eqObhvat: 130,          /* px обхват на възбудата около курсора */
    eqAlpha: 0.16,

    /* Нотни знаци — ♩ и ♪ са в Miscellaneous Symbols и ги има навсякъде;
       сол ключът 𝄞 е в Musical Symbols и се проверява отделно (imaKliuch) */
    shrift: '"Segoe UI Symbol", "Apple Symbols", "Noto Music", "Noto Sans Symbols 2", sans-serif',

    /* Поява и живот на нотите */
    stapkaPoxel: 34,        /* по-често от v1 — повече ноти */
    maxNoti: 140,
    zhivotMin: 1.8,
    zhivotMax: 3.4,
    razmerMin: 17,          /* по-равни размери — изглежда като нотопис */
    razmerMax: 21,

    /* Замъгляване и избледняване при отдалечаване на курсора */
    blizoDo: 150,           /* px — до тук нотата е рязка и пълна */
    dalechSled: 420,        /* px — след това е напълно изчезнала */
    blurMax: 5,             /* px максимално замъгляване */
    slediAlpha: 0.62,       /* таван на непрозрачността — приглушени следи */

    /* Дрейф и „шокова вълна“ при рязко метене */
    dreyfGore: 5,           /* минимален — нотата трябва да си остане на тона */
    udarPrag: 900,
    udarSila: 0.35
  };

  /* „Ода на радостта“ (Бетовен, 9-а симфония) — първа фраза.
     s: диатонични стъпки спрямо E4 (долната линия на петолинието):
        ред или междина = 1 стъпка; C4 = -2 (добавен ред отдолу).
     d: ритъм — 1 четвърт, 0.5 осмина, 1.5 точка-четвърт, 2 половин. */
  var MELODIA = [
    { s: 0, d: 1 },   /* E */ { s: 0, d: 1 },   /* E */
    { s: 1, d: 1 },   /* F */ { s: 2, d: 1 },   /* G */
    { s: 2, d: 1 },   /* G */ { s: 1, d: 1 },   /* F */
    { s: 0, d: 1 },   /* E */ { s: -1, d: 1 },  /* D */
    { s: -2, d: 1 },  /* C */ { s: -2, d: 1 },  /* C */
    { s: -1, d: 1 },  /* D */ { s: 0, d: 1 },   /* E */
    { s: 0, d: 1.5 }, /* E. */ { s: -1, d: 0.5 },/* D */
    { s: -1, d: 2 }   /* D (половин) */
  ];
  var notaIndeks = 0;

  var W = 0, H = 0, DPR = 1;
  var petolinieG = 0;       /* горният ред на петолинието, сметнат в presmetniPetolinie() */
  var noti = [];
  var eqVisochini = [];     /* текущи височини на стълбовете (за плавност) */
  var mishka = {
    x: -9999, y: -9999, px: -9999, py: -9999, t: 0,
    sx: -9999, sy: -9999, /* изгладена позиция — за паралакса и изкривяването */
    v: 0 /* изгладена скорост — захранва еквалайзера */
  };
  var natrupano = 0;
  var posledenKadur = 0;
  var tekushtOffX = 0, tekushtOffY = 0; /* паралакс от последния кадър */

  /* Има ли шрифтът истински знак за 𝄞? Рисува го в скрито платно и го
     сравнява със знак, който със сигурност липсва (частна зона и
     не-знак от същата допълнителна равнина). Еднакви пиксели = каре
     вместо ключ; празно платно = браузърът не рисува нищо. И в двата
     случая ключът се пропуска, а линиите тръгват от левия край. */
  function imaGlif(znak) {
    var c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    var k = c.getContext("2d");
    if (!k) return false;
    function pikseli(s) {
      k.clearRect(0, 0, 64, 64);
      k.font = "28px " + NASTROIKI.shrift;
      k.textAlign = "center"; k.textBaseline = "middle";
      k.fillStyle = "#fff";
      k.fillText(s, 32, 32);
      return k.getImageData(0, 0, 64, 64).data;
    }
    var a = pikseli(znak), i, prazen = true;
    for (i = 3; i < a.length; i += 4) { if (a[i]) { prazen = false; break; } }
    if (prazen) return false;
    var probi = ["\uE000", "\uDBFF\uDFFD"], p, b, ednakvi; /* U+E000, U+10FFFD */
    for (p = 0; p < probi.length; p++) {
      b = pikseli(probi[p]); ednakvi = true;
      for (i = 3; i < a.length; i += 4) { if (a[i] !== b[i]) { ednakvi = false; break; } }
      if (ednakvi) return false;
    }
    return true;
  }
  var imaKliuch = imaGlif("𝄞");
  var liniiaOt = imaKliuch ? NASTROIKI.liniiaNachalo : NASTROIKI.kliuchX;

  function orazmeri() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    platno.width = Math.round(W * DPR);
    platno.height = Math.round(H * DPR);
    platno.style.width = W + "px";
    platno.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    eqVisochini = [];
    presmetniPetolinie();
  }

  /* Къде да застане петолинието, за да не минава зад бутоните в героя.
     Смята се при зареждане и при resize — не при скрол, за да не се мести.
     Ако групата е извън екрана (страницата е заредена превъртяна), важи
     долната ивица. */
  function presmetniPetolinie() {
    var visochina = (NASTROIKI.liniiaGrupa - 1) * NASTROIKI.liniiaRazstoqnie;
    var lenta = visochina + 2 * NASTROIKI.petolinieOtstup;
    var dolu = H - NASTROIKI.eqRezerv;                 /* над еквалайзера */
    var cel = document.querySelector(NASTROIKI.izbyagvai);
    if (cel) {
      var r = cel.getBoundingClientRect();
      var vidim = r.width > 0 && r.bottom > NASTROIKI.gornaGranica && r.top < dolu;
      if (vidim) {
        var podBut = dolu - r.bottom;                   /* свободно под бутона */
        var nadBut = r.top - NASTROIKI.gornaGranica;    /* свободно над него */
        if (podBut >= lenta && podBut >= nadBut) {
          petolinieG = Math.round(r.bottom + NASTROIKI.petolinieOtstup);
          return;
        }
        if (nadBut >= lenta) {
          petolinieG = Math.round(r.top - NASTROIKI.petolinieOtstup - visochina);
          return;
        }
      }
    }
    /* Няма бутон или няма място — долната ивица, над еквалайзера */
    petolinieG = Math.round(dolu - NASTROIKI.petolinieOtstup - visochina);
  }

  /* Градиент pink→orange според позицията — същият като --grad в style.css */
  function cvyat(x, y, alpha) {
    var t = (x / W + y / H) / 2;
    var r = Math.round(NASTROIKI.cvyatOtx[0] + (NASTROIKI.cvyatDo[0] - NASTROIKI.cvyatOtx[0]) * t);
    var g = Math.round(NASTROIKI.cvyatOtx[1] + (NASTROIKI.cvyatDo[1] - NASTROIKI.cvyatOtx[1]) * t);
    var b = Math.round(NASTROIKI.cvyatOtx[2] + (NASTROIKI.cvyatDo[2] - NASTROIKI.cvyatOtx[2]) * t);
    return "rgba(" + r + "," + g + "," + b + "," + alpha.toFixed(3) + ")";
  }

  /* Гаусова функция — плавен обхват около точка */
  function gaus(razlika, obhvat) {
    var n = razlika / obhvat;
    return Math.exp(-n * n * 2);
  }

  /* ---------- 1) Динамично петолиние ----------
     Едно единствено петолиние с голям сол ключ в началото — както в нотния
     запис. Мести се леко след курсора (паралакс), линиите вълнуват сами
     и се изкривяват около курсора. */
  function petolinie(vreme, offX, offY) {
    var visochina = (NASTROIKI.liniiaGrupa - 1) * NASTROIKI.liniiaRazstoqnie;
    var g = petolinieG;

    /* Големият сол ключ в началото на петолинието — само ако шрифтът го има */
    if (imaKliuch) {
      ctx.save();
      ctx.font = Math.round(visochina * 1.75) + "px " + NASTROIKI.shrift;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(244, 242, 255," + NASTROIKI.kliuchAlpha + ")";
      ctx.fillText("𝄞", NASTROIKI.kliuchX + offX, g + visochina / 2 + offY);
      ctx.restore();
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(244, 242, 255," + NASTROIKI.liniiaAlpha + ")";
    for (var l = 0; l < NASTROIKI.liniiaGrupa; l++) {
      var bazY = g + l * NASTROIKI.liniiaRazstoqnie + offY;
      ctx.beginPath();
      /* Линията се чертае на отсечки, за да може да вълнува
         и да се изкриви около курсора */
      for (var x = liniiaOt; x <= W; x += 24) {
        var y = bazY +
          Math.sin((x + offX) * 0.006 + vreme * NASTROIKI.vulnaSkorost + l * 0.7) *
          NASTROIKI.vulnaAmplituda;

        /* Изкривяване около курсора: линиите се „отдръпват“ от него */
        if (mishka.sx > -9000) {
          var blizost = gaus(x - mishka.sx, NASTROIKI.zavoiObhvat);
          var posoka = bazY < mishka.sy ? -1 : 1;
          var vertikalna = gaus(bazY - mishka.sy, 160);
          y += posoka * blizost * vertikalna * NASTROIKI.zavoiSila;
        }

        if (x === liniiaOt) ctx.moveTo(x + offX, y);
        else ctx.lineTo(x + offX, y);
      }
      ctx.stroke();
    }
  }

  /* ---------- 2) Еквалайзер в основата ---------- */
  function ekvalaizer(vreme, dt) {
    var stupka = NASTROIKI.eqShirina + NASTROIKI.eqPraznina;
    var broy = Math.ceil(W / stupka);
    /* Изгладената скорост на мишката вдига стълбовете около курсора */
    var vuzbuda = Math.min(mishka.v / 1200, 1);
    var i, x, cel, tekushta;

    for (i = 0; i < broy; i++) {
      x = i * stupka + stupka / 2;
      cel = NASTROIKI.eqBaza +
        (Math.sin(vreme * 1.4 + i * 0.55) * 0.5 + 0.5) * NASTROIKI.eqSvobodno;
      if (mishka.x > -9000) {
        cel += gaus(x - mishka.x, NASTROIKI.eqObhvat) *
               vuzbuda * NASTROIKI.eqReakciia *
               (0.6 + 0.4 * Math.sin(vreme * 6 + i));
      }
      /* Плавно нарастване и падане */
      tekushta = eqVisochini[i] == null ? cel : eqVisochini[i];
      tekushta += (cel - tekushta) * Math.min(dt * 10, 1);
      eqVisochini[i] = tekushta;

      ctx.fillStyle = cvyat(x, H, NASTROIKI.eqAlpha +
        Math.min(tekushta / NASTROIKI.eqReakciia, 1) * 0.25);
      ctx.fillRect(x - NASTROIKI.eqShirina / 2, H - tekushta,
                   NASTROIKI.eqShirina, tekushta);
    }
  }

  /* ---------- 3) Ноти по пътя на курсора ---------- */
  /* Нова нота — следващият тон от „Ода на радостта“.
     Вертикалната позиция идва от височината на тона върху петолинието
     (включително текущите паралакс и вълна), хоризонталната — от курсора. */
  function novaNota(x, vx, vy) {
    if (noti.length >= NASTROIKI.maxNoti) noti.shift();
    var ton = MELODIA[notaIndeks % MELODIA.length];
    notaIndeks++;

    var visochina = (NASTROIKI.liniiaGrupa - 1) * NASTROIKI.liniiaRazstoqnie;
    var g = petolinieG;
    /* Долната линия (E4) на това x, с паралакса и вълната към момента */
    var dolnaLinia = g + visochina + tekushtOffY +
      Math.sin((x + tekushtOffX) * 0.006 +
               (posledenKadur / 1000) * NASTROIKI.vulnaSkorost +
               (NASTROIKI.liniiaGrupa - 1) * 0.7) * NASTROIKI.vulnaAmplituda;
    var y = dolnaLinia - ton.s * (NASTROIKI.liniiaRazstoqnie / 2);

    noti.push({
      znak: ton.d < 1 ? "♪" : "♩",
      x: x, y: y,
      vx: vx, vy: vy,
      ugul: 0, vugul: 0,            /* нотописът е изправен, без ротация */
      razmer: NASTROIKI.razmerMin +
              Math.random() * (NASTROIKI.razmerMax - NASTROIKI.razmerMin),
      vazrast: 0,
      zhivot: NASTROIKI.zhivotMin +
              Math.random() * (NASTROIKI.zhivotMax - NASTROIKI.zhivotMin),
      /* Добавен ред под петолинието за тонове като C4 (четни стъпки ≤ -2) */
      liniya: ton.s <= -2 && ton.s % 2 === 0
    });
  }

  function priDvijenie(e) {
    var sega = performance.now();
    var x = e.clientX, y = e.clientY;
    if (mishka.px < -9000) { mishka.px = x; mishka.py = y; mishka.t = sega; }

    var dx = x - mishka.px, dy = y - mishka.py;
    var dt = Math.max(sega - mishka.t, 1);
    var razstoqnie = Math.sqrt(dx * dx + dy * dy);
    var skorost = razstoqnie / dt * 1000;

    /* Изгладена скорост за еквалайзера */
    mishka.v = mishka.v * 0.85 + skorost * 0.15;

    /* Рязко метене → кинетична вълна в нотите */
    var vx = 0, vy = 0;
    if (skorost > NASTROIKI.udarPrag) {
      vx = (dx / dt * 1000) * NASTROIKI.udarSila;
      vy = (dy / dt * 1000) * NASTROIKI.udarSila;
    }

    mishka.x = x; mishka.y = y;

    natrupano += razstoqnie;
    while (natrupano >= NASTROIKI.stapkaPoxel) {
      natrupano -= NASTROIKI.stapkaPoxel;
      novaNota(
        x + (Math.random() - 0.5) * 14,
        vx * (0.6 + Math.random() * 0.8),
        vy * (0.6 + Math.random() * 0.8)
      );
    }

    mishka.px = x; mishka.py = y; mishka.t = sega;
  }

  /* Резервна проверка на подредбата — веднъж на 30 кадъра. Хваща смяна на
     размера без resize събитие (емулиран viewport), късно зареден шрифт и
     свиването на #hero-intro при клик на „Поръчай бързо“ (text-order.js),
     при което бутонът се качва. Сравнява позицията В ДОКУМЕНТА, не във
     viewport-а — иначе скролът щеше да мести петолинието. */
  var kadri = 0, posledenOtpechatuk = "";
  function proveriRazpolozhenie() {
    var cel = document.querySelector(NASTROIKI.izbyagvai);
    var otpechatuk = window.innerWidth + "x" + window.innerHeight;
    if (cel) {
      var r = cel.getBoundingClientRect();
      otpechatuk += "|" + Math.round(r.top + window.scrollY) + "|" + Math.round(r.height);
    }
    if (otpechatuk === posledenOtpechatuk) return;
    posledenOtpechatuk = otpechatuk;
    if (window.innerWidth !== W || window.innerHeight !== H) orazmeri();
    else presmetniPetolinie();
  }

  /* ---------- Кадри ---------- */
  function kadur(sega) {
    var dt = Math.min((sega - posledenKadur) / 1000, 0.05);
    posledenKadur = sega;
    var vreme = sega / 1000;
    if (++kadri % 30 === 0) proveriRazpolozhenie();

    /* Скоростта затихва, когато мишката спре */
    mishka.v *= Math.pow(0.2, dt);

    /* Изгладена позиция на курсора — петолинието го следва с леко
       закъснение, което дава усещане за „жив“ фон, а не статична картина */
    if (mishka.x > -9000) {
      if (mishka.sx < -9000) { mishka.sx = mishka.x; mishka.sy = mishka.y; }
      var gladene = Math.min(dt * 4, 1);
      mishka.sx += (mishka.x - mishka.sx) * gladene;
      mishka.sy += (mishka.y - mishka.sy) * gladene;
    }
    /* Паралакс: цялото петолиние се отмества обратно на курсора */
    var offX = 0, offY = 0;
    if (mishka.sx > -9000) {
      offX = (mishka.sx - W / 2) * -NASTROIKI.paralaks;
      offY = (mishka.sy - H / 2) * -NASTROIKI.paralaks * 0.7;
    }
    tekushtOffX = offX; tekushtOffY = offY;

    ctx.clearRect(0, 0, W, H);
    petolinie(vreme, offX, offY);
    ekvalaizer(vreme, dt);

    for (var i = noti.length - 1; i >= 0; i--) {
      var n = noti[i];
      n.vazrast += dt;
      if (n.vazrast >= n.zhivot) { noti.splice(i, 1); continue; }

      n.vx *= 0.96;
      n.vy = n.vy * 0.96 - NASTROIKI.dreyfGore * dt;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.ugul += n.vugul * dt;

      /* Поява бърза, изчезване плавно по възраст */
      var vlez = Math.min(n.vazrast / 0.15, 1);
      var ostava = 1 - (n.vazrast / n.zhivot);

      /* Отдалечаване на курсора → blur + прозрачност до пълно изчезване */
      var dist = 0, blizostFaktor = 1;
      if (mishka.x > -9000) {
        var ddx = n.x - mishka.x, ddy = n.y - mishka.y;
        dist = Math.sqrt(ddx * ddx + ddy * ddy);
        blizostFaktor = 1 - Math.min(
          Math.max((dist - NASTROIKI.blizoDo) /
                   (NASTROIKI.dalechSled - NASTROIKI.blizoDo), 0), 1);
      }
      var alpha = vlez * ostava * blizostFaktor * NASTROIKI.slediAlpha;
      if (alpha <= 0.005) continue;

      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(n.ugul);
      if (imaFilter && blizostFaktor < 1) {
        ctx.filter = "blur(" +
          ((1 - blizostFaktor) * NASTROIKI.blurMax).toFixed(1) + "px)";
      }
      ctx.font = n.razmer + "px " + NASTROIKI.shrift;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = cvyat(n.x, n.y, alpha);
      /* Сянка само за рязките ноти — при blur е излишна и тежка */
      if (blizostFaktor > 0.6) {
        ctx.shadowColor = cvyat(n.x, n.y, alpha * 0.8);
        ctx.shadowBlur = 12;
      }
      ctx.fillText(n.znak, 0, 0);
      /* Добавен ред през нотата, когато тонът е под петолинието (напр. C4) */
      if (n.liniya) {
        ctx.shadowBlur = 0;
        ctx.fillRect(-n.razmer * 0.75, -0.5, n.razmer * 1.5, 1.2);
      }
      ctx.restore();
      if (imaFilter) ctx.filter = "none";
    }

    requestAnimationFrame(kadur);
  }

  /* ---------- Демо режим за скрийншот: курсорът върви покрай
     петолинието, за да се „запише“ мелодията рязко ---------- */
  function demoMetene() {
    var startX = W * 0.14, startY = petolinieG + 28;
    var stypki = 70;
    for (var i = 0; i < stypki; i++) {
      (function (i) {
        setTimeout(function () {
          var t = i / stypki;
          priDvijenie({
            clientX: startX + t * W * 0.72,
            clientY: startY + Math.sin(t * Math.PI * 2) * 30
          });
        }, i * 11);
      })(i);
    }
  }

  orazmeri();
  window.addEventListener("resize", orazmeri);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(presmetniPetolinie);
  window.addEventListener("load", presmetniPetolinie, { once: true });
  window.addEventListener("mousemove", priDvijenie, { passive: true });
  requestAnimationFrame(function (t) { posledenKadur = t; kadur(t); });

  if (/[?&]demo-sweep=1/.test(location.search)) demoMetene();
  /* За проверка от конзолата: ?noti-debug=1 → notiBgDebug() връща
     къде е петолинието и има ли ключ. Без параметъра не пипа window. */
  if (/[?&]noti-debug=1/.test(location.search)) {
    window.notiBgDebug = function () {
      return { petolinieG: petolinieG, imaKliuch: imaKliuch, W: W, H: H };
    };
  }
})();
