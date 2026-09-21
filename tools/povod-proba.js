/* povod-proba.js — поводът от връзката стига до формата (21.09.2026).
   node tools/povod-proba.js [база] [папка за снимки]   (по подразбиране http://localhost:4173)

   Какво пази:
   1) статично: всяко ?povod= и ?za= в сайта има ключ в order.js и чип/опция в poruchka.html;
   2) чернова с „Рожден ден“ + идване с ?povod=bebeski → избран е „Бебе“, той е първи,
      останалите са свити зад „Друг повод“ (преди черновата печелеше);
   3) „Друг повод“ показва всички; смяна на повода работи; махнат избор разгъва списъка;
   4) сезонните (?povod=koleda) и страниците за човек (?za=baba → „Баба / Дядо“);
   5) без параметър: черновата се връща, нищо не е свито;
   6) началната: „Поръчай с текст“ отваря формата с разказа ПЪРВИ, фокусът е в него,
      полето е точно под шапката, поводът/стилът/езикът са под него;
   7) конзолата чиста. Код 1 при FAIL. */
const { spawn } = require("child_process");
const http = require("http"), fs = require("fs"), path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9347, BASE = (process.argv[2] || "http://localhost:4173").replace(/\/$/, "");
const KOREN = path.join(__dirname, "..");
const WS = globalThis.WebSocket;
const R = []; const ok = (n, c, e) => R.push((c ? "OK   " : "FAIL ") + n + (e !== undefined ? "  [" + e + "]" : ""));
const getJSON = url => new Promise((res, rej) => http.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  /* 1) статично — от файловете в хранилището */
  const orderJs = fs.readFileSync(path.join(KOREN, "assets/js/order.js"), "utf8");
  const poruchka = fs.readFileSync(path.join(KOREN, "poruchka.html"), "utf8");
  const karta = ime => { const m = orderJs.match(new RegExp("var " + ime + " = \\{([\\s\\S]*?)\\n  \\};")); const o = {}; if (m) m[1].replace(/"([^"]+)":\s*"([^"]+)"/g, (_, k, v) => { o[k] = v; }); return o; };
  const POVOD = karta("POVOD_MAP"), ZA = karta("ZA_MAP");
  const stranici = fs.readdirSync(KOREN).filter(n => n.endsWith(".html")).map(n => n).concat(fs.readdirSync(path.join(KOREN, "novini")).filter(n => n.endsWith(".html")).map(n => "novini/" + n));
  const lipsi = [];
  stranici.forEach(f => {
    const s = fs.readFileSync(path.join(KOREN, f), "utf8");
    (s.match(/poruchka\.html\?[^"#]*/g) || []).forEach(u => {
      const p = new URLSearchParams(u.split("?")[1].replace(/&amp;/g, "&"));
      const pv = p.get("povod"), za = p.get("za");
      if (pv && (!POVOD[pv] || poruchka.indexOf('data-value="' + POVOD[pv] + '"') < 0)) lipsi.push(f + " → povod=" + pv);
      if (za && (!ZA[za] || poruchka.indexOf("<option>" + ZA[za] + "</option>") < 0)) lipsi.push(f + " → za=" + za);
    });
  });
  ok("статично: " + Object.keys(POVOD).length + " повода и " + Object.keys(ZA).length + " души в картите; всяко ?povod=/?za= в сайта има чип/опция", lipsi.length === 0, lipsi.slice(0, 5).join(" | "));
  const bezPovod = fs.readdirSync(KOREN).filter(n => /^podarak-(pesen-za|za)-.*\.html$/.test(n)).filter(n => { const s = fs.readFileSync(path.join(KOREN, n), "utf8"); return !/class="btn btn-primary[^"]*" href="poruchka\.html\?(povod|za)=/.test(s); });
  ok("всяка страница за повод или човек праща повод или човек към формата", bezPovod.length === 0, bezPovod.join(", "));

  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=" + PORT, "--user-data-dir=" + path.join(__dirname, "cp-povod"), "--window-size=1366,900", "about:blank"], { stdio: "ignore" });
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
  await send("Page.enable"); await send("Runtime.enable");
  await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const OUT = process.argv[3] || null;
  const snimka = async ime => { if (!OUT) return; const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, ime + ".png"), Buffer.from(r.data, "base64")); };
  const idi = async url => { const l = waitFor("Page.loadEventFired"); await send("Page.navigate", { url }); await l; await sleep(500); };
  const SAST = `(function(){var g=document.getElementById("occasion-chips"),ch=[].slice.call(g.querySelectorAll(".chip")),b=document.getElementById("occasion-oshte");
    return {izbrani:ch.filter(function(c){return c.classList.contains("selected");}).map(function(c){return c.getAttribute("data-value");}),
      parvi:ch[0].getAttribute("data-value"),vidimi:ch.filter(function(c){return c.offsetParent!==null;}).length,vsichki:ch.length,
      svito:g.classList.contains("svito"),buton:!!b&&!b.hidden&&b.offsetParent!==null,relation:document.getElementById("relation").value};})()`;

  try {
    /* 2) чернова с „Рожден ден“, после идване от страницата за бебе */
    await idi(BASE + "/poruchka.html");
    await evalJS(`localStorage.setItem("pesenta_draft", JSON.stringify({fields:{relation:"Колега"},chips:{"occasion-chips":["Рожден ден"]}}))`);
    await idi(BASE + "/poruchka.html?povod=bebeski");
    let s = await evalJS(SAST);
    await snimka("povod-bebeski");
    ok("чернова „Рожден ден“ + ?povod=bebeski → избран е само „Бебе“", s.izbrani.join(",") === "Бебе", s.izbrani.join(","));
    ok("избраният чип е първи, вижда се само той, „Друг повод“ е на екрана", s.parvi === "Бебе" && s.vidimi === 1 && s.buton && s.svito, "първи=" + s.parvi + " видими=" + s.vidimi + " бутон=" + s.buton);
    ok("човекът от черновата остава („Колега“)", s.relation === "Колега", s.relation);

    /* 3) „Друг повод“ и смяна */
    await evalJS(`document.getElementById("occasion-oshte").click()`); await sleep(100);
    s = await evalJS(SAST);
    ok("„Друг повод“ показва всички " + s.vsichki + " чипа, „Бебе“ остава първи и избран", s.vidimi === s.vsichki && !s.buton && s.parvi === "Бебе" && s.izbrani.join(",") === "Бебе", "видими=" + s.vidimi);
    await evalJS(`document.querySelector('#occasion-chips .chip[data-value="Сватба"]').click()`); await sleep(100);
    s = await evalJS(SAST);
    ok("смяна на повода: избрана е само „Сватба“", s.izbrani.join(",") === "Сватба", s.izbrani.join(","));
    await idi(BASE + "/poruchka.html?povod=godej");
    await evalJS(`document.querySelector('#occasion-chips .chip.selected').click()`); await sleep(100);
    s = await evalJS(SAST);
    ok("махнат избор в свития списък → списъкът се разгъва сам", s.izbrani.length === 0 && s.vidimi === s.vsichki && !s.svito, "видими=" + s.vidimi);

    /* 4) сезонните и страниците за човек */
    await idi(BASE + "/poruchka.html?povod=koleda");
    s = await evalJS(SAST);
    ok("?povod=koleda → „Коледа“, първи и сам", s.izbrani.join(",") === "Коледа" && s.parvi === "Коледа" && s.vidimi === 1, s.izbrani.join(","));
    await idi(BASE + "/poruchka.html?za=baba");
    s = await evalJS(SAST);
    ok("?za=baba → „Баба / Дядо“ (печели пред „Колега“ от черновата); поводите не са свити", s.relation === "Баба / Дядо" && !s.svito && !s.buton && s.vidimi === s.vsichki, s.relation + " видими=" + s.vidimi);

    /* 5) без параметър */
    await idi(BASE + "/poruchka.html");
    s = await evalJS(SAST);
    ok("без параметър: черновата се връща („Коледа“, „Баба / Дядо“), нищо не е свито", s.izbrani.join(",") === "Коледа" && s.relation === "Баба / Дядо" && !s.svito && s.vidimi === s.vsichki, s.izbrani.join(",") + " / " + s.relation);
    await evalJS(`localStorage.removeItem("pesenta_draft")`);

    /* 6) началната: разказът е първи */
    await idi(BASE + "/index.html");
    await evalJS(`document.getElementById("fast-text").click()`); await sleep(1500);
    const n = await evalJS(`(function(){var tf=document.getElementById("text-fields"),p=tf.querySelector(".field"),st=document.getElementById("text-story"),h=document.querySelector(".site-header").getBoundingClientRect(),
      pr=st.closest(".field").getBoundingClientRect(),oc=document.getElementById("text-occasion-chips").getBoundingClientRect(),sty=document.getElementById("text-style-chips").getBoundingClientRect(),lang=document.getElementById("text-language").getBoundingClientRect();
      return {parvoRazkaz:!!p.querySelector("#text-story"),fokus:document.activeElement&&document.activeElement.id,shapka:Math.round(h.bottom),poleTop:Math.round(pr.top),poleBottom:Math.round(pr.bottom),povodTop:Math.round(oc.top),stilTop:Math.round(sty.top),ezikTop:Math.round(lang.top),vis:window.innerHeight,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth};})()`);
    await snimka("nachalna-forma");
    ok("началната: първото поле във формата е разказът, фокусът е в него", n.parvoRazkaz && n.fokus === "text-story", "фокус=" + n.fokus);
    ok("разказът е под шапката и на екрана", n.poleTop >= n.shapka && n.poleTop < n.vis / 2, "шапка=" + n.shapka + " поле=" + n.poleTop + "–" + n.poleBottom + " екран=" + n.vis);
    ok("поводът, стилът и езикът са ПОД разказа, по този ред", n.povodTop > n.poleBottom - 1 && n.stilTop > n.povodTop && n.ezikTop > n.stilTop, "повод=" + n.povodTop + " стил=" + n.stilTop + " език=" + n.ezikTop);
    ok("началната на 375 px без препълване", n.sw <= n.cw, n.sw + "/" + n.cw);

    ok("конзолата чиста", konzola.length === 0, konzola.join(" | "));
  } catch (e) { ok("пробата стигна до края", false, e.message.slice(0, 200)); }
  try { await send("Browser.close"); } catch (e) {} try { chrome.kill(); } catch (e) {}
  R.forEach(r => console.log("  " + r));
  const f = R.filter(r => r.indexOf("FAIL") === 0).length;
  console.log(f ? "  " + f + " FAIL" : "  всичко минава"); process.exit(f ? 1 : 0);
})();
