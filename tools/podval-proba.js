/* Сгъваемият подвал — проверка на истински телефон и на десктоп през DevTools
   Protocol (11.09.2026), при пуснат tools/server.js. Chrome от командния ред с
   --window-size=375 не става: прозорецът има минимална ширина ~500 px.

   node tools/podval-proba.js [url]     (по подразбиране http://localhost:4173/index.html)

   1) статично: връзките в подвала са в HTML-а (не са вкарани с JS) — броят от
      curl-а е същият като този в DOM-а;
   2) 375×812 (mobile:true, докосване): трите групи са затворени, подвалът е под
      900 px, страницата под 11 500 px; истински клик на „Поводи (20)“ ги отваря;
   3) 1366×900: трите са отворени; клик на summary не ги затваря; височина;
   4) смяна на размера 1366 → 375 без презареждане: групите се затварят, а тази
      с data-tap остава както е;
   5) конзолата чиста. Код 1 при FAIL. */
const { spawn } = require("child_process");
const http = require("http"), path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9343, URL = process.argv[2] || "http://localhost:4173/index.html";
const WS = globalThis.WebSocket;
const R = []; const ok = (n, c, e) => R.push((c ? "OK   " : "FAIL ") + n + (e !== undefined ? "  [" + e + "]" : ""));
const getJSON = url => new Promise((res, rej) => http.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));
const getText = url => new Promise((res, rej) => http.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => res(b)); }).on("error", rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  /* 1) статично */
  /* fetch, не http.get — за да работи и срещу живия сайт (https). */
  const html = await (await fetch(URL, { headers: { "Cache-Control": "no-cache" } })).text();
  const podvalHtml = html.slice(html.indexOf('<footer class="site-footer">'), html.indexOf("</footer>"));
  const vHtml = (podvalHtml.match(/<a href/g) || []).length;
  const detHtml = (podvalHtml.match(/<details class="footer-fold">/g) || []).length;
  ok("HTML: " + detHtml + " details в подвала, " + vHtml + " връзки в самия HTML", detHtml === 3 && vHtml > 0);

  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=" + PORT, "--user-data-dir=" + path.join(__dirname, "cp-podval"), "--window-size=1366,900", "about:blank"], { stdio: "ignore" });
  let targets = null; for (let i = 0; i < 50 && !targets; i++) { await sleep(200); try { targets = await getJSON("http://localhost:" + PORT + "/json/list"); } catch (e) {} }
  const page = targets.find(t => t.type === "page"); const ws = new WS(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const waiters = []; const konzola = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; } if (!m.method) return;
    if (m.method === "Runtime.exceptionThrown") konzola.push("exception: " + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 160));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") konzola.push("console.error: " + m.params.args.map(a => a.value || a.description).join(" ").slice(0, 160));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") konzola.push("log: " + m.params.entry.text.slice(0, 160));
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); } };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const waitFor = method => new Promise(res => waiters.push({ method, res }));
  const evalJS = async expr => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails).slice(0, 200)); return r.result.value; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
  /* Профилът на Chrome е траен (cp-podval) и кешира style.css от предишното
     пускане — на 14.09 показа стария подвал, докато сървърът вече даваше новия. */
  await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
  const telefon = async () => { mobilen = true; await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }); await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }); };
  const desktop = async (w) => { mobilen = false; await send("Emulation.setDeviceMetricsOverride", { width: w || 1366, height: 900, deviceScaleFactor: 1, mobile: false }); await send("Emulation.setTouchEmulationEnabled", { enabled: false }); };
  /* снимка на самия подвал (clip по елемента), за да се види как е подреден */
  const OUT = process.argv[3] || null;
  const snimkaPodval = async (ime) => {
    if (!OUT) return;
    const b = await evalJS(`(function(){var f=document.querySelector(".site-footer");f.scrollIntoView({behavior:"instant"});var r=f.getBoundingClientRect();return {x:0,y:Math.max(0,r.top+window.scrollY),w:document.documentElement.clientWidth,h:Math.min(r.height,3000)}})()`);
    await sleep(300);
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: b.x, y: b.y, width: b.w, height: b.h, scale: 1 } });
    require("fs").writeFileSync(path.join(OUT, ime), Buffer.from(r.data, "base64"));
  };
  const otvori = async () => { const l = waitFor("Page.loadEventFired"); await send("Page.navigate", { url: URL }); await l; await sleep(400); };
  const sastoyanie = () => evalJS(`(function(){var f=document.querySelector(".site-footer");var d=[].slice.call(document.querySelectorAll(".footer-fold"));return {podval:Math.round(f.getBoundingClientRect().height),stranica:document.documentElement.scrollHeight,otvoreni:d.filter(function(x){return x.open}).length,vsichki:d.length,vrazki:f.querySelectorAll("a[href]").length,tap:d.filter(function(x){return x.hasAttribute("data-tap")}).length}})()`);
  /* Скролът на сайта е плавен: координатите се мерят СЛЕД като спре, иначе
     кликът пада където е бил елементът, а не където е. На телефон — истинско
     докосване, на десктоп — мишка. Проверява се и кой елемент е под точката. */
  let mobilen = false;
  const klik = async (tekst) => {
    const ima = await evalJS(`(function(){var s=[].slice.call(document.querySelectorAll(".footer-fold summary")).find(function(x){return x.textContent.indexOf(${JSON.stringify(tekst)})===0});if(!s)return false;s.scrollIntoView({block:"center",behavior:"instant"});return true})()`);
    if (!ima) return false;
    await sleep(500);
    const r = await evalJS(`(function(){var s=[].slice.call(document.querySelectorAll(".footer-fold summary")).find(function(x){return x.textContent.indexOf(${JSON.stringify(tekst)})===0});var b=s.getBoundingClientRect();var x=b.left+b.width/2,y=b.top+b.height/2;var e=document.elementFromPoint(x,y);return {x:x,y:y,pod:e?(e.tagName+(e.className?"."+String(e.className).split(" ")[0]:"")):"нищо",e:e===s||(e&&s.contains(e))}})()`);
    if (!r.e) { R.push("info  под точката на клика е " + r.pod + ", не summary"); }
    if (mobilen) {
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.x, y: r.y }] });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x: r.x, y: r.y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r.x, y: r.y, button: "left", clickCount: 1 });
    }
    await sleep(300); return true;
  };

  /* 2) телефон */
  await telefon(); await otvori();
  let s = await sastoyanie();
  ok("375: връзките в DOM-а = в HTML-а", s.vrazki === vHtml, s.vrazki + " / " + vHtml);
  ok("375: трите групи са затворени", s.otvoreni === 0 && s.vsichki === 3, s.otvoreni + "/" + s.vsichki + " отворени");
  ok("375: подвалът под 900 px", s.podval < 900, s.podval + " px");
  const razbivka = await evalJS(`(function(){var f=document.querySelector(".site-footer");var cs=getComputedStyle(f);var out=[].slice.call(f.querySelectorAll(".footer-col")).map(function(c){var h=c.querySelector("h3, summary");return (h?h.textContent.trim().slice(0,12):"лого")+" "+Math.round(c.getBoundingClientRect().height)});out.push("долен ред "+Math.round(f.querySelector(".footer-bottom").getBoundingClientRect().height));out.push("отстъпи "+parseInt(cs.paddingTop)+"+"+parseInt(cs.paddingBottom));out.push("разстояние между колоните "+parseInt(getComputedStyle(f.querySelector(".footer-grid")).rowGap)+"×5");return out.join(", ")})()`);
  R.push("info  375, откъде идват px: " + razbivka);
  ok("375: страницата под 11 500 px", s.stranica < 11500, s.stranica + " px");
  const kl = await klik("Поводи"); s = await sastoyanie();
  ok("375: клик на „Поводи (…)“ ги отваря и слага data-tap", kl && s.otvoreni === 1 && s.tap === 1, s.otvoreni + " отворени, tap=" + s.tap);
  const otvorenaSled = await evalJS(`(function(){var d=document.querySelector(".footer-fold[data-tap]");return d&&d.open&&d.querySelector("a").getBoundingClientRect().height>0})()`);
  ok("375: връзките в отворената група се виждат", otvorenaSled === true);

  await snimkaPodval("podval-375.png");

  /* 3) десктоп */
  await desktop(); await otvori(); s = await sastoyanie();
  ok("1366: трите групи са отворени", s.otvoreni === 3, s.otvoreni + "/3");
  const klD = await klik("За кого"); s = await sastoyanie();
  ok("1366: клик на summary не затваря", klD && s.otvoreni === 3 && s.tap === 0, s.otvoreni + "/3 отворени, tap=" + s.tap);
  const prep = await evalJS(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  ok("1366: подвал " + s.podval + " px, без хоризонтално препълване", prep === 0, prep ? "препълване " + prep + " px" : undefined);
  await snimkaPodval("podval-1366.png");
  for (const w of [1200, 1024]) {
    await desktop(w); await sleep(300); const t = await sastoyanie();
    const pr = await evalJS(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    ok(w + ": подвал " + t.podval + " px, " + t.otvoreni + "/3 отворени, без препълване", t.otvoreni === 3 && pr === 0, pr ? "препълване " + pr + " px" : undefined);
  }
  await desktop(); await sleep(200);

  /* 4) смяна на размера без презареждане */
  await telefon(); await sleep(400); s = await sastoyanie();
  ok("1366 → 375 без презареждане: групите се затварят", s.otvoreni === 0, s.otvoreni + " отворени");
  await klik("Календар"); await desktop(); await sleep(400); s = await sastoyanie();
  ok("375 (една отворена с ръка) → 1366: и трите отворени", s.otvoreni === 3, s.otvoreni + "/3");
  await telefon(); await sleep(400); s = await sastoyanie();
  ok("1366 → 375: отворената с ръка остава, другите се затварят", s.otvoreni === 1 && s.tap === 1, s.otvoreni + " отворени, tap=" + s.tap);

  /* 5) конзола */
  ok("конзолата чиста", konzola.length === 0, konzola.length ? konzola.join(" | ") : "");

  ws.close(); chrome.kill();
  R.forEach(l => console.log("  " + l));
  const fail = R.filter(l => l.startsWith("FAIL")).length;
  console.log(fail ? "  " + fail + " FAIL" : "  всичко минава");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("  ГРЕШКА: " + e.message); process.exit(2); });
