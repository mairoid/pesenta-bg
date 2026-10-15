/* vaucher-sayt-proba.js — „Ваучер за песен“ откъм сайта (15.10.2026).
   node tools/vaucher-sayt-proba.js [база]   (по подразбиране http://localhost:4173; сървър: node tools/server.js)

   Какво пази (на 375 px и на 1366 px):
   1) vaucher.html се зарежда без грешки в конзолата и без хоризонтален скрол;
   2) валидацията: празни полета, дълго послание, лош имейл, без съгласие, фактура без име —
      всяко спира със свое съобщение, нищо не тръгва; броячът брои; прегледът показва куплета;
   3) празна връзка за плащане (payments.js → vaucher: "") → „Плащането за ваучери се включва
      съвсем скоро“, без beacon и без пренасочване;
   4) с подменена връзка → beacon към /vaucher/nov с правилното тяло (ref VCH-ГГММДД-NNNN,
      ot_kogo, za_kogo, poslanie, email, faktura), text/plain, после пренасочване към връзката с
      client_reference_id=<ref>, prefilled_email, locale=bg; събитие „Voucher Checkout“;
   5) index.html?kod=ivanka-serenada-ab2cd → формата е отворена, кодът попълнен и проверен,
      адресът е изчистен (без kod, с #order), „Подарък за … от … — песента е платена“, фактурата и
      плащането са скрити, бутонът е „Изпрати разказа“; другите параметри (?stil=) остават;
   6) изпращане с код → ПЪРВО POST /vaucher/izpolzvai {kod, order_no, brief}, после известието
      (FormSubmit, „ПЛАТЕНО С ВАУЧЕР“), после blagodarim.html?vaucher=1; без /brief beacon, без Stripe;
   7) 409 при осребряване → съобщение, нищо друго не тръгва, формата се връща към плащане;
   8) ръчен код: „Имаш код за подарък?“ → поле → „Провери“; причините nyama/izpolzvan/otmenen/429 —
      понятни съобщения; имената от Worker-а влизат като текст, не като HTML;
   9) пътят БЕЗ код е старият: beacon към /brief със същите полета, FormSubmit „ОЧАКВА ПЛАЩАНЕ“,
      Stripe адресът се строи както преди (pesen + client_reference_id + prefilled_email + locale=bg).
   Нищо не се праща наистина: fetch и sendBeacon са подменени ПРЕДИ скриптовете на страницата,
   Stripe, FormSubmit, Worker-ът, /sabitie и анализите се спират в Fetch.requestPaused (setBlockedURLs
   сам не спира навигация на главния прозорец) и накрая се проверява, че до тях не е стигнало нищо.
   Код 1 при FAIL. */
