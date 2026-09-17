/* Байтове при зареждане, по тип, без клик — през DevTools Protocol (17.09.2026).
   Lighthouse на тази машина лъже: AdGuard за Windows инжектира 2,2 MB блокиращи
   скриптове във всеки Chrome, включително на localhost. Тук се броят само заявките
   на самата страница (домейнът на базата), 8 секунди след load, на телефон 375×812.

   node tools/bajtove-proba.js <url> [<url>…]

   Печата за всеки адрес: общо байтове, по тип, броят и байтовете на MP3 — и после
   докосва първия демо ред и проверява, че песента тръгва и времетраенето е същото. */
const { spawn } = require("child_process");
const http = require("http"), path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9345, URLS = process.argv.slice(2);
if (!URLS.length) { console.log("node tools/bajtove-proba.js <url> [<url>…]"); process.exit(1); }
const WS = globalThis.WebSocket;
const getJSON = url => new Promise((res, rej) => http.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + PORT, "--user-data-dir=" + path.join(__dirname, "cp-bajtove"), "--window-size=1366,900", "about:blank"], { stdio: "ignore" });
  let targets = null; for (let i = 0; i < 50 && !targets; i++) { await sleep(200); try { targets = await getJSON("http://localhost:" + PORT + "/json/list"); } catch (e) {} }
  const page = targets.find(t => t.type === "page"); const ws = new WS(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const waiters = []; const zayavki = new Map(); const konzola = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; } if (!m.method) return;
    if (m.method === "Network.requestWillBeSent") zayavki.set(m.params.requestId, { url: m.params.request.url, type: m.params.type, bytes: 0 });
    /* dataReceived, не loadingFinished: за медия (Range парчета) Chrome дава 0 при финала */
    if (m.method === "Network.dataReceived") { const z = zayavki.get(m.params.requestId); if (z) z.bytes += m.params.encodedDataLength; }
    if (m.method === "Runtime.exceptionThrown") konzola.push("exception: " + (m.params.exceptionDetails.text || "").slice(0, 120));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") konzola.push("log: " + m.params.entry.text.slice(0, 120));
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); } };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const waitFor = method => new Promise(res => waiters.push({ method, res }));
  const evalJS = async expr => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails).slice(0, 200)); return r.result.value; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable"); await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  let fail = 0;
  for (const url of URLS) {
    zayavki.clear();
    const origin = new URL(url).origin;
    const l = waitFor("Page.loadEventFired"); await send("Page.navigate", { url }); await l; await sleep(8000);
    const svoi = [...zayavki.values()].filter(z => z.url.indexOf(origin + "/") === 0);
    const poTip = {}; svoi.forEach(z => { poTip[z.type] = (poTip[z.type] || 0) + z.bytes; });
    const mp3 = svoi.filter(z => /\.mp3(\?|$)/.test(z.url));
    const obshto = svoi.reduce((s, z) => s + z.bytes, 0);
    const kb = n => Math.round(n / 1024);
    console.log("== " + url + " (375, без клик, 8 s след load)");
    console.log("   заявки " + svoi.length + ", общо " + kb(obshto) + " KiB: " + Object.keys(poTip).sort((a, b) => poTip[b] - poTip[a]).map(t => t + " " + kb(poTip[t])).join(", "));
    console.log("   MP3 преди клик: " + mp3.length + " файла, " + kb(mp3.reduce((s, z) => s + z.bytes, 0)) + " KiB" + (mp3.length ? " — " + mp3.map(z => z.url.split("/").pop()).join(", ") : ""));
    if (mp3.length) fail++;
    /* докосване на първия демо ред: песента трябва да тръгне, надписът да остане верен */
    /* докосва се бутонът play, не средата на картата — там е лентата за превъртане
       и докосването ѝ превърта, вместо да пуска */
    const r = await evalJS(`(function(){var p=document.querySelector(".track-row.player[data-src]");if(!p)return null;p.scrollIntoView({block:"center",behavior:"instant"});return {t:p.querySelector(".time").textContent,src:p.getAttribute("data-src")}})()`);
    if (r) {
      await sleep(400);
      const r2 = await evalJS(`(function(){var p=document.querySelector(".track-row.player[data-src]");var b=(p.querySelector(".play-btn")||p).getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}})()`);
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r2.x, y: r2.y }] });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(2500);
      const sled = await evalJS(`(function(){var p=document.querySelector(".track-row.player[data-src]");return {playing:p.classList.contains("playing"),t:p.querySelector(".time").textContent}})()`);
      const mp3sled = [...zayavki.values()].filter(z => /\.mp3(\?|$)/.test(z.url));
      const ok = sled.playing && mp3sled.length >= 1;
      console.log("   докосване на „" + r.src.split("/").pop() + "“: " + (sled.playing ? "свири" : "НЕ свири") + ", заявка за MP3 " + (mp3sled.length ? "тръгна" : "НЯМА") + ", надпис преди „" + r.t + "“ → сега „" + sled.t + "“" + (ok ? "" : "  ← FAIL"));
      if (!ok) fail++;
    }
  }
  console.log(konzola.length ? "   конзола: " + konzola.join(" | ") : "   конзолата чиста");
  ws.close(); chrome.kill();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("  ГРЕШКА: " + e.message); process.exit(2); });
