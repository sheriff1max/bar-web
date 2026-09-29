"""
Утилита: подготовка фотографий для сайта.

Что делает:
  1. Обрезает исходное фото под нужный формат (cover, без искажений).
  2. Уменьшает до рабочей ширины.
  3. Сохраняет две версии: .jpg (совместимость) и .webp (в ~2-3 раза меньше).

Зачем: браузер получает лёгкие картинки, сайт грузится быстро и на мобильном интернете.

Как пользоваться:
  положите свои фото в assets/img/_original/
  и запустите:   python3 tools/optimize_images.py

  Список файлов и размеров правится ниже, в переменной TARGETS.
"""

import os
from PIL import Image

ROOT = os.path.join(os.environ.get("ARENA_WORKSPACE", "."), "restaurant-site")
SRC = os.path.join(ROOT, "assets", "img", "_original")
DST = os.path.join(ROOT, "assets", "img")

# имя результата (без расширения) : (ширина, высота, качество)
TARGETS = {
    "hero": (1600, 900, 78),
    "about": (1200, 900, 78),
    "promo": (1200, 800, 78),
    "blyudo-1": (900, 700, 76),
    "blyudo-2": (900, 700, 76),
    "blyudo-3": (900, 700, 76),
    "blyudo-4": (900, 700, 76),
    "blyudo-5": (900, 700, 76),
    "blyudo-6": (900, 700, 76),
    "interer-1": (900, 700, 76),
    "interer-2": (900, 700, 76),
    "interer-3": (900, 700, 76),
    "komanda-1": (800, 800, 76),
    "komanda-2": (800, 800, 76),
}

EXTS = (".jpg", ".jpeg", ".png", ".webp")


def find_source(name):
    """Ищем исходник name.<любое расширение> в _original или в img."""
    for folder in (SRC, DST):
        if not os.path.isdir(folder):
            continue
        for ext in EXTS:
            p = os.path.join(folder, name + ext)
            if os.path.exists(p):
                return p
    return None


def cover(im, w, h):
    """Обрезка по центру под пропорции w:h."""
    src_ratio = im.width / im.height
    dst_ratio = w / h
    if src_ratio > dst_ratio:
        new_w = int(im.height * dst_ratio)
        left = (im.width - new_w) // 2
        im = im.crop((left, 0, left + new_w, im.height))
    else:
        new_h = int(im.width / dst_ratio)
        top = (im.height - new_h) // 2
        im = im.crop((0, top, im.width, top + new_h))
    return im.resize((w, h), Image.LANCZOS)


def main():
    done = skipped = 0
    for name, (w, h, q) in TARGETS.items():
        src = find_source(name)
        if not src:
            skipped += 1
            continue
        im = Image.open(src).convert("RGB")
        im = cover(im, w, h)
        jpg = os.path.join(DST, name + ".jpg")
        webp = os.path.join(DST, name + ".webp")
        im.save(jpg, "JPEG", quality=q, optimize=True, progressive=True)
        im.save(webp, "WEBP", quality=q - 4, method=6)
        size_kb = (os.path.getsize(jpg) + os.path.getsize(webp)) / 1024
        print(f"  ok  {name}: {w}x{h}  jpg+webp = {size_kb:.0f} КБ  (из {os.path.basename(src)})")
        done += 1
    print(f"\nОбработано: {done}, пропущено (нет исходника): {skipped}")
    if skipped:
        print("Подсказка: положите исходные фото в assets/img/_original/ с именами из списка TARGETS.")


if __name__ == "__main__":
    main()
