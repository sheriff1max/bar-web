# Развёртывание сайта

Сайт — чистая статика. Это значит: его можно положить на любой хостинг,
который умеет отдавать файлы. Ниже четыре проверенных пути, от самого простого
к самому контролируемому. Во всех случаях **сборка не нужна**.

## 0. Что именно публиковать

На сервер уезжает только это:

```
index.html
robots.txt
sitemap.xml
assets/      (css, js, img)
data/        (site.json)
```

Не публикуется: `tools/`, `serve.js`, `node_modules/`, `docs/`,
`assets/img/_original/`, `.github/` (кроме случая GitHub Pages, где workflow
сам отбирает нужное).

Перед публикацией:

```bash
python3 tools/check_content.py     # JSON, ссылки, наличие файлов
bash   tools/run_tests.sh          # страница реально собирается
```

---

## 1. Свой VPS + nginx

```bash
scp -r restaurant-site user@server:/opt/restaurant
ssh user@server
sudo bash /opt/restaurant/deploy/vps-install.sh <домен.ру>
sudo certbot --nginx -d <домен.ру>        # HTTPS от Let's Encrypt
```

Скрипт ставит nginx, раскладывает файлы в `/var/www/restaurant`,
прописывает конфиг из `deploy/nginx/site.conf` и перезагружает nginx.

---

## 2. Обновление контента на боевом сайте

Контент = `data/site.json` (+ файлы фото, если менялись).

Никаких перезапусков: конфиг nginx/хостинга отдаёт JSON с заголовком `Cache-Control: no-cache`, поэтому посетители увидят правки сразу, а картинки и стили при этом остаются в долгом кэше (быстрая загрузка).

Рабочий процесс:

1. Правите `data/site.json` локально, смотрите на `http://localhost:8080`.
2. `python3 tools/check_content.py`.
3. Публикация на VPS:
  - `scp data/site.json user@server:/var/www/restaurant/data/site.json`
  - или повторный запуск `vps-install.sh`, если менялись и фото
4. Проверяете боевой адрес в режиме инкогнито.

---

## 3. Чек-лист перед запуском

- [ ] `site.url`, `site.phone`, `site.address`, `site.email` — реальные
- [ ] `robots.txt` и `sitemap.xml` содержат ваш домен (`python3 tools/make_sitemap.py`)
- [ ] `assets/img/og.jpg` — ваша обложка для мессенджеров (1200×630)
- [ ] favicon заменён при необходимости (`assets/img/favicon.svg`)
- [ ] все фото имеют `alt` (`check_content.py` подскажет)
- [ ] фото сжаты (`optimize_images.py`), суммарный вес страницы < 1.5 МБ
- [ ] HTTPS включён (все хостинги из пунктов 1-3 делают это сами)
