/* ==========================================================================
   Ресторан — сборка страницы из data/site.json
   --------------------------------------------------------------------------
   Как это работает:
     1. Браузер скачивает data/site.json
     2. Для каждого блока из массива "blocks" вызывается свой рендерер
     3. Блоки вставляются в <main> сверху вниз — ровно в том порядке,
        в котором они записаны в JSON.

   Чтобы поменять порядок блоков на странице — переставьте их в JSON.
   Чтобы добавить блок — скопируйте похожий и поменяйте "id" и "type".
   Код править не нужно.

   Поддерживаемые типы блоков (поле "type"):
     "hero"        — первый экран с фото на весь экран
     "text-image"  — текст + картинка слева или справа (imagePosition)
     "promo"       — блок акции/спецпредложения
     "menu"        — меню с категориями и ценами
     "gallery"     — сетка фотографий
     "team"        — карточки сотрудников
     "contacts"    — контакты, часы работы, карта
     "text"        — просто текст (без картинки, по центру)
   ========================================================================== */

'use strict';

/* ---------------------------------------------------------------------
   0. НАСТРОЙКИ
   --------------------------------------------------------------------- */

const CONFIG = {
  jsonPath: 'data/site.json',      // путь к файлу с содержимым
  animateOnScroll: true,           // можно отключить через settings.animateOnScroll
  lightbox: true                   // открытие фото галереи по клику
};

const state = { data: null, settings: {} };


/* ---------------------------------------------------------------------
   1. МАЛЕНЬКИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   --------------------------------------------------------------------- */

/** Создаёт элемент: el('div', {class:'x'}, [детей] или 'текст') */
function el(tag, attrs = {}, children = null) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }

  appendChildren(node, children);
  return node;
}

/** Добавляет детей: массив, один узел или строку */
function appendChildren(parent, children) {
  if (children === null || children === undefined || children === false) return;
  if (Array.isArray(children)) {
    children.forEach(child => appendChildren(parent, child));
  } else if (children instanceof Node) {
    parent.appendChild(children);
  } else if (String(children).trim() !== '') {
    parent.appendChild(document.createTextNode(String(children)));
  }
}

/** Текст с переносами строк ("\n\n в JSON) превращает в отдельные <p> */
function paragraphs(text) {
  if (!text) return [];
  return String(text)
    .split(/\n\s*\n/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => el('p', {}, part.replace(/\n/g, ' ')));
}

/** Экранирует текст, если он вставляется через innerHTML */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Число в цену: 1490 -> "1 490 ₽" */
function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  const formatted = new Intl.NumberFormat('ru-RU').format(number);
  const currency = state.data?.site?.currency || '₽';
  return `${formatted} ${currency}`;
}

/** Ссылка на блок: '#menyu'. Внешние URL (http…) остаются как есть */
function toHref(target) {
  if (!target) return '#top';
  return /^https?:\/\//i.test(target) ? target : `#${target}`;
}

const isExternal = href => /^https?:\/\//i.test(href);

