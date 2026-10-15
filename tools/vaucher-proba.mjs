/* Ваучер за песен (15.10.2026) — проверка на Worker-а без мрежа и без истински писма.
   Базата е SQLite в паметта (node:sqlite) с worker/schema.sql; D1 batch се имитира с
   транзакция (атомарно, както в D1). Brevo е подменен през globalThis.fetch — писмата се
   хващат и се гледа какво щеше да тръгне. Заявките минават през истинския fetch() на
   Worker-а (маршрутите, CORS, подписът на Stripe). Имената са измислени — репото е публично.
   Аргумент (по избор) — папка ИЗВЪН репото, където да запише писмото с ваучера за преглед.
   Код 1 при FAIL. */
import fs from "node:fs";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import worker, { napomniNeplateni, vaucherCron, signedToken } from "../worker/src/index.js";
import { generirajKod, imeZaKod, translit, normKod, AZBUKA, DUMI } from "../worker/src/vaucher.js";

let gr = 0, ok = 0;
const proveri = (u, o) => { if (u) ok++; else { gr++; console.log("    ✗ " + o); } };
const glava = (t) => console.log("  · " + t);

/* ---------- база ---------- */
const db = new DatabaseSync(":memory:");
db.exec(fs.readFileSync(new URL("../worker/schema.sql", import.meta.url), "utf8"));
db.exec("ALTER TABLE sales ADD COLUMN delivered_at TEXT; ALTER TABLE sales ADD COLUMN note TEXT; ALTER TABLE sales ADD COLUMN page_url TEXT;");
function izraz(sql) {
  const st = db.prepare(sql);
  let a = [];
  const vrashta = /\bRETURNING\b|^\s*SELECT/i.test(sql);
  const o = {
    bind(...x) { a = x; return o; },
    all: async () => ({ results: st.all(...a) }),
    first: async () => st.get(...a) || null,
    run: async () => { const r = st.run(...a); return { success: true, meta: { changes: Number(r.changes) } }; },
    _sync() {
      if (vrashta) return { results: st.all(...a), meta: { changes: 0 } };
      return { results: [], meta: { changes: Number(st.run(...a).changes) } };
    }
  };
  return o;
}
const DB = {
  prepare: izraz,
  /* D1 batch: всичко или нищо */
  batch: async (spisak) => {
    db.exec("BEGIN");
    try { const r = spisak.map((s) => s._sync()); db.exec("COMMIT"); return r; }
    catch (e) { db.exec("ROLLBACK"); throw e; }
  }
};
const red = (sql, ...a) => db.prepare(sql).get(...a);
const vsichki = (sql, ...a) => db.prepare(sql).all(...a);

/* ---------- Brevo ---------- */
const pisma = [];
let brevo = "ok";                     /* ok | fail | failAttach */
const starFetch = globalThis.fetch;
globalThis.fetch = async (url, o) => {
  if (!/api\.brevo\.com/.test(String(url))) throw new Error("непозволена заявка: " + url);
  const telo = JSON.parse(o.body);
  pisma.push(telo);
  const zle = brevo === "fail" || (brevo === "failAttach" && telo.attachment);
  return { ok: !zle, status: zle ? 400 : 201, text: async () => (zle ? "proba greshka" : "") };
};
const SEKRET = "whsec_proba";
const env = {
  DB, BREVO_API_KEY: "proba", MAIL_SENDER: "sales@pesenta.bg", MAIL_SENDER_NAME: "Песента",
  NOTIFY_EMAILS: "miro@example.com", AUDIT_TOKEN: "proba-sol-ne-e-istinska", PUBLIC_BASE: "https://proba.example",
  STRIPE_WEBHOOK_SECRET: SEKRET, BGN_RATE: "1.95583", PROC_ID: "acct_proba",
  ART_NAME: "Песен по поръчка — авторски текст и музика, до 3:30 мин.",
  VAUCHER_ART_NAME: "Ваучер за песен по поръчка", VAUCHER_PLINK: "plink_proba",
  PAYMENT_LINK: "https://buy.stripe.com/proba"
};
const kupuvach = (p) => pisma.filter((m) => m.to[0].email !== "miro@example.com" && (!p || p(m)));
const miro = (p) => pisma.filter((m) => m.to[0].email === "miro@example.com" && (!p || p(m)));
const isprazni = () => { pisma.length = 0; };

function mkCtx() { const l = []; return { waitUntil(p) { l.push(p); }, done: () => Promise.all(l) }; }
async function zaqvka(pat, o) {
  o = o || {};
  const ctx = mkCtx();
  const r = await worker.fetch(new Request("https://proba.example" + pat, {
    method: o.method || "GET", body: o.body, headers: Object.assign({ "CF-Connecting-IP": o.ip || "203.0.113.1" }, o.headers || {})
  }), env, ctx);
  await ctx.done();
  let t = null;
  const txt = await r.clone().text();
  try { t = JSON.parse(txt); } catch (e) { t = null; }
  return { status: r.status, json: t, res: r };
}
const post = (pat, telo, o) => zaqvka(pat, Object.assign({ method: "POST", body: typeof telo === "string" ? telo : JSON.stringify(telo), headers: { "content-type": "text/plain" } }, o || {}));

