/* Шрифтовете за PDF ваучера: орязване и вграждане в Worker-а.
   ─────────────────────────────────────────────────
   pdf-lib не чете woff2, затова PDF-ът ползва TTF. Изворът са статичните
   инстанции от Google Fonts (google/fonts държи само variable файлове),
   вече орязани от самия Google Fonts API до нужните знаци:

     https://fonts.googleapis.com/css2?family=Unbounded:wght@700&text=<ЗНАЦИ>
     (същото за Manrope:wght@500, Manrope:wght@700, Lora:ital,wght@1,400)

   ЗНАЦИ = U+0020–007E, U+00A0–017F, U+0400–045F, U+2010–2015, U+2018–201E,
   U+2020–2022, U+2026, U+2039–203A, U+20AC, U+2116 (латиница, латиница-1,
   Latin Extended-A за чужди имена, кирилица, типографска пунктуация, €, №).
   CSS-ът дава адрес към fonts.gstatic.com/l/font?kit=… — TTF.

   Този скрипт (само локално, не влиза в Worker-а):
   1. маха таблиците GPOS/GSUB/GDEF/STAT — pdf-lib не ползва кернинг и
      позиционирането от тях, а те са половината файл;
   2. преименува Lora: лицензът ѝ (OFL) пази името „Lora“ (Reserved Font
      Name) и орязаната версия не може да се казва така → „Pesenta Kuplet“;
      авторското право и лицензът в name таблицата остават;
   3. пише орязаните TTF тук и fonts.js, който vaucher-pdf.js импортира —
      без [[rules]] в wrangler.toml. В fonts.js всичко е сметнато
      предварително: TTF-ът вече компресиран (FlateDecode), ToUnicode
      картата, ширините на всички глифове и таблицата знак → глиф. Така в
      Worker-а няма fontkit, няма разчитане на шрифта и няма компресиране —
      при мерене (pdf-lib embedFont, без subset) това бяха ~2/3 от CPU
      времето на един PDF, ≈6 ms на шрифт.

   Пускане (от корена на репото):
     node worker/fonts/napravi-shriftove.mjs <папка с изтеглените TTF>
   Очаква: unbounded-700.ttf, manrope-500.ttf, manrope-700.ttf,
   lora-italic-400.ttf. Лицензите: OFL-*.txt в тази папка. */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import fontkit from "@pdf-lib/fontkit";

const TUK = dirname(fileURLToPath(import.meta.url));
const IZVOR = process.argv[2];
if (!IZVOR) { console.error("Подай папката с изтеглените TTF."); process.exit(1); }

const SHRIFTOVE = [
  { kluch: "unbounded700", vhod: "unbounded-700.ttf", izhod: "Unbounded-Bold-pdf.ttf" },
  { kluch: "manrope500", vhod: "manrope-500.ttf", izhod: "Manrope-Medium-pdf.ttf" },
  { kluch: "manrope700", vhod: "manrope-700.ttf", izhod: "Manrope-Bold-pdf.ttf" },
  { kluch: "kuplet400i", vhod: "lora-italic-400.ttf", izhod: "PesentaKuplet-Italic.ttf",
    italic: true, ime: { family: "Pesenta Kuplet", style: "Italic", ps: "PesentaKuplet-Italic" } }
];

const MAHNI = new Set(["GPOS", "GSUB", "GDEF", "STAT", "DSIG"]);

function tablici(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = dv.getUint16(4);
  const out = [];
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    const tag = String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
    const off = dv.getUint32(o + 8), len = dv.getUint32(o + 12);
    out.push({ tag, data: buf.subarray(off, off + len) });
  }
  return { sfnt: dv.getUint32(0), tabs: out };
}

/* name таблица наново: пазим само Windows записите (платформа 3, Unicode),
   с подменени имена; авторското право (0), версията (5), лицензът (13, 14)
   и останалите остават както са. */
