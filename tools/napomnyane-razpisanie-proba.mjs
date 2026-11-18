// Тест на новото разписание на напомнянията. Нищо не се праща: fetch и базата са подменени.
// node tools/napomnyane-razpisanie-proba.mjs

const m = await import('../worker/src/index.js');
const { koeNapomnyane, napomniNeplateni, napomnyanePismo, napomnyaneZaKogo, napomnyaneIme, brifIzvestieHtml } = m;

let greshki = 0, minali = 0;
const ok = (ime, uslovie, poluchi) => {
  if (uslovie) { minali++; return; }
  greshki++; console.log('ПАДНА:', ime, poluchi === undefined ? '' : '→ ' + JSON.stringify(poluchi));
};
// Ноември: София е UTC+2. s('18 10:00') = 18.11.2026 10:00 българско време.
const s = (t) => { const [d, hm] = t.split(' '); const [h, mi] = hm.split(':').map(Number); return new Date(Date.UTC(2026, 10, Number(d), h - 2, mi)); };
const iso = (t) => s(t).toISOString();
const k = (brif, sega, parvo, vtoro) => koeNapomnyane(iso(brif), s(sega), parvo ? iso(parvo) : null, !!vtoro);

// --- Първо напомняне
ok('10:00 → 11:17 още е рано', k('18 10:00', '18 11:17') === 0);
ok('10:00 → 12:17 първо', k('18 10:00', '18 12:17') === 1);
ok('16:54 → 18:17 още е рано', k('18 16:54', '18 18:17') === 0);
ok('16:54 → 19:17 първо', k('18 16:54', '18 19:17') === 1);
ok('17:52 → 20:17 същия ден не', k('18 17:52', '18 20:17') === 0);
ok('17:52 → 08:17 на другия ден още е нощ', k('18 17:52', '19 08:17') === 0);
ok('17:52 → 09:17 на другия ден първо', k('18 17:52', '19 09:17') === 1);
ok('02:00 → 04:17 нощ', k('18 02:00', '18 04:17') === 0);
ok('02:00 → 09:17 първо', k('18 02:00', '18 09:17') === 1);
ok('19:30 → 21:17 нощ', k('18 19:30', '18 21:17') === 0);
ok('над 48 часа без първо → нищо', k('16 08:00', '18 09:17') === 0);
ok('бриф в бъдещето → нищо', k('19 10:00', '18 12:17') === 0);

// --- Второ напомняне
ok('второ: 23 ч. → рано', k('18 10:00', '19 09:17', '18 12:17') === 0);
ok('второ: 24 ч. → второ', k('18 10:00', '19 10:17', '18 12:17') === 2);
ok('второ вече има → нищо', k('18 10:00', '19 10:17', '18 12:17', true) === 0);
ok('второ: вечерен бриф, 23,8 ч.', k('18 19:30', '19 19:17', '19 09:17') === 0);
ok('второ: вечерен бриф, 24,8 ч.', k('18 19:30', '19 20:17', '19 09:17') === 2);
ok('второ: 24 ч. падат през нощта → чака', k('18 23:30', '19 23:47', '19 09:17') === 0);
ok('второ: на сутринта', k('18 23:30', '20 09:17', '19 09:17') === 2);
ok('второ: първото е било преди по-малко от 6 ч.', k('18 16:00', '19 16:17', '19 12:00') === 0);
ok('второ: над 72 ч. → нищо', k('15 10:00', '18 12:17', '15 12:17') === 0);

// --- Името за шегата
ok('име', napomnyaneZaKogo({ recipient: '  Иван   Мечо ' }) === 'Иван Мечо');
ok('празно', napomnyaneZaKogo({}) === '');
ok('твърде дълго', napomnyaneZaKogo({ recipient: 'а'.repeat(41) }) === '');
ok('връзка', napomnyaneZaKogo({ recipient: 'виж https://x.bg' }) === '');
ok('имейл', napomnyaneZaKogo({ recipient: 'a@b.bg' }) === '');