/** id якоря из текста: "О ресторане" -> "o-restorane" (для блоков без id) */
function slugify(text) {
  const map = { а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'y',
                к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
                х:'h', ц:'c', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya' };
  return String(text || '')
    .toLowerCase()
    .split('')
    .map(ch => (map[ch] !== undefined ? map[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'block';
}

/**
   Картинка с автоматическим WebP.
   Вы пишете в JSON "assets/img/about.jpg", а браузеру отдаётся about.webp,
   если такой файл лежит рядом (он в ~2-3 раза меньше). Если нет — обычный jpg.
 */
function picture(image, extraClass = '') {
  if (!image) return null;
  const src = typeof image === 'string' ? image : image.src;
  if (!src) return null;

  const alt = (typeof image === 'object' && image.alt) || '';
  const webp = src.replace(/\.(jpe?g|png)$/i, '.webp');
  const hasWebp = webp !== src;

  const img = el('img', {
    src,
    alt,
    width: (typeof image === 'object' && image.width) || undefined,
    height: (typeof image === 'object' && image.height) || undefined,
    loading: (typeof image === 'object' && image.eager) ? 'eager' : 'lazy',
    decoding: 'async',
    onerror: handleBrokenImage
  });
  if (typeof image === 'object' && image.eager) img.setAttribute('fetchpriority', 'high');

  return el('picture', { class: extraClass || undefined }, hasWebp
    ? [el('source', { srcset: webp, type: 'image/webp' }), img]
    : [img]);
}

/** Если файла нет — показываем понятную подпись вместо «сломанной» картинки */
function handleBrokenImage(event) {
  const img = event.target;
  if (img.dataset.fallbackDone) return;
  img.dataset.fallbackDone = '1';

  const wrap = el('div', {
    class: 'img-missing',
    style: {
      display: 'grid', placeItems: 'center', width: '100%', height: '100%',
      aspectRatio: '4 / 3', padding: '20px', textAlign: 'center',
      background: 'var(--c-card)', border: '1px dashed var(--c-line)',
      color: 'var(--c-muted)', fontSize: '.85rem', borderRadius: 'var(--radius-sm)'
    }
  }, `Нет файла: ${img.getAttribute('src')}`);

  img.replaceWith(wrap);
}

/**
   Кнопка из JSON: { "label": "Текст", "target": "id-блока", "style": "primary" }
   style: "primary" | "ghost" | "light"
*/
function button(data) {
  if (!data || !data.label) return null;
  const href = toHref(data.target || data.href);
  return el('a', {
    class: `btn btn--${data.style || 'primary'}`,
    href,
    target: isExternal(href) ? '_blank' : null,
    rel: isExternal(href) ? 'noopener noreferrer' : null
  }, data.label);
}

function buttons(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return el('div', { class: 'block-buttons' }, list.map(button).filter(Boolean));
}

/** Обёртка секции: <section id=… class="section …"> + контейнер */
function section({ id, className = '', bg = '', head = null, body = null, reveal = true }) {
  const classes = ['section', className, bg ? `section--${bg}` : '', reveal ? 'reveal' : '']
    .filter(Boolean).join(' ');

  return el('section', { id, class: classes }, [
    el('div', { class: 'container' }, [head, body].filter(Boolean))
  ]);
}

/** Заголовок секции с надзаголовком и подзаголовком */
function sectionHead({ eyebrow, title, subtitle, center = false }) {
  if (!title && !subtitle && !eyebrow) return null;
  return el('div', { class: `section__head${center ? ' section__head--center' : ''}` }, [
    eyebrow ? el('span', { class: 'eyebrow' }, eyebrow) : null,
    title ? el('h2', {}, title) : null,
    subtitle ? el('p', { class: 'section__subtitle' }, subtitle) : null
  ]);
}

/** Подпись-ссылка «Открыть на карте» */
function mapLink(url, label = 'Открыть на карте') {
  if (!url) return null;
  return el('a', { class: 'btn btn--ghost btn--sm', href: url, target: '_blank', rel: 'noopener noreferrer' }, label);
}

/** figure с картинкой и подписью */
function mediaCard(image, ratio) {
  const pic = picture(image);
  if (!pic) return null;
  const caption = typeof image === 'object' ? image.caption : null;
  return el('figure', {
    class: 'media-card',
    style: ratio ? { '--ratio': ratio } : undefined
  }, [pic, caption ? el('figcaption', {}, caption) : null]);
}


/* ---------------------------------------------------------------------
   2. РЕНДЕРЕРЫ БЛОКОВ
   ---------------------------------------------------------------------
   Каждая функция получает объект блока из JSON и возвращает DOM-узел.
   Хотите свой тип блока? Добавьте функцию renderXxx и запишите её
   в таблицу RENDERERS ниже.
   --------------------------------------------------------------------- */

/** hero — первый экран с фотографией на весь экран */
function renderHero(block) {
  const overlay = Number(block.image?.overlay ?? 0.5);

  const bg = block.image?.src
    ? el('div', { class: 'hero__bg' }, [
        picture({ ...block.image, eager: true }),
        el('div', {
          class: 'hero__overlay',
          style: { background: `linear-gradient(to top, var(--c-bg) 4%, rgb(0 0 0 / ${overlay}) 55%, rgb(0 0 0 / ${overlay * 0.5}))` }
        })
      ])
    : null;

  const facts = Array.isArray(block.facts) && block.facts.length
    ? el('div', { class: 'hero__facts' }, block.facts.map(fact =>
        el('div', { class: 'hero__fact' }, [
          el('div', { class: 'hero__fact-value' }, fact.value),
          el('div', { class: 'hero__fact-label' }, fact.label)
        ])))
    : null;

  return el('section', { id: block.id, class: 'hero' }, [
    bg,
    el('div', { class: 'container hero__content' }, [
      block.eyebrow ? el('span', { class: 'eyebrow' }, block.eyebrow) : null,
      block.title ? el('h1', { class: 'hero__title' }, block.title) : null,
      block.text ? el('p', { class: 'hero__text' }, block.text) : null,
      buttons(block.buttons),
      facts
    ])
  ]);
}

/**
   text-image — главный настраиваемый блок.
     imagePosition: "left"  -> картинка слева,  текст справа
                    "right" -> картинка справа, текст слева
                    отсутствует / нет image -> текст по центру
*/
function renderTextImage(block) {
  const hasImage = Boolean(block.image?.src);
  const position = hasImage ? (block.imagePosition === 'right' ? 'right' : 'left') : 'none';

  const body = el('div', { class: 'split__body' }, [
    block.eyebrow ? el('span', { class: 'eyebrow' }, block.eyebrow) : null,
    block.title ? el('h2', {}, block.title) : null,
    el('div', { class: 'text-block' }, paragraphs(block.text)),
    Array.isArray(block.features) && block.features.length
      ? el('ul', { class: 'feature-list' }, block.features.map(item => el('li', {}, item)))
      : null,
    buttons(block.buttons)
  ]);

  const media = hasImage
    ? el('div', { class: 'split__media' }, [mediaCard(block.image, block.ratio)])
    : null;

  return section({
    id: block.id,
    bg: block.bg || '',
    reveal: false,
    body: el('div', { class: `split split--img-${position} reveal` }, hasImage ? [media, body] : [body])
  });
}

/** text — текст без картинки, по центру */
function renderText(block) {
  return section({
    id: block.id,
    bg: block.bg || 'soft',
    head: sectionHead({ eyebrow: block.eyebrow, title: block.title, subtitle: block.subtitle, center: block.center !== false }),
    body: el('div', { class: 'text-block split--text-only' }, paragraphs(block.text))
  });
}

/** promo — блок акции */
function renderPromo(block) {
  const body = el('div', {}, [
    block.label ? el('span', { class: 'promo__badge' }, block.label) : null,
    block.title ? el('h2', { class: 'promo__title' }, block.title) : null,
    block.text ? el('div', { class: 'promo__text text-block' }, paragraphs(block.text)) : null,
    buttons(block.buttons)
  ]);

  const media = block.image?.src
    ? el('div', { class: 'promo__media' }, [mediaCard(block.image, block.ratio || '3 / 2')])
    : null;

  return section({
    id: block.id,
    className: 'promo',
    bg: block.bg || 'accent',
    head: null,
    body: el('div', { class: 'promo__inner' }, media ? [body, media] : [body])
  });
}

/** menu — категории и позиции с ценами */
function renderMenu(block) {
  const categories = (block.categories || []).map(category =>
    el('div', { class: 'menu-cat' }, [
      el('h3', { class: 'menu-cat__title' }, category.name),
      el('div', {}, (category.items || []).map(item =>
        el('article', { class: 'menu-item' }, [
          el('div', { class: 'menu-item__name' }, [
            el('span', {}, item.name),
            ...(item.tags || []).map(tag => el('span', { class: `tag tag--${tag.toLowerCase()}` }, tag))
          ]),
          el('div', { class: 'menu-item__price' }, [
            el('span', { class: 'menu-item__price-now' }, formatPrice(item.price)),
            item.oldPrice ? el('span', { class: 'menu-item__price-old' }, formatPrice(item.oldPrice)) : null
          ]),
          item.description ? el('div', { class: 'menu-item__desc' }, item.description) : null
        ])
      ))
    ])
  );

  return section({
    id: block.id,
    className: 'menu',
    bg: block.bg || '',
    head: sectionHead({ eyebrow: block.eyebrow, title: block.title, subtitle: block.subtitle, center: block.center === true }),
    body: el('div', {}, [
      el('div', {
        class: 'menu-grid',
        style: { '--menu-cols': String(block.columns || state.settings.menuColumns || 2) }
      }, categories),
      block.note ? el('p', { class: 'menu-note' }, block.note) : null
    ])
  });
}

/** gallery — сетка фотографий */
function renderGallery(block) {
  const items = (block.images || []).map(image =>
    el('figure', { class: 'gallery__item' }, [
      picture(image),
      image.caption ? el('figcaption', {}, image.caption) : null
    ])
  );

  return section({
    id: block.id,
    className: 'gallery-section',
    bg: block.bg || 'soft',
    head: sectionHead({ eyebrow: block.eyebrow, title: block.title, subtitle: block.subtitle, center: block.center !== false }),
    body: el('div', {
      class: 'gallery',
      style: { '--gal-cols': String(block.columns || state.settings.galleryColumns || 3), '--ratio': block.ratio || state.settings.imageRatio || '4 / 3' }
    }, items)
  });
}

/** team — карточки сотрудников */
function renderTeam(block) {
  const people = (block.people || []).map(person =>
    el('article', { class: 'person' }, [
      person.photo ? el('div', { class: 'person__photo' }, [picture({ src: person.photo, alt: person.name })]) : null,
      el('div', { class: 'person__body' }, [
        el('h3', { class: 'person__name' }, person.name),
        person.role ? el('p', { class: 'person__role' }, person.role) : null,
        person.text ? el('p', { class: 'person__text' }, person.text) : null
      ])
    ])
  );

  return section({
    id: block.id,
    className: 'team-section',
    bg: block.bg || '',
    head: sectionHead({ eyebrow: block.eyebrow, title: block.title, subtitle: block.subtitle, center: block.center !== false }),
    body: el('div', {
      class: 'team',
      style: { '--team-cols': String(block.columns || state.settings.teamColumns || 3) }
    }, people)
  });
}

/** contacts — адрес, телефон, часы работы, карта */
function renderContacts(block) {
  const site = state.data.site;

  const info = el('div', { class: 'info-list' }, [
    site.phone ? el('div', { class: 'info-row' }, [
      el('span', { class: 'info-row__key' }, 'Телефон'),
      el('span', { class: 'info-row__val' }, [
        el('a', { href: `tel:${site.phoneHref || site.phone.replace(/[^+\d]/g, '')}` }, site.phone)
      ])
    ]) : null,
    site.address ? el('div', { class: 'info-row' }, [
      el('span', { class: 'info-row__key' }, 'Адрес'),
      el('span', { class: 'info-row__val' }, site.address)
    ]) : null,
    site.email ? el('div', { class: 'info-row' }, [
      el('span', { class: 'info-row__key' }, 'Почта'),
      el('span', { class: 'info-row__val' }, [el('a', { href: `mailto:${site.email}` }, site.email)])
    ]) : null
  ]);

  const schedule = Array.isArray(block.schedule) && block.schedule.length
    ? el('div', { class: 'schedule' }, block.schedule.map(row =>
        el('div', { class: 'schedule__row' }, [
          el('span', { class: 'schedule__days' }, row.days),
          el('span', { class: 'schedule__hours' }, row.hours)
        ])))
    : null;

  const extra = Array.isArray(block.extra) && block.extra.length
    ? el('ul', { class: 'extra-list' }, block.extra.map(item => el('li', {}, item)))
    : null;

  const left = el('div', {}, [info, schedule, extra]);

  const mapUrl = block.mapUrl || site.mapUrl;
  const right = el('div', { class: 'contacts__map' }, [
    block.image?.src ? mediaCard(block.image, block.ratio || '4 / 3') : null,
    mapLink(mapUrl)
  ]);

  return section({
    id: block.id,
    className: 'contacts-section',
    bg: block.bg || 'soft',
    head: sectionHead({ eyebrow: block.eyebrow, title: block.title, subtitle: block.subtitle }),
    body: el('div', { class: 'contacts' }, [left, right])
  });
}

/** Таблица «тип блока -> функция». Здесь добавляются новые типы */
const RENDERERS = {
  hero: renderHero,
  'text-image': renderTextImage,
  text: renderText,
  promo: renderPromo,
  menu: renderMenu,
  gallery: renderGallery,
  team: renderTeam,
  contacts: renderContacts
};


/* ---------------------------------------------------------------------
   3. ШАПКА, ПОДВАЛ, МЕТА-ТЕГИ
   --------------------------------------------------------------------- */

function applySiteMeta() {
  const site = state.data.site || {};

  // <title>, описание, каноническая ссылка и карточка для соцсетей
  document.title = site.title || [site.name, site.tagline].filter(Boolean).join(' — ');
  setMeta('meta[name="description"]', site.description);
  setMeta('link[rel="canonical"]', site.url, 'href');
  setMeta('meta[property="og:site_name"]', site.name);
  setMeta('meta[property="og:title"]', site.title || site.name);
  setMeta('meta[property="og:description"]', site.description);
  setMeta('meta[property="og:url"]', site.url);
  setMeta('meta[name="theme-color"]', state.settings.colors?.bg, 'content');
  document.documentElement.lang = site.lang || 'ru';

  document.querySelectorAll('[data-field]').forEach(node => {
    const key = node.dataset.field;
    if (site[key]) node.textContent = site[key];
  });
}

function setMeta(selector, value, attr = 'content') {
  if (!value) return;
  const node = document.querySelector(selector);
  if (node) node.setAttribute(attr, value);
}

/** Структурированные данные для Яндекса/Google (Rich Results) */
function applyJsonLd() {
  const site = state.data.site || {};
  const contacts = (state.data.blocks || []).find(b => b.type === 'contacts');
  const image = blockImage();

  // превращаем относительный путь картинки в абсолютный (нужно для schema.org)
  let absoluteImage;
  if (image && site.url) {
    try { absoluteImage = new URL(image, site.url).href; } catch { absoluteImage = undefined; }
  }

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: site.name,
    description: site.description,
    url: site.url,
    telephone: site.phone,
    email: site.email,
    servesCuisine: site.cuisine || undefined,
    priceRange: site.priceRange || undefined,
    address: site.address ? { '@type': 'PostalAddress', streetAddress: site.address } : undefined,
    image: absoluteImage || undefined,
    openingHoursSpecification: (contacts?.schedule || []).map(row => {
      const times = row.hours.match(/\d{1,2}:\d{2}/g) || [];
      return {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: row.days,
        opens: times[0] || undefined,
        closes: times[times.length - 1] || undefined
      };
    })
  };

  const node = document.getElementById('jsonld');
  if (node) {
    node.textContent = JSON.stringify(data, (key, value) => (value === undefined ? undefined : value))
      .replace(/</g, '\\u003c');
  }
}

/** Первая найденная картинка в JSON — для og:image */
function blockImage() {
  for (const block of state.data.blocks || []) {
    if (block.image?.src) return block.image.src;
    if (block.images?.[0]?.src) return block.images[0].src;
  }
  return null;
}

/** Меню в шапке + кнопка действия */
function buildNav() {
  const site = state.data.site || {};
  const list = document.getElementById('nav-list');
  if (!list) return;

  const items = (site.nav || []).map(item =>
    el('li', { class: 'nav__item' }, [
      el('a', { class: 'nav__link', href: toHref(item.target) }, item.label)
    ])
  );

  // кнопка действия дублируется в мобильном меню
  if (site.cta?.label) {
    items.push(el('li', { class: 'nav__item nav__cta' }, [button({ ...site.cta, style: 'primary' })]));
  }

  list.append(...items);

  const cta = document.getElementById('header-cta');
  if (cta && site.cta?.label) {
    cta.textContent = site.cta.label;
    cta.setAttribute('href', toHref(site.cta.target));
  } else if (cta) {
    cta.remove();
  }

  // меню в подвале
  const footerNav = document.getElementById('footer-nav');
  if (footerNav) {
    footerNav.append(...(site.nav || []).map(item =>
      el('li', {}, [el('a', { href: toHref(item.target) }, item.label)])));
  }
}

function buildFooter() {
  const site = state.data.site || {};

  const phone = document.getElementById('footer-phone');
  if (phone && site.phone) {
    phone.textContent = site.phone;
    phone.href = `tel:${site.phoneHref || site.phone.replace(/[^+\d]/g, '')}`;
  } else if (phone) phone.closest('p')?.remove();

  const email = document.getElementById('footer-email');
  if (email && site.email) {
    email.textContent = site.email;
    email.href = `mailto:${site.email}`;
  } else if (email) email.closest('p')?.remove();

  const address = document.getElementById('footer-address');
  if (address) {
    if (site.address) address.textContent = site.address;
    else address.remove();
  }

  const social = document.getElementById('footer-social');
  if (social && Array.isArray(site.social)) {
    social.append(...site.social.filter(s => s.url).map(s =>
      el('li', {}, [el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.label || s.url)])));
  }
  if (social && !social.children.length) social.closest('div')?.remove();

  const copy = document.getElementById('footer-copy');
  if (copy) {
    copy.textContent = `© ${new Date().getFullYear()} ${site.name || ''}${site.legalNote ? ' · ' + site.legalNote : ''}`.trim();
  }
}


/* ---------------------------------------------------------------------
   4. ТЕМЫ И НАСТРОЙКИ ИЗ JSON
   ---------------------------------------------------------------------
   Всё, что задано в settings, применяется как CSS-переменные.
   То есть цвета и размеры можно менять вообще без правки style.css.
   --------------------------------------------------------------------- */

const COLOR_MAP = {
  bg: '--c-bg', bgSoft: '--c-bg-soft', card: '--c-card', text: '--c-text',
  muted: '--c-muted', accent: '--c-accent', accentText: '--c-accent-txt', line: '--c-line'
};

function applySettings() {
  const s = state.settings;
  const root = document.documentElement;

  for (const [key, cssVar] of Object.entries(COLOR_MAP)) {
    if (s.colors?.[key]) root.style.setProperty(cssVar, s.colors[key]);
  }

  const px = (value, cssVar) => {
    if (value === undefined || value === null || value === '') return;
    root.style.setProperty(cssVar, typeof value === 'number' ? `${value}px` : value);
  };

  px(s.radius, '--radius');
  px(s.maxWidth, '--maxw');
  px(s.blockGap, '--gap');
  if (s.imageRatio) root.style.setProperty('--ratio', s.imageRatio);

  // шрифты, если захотите подключить свои
  if (s.fontHead) root.style.setProperty('--font-head', s.fontHead);
  if (s.fontBody) root.style.setProperty('--font-body', s.fontBody);
}


/* ---------------------------------------------------------------------
   5. ИНТЕРАКТИВ: меню-бургер, «липкая» шапка, активный пункт, анимации
   --------------------------------------------------------------------- */

function initBurger() {
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav');
  if (!burger || !nav) return;

  const close = () => {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
    document.body.style.overflow = '';
  };

  burger.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(isOpen));
    burger.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // закрытие по клику на ссылку, мимо меню и по Escape
  nav.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  document.addEventListener('click', e => {
    if (!e.target.closest('#nav') && !e.target.closest('#burger')) close();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

function initHeaderShadow() {
  const header = document.getElementById('header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/** Подсветка пункта меню, до которого докрутили */
function initScrollSpy() {
  const links = [...document.querySelectorAll('.nav__link')];
  if (!links.length) return;

  const map = new Map();
  links.forEach(link => {
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) map.set(target, link);
  });
  if (!map.size) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(l => l.classList.remove('is-active'));
      map.get(entry.target)?.classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

  map.forEach((_, target) => observer.observe(target));
}

/** Плавное появление блоков при прокрутке */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!CONFIG.animateOnScroll || !('IntersectionObserver' in window)) {
    items.forEach(item => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      obs.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  items.forEach(item => observer.observe(item));
}

/** Лайтбокс: клик по фото в галерее открывает его крупно */
function initLightbox() {
  if (!CONFIG.lightbox) return;

  const overlay = el('div', {
    class: 'lightbox',
    style: {
      position: 'fixed', inset: '0', zIndex: '100', display: 'none',
      placeItems: 'center', padding: '20px', background: 'rgb(0 0 0 / .88)',
      cursor: 'zoom-out', backdropFilter: 'blur(4px)'
    }
  });
  const img = el('img', { style: { maxWidth: '100%', maxHeight: '88vh', borderRadius: '8px', boxShadow: '0 30px 80px rgb(0 0 0 / .6)' } });
  overlay.append(img);
  document.body.append(overlay);

  const close = () => { overlay.style.display = 'none'; img.src = ''; };
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  document.querySelectorAll('.gallery__item img, .media-card img').forEach(node => {
    node.style.cursor = 'zoom-in';
    node.addEventListener('click', () => {
      // если рядом есть .webp — открываем его
      const source = node.parentElement.querySelector('source[type="image/webp"]');
      img.src = source ? source.getAttribute('srcset') : node.src;
      img.alt = node.alt;
      overlay.style.display = 'grid';
    });
  });
}


/* ---------------------------------------------------------------------
   6. ТОЧКА ВХОДА
   --------------------------------------------------------------------- */

function renderBlocks() {
  const main = document.getElementById('main');
  const loader = document.getElementById('loader');
  if (loader) loader.remove();

  const blocks = (state.data.blocks || []).filter(block => block && block.visible !== false);

  blocks.forEach(block => {
    const render = RENDERERS[block.type];

    if (!render) {
      console.warn(`[site.json] Неизвестный тип блока: "${block.type}" (id: ${block.id || '—'}). Блок пропущен.`);
      return;
    }

    // если id не задан — делаем его из заголовка, чтобы работали ссылки в меню
    if (!block.id) block.id = slugify(block.title || block.type);

    const node = render(block);
    if (node) main.append(node);
  });

  if (!blocks.length) {
    main.append(el('div', { class: 'loader container' }, [
      el('p', {}, 'В data/site.json нет ни одного блока. Добавьте блок в массив "blocks".')
    ]));
  }
}

/**
   Загружает JSON. Основной способ — fetch, запасной — XMLHttpRequest
   (нужен для очень старых браузеров и для тестов в jsdom).
*/
function loadJson(path) {
  if (typeof fetch === 'function') {
    return fetch(path, { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Сервер вернул ${response.status} для ${path}`);
        return response.text();
      });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', path, true);
    xhr.overrideMimeType('application/json; charset=utf-8');
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
      else reject(new Error(`Сервер вернул ${xhr.status} для ${path}`));
    };
    xhr.onerror = () => reject(new Error(`Не удалось скачать ${path}`));
    xhr.send();
  });
}

function showFatal(message) {
  const fatal = document.getElementById('fatal');
  const text = document.getElementById('fatal-text');
  const loader = document.getElementById('loader');
  if (loader) loader.remove();
  if (text) text.textContent = message;
  if (fatal) fatal.hidden = false;
  console.error(message);
}

async function boot() {
  try {
    const text = await loadJson(CONFIG.jsonPath);
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      // самая частая ошибка новичков — лишняя запятая или кавычки в JSON
      throw new Error(`Ошибка в ${CONFIG.jsonPath}: ${error.message}`);
    }

    state.data = data;
    state.settings = data.settings || {};
    CONFIG.animateOnScroll = state.settings.animateOnScroll !== false;

    applySettings();
    applySiteMeta();
    buildNav();
    buildFooter();
    renderBlocks();
    applyJsonLd();

    initBurger();
    initHeaderShadow();
    initScrollSpy();
    initReveal();
    initLightbox();

    console.info(`Сайт собран: ${(data.blocks || []).filter(b => b.visible !== false).length} блок(ов) из ${CONFIG.jsonPath}`);
  } catch (error) {
    showFatal(error.message || String(error));
  }
}

// запускаем, как только готов DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
