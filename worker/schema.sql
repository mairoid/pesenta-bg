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
