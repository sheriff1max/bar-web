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

## 1. Netlify Drop — попробовать прямо сейчас (2 минуты)

1. Зайдите на app.netlify.com/drop
2. Перетащите папку проекта в окно браузера
3. Получите адрес вида `https://oliva-123.netlify.app`

Удобен как «черновик для показа заказчику». Для боевого сайта подключите
репозиторий (см. пункт 3) — тогда публикации станут автоматическими.

---

## 2. GitHub Pages — бесплатно, правки через веб-интерфейс

Workflow уже лежит в `.github/workflows/deploy.yml`: он проверяет JSON
и публикует содержимое при каждом push в `main`.

Одноразовая настройка:
1. Создайте репозиторий, залейте папку проекта (`git add . && git commit && git push`).
2. В репозитории: **Settings → Pages → Source: GitHub Actions**.
3. Готово: `https://<пользователь>.github.io/<репозиторий>/`.

Плюс способа: цены можно править прямо на сайте github.com
(файл `data/site.json` → карандаш → commit) — публикация уйдёт сама.

> Если репозиторий будет называться не `<user>.github.io`, сайт живёт в подпапке.
> Все пути в проекте относительные, поэтому ничего переписывать не нужно.

---

## 3. Netlify / Vercel через Git — превью каждой правки

Конфиги лежат в корне: `netlify.toml` и `vercel.json`.

- **Netlify**: New site → Import an existing project → выбрать репозиторий.
  Build command можно оставить пустым (в toml стоит проверка JSON), publish = корень.
- **Vercel**: Add New → Project → импорт репозитория. Настройки подтянутся из vercel.json.

Каждый pull request получает свой превью-адрес — удобно согласовывать правки меню.

---

## 4. Свой VPS + nginx — полный контроль

### 4.1 Автоматически (рекомендуется)

```bash
scp -r restaurant-site user@server:/opt/restaurant
ssh user@server
sudo bash /opt/restaurant/deploy/vps-install.sh ваш-домен.ру
sudo certbot --nginx -d ваш-домен.ру        # HTTPS от Let's Encrypt
```

Скрипт ставит nginx, раскладывает файлы в `/var/www/restaurant`,
прописывает конфиг из `deploy/nginx/site.conf` и перезагружает nginx.

### 4.2 Вручную, без скрипта

```bash
sudo apt install nginx
sudo mkdir -p /var/www/restaurant
# скопируйте index.html, robots.txt, sitemap.xml, assets/, data/ в /var/www/restaurant
sudo cp deploy/nginx/site.conf /etc/nginx/conf.d/restaurant.conf
# в конфиге поправьте server_name и root
sudo nginx -t && sudo systemctl reload nginx
```

### 4.3 Docker (если сервер уже живёт на образах)

```bash
docker build -t restaurant .
docker run -d --name restaurant --restart unless-stopped -p 8080:80 restaurant
# далее любой reverse proxy (nginx/traefik/caddy) проксирует 8080 -> 443
```

Внутри образа — официальный `nginx:alpine` и тот же `deploy/nginx/site.conf`.

---

## 5. Обновление контента на боевом сайте

Контент = `data/site.json` (+ файлы фото, если менялись). Никаких перезапусков:
конфиг nginx/хостинга отдаёт JSON с заголовком `Cache-Control: no-cache`,
поэтому посетители увидят правки сразу, а картинки и стили при этом остаются
в долгом кэше (быстрая загрузка).

Рабочий процесс:

1. Правите `data/site.json` локально, смотрите на `http://localhost:8080`.
2. `python3 tools/check_content.py`.
3. Публикуете способом своего хостинга:
   - GitHub/Netlify/Vercel: commit + push (или правка файла в веб-интерфейсе);
   - VPS: `scp data/site.json user@server:/var/www/restaurant/data/site.json`
     (или повторный запуск `vps-install.sh`, если менялись и фото).
4. Проверяете боевой адрес в режиме инкогнито.

Откат: файл лежит в git — возвращаете предыдущую версию одной командой
`git revert` / через веб-интерфейс.

---

## 6. Если негде запустить локальный сервер

Браузер запрещает странице читать JSON с диска (`file://`), поэтому «двойной
клик по index.html» не работает. Обходные пути по возрастанию удобства:

1. `python3 -m http.server 8080` — Python есть почти везде, включая macOS.
2. VS Code: расширение **Live Server** → правый клик по index.html → Open with Live Server.
3. Сразу Netlify Drop (пункт 1) — локальный сервер вообще не нужен.

---

## 7. Чек-лист перед запуском

- [ ] `site.url`, `site.phone`, `site.address`, `site.email` — реальные
- [ ] `robots.txt` и `sitemap.xml` содержат ваш домен (`python3 tools/make_sitemap.py`)
- [ ] `assets/img/og.jpg` — ваша обложка для мессенджеров (1200×630)
- [ ] favicon заменён при необходимости (`assets/img/favicon.svg`)
- [ ] все фото имеют `alt` (`check_content.py` подскажет)
- [ ] фото сжаты (`optimize_images.py`), суммарный вес страницы < 1.5 МБ
- [ ] HTTPS включён (все хостинги из пунктов 1-3 делают это сами)
