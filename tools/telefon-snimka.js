/* Страница на ИСТИНСКИ телефон през DevTools Protocol: mobile:true дава
   hover:none, pointer:coarse и докосване, 375×812. Chrome от командния ред с
   --window-size=375 не прави това — прозорецът има минимална ширина (около
   500 px), страницата се подрежда по-широка, а снимката излиза отрязана и
   лъже, че редовете не се пренасят. Проверено на 07.09.2026 при „Нашият отбор“.

   node tools/telefon-snimka.js <url> [представка] [папка за снимките] [ширина]

   Печата: scrollWidth срещу clientWidth (хоризонтално препълване), елементите,
   които стърчат извън кадъра, състоянието на шрифтовете, hover/pointer, и —
   ако страницата е подарък — времетраенето в плейъра и коя картина е избрал
   srcset. Снимките са на парчета по 1000 px, за да се гледат в реален мащаб. */
const { spawn } = require("child_process");
const http = require("http"), fs = require("fs"), path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9337;
const URL = process.argv[2];
if (!URL) { console.log("node tools/telefon-snimka.js <url> [представка] [папка] [ширина]"); process.exit(1); }
const PREFIX = process.argv[3] || "telefon";
const OUT = process.argv[4] || process.cwd();
const W = parseInt(process.argv[5] || "375", 10);
const WS = globalThis.WebSocket;
function getJSON(url) { return new Promise((res, rej) => http.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej)); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + path.join(OUT, "cp-telefon"), "--window-size=1366,900", "about:blank"], { stdio: "ignore" });
  let targets = null;
  for (let i = 0; i < 50 && !targets; i++) { await sleep(200); try { targets = await getJSON("http://localhost:" + PORT + "/json/list"); } catch (e) {} }
  if (!targets) throw new Error("Chrome не отговори");
  const page = targets.find(t => t.type === "page");
  const ws = new WS(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const waiters = []; const konzola = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    if (!m.method) return;
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) konzola.push(m.params.type + ": " + m.params.args.map(a => a.value || a.description || "").join(" ").slice(0, 160));
    if (m.method === "Runtime.exceptionThrown") konzola.push("exception: " + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 200));
    /* preload предупрежденията при file:// са от credentials режима на самия file:// и ги няма на https */
    if (m.method === "Log.entryAdded" && (m.params.entry.level === "error" || m.params.entry.level === "warning") && m.params.entry.text.indexOf("preload") < 0) konzola.push("log " + m.params.entry.level + ": " + m.params.entry.text.slice(0, 160) + (m.params.entry.url ? " @" + m.params.entry.url.split("/").pop() : ""));
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); }
  };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const waitFor = method => new Promise(res => waiters.push({ method, res }));
  const evalJS = async expr => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text)); return r.result.value; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: 812, deviceScaleFactor: 1, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const l = waitFor("Page.loadEventFired"); await send("Page.navigate", { url: URL }); await l; await sleep(1800);
  await evalJS("document.fonts.ready.then(function(){return 1})");

  const m = JSON.parse(await evalJS(`JSON.stringify({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight,
    fonts: document.fonts.status, hover: matchMedia("(hover: none)").matches, pointer: matchMedia("(pointer: coarse)").matches,
    time: (document.querySelector(".podarak-player .time") || {}).textContent || null,
    img: (function(){ var i = document.querySelector(".podarak-kadar img"); if (!i) return null; var r = i.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), cur: (i.currentSrc || "").split("/").pop() }; })(),
    wide: Array.from(document.querySelectorAll("body *")).filter(function(e){ var r = e.getBoundingClientRect(); return r.width > 0 && (r.right > ${W} + 0.5 || r.left < -0.5); }).slice(0, 8)
      .map(function(e){ var r = e.getBoundingClientRect(); return e.tagName.toLowerCase() + (e.className ? "." + String(e.className).split(" ")[0] : "") + " " + Math.round(r.left) + ".." + Math.round(r.right); })
  })`));
  console.log("  ширина: scrollWidth " + m.sw + " / clientWidth " + m.cw + (m.sw > m.cw ? "  ← ПРЕПЪЛВАНЕ" : "  (без препълване)"));
  console.log("  височина: " + m.sh + " px; шрифтове: " + m.fonts + "; hover:none=" + m.hover + " pointer:coarse=" + m.pointer);
  if (m.time) console.log("  плейър: " + m.time);
  if (m.img) console.log("  картина: " + m.img.w + "×" + m.img.h + " от " + m.img.cur);
  console.log("  стърчат: " + (m.wide.length ? m.wide.join(", ") : "нищо"));

  /* Кадърът става висок колкото страницата и се снима на парчета. */
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: m.sh, deviceScaleFactor: 1, mobile: true });
  await sleep(600);
  let n = 0;
  for (let y = 0; y < m.sh; y += 1000) {
    const h = Math.min(1000, m.sh - y);
    const r = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: y, width: W, height: h, scale: 1 } });
    const f = path.join(OUT, PREFIX + "-" + n + ".png");
    fs.writeFileSync(f, Buffer.from(r.data, "base64"));
    console.log("  снимка " + f + "  y=" + y + " h=" + h); n++;
  }
  console.log("  конзола: " + (konzola.length ? konzola.join(" | ") : "чиста"));
  ws.close(); chrome.kill();
}
main().catch(e => { console.error("ГРЕШКА: " + e.message); process.exit(1); });
