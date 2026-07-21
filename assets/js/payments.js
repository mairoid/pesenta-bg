/* Песента — конфигурация на картовите плащания (Stripe Payment Links)
   ─────────────────────────────────────────────────────────────────────
   АКТИВИРАНЕ (когато Stripe акаунтът е готов):
   1. В Stripe Dashboard създай Payment Link за продукта „Песен по поръчка“
      (и втори за варианта с „Експрес“, с добавена цена +9,90 €).
   2. Постави URL-ите по-долу.
   3. Смени enabled на true.
   4. Промо кодовете (PESEN10, PRIYATELI20) се създават и в Stripe:
      Products → Coupons → Promotion codes, и се разрешават в Payment Link-а
      („Allow promotion codes“).
   Плащането се иска СЛЕД одобрение на демото: изпрати на клиента линк
   към plati.html?order=PSN-XXXXXX-XXXX&plan=pesen (&express=1 при експрес)
   ───────────────────────────────────────────────────────────────────── */

window.PESENTA_PAYMENTS = {
  enabled: false,

  /* Stripe Payment Link URL-и (https://buy.stripe.com/...) */
  paymentLinks: {
    pesen: "",
    pesen_express: ""
  },

  /* Показни данни за страницата за плащане */
  plans: {
    pesen: { label: "Песен по поръчка", price: 19.9 }
  },
  expressPrice: 9.9,
  bgnRate: 1.95583
};
