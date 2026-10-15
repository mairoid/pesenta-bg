/* PDF „Ваучер за песен“ (A5 хоризонтално).
   ─────────────────────────────────────────────────
   Чиста функция: данни вътре → байтове на PDF навън. Без env, D1 и мрежа —
   затова се пробва и мери в Node (tools/vaucher-pdf-proba.mjs) точно както
   върви в Worker-а. Зарежда се лениво: index.js го вика с
   `await import("./vaucher-pdf.js")` само в пътя на ваучера, така pdf-lib и
   шрифтовете не се изпълняват при всяка заявка.

   Шрифтовете (fonts/fonts.js) са предварително орязани TTF с кирилица (OFL):
   Unbounded (заглавия, кодът), Manrope (текст), „Pesenta Kuplet“ = орязана
   Lora Italic (посланието). Вграждат се цели, без subset, и то без fontkit:
   файлът е вече компресиран, ширините и картата знак → глиф са сметнати в
   fonts/napravi-shriftove.mjs. pdf-lib embedFont струваше ≈6 ms CPU на шрифт
   (разчитане + компресиране) — над целия лимит на Free плана за 4 шрифта.
   Знак, който го няма в шрифта (емоджи), се маха, вместо да излезе празно
   квадратче. Без кернинг и лигатури (като pdf-lib) — за имена и куплет е добре.

   НИКАКВА цена на ваучера — нито тук, нито в метаданните. */

import {
  PDFDocument, PDFName, PDFString, PDFHexString, PDFOperator, PDFRawStream, rgb, degrees,
  setCharacterSpacing, pushGraphicsState, popGraphicsState, LineCapStyle,
  beginText, endText, setFontAndSize, moveText, showText, setFillingColor,
  concatTransformationMatrix, drawObject
} from "pdf-lib";
import qrcode from "./qrcode.cjs";
import * as SHRIFT from "../fonts/fonts.js";

const W = 595.28, H = 419.53;          /* A5 хоризонтално, pt */
const M = 48;                           /* поле за съдържанието */

const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = {
  bg0: hex("#0B0A1A"), bg1: hex("#12101F"),
  rose: hex("#D2577F"), pink: hex("#FF4D8D"), orange: hex("#FFA14D"),
  text: hex("#F4F2FF"), muted: hex("#A9A4C9"), ink: hex("#0B0A1A")
};

const REZERVEN_KUPLET = ["Тази песен е за теб —", "с обич, от сърце."];

/* ── шрифтове ──────────────────────────────────── */

function b64(s) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

/* Декодира се веднъж на изолат; топлите извиквания ползват готовото. */
class Shrift {
  constructor(d, ime) {
    this.d = d;
    this.ime = ime;
    this.ff = b64(d.ff);
    this.tu = b64(d.tu);
    this.ima = new Set(Object.keys(d.cmap).map(Number));
  }
  has(cp) { return this.ima.has(cp); }
  widthOfTextAtSize(s, size) {
    let w = 0;
    for (const ch of s) w += this.d.adv[this.d.cmap[ch.codePointAt(0)] ?? 0];
    return (w * size) / 1000;
  }
  hex(s) {
    let h = "";
    for (const ch of s) h += (this.d.cmap[ch.codePointAt(0)] ?? 0).toString(16).padStart(4, "0");
    return h;
  }
  /* Type0 / CIDFontType2, Identity-H: кодът в текста = номерът на глифа */
  vgradi(doc) {
    const ctx = doc.context, d = this.d;
    const ff = ctx.register(PDFRawStream.of(ctx.obj({ Filter: "FlateDecode", Length1: d.ffLen }), this.ff));
    const tu = ctx.register(PDFRawStream.of(ctx.obj({ Filter: "FlateDecode" }), this.tu));
    const desc = ctx.register(ctx.obj({
      Type: "FontDescriptor", FontName: d.ps, Flags: d.italic ? 4 | 64 : 4, FontBBox: d.bbox,
      ItalicAngle: d.ia, Ascent: d.asc, Descent: d.desc, CapHeight: d.cap, XHeight: d.xh, StemV: 80,
      FontFile2: ff
    }));
    const cid = ctx.register(ctx.obj({
      Type: "Font", Subtype: "CIDFontType2", BaseFont: d.ps,
      CIDSystemInfo: { Registry: PDFString.of("Adobe"), Ordering: PDFString.of("Identity"), Supplement: 0 },
      FontDescriptor: desc, W: [0, d.adv], CIDToGIDMap: "Identity"
    }));
    return ctx.register(ctx.obj({
      Type: "Font", Subtype: "Type0", BaseFont: d.ps, Encoding: "Identity-H",
      DescendantFonts: [cid], ToUnicode: tu
    }));
  }
}
let SHRIFTOVE = null;
function shriftove() {
  if (!SHRIFTOVE) {
    SHRIFTOVE = {
      display: new Shrift(SHRIFT.unbounded700, "FUnb"),
      body: new Shrift(SHRIFT.manrope500, "FMan"),
      bold: new Shrift(SHRIFT.manrope700, "FManB"),
      lyric: new Shrift(SHRIFT.kuplet400i, "FKup")
    };
  }
  return SHRIFTOVE;
}

