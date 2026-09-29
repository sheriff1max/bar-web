#!/usr/bin/env python3
"""
Генератор sitemap.xml из data/site.json.

Запускать после изменения site.url или перед публикацией:
    python3 tools/make_sitemap.py

Берёт адрес сайта из поля site.url и id всех видимых блоков,
которые есть в меню (на них ведут якорные ссылки).
"""

import json
import os
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(ROOT, "data", "site.json"), encoding="utf-8") as f:
    data = json.load(f)

base = (data.get("site", {}).get("url") or "").rstrip("/")
if not base:
    raise SystemExit("Заполните site.url в data/site.json (например, https://oliva.ru)")

today = date.today().isoformat()
urls = [("", "1.0", "weekly")]

nav_targets = [item.get("target") for item in data.get("site", {}).get("nav", []) if item.get("target")]
for target in nav_targets:
    urls.append((f"#{target}", "0.8", "monthly"))

lines = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for path, priority, changefreq in urls:
    lines += [
        "  <url>",
        f"    <loc>{base}/{path}</loc>",
        f"    <lastmod>{today}</lastmod>",
        f"    <changefreq>{changefreq}</changefreq>",
        f"    <priority>{priority}</priority>",
        "  </url>",
    ]
lines.append("</urlset>")

out = os.path.join(ROOT, "sitemap.xml")
with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"sitemap.xml создан: {len(urls)} адрес(ов), домен {base}")
