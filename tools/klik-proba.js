/* Истински кликове по картите на лентите — през DevTools Protocol.

   Защо не element.click(): той не минава през правилото на браузъра „click
   отива при общия родител на mousedown и mouseup“, нито през pointer capture.
   Точно това правило криеше бъга от 06.09.2026 — картите на поводите бяха
   линкове, element.click() ги „отваряше“, а истинска мишка не. Само
   Input.dispatchMouseEvent възпроизвежда пътя на истинския човек.

   Пускане:  node tools/server.js            (в отделен прозорец, порт 4173)
             node tools/klik-proba.js [база]  (по подразбиране http://localhost:4173/)
   Изход: по ред на проверка OK/FAIL; код 1 при поне един FAIL.
   Пуска headless Chrome сам и го затваря накрая. */
var spawn = require("child_process").spawn, spawnSync = require("child_process").spawnSync;
var http = require("http"), path = require("path"), os = require("os");
var CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
var CDP_PORT = 9333, BASE = process.argv[2] || "http://localhost:4173/";
var WS = globalThis.WebSocket;
if (!WS) { console.error("Трябва node 22+ (глобален WebSocket); този е " + process.version); process.exit(2); }

function getJSON(url) {
  return new Promise(function (res, rej) {
    http.get(url, function (r) {
      var b = ""; r.on("data", function (d) { b += d; });
      r.on("end", function () { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    }).on("error", rej);
  });
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function main() {
  var chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--remote-debugging-port=" + CDP_PORT, "--user-data-dir=" + path.join(os.tmpdir(), "pesenta-klik-proba"),
    "--window-size=1366,900", "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: "ignore" });
  var targets = null;
  for (var i = 0; i < 50 && !targets; i++) { await sleep(200); try { targets = await getJSON("http://localhost:" + CDP_PORT + "/json/list"); } catch (e) {} }
  if (!targets) throw new Error("Chrome не отговори на порт " + CDP_PORT);
  var page = targets.filter(function (t) { return t.type === "page"; })[0];
  var ws = new WS(page.webSocketDebuggerUrl);
  await new Promise(function (res, rej) { ws.onopen = res; ws.onerror = rej; });
  var id = 0, pending = new Map(), waiters = [];
  ws.onmessage = function (ev) {
    var m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      var p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result);
    } else if (m.method) {
      for (var i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); }
    }
  };
  function send(method, params) {
    return new Promise(function (res, rej) { var i = ++id; pending.set(i, { res: res, rej: rej }); ws.send(JSON.stringify({ id: i, method: method, params: params || {} })); });
  }
  function waitFor(method) { return new Promise(function (res) { waiters.push({ method: method, res: res }); }); }
  async function evalJS(expr) { return (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value; }
  await send("Page.enable"); await send("Runtime.enable");
  async function go(url) { var l = waitFor("Page.loadEventFired"); await send("Page.navigate", { url: url }); await l; await sleep(400); }
  async function mouse(type, x, y, extra) {
    await send("Input.dispatchMouseEvent", Object.assign({ type: type, x: Math.round(x), y: Math.round(y), button: "left", clickCount: 1 }, extra || {}));
  }
  var R = [];
  function ok(name, cond, extra) { R.push((cond ? "OK   " : "FAIL ") + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
  function kratko(h) { return String(h).split("/").pop().slice(0, 70); }

  /* Центърът на карта по селектор, след като е докарана в кадър. */
  async function karta(sel) {
    var s = await evalJS("(function(){var c=document.querySelector(" + JSON.stringify(sel) + "); if(!c) return \"null\";" +
      "c.scrollIntoView({block:\"center\",behavior:\"instant\"}); var r=c.getBoundingClientRect();" +
      "return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2,href:c.href});})()");
    return JSON.parse(s);
  }
  /* Посочване вдига картата с 6 px — мери се пак. Лентата пълзи сама и на
     следващия кадър връща каквото scrollIntoView е направил; спира само докато
     „човекът пипа“ (колелце, пръст, клавиатура — 1,5 s) или мишката е над нея,
     а второто в headless не е сигурно. Затова едно колелце с 1 px: после
     всичко до клика е в тези 1,5 s. Без това тестът лъжеше през път — кликът
     падаше в процепа между две карти, докато лентата се връщаше. */
  async function hover(sel) {
    var k = await karta(sel); if (!k) return null;
    await mouse("mouseMoved", k.x, k.y, { button: "none", clickCount: 0 });
    await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: Math.round(k.x), y: Math.round(k.y), deltaX: 1, deltaY: 0 });
    await sleep(200);
    return karta(sel);
  }
  async function klik(k) { await mouse("mousePressed", k.x, k.y); await sleep(60); await mouse("mouseReleased", k.x, k.y); await sleep(1500); return evalJS("location.href"); }

  /* 1. Обикновен клик върху карта на повод */
  await go(BASE + "index.html");
  var k = await hover("#povodi-track .occasion-card");
  var href = await klik(k);
  ok("povodi: клик върху картата отваря " + kratko(k.href), href === k.href, kratko(href));

  /* 2. Влачене — не бива да навигира, но трябва да превърти */
  await go(BASE + "index.html");
  k = await hover("#povodi-track .occasion-card");
  var s0 = await evalJS("document.getElementById('povodi-rail').scrollLeft");
  await mouse("mousePressed", k.x, k.y);
  for (i = 1; i <= 8; i++) { await mouse("mouseMoved", k.x - i * 12, k.y, { buttons: 1 }); await sleep(20); }
  await mouse("mouseReleased", k.x - 96, k.y);
  await sleep(1200);
  href = await evalJS("location.href");
  var s1 = await evalJS("document.getElementById('povodi-rail').scrollLeft");
  ok("povodi: влачене 96 px НЕ навигира", /index\.html$/.test(href), kratko(href));
  ok("povodi: влаченето превърта лентата", Math.abs(s1 - s0) > 50, s0 + " → " + s1);

  /* 3. Клик след влачене (без движение) пак отваря */
  k = await hover("#povodi-track .occasion-card");
  href = await klik(k);
  ok("povodi: клик след влачене отваря " + kratko(k.href), href === k.href, kratko(href));

  /* 4. Последната карта (Шега → поръчка с параметър) */
  await go(BASE + "index.html");
  k = await hover("#povodi-track .occasion-card:nth-of-type(8)");
  href = await klik(k);
  ok("povodi: 8-ата карта отваря " + kratko(k.href), href === k.href, kratko(href));

  /* 5. Родените на този ден — същата лента, карти-линкове към поръчка */
  await go(BASE + "rodeni-dnes.html"); await sleep(1500);
  k = await hover(".rojdendni-track .rojden-card");
  if (!k) ok("rodeni: няма .rojden-card на страницата (прескочено)", true);
  else { href = await klik(k); ok("rodeni: клик върху картата отваря " + kratko(k.href), href === k.href, kratko(href)); }

  console.log(R.join("\n"));
  ws.close();
  spawnSync("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
  process.exit(R.some(function (r) { return r.indexOf("FAIL") === 0; }) ? 1 : 0);
}
main().catch(function (e) { console.error("ГРЕШКА", e); process.exit(1); });
