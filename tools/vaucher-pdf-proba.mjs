/* Проба на PDF ваучера (worker/src/vaucher-pdf.js) — без мрежа, без Worker.
   ─────────────────────────────────────────────────
   Прави 4 образеца с измислени имена (кратки; 60-знакови имена;
   300-знаково послание; празно послание) и по желание 5-и с фон-картинка,
   мери CPU (process.cpuUsage — студено и топло) и размера, проверява:
   започва с %PDF, една страница, текстът (pdftotext, ако го има) съдържа
   кода и имената и НЯМА цена.

   Образците НЕ влизат в репото (публично е): пишат се в подадената папка,
   а без аргумент — в scratch папката на Claude. Папка в репото се отказва.

     node tools/vaucher-pdf-proba.mjs [папка] [--fon <jpg|png>]

   Код 1 при FAIL. */

import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, resolve, dirname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRATCH = "C:\\Users\\bauph\\AppData\\Local\\Temp\\claude\\D--My-Documents-2026-Cyber-Hora-THIRD-BRAIN\\0e318c9f-835f-4f86-8e81-56ea76cfd73b\\scratchpad\\vaucher-pdf";

const args = process.argv.slice(2);
let fonPat = null;
const iFon = args.indexOf("--fon");
if (iFon >= 0) { fonPat = args[iFon + 1]; args.splice(iFon, 2); }
const PAPKA = resolve(args[0] || SCRATCH);
if ((PAPKA + sep).toLowerCase().startsWith((REPO + sep).toLowerCase())) {
  console.error(`FAIL: папката ${PAPKA} е в репото — образците не се пишат там.`);
  process.exit(1);
}
mkdirSync(PAPKA, { recursive: true });

const ms = (u) => ((u.user + u.system) / 1000).toFixed(2);

/* Студено: вносът на модула (pdf-lib, fontkit, base64 низовете) */
const c0 = process.cpuUsage();
const { vaucherPdf } = await import(pathToFileURL(join(REPO, "worker", "src", "vaucher-pdf.js")).href);
const cImport = process.cpuUsage(c0);

const POSLANIE_300 = "Мила моя, тази песен е за всичките ни лета на морето, за смеха ти сутрин, " +
  "за кафето на терасата и за онази вечер, когато валеше и танцувахме боси. Благодаря ти, " +
  "че си до мен — в хубавото и в трудното. Нека тази мелодия ти напомня, че те обичам " +
  "повече от вчера. Честит празник, слънце мое, и наздраве!";
if ([...POSLANIE_300].length !== 300) throw new Error(`посланието е ${[...POSLANIE_300].length} знака, а трябва 300`);

const OBRAZCI = [
  { ime: "1-kratki", kod: "MIRA-SERENADA-7KQ5X", za_kogo: "Мира", ot_kogo: "Краси",
    poslanie: "Честит рожден ден!\nДа пееш с пълно гърло." },
  { ime: "2-dalgi-imena", kod: "ANASTASIYA-NAZDRAVE-W8HZ3",
    za_kogo: "Анастасия-Виктория Константинова и цялото ѝ голямо семейство".slice(0, 60),
    ot_kogo: "Колегите от счетоводството, склада и рецепцията на хотела".slice(0, 60),
    poslanie: "За най-добрата шефка — с благодарност за всяка усмивка." },
  { ime: "3-dalgo-poslanie", kod: "BOBI-MELODIA-R4TNE", za_kogo: "Боби", ot_kogo: "Цвети",
    poslanie: POSLANIE_300 },
  { ime: "4-prazno-poslanie", kod: "TONI-PRIPEV-K9XQM", za_kogo: "Тони", ot_kogo: "", poslanie: "" },
  /* крайни случаи: емоджи (махат се), латиница с диакритика, 60 знака без
     интервал, 6 реда на клиента (повече от 4 → пренасят се наново) */
  { ime: "5-kraini", kod: "ZOE-HIMN-P2MRT", za_kogo: "Zoë Müller-Łukasiewicz 🎉", ot_kogo: "ТърговскаКъщаПесниИПразнициБезИнтервалНикъдеДоШейсетЗнака!!".slice(0, 60),
    poslanie: ["Ред едно 🎶", "ред две", "ред три", "ред четири", "ред пет", "ред шест — край."].join("\n") }
];
if (fonPat) OBRAZCI.push({ ...OBRAZCI[0], ime: "6-s-fon", fon: new Uint8Array(readFileSync(fonPat)) });

