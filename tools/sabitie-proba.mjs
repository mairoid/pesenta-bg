/* Анонимните събития (/sabitie, 14.10.2026) — проверка без мрежа.
   Базата е SQLite в паметта (node:sqlite) със същата таблица като worker/schema.sql.
   Пази: (1) познато събитие се записва с път без ?/#; (2) непознато, голямо и счупено
   тяло се отхвърлят; (3) имейл и нови редове не стигат до базата. Код 1 при FAIL. */
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { handleSabitie, SABITIYA } from "../worker/src/index.js";

let gr = 0, ok = 0;
const proveri = (u, o) => { if (u) ok++; else { gr++; console.log("    ✗ " + o); } };

const db = new DatabaseSync(":memory:");
const schema = fs.readFileSync(new URL("../worker/schema.sql", import.meta.url), "utf8");
db.exec(schema.slice(schema.indexOf("CREATE TABLE IF NOT EXISTS sabitiya")));
const DB = { prepare(sql) { const st = db.prepare(sql); let a = [];
  const o = { bind(...x) { a = x; return o; },
    all: async () => ({ results: st.all(...a) }), first: async () => st.get(...a) || null, run: async () => st.run(...a) };
  return o; } };
const env = { DB };
const prati = async (telo) => {
  const r = await handleSabitie(new Request("https://x/sabitie", { method: "POST", body: typeof telo === "string" ? telo : JSON.stringify(telo) }), env);
  return r.status;
};

proveri(await prati({ e: "Hero Sample Play", p: "/index.html?ime=Ivan&email=a@b.bg#order", d: "chestit-krasi.mp3" }) === 200, "познато събитие → 200");
const red = db.prepare("SELECT * FROM sabitiya").get();
proveri(red && red.ime === "Hero Sample Play", "името е записано");
proveri(red && red.stranica === "/index.html", "пътят е без ? и # (" + (red && red.stranica) + ")");
proveri(red && red.detail === "chestit-krasi.mp3", "пояснението е записано");
proveri(red && /^\d{4}-\d\d-\d\dT/.test(red.ts), "има време");

proveri(await prati({ e: "DROP TABLE", p: "/" }) === 400, "непознато име → 400");
proveri(await prati("{счупено") === 400, "счупен JSON → 400");
proveri(await prati({ e: "Demo Play", d: "x".repeat(2000) }) === 413, "голямо тяло → 413");
proveri(await prati({ e: "Voice Recorded", p: "/en/", d: "ivan@example.com\nред" }) === 200, "събитие с имейл в пояснението → 200");
const r2 = db.prepare("SELECT detail FROM sabitiya WHERE ime = 'Voice Recorded'").get();
proveri(r2 && r2.detail.indexOf("@") < 0 && r2.detail.indexOf("\n") < 0, "в пояснението няма @ и нов ред (" + (r2 && r2.detail) + ")");
proveri(db.prepare("SELECT count(*) n FROM sabitiya").get().n === 2, "в базата са точно двете валидни събития");

/* Всяко име, което сайтът праща, трябва да е в списъка на Worker-а */
const kod = ["assets/js/main.js", "assets/js/text-order.js"].map((f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8")).join("\n");
const prashtani = [...new Set([...kod.matchAll(/(?:trackPlausible|psnSabitie)\("([^"]+)"/g)].map((m) => m[1]))];
const lipsvat = prashtani.filter((x) => SABITIYA.indexOf(x) < 0);
proveri(prashtani.length >= 6 && lipsvat.length === 0, "имената от сайта са в списъка (" + prashtani.length + "; липсват: " + lipsvat.join(", ") + ")");

console.log(gr ? "  " + gr + " FAIL от " + (ok + gr) : "  всичко минава (" + ok + ")");
process.exit(gr ? 1 : 0);
