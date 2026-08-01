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
  created_at        TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_doc_date ON sales(doc_date);
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
