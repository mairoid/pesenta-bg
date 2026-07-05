/* Песента — конфигурация на картовите плащания (Stripe Payment Links)
   ─────────────────────────────────────────────────────────────────────
   АКТИВИРАНЕ (когато Stripe акаунтът е готов):
   1. В Stripe Dashboard създай Payment Link за всеки пакет
      (и по един за вариантите с „Експрес“, с добавена цена +9,90 €).
   2. Постави URL-ите по-долу.
   3. Смени enabled на true.
   4. Промо кодовете (PESEN10, PRIYATELI20) се създават и в Stripe:
      Products → Coupons → Promotion codes, и се разрешават в Payment Link-а
      („Allow promotion codes“).
   Плащането се иска СЛЕД одобрение на демото: изпрати на клиента линк
   към plati.html?order=PSN-XXXXXX-XXXX&plan=hit&express=1
   ───────────────────────────────────────────────────────────────────── */

window.PESENTA_PAYMENTS = {
  enabled: false,

  /* Stripe Payment Link URL-и (https://buy.stripe.com/...) */
  paymentLinks: {
    mini: "",
    solo: "",
    hit: "",
    spektakal: "",
    mini_express: "",
    solo_express: "",
    hit_express: "",
    spektakal_express: ""
  },

  /* Показни данни за страницата за плащане */
  plans: {
    mini: { label: "Мини", price: 9.9 },
    solo: { label: "Соло", price: 24.9 },
    hit: { label: "Хит", price: 39.9 },
    spektakal: { label: "Спектакъл", price: 69.9 }
  },
  expressPrice: 9.9,
  bgnRate: 1.95583
};
