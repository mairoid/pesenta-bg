/* Админ панел — само за собственика
   ---------------------------------------------------------------------
   Страницата се сервира ОТ WORKER-А, не от сайта. Причината: repo-то на
   pesenta.bg е публично, тоест всеки файл в него се чете от всеки. Оттук
   няма какво да се види, докато не се докаже кой чука.

   Самият HTML не е тайна и не съдържа данни — те идват след това, срещу
   токен. Затова страницата може спокойно да се сервира без проверка:
   празна е.

   Едно голямо парче HTML, без външни заявки: нито шрифт, нито библиотека.
   Панел, който не се отваря, когато мрежата куца, не върши работа. */
export const ADMIN_HTML = `<!DOCTYPE html>
<html lang="bg">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Песента · админ</title>
<style>
  :root{
    --fon:#0B0A1A; --karta:#12101F; --kutia:#1A1730; --linia:#2A2640;
    --tekst:#F4F2FF; --telo:#D9D5EE; --tih:#A9A4C9; --naitih:#6F6A8E;
    --ciklamen:#D2577F; --kehlibar:#FFA14D; --zeleno:#5CC98E; --cherveno:#E5776B;
    --sys:"Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--fon);color:var(--telo);font-family:var(--sys);
    font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
  .obvivka{max-width:1080px;margin:0 auto;padding:0 20px 80px}

  header{padding:28px 0 20px;border-bottom:3px solid var(--ciklamen);margin-bottom:28px;
    display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
  h1{margin:0;font-size:24px;font-weight:700;color:var(--tekst);letter-spacing:.01em}
  h1 span{color:var(--ciklamen)}
  .podred{margin:2px 0 0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--naitih)}
  .desno{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--tih)}

  button{font:inherit;cursor:pointer;border:none;border-radius:8px;padding:9px 16px;
    background:var(--kutia);color:var(--telo);transition:filter .15s}
  button:hover{filter:brightness(1.25)}
  button.glaven{background:var(--ciklamen);color:#16091C;font-weight:600}
  button.tih{background:none;color:var(--naitih);padding:6px 10px;font-size:13px}
  button:disabled{opacity:.5;cursor:default}

  input,textarea{font:inherit;width:100%;background:rgba(255,255,255,.05);color:var(--tekst);
    border:1px solid var(--linia);border-radius:8px;padding:11px 13px}
  input:focus,textarea:focus{outline:none;border-color:var(--kehlibar)}

  /* ---------- вход ---------- */
  #vhod{max-width:380px;margin:14vh auto 0;text-align:center}
  #vhod h2{font-size:20px;color:var(--tekst);margin:0 0 6px}
  #vhod p{color:var(--tih);font-size:14px;margin:0 0 22px}
  #vhod input{text-align:center;letter-spacing:.08em;margin-bottom:12px}
  #vhod .gr{color:var(--cherveno);font-size:14px;min-height:20px;margin-top:10px}

  /* ---------- плочки ---------- */
  .plochki{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:26px}
  .plochka{background:var(--karta);border-radius:10px;padding:16px 18px}
  .plochka b{display:block;font-size:26px;font-weight:700;color:var(--tekst);line-height:1.1}
  .plochka span{font-size:12px;color:var(--tih);letter-spacing:.04em}

  /* ---------- внимание ---------- */
  #vnimanie{margin-bottom:26px}
  #vnimanie h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--kehlibar);margin:0 0 10px}
  .red-vn{background:var(--karta);border-left:3px solid var(--kehlibar);border-radius:0 8px 8px 0;
    padding:11px 16px;margin-bottom:7px;font-size:14px;display:flex;gap:10px;align-items:baseline}
  .red-vn.lut{border-left-color:var(--cherveno)}
  .red-vn code{color:var(--tekst);font-family:ui-monospace,Consolas,monospace;font-size:13px}

  /* ---------- поръчки ---------- */
  h2.razdel{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--naitih);
    margin:0 0 12px;display:flex;justify-content:space-between;align-items:center}
  .poruchka{background:var(--karta);border-radius:12px;padding:18px 20px;margin-bottom:12px}
  .glava{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:baseline}
  .nomer{font-family:ui-monospace,Consolas,monospace;font-size:15px;color:var(--tekst);font-weight:600}
  .kogа{font-size:13px;color:var(--naitih)}
  .suma{font-size:17px;font-weight:700;color:var(--tekst);white-space:nowrap}
  .klient{margin:8px 0 0;font-size:14px;color:var(--telo)}
  .klient a{color:var(--tih)}
  .znaci{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 0}
  .znak{font-size:12px;padding:3px 10px;border-radius:999px;background:var(--kutia);color:var(--tih)}
  .znak.ok{color:var(--zeleno)}
  .znak.chaka{color:var(--kehlibar)}
  .znak.lош{color:var(--cherveno)}
  .razkaz{margin:14px 0 0;background:var(--kutia);border-radius:8px;padding:14px 16px;
    font-size:14px;line-height:1.65;white-space:pre-wrap}
  .razkaz .meta{font-size:12px;color:var(--naitih);margin-bottom:8px;white-space:normal}
  .bez-razkaz{margin:14px 0 0;border-left:3px solid var(--cherveno);padding:8px 14px;
    font-size:14px;color:var(--cherveno)}
  .deistvia{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;align-items:center}
  .beleshka-red{margin-top:10px;display:none;gap:8px}
  .beleshka-red.vidima{display:flex}
  .zapisana{margin:10px 0 0;font-size:13px;color:var(--tih);font-style:italic}

  .odit{background:var(--karta);border-radius:12px;padding:18px 20px;margin-bottom:26px}
  .odit .razdel{margin-bottom:6px;color:var(--kehlibar)}
  .odit-vaved{margin:0 0 14px;font-size:13.5px;color:var(--tih)}
  .odit-red{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .odit-red select{width:auto;min-width:150px;padding:9px 12px}
  .odit-sast{font-size:13.5px;color:var(--tih)}
  .odit-sast.losho{color:var(--cherveno)}
  .odit-sast.dobre{color:var(--zeleno)}
  #tovari{text-align:center;padding:60px 0;color:var(--naitih)}
  .skrit{display:none}
</style>
</head>
<body>

<div id="vhod">
  <h2>Песента · админ</h2>
  <p>Панелът иска токена за одиторския файл.</p>
  <input id="token" type="password" placeholder="AUDIT_TOKEN" autocomplete="off">
  <button class="glaven" style="width:100%" onclick="vlez()">Влез</button>
  <div class="gr" id="vhod-gr"></div>
</div>

<div class="obvivka skrit" id="panel">
  <header>
    <div>
      <h1>PESENTA<span>.</span>BG</h1>
      <p class="podred">Админ панел</p>
    </div>
    <div class="desno">
      <span id="obnoveno"></span>
      <button onclick="zaredi()">Обнови</button>
      <button class="tih" onclick="izlez()">Изход</button>
    </div>
  </header>

  <div id="tovari">Зареждане…</div>
  <div id="sadarzhanie" class="skrit">
    <div class="plochki" id="plochki"></div>
    <div id="vnimanie"></div>
    <div class="odit">
      <h2 class="razdel"><span>Одиторски файл за НАП</span></h2>
      <p class="odit-vaved">Приложение №38, месечно. Срокът е до 15-о число на следващия месец.</p>
      <div class="odit-red">
        <select id="odit-mesec"></select>
        <button class="glaven" onclick="tegliOdit()">Изтегли XML</button>
        <span class="odit-sast" id="odit-sast"></span>
      </div>
    </div>

    <h2 class="razdel"><span>Поръчки</span><span id="broi"></span></h2>
    <div id="spisak"></div>
  </div>
</div>

<script>
var T = "";
try { T = localStorage.getItem("pesenta_admin") || ""; } catch (e) {}
var DANNI = null;

function e(t){ return String(t === null || t === undefined ? "" : t)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function api(pat, opts){
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers || {}, { "X-Admin-Token": T });
  return fetch(pat, opts).then(function(r){
    if (r.status === 403) { var x = new Error("403"); x.forbidden = true; throw x; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  });
}

function vlez(){
  var v = document.getElementById("token").value.trim();
  if (!v) return;
  T = v;
  document.getElementById("vhod-gr").textContent = "Проверявам…";
  api("/admin/data").then(function(d){
    try { localStorage.setItem("pesenta_admin", T); } catch (x) {}
    pokazhi(d);
  }).catch(function(err){
    document.getElementById("vhod-gr").textContent =
      err.forbidden ? "Грешен токен." : "Няма връзка. Опитай пак.";
  });
}

function izlez(){
  try { localStorage.removeItem("pesenta_admin"); } catch (e) {}
  location.reload();
}

function zaredi(){
  document.getElementById("tovari").classList.remove("skrit");
  document.getElementById("sadarzhanie").classList.add("skrit");
  api("/admin/data").then(pokazhi).catch(function(err){
    document.getElementById("tovari").textContent =
      err.forbidden ? "Токенът вече не е валиден." : "Грешка при зареждане.";
  });
}

function pokazhi(d){
  DANNI = d;
  document.getElementById("vhod").classList.add("skrit");
  document.getElementById("panel").classList.remove("skrit");
  document.getElementById("tovari").classList.add("skrit");
  document.getElementById("sadarzhanie").classList.remove("skrit");
  document.getElementById("obnoveno").textContent =
    "към " + new Date(d.generated).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
  napalniMeseci(d);
  risuvaiPlochki(d);
  risuvaiVnimanie(d);
  risuvaiSpisak(d);
}

function evro(c){ return ((c || 0) / 100).toFixed(2) + " €"; }

function risuvaiPlochki(d){
  var s = d.sales || [];
  var mesec = new Date().toISOString().slice(0, 7);
  var tozi = s.filter(function(x){ return String(x.doc_date || "").slice(0, 7) === mesec; });
  var prihod = tozi.reduce(function(a, x){ return a + (x.total_eur_c || 0); }, 0);
  var chakat = s.filter(function(x){ return !x.delivered_at; }).length;
  var pl = [
    [s.length, "поръчки общо"],
    [tozi.length, "този месец"],
    [evro(prihod), "приход този месец"],
    [chakat, "чакат доставка"]
  ];
  document.getElementById("plochki").innerHTML = pl.map(function(p){
    return '<div class="plochka"><b>' + e(p[0]) + '</b><span>' + e(p[1]) + '</span></div>';
  }).join("");
}

function risuvaiVnimanie(d){
  var s = d.sales || [], r = [];
  s.forEach(function(x){
    if (!x.brief) r.push([true, x.order_no, "няма разказ — песента не може да се напише"]);
    if (!x.email_sent_at) r.push([true, x.order_no, "бележката НЕ е изпратена" + (x.email_error ? " (" + x.email_error + ")" : "")]);
    if (x.currency_warning) r.push([true, x.order_no, "плащане в чужда валута — одиторският файл е грешен"]);
    if (x.brief && !x.delivered_at) r.push([false, x.order_no, "чака доставка"]);
  });
  var el = document.getElementById("vnimanie");
  if (!r.length) { el.innerHTML = ""; return; }
  el.innerHTML = "<h2>Изисква внимание</h2>" + r.map(function(x){
    return '<div class="red-vn' + (x[0] ? " lut" : "") + '"><code>' + e(x[1]) + "</code><span>" + e(x[2]) + "</span></div>";
  }).join("");
}

function risuvaiSpisak(d){
  var s = d.sales || [];
  document.getElementById("broi").textContent = s.length + " бр.";
  document.getElementById("spisak").innerHTML = s.map(function(x){
    var b = x.brief;
    var znaci =
      '<span class="znak ok">платена</span>' +
      (b ? '<span class="znak ok">разказ</span>' : '<span class="znak lош">без разказ</span>') +
      (x.email_sent_at ? '<span class="znak ok">бележка</span>' : '<span class="znak lош">без бележка</span>') +
      (x.delivered_at ? '<span class="znak ok">доставена</span>' : '<span class="znak chaka">чака доставка</span>') +
      (x.currency_warning ? '<span class="znak lош">валута: ' + e(String(x.currency).toUpperCase()) + "</span>" : "");

    var razkaz = b
      ? '<div class="razkaz"><div class="meta">' +
          [b.povod && "Повод: " + b.povod, b.stilove && "Стилове: " + b.stilove, b.ezik && "Език: " + b.ezik]
            .filter(Boolean).map(e).join(" · ") +
        "</div>" + e(b.razkaz || "—") + "</div>"
      : '<div class="bez-razkaz">Разказът не е стигнал до нас. Клиентът е платил — пиши му да го разкаже.</div>';

    return '<div class="poruchka">' +
      '<div class="glava"><div>' +
        '<div class="nomer">' + e(x.order_no) + "</div>" +
        '<div class="kogа">' + e(x.doc_date) + " " + e(String(x.doc_time || "").slice(0, 5)) +
        " · документ " + e(String(x.doc_n).padStart(10, "0")) + "</div>" +
      '</div><div class="suma">' + evro(x.total_eur_c) + "</div></div>" +
      '<p class="klient"><strong>' + e(x.customer_name || "—") + "</strong> · " +
        '<a href="mailto:' + e(x.customer_email) + '">' + e(x.customer_email || "—") + "</a></p>" +
      '<div class="znaci">' + znaci + "</div>" +
      razkaz +
      (x.note ? '<p class="zapisana">' + e(x.note) + "</p>" : "") +
      '<div class="deistvia">' +
        '<button onclick="otmetni(\\'' + e(x.order_no) + "', " + (x.delivered_at ? "false" : "true") + ')">' +
          (x.delivered_at ? "Върни в „чака“" : "Отбележи като доставена") + "</button>" +
        '<button class="tih" onclick="pokazhiBeleshka(\\'' + e(x.order_no) + '\\')">Бележка</button>' +
      "</div>" +
      '<div class="beleshka-red" id="bel-' + e(x.order_no) + '">' +
        '<input id="belvh-' + e(x.order_no) + '" value="' + e(x.note || "") + '" placeholder="кратка бележка за тази поръчка">' +
        '<button class="glaven" onclick="zapishiBeleshka(\\'' + e(x.order_no) + '\\')">Запиши</button>' +
      "</div>" +
    "</div>";
  }).join("");
}

/* Месеците идват от самите продажби, не от календара: месец без продажби няма
   как да даде валиден файл по схемата на НАП и не се подава. */
function napalniMeseci(d){
  var el = document.getElementById("odit-mesec");
  if (!el) return;
  var m = {};
  (d.sales || []).forEach(function (x) { m[String(x.doc_date).slice(0, 7)] = 1; });
  var spis = Object.keys(m).sort().reverse();
  el.innerHTML = spis.map(function (x) {
    return '<option value="' + x + '">' + x + "</option>";
  }).join("") || '<option value="">няма продажби</option>';
}

function tegliOdit(){
  var mes = document.getElementById("odit-mesec").value;
  var sast = document.getElementById("odit-sast");
  if (!mes) { sast.textContent = "няма месец за подаване"; return; }
  sast.className = "odit-sast"; sast.textContent = "Изтегляне…";
  /* Токенът в заглавка, не в адреса — иначе влиза в историята на браузъра. */
  fetch("/audit/" + mes, { headers: { "X-Admin-Token": T } })
    .then(function (r) {
      if (r.status === 403) throw new Error("забранено");
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.blob();
    })
    .then(function (b) {
      /* Ако месецът няма продажби, worker-ът връща JSON вместо XML. */
      if (b.type.indexOf("json") > -1) {
        sast.textContent = "за този месец не се подава нищо";
        return;
      }
      var u = URL.createObjectURL(b);
      var a = document.createElement("a");
      a.href = u; a.download = "audit_pesenta_" + mes + ".xml";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
      sast.className = "odit-sast dobre";
      sast.textContent = "изтеглен (" + Math.round(b.size / 1024) + " KB)";
    })
    .catch(function (e) {
      sast.className = "odit-sast losho";
      sast.textContent = e.message === "забранено" ? "токенът не е валиден" : "грешка при изтегляне";
    });
}

function pokazhiBeleshka(no){
  document.getElementById("bel-" + no).classList.toggle("vidima");
}

function prati(telo){
  return api("/admin/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(telo)
  }).then(zaredi);
}

function otmetni(no, kak){ prati({ order_no: no, delivered: kak }); }

function zapishiBeleshka(no){
  prati({ order_no: no, note: document.getElementById("belvh-" + no).value });
}

/* Ако токенът е запомнен, влизаме направо. */
if (T) {
  api("/admin/data").then(pokazhi).catch(function(){
    document.getElementById("vhod").classList.remove("skrit");
  });
} else {
  document.getElementById("vhod").classList.remove("skrit");
}
</script>
</body>
</html>`;
