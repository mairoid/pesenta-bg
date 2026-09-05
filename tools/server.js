/* Локален статичен сървър за корена на сайта — С Range заявки.
   Защо не npx http-server: той връща 200 вместо 206 на заявка за парче от
   файла и не праща Accept-Ranges. Тогава превъртането на аудио изглежда
   счупено (currentTime пада на нула), макар кодът да е верен — изяде цикъл
   на 27.08.2026. GitHub Pages връща 206, тоест на живо работи.

   Пускане:  node tools/server.js [порт]      (по подразбиране 4173)
   Проверка: curl -s -o NUL -H "Range: bytes=1000000-1001000" -w "%{http_code}" http://localhost:4173/assets/audio/api.mp3
             → трябва 206 */
var http = require("http"), fs = require("fs"), path = require("path");
var ROOT = path.resolve(__dirname, ".."), PORT = Number(process.argv[2]) || 4173;
var MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".webp": "image/webp", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".mp4": "video/mp4",
  ".json": "application/json", ".xml": "application/xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };

http.createServer(function (req, res) {
  var p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.slice(-1) === "/") p += "index.html";
  var f = path.join(ROOT, p);
  if (f.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end(); }
  fs.stat(f, function (e, st) {
    if (e || !st.isFile()) { res.writeHead(404); return res.end("not found"); }
    var tip = MIME[path.extname(f).toLowerCase()] || "application/octet-stream";
    var m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (m && (m[1] || m[2])) {
      var ot = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
      var do_ = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
      if (ot >= st.size || ot > do_) { res.writeHead(416, { "Content-Range": "bytes */" + st.size }); return res.end(); }
      res.writeHead(206, { "Content-Type": tip, "Accept-Ranges": "bytes",
        "Content-Range": "bytes " + ot + "-" + do_ + "/" + st.size, "Content-Length": do_ - ot + 1 });
      return fs.createReadStream(f, { start: ot, end: do_ }).pipe(res);
    }
    res.writeHead(200, { "Content-Type": tip, "Accept-Ranges": "bytes", "Content-Length": st.size });
    fs.createReadStream(f).pipe(res);
  });
}).listen(PORT, function () { console.log("pesenta.bg локално: http://localhost:" + PORT + "  (Range: да)"); });
