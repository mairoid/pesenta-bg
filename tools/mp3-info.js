/* Времетраене на MP3, с честота ПРОЧЕТЕНА от кадъра, не приета.
   Вчерашната грешка: фиксирани 44100 при файлове на 48000 → +9%. */
var fs = require("fs");
var D = "D:/My Documents 2026/Cyber Hora/THIRD BRAIN/pesenta-flags/rojden-den-asi/";
var CH = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
var NK = { 3: 1152, 2: 576, 0: 576 };

fs.readdirSync(D).filter(function (x) { return /\.mp3$/i.test(x); }).forEach(function (f) {
  var b = fs.readFileSync(D + f);
  var razmer = ((b[6] & 127) << 21) | ((b[7] & 127) << 14) | ((b[8] & 127) << 7) | (b[9] & 127);
  var a = 10 + razmer;

  var p = a, ver = null, chest = null, nk = null;
  while (p + 4 < b.length && p < a + 200000) {
    if (b[p] === 0xFF && (b[p + 1] & 0xE0) === 0xE0) {
      var v = (b[p + 1] >> 3) & 3, sl = (b[p + 1] >> 1) & 3, si = (b[p + 2] >> 2) & 3;
      if (v !== 1 && sl === 1 && si !== 3) { ver = v; chest = CH[v][si]; nk = NK[v]; break; }
    }
    p++;
  }
  var x = b.indexOf(Buffer.from("Xing"), a);
  if (x < 0) x = b.indexOf(Buffer.from("Info"), a);
  var kadri = (x > -1 && (b.readUInt32BE(x + 4) & 1)) ? b.readUInt32BE(x + 8) : null;
  var sek = kadri * nk / chest;
  function mmss(s) { return Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0"); }

  var q = 10, spisak = [], suno = [], uslt = null;
  while (q + 10 <= a) {
    var id = b.slice(q, q + 4).toString("latin1");
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    var sz = ((b[q + 4] & 127) << 21) | ((b[q + 5] & 127) << 14) | ((b[q + 6] & 127) << 7) | (b[q + 7] & 127);
    var telo = b.slice(q + 10, q + 10 + sz);
    var et = id;
    if (id === "TIT2" || id === "TPE1") et = id + "=" + telo.slice(1).toString("utf8").replace(/\u0000/g, "").slice(0, 22);
    spisak.push(et);
    if (id === "USLT") uslt = telo;
    if ([telo.toString("latin1"), telo.toString("utf8"), telo.toString("utf16le"), telo.slice(1).toString("utf16le")]
        .some(function (v) { return v.toLowerCase().indexOf("suno") > -1; })) suno.push(id);
    q += 10 + sz;
  }

  console.log("  == " + f + " ==");
  console.log("    MPEG" + (ver === 3 ? "1" : ver === 2 ? "2" : "2.5") + " Layer III, " + chest + " Hz");
  console.log("    кадри " + kadri + "  ->  " + mmss(sek) +
              "   (при приети 44100 щеше да е " + mmss(kadri * nk / 44100) + ")");
  console.log("    размер " + (b.length / 1048576).toFixed(2) + " MB, етикет " + razmer + " б.");
  console.log("    кадри в етикета: " + spisak.join(", "));
  console.log("    следи от suno: " + (suno.length ? suno.join(", ") : "няма"));
  if (uslt) {
    var t = uslt.slice(4), n = t.indexOf(0);
    console.log("    вграден текст: " + t.slice(n + 1).toString("utf8").length + " знака");
  }
  console.log("");
});
