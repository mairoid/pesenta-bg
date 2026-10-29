/* Pesenta.bg — фон „Прах“ (29.10.2026): топлите светещи прашинки от видеото
   със студиото, които се носят бавно над тъмния кадър зад страницата.

   Взето от сцената „Светулки“ (particles-fireflies) в библиотеката СЦЕНА и
   орязано за сайта: без собствен фон, листа, зърно и винетка (платното е
   прозрачно), без привличане към мишката, кехлибарен тон, по-малко точки,
   на телефон — още по-малко и 30 кадъра в секунда. Тръгва след load, спира,
   когато табът е скрит; при prefers-reduced-motion рисува един неподвижен кадър.

   Интеграция (само index.html):
     <canvas id="prah-bg" aria-hidden="true"></canvas>  веднага след <body>, преди #noti-bg
     CSS: #prah-bg в style.css (fixed, z-index -1, плавно появяване с .is-on)

   Оригиналът е под MIT:

   MIT License

   Copyright (c) 2026 Meng To

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE. */
(function () {
  "use strict";

  var platno = document.getElementById("prah-bg");
  if (!platno || !platno.getContext) return;
  var ctx = platno.getContext("2d");

  var telefon = window.matchMedia("(max-width: 767px)").matches;
  var kalmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BROY = telefon ? 14 : 30;
  var TON = 34;                    /* кехлибарено, като лампите във видеото */
  var STAPKA = telefon ? 1 / 30 : 0;
  var DPR = Math.min(1.5, window.devicePixelRatio || 1);
  var W = 0, H = 0;
  var prah = [], spraytove = [];

  /* Двуоктавен шум по Перлин — прашинката блуждае, без да повтаря пътя си. */
  var P = new Uint8Array(512);
  (function () {
    var p = []; for (var i = 0; i < 256; i++) p[i] = i;
    var seed = 11;
    for (var j = 255; j > 0; j--) { seed = (seed * 16807) % 2147483647; var k = seed % (j + 1); var t = p[j]; p[j] = p[k]; p[k] = t; }
    for (var m = 0; m < 512; m++) P[m] = p[m & 255];
  })();
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad(h, x, y) { var g = h & 3; return (g < 2 ? x : -x) + ((g & 1) ? -y : y); }
  function shum(x, y) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    var u = fade(x), v = fade(y);
    var A = P[X] + Y, B = P[X + 1] + Y;
    return lerp(lerp(grad(P[A], x, y), grad(P[B], x - 1, y), u), lerp(grad(P[A + 1], x, y - 1), grad(P[B + 1], x - 1, y - 1), u), v);
  }
  function hsl(h, s, l, a) { return "hsla(" + h + "," + s + "%," + l + "%," + a + ")"; }

  /* Спрайт = малко платно с радиален градиент; рисува се с drawImage — евтино. */
  function sprayt(razmer, spirki) {
    var c = document.createElement("canvas"); c.width = c.height = razmer;
    var g = c.getContext("2d"), r = razmer / 2;
    var gr = g.createRadialGradient(r, r, 0, r, r, r);
    for (var i = 0; i < spirki.length; i++) gr.addColorStop(spirki[i][0], spirki[i][1]);
    g.fillStyle = gr; g.fillRect(0, 0, razmer, razmer);
    return c;
  }
  for (var v = -1; v <= 1; v++) {
    var h = TON + v * 8;
    spraytove.push({
      yadro: sprayt(32, [[0, hsl(h, 100, 92, 1)], [0.2, hsl(h, 100, 70, 0.85)], [0.5, hsl(h, 100, 55, 0.2)], [1, hsl(h, 100, 50, 0)]]),
      oreol: sprayt(64, [[0, hsl(h, 100, 62, 0.5)], [0.3, hsl(h, 100, 55, 0.16)], [1, hsl(h, 100, 50, 0)]])
    });
  }

  function nova() {
    var r = Math.random(), plast = r < 0.45 ? 0 : r < 0.8 ? 1 : 2;
    return {
      x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, plast: plast,
      seed: Math.random() * 100, faza: Math.random() * 6.283, temp: 0.9 + Math.random() * 1.6,
      v: Math.floor(Math.random() * 3), razmer: 0.7 + Math.random() * 0.5
    };
  }

  function preorazmeri() {
    W = window.innerWidth; H = window.innerHeight;
    platno.width = Math.round(W * DPR); platno.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    while (prah.length < BROY) prah.push(nova());
    for (var i = 0; i < prah.length; i++) { if (prah[i].x > W || prah[i].y > H) { prah[i].x = Math.random() * W; prah[i].y = Math.random() * H; } }
  }

  var t = 0;
  function stapka(s) {
    for (var i = 0; i < prah.length; i++) {
      var f = prah[i];
      var dalb = 0.5 + f.plast * 0.35;
      var a = shum(f.x * 0.0025 + f.seed, f.y * 0.0025 - t * 0.1 + f.seed * 0.3) * 3.5 + f.seed;
      var ax = Math.cos(a) * 14, ay = Math.sin(a) * 14 - 5;   /* леко нагоре, като прах в топъл въздух */
      var gas = Math.exp(-1.1 * s);
      f.vx = (f.vx + ax * s) * gas; f.vy = (f.vy + ay * s) * gas;
      f.x += f.vx * s * dalb; f.y += f.vy * s * dalb;
      var m = 40;
      if (f.x < -m) f.x += W + 2 * m; else if (f.x > W + m) f.x -= W + 2 * m;
      if (f.y < -m) f.y += H + 2 * m; else if (f.y > H + m) f.y -= H + 2 * m;
    }
  }

  var YADRO = [6, 12, 20], OREOL = [32, 68, 160], OREOL_A = [0.3, 0.42, 0.55];
  function risuvay() {
    ctx.clearRect(0, 0, W, H);
    for (var L = 0; L < 3; L++) {
      for (var i = 0; i < prah.length; i++) {
        var f = prah[i]; if (f.plast !== L) continue;
        var w = 0.5 + 0.5 * Math.sin(t * f.temp + f.faza);
        var bavno = 0.65 + 0.35 * shum(f.seed * 3, t * 0.3);
        var yarko = (0.08 + 0.92 * Math.pow(w, 4) * bavno) * 0.5;   /* кратък проблясък, после гасне */
        var sp = spraytove[f.v], ys = YADRO[L] * f.razmer, os = OREOL[L] * f.razmer;
        ctx.globalAlpha = Math.min(1, yarko * OREOL_A[L]);
        ctx.drawImage(sp.oreol, f.x - os / 2, f.y - os / 2, os, os);
        ctx.globalAlpha = Math.min(1, yarko);
        ctx.drawImage(sp.yadro, f.x - ys / 2, f.y - ys / 2, ys, ys);
      }
    }
    ctx.globalAlpha = 1;
  }

  var posleden = 0, natrupano = 0;
  function kadar(sega) {
    var dt = Math.min(0.05, (sega - posleden) / 1000 || 0.016); posleden = sega;
    natrupano += dt;
    if (!document.hidden && natrupano >= STAPKA) {
      t += natrupano; stapka(natrupano); risuvay(); natrupano = 0;
    }
    requestAnimationFrame(kadar);
  }

  function start() {
    preorazmeri();
    window.addEventListener("resize", preorazmeri);
    risuvay();
    platno.classList.add("is-on");
    if (!kalmo) requestAnimationFrame(kadar);
  }
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
})();
