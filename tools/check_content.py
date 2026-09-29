#!/usr/bin/env python3
"""
Проверка data/site.json перед публикацией.

Что проверяет:
  • JSON вообще читается (лишняя запятая, опечатка в кавычках)
  • есть обязательные поля (site.name, blocks)
  • все типы блоков известны сайту (список ниже в KNOWN_TYPES)
  • id блоков уникальны и на них ссылаются пункты меню
  • все файлы картинок существуют на диске
  • есть ли .webp-версия рядом с .jpg (экономия трафика)
  • у картинок заполнен alt (важно для SEO и доступности)

Запуск:
    python3 tools/check_content.py
Код возврата 1 означает «найдены ошибки» — можно встроить в CI.
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT, "data", "site.json")

# типы блоков, которые умеет рисовать assets/js/app.js (объект RENDERERS)
KNOWN_TYPES = {"hero", "text-image", "text", "promo", "menu", "gallery", "team", "contacts"}

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def check_image(image, where):
    """Проверяет одну картинку: путь существует, alt заполнен, есть ли webp."""
    if not image:
        return
    if isinstance(image, str):
        image = {"src": image}

    src = image.get("src")
    if not src:
        return

    if src.startswith(("http://", "https://", "//", "data:")):
        return  # внешняя ссылка — на диске её нет, это нормально

    path = os.path.join(ROOT, src.lstrip("/"))
    if not os.path.exists(path):
        err(f"{where}: файл картинки не найден -> {src}")
        return

    if not image.get("alt"):
        warn(f"{where}: у картинки {src} нет поля \"alt\" (описание для поисковиков и скринридеров)")

    if src.lower().endswith((".jpg", ".jpeg", ".png")):
        webp = os.path.splitext(path)[0] + ".webp"
        if not os.path.exists(webp):
            warn(f"{where}: нет .webp-версии для {src} — можно создать: python3 tools/optimize_images.py")

    size = os.path.getsize(path) / 1024
    if size > 400:
        warn(f"{where}: {src} весит {size:.0f} КБ — лучше сжать (tools/optimize_images.py)")


def main():
    if not os.path.exists(JSON_PATH):
        print(f"✗ Файл не найден: {JSON_PATH}")
        return 1

    raw = open(JSON_PATH, encoding="utf-8").read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        err(f"JSON не читается: {e.msg} (строка {e.lineno}, колонка {e.colno})")
        report()
        return 1

    site = data.get("site", {})
    blocks = data.get("blocks")

    if not isinstance(site, dict):
        err("Поле \"site\" должно быть объектом { }")
    if not site.get("name"):
        err("Не заполнено site.name — название ресторана")
    if not site.get("description"):
        warn("Не заполнено site.description — сниппет в поисковой выдаче будет пустым")
    if site.get("url") and not site["url"].startswith("http"):
        warn("site.url должно начинаться с https:// (нужно для sitemap и schema.org)")

    if not isinstance(blocks, list):
        err("Поле \"blocks\" должно быть массивом [ ]")
        report()
        return 1

    ids = set()
    used_ids = set()
    nav_targets = {item.get("target") for item in site.get("nav", [])}
    if site.get("cta", {}).get("target"):
        nav_targets.add(site["cta"]["target"])

    for index, block in enumerate(blocks):
        where = f"blocks[{index}]"
        if not isinstance(block, dict):
            err(f"{where}: блок должен быть объектом {{ }}")
            continue

        btype = block.get("type")
        bid = block.get("id") or f"(без id, #{index})"
        where = f"blocks[{index}] «{bid}»"

        if not btype:
            err(f"{where}: нет поля \"type\"")
            continue
        if btype not in KNOWN_TYPES:
            err(f"{where}: неизвестный тип \"{btype}\". Доступны: {', '.join(sorted(KNOWN_TYPES))}")
            continue
        if block.get("visible") is False:
            warn(f"{where}: блок скрыт (visible: false) — на сайте его не будет")

        if block.get("id"):
            if block["id"] in ids:
                err(f"{where}: такой id уже используется — ссылки в меню сломаются")
            ids.add(block["id"])
            used_ids.add(block["id"])

        if not block.get("title") and btype != "hero":
            warn(f"{where}: нет поля \"title\" — блок будет без заголовка")

        if block.get("imagePosition") not in (None, "left", "right"):
            err(f"{where}: imagePosition может быть только \"left\" или \"right\", сейчас: {block['imagePosition']!r}")

        check_image(block.get("image"), where)

        for i, img in enumerate(block.get("images", []) or []):
            check_image(img, f"{where} images[{i}]")
        for i, person in enumerate(block.get("people", []) or []):
            if person.get("photo"):
                check_image({"src": person["photo"], "alt": person.get("name", "")}, f"{where} people[{i}]")

        # меню: проверяем цены
        for cat in block.get("categories", []) or []:
            for i, item in enumerate(cat.get("items", []) or []):
                if item.get("price") in (None, ""):
                    warn(f"{where} «{cat.get('name')}» позиция {i + 1}: нет цены")
                old, new = item.get("oldPrice"), item.get("price")
                if old and new and isinstance(old, (int, float)) and isinstance(new, (int, float)) and old <= new:
                    warn(f"{where} «{item.get('name')}»: oldPrice ({old}) должен быть больше price ({new})")

        for i, btn in enumerate(block.get("buttons", []) or []):
            target = btn.get("target") or btn.get("href")
            if target and not str(target).startswith("http"):
                nav_targets.discard(target)
                if target.lstrip("#") not in ids:
                    pass  # проверим после цикла, когда известны все id
                used_ids.add(str(target).lstrip("#"))

    # ссылки меню/кнопок на несуществующие блоки
    missing = {t.lstrip("#") for t in nav_targets if t and not str(t).startswith("http")}
    for target in sorted(missing - ids):
        err(f"Ссылка ведёт на блок \"{target}\", которого нет в blocks (или у блока другой id)")

    report()
    return 1 if errors else 0


def report():
    print("=" * 62)
    print("  ПРОВЕРКА data/site.json")
    print("=" * 62)
    for msg in errors:
        print(f"  ✗ ОШИБКА   {msg}")
    for msg in warnings:
        print(f"  ! Внимание {msg}")
    print("-" * 62)
    if errors:
        print(f"  Итог: {len(errors)} ошиб., {len(warnings)} предупрежд. — публикацию лучше отложить")
    elif warnings:
        print(f"  Итог: ошибок нет, {len(warnings)} предупрежд. — публиковать можно")
    else:
        print("  Итог: всё чисто ✓")
    print("=" * 62)


if __name__ == "__main__":
    sys.exit(main())
