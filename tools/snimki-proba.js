/* snimki-proba.js — снимките за обложката в пълната поръчка (23.09.2026).
   node tools/snimki-proba.js [база] [папка за снимка]   (по подразбиране http://localhost:4173)

   Какво пази (телефонен изглед 375 px):
   1) избор на 2 снимки → 2 миниатюри, редът казва „2 снимки, N KB“, бутонът става „Добави още“;
   2) „×“ на първата → остава 1;
   3) избор на още 3 → таванът е 3, редът казва „взехме първите 2“, бутонът се крие;
   4) прегледът на стъпка 3 показва „Снимки за обложката 3 ✓“;
   5) изпращане: нативният POST носи 3 файла snimka-<PSN>-1..3.jpg (image/jpeg), всеки в свое
      поле snimka_N — FormSubmit пази по един файл на име на поле (проба по имейл, 23.09), полето
      „Снимки за обложката“ казва „ДА — 3 прикачени“, брифът съдържа бележката, а beacon-ът
      към worker-а носи snimki: 3; на 375 px без препълване;
   6) без снимки: старият път (AJAX, без прикачени) и „Снимки за обложката: не“;
   7) конзолата чиста. Код 1 при FAIL. Нищо не се праща наистина: form.submit, fetch и
      sendBeacon са подменени в страницата. */