function novoIme(data, ime) {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const count = dv.getUint16(2), strOff = dv.getUint16(4);
  const zapisi = [];
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 12;
    const pl = dv.getUint16(o), enc = dv.getUint16(o + 2), lang = dv.getUint16(o + 4);
    const id = dv.getUint16(o + 6), len = dv.getUint16(o + 8), off = dv.getUint16(o + 10);
    if (pl !== 3) continue;
    let s = "";
    for (let k = 0; k < len; k += 2) s += String.fromCharCode(dv.getUint16(strOff + off + k));
    zapisi.push({ pl, enc, lang, id, s });
  }
  const zamesti = {
    1: ime.family, 2: ime.style, 3: `${ime.ps};pesenta.bg-2026-10`,
    4: `${ime.family} ${ime.style}`, 6: ime.ps, 16: ime.family, 17: ime.style,
    21: ime.family, 22: ime.style
  };
  for (const z of zapisi) if (zamesti[z.id] != null) z.s = zamesti[z.id];
  for (const z of zapisi) {
    if (z.id !== 0 && z.id !== 13 && z.id !== 14 && /Lora/.test(z.s)) {
      throw new Error(`Името „Lora“ остана в запис ${z.id}: ${z.s}`);
    }
  }
  zapisi.sort((a, b) => a.pl - b.pl || a.enc - b.enc || a.lang - b.lang || a.id - b.id);
  const strs = zapisi.map((z) => {
    const b = new Uint8Array(z.s.length * 2);
    for (let k = 0; k < z.s.length; k++) { b[2 * k] = z.s.charCodeAt(k) >> 8; b[2 * k + 1] = z.s.charCodeAt(k) & 255; }
    return b;
  });
  const head = 6 + zapisi.length * 12;
  const total = head + strs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  const w = new DataView(out.buffer);
  w.setUint16(0, 0); w.setUint16(2, zapisi.length); w.setUint16(4, head);
  let off = 0;
  zapisi.forEach((z, i) => {
    const o = 6 + i * 12;
    w.setUint16(o, z.pl); w.setUint16(o + 2, z.enc); w.setUint16(o + 4, z.lang);
    w.setUint16(o + 6, z.id); w.setUint16(o + 8, strs[i].length); w.setUint16(o + 10, off);
    out.set(strs[i], head + off);
    off += strs[i].length;
  });
  return out;
}

function sbor(data) {
  let s = 0;
  const pad = new Uint8Array((data.length + 3) & ~3);
  pad.set(data);
  const dv = new DataView(pad.buffer);
  for (let i = 0; i < pad.length; i += 4) s = (s + dv.getUint32(i)) >>> 0;
  return s;
}

function sglobi(sfnt, tabs) {
  tabs = [...tabs].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const n = tabs.length;
  let es = 0; while ((1 << (es + 1)) <= n) es++;
  const sr = (1 << es) * 16;
  let off = 12 + n * 16;
  const pos = tabs.map((t) => { const p = off; off += (t.data.length + 3) & ~3; return p; });
  const out = new Uint8Array(off);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, sfnt); dv.setUint16(4, n); dv.setUint16(6, sr); dv.setUint16(8, es); dv.setUint16(10, n * 16 - sr);
  let headPos = -1;
  tabs.forEach((t, i) => {
    let data = t.data;
    if (t.tag === "head") { data = new Uint8Array(data); new DataView(data.buffer).setUint32(8, 0); headPos = pos[i]; }
    const o = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[o + k] = t.tag.charCodeAt(k);
    dv.setUint32(o + 4, sbor(data)); dv.setUint32(o + 8, pos[i]); dv.setUint32(o + 12, data.length);
    out.set(data, pos[i]);
  });
  dv.setUint32(headPos + 8, (0xB1B0AFBA - sbor(out)) >>> 0);
  return out;
}

/* ToUnicode: глиф → знак, за да се копира и търси текстът в PDF-а */
function toUnicode(obratno) {
  const hex4 = (n) => n.toString(16).toUpperCase().padStart(4, "0");
  const dvoiki = [...obratno.entries()].sort((a, b) => a[0] - b[0]);
  let t = "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n" +
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n" +
    "/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n" +
    "1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n";
  for (let i = 0; i < dvoiki.length; i += 100) {
    const ch = dvoiki.slice(i, i + 100);
    t += `${ch.length} beginbfchar\n` + ch.map(([g, cp]) => `<${hex4(g)}> <${hex4(cp)}>`).join("\n") + "\nendbfchar\n";
  }
  return t + "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend";
}

