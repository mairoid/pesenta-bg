# Pesenta.bg — Песен по поръчка

Онлайн платформа за поръчка на персонализирани песни. Статичен сайт (HTML/CSS/JS) — без билд стъпка, готов за GitHub Pages.

## Структура

```
index.html          — начална страница (hero, демо, стилове, цени, FAQ)
poruchka.html       — 3-стъпков формуляр за поръчка
blagodarim.html     — резервна „благодарим“ страница
404.html            — страница за грешка
assets/css/style.css — целият дизайн (цветове в :root променливите)
assets/js/main.js   — аудио плейър, навигация, анимации
assets/js/order.js  — wizard, цени, промо кодове, изпращане
assets/audio/       — демо песните (MP3)
assets/img/         — SVG обложки, лого, OG изображение
```

## Къде се редактира какво

- **Цени и пакети** → `assets/js/order.js`, константата `PLANS` (+ съответните цени в `index.html`, секция `#ceni`). Текущи: Мини €9,90 / Соло €24,90 / Хит €39,90 / Спектакъл €69,90, експрес +€9,90.
- **Промо кодове** → `assets/js/order.js`, константата `PROMOS` (код → % отстъпка). Активни: `PESEN10` (−10%), `PRIYATELI20` (−20%).
- **Имейл за заявки** → `assets/js/order.js`, `FORM_ENDPOINT` и `ORDER_EMAIL`.
- **Демо песни** → добави MP3 в `assets/audio/`, копирай една `track-card` в `index.html`.

## Получаване на заявки (без бекенд)

Формата изпраща заявките през [FormSubmit](https://formsubmit.co) до `rusev.miro@gmail.com`.

⚠️ **Еднократна активация:** при първата изпратена заявка FormSubmit праща имейл за потвърждение — кликни линка в него и всички следващи заявки пристигат директно. Всяка заявка съдържа и готов **CLAUDE BRIEF** — копирай го в Claude за композиране на текста, после в Suno за музиката.

Ако FormSubmit е недостъпен, формата предлага на клиента да изпрати заявката през своя имейл клиент (mailto fallback) и пази черновата в localStorage.

## Публикуване (GitHub Pages + автоматичен deploy)

1. Създай публично repo `pesenta-bg` в GitHub (или `gh repo create pesenta-bg --public`).
2. ```
   git remote add origin https://github.com/<user>/pesenta-bg.git
   git push -u origin main
   ```
3. В **Settings → Pages** избери Source: **GitHub Actions**. Workflow-ът в `.github/workflows/deploy.yml` публикува автоматично при всеки push към `main`.
4. В **Settings → Pages → Custom domain** въведи `pesenta.bg` (файлът `CNAME` вече е в repo-то).

### DNS за pesenta.bg

| Тип | Хост | Стойност |
|-----|------|----------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `<user>.github.io` |

## Следващи стъпки (Phase 2)

- **Stripe Checkout** — плащане с карта при одобрение на демото.
- Реални отзиви на мястото на примерните в `index.html` (секция `#otzivi`, маркирано с TODO).
- Google Search Console: добави домейна и изпрати `sitemap.xml`.