const { spawn } = require("child_process");
const http = require("http"), path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9349, BASE = (process.argv[2] || "http://localhost:4173").replace(/\/$/, "");
const IMG = path.join(__dirname, "..", "assets", "img");
const F = n => path.join(IMG, n);
const WS = globalThis.WebSocket;
const R = []; const ok = (n, c, e) => R.push((c ? "OK   " : "FAIL ") + n + (e !== undefined ? "  [" + e + "]" : ""));
const getJSON = url => new Promise((res, rej) => http.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=" + PORT, "--user-data-dir=" + path.join(__dirname, "cp-snimki"), "--window-size=1366,900", "about:blank"], { stdio: "ignore" });
  let targets = null; for (let i = 0; i < 50 && !targets; i++) { await sleep(200); try { targets = await getJSON("http://localhost:" + PORT + "/json/list"); } catch (e) {} }
  const page = targets.find(t => t.type === "page"); const ws = new WS(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const waiters = []; const konzola = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; } if (!m.method) return;
    if (m.method === "Runtime.exceptionThrown") konzola.push("exception: " + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 160));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") konzola.push("console.error: " + m.params.args.map(a => a.value || a.description).join(" ").slice(0, 160));
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); } };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const waitFor = method => new Promise(res => waiters.push({ method, res }));
  const evalJS = async expr => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  await send("Page.enable"); await send("Runtime.enable"); await send("DOM.enable");
  await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const idi = async url => { const l = waitFor("Page.loadEventFired"); await send("Page.navigate", { url }); await l; await sleep(400); };
  /* нищо не тръгва навън: формата, fetch-ът и beacon-ът се записват в window */
  const STUB = `(function(){window.__forma=null;window.__fetch=null;window.__brief=null;
    HTMLFormElement.prototype.submit=function(){var o={fields:{},files:[]};[].forEach.call(this.elements,function(el){if(el.type==="file"){[].forEach.call(el.files,function(f){o.files.push({pole:el.name,name:f.name,type:f.type,size:f.size});});}else if(el.name){o.fields[el.name]=el.value;}});window.__forma=o;};
    window.fetch=function(u,o){window.__fetch={url:String(u),body:o&&o.body?String(o.body):""};return Promise.resolve({ok:true,json:function(){return Promise.resolve({success:"true"});}});};
    navigator.sendBeacon=function(u,b){b.text().then(function(t){window.__brief=JSON.parse(t);});return true;};})()`;
  const OUT = process.argv[3] || null;
  /* снимка на самата кутия (clip по елемента), не на горния край на страницата */
  const snimka = async (ime, sel) => { if (!OUT) return; const c = await evalJS(`(function(){var r=document.querySelector("${sel}").getBoundingClientRect();return {x:0,y:Math.max(0,r.top+window.scrollY-16),width:document.documentElement.clientWidth,height:r.height+32,scale:1};})()`); const r = await send("Page.captureScreenshot", { format: "png", clip: c, captureBeyondViewport: true }); require("fs").writeFileSync(path.join(OUT, ime + ".png"), Buffer.from(r.data, "base64")); };
  const setFiles = async files => { const doc = await send("DOM.getDocument", { depth: 1 }); const n = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#snimki" }); await send("DOM.setFileInputFiles", { nodeId: n.nodeId, files }); await sleep(1500); };
  const SAST = `(function(){var p=document.querySelectorAll("#snimki-preview .snimki-thumb"),st=document.getElementById("snimki-status"),b=document.getElementById("snimki-add");
    return {n:p.length,status:st.textContent,buton:b.textContent,skrit:b.hidden&&b.offsetParent===null,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth};})()`;

  try {
    await idi(BASE + "/poruchka.html");
    await evalJS(`localStorage.removeItem("pesenta_draft")`);
    await evalJS(STUB);
    /* 1) две снимки */
    await setFiles([F("pesen-chestit-krasi-hero.jpg"), F("og-nashiyat-otbor.jpg")]);
    let s = await evalJS(SAST);
    ok("2 снимки → 2 миниатюри, редът брои, бутонът е „Добави още“", s.n === 2 && /^2 снимки, \d+ KB/.test(s.status) && s.buton === "Добави още", s.n + " / " + s.status + " / " + s.buton);
    /* 2) махане */
    await evalJS(`document.querySelector("#snimki-preview .snimki-x").click()`); await sleep(200);
    s = await evalJS(SAST);
    ok("„×“ на първата → остава 1", s.n === 1 && /^1 снимка,/.test(s.status), s.n + " / " + s.status);
    /* 3) таванът */
    await setFiles([F("cover-tutso-400.jpg"), F("cover-habibi-400.jpg"), F("pesen-nashiyat-otbor-hero.jpg")]);
    s = await evalJS(SAST);
    ok("още 3 → таван 3, редът предупреждава, бутонът се крие", s.n === 3 && /взехме първите 2/.test(s.status) && s.skrit === true, s.n + " / " + s.status);
    await evalJS(`document.getElementById("snimki-box").scrollIntoView({block:"center"})`); await snimka("snimki-tri", "#snimki-box");
    ok("375 px с три миниатюри без препълване", s.sw <= s.cw, s.sw + "/" + s.cw);
    /* 4) прегледът на стъпка 3 */
    await evalJS(`document.getElementById("btn-next").click()`); await sleep(300);
    await evalJS(`document.getElementById("btn-next").click()`); await sleep(300);
    const pregled = await evalJS(`document.body.textContent.replace(/\\s+/g," ")`);
    ok("стъпка 3: прегледът показва „Снимки за обложката 3 ✓“", /Снимки за обложката\s*3 ✓/.test(pregled));
    /* 5) изпращане с прикачени */
    await evalJS(`document.getElementById("cust-name").value="Проба Пробова";document.getElementById("cust-email").value="proba@primer.bg";document.getElementById("consent").checked=true;document.getElementById("btn-next").click();`);
    await sleep(800);
    const fo = await evalJS(`window.__forma`), br = await evalJS(`window.__brief`);
    const psn = fo && fo.fields["Номер на заявка"];
    ok("нативният POST носи 3 файла snimka-<PSN>-1..3.jpg, image/jpeg, всеки в свое поле snimka_N (FormSubmit пази по един файл на поле)", !!fo && fo.files.length === 3 && fo.files.every((f, i) => f.pole === "snimka_" + (i + 1) && f.name === "snimka-" + psn + "-" + (i + 1) + ".jpg" && f.type === "image/jpeg" && f.size > 1000), fo ? fo.files.map(f => f.pole + "=" + f.name + " " + f.size).join(", ") : "няма форма");
    ok("полето „Снимки за обложката“ казва „ДА — 3 прикачени“; брифът носи бележката", !!fo && /^ДА — 3 прикачени/.test(fo.fields["Снимки за обложката"] || "") && /3 снимки за обложката/.test(fo.fields["CLAUDE BRIEF"] || ""), fo ? (fo.fields["Снимки за обложката"] || "").slice(0, 40) : "");
    ok("beacon-ът към worker-а носи snimki: 3", !!br && br.snimki === 3 && br.order_no === psn, br ? JSON.stringify({ snimki: br.snimki, order_no: br.order_no }) : "няма beacon");
    ok("формата тръгва към FormSubmit нативно, с _next към благодарим", !!fo && fo.fields._next === "https://pesenta.bg/blagodarim.html" && fo.fields._captcha === "false");
    /* 6) без снимки — старият път */
    await idi(BASE + "/poruchka.html");
    await evalJS(`localStorage.removeItem("pesenta_draft")`);
    await evalJS(STUB);
    await evalJS(`document.getElementById("btn-next").click();document.getElementById("btn-next").click();`); await sleep(300);
    await evalJS(`document.getElementById("cust-name").value="Проба Пробова";document.getElementById("cust-email").value="proba@primer.bg";document.getElementById("consent").checked=true;document.getElementById("btn-next").click();`);
    await sleep(800);
    const fe = await evalJS(`window.__fetch`), fo2 = await evalJS(`window.__forma`), br2 = await evalJS(`window.__brief`);
    let tyalo = null; try { tyalo = JSON.parse(fe.body); } catch (e) {}
    ok("без снимки: AJAX към FormSubmit, без нативна форма, „Снимки за обложката: не“, beacon snimki: 0", !!fe && /formsubmit\.co\/ajax\//.test(fe.url) && !fo2 && !!tyalo && tyalo["Снимки за обложката"] === "не" && !!br2 && br2.snimki === 0, fe ? fe.url.slice(0, 40) + " / " + (tyalo && tyalo["Снимки за обложката"]) : "няма fetch");
    ok("конзолата чиста", konzola.length === 0, konzola.join(" | "));
  } catch (e) { ok("пробата стигна до края", false, e.message.slice(0, 200)); }
  try { await send("Browser.close"); } catch (e) {} try { chrome.kill(); } catch (e) {}
  R.forEach(r => console.log("  " + r));
  const f = R.filter(r => r.indexOf("FAIL") === 0).length;
  console.log(f ? "  " + f + " FAIL" : "  всичко минава"); process.exit(f ? 1 : 0);
})();
