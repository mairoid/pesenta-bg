/* Изчистване на MP3 от следите на Suno + подмяна на вградения текст.
   Размерът на етикета се ЗАПАЗВА чрез нулево запълване, иначе се мести
   началото на аудиото и Xing заглавката сочи в празното. */
var fs = require("fs"), kr = require("node:crypto");
var SP = "C:/Users/bauph/AppData/Local/Temp/claude/D--My-Documents-2026-Cyber-Hora-THIRD-BRAIN/45999605-2ab3-441d-a52f-ae2947501298/scratchpad/";
var IZH = "D:/My Documents 2026/Cyber Hora/pesenta.bg/assets/audio/";

var PESNI = {
  "babo-asi": {
    zaglavie: "Бабо Аси",
    strofi: [
      { k: "tiho", r: ["Мамо…", "Петдесет и четири свещи.", "И нито една от тях не е лека."] },
      { k: "", r: ["Ти ме отгледа с голи ръце.", "И не усетих, че нещо липсва.", "Носеше всичко,", "а на мен оставяше само хубавото.", "Домът ти и до днес мирише на връщане —", "на храна, на смях, на приказки."] },
      { k: "predpripev", r: ["А сега те гледам с него", "и разбирам всичко наведнъж."] },
      { k: "pripev", r: ["Бабо Аси!", "Две думи — и лицето му грейва.", "Бабо Аси!", "Очите му светват отдалеч.", "Всичко, което си раздала,", "се връща в тези две думи."] },
      { k: "", r: ["Тича бос в градината ти,", "бере ягодки с двете си ръчички.", "При теб и при дядо Румен", "никой не му се кара.", "Не знае през какво си минала.", "Знае само, че при теб е хубаво."] },
      { k: "most", r: ["Помня деня, в който ти казахме,", "че ще ставаш баба.", "Ти не каза нищо.", "Очите ти казаха всичко.", "Тогава не знаехме", "каква баба ще бъдеш.", "Сега знаем."] },
      { k: "pripev", r: ["Бабо Аси!", "Две думи — и лицето му грейва.", "Бабо Аси!", "Очите му светват отдалеч.", "Всичко, което си раздала,", "се връща в тези две думи.", "Честит рожден ден, мамо —", "от Моника и от Александър."] },
      { k: "tiho", r: ["Силна като скала.", "И най-мекото място на света."] }
    ]
  },
  "cyal-edin-svyat": {
    zaglavie: "Цял един свят",
    strofi: [
      { k: "tiho", r: ["Мамо, днес имаш задача.", "Само една.", "Днес ние черпим, ти си гост."] },
      { k: "", r: ["Ти си от жените, които не се предават.", "Тиха си, но те чуват.", "Не си вдигала глас,", "а всички знаят коя си.", "Минала си през неща,", "за които не си казала на никого."] },
      { k: "predpripev", r: ["Днес обаче не броим какво е било.", "Днес броим свещи."] },
      { k: "pripev", r: ["Ти си цял един свят, мамо!", "Не една жена — а цял един свят.", "Днес не готвиш, днес не подреждаш.", "Днес светът е само твой!"] },
      { k: "", r: ["За всяка безсънна нощ.", "За всяка сготвена гозба.", "За всяка прегръдка на прага.", "За всяко „ще се справим“.", "За всяко „хапни още малко“.", "За това, че никога не се отказа."] },
      { k: "most", r: ["Александър тича из къщата.", "Дядо Румен налива.", "Аз те гледам от другия край на масата", "и разбирам за какво е било всичко."] },
      { k: "pripev", r: ["Ти си цял един свят, мамо!", "Не една жена — а цял един свят.", "Днес не готвиш, днес не подреждаш.", "Днес светът е само твой!", "Честит рожден ден —", "от Моника, от Александър и от всички!"] },
      { k: "tiho", r: ["И утре пак ще готвиш.", "Но днес — не."] }
    ]
  }
};

Object.keys(PESNI).forEach(function (slug) {
  var p = PESNI[slug];
  var b = fs.readFileSync(SP + slug + ".mp3");
  var rz = ((b[6] & 127) << 21) | ((b[7] & 127) << 14) | ((b[8] & 127) << 7) | (b[9] & 127);
  var a = 10 + rz;
  var predi = kr.createHash("sha256").update(b.slice(a)).digest("hex");
  var chist = p.strofi.map(function (s) { return s.r.join("\n"); }).join("\n\n");

  var q = 10, kadri = [], pazi = 0;
  while (q + 10 <= a && pazi++ < 100) {
    var id = b.slice(q, q + 4).toString("latin1");
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    var sz = ((b[q + 4] & 127) << 21) | ((b[q + 5] & 127) << 14) | ((b[q + 6] & 127) << 7) | (b[q + 7] & 127);
    if (sz < 0 || q + 10 + sz > a) break;
    kadri.push({ id: id, flags: b.slice(q + 8, q + 10), body: b.slice(q + 10, q + 10 + sz) });
    q += 10 + sz;
  }

  /* TXXX и COMM са потребителски полета — всичко в тях е на генератора. */
  var nov = [], mahnati = [];
  kadri.forEach(function (k) {
    if (k.id === "WOAS" || k.id === "GEOB" || k.id === "TXXX" || k.id === "COMM") {
      mahnati.push(k.id); return;
    }
    if (k.id === "TIT2") k = { id: "TIT2", flags: k.flags, body: Buffer.concat([Buffer.from([3]), Buffer.from(p.zaglavie, "utf8")]) };
    if (k.id === "TPE1") k = { id: "TPE1", flags: k.flags, body: Buffer.concat([Buffer.from([3]), Buffer.from("Песента", "utf8")]) };
    if (k.id === "USLT") k = { id: "USLT", flags: k.flags, body: Buffer.concat([
      Buffer.from([3]), Buffer.from("bul", "latin1"), Buffer.from([0]), Buffer.from(chist, "utf8")]) };
    nov.push(k);
  });

  var telo = Buffer.concat(nov.map(function (k) {
    var s = k.body.length;
    return Buffer.concat([Buffer.from(k.id, "latin1"),
      Buffer.from([(s >> 21) & 127, (s >> 14) & 127, (s >> 7) & 127, s & 127]), k.flags, k.body]);
  }));
  if (telo.length > rz) { console.log("  " + slug + ": НЕ СТИГА мястото"); return; }

  var izh = IZH + slug + ".mp3";
  fs.writeFileSync(izh, Buffer.concat([b.slice(0, 10), telo, Buffer.alloc(rz - telo.length), b.slice(a)]));

  var f = fs.readFileSync(izh);
  var sled = kr.createHash("sha256").update(f.slice(a)).digest("hex");
  var sledi = ["latin1", "utf8", "utf16le"].filter(function (e) {
    return f.toString(e).toLowerCase().indexOf("suno") > -1;
  });
  console.log("  == " + slug + " ==");
  console.log("    махнати: " + mahnati.join(", "));
  console.log("    останали: " + nov.map(function (k) { return k.id; }).join(", "));
  console.log("    аудио: " + (predi === sled ? "побайтово същото" : "РАЗЛИЧНО"));
  console.log("    следи от suno: " + (sledi.length ? "ИМА в " + sledi.join(", ") : "няма"));
  console.log("    текст: " + chist.length + " знака, " + p.strofi.length + " строфи");
  console.log("    файл: " + (f.length / 1048576).toFixed(2) + " MB");
  console.log("");
});
