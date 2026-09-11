/* „Кой има имен ден днес“ — по механизма на rojdendni.js (11.09.2026).
 *
 * Блокът #imen-dnes стои с hidden и се показва САМО ако данните дойдат и
 * има какво да се каже за днес. При мрежова грешка или счупен JSON остава
 * скрит — страницата и без него е пълна, защото календарът по месеци е
 * статичен HTML. Никога празна рамка.
 *
 * „Днес“ е днес В БЪЛГАРИЯ (Europe/Sofia), не при посетителя.
 * Подвижните празници се смятат от православния Великден (Юлиански Меус,
 * +13 дни за Григорианската дата, вярно за 1900–2099): Тодоровден −43,
 * Лазаровден −8, Цветница −7, Спасовден +39. Гергьовден е 6 май, освен ако
 * 6 май падне до Великден включително — тогава е в понеделника след него.
 */
(function () {
  "use strict";

  var SRC = "assets/data/imenni-dni.json";
  var MESECI = ["януари", "февруари", "март", "април", "май", "юни",
                "юли", "август", "септември", "октомври", "ноември", "декември"];

  var box = document.getElementById("imen-dnes");
  if (!box) return;

  function sofiaDnes() {
    try {
      var s = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit"
      }).format(new Date());
      var ch = s.split("-");
      return { g: Number(ch[0]), m: Number(ch[1]), d: Number(ch[2]) };
    } catch (e) {
      var dt = new Date();
      return { g: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
    }
  }
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* Православен Великден за година g → { m, d } по Григорианския календар. */
  function velikden(g) {
    var a = g % 4, b = g % 7, c = g % 19;
    var d = (19 * c + 15) % 30;
    var e = (2 * a + 4 * b - d + 34) % 7;
    var mes = Math.floor((d + e + 114) / 31), den = ((d + e + 114) % 31) + 1;
    var t = Date.UTC(g, mes - 1, den + 13);
    var u = new Date(t);
    return { m: u.getUTCMonth() + 1, d: u.getUTCDate(), t: t };
  }
  function plus(t, dni) { var u = new Date(t + dni * 86400000); return { m: u.getUTCMonth() + 1, d: u.getUTCDate() }; }

  /* Всички именни дни за дата (g, m, d): фиксирани + подвижни. */
  function imenaZa(data, g, m, d) {
    var rez = [], klyuch = pad(m) + "-" + pad(d), V = velikden(g);
    var gergMoved = Date.UTC(g, 4, 6) <= V.t;             /* 6 май до Великден вкл. → понеделник след него */
    Object.keys(data.fiksirani).forEach(function (k) {
      if (k === "05-06" && gergMoved) return;
      if (k === klyuch) rez.push(data.fiksirani[k]);
    });
    if (gergMoved) { var gm = plus(V.t, 1); if (gm.m === m && gm.d === d) rez.push(data.fiksirani["05-06"]); }
    Object.keys(data.podvizhni).forEach(function (k) {
      var p = data.podvizhni[k], dt = plus(V.t, p.otmestvane);
      if (dt.m === m && dt.d === d) rez.push(p);
    });
    return rez;
  }

  function red(m, d) { return d + " " + MESECI[m - 1]; }

  function pokaji(data) {
    var dnes = sofiaDnes();
    var h1 = document.getElementById("imen-h1");
    var dataEl = document.getElementById("imen-data");
    var imenaEl = document.getElementById("imen-imena");
    var podarakEl = document.getElementById("imen-podarak");
    var utreEl = document.getElementById("imen-utre");

    var dneshni = imenaZa(data, dnes.g, dnes.m, dnes.d);
    if (h1) h1.insertAdjacentHTML("beforeend", '<span class="imen-h1-data">: ' + esc(red(dnes.m, dnes.d)) + "</span>");

    if (dneshni.length) {
      dataEl.textContent = red(dnes.m, dnes.d) + " — " + dneshni.map(function (p) { return p.praznik; }).join(", ");
      var imena = [];
      dneshni.forEach(function (p) { p.imena.forEach(function (i) { if (imena.indexOf(i) < 0) imena.push(i); }); });
      imenaEl.innerHTML = imena.map(function (i) { return '<span class="chip">' + esc(i) + "</span>"; }).join("");
      var str = dneshni.filter(function (p) { return p.stranica; })[0];
      podarakEl.innerHTML = esc(data.podarak) + (str ? ' За този ден има отделна страница: <a href="' + esc(str.stranica) + '">' + esc(str.praznik) + "</a>." : "");
    } else {
      /* Днес няма — казваме кой е следващият, до 60 дни напред. */
      var t = Date.UTC(dnes.g, dnes.m - 1, dnes.d), sledvasht = null;
      for (var i = 1; i <= 60 && !sledvasht; i++) {
        var u = new Date(t + i * 86400000), g2 = u.getUTCFullYear(), m2 = u.getUTCMonth() + 1, d2 = u.getUTCDate();
        var s = imenaZa(data, g2, m2, d2);
        if (s.length) sledvasht = { m: m2, d: d2, dni: i, p: s };
      }
      if (!sledvasht) return false;
      dataEl.textContent = red(dnes.m, dnes.d) + " — днес няма голям имен ден.";
      imenaEl.innerHTML = "";
      podarakEl.innerHTML = "Следващият е " + (sledvasht.dni === 1 ? "утре" : "след " + sledvasht.dni + " дни") + ", на " + esc(red(sledvasht.m, sledvasht.d)) + " — " +
        sledvasht.p.map(function (p) { return esc(p.praznik) + ": " + p.imena.slice(0, 6).map(esc).join(", ") + (p.imena.length > 6 ? "…" : ""); }).join("; ") + ".";
    }

    /* Утре — един ред, само ако има. */
    var tu = new Date(Date.UTC(dnes.g, dnes.m - 1, dnes.d) + 86400000);
    var utre = imenaZa(data, tu.getUTCFullYear(), tu.getUTCMonth() + 1, tu.getUTCDate());
    if (utreEl && utre.length && dneshni.length) {
      utreEl.textContent = "Утре, " + red(tu.getUTCMonth() + 1, tu.getUTCDate()) + ": " + utre.map(function (p) { return p.praznik + " — " + p.imena.slice(0, 5).join(", ") + (p.imena.length > 5 ? "…" : ""); }).join("; ");
      utreEl.hidden = false;
    }
    box.hidden = false;
    return true;
  }

  fetch(SRC, { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) { if (!data || !data.fiksirani || !data.podvizhni) throw new Error("данни"); pokaji(data); })
    .catch(function () { /* секцията остава скрита; календарът долу е статичен */ });
})();