const { spawn } = require("child_process");
const http = require("http"), path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9355, BASE = (process.argv[2] || "http://localhost:4173").replace(/\/$/, "");
const WS = globalThis.WebSocket;
const R = []; const ok = (n, c, e) => R.push((c ? "OK   " : "FAIL ") + n + (e !== undefined ? "  [" + e + "]" : ""));
const getJSON = url => new Promise((res, rej) => http.get(url, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on("error", rej));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const STRIPE_PESEN = "https://buy.stripe.com/8x25kEf5e92r9h81Rh9IQ00";
const STRIPE_VAUCHER = "https://buy.stripe.com/test_vaucher_proba";

/* Подмяната: дневник и настройки в localStorage (оцеляват при смяна на страницата в същия
   произход). __proba_cfg казва какво да „отговори“ Worker-ът. */
const STUB = `(function(){
  function log(o){var z;try{z=JSON.parse(localStorage.getItem("__proba")||"[]");}catch(e){z=[];}o.t=Date.now();z.push(o);try{localStorage.setItem("__proba",JSON.stringify(z));}catch(e){}}
  function cfg(){try{return JSON.parse(localStorage.getItem("__proba_cfg")||"{}");}catch(e){return {};}}
  window.fetch=function(u,o){u=String(u);var c=cfg(),e=[],b=o&&o.body;
    if(b instanceof FormData){b.forEach(function(v,k){e.push([k,(v instanceof Blob)?("FILE:"+(v.name||"")+":"+v.size):String(v).slice(0,k==="CLAUDE BRIEF"?4000:300)]);});}
    var h=o&&o.headers||{};
    log({vid:"fetch",url:u,method:(o&&o.method)||"GET",mode:o&&o.mode||"",e:e,tyalo:typeof b==="string"?b:null,ct:h["Content-Type"]||""});
    var st=200,d={success:"true"};
    if(/\\/vaucher\\/proverka/.test(u)){st=c.proverkaSt||200;d=c.proverka||{ok:true,za_kogo:"Иванка",ot_kogo:"Колегите"};}
    if(/\\/vaucher\\/izpolzvai/.test(u)){st=c.izpolzvaiSt||200;d=c.izpolzvai||{ok:true};}
    return Promise.resolve({ok:st>=200&&st<300,status:st,json:function(){return Promise.resolve(d);}});};
  navigator.sendBeacon=function(u,b){var url=String(u),tip=b&&b.type||"";
    b.text().then(function(t){var j=null;try{j=JSON.parse(t);}catch(e){}log({vid:"beacon",url:url,tip:tip,tyalo:j,sur:j?null:t});});return true;};
})();`;

(async () => {
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + path.join(__dirname, "cp-vaucher"), "--window-size=1366,900", "about:blank"], { stdio: "ignore" });
  let targets = null; for (let i = 0; i < 50 && !targets; i++) { await sleep(200); try { targets = await getJSON("http://localhost:" + PORT + "/json/list"); } catch (e) {} }
  const page = targets.find(t => t.type === "page"); const ws = new WS(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const waiters = []; const konzola = []; let navs = [];
  const BLOK = ["*stripe.com*", "*stripe.network*", "*plausible.io*", "*/sabitie*", "*formsubmit.co*", "*workers.dev*", "*cloudflareinsights.com*"];
  const BLOK_RE = /stripe\.(com|network)|plausible\.io|\/sabitie|formsubmit\.co|workers\.dev|cloudflareinsights\.com/;
  const blokirani = [], stignali = [];
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; } if (!m.method) return;
    if (m.method === "Runtime.exceptionThrown") konzola.push("exception: " + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text).slice(0, 160));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") konzola.push("console.error: " + m.params.args.map(a => a.value || a.description).join(" ").slice(0, 160));
    if (m.method === "Network.requestWillBeSent" && m.params.type === "Document") navs.push(m.params.request.url);
    /* Блокираното се спира тук, в Fetch: Network.setBlockedURLs НЕ спира навигацията на
       главния прозорец (15.10.2026 — страницата на Stripe се зареди и в нея гърмяха скриптове). */
    if (m.method === "Fetch.requestPaused") { blokirani.push(m.params.request.url); send("Fetch.failRequest", { requestId: m.params.requestId, errorReason: "BlockedByClient" }).catch(() => {}); }
    if (m.method === "Network.responseReceived" && BLOK_RE.test(m.params.response.url)) stignali.push(m.params.response.url);
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].method === m.method) { waiters[i].res(m.params); waiters.splice(i, 1); } };
  const send = (method, params) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const waitFor = method => new Promise(res => waiters.push({ method, res }));
  const evalJS = async expr => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error("eval: " + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  const idi = async url => { const l = waitFor("Page.loadEventFired"); await send("Page.navigate", { url }); await l; await sleep(500); };
  /* дневникът се чете от страница на сайта — след пренасочване към Stripe сме на страница с грешка */
  const dnevnik = async () => { const u = await evalJS("location.href"); if (u.indexOf(BASE) !== 0) await idi(BASE + "/vaucher-blagodarim.html"); return JSON.parse(await evalJS(`localStorage.getItem("__proba")||"[]"`)); };
  const nulirai = async (cfg) => { await evalJS(`localStorage.removeItem("__proba");localStorage.setItem("__proba_cfg",${JSON.stringify(JSON.stringify(cfg || {}))});`); navs = []; };

  try {
    await send("Page.enable"); await send("Runtime.enable"); await send("DOM.enable");
    await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
    await send("Network.setBlockedURLs", { urls: BLOK });
    await send("Fetch.enable", { patterns: BLOK.map(u => ({ urlPattern: u, requestStage: "Request" })) });
    await send("Page.addScriptToEvaluateOnNewDocument", { source: STUB });

    for (const [w, h, mob] of [[375, 812, true], [1366, 768, false]]) {
      const S = w + " px: ";
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: mob });

      /* 1) зареждане */
      const k0 = konzola.length;
      await idi(BASE + "/vaucher.html"); await nulirai();
      await idi(BASE + "/vaucher.html"); navs = [];
      const zar =await evalJS(`(function(){return {f:!!document.getElementById("vaucher-forma"),t:document.title,can:(document.querySelector('link[rel=canonical]')||{}).href,
        og:(document.querySelector('meta[property="og:url"]')||{}).content,hl:document.querySelectorAll('link[hreflang]').length,sw:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        b:document.getElementById("v-send").textContent.trim(),cena:/19,90/.test(document.querySelector(".vaucher-cena").textContent),
        us:!!document.querySelector('.consent a[href="usloviya.html"]'),pov:!!document.querySelector('.consent a[href="poveritelnost.html"]'),
        faq:document.querySelectorAll("#vaprosi .faq-item").length,max:[document.getElementById("v-ot").maxLength,document.getElementById("v-za").maxLength,document.getElementById("v-poslanie").maxLength].join("/")};})()`);
      ok(S + "vaucher.html се зарежда: canonical, og:url, без hreflang, бутонът „Към плащане — 19,90 €“, цена, връзки към условията",
        zar.f && zar.can === "https://pesenta.bg/vaucher.html" && zar.og === zar.can && zar.hl === 0 && zar.b === "Към плащане — 19,90 €" && zar.cena && zar.us && zar.pov && zar.faq >= 4, JSON.stringify(zar));
      ok(S + "без хоризонтален скрол", zar.sw <= 0, "+" + zar.sw + " px");
      ok(S + "ограниченията: 60 / 60 / 300 знака", zar.max === "60/60/300", zar.max);
      ok(S + "конзолата чиста след зареждане", konzola.length === k0, konzola.slice(k0).join(" | "));

      /* 2) валидация */
      const greshka = async (pole, ochakvano) => {
        await evalJS(`document.getElementById("v-send").click()`); await sleep(200);
        const g = await evalJS(`(function(){var e=document.getElementById("v-error");return {t:e.textContent,s:e.classList.contains("show"),inv:${pole ? `document.getElementById("${pole}").classList.contains("invalid")` : "true"}};})()`);
        return { ok: g.s && ochakvano.test(g.t) && g.inv, t: g.t };
      };
      const vav = (id, v) => evalJS(`(function(){var e=document.getElementById("${id}");e.value=${JSON.stringify(v)};e.dispatchEvent(new Event("input",{bubbles:true}));})()`);
      let g = await greshka("v-ot", /от кого/i); ok(S + "празно „От кого“ → съобщение, полето е червено", g.ok, g.t);
      await vav("v-ot", "Колегите от офиса");
      g = await greshka("v-za", /за кого/i); ok(S + "празно „За кого“ → съобщение", g.ok, g.t);
      await vav("v-za", "Кумата");
      g = await greshka("v-poslanie", /послание/i); ok(S + "празно послание → съобщение", g.ok, g.t);
      /* maxlength пази писането; поставен по-дълъг текст (програмно) пак се спира */
      await vav("v-poslanie", "а".repeat(301));
      g = await greshka("v-poslanie", /до 300 знака/); ok(S + "послание над 300 знака → съобщение", g.ok, g.t);
      /* 9 реда с интервали около тях → 9 (както брои Worker-ът); купчина празни редове = един */
      await vav("v-poslanie", " ред \n".repeat(9));
      g = await greshka("v-poslanie", /до 8 реда — сега са 9\./); ok(S + "послание с 9 реда → съобщение (Worker-ът брои до 8)", g.ok, g.t);
      await vav("v-poslanie", "ред\n\n\n\n\nред\n".repeat(4));
      g = await greshka("v-poslanie", /до 8 реда — сега са 12\./); ok(S + "купчините празни редове се броят като един (както в Worker-а)", g.ok, g.t);
      await vav("v-poslanie", "Честит празник,\nкумице мила —\nразкажи ни историята си.");
      const br = await evalJS(`document.getElementById("v-broyach").textContent`);
      ok(S + "броячът брои знаците", br === "54 / 300", br);
      const pr = await evalJS(`(function(){return {za:document.getElementById("v-pregled-za").textContent,ot:document.getElementById("v-pregled-ot").textContent,r:[].map.call(document.querySelectorAll("#v-pregled-tekst p"),function(p){return p.textContent;})};})()`);
      ok(S + "прегледът: „За Кумата“, три стиха, „От Колегите от офиса“", pr.za === "За Кумата" && pr.ot === "От Колегите от офиса" && pr.r.length === 3 && pr.r[1] === "кумице мила —", JSON.stringify(pr));
      await vav("v-email", "lose@");
      g = await greshka("v-email", /имейл/i); ok(S + "лош имейл → съобщение", g.ok, g.t);
      await vav("v-email", "proba@example.com");
      g = await greshka(null, /съгласието/); ok(S + "без съгласие → съобщение", g.ok, g.t);
      await evalJS(`document.getElementById("v-consent").checked=true;document.getElementById("v-invoice").click();`);
      const invOtv = await evalJS(`!document.getElementById("v-invoice-fields").hidden`);
      g = await greshka(null, /фактура/i); ok(S + "фактура: полетата се отварят; без име и адрес → съобщение", invOtv && g.ok, g.t);
      await vav("v-inv-name", "Примерна фирма ЕООД"); await vav("v-inv-addr", "гр. Примерно, ул. Тестова");
      await vav("v-inv-eik", "12-34");
      g = await greshka("v-inv-eik", /ЕИК/); ok(S + "ЕИК с неверни знаци → съобщение (Worker-ът би го отказал)", g.ok, g.t);
      await vav("v-inv-eik", "");

      /* 3) празна връзка — изпразва се тук, защото от 15.10.2026 в payments.js стои истинската */
      await evalJS(`window.PESENTA_PAYMENTS.paymentLinks.vaucher=""`);
      let z = await dnevnik();
      ok(S + "докато валидацията спира, нищо не тръгва (няма beacon към /vaucher/nov, няма пренасочване)", !z.some(x => /\/vaucher\/nov/.test(x.url)) && navs.length === 0, z.length + " записа, " + navs.join(","));
      await evalJS(`document.getElementById("v-send").click()`); await sleep(800);
      const skoro = await evalJS(`(function(){var e=document.getElementById("v-error");return {t:e.textContent,s:e.className,b:document.getElementById("v-send").disabled,u:location.href};})()`);
      z = await dnevnik();
      ok(S + "празна връзка → „Плащането за ваучери се включва съвсем скоро“, бутонът не се заключва",
        /включва съвсем скоро/.test(skoro.t) && /skoro/.test(skoro.s) && !skoro.b, JSON.stringify(skoro).slice(0, 160));
      ok(S + "празна връзка → без beacon и без пренасочване", !z.some(x => /\/vaucher\/nov/.test(x.url)) && navs.length === 0 && /vaucher\.html$/.test(skoro.u), "beacon=" + z.filter(x => x.vid === "beacon").length + " навигации=" + navs.length);

      /* 4) с подменена връзка */
      await evalJS(`window.PESENTA_PAYMENTS.paymentLinks.vaucher=${JSON.stringify(STRIPE_VAUCHER)}`);
      await evalJS(`document.getElementById("v-send").click()`); await sleep(1500);
      const navV = navs.slice();
      z = await dnevnik();
      const bn = z.find(x => x.vid === "beacon" && /\/vaucher\/nov$/.test(x.url));
      const ty = bn && bn.tyalo || {};
      ok(S + "beacon към <worker>/vaucher/nov, text/plain", !!bn && bn.url === "https://pesenta-nap.pesenta-nap.workers.dev/vaucher/nov" && /^text\/plain/.test(bn.tip), bn ? bn.url + " " + bn.tip : "няма");
      ok(S + "тялото: ref VCH-ГГММДД-NNNN, ot_kogo, za_kogo, poslanie, email, faktura{ime,adres}",
        /^VCH-\d{6}-\d{4}$/.test(ty.ref || "") && ty.ot_kogo === "Колегите от офиса" && ty.za_kogo === "Кумата" && ty.poslanie === "Честит празник,\nкумице мила —\nразкажи ни историята си." &&
        ty.email === "proba@example.com" && ty.faktura && ty.faktura.ime === "Примерна фирма ЕООД" && ty.faktura.adres === "гр. Примерно, ул. Тестова" && !("eik" in ty.faktura) &&
        Object.keys(ty).sort().join(",") === "email,faktura,ot_kogo,poslanie,ref,za_kogo", JSON.stringify(ty).slice(0, 220));
      const ochak = STRIPE_VAUCHER + "?client_reference_id=" + encodeURIComponent(ty.ref || "") + "&prefilled_email=" + encodeURIComponent("proba@example.com") + "&locale=bg";
      ok(S + "пренасочване към връзката за ваучер с client_reference_id, prefilled_email, locale=bg", navV.length === 1 && navV[0] === ochak, navV.join(" , "));
      ok(S + "събитие „Voucher Checkout“ (през psnSabitie)", z.some(x => x.vid === "beacon" && /\/sabitie$/.test(x.url) && x.tyalo && x.tyalo.e === "Voucher Checkout"));
      ok(S + "към FormSubmit от vaucher.html нищо не тръгва", !z.some(x => /formsubmit/.test(x.url)));
    }

    /* 5–8) кодът в бързата форма (375 px и 1366 px) */
    for (const [w, h, mob] of [[375, 812, true], [1366, 768, false]]) {
      const S = w + " px: ";
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: mob });
      const k0 = konzola.length;
      await idi(BASE + "/index.html"); await nulirai();
      await idi(BASE + "/?kod=ivanka-serenada-ab2cd"); await sleep(900);
      const st = await evalJS(`(function(){function vid(id){var e=document.getElementById(id);return !!e&&!e.hidden&&e.offsetParent!==null;}
        var b=document.getElementById("text-vaucher-banner");
        return {otv:!document.getElementById("text-fields").hidden,kod:document.getElementById("text-kod").value,ro:document.getElementById("text-kod").readOnly,
          href:location.href,ban:vid("text-vaucher-banner")?document.getElementById("text-vaucher-banner-tekst").textContent:"",
          inv:vid("text-invoice-row"),invF:vid("text-invoice-fields"),pay:vid("text-pay-hint"),vh:vid("text-vaucher-hint"),btn:document.getElementById("text-send").textContent.trim(),
          msg:document.getElementById("text-kod-msg").textContent,kodVid:vid("text-kod-pole"),tog:vid("text-kod-toggle"),mahni:vid("text-kod-mahni"),
          sPl:vid("text-consent-plashtane"),sVa:vid("text-consent-vaucher"),
          sw:document.documentElement.scrollWidth-document.documentElement.clientWidth};})()`);
      let z = await dnevnik();
      const prov = z.find(x => x.vid === "fetch" && /\/vaucher\/proverka/.test(x.url));
      ok(S + "?kod= → формата е отворена, кодът попълнен (главни), проверен с GET /vaucher/proverka?kod=",
        st.otv && st.kod === "IVANKA-SERENADA-AB2CD" && st.ro && st.kodVid && !!prov && prov.url === "https://pesenta-nap.pesenta-nap.workers.dev/vaucher/proverka?kod=IVANKA-SERENADA-AB2CD" && prov.method === "GET", JSON.stringify({ kod: st.kod, url: prov && prov.url }));
      ok(S + "адресът е изчистен: без kod, с #order", st.href === BASE + "/#order" && !/ivanka/i.test(st.href), st.href);
      ok(S + "„Подарък за Иванка от Колегите — песента е платена“ горе и при кода", st.ban === "Подарък за Иванка от Колегите — песента е платена" && st.msg === st.ban, st.ban + " / " + st.msg);
      ok(S + "фактурата и плащането са скрити, бутонът е „Изпрати разказа“, „Махни кода“ е там",
        !st.inv && !st.invF && !st.pay && st.vh && st.btn === "Изпрати разказа" && st.mahni && !st.tog, JSON.stringify({ inv: st.inv, pay: st.pay, vh: st.vh, btn: st.btn }));
      ok(S + "съгласието: текстът за плащане е скрит, този за ваучера — видим", !st.sPl && st.sVa, JSON.stringify({ sPl: st.sPl, sVa: st.sVa }));
      ok(S + "index.html с отворен код — без хоризонтален скрол", st.sw <= 0, "+" + st.sw + " px");

      /* 6) изпращане с код */
      await evalJS(`localStorage.removeItem("__proba")`); navs = [];
      await evalJS(`document.getElementById("text-story").value="За мен е — обичам планината и кафето сутрин.";document.getElementById("text-email").value="poluchatel@example.com";document.getElementById("text-consent").checked=true;document.getElementById("text-send").click();`);
      await sleep(2500);
      const navI = navs.slice();
      z = await dnevnik();
      const iz = z.findIndex(x => x.vid === "fetch" && /\/vaucher\/izpolzvai$/.test(x.url));
      const fs_ = z.findIndex(x => x.vid === "fetch" && /formsubmit\.co\/ajax\//.test(x.url));
      const izT = iz > -1 ? JSON.parse(z[iz].tyalo || "{}") : {};
      ok(S + "ПЪРВО POST /vaucher/izpolzvai (text/plain JSON {kod, order_no, brief}), после известието",
        iz > -1 && fs_ > iz && z[iz].method === "POST" && /^text\/plain/.test(z[iz].ct) && izT.kod === "IVANKA-SERENADA-AB2CD" && /^PSN-\d{6}-\d{4}$/.test(izT.order_no || "") && izT.brief && izT.brief.order_no === izT.order_no,
        "izpolzvai@" + iz + " formsubmit@" + fs_ + " " + JSON.stringify({ kod: izT.kod, order_no: izT.order_no }));
      const br = izT.brief || {};
      ok(S + "брифът в izpolzvai има полетата на /brief и казва „ПЛАТЕНО С ВАУЧЕР“",
        ["order_no", "vid", "povod", "event_date", "stilove", "ezik", "razkaz", "email", "snimki", "landing", "ref_parvi", "ref_posleden"].every(k => k in br) && /^\[ПЛАТЕНО С ВАУЧЕР IVANKA-SERENADA-AB2CD/.test(br.razkaz || "") && /планината/.test(br.razkaz) && br.email === "poluchatel@example.com", (br.razkaz || "").slice(0, 80));
      const ajE = fs_ > -1 ? z[fs_].e : [];
      const pole = k => (ajE.find(p => p[0] === k) || [])[1] || "";
      ok(S + "известието (FormSubmit): тема и състояние „ПЛАТЕНО С ВАУЧЕР“, бележка в брифа, фактура „не“",
        /ПЛАТЕНО С ВАУЧЕР IVANKA-SERENADA-AB2CD/.test(pole("_subject")) && /^ПЛАТЕНО С ВАУЧЕР/.test(pole("Състояние")) && /СЪСТОЯНИЕ: ПЛАТЕНО С ВАУЧЕР/.test(pole("CLAUDE BRIEF")) && /^не — платено с ваучер/.test(pole("ФАКТУРА")) && /Иванка/.test(pole("Ваучер")),
        pole("_subject"));
      ok(S + "с код — без отделен beacon към /brief", !z.some(x => x.vid === "beacon" && /\/brief$/.test(x.url)));
      ok(S + "с код — към blagodarim.html?vaucher=1, без Stripe", navI.length === 1 && navI[0] === BASE + "/blagodarim.html?vaucher=1" && !navI.some(u => /stripe/.test(u)), navI.join(" , "));
      ok(S + "събитие „Voucher Redeem“", z.some(x => x.vid === "beacon" && /\/sabitie$/.test(x.url) && x.tyalo && x.tyalo.e === "Voucher Redeem"));

      /* 7) 409 при осребряване */
      await idi(BASE + "/index.html"); await nulirai({ izpolzvaiSt: 409, izpolzvai: { ok: false, prichina: "izpolzvan" } });
      await idi(BASE + "/?kod=ivanka-serenada-ab2cd"); await sleep(900);
      await evalJS(`localStorage.removeItem("__proba")`); navs = [];
      await evalJS(`document.getElementById("text-story").value="Разказ за проба.";document.getElementById("text-email").value="poluchatel@example.com";document.getElementById("text-consent").checked=true;document.getElementById("text-send").click();`);
      await sleep(1500);
      const s409 = await evalJS(`(function(){var e=document.getElementById("text-error");return {t:e.textContent,s:e.classList.contains("show"),b:document.getElementById("text-send").textContent.trim(),d:document.getElementById("text-send").disabled,u:location.href,inv:document.getElementById("text-invoice-row").offsetParent!==null};})()`);
      z = await dnevnik();
      ok(S + "409 → „вече е използван … Разказът ти не е изпратен“", s409.s && /вече е използван/.test(s409.t) && /не е изпратен/.test(s409.t), s409.t.slice(0, 120));
      ok(S + "409 → нищо друго не тръгва (само izpolzvai; без FormSubmit, без /brief, без навигация)",
        z.filter(x => x.vid === "fetch").length === 1 && /\/vaucher\/izpolzvai$/.test(z.find(x => x.vid === "fetch").url) && !z.some(x => x.vid === "beacon" && /\/brief$/.test(x.url)) && navs.length === 0,
        z.map(x => x.vid + ":" + x.url.replace(/^https?:\/\/[^/]+/, "")).join(" | "));
      ok(S + "409 → формата се връща към плащане (бутонът, фактурата)", s409.b === "Продължи към плащане · 19,90 €" && !s409.d && s409.inv, JSON.stringify(s409).slice(0, 160));
      ok(S + "конзолата чиста в бързата форма", konzola.length === k0, konzola.slice(k0).join(" | "));
    }

    /* 8) ръчно въвеждане и причините (375 px) */
    await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    const prichini = [
      [{ proverka: { ok: false, prichina: "nyama" } }, /Няма такъв код/],
      [{ proverka: { ok: false, prichina: "izpolzvan" } }, /вече е използван/],
      [{ proverka: { ok: false, prichina: "otmenen" } }, /отменен/],
      [{ proverkaSt: 429, proverka: { ok: false, prichina: "mnogo_opiti" } }, /Много опити/]
    ];
    for (const [cfg, re] of prichini) {
      await idi(BASE + "/index.html"); await nulirai(cfg); await idi(BASE + "/index.html");
      await evalJS(`document.getElementById("fast-text").click()`); await sleep(700);
      const pred = await evalJS(`({tog:document.getElementById("text-kod-toggle").offsetParent!==null,pole:document.getElementById("text-kod-pole").hidden})`);
      await evalJS(`document.getElementById("text-kod-toggle").click();document.getElementById("text-kod").value="  abc-pesen-x7k9q ";document.getElementById("text-kod-proveri").click();`);
      await sleep(500);
      const r = await evalJS(`(function(){var m=document.getElementById("text-kod-msg");return {t:m.textContent,c:m.className,b:document.getElementById("text-send").textContent.trim(),pay:document.getElementById("text-pay-hint").offsetParent!==null,ban:document.getElementById("text-vaucher-banner").hidden,v:document.getElementById("text-kod").value};})()`);
      const z = await dnevnik();
      const pv = z.find(x => /\/vaucher\/proverka/.test(x.url));
      ok("ръчен код, „" + (cfg.proverka.prichina) + "“ → „" + re.source + "“, плащането остава", pred.tog && pred.pole && re.test(r.t) && /err/.test(r.c) && r.b === "Продължи към плащане · 19,90 €" && r.pay && r.ban && !!pv && /kod=ABC-PESEN-X7K9Q$/.test(pv.url), r.t.slice(0, 90) + " | " + (pv ? pv.url.split("?")[1] : "без заявка"));
    }
    /* празен и с кирилица */
    await idi(BASE + "/index.html"); await nulirai(); await idi(BASE + "/index.html");
    await evalJS(`document.getElementById("fast-text").click()`); await sleep(600);
    await evalJS(`document.getElementById("text-kod-toggle").click();document.getElementById("text-kod-proveri").click();`); await sleep(200);
    const prazen = await evalJS(`document.getElementById("text-kod-msg").textContent`);
    await evalJS(`document.getElementById("text-kod").value="ИВАНКА-ПЕСЕН";document.getElementById("text-kod-proveri").click();`); await sleep(200);
    const kir = await evalJS(`document.getElementById("text-kod-msg").textContent`);
    let z = await dnevnik();
    ok("празен код и код на кирилица → съобщение, без заявка към Worker-а", /Напиши кода/.test(prazen) && /латински/.test(kir) && !z.some(x => /\/vaucher\//.test(x.url)), prazen + " | " + kir);
    /* имената идват като текст, не HTML; „Махни кода“ връща плащането */
    await nulirai({ proverka: { ok: true, za_kogo: "<img src=x onerror=window.__xss=1>", ot_kogo: "Колегите & Co" } });
    await evalJS(`document.getElementById("text-kod").value="abc-pesen-x7k9q";document.getElementById("text-kod-proveri").click();`); await sleep(500);
    const xss = await evalJS(`({t:document.getElementById("text-vaucher-banner-tekst").textContent,img:document.querySelectorAll("#text-vaucher-banner img, #text-kod-msg img").length,x:!!window.__xss})`);
    ok("имената от Worker-а се показват като текст (без HTML)", xss.t === "Подарък за <img src=x onerror=window.__xss=1> от Колегите & Co — песента е платена" && xss.img === 0 && !xss.x, xss.t);
    await evalJS(`document.getElementById("text-kod-mahni").click()`); await sleep(200);
    const mahn = await evalJS(`({b:document.getElementById("text-send").textContent.trim(),inv:document.getElementById("text-invoice-row").offsetParent!==null,ban:document.getElementById("text-vaucher-banner").hidden,v:document.getElementById("text-kod").value,ro:document.getElementById("text-kod").readOnly})`);
    ok("„Махни кода“ → обратно към плащане, банерът изчезва", mahn.b === "Продължи към плащане · 19,90 €" && mahn.inv && mahn.ban && mahn.v === "" && !mahn.ro, JSON.stringify(mahn));
    /* ?kod= с други параметри: те остават, kod излиза */
    await idi(BASE + "/?stil=" + encodeURIComponent("Рок") + "&kod=ivanka-serenada-ab2cd"); await sleep(900);
    const sp = await evalJS(`({h:location.href,s:[].map.call(document.querySelectorAll("#text-style-chips .chip.selected, #text-style-chips-more .chip.selected"),function(c){return c.getAttribute("data-value");}).join(","),k:document.getElementById("text-kod").value})`);
    ok("?stil=Рок&kod=… → стилът е избран, остава ?stil=, kod излиза от адреса", sp.s === "Рок" && sp.h === BASE + "/?stil=%D0%A0%D0%BE%D0%BA#order" && sp.k === "IVANKA-SERENADA-AB2CD", sp.h);
    /* грешен код от връзката → видимо горе, не само долу при полето */
    await idi(BASE + "/index.html"); await nulirai({ proverka: { ok: false, prichina: "izpolzvan" } });
    await idi(BASE + "/?kod=ivanka-serenada-ab2cd"); await sleep(900);
    const gore = await evalJS(`({h:document.getElementById("text-vaucher-banner").hidden,c:document.getElementById("text-vaucher-banner").className,t:document.getElementById("text-vaucher-banner-tekst").textContent,b:document.getElementById("text-send").textContent.trim()})`);
    ok("?kod= с използван код → съобщението е горе (червено), плащането остава", !gore.h && /err/.test(gore.c) && /вече е използван/.test(gore.t) && gore.b === "Продължи към плащане · 19,90 €", gore.t.slice(0, 80));

    /* 9) пътят БЕЗ код — както преди */
    for (const inv of [false, true]) {
      await idi(BASE + "/index.html"); await nulirai(); await idi(BASE + "/index.html");
      await evalJS(`document.getElementById("fast-text").click()`); await sleep(800);
      const kodSkrit = await evalJS(`({tog:document.getElementById("text-kod-toggle").offsetParent!==null,pole:document.getElementById("text-kod-pole").hidden,ban:document.getElementById("text-vaucher-banner").hidden,pay:document.getElementById("text-pay-hint").offsetParent!==null,vh:document.getElementById("text-vaucher-hint").offsetParent===null,sPl:document.getElementById("text-consent-plashtane").offsetParent!==null,sVa:document.getElementById("text-consent-vaucher").offsetParent===null})`);
      navs = [];
      await evalJS(`document.getElementById("text-story").value="За колегата ми — обича риболова.";document.getElementById("text-email").value="kupuvach@example.com";document.getElementById("text-consent").checked=true;` +
        (inv ? `document.getElementById("text-invoice").click();document.getElementById("text-inv-name").value="Примерна фирма ЕООД";document.getElementById("text-inv-addr").value="гр. Примерно";` : "") +
        `document.getElementById("text-send").click();`);
      await sleep(2500);
      const navB = navs.slice();
      z = await dnevnik();
      const aj = z.find(x => x.vid === "fetch" && /formsubmit\.co\/ajax\//.test(x.url));
      const ajP = k => aj ? (aj.e.find(p => p[0] === k) || [])[1] || "" : "";
      const bc = z.find(x => x.vid === "beacon" && /\/brief$/.test(x.url));
      const psn = ajP("Номер на заявка");
      const S = inv ? "без код, с фактура: " : "без код: ";
      ok(S + "полето за код е свито, банерът и подсказката за ваучер ги няма", kodSkrit.tog && kodSkrit.pole && kodSkrit.ban && kodSkrit.pay && kodSkrit.vh && kodSkrit.sPl && kodSkrit.sVa, JSON.stringify(kodSkrit));
      ok(S + "FormSubmit „ОЧАКВА ПЛАЩАНЕ“, без поле „Ваучер“, фактурата както преди",
        ajP("_subject") === "БЪРЗА заявка (ОЧАКВА ПЛАЩАНЕ) — " + psn && ajP("Състояние") === "ОЧАКВА ПЛАЩАНЕ — клиентът е пренасочен към Stripe" && !aj.e.some(p => p[0] === "Ваучер") &&
        ajP("ФАКТУРА") === (inv ? "ДА — физическо лице (по желание)" : "не е поискана — влиза в отчета по чл. 119") && /СЪСТОЯНИЕ: очаква плащане\. Свери в Stripe по PSN-/.test(ajP("CLAUDE BRIEF")), ajP("_subject"));
      ok(S + "beacon към /brief със същите полета, без бележка за ваучер",
        !!bc && Object.keys(bc.tyalo).join(",") === "order_no,vid,povod,event_date,stilove,ezik,razkaz,email,snimki,landing,ref_parvi,ref_posleden" && bc.tyalo.vid === "бърза текстова" && bc.tyalo.razkaz === "За колегата ми — обича риболова." && bc.tyalo.order_no === psn,
        bc ? JSON.stringify(bc.tyalo).slice(0, 120) : "няма");
      ok(S + "без заявки към /vaucher/*", !z.some(x => /\/vaucher\//.test(x.url)));
      ok(S + "Stripe адресът е както преди", navB.length === 1 && navB[0] === STRIPE_PESEN + "?client_reference_id=" + psn + "&prefilled_email=" + encodeURIComponent("kupuvach@example.com") + "&locale=bg", navB.join(" , "));
    }
    ok("конзолата чиста (цялата проба)", konzola.length === 0, konzola.join(" | "));
    ok("нищо не е стигнало до Stripe, FormSubmit, Worker-а, /sabitie и анализите (0 отговора; спрени " + blokirani.length + ")",
      stignali.length === 0 && blokirani.some(u => /buy\.stripe\.com/.test(u)), stignali.slice(0, 3).join(" , "));
  } catch (e) { ok("пробата стигна до края", false, e.message.slice(0, 200)); }
  try { await send("Browser.close"); } catch (e) {} try { chrome.kill(); } catch (e) {}
  R.forEach(r => console.log("  " + r));
  const f = R.filter(r => r.indexOf("FAIL") === 0).length;
  console.log("  " + (R.length - f) + " OK, " + f + " FAIL"); process.exit(f ? 1 : 0);
})();
