import os

OUT = os.path.join(os.environ["ARENA_WORKSPACE"], "restaurant-site", "assets", "img")
os.makedirs(OUT, exist_ok=True)

FG = "#c9a227"
SUB = "#8f887c"
GRID = "#241f1a"


def svg(w, h, title, subtitle):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d1a16"/>
      <stop offset="1" stop-color="#100e0c"/>
    </linearGradient>
    <pattern id="p" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0v48" fill="none" stroke="{GRID}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#g)"/>
  <rect width="{w}" height="{h}" fill="url(#p)"/>
  <rect x="24" y="24" width="{w-48}" height="{h-48}" fill="none" stroke="{FG}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="14 10"/>
  <g font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
    <text x="{w/2}" y="{h/2 - 8}" fill="{FG}" font-size="{max(26, w//22)}" letter-spacing="2">{title}</text>
    <text x="{w/2}" y="{h/2 + 40}" fill="{SUB}" font-size="{max(16, w//46)}">{subtitle}</text>
  </g>
</svg>
'''

items = [
    ("blyudo-1.svg", 900, 700, "БЛЮДО 1", "assets/img/blyudo-1.svg"),
    ("blyudo-2.svg", 900, 700, "БЛЮДО 2", "assets/img/blyudo-2.svg"),
    ("blyudo-3.svg", 900, 700, "БЛЮДО 3", "assets/img/blyudo-3.svg"),
    ("blyudo-4.svg", 900, 700, "БЛЮДО 4", "assets/img/blyudo-4.svg"),
    ("blyudo-5.svg", 900, 700, "БЛЮДО 5", "assets/img/blyudo-5.svg"),
    ("blyudo-6.svg", 900, 700, "БЛЮДО 6", "assets/img/blyudo-6.svg"),
    ("promo.svg", 1200, 800, "АКЦИЯ", "assets/img/promo.svg"),
    ("interer-1.svg", 900, 700, "ИНТЕРЬЕР 1", "assets/img/interer-1.svg"),
    ("interer-2.svg", 900, 700, "ИНТЕРЬЕР 2", "assets/img/interer-2.svg"),
    ("interer-3.svg", 900, 700, "ИНТЕРЬЕР 3", "assets/img/interer-3.svg"),
    ("komanda-1.svg", 800, 800, "ШЕФ-ПОВАР", "assets/img/komanda-1.svg"),
    ("komanda-2.svg", 800, 800, "СОМЕЛЬЕ", "assets/img/komanda-2.svg"),
    ("karta.svg", 1200, 700, "КАРТА / СХЕМА ПРОЕЗДА", "assets/img/karta.svg"),
]

for name, w, h, title, sub in items:
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(svg(w, h, title, sub))

print("создано заглушек:", len(items))