// --- Писмата
const env = { BREVO_API_KEY: 'x', MAIL_SENDER: 'sales@pesenta.bg', MAIL_SENDER_NAME: 'Песента', PAYMENT_LINK: 'https://buy.stripe.com/TEST', PAYMENT_LINK_EN: 'https://buy.stripe.com/TESTEN' };
const red = { order_no: 'PSN-261118-0001', vid: 'пълна форма', povod: 'Рожден ден' };
let p1 = napomnyanePismo(env, red, { recipient: 'Иван Мечо' }, 'a@b.bg', s('18 12:17'), 1);
ok('тема с име', p1.subject === 'Песента за Иван Мечо още чака 🎶', p1.subject);
ok('шега с име', p1.html.includes('песента за Иван Мечо ще стане много добра'));
ok('въпрос за плащането', p1.html.includes('Имаше ли проблем на плащането?'));
ok('телефон', p1.html.includes('+359 899 456 326') && p1.html.includes('по всяко време'));
ok('цена и гаранция', p1.html.includes('19,90 €') && p1.html.includes('или ти връщаме парите'));
ok('без отстъпка', !/отстъпк|промо|ds?%s*(off|по-евтино)/i.test(p1.html));
ok('връзка за плащане', p1.url === 'https://buy.stripe.com/TEST?client_reference_id=PSN-261118-0001&prefilled_email=a%40b.bg&locale=bg', p1.url);
let p0 = napomnyanePismo(env, red, {}, 'a@b.bg', s('18 12:17'), 1);
ok('тема без име', p0.subject === 'Песента ти още чака 🎶', p0.subject);
ok('шега без име', p0.html.includes('песента ти ще стане много добра'));
let px = napomnyanePismo(env, red, { recipient: 'Том & <Джери>' }, 'a@b.bg', s('18 12:17'), 1);
ok('опасни знаци: без име', px.subject === 'Песента ти още чака 🎶', px.subject);
let pa = napomnyanePismo(env, red, { recipient: 'Том & Джери' }, 'a@b.bg', s('18 12:17'), 1);
ok('& е екраниран в писмото', pa.html.includes('Том &amp; Джери') && !pa.html.includes('Том & Джери'));
let p2 = napomnyanePismo(env, red, { recipient: 'Мария' }, 'a@b.bg', s('19 12:17'), 2);
ok('второ: тема', p2.subject === 'Да започваме ли песента за Мария? — PSN-261118-0001', p2.subject);
ok('второ: последно и телефон', p2.html.includes('за последно') && p2.html.includes('+359 899 456 326') && p2.html.includes('повече няма да ти пишем'));
let pd = napomnyanePismo(env, red, { event_date: '2026-11-25' }, 'a@b.bg', s('18 12:17'), 1);
ok('дата на повода', pd.html.includes('Поводът е на 25.11.2026'));
let pe = napomnyanePismo(env, { ...red, vid: 'пълна форма (EN)' }, { recipient: 'Anna' }, 'a@b.bg', s('18 12:17'), 1);
ok('английско: тема, телефон, връзка', pe.subject === 'The song for Anna is still waiting 🎶' && pe.html.includes('+359 899 456 326') && pe.url.startsWith('https://buy.stripe.com/TESTEN') && pe.url.endsWith('locale=auto'), pe.subject);

// --- Цялата функция с подменена база и поща
function bazaS(redove) {
  const zapisi = [];
  return {
    zapisi,
    prepare(sql) {
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async all() { return { results: redove }; },
        async first() { return null; },
        async run() { zapisi.push({ tablica: /INTO (\w+)/.exec(sql)[1], order_no: args[0], ok: args[3], error: args[4] }); return {}; }
      };
      return st;
    }
  };
}
const prateni = [];
globalThis.fetch = async (url, opt) => { prateni.push(JSON.parse(opt.body)); return { ok: true, status: 201 }; };
const pol = (o) => JSON.stringify(o);
const redove = [
  { order_no: 'A', created_at: iso('18 10:00'), vid: 'пълна форма', povod: 'Рожден ден', poleta: pol({ email: 'klient@example.com', recipient: 'Мими' }), parvo: null, parvo_at: null, parvo_ok: null, vtoro: null },
  { order_no: 'B', created_at: iso('18 10:00'), vid: 'бърза', povod: 'Юбилей', poleta: pol({ email: 'drug@example.com' }), parvo: 'B', parvo_at: iso('18 10:30'), parvo_ok: 0, vtoro: null },
  { order_no: 'C', created_at: iso('17 11:00'), vid: 'пълна форма', povod: 'Годишнина', poleta: pol({ email: 'treti@example.com' }), parvo: 'C', parvo_at: iso('17 13:17'), parvo_ok: 1, vtoro: null },
  { order_no: 'D', created_at: iso('18 09:00'), vid: 'бърза', povod: 'Рожден ден', poleta: pol({ email: 'test@russev.net' }), parvo: null, parvo_at: null, parvo_ok: null, vtoro: null },
  { order_no: 'E', created_at: iso('18 11:30'), vid: 'бърза', povod: 'Рожден ден', poleta: pol({ email: 'rano@example.com' }), parvo: null, parvo_at: null, parvo_ok: null, vtoro: null },
  { order_no: 'F', created_at: iso('17 11:00'), vid: 'пълна форма', povod: 'Сватба', poleta: pol({ email: 'gotov@example.com' }), parvo: 'F', parvo_at: iso('17 13:17'), parvo_ok: 1, vtoro: 'F' }
];
let db = bazaS(redove);
let rez = await napomniNeplateni({ ...env, DB: db }, s('18 12:17'));
ok('обед: пратени 2 (A първо, C второ)', rez.prateni === 2 && prateni.length === 2, { rez, n: prateni.length });
ok('A получава първото', prateni.some((x) => x.to[0].email === 'klient@example.com' && x.subject === 'Песента за Мими още чака 🎶'));
ok('C получава второто', prateni.some((x) => x.to[0].email === 'treti@example.com' && x.subject.startsWith('Да започваме ли песента?')));
ok('B (ok = 0) не получава нищо', !prateni.some((x) => x.to[0].email === 'drug@example.com'));
ok('E е още рано', !prateni.some((x) => x.to[0].email === 'rano@example.com'));
ok('F вече има второ', !prateni.some((x) => x.to[0].email === 'gotov@example.com'));
ok('записи: A в napomnyania, C в napomnyania2, D като вътрешен',
  db.zapisi.some((z) => z.order_no === 'A' && z.tablica === 'napomnyania' && z.ok === 1) &&
  db.zapisi.some((z) => z.order_no === 'C' && z.tablica === 'napomnyania2' && z.ok === 1) &&
  db.zapisi.some((z) => z.order_no === 'D' && z.tablica === 'napomnyania' && z.ok === 0 && z.error === 'вътрешен адрес') &&
  db.zapisi.length === 3, db.zapisi);
