/* Проверка на двете страници. Коментарите се махат ПРЕДИ търсенето —
   в тях нарочно стоят забранените образци и биха дали лъжлив сигнал. */
var fs = require("fs"), kr = require("node:crypto"), path = require("path");
var R = "D:/My Documents 2026/Cyber Hora/pesenta.bg/";
var gr = 0;
function lo(u) { gr++; console.log("    ✗ " + u); }

["babo-asi", "cyal-edin-svyat"].forEach(function (slug) {
  console.log("  == " + slug + " ==");
  var f = R + "pesni/" + slug + ".html";
  var syr = fs.readFileSync(f, "utf8");
  var h = syr.replace(/<!--[\s\S]*?-->/g, "");

  /* 1. всеки ?v= сочи вярно съдържание */
  var vidyani = 0;
  h.replace(/(?:src|href|content)="(?:https:\/\/pesenta\.bg\/|\.\.\/)([^"?]+)\?v=([0-9a-f]{8})"/g,
    function (_, rel, v) {
      vidyani++;
      var p = R + rel;
      if (!fs.existsSync(p)) return lo("липсва файл: " + rel);
      var d = kr.createHash("sha256").update(fs.readFileSync(p)).digest("hex").slice(0, 8);
      if (d !== v) lo("версия не съвпада: " + rel + " пише " + v + ", истината е " + d);
      return _;
    });
  console.log("    адреси с версия: " + vidyani);

  /* 2. адреси БЕЗ версия — кешът ще ги задържи */
  h.replace(/(?:src|href)="(\.\.\/assets\/[^"]+)"/g, function (_, u) {
    if (u.indexOf("?v=") < 0) lo("без версия: " + u);
    return _;
  });

  /* 3. следи от генератора в тялото */
  var telo = h.slice(h.indexOf("<body"));
  [[/\[(Verse|Chorus|Bridge|Intro|Outro|Stop|Instrumental)[^\]]*\]/i, "производствен маркер"],
   [/([аеиоуъюя])\1/i, "удвоена гласна"],
   [/suno/i, "суно"]].forEach(function (p) {
    var m = telo.match(p[0]);
    if (m) lo(p[1] + ": „" + m[0] + "“");
  });

  /* 4. частност */
  if (!/noindex, nofollow/.test(h)) lo("липсва noindex");
  var sm = fs.readFileSync(R + "sitemap.xml", "utf8");
  if (sm.indexOf(slug) > -1) lo("стои в sitemap.xml");

  /* 5. никой да не сочи насам */
  var sochat = [];
  (function obhod(d) {
    fs.readdirSync(d).forEach(function (n) {
      if (n === ".git" || n === "node_modules" || n === "marketing") return;
      var p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) return obhod(p);
      if (!/\.(html|js|xml|json)$/.test(n)) return;
      if (path.resolve(p) === path.resolve(f)) return;
      if (fs.readFileSync(p, "utf8").indexOf(slug + ".html") > -1) sochat.push(n);
    });
  })(R);
  if (sochat.length) lo("сочат насам: " + sochat.join(", "));

  /* 6. текстът на страницата = вграденият в MP3-то */
  var stranica = (telo.match(/<div class="podarak-tekst">[\s\S]*?\n  <\/div>/) || [""])[0]
    .replace(/<[^>]+>/g, "\n").split("\n").map(function (x) { return x.trim(); })
    .filter(Boolean).join("\n");
  var b = fs.readFileSync(R + "assets/audio/" + slug + ".mp3");
  var a = 10 + (((b[6] & 127) << 21) | ((b[7] & 127) << 14) | ((b[8] & 127) << 7) | (b[9] & 127));
  var q = 10, vgraden = null;
  while (q + 10 <= a) {
    var id = b.slice(q, q + 4).toString("latin1");
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    var sz = ((b[q + 4] & 127) << 21) | ((b[q + 5] & 127) << 14) | ((b[q + 6] & 127) << 7) | (b[q + 7] & 127);
    if (id === "USLT") vgraden = b.slice(q + 15, q + 10 + sz).toString("utf8");
    q += 10 + sz;
  }
  var edno = function (s) { return s.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); };
  console.log("    текст: страница " + stranica.length + " зн., MP3 " +
    (vgraden || "").length + " зн. — " +
    (edno(stranica) === edno(vgraden || "") ? "съвпадат" : "РАЗЛИЧНИ"));
  if (edno(stranica) !== edno(vgraden || "")) lo("текстът на страницата и в MP3-то се различават");
  console.log("");
});
console.log(gr ? "  " + gr + " ГРЕШКИ" : "  чисто");
