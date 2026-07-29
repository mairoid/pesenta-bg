# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Статичен сайт (чист HTML/CSS/JS) на GitHub Pages — без build стъпка, без package.json/bundler; файловете се отварят директно.

- Стил: `assets/css/style.css` (CSS variables в `:root`). JS по назначение: `main.js` (плейър, hero видео, навигация), `order.js` (съветникът в poruchka.html), `voice-order.js` (гласова поръчка — споделена между hero-а на index.html и poruchka.html), `payments.js` (Stripe Payment Links).
- Заявките минават през FormSubmit.co без бекенд; гласовите поръчки прикачат аудио + транскрипция през нативен multipart POST (AJAX ендпойнтът на FormSubmit не пренася файлове).
- Коментарите са на български и обясняват ЗАЩО (скрит constraint, workaround, non-obvious причина) — не какво прави кодът.
- Без нови зависимости и без build инструменти: само vanilla HTML/CSS/JS — никакви npm пакети, framework-и, bundler-и.
- След всяка промяна изброявай точно кои файлове са пипнати и как да се проверят в браузъра (кой `.html` да се отвори, кой бутон/поток да се тества).
