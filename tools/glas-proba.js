/* glas-proba.js — гласовият разказ в бързата форма, „Чуй 15 секунди“ и връзките #order (14.10.2026).
   node tools/glas-proba.js [база]   (по подразбиране http://localhost:4173)

   Какво пази (телефон 375 px, Chrome с фалшив микрофон):
   1) бутонът „Или го разкажи с глас“ се показва, щом формата се отвори;
   2) запис → думите (подменено разпознаване) се изписват в полето, бутонът е „Спри записа“;
   3) спиране → плейърът със записа излиза, файлът е > 0 байта;
   4) изпращане: гласът тръгва в отделна no-cors заявка (поле glasovo, glasovo-<PSN>.webm), поръчката
      казва „Гласов разказ: ДА“, брифът и beacon-ът носят бележката за записа;
   5) „Продължи“ по време на запис спира записа и пак изпраща гласа;
   6) „Чуй 15 секунди“: видим на 375 px, „Чуй примери“ скрит; пуска от data-start, втори клик спира;
      при отворена форма се скрива; на 1366 px го няма;
   7) #order от картата с цената отваря формата; ./?stil=Рок#order избира „Рок“;
   8) конзолата чиста. Нищо не се праща наистина: fetch и sendBeacon са подменени, Stripe е блокиран. */