/* ── текст ─────────────────────────────────────── */

/* Един ред: без контролни знаци, без двойни интервали, само знаци, които
   шрифтът има. */
function chist(s, font) {
    const t = String(s == null ? "" : s).normalize("NFC")
    .replace(/[\x00-\x1F\x7F-\x9F]+/g, " ")  /* \s по-долу хваща и U+2028, U+00A0, U+3000… */
    .replace(/\s+/g, " ").trim();
  let out = "";
  for (const ch of t) if (ch === " " || font.has(ch.codePointAt(0))) out += ch;
  return out.replace(/\s+/g, " ").trim();
}

/* Българска типография при пренасяне: еднобуквените предлози и съюзи
   (с, в, и, а, о, у, к) не остават в края на реда, тирето не започва ред.
   Неделимият интервал (U+00A0) е в шрифтовете. */
const NBSP = String.fromCharCode(0xA0);
function svarzhi(s) {
  return s.replace(/(^| )([свиаоукСВИАОУК]) /g, "$1$2" + NBSP)
    .replace(/(^| )([свиаоукСВИАОУК]) /g, "$1$2" + NBSP)
    .replace(/ ([—–])/g, NBSP + "$1");
}

const duljina = (s) => [...s].length;
function shirina(font, s, size, cs = 0) {
  if (!s) return 0;
  return font.widthOfTextAtSize(s, size) + cs * (duljina(s) - 1);
}

/* Дума, по-дълга от реда, се реже по знаци (60 знака без интервал). */
function razdeliDumi(dumi, font, size, maxW, cs) {
  const out = [];
  for (const d of dumi) {
    if (shirina(font, d, size, cs) <= maxW) { out.push(d); continue; }
    let parche = "";
    for (const ch of d) {
      if (parche && shirina(font, parche + ch, size, cs) > maxW) { out.push(parche); parche = ch; }
      else parche += ch;
    }
    if (parche) out.push(parche);
  }
  return out;
}

/* Ширините на думите се смятат веднъж; пренасянето събира числа. */
function izmeri(dumi, font, size, cs) {
  return { dumi, ww: dumi.map((d) => shirina(font, d, size, cs)), sp: shirina(font, " ", size) + 2 * cs };
}
function lakomo({ dumi, ww, sp }, limit) {
  const redove = [];
  let red = "", w = 0, nai = 0;
  for (let i = 0; i < dumi.length; i++) {
    if (red && w + sp + ww[i] > limit) { redove.push(red); nai = Math.max(nai, w); red = dumi[i]; w = ww[i]; }
    else if (red) { red += " " + dumi[i]; w += sp + ww[i]; }
    else { red = dumi[i]; w = ww[i]; }
  }
  if (red) { redove.push(red); nai = Math.max(nai, w); }
  redove.nai = nai;  /* най-широкият ред */
  return redove;
}

/* Балансирано пренасяне: най-тясната ширина, при която текстът влиза в
   `broi` реда — редовете стават горе-долу равни, а не „пълен + огризка“.
   tochno: текстът се разпределя точно в `broi` реда (куплетът), дори да
   влиза в по-малко; иначе — в колкото реда влиза, но не повече от `broi`. */
function balansirano(tekst, font, size, maxW, broi, cs = 0, tochno = false) {
  const m = izmeri(razdeliDumi(tekst.split(" ").filter(Boolean), font, size, maxW, cs), font, size, cs);
  const vse = lakomo(m, maxW);
  if (vse.length > broi) return null;
  const cel = tochno ? Math.min(broi, m.dumi.length) : vse.length;
  if (cel <= 1 || broi === 1) return vse;
  let lo = 0, hi = maxW;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const r = lakomo(m, mid);
    if (r.length > cel || r.nai > mid + 0.01) lo = mid; else hi = mid;
  }
  return lakomo(m, hi);
}