/* pdftotext -v излиза с код ≠ 0 при някои версии — гледа се само дали го има */
const pdftotext = !spawnSync("pdftotext", ["-v"], { stdio: "ignore" }).error;

const proverki = [];
const ok = (uslovie, opis) => { proverki.push([uslovie, opis]); return uslovie; };
const rezultati = [];
const toplo = [];
const SERIJA = 100;

for (const [i, o] of OBRAZCI.entries()) {
  const link = `https://pesenta.bg/?kod=${o.kod}#order`;
  const vhod = { kod: o.kod, za_kogo: o.za_kogo, ot_kogo: o.ot_kogo, poslanie: o.poslanie, link, fon: o.fon };
  const t = process.cpuUsage();
  const pdf = await vaucherPdf(vhod);
  const cpu = process.cpuUsage(t);
  const pat = join(PAPKA, `vaucher-${o.ime}.pdf`);
  writeFileSync(pat, pdf);
  const glava = Buffer.from(pdf.subarray(0, 5)).toString("latin1");
  ok(glava === "%PDF-", `${o.ime}: започва с %PDF-`);
  const stranici = (Buffer.from(pdf).toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok(stranici === 1, `${o.ime}: една страница (${stranici})`);
  if (pdftotext) {
    const txtPat = pat.replace(/\.pdf$/, ".txt");
    execFileSync("pdftotext", ["-raw", "-enc", "UTF-8", pat, txtPat]);
    const tekst = readFileSync(txtPat, "utf8");
    rmSync(txtPat);
    const sbit = tekst.replace(/\s+/g, "");
    ok(sbit.includes(o.kod.replace(/-/g, "")) || sbit.includes(o.kod), `${o.ime}: кодът се извлича като текст`);
    const parvo = o.za_kogo.split(/\s+/)[0];
    ok(tekst.includes(parvo), `${o.ime}: „${parvo}“ се извлича (кирилица)`);
    ok(!/€|EUR|лв\.|19[,.]90/.test(tekst), `${o.ime}: няма цена`);
    if (!o.poslanie) ok(tekst.includes("Тази песен е за теб"), `${o.ime}: резервният куплет`);
  }
  /* Топло: 3 серии по 20; взима се най-добрата серия (най-малко шум от
     другите процеси), плюс стената (performance.now) за сравнение */
  let najCpu = Infinity, najStena = Infinity;
  for (let serija = 0; serija < 3; serija++) {
    const tc = process.cpuUsage(), ts = performance.now();
    for (let k = 0; k < SERIJA; k++) await vaucherPdf(vhod);
    const u = process.cpuUsage(tc);
    najCpu = Math.min(najCpu, (u.user + u.system) / 1000 / SERIJA);
    najStena = Math.min(najStena, (performance.now() - ts) / SERIJA);
  }
  rezultati.push({ obrazec: o.ime, kb: (pdf.length / 1024).toFixed(1),
    parvo_cpu_ms: i === 0 ? ms(cpu) + " (студено)" : ms(cpu),
    toplo_cpu_ms: najCpu.toFixed(2), toplo_stena_ms: najStena.toFixed(2) });
  toplo.push(najCpu);
}


console.log(`Вносът на модула (студено): ${ms(cImport)} ms CPU`);
console.table(rezultati);
console.log(`Топло (най-добрата от 3 серии по ${SERIJA}): най-тежкият образец ${Math.max(...toplo).toFixed(2)} ms CPU на PDF`);
console.log("Бележка: process.cpuUsage в Windows е на стъпки от ~15.6 ms — „първо“ е грубо; топлите са средни от серия.");
if (!pdftotext) console.log("pdftotext го няма — текстът не е проверен (само %PDF и брой страници).");
let fail = 0;
for (const [u, opis] of proverki) { console.log(`${u ? "OK  " : "FAIL"} ${opis}`); if (!u) fail++; }
console.log(`Образците: ${PAPKA}`);
console.log(fail ? `FAIL: ${fail}` : "OK: всички проверки");
process.exit(fail ? 1 : 0);
