#!/usr/bin/env node
// Помощникът на задачата „поръчка → Telegram → клиент“ (етап 4, 28.11.2026).
//
// Творческата част (текст, Suno, илюстрация, страница, писмо) я прави задачата
// на компютъра по инструкцията си. Тук е само механиката, която трябва да е
// еднаква всеки път: какво е ново в D1, ключалката, съобщенията в Telegram,
// качването в R2 и сигналът „готово за пращане“ към Worker-а.
//
//   node tools/odobrenie.mjs novi                 нови платени поръчки (JSON)
//   node tools/odobrenie.mjs chakashti            избрани / „наново“ / заседнали (JSON)
//   node tools/odobrenie.mjs zapochni PSN-…       ключалка: ред в odobrenia, status generira
//   node tools/odobrenie.mjs zapochni PSN-… --nanovo   същото за „Наново“ (opiti+1)
//   node tools/odobrenie.mjs snimki PSN-… <папка> снимките на клиента от R2 (до 30)
//   node tools/odobrenie.mjs tg1 PSN-… <данни.json>   съобщение №1: текст, илюстрация, бутони
//   node tools/odobrenie.mjs kachi PSN-… <данни.json> MP3 + писмо в R2, после /odobrenie/gotova
//   node tools/odobrenie.mjs rachna PSN-… "<причина>"   за ръчна обработка + бележка в Telegram
//   node tools/odobrenie.mjs zaseknata PSN-… "<грешка>" спира автомата за поръчката + бележка
//   node tools/odobrenie.mjs belezhka "<текст>"    свободно съобщение до Мирослав (nota)
//
// Тайните се четат от файлове в профила и НЕ се печатат:
//   ~/.telegram-pesenta-bot   токенът на бота
//   ~/.telegram-pesenta-chat  chat id на Мирослав (само той получава)
//   ~/.pesenta-odobrenie-key  ключът за POST /odobrenie/gotova
// Репото е публично — нищо от тях не стои тук.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WORKER_DIR = path.resolve(import.meta.dirname, "../worker");
const BASE = "https://pesenta-nap.pesenta-nap.workers.dev";
const ORDER_RE = /^PSN-[0-9]{6}-[0-9]{4}$/;
const FAIL_RE = /^[a-z0-9-]{1,80}\.mp3$/;
// Колко минути след плащането да не се пипа поръчката — снимките идват
// на групи по 5 и последната може да е на път.
const MIN_VAZRAST = 15;

function tayna(ime) {
  const f = path.join(os.homedir(), ime);
  if (!fs.existsSync(f)) throw new Error("липсва файлът ~/" + ime);
  return fs.readFileSync(f, "utf8").trim();
}

function nameriWrangler() {
  const kand = [
    process.env.WRANGLER_JS,
    path.join(WORKER_DIR, "node_modules/wrangler/bin/wrangler.js"),
    path.resolve(WORKER_DIR, "../../tablo-pesenta/node_modules/wrangler/bin/wrangler.js")
  ].filter(Boolean);
  for (const k of kand) if (fs.existsSync(k)) return k;
  throw new Error("не намирам wrangler.js (задай WRANGLER_JS)");
}
const WRANGLER = nameriWrangler();