const { spawn } = require("child_process");
const http = require("http"), path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9351, BASE = (process.argv[2] || "http://localhost:4173").replace(/\/$/, "");
const WS = globalThis.WebSocket;
const R = []; const ok = (n, c, e) => R.push((c ? "OK   " : "FAIL ") + n + (e !== undefined ? "  [" + e + "]" : ""));
const getJSON = url => new Promise((res, rej) => http.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Разпознаването е подменено преди страницата: в безглав Chrome истинското не връща нищо. */
const FAKE_SR = `(function(){function F(){this.lang="";}
  F.prototype.start=function(){var s=this;s._t=setTimeout(function(){
    s.onresult&&s.onresult({resultIndex:0,results:[{isFinal:false,0:{transcript:"За Данчо"}}]});
    setTimeout(function(){s.onresult&&s.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:"За Данчо, обича риболова"}}]});},300);
  },300);window.__srLang=s.lang;};
  F.prototype.stop=function(){clearTimeout(this._t);};
  window.SpeechRecognition=F;window.webkitSpeechRecognition=F;})()`;
const STUB = `(function(){localStorage.removeItem("__proba");var z=[];function pishi(){localStorage.setItem("__proba",JSON.stringify(z));}
  window.fetch=function(u,o){var e=[];if(o&&o.body instanceof FormData){o.body.forEach(function(v,k){e.push([k,(v instanceof Blob)?("FILE:"+(v.name||"")+":"+v.size):String(v).slice(0,k==="CLAUDE BRIEF"?4000:200)]);});}
    z.push({vid:"fetch",url:String(u),mode:o&&o.mode||"",e:e});pishi();return Promise.resolve({ok:true,json:function(){return Promise.resolve({success:"true"});}});};
  navigator.sendBeacon=function(u,b){b.text().then(function(t){z.push({vid:"beacon",url:String(u),tyalo:JSON.parse(t)});pishi();});return true;};})()`;

(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + path.join(__dirname, "cp-glas"), "--window-size=1366,900", "about:blank"], { stdio: "ignore" });
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
  try {
    await send("Page.enable"); await send("Runtime.enable"); await send("DOM.enable");
    await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
    await send("Network.setBlockedURLs", { urls: ["*buy.stripe.com*", "*plausible.io*"] });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: FAKE_SR });
    const telefon = () => send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await telefon();
    const idi = async url => { const l = waitFor("Page.loadEventFired"); await send("Page.navigate", { url }); await l; await sleep(500); };
    const dnevnik = async () => { await idi(BASE + "/index.html"); return JSON.parse(await evalJS(`localStorage.getItem("__proba")||"[]"`)); };

    /* 1–4) запис, спиране, изпращане */
    await idi(BASE + "/index.html");
    await evalJS(STUB);
    await evalJS(`document.getElementById("fast-text").click()`); await sleep(1000);
    const vid = await evalJS(`(function(){var b=document.getElementById("text-glas");return !b.hidden&&b.offsetParent!==null;})()`);
    ok("„Или го разкажи с глас“ се вижда в отворената форма", vid);
    ok("преди запис плейърът за записа е скрит (не стои празен 0:00)", await evalJS(`document.getElementById("text-glas-play").offsetParent===null`));
    await evalJS(`document.getElementById("text-glas-btn").click()`); await sleep(2600);
    const zap = await evalJS(`(function(){return {v:document.getElementById("text-story").value,b:document.getElementById("text-glas-btn").classList.contains("recording"),l:document.getElementById("text-glas-label").textContent,st:document.getElementById("text-glas-status").textContent,lang:window.__srLang};})()`);
    ok("по време на запис думите се изписват в полето, бутонът е „Спри записа“, езикът е bg-BG", /За Данчо, обича риболова/.test(zap.v) && zap.b && zap.l === "Спри записа" && zap.lang === "bg-BG" && /0:0\d/.test(zap.st), JSON.stringify(zap));
    await evalJS(`document.getElementById("text-glas-btn").click()`); await sleep(1000);
    const sled = await evalJS(`(function(){var p=document.getElementById("text-glas-play"),a=document.getElementById("text-glas-audio");return {p:!p.hidden&&p.offsetParent!==null,src:!!a.getAttribute("src"),l:document.getElementById("text-glas-label").textContent,st:document.getElementById("text-glas-status").textContent};})()`);
    ok("спиране → плейърът със записа излиза, бутонът е „Запиши наново“", sled.p && sled.src && sled.l === "Запиши наново", JSON.stringify(sled));
    await evalJS(`document.getElementById("text-email").value="proba@example.com";document.getElementById("text-consent").checked=true;document.getElementById("text-send").click();`);
    await sleep(2500);
    let z = await dnevnik();
    const nat = z.find(x => x.vid === "fetch" && !/\/ajax\//.test(x.url)), aj = z.find(x => x.vid === "fetch" && /\/ajax\//.test(x.url)), bc = z.find(x => x.vid === "beacon" && /\/brief$/.test(x.url));
    const psn = aj && (aj.e.find(p => p[0] === "Номер на заявка") || [])[1];
    const gl = nat && nat.e.find(p => p[0] === "glasovo");
    ok("гласът тръгва първи, no-cors, в поле glasovo като glasovo-<PSN>.webm (> 1 KB)", !!nat && !!aj && z.indexOf(nat) < z.indexOf(aj) && nat.mode === "no-cors" && !!gl && gl[1].indexOf("FILE:glasovo-" + psn + ".") === 0 && +gl[1].split(":")[2] > 1000, gl ? gl[1] : "няма нативна заявка");
    const brief = aj ? (aj.e.find(p => p[0] === "CLAUDE BRIEF") || [])[1] || "" : "";
    ok("поръчката: „Гласов разказ: ДА“, брифът казва „разказал С ГЛАС“", !!aj && /^ДА — glasovo-/.test((aj.e.find(p => p[0] === "Гласов разказ") || [])[1] || "") && /разказал С ГЛАС/.test(brief) && /Разказ \(автоматичен препис/.test(brief), aj ? (aj.e.find(p => p[0] === "Гласов разказ") || [])[1] : "няма ajax");
    ok("beacon-ът към worker-а носи бележката в разказа", !!bc && /^\[ИМА ГЛАСОВ ЗАПИС — glasovo-/.test(bc.tyalo.razkaz) && /За Данчо, обича риболова/.test(bc.tyalo.razkaz), bc ? bc.tyalo.razkaz.slice(0, 60) : "няма beacon");

    /* 4б) анонимните събития (14.10.2026): отворена форма, запис, поръчка — към /sabitie */
    const sab = z.filter(x => x.vid === "beacon" && /\/sabitie$/.test(x.url)).map(x => x.tyalo.e + (x.tyalo.d ? ":" + x.tyalo.d : ""));
    ok("събития към /sabitie: Order Form Open, Voice Start, Voice Recorded, Order Submitted (+ глас)",
      ["Order Form Open", "Voice Start", "Voice Recorded"].every(e => sab.some(s => s.indexOf(e) === 0)) && sab.some(s => /^Order Submitted:бърза \+ глас/.test(s)), sab.join(" | "));

    /* 5) „Продължи“ по време на запис */
    await evalJS(STUB);
    await evalJS(`document.getElementById("fast-text").click()`); await sleep(1000);
    await evalJS(`document.getElementById("text-glas-btn").click()`); await sleep(2000);
    await evalJS(`document.getElementById("text-email").value="proba@example.com";document.getElementById("text-consent").checked=true;document.getElementById("text-send").click();`);
    await sleep(3500);
    z = await dnevnik();
    const nat5 = z.find(x => x.vid === "fetch" && !/\/ajax\//.test(x.url)), aj5 = z.find(x => x.vid === "fetch" && /\/ajax\//.test(x.url));
    ok("„Продължи“ по време на запис: записът се прибира и пак тръгва с поръчката", !!nat5 && !!(nat5.e.find(p => p[0] === "glasovo")) && !!aj5);

    /* 6) „Чуй 15 секунди“ */
    await evalJS(`localStorage.setItem("pesenta_intro_off","1")`);
    await idi(BASE + "/index.html");
    const h = await evalJS(`(function(){var p=document.querySelector(".hero-proba"),d=document.querySelector(".hero-demo-link"),r=p.getBoundingClientRect();return {p:getComputedStyle(p).display,d:getComputedStyle(d).display,dolu:Math.round(r.bottom),vh:innerHeight};})()`);
    ok("375 px: „Чуй 15 секунди“ се вижда на първия екран, „Чуй примери“ е скрит", h.p === "flex" && h.d === "none" && h.dolu <= h.vh, JSON.stringify(h));
    await evalJS(`document.querySelector(".hero-proba").click()`); await sleep(2500);
    const sv = await evalJS(`(function(){var p=document.querySelector(".hero-proba");var a=[].slice.call(document.querySelectorAll("audio"));return {pr:p.getAttribute("aria-pressed"),pl:p.classList.contains("playing"),h:location.hash};})()`);
    ok("клик → свири (aria-pressed, .playing), без скок към #demo", sv.pr === "true" && sv.pl && sv.h === "", JSON.stringify(sv));
    await evalJS(`document.querySelector(".hero-proba").click()`); await sleep(300);
    ok("втори клик → спира", await evalJS(`document.querySelector(".hero-proba").getAttribute("aria-pressed")`) === "false");
    await evalJS(`document.getElementById("fast-text").click()`); await sleep(900);
    ok("отворена форма → пробата се прибира", await evalJS(`document.querySelector(".hero-proba").hidden`) === true);

    /* 7) #order и ?stil= */
    await idi(BASE + "/index.html");
    await evalJS(`document.querySelector('#ceni a[href="#order"]').click()`); await sleep(1200);
    ok("„Поръчай сега“ в картата с цената отваря формата", await evalJS(`!document.getElementById("text-fields").hidden`));
    await idi(BASE + "/?stil=" + encodeURIComponent("Рок") + "#order"); await sleep(800);
    const st = await evalJS(`(function(){var c=[].filter.call(document.querySelectorAll("#text-style-chips .chip.selected, #text-style-chips-more .chip.selected"),function(){return 1;});return {o:!document.getElementById("text-fields").hidden,s:c.map(function(x){return x.getAttribute("data-value");}).join(",")};})()`);
    ok("./?stil=Рок#order: формата е отворена, „Рок“ е избран", st.o && st.s === "Рок", JSON.stringify(st));
    ok("./?stil=…: „Добави детайли“ се отваря само, за да се види изборът", await evalJS(`document.getElementById("text-detaili").open === true`));
    const doPl = await evalJS(`(function(){document.getElementById("text-detaili").open=false;var a=document.getElementById("text-story").getBoundingClientRect().top,b=document.getElementById("text-send").getBoundingClientRect().top;return Math.round(b-a);})()`);
    ok("от разказа до бутона за плащане при свити детайли — под 1,4 екрана (беше 2 120 px)", doPl < 812 * 1.4, doPl + " px");
    await idi(BASE + "/index.html");
    await evalJS(`document.querySelector('#stilove a.style-chip[href*="stil="]').click()`); await sleep(1200);
    const st2 = await evalJS(`(function(){return {o:!document.getElementById("text-fields").hidden,n:document.querySelectorAll("#text-style-chips .chip.selected, #text-style-chips-more .chip.selected").length,u:location.href};})()`);
    ok("стил от облака на същата страница → без презареждане, формата отворена, стилът избран", st2.o && st2.n === 1, JSON.stringify(st2));

    /* 7б) бележката под постановъчните снимки; поверителността без хоризонтален скрол;
       плаващият бутон се крие при четене надолу и се връща при нагоре (тъчскрийн) */
    ok("под снимките с реакции пише, че са илюстративни", await evalJS(`(function(){var p=document.querySelector(".reakcii-belezhka");return !!p&&/Илюстративни/.test(p.textContent);})()`));
    for (const u of ["/poveritelnost.html", "/en/privacy.html"]) {
      await idi(BASE + u);
      const sw = await evalJS(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
      ok(u + ": без хоризонтален скрол на 375 px", sw <= 0, "+" + sw + " px");
    }
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await idi(BASE + "/podarak-pesen-za-rojden-den.html");
    const fab = async () => evalJS(`(function(){var b=[].filter.call(document.querySelectorAll(".float-contact"),function(x){return getComputedStyle(x).display!=="none";})[0];return b?getComputedStyle(b).opacity:"няма";})()`);
    await evalJS(`window.scrollTo(0,300)`); await sleep(250); await evalJS(`window.scrollTo(0,900)`); await sleep(600);
    const fDolu = await fab();
    await evalJS(`window.scrollTo(0,600)`); await sleep(600);
    const fGore = await fab();
    ok("плаващият бутон: скрит при превъртане надолу, видим при нагоре", fDolu === "0" && fGore === "1", "надолу=" + fDolu + " нагоре=" + fGore);
    await send("Emulation.setTouchEmulationEnabled", { enabled: false });

    await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await idi(BASE + "/index.html");
    ok("1366 px: пробата я няма, „Чуй примери“ е там", await evalJS(`getComputedStyle(document.querySelector(".hero-proba")).display==="none"&&getComputedStyle(document.querySelector(".hero-demo-link")).display!=="none"`));
    const nad = await evalJS(`(function(){var b=document.getElementById("fast-text").getBoundingClientRect();return Math.round(b.bottom);})()`);
    await send("Emulation.setDeviceMetricsOverride", { width: 1366, height: 640, deviceScaleFactor: 1, mobile: false });
    await idi(BASE + "/index.html");
    const nad640 = await evalJS(`(function(){var b=document.getElementById("fast-text").getBoundingClientRect();return {dolu:Math.round(b.bottom),vh:innerHeight};})()`);
    ok("1366×640: „Поръчай песен“ остава над сгъвката и с по-дългото обещание", nad640.dolu <= nad640.vh, JSON.stringify(nad640) + " (768: " + nad + ")");
    ok("конзолата чиста", konzola.length === 0, konzola.join(" | "));
  } catch (e) { ok("пробата стигна до края", false, e.message.slice(0, 200)); }
  try { await send("Browser.close"); } catch (e) {} try { chrome.kill(); } catch (e) {}
  R.forEach(r => console.log("  " + r));
  const f = R.filter(r => r.indexOf("FAIL") === 0).length;
  console.log(f ? "  " + f + " FAIL" : "  всичко минава"); process.exit(f ? 1 : 0);
})();