/* Най-едрият размер, при който текстът влиза. stupki: [[редове, най-малък
   размер за толкова редове], …] — първо се опитва на един ред, после на два. */
function nameri(tekst, font, maxW, golqm, stupki, csK = 0) {
  for (const [broi, nai] of stupki) {
    for (let size = golqm; size >= nai - 1e-6; size -= 0.5) {
      const r = balansirano(tekst, font, size, maxW, broi, size * csK);
      if (r) return { size, redove: r, cs: size * csK };
    }
  }
  /* не влиза и на най-малкия размер: последният ред се съкращава */
  const [broi, nai] = stupki[stupki.length - 1];
  const cs = nai * csK;
  const r = lakomo(izmeri(razdeliDumi(tekst.split(" ").filter(Boolean), font, nai, maxW, cs), font, nai, cs), maxW).slice(0, broi);
  let p = r[r.length - 1];
  while (p && shirina(font, p + "…", nai, cs) > maxW) p = [...p].slice(0, -1).join("");
  r[r.length - 1] = p + "…";
  return { size: nai, redove: r, cs };
}

function pishi(page, s, o) {
  if (!s) return;
  const ops = [pushGraphicsState(), beginText(), setFillingColor(o.color), setFontAndSize(o.font.ime, o.size)];
  if (o.cs) ops.push(setCharacterSpacing(o.cs));
  ops.push(moveText(o.x, o.y), showText(PDFHexString.of(o.font.hex(s))), endText(), popGraphicsState());
  page.pushOperators(...ops);
}

/* ── графика ───────────────────────────────────── */

function resursi(page, vid) {
  page.node.normalize();
  const res = page.node.Resources();
  let d = res.lookup(PDFName.of(vid));
  if (!d) { d = page.doc.context.obj({}); res.set(PDFName.of(vid), d); }
  return d;
}

/* Истински преливки (PDF shading), не ивици: гладко и евтино. */
function zasenchvane(page, ime, dict) {
  const ctx = page.doc.context;
  resursi(page, "Shading").set(PDFName.of(ime), ctx.register(ctx.obj(dict)));
}
function sh(page, ime, gs) {
  const ops = [pushGraphicsState()];
  if (gs) ops.push(PDFOperator.of("gs", [PDFName.of(gs)]));
  ops.push(PDFOperator.of("sh", [PDFName.of(ime)]), popGraphicsState());
  page.pushOperators(...ops);
}
const cvqt = (c) => [c.red, c.green, c.blue];

function fon(page) {
  zasenchvane(page, "ShFon", {
    ShadingType: 2, ColorSpace: "DeviceRGB", Coords: [0, H, W, 0], Extend: [true, true],
    Function: { FunctionType: 2, Domain: [0, 1], C0: cvqt(C.bg0), C1: cvqt(C.bg1), N: 1 }
  });
  sh(page, "ShFon");
}

/* Сияния с режим Screen: черното не променя нищо, цветът „свети“ отгоре. */
function siqniq(page) {
  const ctx = page.doc.context;
  resursi(page, "ExtGState").set(PDFName.of("GsScr"), ctx.register(ctx.obj({ Type: "ExtGState", BM: "Screen" })));
  const kragla = (ime, x, y, r, c, n) => zasenchvane(page, ime, {
    ShadingType: 3, ColorSpace: "DeviceRGB", Coords: [x, y, 0, x, y, r], Extend: [false, false],
    Function: { FunctionType: 2, Domain: [0, 1], C0: c, C1: [0, 0, 0], N: n }
  });
  kragla("ShRoza", W * 0.10, H * 0.92, 330, [0.20, 0.045, 0.10], 0.65);
  kragla("ShOranj", W * 0.96, H * 0.02, 290, [0.17, 0.085, 0.02], 0.65);
  sh(page, "ShRoza", "GsScr");
  sh(page, "ShOranj", "GsScr");
}

function vidSnimka(b) {
  if (!b || b.length < 8) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return "png";
  if (b[0] === 0xFF && b[1] === 0xD8) return "jpg";
  return null;
}

