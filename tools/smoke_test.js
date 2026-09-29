#!/usr/bin/env node
/**
 * Смоук-тест сайта: запускает index.html + assets/js/app.js в виртуальном
 * браузере (jsdom) и проверяет, что страница действительно собирается из JSON.
 *
 * Запуск (нужен jsdom, ставится только для разработки):
 *     npm install --no-save jsdom
 *     node tools/smoke_test.js
 *
 * Дополнительно можно получить готовый статический HTML-снимок страницы:
 *     node tools/smoke_test.js --html preview.html
 *
 * В production-сборку этот файл не попадает (см. .gitignore / deploy).
 */

'use strict';

const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch {
  console.error('Не найден jsdom. Установите: npm install --no-save jsdom');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
// Порт должен совпадать с запущенным serve.js. По умолчанию 8080.
// Можно переопределить:  BASE_URL=http://localhost:8099/ node tools/smoke_test.js
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/';

const checks = [];
function check(name, condition, details = '') {
  checks.push({ name, ok: Boolean(condition), details });
}

async function main() {
  const htmlPath = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const consoleErrors = [];
  const virtualConsole = new (require('jsdom').VirtualConsole)();
  virtualConsole.on('jsdomError', e => consoleErrors.push(`jsdomError: ${e.message}`));
  virtualConsole.on('error', (...args) => consoleErrors.push(args.join(' ')));
  virtualConsole.on('warn', (...args) => consoleErrors.push(`warn: ${args.join(' ')}`));

  const dom = new JSDOM(html, {
    url: BASE_URL,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole
  });

  // IntersectionObserver в jsdom нет — ставим заглушку, как в реальном браузере без поддержки
  dom.window.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ isIntersecting: true, target: el }], this); }
    unobserve() {}
    disconnect() {}
  };

  // ждём, пока app.js скачает site.json и отрисует блоки
  await new Promise(resolve => {
    const started = Date.now();
    const timer = setInterval(() => {
      const ready = dom.window.document.querySelector('#main section');
      const failed = dom.window.document.querySelector('#fatal:not([hidden])');
      if (ready || failed || Date.now() - started > 15000) {
        clearInterval(timer);
        resolve();
      }
    }, 60);
  });

  const doc = dom.window.document;
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
  const visibleBlocks = data.blocks.filter(b => b.visible !== false);

  // --- проверки -------------------------------------------------------
  const fatal = doc.querySelector('#fatal');
  check('Фатальная ошибка загрузки не показана', !fatal || fatal.hidden, fatal ? doc.getElementById('fatal-text')?.textContent : '');
  check('Заглушка «Загружаем сайт…» убрана', !doc.getElementById('loader'));

  const sections = doc.querySelectorAll('#main > section');
  check(
    `Отрисовано блоков: ${sections.length} из ${visibleBlocks.length}`,
    sections.length === visibleBlocks.length
  );

  // порядок блоков совпадает с JSON
  const renderedIds = [...sections].map(s => s.id);
  const expectedIds = visibleBlocks.map(b => b.id);
  check('Порядок блоков совпадает с JSON', JSON.stringify(renderedIds) === JSON.stringify(expectedIds),
    `\n      ожидание: ${expectedIds.join(', ')}\n      получено: ${renderedIds.join(', ')}`);

  // hero
  const hero = doc.querySelector('.hero');
  check('Hero: есть h1', Boolean(hero?.querySelector('h1')), hero?.querySelector('h1')?.textContent || '');
  check('Hero: есть фоновое изображение', Boolean(hero?.querySelector('picture img')));
  check('Hero: есть webp-источник', Boolean(hero?.querySelector('source[type="image/webp"]')));
  check('Hero: кнопок ' + (hero?.querySelectorAll('.btn').length || 0), (hero?.querySelectorAll('.btn').length || 0) >= 1);

  // text-image: картинка слева / справа / текст по центру
  // ВАЖНО: в DOM картинка ВСЕГДА стоит первой (чтобы на телефоне она была сверху),
  // а сторону на ПК меняет CSS-свойство order у класса .split--img-left / .split--img-right.
  // Поэтому проверяем наличие правильного класса-модификатора, а не порядок узлов.
  const left = doc.querySelector('.split--img-left');
  const right = doc.querySelector('.split--img-right');
  check('text-image: вариант «картинка слева» отрисован', Boolean(left));
  check('text-image: вариант «картинка справа» отрисован', Boolean(right));
  check('text-image: слева — картинка и текст на месте',
    Boolean(left?.querySelector('.split__media img')) && Boolean(left?.querySelector('.split__body')));
  check('text-image: справа — картинка и текст на месте',
    Boolean(right?.querySelector('.split__media img')) && Boolean(right?.querySelector('.split__body')));
  check('text-image: блок без картинки центрируется',
    data.blocks.some(b => b.type === 'text-image' && !b.image)
      ? Boolean(doc.querySelector('.split--text-only'))
      : true);
  check('text-image: в DOM картинка идёт первой (для мобильного порядка)',
    [...(left || right || { children: [] }).children][0]?.classList.contains('split__media'));
  check('text-image: абзацы из \\n\\n превратились в <p>',
    (left?.querySelectorAll('.text-block p').length || 0) >= 1);

  // меню и цены
  const menuItems = doc.querySelectorAll('.menu-item');
  check(`Меню: позиций ${menuItems.length}`, menuItems.length > 0);
  const priceNodes = [...doc.querySelectorAll('.menu-item__price-now')];
  const priceTexts = priceNodes.map(n => n.textContent.trim());
  check(`Меню: у всех ${priceNodes.length} позиций есть цена`, priceNodes.length > 0 && priceTexts.every(t => t.length > 0));
  check('Меню: цена содержит символ валюты из JSON', priceTexts.every(t => t.endsWith(data.site.currency || '₽')), priceTexts[0]);
  check('Меню: тысячи разделены пробелом («1 490 ₽»)',
    priceTexts.filter(t => Number(t.replace(/\D/g, '')) >= 1000).every(t => /\d\s\d{3}/.test(t)),
    priceTexts.find(t => /\d{4,}/.test(t.replace(/\s/g, ''))) || 'цен ≥1000 нет');
  const oldPrice = doc.querySelector('.menu-item__price-old');
  check('Меню: зачёркнутая старая цена показана', Boolean(oldPrice), oldPrice?.textContent || '');
  check('Меню: тег у позиции отрисован', doc.querySelectorAll('.menu-item .tag').length > 0);

  // галерея, команда, контакты
  check('Галерея: элементов ' + doc.querySelectorAll('.gallery__item').length, doc.querySelectorAll('.gallery__item').length > 0);
  check('Команда: карточек ' + doc.querySelectorAll('.person').length, doc.querySelectorAll('.person').length > 0);
  check('Контакты: есть телефон tel:', Boolean(doc.querySelector('a[href^="tel:"]')));
  check('Контакты: есть строки расписания', doc.querySelectorAll('.schedule__row').length > 0);
  check('Контакты: есть ссылка на карту', Boolean(doc.querySelector('a[href*="yandex.ru/maps"], a[href*="google.com/maps"]')));

  // шапка, подвал, meta
  const navLinks = doc.querySelectorAll('#nav-list .nav__link');
  check(`Шапка: пунктов меню ${navLinks.length}`, navLinks.length === (data.site.nav?.length || 0));
  check('Шапка: все пункты ведут на существующие блоки',
    [...navLinks].every(a => {
      const id = a.getAttribute('href').slice(1);
      return doc.getElementById(id) !== null;
    }),
    [...navLinks].map(a => a.getAttribute('href')).join(' '));
  check('Шапка: CTA-кнопка заполнена', (doc.getElementById('header-cta')?.textContent || '').trim().length > 0);
  check('Подвал: навигация заполнена', doc.querySelectorAll('#footer-nav a').length > 0);
  check('Подвал: соцсети заполнены', doc.querySelectorAll('#footer-social a').length > 0);
  check('Подвал: год в копирайте = текущий', doc.getElementById('footer-copy')?.textContent.includes(String(new Date().getFullYear())));

  check('<title> заполнен из JSON', doc.title.includes(data.site.name), doc.title);
  check('meta description заполнен', (doc.querySelector('meta[name="description"]')?.content || '').length > 20);
  check('JSON-LD заполнен', (() => {
    try { return JSON.parse(doc.getElementById('jsonld').textContent)['@type'] === 'Restaurant'; }
    catch { return false; }
  })());

  // CSS-переменные из settings применились
  const style = doc.documentElement.getAttribute('style') || '';
  check('settings.colors применены как CSS-переменные', style.includes('--c-accent'), style.slice(0, 90));

  check('Нет ошибок в консоли', consoleErrors.filter(m => !m.includes('Could not load link')).length === 0,
    consoleErrors.slice(0, 3).join(' | '));

  // --- отчёт ----------------------------------------------------------
  const failedChecks = checks.filter(c => !c.ok);
  console.log('\n  РЕЗУЛЬТАТ СМОУК-ТЕСТА');
  console.log('  ' + '─'.repeat(58));
  checks.forEach(c => console.log(`   ${c.ok ? '✓' : '✗'} ${c.name}${c.ok || !c.details ? '' : '\n      ' + c.details}`));
  console.log('  ' + '─'.repeat(58));
  console.log(`   Пройдено: ${checks.length - failedChecks.length}/${checks.length}`);
  console.log('  ' + '─'.repeat(58) + '\n');

  // снимок страницы для ручного просмотра
  const htmlArg = process.argv.indexOf('--html');
  if (htmlArg !== -1 && process.argv[htmlArg + 1]) {
    const out = path.resolve(process.argv[htmlArg + 1]);
    fs.writeFileSync(out, dom.serialize(), 'utf8');
    console.log(`  Снимок HTML сохранён: ${out}\n`);
  }

  dom.window.close();
  process.exit(failedChecks.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
