# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Статичен сайт (чист HTML/CSS/JS) на GitHub Pages — без build стъпка, без package.json/bundler; файловете се отварят директно.

- Стил: `assets/css/style.css` (CSS variables в `:root`). JS по назначение: `main.js` (плейър, hero видео, навигация), `order.js` (съветникът в poruchka.html), `voice-order.js` и `text-order.js` (бързите поръчки в hero-а — гласовата върви и на poruchka.html), `payments.js` (Stripe Payment Links), `rojdendni.js` (секцията „Днес празнуват“ — чете `assets/data/rojdendni.json`), `scrub.js` (видеото, което се превърта със скрола — само десктоп).
- Заявките минават през FormSubmit.co; гласовите прикачат аудио + транскрипция през нативен multipart POST (AJAX ендпойнтът на FormSubmit не пренася файлове). След изпращане клиентът отива право на Stripe с `client_reference_id` = номера на поръчката.
- `worker/` НЕ е част от статичния сайт — Cloudflare Worker за е-бележката по чл. 52о и одиторския файл за НАП. Изтрива се от артефакта в `.github/workflows/deploy.yml`; има си отделен README и деплой през `wrangler`. Правилата отдолу не важат за него.
- `legal-config.js` е ЕДИНСТВЕНИЯТ източник на правните данни — Политиката за поверителност се пълни от него. Не пипай данните на две места. `qrcode.js` е вградена чужда библиотека (kazuhikoarase, MIT) за баркода в `pesen.html` — единственото изключение от правилото отдолу, копирано в репото нарочно, за да няма CDN и външна заявка.
- Коментарите са на български и обясняват ЗАЩО (скрит constraint, workaround, non-obvious причина) — не какво прави кодът.
- Без нови зависимости и без build инструменти: само vanilla HTML/CSS/JS — никакви npm пакети, framework-и, bundler-и.
- След всяка промяна изброявай точно кои файлове са пипнати и как да се проверят в браузъра (кой `.html` да се отвори, кой бутон/поток да се тества).