async function snimkaFon(doc, page, bytes, voal = 0.74) {
  const vid = vidSnimka(bytes);
  if (!vid) return false;
  try {
    const img = vid === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const k = Math.max(W / img.width, H / img.height);  /* „cover“ */
    const w = img.width * k, h = img.height * k;
    page.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
    /* тъмен воал за четимост (0.74 — пробвано с пъстра, ярка корица; за тъмния кадър
       от СЦЕНА стига по-лек — подава се отвън) */
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.bg0, opacity: voal });
    return true;
  } catch {
    return false;  /* развален файл → обикновеният тъмен фон, не грешка */
  }
}

function zaobljen(w, h, r) {
  const k = 0.5523 * r;
  return `M${r} 0H${w - r}C${w - r + k} 0 ${w} ${r - k} ${w} ${r}V${h - r}` +
    `C${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h}H${r}C${r - k} ${h} 0 ${h - r + k} 0 ${h - r}` +
    `V${r}C0 ${r - k} ${r - k} 0 ${r} 0Z`;
}

function ramka(page) {
  const i = 14;
  page.drawRectangle({ x: i, y: i, width: W - 2 * i, height: H - 2 * i, borderColor: C.rose, borderWidth: 0.6, borderOpacity: 0.55 });
  const j = 19;  /* вътрешна, още по-тиха */
  page.drawRectangle({ x: j, y: j, width: W - 2 * j, height: H - 2 * j, borderColor: C.rose, borderWidth: 0.35, borderOpacity: 0.22 });
  const L = 26, t = 1.3;
  const ugli = [[i, i, 1, 1], [W - i, i, -1, 1], [i, H - i, 1, -1], [W - i, H - i, -1, -1]];
  for (const [x, y, sx, sy] of ugli) {
    page.drawLine({ start: { x, y }, end: { x: x + sx * L, y }, thickness: t, color: C.orange, lineCap: LineCapStyle.Round });
    page.drawLine({ start: { x, y }, end: { x, y: y + sy * L }, thickness: t, color: C.orange, lineCap: LineCapStyle.Round });
  }
}

/* Логото V1 (същите пътища като logo-domain.svg в kartichka.js): вълна +
   нота, до него „pesenta.bg“. Десният край на текста е на xDqsno. */
function logo(page, f, xDqsno, base, size) {
  const k = size / 19;
  const tw = f.display.widthOfTextAtSize("pesenta.bg", size);
  const xt = xDqsno - tw;
  pishi(page, "pesenta.bg", { x: xt, y: base, font: f.display, size, color: C.text });
  const X = xt - 58 * k, Y = base + 25 * k, s = 0.085 * k;
  const linia = { x: X, y: Y, scale: s, borderWidth: 28, borderLineCap: LineCapStyle.Round };
  page.drawSvgPath("M30 232 H78 C88 232 92 198 104 198 S130 276 148 276 S174 118 198 118 S228 332 254 332 S284 176 308 176 S336 262 360 262 S388 226 408 232 C416 234 422 240 426 246",
    { ...linia, borderColor: C.pink });
  page.drawSvgPath("M536 236 V88", { ...linia, borderWidth: 30, borderColor: C.orange });
  page.drawSvgPath("M536 88 C570 96 592 118 594 152", { ...linia, borderColor: C.orange });
  page.drawEllipse({ x: X + 500 * s, y: Y - 246 * s, xScale: 40 * s, yScale: 35 * s, rotate: degrees(18), color: C.orange });
}

/* Скрипичен ключ — векторни криви, мерен в единици „междулиние = 10“:
   горната линия е y=0, долната y=40 (y надолу, както в SVG). Спиралата
   се увива около линията сол (y=30). */
const KLUCH = "M14.6 30.6 C10.2 31.4 8.6 26.4 11.6 23.9 C16.4 20.1 23.4 25 21.6 32.2 C20 38.6 12.2 41.4 6.6 37.6 " +
  "C0.4 33.4 1.8 24.4 8.4 18.6 C15.6 12.6 21.8 7 20.8 -2.6 C20.2 -9.6 14.6 -12.6 12.4 -6.6 " +
  "C10.8 -1.8 11.2 6 12.6 18 L15.4 46.6 C16 53.2 12.6 57 8.6 55.6 C6.2 54.8 5.6 51.6 7.4 50.2";

