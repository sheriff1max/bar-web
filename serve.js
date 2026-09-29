#!/usr/bin/env node
/**
 * Локальный сервер для разработки — без единой зависимости.
 *
 * Зачем нужен: если открыть index.html двойным кликом (адрес file://),
 * браузер запретит читать data/site.json. Через http://localhost всё работает.
 *
 * Запуск:
 *     node serve.js            -> http://localhost:8080
 *     node serve.js 3000       -> http://localhost:3000
 *
 * То же самое умеет и Python:  python3 -m http.server 8080
 * Этот файл удобнее тем, что добавляет правильные заголовки и не кэширует JSON,
 * поэтому правки в data/site.json видны сразу после F5.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf'
};

function safePath(requestPath) {
  // защита от выхода за пределы папки проекта (../../etc/passwd)
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const resolved = path.resolve(ROOT, '.' + decoded);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

const server = http.createServer((req, res) => {
  let filePath = safePath(url.parse(req.url).pathname);

  if (!filePath) {
    res.writeHead(403);
    return res.end('403 Forbidden');
  }

  // папка -> index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 — файл не найден: ${url.parse(req.url).pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // в разработке ничего не кэшируем — правки видны сразу
      'Cache-Control': 'no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    };

    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Ресторан — локальный сервер');
  console.log('  ---------------------------------------');
  console.log(`  Адрес:      http://localhost:${PORT}`);
  console.log(`  Папка:      ${ROOT}`);
  console.log('  Контент:    data/site.json');
  console.log('  Остановить: Ctrl+C');
  console.log('');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} занят. Запустите так: node serve.js 8081`);
    process.exit(1);
  }
  throw error;
});
