/* Отчет за събитията от сайта (D1 `sabitiya`, 14.10.2026) — без AUDIT_TOKEN, през wrangler.
   node tools/sabitiya.mjs [дни]     (по подразбиране 7)

   Печата: броеве по действие за периода, по дни, и простата фуния
   отворена форма → започнат глас → изпратена поръчка. Данните са анонимни
   (име на действие, страница без параметри, време) — виж поверителността. */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dni = Math.max(1, Math.min(90, parseInt(process.argv[2] || "7", 10) || 7));
const ot = new Date(Date.now() - dni * 864e5).toISOString().slice(0, 10);
const worker = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "worker");

function zayavka(sql) {
  /* заявката е в двойни кавички за командния ред; в нея има само единични.
     До 3 опита: D1 понякога връща 7403 („account not authorized“) и минава при втория. */
  let posledna;
  for (let opit = 1; opit <= 3; opit++) {
    try {
      const out = execSync("npx wrangler d1 execute pesenta-nap --remote --json --command \"" + sql + "\"",
        { cwd: worker, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      const j = JSON.parse(out.slice(out.indexOf("[")));
      return j[0].results || [];
    } catch (e) {
      posledna = e;
      execSync(process.platform === "win32" ? "ping -n 4 127.0.0.1 >nul" : "sleep 3");
    }
  }
  throw new Error("D1 не отговаря след 3 опита: " + String(posledna && (posledna.stdout || posledna.message)).slice(0, 300));
}

const poIme = zayavka(`SELECT ime, count(*) AS n FROM sabitiya WHERE ts >= '${ot}' GROUP BY ime ORDER BY n DESC`);
const poDen = zayavka(`SELECT substr(ts,1,10) AS den, ime, count(*) AS n FROM sabitiya WHERE ts >= '${ot}' GROUP BY den, ime ORDER BY den DESC, n DESC`);
const stranici = zayavka(`SELECT stranica, count(*) AS n FROM sabitiya WHERE ts >= '${ot}' AND ime IN ('Order Form Open','Song Page CTA','Order CTA Click') GROUP BY stranica ORDER BY n DESC LIMIT 8`);

const n = (ime) => (poIme.find((r) => r.ime === ime) || { n: 0 }).n;
const pr = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");

console.log(`Събития от ${ot} (последни ${dni} дни)\n`);
if (!poIme.length) { console.log("  няма записани събития за периода"); process.exit(0); }
poIme.forEach((r) => console.log("  " + String(r.n).padStart(5) + "  " + r.ime));

console.log("\nФуния");
console.log("  пусната проба (15 с):     " + n("Hero Sample Play"));
console.log("  отворена форма:           " + n("Order Form Open"));
console.log("  започнат глас:            " + n("Voice Start") + "  (" + pr(n("Voice Start"), n("Order Form Open")) + " от отворилите)");
console.log("  изпратена поръчка:        " + n("Order Submitted") + "  (" + pr(n("Order Submitted"), n("Order Form Open")) + " от отворилите)");
console.log("  вход от страница на песен: " + n("Song Page CTA"));

console.log("\nПо дни");
let den = "";
poDen.forEach((r) => { if (r.den !== den) { den = r.den; console.log("  " + den); } console.log("    " + String(r.n).padStart(4) + "  " + r.ime); });

if (stranici.length) {
  console.log("\nОткъде тръгват към формата (страница)");
  stranici.forEach((r) => console.log("  " + String(r.n).padStart(5) + "  " + (r.stranica || "—")));
}
console.log("\nПлащанията са в Stripe/D1 sales — тук е само какво се натиска.");