const STEBLO = 1.2;  /* дължина на опашката, в междулиния */
function nota(page, x, y, g, c, opash = true) {
  page.drawEllipse({ x, y, xScale: g * 0.30, yScale: g * 0.22, rotate: degrees(22), color: c });
  if (opash) page.drawLine({ start: { x: x + g * 0.27, y: y + g * 0.05 }, end: { x: x + g * 0.27, y: y + g * (0.05 + STEBLO) }, thickness: 0.9, color: c });
}

function stan(page, f, x0, x1, gornaY, g, redove, size) {
  const linii = [0, 1, 2, 3, 4].map((i) => gornaY - i * g);
  for (const y of linii) {
    page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: 0.6, color: C.muted, opacity: 0.38 });
  }
  /* двойна тактова черта накрая */
  page.drawLine({ start: { x: x1 - 4.5, y: linii[0] }, end: { x: x1 - 4.5, y: linii[4] }, thickness: 0.6, color: C.muted, opacity: 0.45 });
  page.drawLine({ start: { x: x1, y: linii[0] + 0.3 }, end: { x: x1, y: linii[4] - 0.3 }, thickness: 2, color: C.muted, opacity: 0.45 });

  /* ключът: от ~1.2 междулиния над до ~1.6 под стана */
  const s = g / 10;
  page.drawSvgPath(KLUCH, { x: x0 + 2 * s, y: gornaY, scale: s, borderColor: C.pink, borderWidth: 1.15, borderLineCap: LineCapStyle.Round });
  page.drawCircle({ x: x0 + 2 * s + 9.6 * s, y: gornaY - 51.8 * s, size: 1.9 * s, color: C.pink });

  /* декоративни ноти над стана, вдясно */
  const tx0 = x0 + 34 * s, tx1 = x1 - 14;
  const nad = gornaY + g * 0.45;   /* най-ниската глава — над горната линия */
  const xn = (p) => tx0 + (tx1 - tx0) * p;
  nota(page, xn(0.66), nad, g, C.pink);
  nota(page, xn(0.73), nad + g * 0.30, g, C.rose);
  /* двойка осмини с греда */
  const a = xn(0.81), b = xn(0.875), ya = nad + g * 0.05, yb = nad + g * 0.28;
  nota(page, a, ya, g, C.orange, false);
  nota(page, b, yb, g, C.orange, false);
  const sa = { x: a + g * 0.27, y: ya + g * 0.05 }, sb = { x: b + g * 0.27, y: yb + g * 0.05 };
  const vis = g * STEBLO;
  page.drawLine({ start: sa, end: { x: sa.x, y: sa.y + vis }, thickness: 0.9, color: C.orange });
  page.drawLine({ start: sb, end: { x: sb.x, y: sb.y + vis }, thickness: 0.9, color: C.orange });
  page.drawLine({ start: { x: sa.x - 0.45, y: sa.y + vis }, end: { x: sb.x + 0.45, y: sb.y + vis }, thickness: 2.4, color: C.orange });
  /* самотна осмина с флагче */
  const c = xn(0.95), yc = nad + g * 0.12;
  nota(page, c, yc, g, C.pink);
  const fx = c + g * 0.27, fy = yc + g * (0.05 + STEBLO);
  page.drawSvgPath(`M0 0 C1.5 ${g * 0.35} ${g * 0.55} ${g * 0.5} ${g * 0.35} ${g * 1.1}`, { x: fx, y: fy, borderColor: C.pink, borderWidth: 0.9, borderLineCap: LineCapStyle.Round });

  /* куплетът: в междулинията, центриран; n реда → средните междулиния */
  const n = redove.length;
  const start = Math.floor((4 - n) / 2);
  const cx = (tx0 + tx1) / 2;
  redove.forEach((red, i) => {
    const dolna = linii[start + i + 1];
    const y = dolna + g * 0.30;
    const w = shirina(f.lyric, red, size);
    pishi(page, red, { x: cx - w / 2, y, font: f.lyric, size, color: C.text });
  });
  return { tx0, tx1 };
}

/* Посланието → 1–4 реда за стана. Редовете на клиента се пазят, ако са
   2–4 и влизат; иначе думите се пренасят балансирано. */