function metriki(bytes, italic) {
  const f = fontkit.create(bytes);
  const k = 1000 / f.unitsPerEm;
  const r = (v) => Math.round(v * k);
  const cmap = {};            /* знак → глиф */
  const obratno = new Map();  /* глиф → знак (интервалът печели пред NBSP) */
  for (const cp of f.characterSet) {
    const g = f.glyphForCodePoint(cp).id;
    cmap[cp] = g;
    if (!obratno.has(g) || cp === 0x20) obratno.set(g, cp);
  }
  const adv = [];
  for (let g = 0; g < f.numGlyphs; g++) adv.push(r(f.getGlyph(g).advanceWidth));
  const bb = f.bbox;
  return {
    ps: f.postscriptName, italic,
    bbox: [r(bb.minX), r(bb.minY), r(bb.maxX), r(bb.maxY)],
    asc: r(f.ascent), desc: r(f.descent), cap: r(f.capHeight), xh: r(f.xHeight),
    ia: f.italicAngle || 0,
    ff: Buffer.from(deflateSync(bytes, { level: 9 })).toString("base64"), ffLen: bytes.length,
    tu: Buffer.from(deflateSync(Buffer.from(toUnicode(obratno), "latin1"), { level: 9 })).toString("base64"),
    adv, cmap
  };
}

let js = `/* ГЕНЕРИРАН ФАЙЛ — не се пипа на ръка. Прави го fonts/napravi-shriftove.mjs.
   Орязани TTF (латиница + кирилица + пунктуация) за PDF ваучера, сметнати
   предварително: ff = TTF, компресиран за FlateDecode (base64); tu = ToUnicode
   (FlateDecode, base64); adv = ширини на глифовете (1/1000 em); cmap = знак →
   глиф. Лицензи: SIL OFL 1.1 (OFL-*.txt в тази папка). */\n`;
const obshto = [];
for (const s of SHRIFTOVE) {
  const vhod = new Uint8Array(readFileSync(join(IZVOR, s.vhod)));
  const magic = [...vhod.subarray(0, 4)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (magic !== "00010000") throw new Error(`${s.vhod} не е TrueType (${magic})`);
  const { sfnt, tabs } = tablici(vhod);
  let nov = tabs.filter((t) => !MAHNI.has(t.tag));
  if (s.ime) nov = nov.map((t) => (t.tag === "name" ? { tag: "name", data: novoIme(t.data, s.ime) } : t));
  const bytes = sglobi(sfnt, nov);
  /* проверка: fontkit го чете, знаците и ширините са същите */
  const a = fontkit.create(vhod), b = fontkit.create(bytes);
  if (a.characterSet.length !== b.characterSet.length) throw new Error(`${s.izhod}: различни знаци`);
  const proba = "За Мария от Иван — „Песен“ KRASI-SERENADA-7KQ5X Ёё Šš €";
  /* ширините без кернинг (кернингът е в махнатия GPOS; pdf-lib и без това не го ползва) */
  const shir = (f) => [...proba].reduce((x, c) => x + f.glyphForCodePoint(c.codePointAt(0)).advanceWidth, 0);
  const wa = shir(a), wb = shir(b);
  if (wa !== wb) throw new Error(`${s.izhod}: различна ширина ${wa} / ${wb}`);
  writeFileSync(join(TUK, s.izhod), bytes);
  js += `export const ${s.kluch} = ${JSON.stringify(metriki(bytes, !!s.italic))};\n`;
  obshto.push(bytes.length);
  console.log(`${s.izhod.padEnd(28)} ${String(vhod.length).padStart(7)} → ${String(bytes.length).padStart(7)} B  ` +
    `знаци ${b.characterSet.length}, глифове ${b.numGlyphs}, име ${b.postscriptName}`);
}
writeFileSync(join(TUK, "fonts.js"), js);
console.log(`общо ${obshto.reduce((x, y) => x + y, 0)} B TTF; fonts.js ${Buffer.byteLength(js)} B`);