ok('подател и отговор', prateni.every((x) => x.sender.email === 'sales@pesenta.bg' && x.replyTo.email === 'sales@pesenta.bg'));

prateni.length = 0; db = bazaS(redove);
rez = await napomniNeplateni({ ...env, DB: db }, s('18 23:17'));
ok('нощем: нищо не тръгва и нищо не се записва', rez.prateni === 0 && prateni.length === 0 && db.zapisi.length === 0, { rez, z: db.zapisi });

// База без napomnyania2: само първото писмо
prateni.length = 0;
const staraBaza = bazaS(redove);
const prep = staraBaza.prepare.bind(staraBaza);
staraBaza.prepare = (sql) => { const st = prep(sql); if (/napomnyania2 n2/.test(sql)) st.all = async () => { throw new Error('D1_ERROR: no such table: napomnyania2'); }; return st; };
rez = await napomniNeplateni({ ...env, DB: staraBaza }, s('18 12:17'));
ok('стара база: само първото (A), без второ', rez.prateni === 1 && prateni.length === 1 && prateni[0].to[0].email === 'klient@example.com', { rez, n: prateni.length });

// --- Обръщение по име и шаблонът
ok('име: първата дума', napomnyaneIme({ ime: '  Петя  Иванова ' }) === 'Петя');
ok('име: празно', napomnyaneIme({}) === '');
ok('име: с цифри не', napomnyaneIme({ ime: 'Петя 123' }) === '');
ok('име: имейл не', napomnyaneIme({ ime: 'a@b.bg' }) === '');
const pi = napomnyanePismo(env, red, { ime: 'Петя Иванова', recipient: 'Мария' }, 'a@b.bg', s('18 12:17'), 1);
ok('обръщение с име', pi.html.includes('Здравей, Петя,'));
ok('без име: само Здравей', p0.html.includes('>Здравей,</p>'));
ok('шаблонът: лого, тъмен фон, бутон', pi.html.includes('logo-mail-v1.png') && pi.html.includes('#12101F') && pi.html.includes('Плащам и започвате') && pi.html.startsWith('<!DOCTYPE html>'));
ok('второто също е в шаблона и с име', napomnyanePismo(env, red, { ime: 'Петя' }, 'a@b.bg', s('19 12:17'), 2).html.includes('Здравей, Петя,'));
// --- Известието до нас за нов разказ
const iz = brifIzvestieHtml({ order_no: 'PSN-261118-0001', vid: 'бърза текстова', povod: 'Юбилей', razkaz: 'Ред 1 <b>x</b>', email: 'k@example.com', phone: '0888', snimki: 1 });
ok('известие: номер, разказ екраниран, имейл', iz.includes('PSN-261118-0001') && iz.includes('Ред 1 &lt;b&gt;x&lt;/b&gt;') && !iz.includes('<b>x</b>') && iz.includes('k@example.com') && iz.includes('0888'));
ok('известие: празен разказ се вижда', brifIzvestieHtml({ order_no: 'PSN-261118-0002' }).includes('— празен —'));
if (process.argv[2]) { const fsx = await import('node:fs'); fsx.writeFileSync(process.argv[2] + '/pismo-1.html', pi.html); fsx.writeFileSync(process.argv[2] + '/pismo-2.html', napomnyanePismo(env, red, { ime: 'Петя', recipient: 'Мария' }, 'a@b.bg', s('19 12:17'), 2).html); fsx.writeFileSync(process.argv[2] + '/izvestie.html', '<meta charset=utf-8>' + iz); }
console.log(minali + ' минаха, ' + greshki + ' паднаха');
process.exit(greshki ? 1 : 0);
