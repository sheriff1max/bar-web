/**
 * Скриншоты сайта для быстрой проверки вёрстки (инструмент разработчика).
 *
 *   node tools/screenshot.js <http://localhost:8080/> <папка-для-картинок>
 *
 * Требуется браузер:  npm i --no-save playwright-core && npx playwright install chromium
 */

const path = require('path');
const { chromium } = require('playwright-core');

const URL = process.argv[2] || 'http://127.0.0.1:8123/';
const OUT = path.resolve(process.argv[3] || '.');

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900, dpr: 1 },
  { name: 'tablet-834', width: 834, height: 1112, dpr: 1 },
  { name: 'mobile-390', width: 390, height: 844, dpr: 2 }
];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr
    });

    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => errors.push(`не загрузилось: ${r.url()} — ${r.failure()?.errorText}`));

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#main section', { timeout: 10000 });
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach(n => n.classList.add('is-visible')));
    await page.waitForTimeout(400);

    const full = path.join(OUT, `${vp.name}-full.png`);
    await page.screenshot({ path: full, fullPage: true });

    const first = path.join(OUT, `${vp.name}-first-screen.png`);
    await page.screenshot({ path: first });

    // проверка горизонтального скролла — частая проблема адаптивности
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
      bad: [...document.querySelectorAll('body *')]
        .filter(n => n.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 5)
        .map(n => `${n.tagName.toLowerCase()}.${n.className || ''}`)
    }));

    console.log(`\n${vp.name} (${vp.width}px)`);
    console.log(`  скролл страницы: ${overflow.doc}px, окно: ${overflow.win}px -> ${overflow.doc <= overflow.win + 1 ? 'горизонтального скролла нет ✓' : 'ЕСТЬ ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ ✗'}`);
    if (overflow.doc > overflow.win + 1) console.log('  выезжают за экран:', overflow.bad.join(', '));
    console.log(`  ошибок в консоли: ${errors.length ? errors.slice(0, 3).join(' | ') : 'нет ✓'}`);
    console.log(`  ${path.basename(full)}, ${path.basename(first)}`);

    if (vp.name.startsWith('mobile')) {
      await page.click('#burger');
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, 'mobile-menu.png') });
      console.log('  mobile-menu.png (бургер открыт)');
      await page.click('#burger');
    }

    await page.close();
  }

  await browser.close();
})();
