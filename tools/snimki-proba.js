/* snimki-proba.js — снимките за обложката в пълната поръчка (23.09.2026).
   node tools/snimki-proba.js [база] [папка за снимка]   (по подразбиране http://localhost:4173)

   Какво пази (телефонен изглед 375 px):
   1) избор на 2 снимки → 2 миниатюри, редът казва „2 снимки, N KB“, бутонът става „Добави още“;
   2) „×“ на първата → остава 1;
   3) избор на още 3 → 4, без предупреждение; после още 30 → таванът е 30 (04.11.2026; беше 3),
      редът казва „взехме първите 26“, бутонът се крие; на 375 px без препълване;
   4) прегледът на стъпка 3 показва „Снимки за обложката 30 ✓“;
   5) изпращане, Worker-ът отказва: към /snimki тръгват групи по 5 (snimka_1..5, после 6..10) и
      след два провала подред спира; нативният POST носи първите 3 файла snimka-<PSN>-1..3.jpg
      (image/jpeg), всеки в свое поле snimka_N — FormSubmit пази по един файл на име на поле
      (проба по имейл, 23.09), полето „Снимки за обложката“ казва колко не са прикачени, брифът
      съдържа бележката, а beacon-ът към worker-а носи snimki: 30;
   5б) Worker-ът приема 2 → AJAX, „ДА — 2, в отделни писма“; 5в) от 7 приема първата група, втората
      не → нативният POST носи snimka_6 и snimka_7 със същите номера, полето казва „5 от 7“;
   6) без снимки: старият път (AJAX, без прикачени) и „Снимки за обложката: не“;
   7) бързата форма на началната: 2 снимки → миниатюри; при изпращане снимките тръгват ПЪРВИ,
      в отделна multipart заявка (no-cors) към нативния ендпойнт (AJAX-ът дава 500 при файл),
      поръчката — по стария AJAX път; полето казва кои не са стигнали през Worker-а (или „в отделни
      писма“, ако са), beacon snimki: 2; от 7 с отказ за втората група — FormSubmit носи 6 и 7; без
      снимки — само AJAX. Записите живеят в localStorage, Stripe е блокиран;
   8) конзолата чиста. Код 1 при FAIL. Нищо не се праща наистина: form.submit, fetch и
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
    window.fetch=function(u,o){if(/\\/snimki$/.test(String(u))){var e=[];o.body.forEach(function(v,k){e.push([k,(v instanceof Blob)?("FILE:"+(v.name||"")+":"+v.size):String(v)]);});window.__snimki=window.__snimki||[];window.__snimki.push(e);var okv=window.__snimkiOk,ok=Array.isArray(okv)?!!okv[window.__snimki.length-1]:!!okv;return Promise.resolve({ok:true,json:function(){return Promise.resolve({ok:ok});}});}window.__fetch={url:String(u),body:o&&o.body?String(o.body):""};return Promise.resolve({ok:true,json:function(){return Promise.resolve({success:"true"});}});};
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
    ok("още 3 → 4, без предупреждение, бутонът остава", s.n === 4 && /^4 снимки,/.test(s.status) && !s.skrit, s.n + " / " + s.status);
    await setFiles(Array.from({ length: 30 }, (_, i) => F(i % 2 ? "cover-habibi-400.jpg" : "cover-tutso-400.jpg"))); await sleep(2500);
    s = await evalJS(SAST);
    ok("още 30 → таван 30, редът предупреждава „взехме първите 26“, бутонът се крие", s.n === 30 && /До 30 снимки — взехме първите 26/.test(s.status) && s.skrit === true, s.n + " / " + s.status);
    await evalJS(`document.getElementById("snimki-box").scrollIntoView({block:"center"})`); await snimka("snimki-trideset", "#snimki-box");
    ok("375 px с 30 миниатюри без препълване", s.sw <= s.cw, s.sw + "/" + s.cw);
    /* 4) прегледът на стъпка 3 */
    await evalJS(`document.getElementById("btn-next").click()`); await sleep(300);
    await evalJS(`document.getElementById("btn-next").click()`); await sleep(300);
    const pregled = await evalJS(`document.body.textContent.replace(/\\s+/g," ")`);
    ok("стъпка 3: прегледът показва „Снимки за обложката 30 ✓“", /Снимки за обложката\s*30 ✓/.test(pregled));
    /* 5) изпращане с прикачени */
    await evalJS(`document.getElementById("cust-name").value="Проба Пробова";document.getElementById("cust-email").value="proba@primer.bg";document.getElementById("consent").checked=true;document.getElementById("btn-next").click();`);
    await sleep(1500);
    const fo = await evalJS(`window.__forma`), br = await evalJS(`window.__brief`);
    const psn = fo && fo.fields["Номер на заявка"];
    ok("Worker-ът отказва → нативният POST носи първите 3 файла snimka-<PSN>-1..3.jpg, image/jpeg, всеки в свое поле snimka_N (FormSubmit пази по един файл на поле)", !!fo && fo.files.length === 3 && fo.files.every((f, i) => f.pole === "snimka_" + (i + 1) && f.name === "snimka-" + psn + "-" + (i + 1) + ".jpg" && f.type === "image/jpeg" && f.size > 1000), fo ? fo.files.map(f => f.pole + "=" + f.name + " " + f.size).join(", ") : "няма форма");
    ok("полето „Снимки за обложката“ казва „30 избрани … първите 3, останалите поискай“; брифът носи бележката", !!fo && /^ДА — 30 избрани; Worker-ът не ги прие — тук са прикачени първите 3, останалите поискай по имейл/.test(fo.fields["Снимки за обложката"] || "") && /30 снимки за обложката/.test(fo.fields["CLAUDE BRIEF"] || ""), fo ? (fo.fields["Снимки за обложката"] || "").slice(0, 90) : "");
    ok("beacon-ът към worker-а носи snimki: 30", !!br && br.snimki === 30 && br.order_no === psn, br ? JSON.stringify({ snimki: br.snimki, order_no: br.order_no }) : "няма beacon");
    ok("формата тръгва към FormSubmit нативно, с _next към благодарим", !!fo && fo.fields._next === "https://pesenta.bg/blagodarim.html" && fo.fields._captcha === "false");
    const sw = await evalJS(`window.__snimki`) || [];
    const poleta = z => z.filter(p => /^snimka_\d+$/.test(p[0])).map(p => +p[0].slice(7)).join(",");
    ok("пълната форма: снимките тръгват първо към Worker-а на групи по 5 (order_no, tip=пълна, obshto=30); след два отказа подред — спира", sw.length === 2 && sw.every(z => (z.find(p => p[0] === "order_no") || [])[1] === psn && (z.find(p => p[0] === "tip") || [])[1] === "пълна" && (z.find(p => p[0] === "obshto") || [])[1] === "30") && poleta(sw[0]) === "1,2,3,4,5" && poleta(sw[1]) === "6,7,8,9,10", sw.map(poleta).join(" | "));
    ok("имената на файловете към Worker-а носят общия номер (snimka-<PSN>-7.jpg)", !!sw[1] && sw[1].some(p => p[0] === "snimka_7" && p[1].indexOf("FILE:snimka-" + psn + "-7.jpg:") === 0), sw[1] && sw[1].map(p => p[1]).join(" ").slice(0, 120));
    /* 5в) от 7 снимки Worker-ът приема първата група и отказва втората → FormSubmit носи 6 и 7 */
    await idi(BASE + "/poruchka.html");
    await evalJS(`localStorage.removeItem("pesenta_draft")`);
    await evalJS(STUB); await evalJS(`window.__snimkiOk=[true,false]`);
    await setFiles(Array.from({ length: 7 }, (_, i) => F(i % 2 ? "cover-habibi-400.jpg" : "cover-tutso-400.jpg")));
    await evalJS(`document.getElementById("btn-next").click()`); await sleep(300);
    await evalJS(`document.getElementById("btn-next").click()`); await sleep(300);
    await evalJS(`document.getElementById("cust-name").value="Проба Пробова";document.getElementById("cust-email").value="proba@primer.bg";document.getElementById("consent").checked=true;document.getElementById("btn-next").click();`);
    await sleep(1200);
    const fo7 = await evalJS(`window.__forma`), sw7 = await evalJS(`window.__snimki`) || [];
    const psn7 = fo7 && fo7.fields["Номер на заявка"];
    ok("от 7: две заявки към Worker-а (1–5 и 6–7)", sw7.length === 2 && poleta(sw7[0]) === "1,2,3,4,5" && poleta(sw7[1]) === "6,7", sw7.map(poleta).join(" | "));
    ok("от 7, втората група отказана → нативният POST носи snimka_6 и snimka_7 със същите номера", !!fo7 && fo7.files.map(f => f.pole + "=" + f.name).join(",") === "snimka_6=snimka-" + psn7 + "-6.jpg,snimka_7=snimka-" + psn7 + "-7.jpg", fo7 ? fo7.files.map(f => f.pole + "=" + f.name).join(",") : "няма форма");
    ok("от 7: полето казва „ДА — 5 от 7 в отделни писма; НЕ стигнаха № 6, 7 (прикачени тук)“", !!fo7 && fo7.fields["Снимки за обложката"] === "ДА — 5 от 7 в отделни писма; НЕ стигнаха № 6, 7 (прикачени тук)", fo7 && fo7.fields["Снимки за обложката"]);
    /* 5б) Worker-ът приема → AJAX път (не зависи от Referer), без нативна форма */
    await idi(BASE + "/poruchka.html");
    await evalJS(`localStorage.removeItem("pesenta_draft")`);
    await evalJS(STUB); await evalJS(`window.__snimkiOk=true`);
    await setFiles([F("cover-tutso-400.jpg"), F("cover-habibi-400.jpg")]);
    await evalJS(`document.getElementById("btn-next").click()`); await sleep(300);
    await evalJS(`document.getElementById("btn-next").click()`); await sleep(300);
    await evalJS(`document.getElementById("cust-name").value="Проба Пробова";document.getElementById("cust-email").value="proba@primer.bg";document.getElementById("consent").checked=true;document.getElementById("btn-next").click();`);
    await sleep(800);
    const fe5 = await evalJS(`window.__fetch`), fo5 = await evalJS(`window.__forma`);
    let t5 = null; try { t5 = JSON.parse(fe5.body); } catch (e) {}
    ok("Worker-ът приема → AJAX към FormSubmit, без нативна форма, „ДА — 2, в отделни писма“", !fo5 && !!fe5 && /formsubmit\.co\/ajax\//.test(fe5.url) && !!t5 && /^ДА — 2, в отделни писма „Снимки за обложката — PSN-/.test(t5["Снимки за обложката"] || ""), fo5 ? "има нативна форма" : (t5 && t5["Снимки за обложката"]));
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
    /* 7) бързата форма на началната: снимките тръгват в отделна заявка към нативния ендпойнт
       ПРЕДИ поръчката. Страницата после навигира към Stripe, затова записите живеят в
       localStorage, а адресът на Stripe е блокиран — четем ги, като се върнем. */
    await send("Network.setBlockedURLs", { urls: ["*buy.stripe.com*", "*/sabitie*"] }); /* не пълни истинските броеве */
    const STUB2 = `(function(){localStorage.removeItem("__proba");var z=[];function pishi(){localStorage.setItem("__proba",JSON.stringify(z));}
      window.fetch=function(u,o){var e=[];if(o&&o.body instanceof FormData){o.body.forEach(function(v,k){e.push([k,(v instanceof Blob)?("FILE:"+(v.name||"")+":"+v.size):String(v).slice(0,k==="CLAUDE BRIEF"?4000:60)]);});}
        z.push({vid:"fetch",url:String(u),mode:o&&o.mode||"",e:e});pishi();if(/\\/snimki$/.test(String(u))){var v=localStorage.getItem("__snimkiOk")||"0",k=z.filter(function(x){return /\\/snimki$/.test(x.url);}).length-1,ok=(v.length>1?v.charAt(k):v)==="1";return Promise.resolve({ok:true,json:function(){return Promise.resolve({ok:ok});}});}return Promise.resolve({ok:true,json:function(){return Promise.resolve({success:"true"});}});};
      navigator.sendBeacon=function(u,b){b.text().then(function(t){z.push({vid:"beacon",url:String(u),tyalo:JSON.parse(t)});pishi();});return true;};})()`;
    const barza = async (sSnimki) => {
      await idi(BASE + "/index.html");
      await evalJS(STUB2);
      await evalJS(`document.getElementById("fast-text").click()`); await sleep(1200);
      if (sSnimki) { const doc = await send("DOM.getDocument", { depth: 1 }); const n = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#text-snimki" }); await send("DOM.setFileInputFiles", { nodeId: n.nodeId, files: Array.isArray(sSnimki) ? sSnimki : [F("cover-tutso-400.jpg"), F("cover-habibi-400.jpg")] }); await sleep(1500); }
      const t = await evalJS(`(function(){return {n:document.querySelectorAll("#text-snimki-preview .snimki-thumb").length,st:document.getElementById("text-snimki-status").textContent,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth};})()`);
      /* имейлът е задължителен от 13.10.2026 — без него формата спира преди изпращане */
      await evalJS(`document.getElementById("text-story").value="Проба: за Данчо, 40 години, обича риболова.";document.getElementById("text-email").value="proba@example.com";document.getElementById("text-consent").checked=true;document.getElementById("text-send").click();`);
      await sleep(2500);
      await idi(BASE + "/index.html");
      const z = JSON.parse(await evalJS(`localStorage.getItem("__proba")||"[]"`));
      return { t, z };
    };
    await evalJS(`localStorage.setItem("__snimkiOk","0")`);
    const b1 = await barza(true);
    ok("началната: 2 снимки → 2 миниатюри, редът брои, 375 px без препълване", b1.t.n === 2 && /^2 снимки, \d+ KB/.test(b1.t.st) && b1.t.sw <= b1.t.cw, b1.t.n + " / " + b1.t.st);
    const sw1 = b1.z.find(x => x.vid === "fetch" && /\/snimki$/.test(x.url));
    const nat = b1.z.find(x => x.vid === "fetch" && /formsubmit\.co\/(?!ajax)/.test(x.url)), aj = b1.z.find(x => x.vid === "fetch" && /\/ajax\//.test(x.url)), bc = b1.z.find(x => x.vid === "beacon" && /\/brief$/.test(x.url));
    const psn2 = aj && (aj.e.find(p => p[0] === "Номер на заявка") || [])[1];
    const fajlove = nat ? nat.e.filter(p => /^snimka_\d+$/.test(p[0])) : [];
    ok("бързата: снимките тръгват първо към Worker-а (/snimki), преди поръчката, с obshto=2", !!sw1 && b1.z.indexOf(sw1) < b1.z.indexOf(aj) && sw1.e.filter(p => /^snimka_\d+$/.test(p[0])).length === 2 && (sw1.e.find(p => p[0] === "order_no") || [])[1] === psn2 && (sw1.e.find(p => p[0] === "obshto") || [])[1] === "2", sw1 ? sw1.e.map(p => p[0]).join(",") : "няма /snimki");
    ok("Worker-ът отказва → резервно: отделна multipart заявка (no-cors) към нативния ендпойнт: snimka_1, snimka_2 + номерът", !!nat && b1.z.indexOf(nat) < b1.z.indexOf(aj) && nat.mode === "no-cors" && fajlove.length === 2 && fajlove.every((p, i) => p[1] === "FILE:snimka-" + psn2 + "-" + (i + 1) + ".jpg:" + p[1].split(":")[2] && +p[1].split(":")[2] > 1000) && (nat.e.find(p => p[0] === "Към заявка") || [])[1] === psn2, nat ? nat.e.map(p => p[0] + "=" + p[1]).join(", ").slice(0, 160) : "няма нативна заявка");
    ok("поръчката тръгва по стария AJAX път: „Снимки за обложката: ДА — 2; НЕ стигнаха през Worker-а № 1, 2“, брифът с бележка", !!aj && /^ДА — 2; НЕ стигнаха през Worker-а № 1, 2/.test((aj.e.find(p => p[0] === "Снимки за обложката") || [])[1] || "") && /2 снимки за обложката/.test((aj.e.find(p => p[0] === "CLAUDE_BRIEF" || p[0] === "CLAUDE BRIEF") || [])[1] || ""), aj ? (aj.e.find(p => p[0] === "Снимки за обложката") || [])[1] : "няма ajax");
    ok("beacon-ът от бързата форма носи snimki: 2", !!bc && bc.tyalo.snimki === 2 && bc.tyalo.order_no === psn2, bc ? JSON.stringify({ snimki: bc.tyalo.snimki }) : "няма beacon");
    await evalJS(`localStorage.setItem("__snimkiOk","1")`);
    const b2 = await barza(true);
    const nat2 = b2.z.find(x => x.vid === "fetch" && /formsubmit\.co\/(?!ajax)/.test(x.url)), sw2 = b2.z.find(x => x.vid === "fetch" && /\/snimki$/.test(x.url)), aj2 = b2.z.find(x => x.vid === "fetch" && /\/ajax\//.test(x.url));
    ok("бързата: Worker-ът приема → без нативна заявка към FormSubmit, поръчката по AJAX с „ДА — 2, в отделни писма“", !!sw2 && !nat2 && !!aj2 && /^ДА — 2, в отделни писма/.test((aj2.e.find(p => p[0] === "Снимки за обложката") || [])[1] || ""), (sw2 ? "snimki " : "") + (nat2 ? "НАТИВНА " : "") + (aj2 ? "ajax" : ""));
    /* от 7: първата група минава, втората — не → FormSubmit носи 6 и 7, полето го казва */
    await evalJS(`localStorage.setItem("__snimkiOk","10")`);
    const b7 = await barza(Array.from({ length: 7 }, (_, i) => F(i % 2 ? "cover-habibi-400.jpg" : "cover-tutso-400.jpg")));
    const sw7b = b7.z.filter(x => x.vid === "fetch" && /\/snimki$/.test(x.url)), nat7 = b7.z.find(x => x.vid === "fetch" && /formsubmit\.co\/(?!ajax)/.test(x.url)), aj7 = b7.z.find(x => x.vid === "fetch" && /\/ajax\//.test(x.url));
    const psn7b = aj7 && (aj7.e.find(p => p[0] === "Номер на заявка") || [])[1];
    const pol = x => x.e.filter(p => /^snimka_\d+$/.test(p[0])).map(p => p[0].slice(7)).join(",");
    ok("бързата от 7: две заявки към Worker-а (1–5, 6–7), FormSubmit носи snimka_6 и snimka_7 с имената им", sw7b.length === 2 && pol(sw7b[0]) === "1,2,3,4,5" && pol(sw7b[1]) === "6,7" && !!nat7 && pol(nat7) === "6,7" && nat7.e.some(p => p[0] === "snimka_7" && p[1].indexOf("FILE:snimka-" + psn7b + "-7.jpg:") === 0), sw7b.map(pol).join(" | ") + " / " + (nat7 ? pol(nat7) : "няма нативна"));
    ok("бързата от 7: полето казва „ДА — 7; 5 в отделни писма …; НЕ стигнаха № 6, 7“", !!aj7 && /^ДА — 7; 5 в отделни писма/.test((aj7.e.find(p => p[0] === "Снимки за обложката") || [])[1] || ""), aj7 && (aj7.e.find(p => p[0] === "Снимки за обложката") || [])[1]);
    await evalJS(`localStorage.removeItem("__snimkiOk")`);
    const b0 = await barza(false);
    const nat0 = b0.z.find(x => x.vid === "fetch" && /formsubmit\.co\/(?!ajax)/.test(x.url)), aj0 = b0.z.find(x => x.vid === "fetch" && /\/ajax\//.test(x.url)), bc0 = b0.z.find(x => x.vid === "beacon" && /\/brief$/.test(x.url));
    ok("началната без снимки: само AJAX, без нативна заявка, „Снимки за обложката: не“, beacon snimki: 0", !nat0 && !!aj0 && (aj0.e.find(p => p[0] === "Снимки за обложката") || [])[1] === "не" && !!bc0 && bc0.tyalo.snimki === 0);
    ok("конзолата чиста", konzola.length === 0, konzola.join(" | "));
  } catch (e) { ok("пробата стигна до края", false, e.message.slice(0, 200)); }
  try { await send("Browser.close"); } catch (e) {} try { chrome.kill(); } catch (e) {}
  R.forEach(r => console.log("  " + r));
  const f = R.filter(r => r.indexOf("FAIL") === 0).length;
  console.log(f ? "  " + f + " FAIL" : "  всичко минава"); process.exit(f ? 1 : 0);
})();
