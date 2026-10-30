/* Общото между build.mjs, nachalo.mjs и pravni.mjs — отделно, за да няма
   кръгов import (build.mjs вика другите два). */
const SAIT = "https://pesenta.bg";
export const CENA = "€19.90";
export const EMAIL = "sales@pesenta.bg";

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
export const bezTagove = (s) => String(s).replace(/<[^>]+>/g, "");

export const enUrl = (file) => SAIT + "/en/" + (file === "index.html" ? "" : file);
export const bgUrl = (file) => SAIT + "/" + (file === "index.html" ? "" : file);

/* ---------- Демо песните ----------
   Същите файлове като на българската страница. Заглавията са преведени, а не
   транслитерирани: англоговорящият не чете кирилица, а заглавието е смисълът.
   18+ парчетата и песните за публични личности не влизат.
   На английските страници отпред са трите на чужд език (италиански, турски,
   арабски) и една българска — по решение на Мирослав, 13.10.2026. */
export const DEMO_EN = ["rocco", "rosen", "habibi", "krasi"];
export const DEMO = {
  krasi:  { src: "chestit-krasi.mp3",      img: "krasi",      t: "Happy Birthday, Krasi",     d: "In Bulgarian · birthday rap with a female hook", time: "2:56" },
  vladi:  { src: "za-teb-brate-vladi.mp3", img: "vladi",      t: "For You, Brother Vladi",    d: "For a friend · a song with a message",     time: "4:27" },
  rosen:  { src: "rosen-abi.mp3",          img: "rosen-abi",  t: "Rosen Abi",                 d: "In Turkish · for a friend, with a deep-house beat",              time: "3:18" },
  rocco:  { src: "rocco-di-catania.mp3",   img: "rocco",      t: "Rocco di Catania",          d: "In Italian · a serenade for a friend",    time: "3:34" },
  habibi: { src: "habibi-rusi.mp3",        img: "habibi",     t: "Habibi Rusi",               d: "In Arabic · for a friend's wedding",      time: "2:01" },
  glig:   { src: "gligane-izlez.mp3",      img: "gligane",    t: "Come Out, Wild Boar",       d: "For a hunting crew · opening-day party song", time: "3:00" },
  tutso:  { src: "za-teb-brate-tutso.mp3", img: "tutso",      t: "For You, Brother Tutso",    d: "For a friend · a song with a message",     time: "5:06" },
  veche:  { src: "veche-nyama-koy.mp3",    img: "veche-nyama", t: "No One Left to Call",      d: "Nostalgia · after the bachelor party",     time: "3:59" }
};

export function demoRed(k, kat) {
  const s = DEMO[k];
  return `        <div class="track-row player reveal"${kat ? ` data-category="${kat}"` : ""} data-src="../assets/audio/${s.src}" role="button" tabindex="0" aria-label="Play “${esc(s.t)}”">
          <button class="play-btn" tabindex="-1" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
          <img class="track-thumb" src="../assets/img/cover-${s.img}.webp" srcset="../assets/img/cover-${s.img}-360.webp 360w, ../assets/img/cover-${s.img}.webp 600w" sizes="(max-width: 760px) 46vw, (max-width: 980px) 30vw, 260px" alt="" loading="lazy" width="600" height="600">
          <div class="track-info">
            <h3>${esc(s.t)}</h3>
            <span>${esc(s.d)}</span>
          </div>
          <div class="progress" aria-hidden="true"><div class="progress-fill"></div></div>
          <span class="time">${s.time}</span>
        </div>`;
}

