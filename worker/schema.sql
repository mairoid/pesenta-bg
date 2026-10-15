-- Песента — база за е-бележките по чл. 52о и одиторския файл по Приложение №38
-- ---------------------------------------------------------------------------
-- Всички суми са в СТОТИНКИ (цели числа). Никъде float: 19,90 € по курс
-- 1,95583 дава 38,9210…, а закръгляването на дробни числа в JavaScript е
-- точно мястото, където одиторският файл би спрял да се връзва аритметично.

CREATE TABLE IF NOT EXISTS sales (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Номер на документа по чл. 52о, ал. 1, т. 1. Същият номер стои и на
  -- фактурата — една последователност, за да няма два номера за една продажба.
  doc_n             INTEGER NOT NULL UNIQUE,
  doc_date          TEXT    NOT NULL,          -- YYYY-MM-DD, софийско време
  -- Часът влиза в QR кода по Приложение №18а. Пази се отделно, защото
  -- одиторският файл иска само датата, а баркодът иска дата И час.
  doc_time          TEXT    NOT NULL DEFAULT '00:00:00',   -- HH:MM:SS
  -- Уникален номер на клиентската поръчка (PSN-ГГММДД-XXXX)
  order_no          TEXT    NOT NULL,
  order_date        TEXT    NOT NULL,          -- YYYY-MM-DD
  customer_email    TEXT,
  customer_name     TEXT,
  -- Стока/услуга
  art_name          TEXT    NOT NULL,
  art_quant         INTEGER NOT NULL DEFAULT 1,
  art_price_st      INTEGER NOT NULL,          -- единична цена, стотинки
  vat_rate          INTEGER NOT NULL DEFAULT 0,
  vat_st            INTEGER NOT NULL DEFAULT 0,
  discount_st       INTEGER NOT NULL DEFAULT 0,
  total_st          INTEGER NOT NULL,          -- крайна сума след отстъпка
  -- Сумите в ЕВРОЦЕНТОВЕ, точно както ги дава Stripe. От 01.01.2026 еврото
  -- е основната валута в България, а и транзакцията реално се извършва в
  -- евро — затова тези колони са първоизточникът, а левовите се получават
  -- от тях по фиксирания курс, не обратното.
  subtotal_eur_c    INTEGER,
  discount_eur_c    INTEGER,
  total_eur_c       INTEGER,
  -- Начин на плащане по номенклатурата на схемата:
  --   4 = доставчик на платежни услуги (Stripe), 1 = без ППП (банков превод)
  paym              INTEGER NOT NULL,
  trans_n           TEXT,                      -- референтен номер на трансакцията (Stripe)
  proc_id           TEXT,                      -- Merchant ID (acct_…)
  -- Идемпотентност: Stripe праща един и същи webhook повторно при неуспех.
  -- UNIQUE тук е това, което пази от двойно издаден документ.
  stripe_event_key  TEXT    NOT NULL UNIQUE,
  -- Валутата, в която Stripe реално е таксувал. Пази се, защото Adaptive
  -- Pricing може да покаже касата в местната валута на купувача — тогава
  -- сумите НЕ са в евро и одиторският файл би излязъл грешен, ако това
  -- мине незабелязано. Очаквана стойност: eur.
  currency          TEXT,
  currency_warning  TEXT,
  -- Кога бележката е изпратена по имейл. NULL = още не е. Пази от повторно
  -- изпращане, ако Stripe ретрайва webhook-а, и показва при проверка кои
  -- продажби са останали без връчен документ.
  email_sent_at     TEXT,
  email_error       TEXT,
  created_at        TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_doc_date ON sales(doc_date);
CREATE INDEX IF NOT EXISTS idx_sales_event_key ON sales(stripe_event_key);
CREATE INDEX IF NOT EXISTS idx_sales_order_no ON sales(order_no);

CREATE TABLE IF NOT EXISTS refunds (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no          TEXT    NOT NULL,
  amount_st         INTEGER NOT NULL,          -- левове, изведени по курса
  amount_eur_c      INTEGER,                   -- евроцентове от Stripe (първоизточник)
  refund_date       TEXT    NOT NULL,          -- YYYY-MM-DD, софийско време
  -- 2 = възстановяване по картата (както в пробния файл)
  r_paym            INTEGER NOT NULL DEFAULT 2,
  stripe_event_key  TEXT    NOT NULL UNIQUE,
  -- Кога клиентът е уведомен за връщането. Същата логика като при
  -- продажбите: провалът на писмото не проваля записа, но остава видим.
  email_sent_at     TEXT,
  email_error       TEXT,
  created_at        TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refunds_date ON refunds(refund_date);

-- Брояч за номерата на документите. Отделна таблица, а не MAX(doc_n)+1:
-- при едновременни плащания MAX() може да върне един и същи номер два пъти.
CREATE TABLE IF NOT EXISTS counters (
  name  TEXT    PRIMARY KEY,
  value INTEGER NOT NULL
);

-- 1011, за да е ПЪРВИЯТ издаден номер 1012 (показва се като 0000001012).
INSERT OR IGNORE INTO counters (name, value) VALUES ('doc_n', 1011);

-- Разказът на клиента, пристигнал ПРЕДИ плащането.
-- ---------------------------------------------------------------------------
-- Дотук брифът живееше само в имейл през FormSubmit. При бързата текстова
-- поръчка кодът праща клиента към касата дори когато изпращането се провали
-- (вж. коментара в text-order.js) — резултатът е платена поръчка без история,
-- за която никой не научава. Случи се на 31.08.2026 с PSN-260831-2447.
--
-- Ключът е order_no, а не автоматичен номер: същият номер пътува със Stripe
-- като client_reference_id, тоест продажбата и разказът се събират сами.
-- PRIMARY KEY дава и идемпотентност — повторно изпращане презаписва, не трупа.
CREATE TABLE IF NOT EXISTS briefs (
  order_no    TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,          -- ISO, момент на получаване
  vid         TEXT,                   -- бърза текстова / гласова / пълна форма
  povod       TEXT,
  stilove     TEXT,
  ezik        TEXT,
  razkaz      TEXT,                   -- същината: историята с думите на клиента
  -- Целият пратен обект като JSON. Полетата горе са за четене на око; това е
  -- за всичко, което формата добави по-късно и схемата още не знае.
  poleta      TEXT
);

CREATE INDEX IF NOT EXISTS idx_briefs_created ON briefs(created_at);

-- Състояние на поръчката, отмятано от админ панела.
-- ---------------------------------------------------------------------------
-- Базата знаеше платена ли е поръчката, има ли разказ и тръгнала ли е
-- бележката — но не и дали ПЕСЕНТА е доставена. Това е единственото, което
-- не може да се изведе автоматично: изпращането става на ръка.
--   ALTER TABLE sales ADD COLUMN delivered_at TEXT;   -- ISO, NULL = още не
--   ALTER TABLE sales ADD COLUMN note         TEXT;   -- свободна бележка
--   ALTER TABLE sales ADD COLUMN page_url     TEXT;   -- страницата на песента; накъде води QR-ът на картичката (11.09.2026)

-- Напомняне до неплатила поръчка (13.10.2026). По един ред на поръчка — и при
-- пратено писмо, и когато е пропуснато (error казва защо), за да не се гледа пак.
CREATE TABLE IF NOT EXISTS napomnyania (
  order_no    TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  email       TEXT,
  ok          INTEGER NOT NULL DEFAULT 0,
  error       TEXT
);

-- Анонимни събития от сайта (14.10.2026): натискания, пускания, отворена форма.
-- Без IP, без браузър, без номер на посетител — само име, страница и кратко пояснение.
CREATE TABLE IF NOT EXISTS sabitiya (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  ime TEXT NOT NULL,
  stranica TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS sabitiya_ts ON sabitiya (ts);

-- Ваучер за песен (15.10.2026). Купувачът попълва формата → ред „chaka“ (POST /vaucher/nov);
-- платеният webhook го прави „aktiven“ с кода, В СЪЩИЯ batch с реда в sales; осребряването
-- го прави „izpolzvan“ атомарно. Осребрената поръчка НЕ влиза в sales (не е нова продажба,
-- не отива в одиторския файл) — доставката ѝ се отбелязва тук (delivered_at, page_url).
CREATE TABLE IF NOT EXISTS vaucheri (
  ref              TEXT PRIMARY KEY,          -- VCH-ГГММДД-NNNN (client_reference_id в Stripe)
  kod              TEXT,                      -- KRASI-SERENADA-7KQ9X, показваният вид
  kod_norm         TEXT UNIQUE,               -- главни, само A-Z0-9; по него се търси
  status           TEXT NOT NULL DEFAULT 'chaka',   -- chaka | aktiven | izpolzvan | otmenen
  ot_kogo          TEXT,
  za_kogo          TEXT,
  poslanie         TEXT,
  email            TEXT,                      -- от формата; писмото отива на имейла от Stripe
  faktura          TEXT,                      -- JSON {ime, adres, eik?} или NULL
  bez_danni        INTEGER NOT NULL DEFAULT 0, -- 1 = платен без ред от формата (кодът е PODARAK-…)
  created_at       TEXT NOT NULL,
  platen_at        TEXT,
  stripe_session   TEXT,                      -- cs_… — връзката с sales.stripe_event_key ('cs:' + това)
  pismo_at         TEXT,                      -- кога писмото (бележка + ваучер) е тръгнало
  pismo_opiti      INTEGER NOT NULL DEFAULT 0,
  pismo_greshka    TEXT,
  izpolzvan_at     TEXT,
  izpolzvan_order  TEXT,                      -- PSN-… на осребрената поръчка
  otmenen_at       TEXT,
  delivered_at     TEXT,                      -- доставена ли е песента по осребрения ваучер
  page_url         TEXT
);
CREATE INDEX IF NOT EXISTS idx_vaucheri_status ON vaucheri(status, created_at);
CREATE INDEX IF NOT EXISTS idx_vaucheri_session ON vaucheri(stripe_session);
CREATE INDEX IF NOT EXISTS idx_vaucheri_order ON vaucheri(izpolzvan_order);

-- Ограничение на проверките/осребряванията: по IP-хеш (SHA-256 на IP + сол), по часове.
-- IP-то не се пази. Cron-ът трие редовете след ден.
CREATE TABLE IF NOT EXISTS vaucher_opiti (
  ip_hash  TEXT NOT NULL,
  chas     TEXT NOT NULL,                     -- ГГГГ-ММ-ДДTЧЧ (UTC)
  broi     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, chas)
);

-- Миграция на живата база (НЕ е пускана; пуска се с „да“ от Мирослав, ПРЕДИ deploy).
-- --command, не --file (с --file D1 дава Auth 10000). Всичко е IF NOT EXISTS — безопасно е
-- и при повторно пускане. Командите са по една на ред:
--   npx wrangler d1 execute pesenta-nap --remote --command "CREATE TABLE IF NOT EXISTS vaucheri (ref TEXT PRIMARY KEY, kod TEXT, kod_norm TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'chaka', ot_kogo TEXT, za_kogo TEXT, poslanie TEXT, email TEXT, faktura TEXT, bez_danni INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, platen_at TEXT, stripe_session TEXT, pismo_at TEXT, pismo_opiti INTEGER NOT NULL DEFAULT 0, pismo_greshka TEXT, izpolzvan_at TEXT, izpolzvan_order TEXT, otmenen_at TEXT, delivered_at TEXT, page_url TEXT)"
--   npx wrangler d1 execute pesenta-nap --remote --command "CREATE INDEX IF NOT EXISTS idx_vaucheri_status ON vaucheri(status, created_at); CREATE INDEX IF NOT EXISTS idx_vaucheri_session ON vaucheri(stripe_session); CREATE INDEX IF NOT EXISTS idx_vaucheri_order ON vaucheri(izpolzvan_order)"
--   npx wrangler d1 execute pesenta-nap --remote --command "CREATE TABLE IF NOT EXISTS vaucher_opiti (ip_hash TEXT NOT NULL, chas TEXT NOT NULL, broi INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ip_hash, chas))"
-- Връщане: DROP TABLE vaucher_opiti; DROP TABLE vaucheri; (само ако няма платени ваучери!)