function kuplet(poslanie, font, maxW, g) {
  const golqm = Math.min(14.5, g * 0.72), nai = 8.5;
  let chasti = String(poslanie == null ? "" : poslanie).split(/\r?\n/).map((r) => svarzhi(chist(r, font))).filter(Boolean);
  if (!chasti.length) chasti = REZERVEN_KUPLET;
  if (chasti.length >= 2 && chasti.length <= 4) {
    for (let size = golqm; size >= 11 - 1e-6; size -= 0.5) {
      if (chasti.every((r) => shirina(font, r, size) <= maxW)) return { size, redove: chasti };
    }
  }
  /* повече от 4 реда на клиента: границите остават видими като „/“ (както
     в текст на песен на един ред); наклонената не започва ред */
  const tekst = chasti.join(NBSP + "/ ");
  const dumi = tekst.split(" ").length;
  for (let size = golqm; size >= nai - 1e-6; size -= 0.5) {
    const cqlo = shirina(font, tekst, size);
    let broi = Math.max(Math.min(2, dumi), Math.ceil(cqlo / (maxW * 0.86)));
    for (; broi <= 4; broi++) {
      const r = balansirano(tekst, font, size, maxW, broi, 0, true);
      if (r) return { size, redove: r };
    }
  }
  return nameri(tekst, font, maxW, nai, [[4, nai]]);
}

function qr(page, link, x, y, strana) {
  const q = qrcode(0, "M");
  q.addData(link);
  q.make();
  const n = q.getModuleCount();
  const tiha = 3;  /* тиха зона в модули, вътре в светлата плочка */
  const m = strana / (n + 2 * tiha);
  page.drawSvgPath(zaobljen(strana, strana, 6), { x, y: y + strana, color: C.text });
  /* модулите — като Form XObject в цели числа (1 модул = 1 единица), мащабът
     е в матрицата: евтино за CPU и остро при всяко увеличение */
  const ink = C.ink;
  let p = `${ink.red.toFixed(3)} ${ink.green.toFixed(3)} ${ink.blue.toFixed(3)} rg\n`;
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!q.isDark(r, c)) { c++; continue; }
      const c0 = c;
      while (c < n && q.isDark(r, c)) c++;
      p += `${c0} ${n - 1 - r} ${c - c0} 1 re\n`;
    }
  }
  p += "f\n";
  const ctx = page.doc.context;
  const ref = ctx.register(PDFRawStream.of(ctx.obj({ Type: "XObject", Subtype: "Form", BBox: [0, 0, n, n] }), new TextEncoder().encode(p)));
  page.node.setXObject(PDFName.of("XQr"), ref);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(m, 0, 0, m, x + tiha * m, y + tiha * m), drawObject("XQr"), popGraphicsState());
}

function vrazka(doc, page, link, x, y, w, h) {
  const ctx = doc.context;
  const annot = ctx.register(ctx.obj({
    Type: "Annot", Subtype: "Link", Rect: [x, y, x + w, y + h], Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(link) }
  }));
  page.node.addAnnot(annot);
}

/* ── сглобяване ────────────────────────────────── */

