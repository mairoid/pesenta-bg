/* Коледният слой на pesenta.bg (преносен от natalna.bg, 15.11.2026): снежинки над
   страницата и гирлянд от лампички под хедъра. Слоят е само украса: без JavaScript
   не съществува (в HTML-а няма нищо от него), а след UNTIL сам се изключва.

   Снежинките са шестораменни кристали, които се въртят, докато падат. Три форми се
   рисуват веднъж на 64 px и после само се печатат, за да е кадърът евтин. */
(function () {
  'use strict';

  // Последният ден със сняг. Страницата е статична и не знае каква е датата, затова
  // сезонът се проверява в браузъра, а не при публикуване.
  var UNTIL = '2027-01-07T23:59:59+02:00';
  // Цвят и плътност на снега: на едно място, за да се подберат след пробата в браузър.
  var CVYAT = '#ffffff';
  var PLATNOST = 1; // множител върху alpha на кристалите

  if (Date.now() > Date.parse(UNTIL)) return;

  // currentScript е валиден само докато скриптът се изпълнява синхронно; след 'load'
  // вече е null. Затова адресът на CSS-а се извежда сега: така работи и от подпапки
  // (novini/, pesni/), и пази същия ?v= отпечатък като самия скрипт.
  var self = document.currentScript;
  var cssUrl = self && self.src ? self.src.replace(/js\/koleda\.js/, 'css/koleda.css') : '';
  if (!cssUrl) return;

  function start() {
    // Защита срещу двойно пускане (скриптът може да е включен два пъти).
    if (document.querySelector('.koleda-snyag')) return;

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    // Елементите се добавят чак след като CSS-ът е дошъл, иначе за миг се виждат
    // нестилизирани (голям canvas в потока, бутон без вид). При грешка — нищо.
    link.onload = build;
    link.onerror = function () { /* без стил няма слой; страницата си е цяла */ };
    document.head.appendChild(link);
  }

  function build() {
    if (document.querySelector('.koleda-snyag')) return;

    var en = /^en/i.test(document.documentElement.lang || '');
    var TXT_OFF = en ? 'Stop the snow' : 'Спри снега';
    var TXT_ON = en ? 'Let it snow' : 'Пусни снега';

    // a) Лампичките висят от долния ръб на хедъра. Без sticky хедър няма за какво да
    // се закачат и се пропускат; снегът остава.
    var header = document.querySelector('header.site-header');
    if (header) {
      var lampi = document.createElement('div');
      lampi.className = 'koleda-lampi';
      lampi.setAttribute('aria-hidden', 'true');
      for (var n = 0; n < 22; n += 1) {
        var lampa = document.createElement('i');
        lampa.style.setProperty('--i', String(n));
        lampi.appendChild(lampa);
      }
      header.appendChild(lampi);
    }

    // b) Снегът и бутонът за спиране.
    var canvas = document.createElement('canvas');
    canvas.className = 'koleda-snyag';
    canvas.setAttribute('aria-hidden', 'true');
    var toggle = document.createElement('button');
    toggle.className = 'koleda-kopche';
    toggle.type = 'button';
    toggle.setAttribute('aria-pressed', 'true');
    var znak = document.createElement('span');
    znak.setAttribute('aria-hidden', 'true');
    znak.textContent = '❄';
    var text = document.createElement('span');
    text.className = 'koleda-kopche-tekst';
    text.textContent = TXT_OFF;
    toggle.appendChild(znak);
    toggle.appendChild(text);
    document.body.appendChild(canvas);
    document.body.appendChild(toggle);

    var context = canvas.getContext('2d');
    if (!context) { canvas.remove(); toggle.remove(); return; }
    var still = matchMedia('(prefers-reduced-motion: reduce)');
    var off = false;
    try { off = localStorage.getItem('koleda-snyag') === 'off'; } catch (e) { /* частен прозорец: снегът просто вали */ }
    var flakes = [];
    var width = 0; var height = 0; var frame = 0; var last = 0;

    // Три кристала, нарисувани веднъж на 64 px: шест рамена, всяко със свой
    // модел от странични клонки.
    var SIZE = 64;
    var shapes = [
      [[0.45, 0.3], [0.72, 0.2]],
      [[0.38, 0.22], [0.6, 0.3], [0.85, 0.14]],
      [[0.55, 0.36]]
    ].map(function (branches, kind) {
      var sprite = document.createElement('canvas');
      sprite.width = sprite.height = SIZE;
      var pen = sprite.getContext('2d');
      var reach = SIZE / 2 - 3;
      pen.translate(SIZE / 2, SIZE / 2);
      pen.strokeStyle = CVYAT; pen.lineCap = 'round'; pen.lineWidth = kind === 2 ? 3.4 : 2.6;
      for (var arm = 0; arm < 6; arm += 1) {
        pen.save(); pen.rotate(arm * Math.PI / 3);
        pen.beginPath(); pen.moveTo(0, 0); pen.lineTo(0, -reach);
        for (var b = 0; b < branches.length; b += 1) {
          var at = branches[b][0]; var length = branches[b][1];
          for (var side = -1; side <= 1; side += 2) {
            pen.moveTo(0, -reach * at);
            pen.lineTo(side * reach * length * 0.87, -reach * (at + length * 0.5));
          }
        }
        pen.stroke(); pen.restore();
      }
      if (kind === 0) { pen.fillStyle = CVYAT; pen.beginPath(); pen.arc(0, 0, 3.4, 0, 6.2832); pen.fill(); }
      return sprite;
    });

    function flake(anywhere) {
      var depth = Math.random();
      var big = 9 + depth * 15;
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : -big,
        size: big,
        speed: 12 + depth * 26,
        sway: 8 + Math.random() * 22,
        phase: Math.random() * 6.28,
        turn: Math.random() * 6.28,
        spin: (Math.random() - 0.5) * 0.9,
        alpha: (0.28 + depth * 0.5) * PLATNOST,
        shape: shapes[Math.floor(Math.random() * shapes.length)]
      };
    }

    function size() {
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Малко и ясно, а не много и ситно: текстът остава лесен за четене, а
      // батерията на телефона не страда.
      var count = Math.round(Math.min(46, Math.max(14, width / 30)));
      flakes = [];
      for (var i = 0; i < count; i += 1) flakes.push(flake(true));
    }

    function draw(now) {
      frame = 0;
      if (!canvas.isConnected) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      context.clearRect(0, 0, width, height);
      for (var i = 0; i < flakes.length; i += 1) {
        var item = flakes[i];
        item.y += item.speed * dt; item.phase += dt * 0.7; item.turn += item.spin * dt;
        if (item.y > height + item.size) { item = flakes[i] = flake(false); }
        context.globalAlpha = item.alpha;
        context.save();
        context.translate(item.x + Math.sin(item.phase) * item.sway, item.y);
        context.rotate(item.turn);
        context.drawImage(item.shape, -item.size / 2, -item.size / 2, item.size, item.size);
        context.restore();
      }
      run();
    }

    function run() {
      if (!frame && !off && !still.matches && !document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    }

    function show() {
      var falling = !off && !still.matches;
      canvas.hidden = !falling;
      toggle.hidden = still.matches;
      toggle.setAttribute('aria-pressed', String(!off));
      text.textContent = off ? TXT_ON : TXT_OFF;
      if (falling) run(); else if (frame) { cancelAnimationFrame(frame); frame = 0; }
    }

    toggle.addEventListener('click', function () {
      off = !off;
      try { localStorage.setItem('koleda-snyag', off ? 'off' : 'on'); } catch (e) { /* не се запомня, това е всичко */ }
      show();
    });
    // Само при промяна на ширината: на телефон адресната лента променя височината
    // при всяко скролиране и без този праг снегът би се прегенерирал постоянно.
    window.addEventListener('resize', function () {
      if (canvas.isConnected && Math.abs(window.innerWidth - width) > 40) size();
    });
    document.addEventListener('visibilitychange', run);
    // Старите браузъри нямат addEventListener на MediaQueryList.
    if (still.addEventListener) still.addEventListener('change', show);
    else if (still.addListener) still.addListener(show);
    size(); show();
  }

  // Стартът е след зареждането и в свободно време: слоят не бива да се бори с първото
  // рисуване и да става LCP елемент.
  function idle() {
    if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 3000 });
    else setTimeout(start, 200);
  }
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle);
})();