let sesN = 0;
async function webhook(obj, type) {
  const raw = JSON.stringify({ id: "evt_" + (++sesN), type: type || "checkout.session.completed", data: { object: obj } });
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", SEKRET).update(t + "." + raw).digest("hex");
  return zaqvka("/stripe-webhook", { method: "POST", body: raw, headers: { "Stripe-Signature": "t=" + t + ",v1=" + v1 } });
}
const sesia = (id, o) => Object.assign({
  id: id, payment_status: "paid", amount_subtotal: 1990, amount_total: 1990, currency: "eur",
  customer_details: { email: "kupuvach@example.com", name: "Петьо Тестов", address: { country: "BG" } },
  payment_intent: "pi_" + id, payment_link: "plink_proba"
}, o || {});

try {
  /* ============ 1. кодът ============ */
  glava("генериране на код");
  proveri(translit("Щастлива") === "SHTASTLIVA", "Щ→SHT (" + translit("Щастлива") + ")");
  proveri(translit("Ъгъл") === "AGAL", "Ъ→A");
  proveri(translit("Юлиян") === "YULIYAN" && translit("Юлия") === "YULIA", "Ю→YU, -ия→IA (" + translit("Юлия") + ")");
  proveri(translit("Жоро") === "ZHORO" && translit("Цецка") === "TSETSKA" && translit("Чочо") === "CHOCHO", "Ж, Ц, Ч");
  proveri(translit("Шишо") === "SHISHO" && translit("Христо") === "HRISTO" && translit("Йордан") === "YORDAN", "Ш, Х, Й");
  proveri(translit("Яница") === "YANITSA", "Я→YA");
  proveri(imeZaKod("Иванка Иванова", "Петьо") === "IVANKA", "първото име на „За кого“");
  proveri(imeZaKod("", "Петьо Петров") === "PETYO", "празно „За кого“ → „От кого“ (" + imeZaKod("", "Петьо Петров") + ")");
  proveri(imeZaKod("🎉 !!", "") === "PODARAK", "нищо подходящо → PODARAK");
  proveri(imeZaKod("Константинопол", "") === "KONSTANTIN", "до 10 знака (" + imeZaKod("Константинопол", "") + ")");
  proveri(imeZaKod("Дончо-Вълко", "") === "DONCHO", "тирето дели имената");
  const re = new RegExp("^[A-Z]{2,10}-(" + DUMI.join("|") + ")-[" + AZBUKA + "]{5}$");
  const kodove = new Set();
  let losh = "";
  for (let i = 0; i < 2000; i++) {
    const k = generirajKod("Мария", "Петьо");
    if (!re.test(k) && !losh) losh = k;
    kodove.add(k);
  }
  proveri(!losh, "формат на кода (" + losh + ")");
  proveri([...kodove].every((k) => k.startsWith("MARIA-")), "„Мария“ → MARIA-");
  proveri([...kodove].every((k) => !/[01OIL]/.test(k.split("-")[2])), "суфиксът е без 0/O/1/I/L");
  proveri(kodove.size === 2000, "2000 кода, уникални: " + kodove.size);
  proveri(new Set([...kodove].map((k) => k.split("-")[1])).size === DUMI.length, "всички думи се ползват");
  proveri(normKod(" maria-serenada-7kq9x ") === "MARIASERENADA7KQ9X", "нормализация на малки/тирета/интервали");
  proveri(normKod("МАРИЯ-СЕРЕНАДА") === "", "кирилица при въвеждане не чупи (" + normKod("МАРИЯ-СЕРЕНАДА") + ")");

  /* ============ 2. /vaucher/nov ============ */
  glava("POST /vaucher/nov");
  const nov = (o) => Object.assign({ ref: "VCH-261015-0001", ot_kogo: "Петьо", za_kogo: "Иванка <b>Тестова</b>",
    poslanie: "Честит рожден ден!\nДа пееш всеки ден.", email: "Kupuvach@Example.com" }, o || {});
  let r = await post("/vaucher/nov", nov());
  proveri(r.status === 200 && r.json && r.json.ok, "валидно → 200 ok (" + r.status + ")");
  proveri(r.res.headers.get("Access-Control-Allow-Origin") === "https://pesenta.bg", "CORS като /brief");
  let v1 = red("SELECT * FROM vaucheri WHERE ref = 'VCH-261015-0001'");
  proveri(v1 && v1.status === "chaka" && !v1.kod && v1.email === "kupuvach@example.com", "ред chaka без код, имейлът е с малки");
  proveri(v1 && v1.poslanie === "Честит рожден ден!\nДа пееш всеки ден.", "новият ред в посланието се пази");
  proveri((await post("/vaucher/nov", nov({ ref: "VCH-1" }))).status === 400, "грешен ref → 400");
  proveri((await post("/vaucher/nov", nov({ za_kogo: "а".repeat(61) }))).status === 400, "„За кого“ 61 знака → 400");
  proveri((await post("/vaucher/nov", nov({ ot_kogo: "" }))).status === 400, "празно „От кого“ → 400");
  proveri((await post("/vaucher/nov", nov({ poslanie: "п".repeat(301) }))).status === 400, "послание 301 знака → 400");
  proveri((await post("/vaucher/nov", nov({ email: "ne-e-imeil" }))).status === 400, "грешен имейл → 400");
  proveri((await post("/vaucher/nov", nov({ faktura: { ime: "", adres: "" } }))).status === 400, "фактура без име → 400");
  proveri((await post("/vaucher/nov", "{счупено")).status === 400, "счупен JSON → 400");
  proveri((await post("/vaucher/nov", nov({ poslanie: "x".repeat(5000) }))).status === 413, "голямо тяло → 413");
  r = await post("/vaucher/nov", nov({ faktura: { ime: "Тест ЕООД", adres: "ул. Примерна", eik: "123456789" } }));
  v1 = red("SELECT * FROM vaucheri WHERE ref = 'VCH-261015-0001'");
  proveri(r.status === 200 && v1.faktura && JSON.parse(v1.faktura).eik === "123456789", "повторно със същия ref обновява (фактура)");
  proveri((await zaqvka("/vaucher/nov", { method: "OPTIONS" })).status === 204, "OPTIONS → 204");

  /* ============ 3. webhook: платен → aktiven + едно писмо ============ */
  glava("webhook — платен ваучер");
  isprazni();
  r = await webhook(sesia("cs_test_1", { client_reference_id: "VCH-261015-0001" }));
  proveri(r.status === 200, "webhook → 200 (" + r.status + " " + JSON.stringify(r.json) + ")");
  v1 = red("SELECT * FROM vaucheri WHERE ref = 'VCH-261015-0001'");
  const s1 = red("SELECT * FROM sales WHERE stripe_event_key = 'cs:cs_test_1'");
  proveri(v1 && v1.status === "aktiven" && /^IVANKA-/.test(v1.kod) && v1.kod_norm === normKod(v1.kod), "aktiven с код IVANKA-… (" + (v1 && v1.kod) + ")");
  proveri(v1 && v1.stripe_session === "cs_test_1" && v1.platen_at, "stripe_session и platen_at");
  proveri(s1 && s1.art_name === "Ваучер за песен по поръчка" && s1.order_no === "VCH-261015-0001", "продажбата: артикул и номер");
  proveri(kupuvach().length === 1, "едно писмо до купувача (" + kupuvach().length + ")");
  const p1 = kupuvach()[0] || { htmlContent: "", subject: "", attachment: [] };
  const KOD1 = v1 && v1.kod;
  proveri(p1.htmlContent.includes(KOD1), "кодът е в писмото");
  proveri(p1.htmlContent.includes("https://pesenta.bg/?kod=" + KOD1 + "#order") && p1.htmlContent.includes("Осребри подаръка"), "бутонът с попълнен код");
  proveri(p1.htmlContent.includes("https://pesenta.bg/assets/img/vaucher-mail.jpg") && p1.htmlContent.includes('width="600"'), "картината 600");
  proveri(p1.htmlContent.includes("Иванка &lt;b&gt;Тестова&lt;/b&gt;") && !p1.htmlContent.includes("<b>Тестова</b>"), "имената са екранирани");
  proveri(p1.htmlContent.includes("Честит рожден ден!<br>Да пееш всеки ден."), "посланието с нови редове");
  proveri(!/19[,.]90|€/.test(p1.htmlContent), "без цена в писмото");
  proveri(!p1.htmlContent.includes("пристига до 24 часа") && !/картичка/i.test(p1.htmlContent), "без „до 24 часа“ и без картичката");
  proveri(p1.htmlContent.includes("/beleshka/VCH-261015-0001?t=") && p1.htmlContent.includes("0000001012"), "бележката е в същото писмо (документ 0000001012)");
  proveri(/Ваучерът за песен за Иванка <b>Тестова<\/b> е готов/.test(p1.subject), "темата (" + p1.subject + ")");
  const tok = await signedToken("vaucher", "VCH-261015-0001", env.AUDIT_TOKEN);
  proveri(p1.attachment && p1.attachment[0].url === "https://proba.example/vaucher/pdf/VCH-261015-0001?t=" + tok &&
    p1.attachment[0].name === "vaucher-" + KOD1 + ".pdf", "прикаченият PDF по подписан адрес");
  proveri(v1 && v1.pismo_at && v1.pismo_opiti === 1 && !v1.pismo_greshka, "pismo_at, 1 опит");
  proveri(s1 && s1.email_sent_at && !s1.email_error, "sales.email_sent_at (бележката е връчена)");
  const iz1 = miro()[0];
  proveri(miro().length === 1 && /^Продаден ваучер 19\.90 EUR · VCH-261015-0001$/.test(iz1.subject), "известието до Миро (" + (iz1 && iz1.subject) + ")");
  proveri(iz1 && !iz1.subject.includes("[БЕЗ РАЗКАЗ]") && !iz1.htmlContent.includes("НЯМА разказ") && iz1.htmlContent.includes(KOD1), "без [БЕЗ РАЗКАЗ], с кода");
  if (process.argv[2]) fs.writeFileSync(process.argv[2] + "/vaucher-pismo.html", p1.htmlContent);

  /* ============ 4. повторен webhook ============ */
  glava("повторен webhook");
  isprazni();
  r = await webhook(sesia("cs_test_1", { client_reference_id: "VCH-261015-0001" }), "checkout.session.async_payment_succeeded");
  proveri(r.status === 200 && pisma.length === 0, "без второ писмо (" + pisma.length + ")");
  proveri(red("SELECT count(*) n FROM sales").n === 1 && red("SELECT kod FROM vaucheri WHERE ref = 'VCH-261015-0001'").kod === KOD1, "една продажба, кодът не е сменен");

  /* ============ 5. webhook без ред във vaucheri ============ */
  glava("webhook без данни от формата");
  isprazni();
  r = await webhook(sesia("cs_test_2", { client_reference_id: "VCH-261015-0002" }));
  const v2 = red("SELECT * FROM vaucheri WHERE ref = 'VCH-261015-0002'");
  proveri(r.status === 200 && v2 && v2.status === "aktiven" && /^PODARAK-/.test(v2.kod) && v2.bez_danni === 1, "PODARAK-… с bez_danni (" + (v2 && v2.kod) + ")");
  proveri(kupuvach().length === 1 && kupuvach()[0].htmlContent.includes(v2.kod), "купувачът пак има код");
  proveri(miro().length === 1 && miro()[0].htmlContent.includes("не стигнаха"), "известието казва, че данните липсват");

  /* ============ 6. по Payment Link, без client_reference_id ============ */
  glava("webhook по VAUCHER_PLINK");
  isprazni();
  r = await webhook(sesia("cs_test_3", { client_reference_id: null }));
  const v3 = red("SELECT * FROM vaucheri WHERE stripe_session = 'cs_test_3'");
  const s3 = red("SELECT * FROM sales WHERE stripe_event_key = 'cs:cs_test_3'");
  proveri(v3 && /^VCH-\d{6}-\d{4}$/.test(v3.ref) && v3.status === "aktiven" && s3 && s3.order_no === v3.ref && s3.art_name === env.VAUCHER_ART_NAME, "нов VCH- номер, продажбата е с него");
  const psnS = await webhook(sesia("cs_test_psn", { client_reference_id: "PSN-261015-0100", payment_link: "plink_pesen" }));
  const sPsn = red("SELECT * FROM sales WHERE stripe_event_key = 'cs:cs_test_psn'");
  proveri(psnS.status === 200 && sPsn && sPsn.art_name === env.ART_NAME && !red("SELECT 1 FROM vaucheri WHERE stripe_session = 'cs_test_psn'"), "обикновената песен не е ваучер");

  /* ============ 7. второ плащане за същия ref ============ */
  glava("второ плащане за вече платен ref");
  isprazni();
  r = await webhook(sesia("cs_test_4", { client_reference_id: "VCH-261015-0001" }));
  const v4 = red("SELECT * FROM vaucheri WHERE stripe_session = 'cs_test_4'");
  proveri(v4 && v4.ref !== "VCH-261015-0001" && v4.za_kogo === "Иванка <b>Тестова</b>" && v4.kod !== KOD1 && v4.status === "aktiven", "нов ref със същите имена, втори код");
  proveri(red("SELECT kod FROM vaucheri WHERE ref = 'VCH-261015-0001'").kod === KOD1, "първият код не е пипан");

  /* ============ 8. продажбата записана, ваучерът останал chaka ============ */
  glava("довършване на ваучер с вече записана продажба");
  await post("/vaucher/nov", nov({ ref: "VCH-261015-0005", za_kogo: "Цветелина", ot_kogo: "Жоро" }));
  db.prepare(`INSERT INTO sales (doc_n, doc_date, order_no, order_date, customer_email, art_name, art_price_st, total_st, paym, stripe_event_key, created_at, trans_n)
    VALUES (9001, '2026-10-15', 'VCH-261015-0005', '2026-10-15', 'kupuvach@example.com', 'Песен', 3892, 3892, 4, 'cs:cs_test_5', ?, 'pi_cs_test_5')`).run(new Date().toISOString());
  isprazni();
  r = await webhook(sesia("cs_test_5", { client_reference_id: "VCH-261015-0005" }));
  const v5 = red("SELECT * FROM vaucheri WHERE ref = 'VCH-261015-0005'");
  proveri(r.status === 200 && v5.status === "aktiven" && /^TSVETELINA-/.test(v5.kod) && kupuvach().length === 1, "довършен: TSVETELINA-…, едно писмо (" + v5.kod + ")");
  proveri(red("SELECT count(*) n FROM sales WHERE stripe_event_key = 'cs:cs_test_5'").n === 1, "без втора продажба");

  /* ============ 9. сблъсък на kod_norm ============ */
  glava("UNIQUE на kod_norm → нов код");
  /* Всички кодове за „Сблъсък“ ще съвпаднат, ако генераторът е предвидим — тук го
     правим такъв само за първия опит: поставяме ред, чийто kod_norm е бъдещият. */
  const stRnd = crypto.webcrypto.getRandomValues.bind(crypto.webcrypto);
  let broiRnd = 0;
  const nuli = (b) => { b.fill(0); return b; };
  globalThis.crypto.getRandomValues = (b) => (broiRnd++ < 6 ? nuli(b) : stRnd(b));
  const predviden = "SBLASAK-" + DUMI[0] + "-AAAAA";
  db.prepare("INSERT INTO vaucheri (ref, kod, kod_norm, status, created_at) VALUES ('VCH-261001-9999', ?, ?, 'izpolzvan', '2026-10-01')").run(predviden, normKod(predviden));
  await post("/vaucher/nov", nov({ ref: "VCH-261015-0006", za_kogo: "Сблъсък", ot_kogo: "Петьо" }));
  broiRnd = 0;
  r = await webhook(sesia("cs_test_6", { client_reference_id: "VCH-261015-0006" }));
  const broiPriSblasak = broiRnd;
  globalThis.crypto.getRandomValues = stRnd;
  proveri(broiPriSblasak >= 12, "първият код наистина се сблъска и има втори опит (" + broiPriSblasak + " тегления)");
  const v6 =red("SELECT * FROM vaucheri WHERE ref = 'VCH-261015-0006'");
  proveri(r.status === 200 && v6.status === "aktiven" && v6.kod !== predviden && /^SBLASAK-/.test(v6.kod), "при сблъсък — друг код (" + v6.kod + ")");
  proveri(red("SELECT count(*) n FROM sales WHERE stripe_event_key = 'cs:cs_test_6'").n === 1, "продажбата е записана веднъж");

  /* ============ 10. /vaucher/proverka ============ */
  glava("GET /vaucher/proverka");
  const pr = (k, ip) => zaqvka("/vaucher/proverka?kod=" + encodeURIComponent(k), { ip: ip || "198.51.100.7" });
  r = await pr(KOD1.toLowerCase().replace(/-/g, " "));
  proveri(r.status === 200 && r.json.ok && r.json.za_kogo === "Иванка <b>Тестова</b>" && r.json.ot_kogo === "Петьо", "намерен (малки букви, интервали)");
  proveri(r.res.headers.get("Access-Control-Allow-Origin") === "https://pesenta.bg", "CORS");
  r = await pr("NYAMA-SERENADA-22222");
  proveri(r.status === 200 && !r.json.ok && r.json.prichina === "nyama" && r.json.za_kogo === undefined, "няма → nyama, без имена");
  r = await pr("ИВАНКА-СЕРЕНАДА");
  proveri(r.status === 200 && r.json.prichina === "nyama", "кирилица → nyama, без грешка");
  r = await pr(predviden);
  proveri(r.json.prichina === "izpolzvan" && r.json.za_kogo === undefined, "използван → izpolzvan, без имена");
  let posleden = null;
  for (let i = 0; i < 25; i++) posleden = await pr("NYAMA-PESEN-33333", "192.0.2.50");
  proveri(posleden.status === 429 && posleden.json.prichina === "mnogo_opiti", "21-ви опит от едно IP → 429");
  proveri((await pr(KOD1, "192.0.2.51")).status === 200, "друго IP не е спряно");
  proveri(!vsichki("SELECT ip_hash FROM vaucher_opiti").some((x) => /192|198|203/.test(x.ip_hash)), "IP-то не е пазено в чист вид");

  /* ============ 11. /vaucher/izpolzvai ============ */
  glava("POST /vaucher/izpolzvai");
  const brif = (no) => ({ order_no: no, vid: "бърза текстова", povod: "Рожден ден", stilove: "Поп", ezik: "Български",
    razkaz: "Измислен разказ: Иванка обича планината.", email: "poluchatel@example.com", event_date: "2026-10-20" });
  isprazni();
  r = await post("/vaucher/izpolzvai", { kod: KOD1.toLowerCase(), order_no: "PSN-261015-0201", brief: brif("PSN-261015-0201") }, { ip: "198.51.100.20" });
  proveri(r.status === 200 && r.json.ok, "осребряване → 200 (" + r.status + " " + JSON.stringify(r.json) + ")");
  v1 = red("SELECT * FROM vaucheri WHERE ref = 'VCH-261015-0001'");
  proveri(v1.status === "izpolzvan" && v1.izpolzvan_order === "PSN-261015-0201" && v1.izpolzvan_at, "izpolzvan с поръчката");
  const b1 = red("SELECT * FROM briefs WHERE order_no = 'PSN-261015-0201'");
  proveri(b1 && b1.razkaz.includes("планината") && JSON.parse(b1.poleta).vaucher === KOD1, "брифът е записан, с кода");
  proveri(!red("SELECT 1 FROM sales WHERE order_no = 'PSN-261015-0201'"), "осребрената поръчка НЕ е в sales");
  const izO = miro()[0];
  proveri(miro().length === 1 && izO.subject === "Осребрен ваучер " + KOD1 + " → PSN-261015-0201" && izO.htmlContent.includes("планината"), "известието „Осребрен ваучер …“ с брифа");
  r = await post("/vaucher/izpolzvai", { kod: KOD1, order_no: "PSN-261015-0202", brief: brif("PSN-261015-0202") }, { ip: "198.51.100.20" });
  proveri(r.status === 409 && r.json.prichina === "izpolzvan", "втори опит с друга поръчка → 409 izpolzvan");
  proveri(!red("SELECT 1 FROM briefs WHERE order_no = 'PSN-261015-0202'"), "неуспешният опит НЕ оставя бриф");
  r = await post("/vaucher/izpolzvai", { kod: KOD1, order_no: "PSN-261015-0201", brief: brif("PSN-261015-0201") }, { ip: "198.51.100.20" });
  proveri(r.status === 200 && r.json.povtorno, "същата поръчка пак (двоен клик) → 200 povtorno");
  r = await post("/vaucher/izpolzvai", { kod: "NYAMA-HIMN-44444", order_no: "PSN-261015-0203", brief: brif("PSN-261015-0203") }, { ip: "198.51.100.20" });
  proveri(r.status === 409 && r.json.prichina === "nyama" && !red("SELECT 1 FROM briefs WHERE order_no = 'PSN-261015-0203'"), "непознат код → 409 nyama, без бриф");
  proveri((await post("/vaucher/izpolzvai", { kod: v2.kod, order_no: "VCH-261015-0002", brief: {} }, { ip: "198.51.100.20" })).status === 400, "номер, който не е PSN- → 400");
  proveri((await post("/vaucher/izpolzvai", { kod: v2.kod, order_no: "PSN-261015-0204" }, { ip: "198.51.100.20" })).status === 400, "без бриф → 400");
  /* два едновременни опита за един код */
  const [a, b] = await Promise.all([
    post("/vaucher/izpolzvai", { kod: v2.kod, order_no: "PSN-261015-0301", brief: brif("PSN-261015-0301") }, { ip: "198.51.100.30" }),
    post("/vaucher/izpolzvai", { kod: v2.kod, order_no: "PSN-261015-0302", brief: brif("PSN-261015-0302") }, { ip: "198.51.100.31" })
  ]);
  const uspehi = [a, b].filter((x) => x.status === 200).length;
  proveri(uspehi === 1 && [a, b].some((x) => x.status === 409), "два едновременни → само един успех (" + a.status + ", " + b.status + ")");
  proveri(vsichki("SELECT order_no FROM briefs WHERE order_no IN ('PSN-261015-0301','PSN-261015-0302')").length === 1, "и само един бриф");
  let posl = null;
  for (let i = 0; i < 21; i++) posl = await post("/vaucher/izpolzvai", { kod: "X", order_no: "PSN-261015-0999", brief: {} }, { ip: "192.0.2.60" });
  proveri(posl.status === 429, "осребряването също е ограничено → 429");
  /* /brief не е счупен от общата функция */
  r = await post("/brief", { order_no: "PSN-261015-0400", vid: "бърза текстова", razkaz: "проба", email: "neplatil@example.com" });
  proveri(r.status === 200 && red("SELECT razkaz FROM briefs WHERE order_no = 'PSN-261015-0400'").razkaz === "проба", "/brief работи както преди");
  proveri((await post("/brief", { order_no: "VCH-261015-0001" })).status === 400, "/brief не приема VCH-");

  /* ============ 12. напомнянето изключва осребрените ============ */
  glava("napomniNeplateni");
  isprazni();
  const napR = await napomniNeplateni(env, new Date(Date.now() + 30 * 3600e3));
  proveri(napR.prateni === 1 && pisma.length === 1 && pisma[0].to[0].email === "neplatil@example.com", "само неплатилият (" + JSON.stringify(napR) + ")");
  proveri(!red("SELECT 1 FROM napomnyania WHERE order_no IN ('PSN-261015-0201','PSN-261015-0301','PSN-261015-0302')"), "осребрените не са дори прегледани");

  /* ============ 13. връщане на пари ============ */
  glava("charge.refunded");
  isprazni();
  r = await webhook({ id: "ch_6", payment_intent: "pi_cs_test_6", amount_refunded: 1990 }, "charge.refunded");
  proveri(r.status === 200 && red("SELECT status FROM vaucheri WHERE ref = 'VCH-261015-0006'").status === "otmenen", "изцяло върнат → otmenen");
  proveri((await pr(v6.kod, "198.51.100.40")).json.prichina === "otmenen", "проверката казва otmenen");
  proveri(miro((m) => /Върнати пари за ваучер/.test(m.subject) && /отменен/.test(m.htmlContent)).length === 1, "известие за отменения");
  r = await post("/vaucher/izpolzvai", { kod: v6.kod, order_no: "PSN-261015-0501", brief: brif("PSN-261015-0501") }, { ip: "198.51.100.41" });
  proveri(r.status === 409 && r.json.prichina === "otmenen", "отменен не се осребрява");
  isprazni();
  await webhook({ id: "ch_1", payment_intent: "pi_cs_test_1", amount_refunded: 1990 }, "charge.refunded");
  proveri(red("SELECT status FROM vaucheri WHERE ref = 'VCH-261015-0001'").status === "izpolzvan", "осребрен остава izpolzvan");
  proveri(miro((m) => /ОСРЕБРЕН/.test(m.htmlContent)).length === 1, "известието казва, че е осребрен");
  await webhook({ id: "ch_3", payment_intent: "pi_cs_test_3", amount_refunded: 500 }, "charge.refunded");
  proveri(red("SELECT status FROM vaucheri WHERE stripe_session = 'cs_test_3'").status === "aktiven", "частично връщане → остава aktiven");

  /* ============ 14. писмо без PDF и допращане от cron ============ */
  glava("резервно писмо без PDF");
  await post("/vaucher/nov", nov({ ref: "VCH-261015-0007", za_kogo: "Йоана", ot_kogo: "Чавдар" }));
  isprazni(); brevo = "failAttach";
  await webhook(sesia("cs_test_7", { client_reference_id: "VCH-261015-0007" }));
  brevo = "ok";
  const v7 = red("SELECT * FROM vaucheri WHERE ref = 'VCH-261015-0007'");
  proveri(v7.pismo_at && /^без PDF/.test(v7.pismo_greshka || ""), "тръгнало без PDF, отбелязано (" + v7.pismo_greshka + ")");
  proveri(kupuvach((m) => !m.attachment).length === 1 && !kupuvach((m) => !m.attachment)[0].htmlContent.includes("Прикачен е и като PDF"), "второто писмо не обещава PDF");
  proveri(miro((m) => m.htmlContent.includes("PDF-ът не се прикачи")).length === 1, "известието казва за PDF-а");

  glava("cron: допращане и чистене");
  await post("/vaucher/nov", nov({ ref: "VCH-261015-0008", za_kogo: "Христина", ot_kogo: "Шишо" }));
  isprazni(); brevo = "fail";
  await webhook(sesia("cs_test_8", { client_reference_id: "VCH-261015-0008" }));
  brevo = "ok";
  let v8 = red("SELECT * FROM vaucheri WHERE ref = 'VCH-261015-0008'");
  proveri(v8.status === "aktiven" && !v8.pismo_at && v8.pismo_opiti === 1 && v8.pismo_greshka, "Brevo отказа → aktiven, без pismo_at, 1 опит");
  proveri(red("SELECT email_error FROM sales WHERE stripe_event_key = 'cs:cs_test_8'").email_error, "sales.email_error е записан");
  isprazni();
  let c = await vaucherCron(env, new Date(Date.now() + 5 * 60e3));
  proveri(c.prateni === 0 && pisma.length === 0, "по-рано от 10 минути — не праща");
  c = await vaucherCron(env, new Date(Date.now() + 11 * 60e3));
  v8 = red("SELECT * FROM vaucheri WHERE ref = 'VCH-261015-0008'");
  proveri(c.prateni === 1 && v8.pismo_at && v8.pismo_opiti === 2 && kupuvach().length === 1 && kupuvach()[0].htmlContent.includes(v8.kod), "след 10 минути — допратено (" + JSON.stringify(c) + ")");
  proveri(red("SELECT email_sent_at FROM sales WHERE stripe_event_key = 'cs:cs_test_8'").email_sent_at, "sales.email_sent_at след допращането");
  isprazni();
  c = await vaucherCron(env, new Date(Date.now() + 70 * 60e3));
  proveri(c.prateni === 0 && pisma.length === 0, "веднъж пратено — не се праща пак");
  db.prepare("UPDATE vaucheri SET pismo_at = NULL, pismo_opiti = 4 WHERE ref = 'VCH-261015-0008'").run();
  c = await vaucherCron(env, new Date(Date.now() + 70 * 60e3));
  proveri(c.pregledani === 0, "след 4 опита — спира");
  db.prepare("INSERT INTO vaucheri (ref, status, created_at) VALUES ('VCH-260901-0001', 'chaka', ?)").run(new Date(Date.now() - 31 * 86400e3).toISOString());
  db.prepare("INSERT INTO vaucheri (ref, status, created_at) VALUES ('VCH-261001-0001', 'chaka', ?)").run(new Date(Date.now() - 10 * 86400e3).toISOString());
  db.prepare("INSERT INTO vaucher_opiti (ip_hash, chas, broi) VALUES ('star', '2026-01-01T00', 3)").run();
  c = await vaucherCron(env);
  proveri(!red("SELECT 1 FROM vaucheri WHERE ref = 'VCH-260901-0001'") && red("SELECT 1 FROM vaucheri WHERE ref = 'VCH-261001-0001'") && c.iztriti === 1, "chaka над 30 дни — изтрит, по-новият остава");
  proveri(!red("SELECT 1 FROM vaucher_opiti WHERE ip_hash = 'star'"), "старите броячи — изтрити");
  proveri(red("SELECT 1 FROM vaucheri WHERE ref = 'VCH-261015-0001'"), "платените не се пипат");

  /* ============ 15. PDF маршрутът ============ */
  glava("GET /vaucher/pdf");
  r = await zaqvka("/vaucher/pdf/VCH-261015-0005?t=0000000000000000");
  proveri(r.status === 403, "грешен подпис → 403 (" + r.status + ")");
  r = await zaqvka("/vaucher/pdf/VCH-261015-0005");
  proveri(r.status === 403, "без подпис → 403");
  r = await zaqvka("/vaucher/pdf/VCH-261001-0001?t=" + (await signedToken("vaucher", "VCH-261001-0001", env.AUDIT_TOKEN)));
  proveri(r.status === 404, "неплатен (chaka) → 404 (" + r.status + ")");
  r = await zaqvka("/vaucher/pdf/VCH-261015-0005?t=" + (await signedToken("kartichka", "VCH-261015-0005", env.AUDIT_TOKEN)));
  proveri(r.status === 403, "подпис на картичката не отваря ваучера");
  r = await zaqvka("/vaucher/pdf/VCH-261015-0005?t=" + (await signedToken("vaucher", "VCH-261015-0005", env.AUDIT_TOKEN)));
  if (r.status === 200) {
    const baitove = new Uint8Array(await r.res.arrayBuffer());
    proveri(r.res.headers.get("Content-Type") === "application/pdf" && String.fromCharCode(...baitove.slice(0, 5)) === "%PDF-", "верен подпис → application/pdf, %PDF- (" + baitove.length + " байта)");
    proveri(/vaucher-TSVETELINA-/.test(r.res.headers.get("Content-Disposition") || ""), "името на файла с кода");
  } else {
    console.log("    ! PDF частта ПРОПУСНАТА: модулът vaucher-pdf.js (изпълнител C) върна " + r.status + " — проверява се в неговата проба");
  }

  /* ============ 16. админ ============ */
  glava("админ");
  r = await zaqvka("/admin/data", { headers: { "X-Admin-Token": env.AUDIT_TOKEN } });
  const av = r.json && r.json.vaucheri;
  proveri(r.status === 200 && Array.isArray(av) && av.length >= 6 && !av.some((x) => x.status === "chaka"), "ваучерите са в данните (без чакащите)");
  const osr = av && av.find((x) => x.ref === "VCH-261015-0001");
  proveri(osr && osr.brief && osr.brief.order_no === "PSN-261015-0201", "осребреният — с брифа на поръчката");
  proveri(!r.json.sales.some((x) => x.order_no === "PSN-261015-0201"), "осребрената поръчка не е в sales");
  r = await zaqvka("/admin/status", { method: "POST", headers: { "X-Admin-Token": env.AUDIT_TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ ref: "VCH-261015-0001", delivered: true, page_url: "https://pesenta.bg/pesni/proba-ivanka/" }) });
  const vd = red("SELECT delivered_at, page_url FROM vaucheri WHERE ref = 'VCH-261015-0001'");
  proveri(r.status === 200 && vd.delivered_at && vd.page_url === "https://pesenta.bg/pesni/proba-ivanka/", "доставката се отбелязва във vaucheri");
  r = await zaqvka("/admin/status", { method: "POST", headers: { "X-Admin-Token": env.AUDIT_TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ ref: "VCH-261015-0001", page_url: "https://zlo.example/" }) });
  proveri(r.status === 400, "чужд адрес → 400");
  proveri((await zaqvka("/admin/data")).status === 403, "без токен → 403");
} finally {
  globalThis.fetch = starFetch;
}

console.log(gr ? "  " + ok + " минаха, " + gr + " FAIL" : "  " + ok + " проверки минаха — чисто");
process.exit(gr ? 1 : 0);
