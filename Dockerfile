# ==========================================================================
# Ресторан — production-образ: nginx отдаёт статику
# Сборка:   docker build -t restaurant .
# Запуск:   docker run -d -p 8080:80 --name restaurant restaurant
# ==========================================================================
FROM nginx:1.27-alpine

# раскладка nginx: кэш для статики + сжатие + безопасность
COPY deploy/nginx/site.conf /etc/nginx/conf.d/default.conf

# сам сайт (только то, что нужно в production; tools/ и serve.js не копируем)
COPY index.html robots.txt /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY data /usr/share/nginx/html/data

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