export async function vaucherPdf({ kod, za_kogo, ot_kogo, poslanie, link, fon: fonBaitove, voal } = {}) {
  const doc = await PDFDocument.create();
  const f = shriftove();
  const KOD = chist(kod, f.display).toUpperCase() || "—";
  const LINK = String(link || `https://pesenta.bg/?kod=${encodeURIComponent(KOD)}#order`);

  doc.setTitle("Ваучер за песен · pesenta.bg");
  doc.setSubject("Подарък: песен по поръчка");
  doc.setAuthor("pesenta.bg");
  doc.setCreator("pesenta.bg");
  doc.setProducer("pesenta.bg");
  doc.setLanguage("bg");

  const page = doc.addPage([W, H]);
  for (const sh of Object.values(f)) page.node.setFontDictionary(PDFName.of(sh.ime), sh.vgradi(doc));
  fon(page);
  if (fonBaitove) await snimkaFon(doc, page, fonBaitove instanceof Uint8Array ? fonBaitove : new Uint8Array(fonBaitove), voal);
  siqniq(page);
  ramka(page);

  /* горе: етикет вляво, логото вдясно */
  const glava = H - 50;
  pishi(page, "ВАУЧЕР ЗА ПЕСЕН", { x: M, y: glava, font: f.bold, size: 7.5, cs: 2.4, color: C.pink });
  logo(page, f, W - M, glava - 1, 10.5);
  vrazka(doc, page, "https://pesenta.bg/", W - M - 90, glava - 6, 90, 20);

  /* „За <име>“ — едро; „За“ розово, името бяло */
  const za = svarzhi(chist(za_kogo, f.display)) || "теб";
  const zaglavie = nameri("За " + za, f.display, W - 2 * M, 30, [[1, 19], [2, 12]], -0.01);
  let y = glava - 26 - zaglavie.size * 0.74;
  zaglavie.redove.forEach((red, i) => {
    if (i === 0 && red.startsWith("За ")) {
      const pref = "За ";
      pishi(page, pref, { x: M, y, font: f.display, size: zaglavie.size, cs: zaglavie.cs, color: C.pink });
      pishi(page, red.slice(pref.length), { x: M + shirina(f.display, pref, zaglavie.size, zaglavie.cs) + zaglavie.cs, y, font: f.display, size: zaglavie.size, cs: zaglavie.cs, color: C.text });
    } else {
      pishi(page, red, { x: M, y, font: f.display, size: zaglavie.size, cs: zaglavie.cs, color: C.text });
    }
    if (i < zaglavie.redove.length - 1) y -= zaglavie.size * 1.14;
  });

  /* „от <име>“ */
  const ot = svarzhi(chist(ot_kogo, f.body));
  if (ot) {
    const r = nameri("от " + ot, f.body, W - 2 * M, 13, [[1, 10], [2, 8]]);
    y -= 12 + r.size;
    r.redove.forEach((red, i) => {
      if (i === 0 && red.startsWith("от ")) {
        pishi(page, "от ", { x: M, y, font: f.body, size: r.size, color: C.orange });
        pishi(page, red.slice(3), { x: M + shirina(f.body, "от ", r.size), y, font: f.body, size: r.size, color: C.muted });
      } else {
        pishi(page, red, { x: M, y, font: f.body, size: r.size, color: C.muted });
      }
      if (i < r.redove.length - 1) y -= r.size * 1.3;
    });
  }

  /* нотният стан — между имената и долната лента */
  /* блокът е 2 междулиния над горната линия (нотите) + 4 (станът) + 1.6
     под долната (опашката на ключа); долната лента (етикетът на кода) — под 130 */
  const gore = y - 13, dolu = 130;
  const g = Math.min(22, (gore - dolu) / 7.6);
  const gorna = (gore - 2 * g + dolu + 5.6 * g) / 2;
  const s = g / 10;
  const tx0 = M + 34 * s, tx1 = W - M - 14;
  const kp = kuplet(poslanie, f.lyric, tx1 - tx0 - 8, g);
  stan(page, f, M, W - M, gorna, g, kp.redove, kp.size);

  /* долу: кодът в рамка, QR вдясно, как се ползва */
  const qrS = 86, qrX = W - M - qrS, qrY = 34;
  qr(page, LINK, qrX, qrY, qrS);
  vrazka(doc, page, LINK, qrX, qrY, qrS, qrS);

  const kutX = M, kutY = 64, kutW = Math.min(340, qrX - 26 - M), kutH = 40;
  pishi(page, "КОД НА ПОДАРЪКА", { x: kutX, y: kutY + kutH + 10, font: f.bold, size: 6.8, cs: 2, color: C.muted });
  page.drawSvgPath(zaobljen(kutW, kutH, 8), { x: kutX, y: kutY + kutH, color: C.text, opacity: 0.04, borderColor: C.orange, borderWidth: 0.9, borderOpacity: 0.9 });
  const k = nameri(KOD, f.display, kutW - 28, 17, [[1, 8]], 0.14);
  const kw = shirina(f.display, k.redove[0], k.size, k.cs);
  pishi(page, k.redove[0], { x: kutX + (kutW - kw) / 2, y: kutY + kutH / 2 - k.size * 0.36, font: f.display, size: k.size, cs: k.cs, color: C.text });
  vrazka(doc, page, LINK, kutX, kutY, kutW, kutH);

  pishi(page, "Осребри на pesenta.bg — въведи кода или сканирай.", { x: kutX, y: 47, font: f.body, size: 8.6, color: C.muted });
  pishi(page, "Важи веднъж, без срок.", { x: kutX, y: 35.5, font: f.body, size: 8.6, color: C.text });

  /* objectsPerTick: без паузи setTimeout(0) между обектите — иначе pdf-lib
     чака таймера на всеки 50 обекта (празно време, не CPU, но бави) */
  return doc.save({ useObjectStreams: false, objectsPerTick: Infinity });
}