// Без шел: SQL с кавички и кирилица минава като един аргумент, непокътнат.
function wr(args) {
  return execFileSync(process.execPath, [WRANGLER, ...args], {
    cwd: WORKER_DIR, encoding: "utf8", maxBuffer: 64 << 20,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function sql(q) {
  const out = wr(["d1", "execute", "pesenta-nap", "--remote", "--json", "--command", q]);
  const i = out.search(/^\[/m);
  if (i < 0) throw new Error("D1 не върна JSON: " + out.slice(0, 300));
  const j = JSON.parse(out.slice(i));
  return j[j.length - 1].results || [];
}

const lit = (v) => v === null || v === undefined ? "NULL"
  : typeof v === "number" ? String(v)
  : "'" + String(v).replace(/'/g, "''") + "'";
const sega = () => new Date().toISOString();

function proveriNomer(n) {
  if (!ORDER_RE.test(n || "")) throw new Error("невалиден номер: " + n);
  return n;
}

/* ---------------- Telegram ---------------- */

async function tg(metod, telo) {
  const url = "https://api.telegram.org/bot" + tayna(".telegram-pesenta-bot") + "/" + metod;
  const opc = telo instanceof FormData
    ? { method: "POST", body: telo }
    : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(telo) };
  const r = await fetch(url, { ...opc, signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error("Telegram " + metod + ": " + (j.description || r.status));
  return j.result;
}

const chat = () => tayna(".telegram-pesenta-chat");

// Telegram реже на 4096 знака; режем по празен ред, после по ред.
function nareji(t, max = 3900) {
  const parcheta = [];
  let ost = t;
  while (ost.length > max) {
    let i = ost.lastIndexOf("\n\n", max);
    if (i < max / 2) i = ost.lastIndexOf("\n", max);
    if (i < max / 2) i = max;
    parcheta.push(ost.slice(0, i));
    ost = ost.slice(i).replace(/^\n+/, "");
  }
  if (ost) parcheta.push(ost);
  return parcheta;
}

async function pratiTekst(text, reply) {
  let posledno = null;
  for (const p of nareji(text)) {
    posledno = await tg("sendMessage", {
      chat_id: chat(), text: p, link_preview_options: { is_disabled: true },
      ...(reply ? { reply_parameters: { message_id: reply, allow_sending_without_reply: true } } : {})
    });
  }
  return posledno;
}

/* ---------------- команди ---------------- */

async function novi() {
  // Една продажба на ред; добавката за видео е втори ред със същия номер —
  // затова GROUP BY и всички артикули в едно поле.
  const redove = sql(`
    SELECT s.order_no, MIN(s.created_at) AS created_at,
           MAX(s.customer_name) AS customer_name, MAX(s.customer_email) AS customer_email,
           GROUP_CONCAT(s.art_name, ' + ') AS artikuli, SUM(s.total_eur_c) AS total_eur_c,
           b.vid, b.povod, b.stilove, b.ezik, b.razkaz, b.poleta
    FROM sales s LEFT JOIN briefs b ON b.order_no = s.order_no
    WHERE s.delivered_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.order_no = s.order_no)
      AND NOT EXISTS (SELECT 1 FROM odobrenia o WHERE o.order_no = s.order_no)
    GROUP BY s.order_no
    ORDER BY MIN(s.created_at)`);
  const t = Date.now();
  const izhod = redove.map((r) => {
    const minuti = Math.round((t - Date.parse(r.created_at)) / 60000);
    let poleta = null;
    try { poleta = r.poleta ? JSON.parse(r.poleta) : null; } catch { poleta = null; }
    // Кое не е за автомата в първата версия (решение 28.11.2026).
    const prichini = [];
    if (!ORDER_RE.test(r.order_no)) prichini.push("не е поръчка за песен (" + r.order_no + ")");
    if (/видео/i.test(r.artikuli || "")) prichini.push("с видео добавка");
    if (/ваучер/i.test(r.artikuli || "")) prichini.push("ваучер");
    if (r.ezik && r.ezik !== "Български") prichini.push("език: " + r.ezik);
    if (/\(EN\)/.test(r.vid || "")) prichini.push("поръчка от английския сайт");
    if (!r.razkaz && minuti >= 120) prichini.push("няма бриф 2 часа след плащането");
    const chakay = minuti < MIN_VAZRAST || (!r.razkaz && minuti < 120);
    return {
      order_no: r.order_no, minuti, customer_name: r.customer_name,
      artikuli: r.artikuli, total_eur: (r.total_eur_c || 0) / 100,
      vid: r.vid, povod: r.povod, stilove: r.stilove, ezik: r.ezik, razkaz: r.razkaz,
      poleta, // целият бриф (получател, качества, шеги, задължително, да се избягва…)
      reshenie: chakay ? "chakay" : prichini.length ? "rachna" : "avtomat",
      prichini
    };
  });
  console.log(JSON.stringify(izhod, null, 1));
}

async function chakashti() {
  const redove = sql(`SELECT order_no, status, izbrana, suno_v1, suno_v2, tekst, kie_task,
      opiti, tg_msg1, tg_msg2, updated_at, greshka
    FROM odobrenia
    WHERE status IN ('izbrana', 'nanovo')
       OR (status = 'generira' AND updated_at < ${lit(new Date(Date.now() - 2 * 3600e3).toISOString())})
    ORDER BY updated_at`);
  console.log(JSON.stringify(redove.map((r) => ({
    ...r, deystvie: r.status === "izbrana" ? "podgotvi" : r.status === "nanovo" ? "nanovo" : "zasednala"
  })), null, 1));
}

async function zapochni(n, nanovo) {
  proveriNomer(n);
  const t = sega();
  if (nanovo) {
    sql(`UPDATE odobrenia SET status='generira', opiti=opiti+1, izbrana=NULL, greshka=NULL, updated_at=${lit(t)}
         WHERE order_no=${lit(n)} AND status='nanovo'`);
  } else {
    // PRIMARY KEY е ключалката: втори опит за същата поръчка гърми тук.
    sql(`INSERT OR IGNORE INTO odobrenia (order_no, status, created_at, updated_at)
         VALUES (${lit(n)}, 'generira', ${lit(t)}, ${lit(t)})`);
  }
  const r = sql(`SELECT status, updated_at FROM odobrenia WHERE order_no=${lit(n)}`)[0];
  const moy = r && r.status === "generira" && r.updated_at === t;
  console.log(JSON.stringify({ ok: moy, status: r && r.status }));
  if (!moy) process.exit(3);
}

async function snimki(n, papka) {
  proveriNomer(n);
  fs.mkdirSync(papka, { recursive: true });
  const svaleni = [];
  // R2 от командния ред няма „list“; имената са поредни (snimki.js), до 30.
  for (let i = 1; i <= 30; i++) {
    const ime = "snimka-" + n + "-" + i + ".jpg";
    const cel = path.join(papka, ime);
    try {
      wr(["r2", "object", "get", "pesenta-snimki/" + n + "/" + ime, "--remote", "--jurisdiction", "eu", "--file", cel]);
      if (fs.existsSync(cel) && fs.statSync(cel).size > 0) svaleni.push(cel);
      else break;
    } catch {
      break; // първият липсващ номер = край
    }
  }
  console.log(JSON.stringify({ broy: svaleni.length, failove: svaleni }, null, 1));
}

// данни.json за tg1:
// { "zaglavie": "…", "opisanie": "1–2 изречения за песента", "ilyustracia": "D:/KIE/….png",
//   "suno": [{ "id": "…", "url": "https://suno.com/song/…", "trae": "3:41" }, {…}],
//   "tekst": "текстът за клиента", "kie_task": "…", "kie_prompt": "…",
//   "krediti_suno": 20, "krediti_kie": 18, "belezhki": "по желание: какво от брифа е пропуснато и защо" }
async function tg1(n, fail) {
  proveriNomer(n);
  const d = JSON.parse(fs.readFileSync(fail, "utf8"));
  if (!Array.isArray(d.suno) || d.suno.length < 2) throw new Error("трябват две версии в suno[]");
  for (const s of d.suno) if (!/^https:\/\/suno\.com\/song\/[\w-]+/.test(s.url || "")) throw new Error("лош song_url: " + s.url);
  if (!fs.existsSync(d.ilyustracia || "")) throw new Error("няма файл с илюстрацията: " + d.ilyustracia);
  const o = sql(`SELECT status, opiti FROM odobrenia WHERE order_no=${lit(n)}`)[0];
  if (!o || o.status !== "generira") throw new Error("поръчката не е в generira (status " + (o && o.status) + ")");
  const s = sql(`SELECT MAX(customer_name) AS ime, GROUP_CONCAT(art_name, ' + ') AS art, SUM(total_eur_c) AS c
                 FROM sales WHERE order_no=${lit(n)}`)[0] || {};

  // 1) Текстът и промптът — отделно, защото надписът под снимка е до 1024 знака.
  const chast1 = "📝 " + n + " — „" + d.zaglavie + "“\n\n" + d.tekst.trim() +
    "\n\n— — —\n🎨 Илюстрация: nano-banana-pro, 2K (KIE, " + d.krediti_kie + " кр.)\nПромпт:\n" + d.kie_prompt.trim() +
    (d.belezhki ? "\n\n📌 " + d.belezhki.trim() : "");
  const m0 = await pratiTekst(chast1);

  // 2) Илюстрацията с бутоните — последна, за да са бутоните най-долу в чата.
  const nadpis = ("🎵 " + n + (o.opiti > 1 ? " · опит " + o.opiti : "") + "\n" +
    (s.ime || "") + " · " + ((s.c || 0) / 100).toFixed(2).replace(".", ",") + " €\n" +
    "„" + d.zaglavie + "“ — " + (d.opisanie || "") + "\n" +
    "Версия 1: " + (d.suno[0].trae || "?") + " · Версия 2: " + (d.suno[1].trae || "?") +
    "\nSuno: " + d.krediti_suno + " кр. · сваляне след избора: 1 кр.").slice(0, 1020);
  const bytes = fs.readFileSync(d.ilyustracia);
  const fd = new FormData();
  fd.append("chat_id", chat());
  fd.append("caption", nadpis);
  fd.append("reply_parameters", JSON.stringify({ message_id: m0.message_id, allow_sending_without_reply: true }));
  fd.append("reply_markup", JSON.stringify({ inline_keyboard: [
    [{ text: "▶ Слушай 1", url: d.suno[0].url }, { text: "▶ Слушай 2", url: d.suno[1].url }],
    [{ text: "✓ Версия 1", callback_data: "v1:" + n }, { text: "✓ Версия 2", callback_data: "v2:" + n }],
    [{ text: "↻ Наново", callback_data: "nanovo:" + n }, { text: "✕ Отказ", callback_data: "otkaz:" + n }]
  ] }));
  // Над 10 MB Telegram не приема снимка — тогава като документ.
  const kato = bytes.length > 9.5e6 ? "document" : "photo";
  fd.append(kato, new Blob([bytes]), path.basename(d.ilyustracia));
  const m1 = await tg(kato === "photo" ? "sendPhoto" : "sendDocument", fd);

  sql(`UPDATE odobrenia SET status='chaka_izbor', suno_v1=${lit(d.suno[0].id)}, suno_v2=${lit(d.suno[1].id)},
       tekst=${lit(d.tekst)}, kie_task=${lit(d.kie_task)}, kie_prompt=${lit(d.kie_prompt)},
       tg_msg1=${m1.message_id}, krediti_suno=COALESCE(krediti_suno,0)+${Number(d.krediti_suno) || 0},
       krediti_kie=COALESCE(krediti_kie,0)+${Number(d.krediti_kie) || 0}, greshka=NULL, updated_at=${lit(sega())}
       WHERE order_no=${lit(n)} AND status='generira'`);
  console.log(JSON.stringify({ ok: true, tg_msg1: m1.message_id }));
}

// данни.json за kachi:
// { "tema": "Песента за … е готова", "toName": "Иван", "html": "…/pismo.html", "text": "…/pismo.txt" (по желание),
//   "page_url": "https://pesenta.bg/pesni/<slug>.html", "mp3": ["…/assets/audio/<slug>.mp3"] }
// Получателят НЕ се подава: взима се от продажбата (Worker-ът проверява същото).
async function kachi(n, fail) {
  proveriNomer(n);
  const d = JSON.parse(fs.readFileSync(fail, "utf8"));
  const o = sql(`SELECT status FROM odobrenia WHERE order_no=${lit(n)}`)[0];
  if (!o || !["izbrana", "spryana", "greshka"].includes(o.status)) throw new Error("status " + (o && o.status) + " не е за качване");
  let s = sql(`SELECT customer_email FROM sales WHERE order_no=${lit(n)} AND customer_email IS NOT NULL LIMIT 1`)[0];
  // Пробните номера PSN-991231-* нямат продажба; Worker-ът ги пуска само до NOTIFY_EMAILS.
  if (!s && /^PSN-991231-/.test(n) && process.env.PROBA_TO) s = { customer_email: process.env.PROBA_TO };
  if (!s) throw new Error("няма имейл в продажбата");
  if (!/^https:\/\/pesenta\.bg\/pesni\/[a-z0-9-]+\.html$/.test(d.page_url || "")) throw new Error("лош page_url");
  const mp3 = [];
  for (const f of d.mp3 || []) {
    const ime = path.basename(f);
    if (!FAIL_RE.test(ime)) throw new Error("име на MP3 извън [a-z0-9-].mp3: " + ime);
    if (!fs.existsSync(f)) throw new Error("няма файл " + f);
    wr(["r2", "object", "put", "pesenta-pesni/" + n + "/" + ime, "--file", f, "--content-type", "audio/mpeg", "--remote", "--jurisdiction", "eu"]);
    mp3.push({ key: n + "/" + ime, name: ime });
  }
  if (!mp3.length) throw new Error("няма MP3");
  const pismo = {
    to: s.customer_email, toName: d.toName || "", subject: d.tema,
    html: fs.readFileSync(d.html, "utf8"),
    ...(d.text ? { text: fs.readFileSync(d.text, "utf8") } : {}),
    page_url: d.page_url, mp3
  };
  const tmp = path.join(os.tmpdir(), "pismo-" + n + ".json");
  fs.writeFileSync(tmp, JSON.stringify(pismo));
  try {
    wr(["r2", "object", "put", "pesenta-pesni/" + n + "/pismo.json", "--file", tmp, "--content-type", "application/json", "--remote", "--jurisdiction", "eu"]);
  } finally { fs.rmSync(tmp, { force: true }); }
  sql(`UPDATE odobrenia SET mp3_r2=${lit(mp3.map((m) => m.key).join(","))}, page_url=${lit(d.page_url)}, updated_at=${lit(sega())}
       WHERE order_no=${lit(n)}`);
  const r = await fetch(BASE + "/odobrenie/gotova", {
    method: "POST",
    headers: { authorization: "Bearer " + tayna(".pesenta-odobrenie-key"), "content-type": "application/json" },
    body: JSON.stringify({ order_no: n }), signal: AbortSignal.timeout(60000)
  });
  const j = await r.json().catch(() => ({}));
  console.log(JSON.stringify({ http: r.status, ...j }));
  if (!r.ok) process.exit(4);
}

async function rachna(n, prichina) {
  proveriNomer(n);
  const t = sega();
  sql(`INSERT OR IGNORE INTO odobrenia (order_no, status, greshka, created_at, updated_at)
       VALUES (${lit(n)}, 'rachna', ${lit(prichina)}, ${lit(t)}, ${lit(t)})`);
  const s = sql(`SELECT MAX(customer_name) AS ime, GROUP_CONCAT(art_name, ' + ') AS art, SUM(total_eur_c) AS c
                 FROM sales WHERE order_no=${lit(n)}`)[0] || {};
  await pratiTekst("✋ Ръчна поръчка " + n + "\n" + (s.ime || "") + " · " + ((s.c || 0) / 100).toFixed(2).replace(".", ",") +
    " €\n" + (s.art || "") + "\n\nЗащо не е през автомата: " + prichina);
  console.log(JSON.stringify({ ok: true }));
}

async function zaseknata(n, greshka) {
  proveriNomer(n);
  sql(`UPDATE odobrenia SET status='zaseknata', greshka=${lit(greshka)}, updated_at=${lit(sega())} WHERE order_no=${lit(n)}`);
  await pratiTekst("⚠ " + n + " спря: " + greshka + "\nАвтоматът не я пипа повече, докато не кажеш.");
  console.log(JSON.stringify({ ok: true }));
}

const [cmd, a1, a2] = process.argv.slice(2);
const komandi = {
  novi: () => novi(),
  chakashti: () => chakashti(),
  zapochni: () => zapochni(a1, a2 === "--nanovo"),
  snimki: () => snimki(a1, a2),
  tg1: () => tg1(a1, a2),
  kachi: () => kachi(a1, a2),
  rachna: () => rachna(a1, a2 || "без причина"),
  zaseknata: () => zaseknata(a1, a2 || "без описание"),
  belezhka: () => pratiTekst(a1 || "").then(() => console.log('{"ok":true}'))
};
if (!komandi[cmd]) {
  console.error("команди: " + Object.keys(komandi).join(", "));
  process.exit(2);
}
komandi[cmd]().catch((e) => { console.error("ГРЕШКА: " + e.message); process.exit(1); });
