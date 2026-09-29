#!/usr/bin/env bash
# ==========================================================================
# Установка сайта на «голый» VPS (Ubuntu/Debian) одной командой.
#
#   1. Скопируйте папку проекта на сервер, например:
#        scp -r restaurant-site user@server:/opt/restaurant
#   2. Зайдите на сервер и выполните:
#        sudo bash /opt/restaurant/deploy/vps-install.sh ваш-домен.ru
#
# Скрипт: ставит nginx, копирует конфиг, раскладывает сайт, включает автозапуск.
# После этого сайт доступен по http://ваш-домен.ru
# HTTPS:  sudo certbot --nginx -d ваш-домен.ru   (см. комментарий в site.conf)
# ==========================================================================
set -euo pipefail

DOMAIN="${1:-_}"
APP_DIR="/opt/restaurant"
WEB_DIR="/var/www/restaurant"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== 1/5 nginx =="
if ! command -v nginx >/dev/null; then
  apt-get update -qq && apt-get install -y -qq nginx
fi

echo "== 2/5 файлы сайта: $SRC_DIR -> $WEB_DIR =="
mkdir -p "$WEB_DIR"
# копируем только то, что нужно посетителю
rsync -a --delete \
  --exclude 'tools/' --exclude 'serve.js' --exclude 'node_modules/' \
  --exclude 'deploy/' --exclude '.git' --exclude '_original/' \
  "$SRC_DIR/" "$WEB_DIR/"
chown -R www-data:www-data "$WEB_DIR"

echo "== 3/5 конфиг nginx =="
sed "s|server_name .*|server_name $DOMAIN;|; s|root .*|root $WEB_DIR;|" \
  "$SRC_DIR/deploy/nginx/site.conf" > /etc/nginx/conf.d/restaurant.conf
# на случай, если domain не указан — оставим catch-all
[ "$DOMAIN" = "_" ] && sed -i "s|server_name _.*|server_name _;|" /etc/nginx/conf.d/restaurant.conf

nginx -t
systemctl reload nginx

echo "== 4/5 проверка =="
sleep 1
curl -s -o /dev/null -w "  http://localhost -> %{http_code}\n" http://localhost/ || true

echo "== 5/5 готово =="
cat <<EOF

  Сайт развёрнут:
    файлы:   $WEB_DIR
    конфиг:  /etc/nginx/conf.d/restaurant.conf
    домен:   $DOMAIN

  Обновление контента:
    1) отредактируйте data/site.json локально
    2) проверьте:      python3 tools/check_content.py
    3) залейте на сервер и повторите установку:
         scp data/site.json user@server:$WEB_DIR/data/site.json
       (nginx перечитывать не нужно — JSON отдаётся без кэша)

  HTTPS:  apt install certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN
EOF
