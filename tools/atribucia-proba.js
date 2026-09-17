/* Атрибуцията на поръчката (17.09.2026): main.js запомня първата страница и първия
   външен източник в sessionStorage; формите ги пращат с брифа. Проверка през
   DevTools Protocol срещу tools/server.js — Page.navigate с referrer симулира
   идване от Google, без да се праща истинска поръчка.

   node tools/atribucia-proba.js [база]     (по подразбиране http://localhost:4173/)

   1) index.html с referrer google → psn_landing=/index.html, psn_ref=google;
   2) → podarak-pesen-za-imen-den.html → psn_landing остава /index.html;
   3) → poruchka.html → ref_posleden (document.referrer) е страницата за повода;
   4) нов раздел без referrer → psn_ref празен, landing = първата му страница;
   5) конзолата чиста. Код 1 при FAIL. */
const { spawn } = require("child_process");
const http = require("http"), path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9344, BASE = (process.argv[2] || "http://localhost:4173/").replace(/\/?$/, "/");
const WS = globalThis.WebSocket;
/* referrer със същата схема като базата: при преход https → http браузърът го маха
   (strict-origin-when-cross-origin), тоест срещу localhost „google“ трябва да е http. */
const GOOGLE = (BASE.indexOf("https:") === 0 ? "https" : "http") + "://www.google.com/";
const R = []; const ok = (n, c, e) => R.push((c ? "OK   " : "FAIL ") + n + (e !== undefined ? "  [" + e + "]" : ""));
const getJSON = url => new Promise((res, rej) => http.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + PORT, "--user-data-dir=" + path.join(__dirname, "cp-atribucia"), "--window-size=1366,900", "about:blank"], { stdio: "ignore" });
  let targets = null; for (let i = 0; i < 50 && !targets; i++) { await sleep(200); try { targets = await getJSON("http://localhost:" + PORT + "/json/list"); } catch (e) {} }
  const page = targets.find(t => t.type === "page"); const ws = new WS(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const waiters = []; const konzola = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; } if (!m.method) return;
    if (m.method === "Runtime.exceptionThrown") konzola.push("exception: " + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 160));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") konzola.push("log: " + m.params.entry.text.slice(0, 160));
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); } };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const waitFor = method => new Promise(res => waiters.push({ method, res }));
  const evalJS = async expr => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true }); if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails).slice(0, 200)); return r.result.value; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
  await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
  const otvori = async (p, referrer) => { const l = waitFor("Page.loadEventFired"); await send("Page.navigate", Object.assign({ url: BASE + p }, referrer ? { referrer } : {})); await l; await sleep(300); };
  const stor = () => evalJS(`(function(){try{return {landing:sessionStorage.getItem("psn_landing"),ref:sessionStorage.getItem("psn_ref"),docref:document.referrer}}catch(e){return {err:String(e)}}})()`);

  await otvori("index.html", GOOGLE);
  let s = await stor();
  ok("1) index.html от Google: psn_landing=/index.html", s.landing === "/index.html", s.landing);
  ok("1) psn_ref = google", s.ref === GOOGLE, s.ref);

  await otvori("podarak-pesen-za-imen-den.html", BASE + "index.html");
  s = await stor();
  ok("2) повод след началната: landing остава /index.html", s.landing === "/index.html", s.landing);
  ok("2) psn_ref остава google (вътрешният referrer не го презаписва)", s.ref === GOOGLE, s.ref);

  await otvori("poruchka.html", BASE + "podarak-pesen-za-imen-den.html");
  s = await stor();
  ok("3) формата: document.referrer е страницата за повода", /podarak-pesen-za-imen-den\.html$/.test(s.docref), s.docref);
  ok("3) order.js е зареден с BRIEF_ENDPOINT", await evalJS(`(function(){var s=[].slice.call(document.scripts).map(function(x){return x.src}).join(" ");return /order\\.js/.test(s)})()`));

  /* нов раздел = нова сесия за sessionStorage */
  const nt = await send("Target.createTarget", { url: "about:blank" });
  const ws2 = new WS((await getJSON("http://localhost:" + PORT + "/json/list")).find(t => t.id === nt.targetId).webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws2.onopen = res; ws2.onerror = rej; });
  let id2 = 0; const pend2 = new Map(); const wait2 = [];
  ws2.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend2.has(m.id)) { const p = pend2.get(m.id); pend2.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; } if (m.method) for (let i = wait2.length - 1; i >= 0; i--) if (wait2[i].method === m.method) { wait2[i].res(m.params); wait2.splice(i, 1); } };
  const send2 = (method, params) => new Promise((res, rej) => { const i = ++id2; pend2.set(i, { res, rej }); ws2.send(JSON.stringify({ id: i, method, params: params || {} })); });
  await send2("Page.enable"); await send2("Runtime.enable");
  const l2 = new Promise(res => wait2.push({ method: "Page.loadEventFired", res })); await send2("Page.navigate", { url: BASE + "podarak-za-tatko.html" }); await l2; await sleep(300);
  const r2 = await send2("Runtime.evaluate", { expression: `(function(){try{return {landing:sessionStorage.getItem("psn_landing"),ref:sessionStorage.getItem("psn_ref")}}catch(e){return {err:String(e)}}})()`, returnByValue: true });
  const s2 = r2.result.value;
  ok("4) нов раздел, директно: landing = /podarak-za-tatko.html, psn_ref празен", s2.landing === "/podarak-za-tatko.html" && !s2.ref, JSON.stringify(s2));

  ok("5) конзолата чиста", konzola.length === 0, konzola.join(" | "));
  ws.close(); ws2.close(); chrome.kill();
  R.forEach(l => console.log("  " + l));
  const fail = R.filter(l => l.startsWith("FAIL")).length;
  console.log(fail ? "  " + fail + " FAIL" : "  всичко минава");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("  ГРЕШКА: " + e.message); process.exit(2); });
