"""Placeholder pixel-art generator: 64x64 portraits and 320x180 scenes.
Everything is drawn at native resolution with no anti-aliasing, then saved as PNG.
"""
import math
import os
import random
from PIL import Image, ImageDraw

OUT = "/home/user/pixel-assets"
OL = (34, 26, 30)  # shared outline colour


def hexc(s):
    if isinstance(s, tuple):
        return s
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def rr(d, box, r, fill, outline=None):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline)


# --------------------------------------------------------------- portraits
def portrait(name, skin, hair, cloth, bg, eye, style, extra=None):
    S = 64
    img = Image.new("RGB", (S, S), hexc(bg))
    d = ImageDraw.Draw(img)
    skin, hair, cloth, eye = map(hexc, (skin, hair, cloth, eye))
    bgc = hexc(bg)
    # background: soft bands + a darker floor strip
    for y in range(S):
        if y % 8 == 0 and y > 0:
            d.line([(0, y), (S, y)], fill=shade(bgc, 1.0 - 0.025 * (y // 8)))
    d.rectangle([0, 56, S, S], fill=shade(bgc, 0.85))
    rnd = random.Random(name)
    for _ in range(26):  # sparkles / dust
        x, y = rnd.randrange(S), rnd.randrange(50)
        d.point((x, y), fill=shade(bgc, 1.12))

    hair_back = style in ("long",)
    if hair_back:
        rr(d, [17, 13, 47, 54], 8, hair, OL)
    # body
    rr(d, [10, 46, 54, 70], 10, cloth, OL)
    d.rectangle([13, 52, 51, 53], fill=shade(cloth, 1.15))  # fold highlight
    d.line([(32, 50), (32, 64)], fill=shade(cloth, 0.8))
    # neck
    d.rectangle([28, 39, 36, 47], fill=shade(skin, 0.9), outline=OL)
    # head
    rr(d, [20, 14, 44, 42], 9, skin, OL)
    d.rectangle([21, 36, 43, 38], fill=shade(skin, 0.95))

    # hair front
    if style == "short":
        rr(d, [18, 10, 46, 25], 8, hair, OL)
        for x, hh in ((19, 3), (25, 6), (31, 4), (37, 5)):  # spiky tufts
            d.polygon([(x, 13), (x + 3, 10 - hh), (x + 7, 13)], fill=hair, outline=OL)
        d.rectangle([21, 12, 43, 13], fill=hair)
        d.polygon([(21, 17), (31, 17), (27, 24), (21, 24)], fill=hair)
        d.polygon([(31, 17), (43, 17), (43, 24), (37, 22)], fill=hair)
        d.line([(24, 14), (30, 14)], fill=shade(hair, 1.3))
    elif style == "long":
        rr(d, [18, 10, 46, 24], 8, hair, OL)
        d.rectangle([21, 19, 43, 22], fill=skin)
        d.polygon([(21, 17), (32, 17), (27, 25), (21, 25)], fill=hair)
        d.polygon([(32, 17), (43, 17), (43, 25), (37, 25)], fill=hair)
        for x in (20, 44):  # side locks over the shoulders
            d.rectangle([x - 1, 24, x + 2, 52], fill=hair, outline=OL)
        d.rectangle([22, 12, 24, 14], fill=shade(hair, 1.15))
    elif style == "veteran":
        d.rectangle([18, 20, 22, 32], fill=hair, outline=OL)  # grey sides
        d.rectangle([42, 20, 46, 32], fill=hair, outline=OL)
        rr(d, [19, 14, 45, 20], 4, hair, OL)  # thin top
        d.rectangle([22, 27, 42, 28], fill=shade(hair, 0.9))  # heavy brow
    elif style == "priest":
        rr(d, [19, 11, 45, 22], 7, hair, OL)
        d.rectangle([21, 18, 43, 20], fill=skin)
    elif style == "butler":
        d.rectangle([18, 18, 22, 30], fill=hair, outline=OL)
        d.rectangle([42, 18, 46, 30], fill=hair, outline=OL)
        d.rectangle([24, 14, 40, 15], fill=shade(skin, 0.95))
    elif style == "mage":
        d.rectangle([14, 17, 50, 21], fill=cloth, outline=OL)          # 帽檐
        d.polygon([(20, 18), (44, 18), (36, 2), (31, -2)], fill=cloth, outline=OL)  # 帽尖
        d.rectangle([20, 15, 44, 18], fill=shade(cloth, 1.3))
        d.point((33, 8), fill=hexc("#f0d070")); d.point((31, 11), fill=hexc("#f0d070"))
    elif style == "scholar":
        rr(d, [18, 11, 46, 24], 8, hair, OL)
        d.polygon([(21, 17), (33, 17), (28, 25), (21, 25)], fill=hair)
        d.polygon([(33, 17), (43, 17), (43, 25), (38, 22)], fill=hair)
        for x in (18, 44):
            d.rectangle([x, 22, x + 3, 36], fill=hair, outline=OL)       # 及肩短发
    elif style == "rival":
        rr(d, [18, 9, 46, 24], 8, hair, OL)
        d.polygon([(18, 18), (46, 16), (40, 10), (24, 8)], fill=hair, outline=OL)
        d.polygon([(22, 18), (34, 18), (30, 26), (22, 24)], fill=hair)
        d.line([(25, 12), (35, 11)], fill=shade(hair, 1.25))
    elif style == "chancellor":
        rr(d, [18, 11, 46, 22], 7, hair, OL)
        d.rectangle([18, 18, 22, 30], fill=hair, outline=OL)
        d.rectangle([42, 18, 46, 30], fill=hair, outline=OL)
        d.line([(22, 18), (42, 18)], fill=shade(hair, 0.8))

    # face
    if style == "veteran":
        eyes_y = 29
    else:
        eyes_y = 28
    for ex in (25, 36):
        d.rectangle([ex, eyes_y - 1, ex + 3, eyes_y + 3], fill=(250, 248, 244))
        d.rectangle([ex + 1, eyes_y, ex + 2, eyes_y + 3], fill=eye)
        d.point((ex + 1, eyes_y), fill=(255, 255, 255))
        d.line([(ex - 1, eyes_y - 3), (ex + 4, eyes_y - 3)],
               fill=shade(hair, 0.7))  # brow
    d.rectangle([31, 31, 32, 33], fill=shade(skin, 0.85))  # nose
    d.line([(29, 36), (35, 36)], fill=(150, 70, 70))  # mouth
    if style in ("short", "long"):
        d.point((22, 33), fill=(240, 150, 140))
        d.point((23, 33), fill=(240, 150, 140))
        d.point((41, 33), fill=(240, 150, 140))
        d.point((42, 33), fill=(240, 150, 140))

    # style-specific extras
    if style == "veteran":
        rr(d, [21, 34, 43, 43], 5, hair, OL)  # beard
        d.rectangle([28, 36, 36, 37], fill=(120, 60, 60))
        d.line([(38, 24), (42, 33)], fill=(190, 80, 80))  # scar
        rr(d, [8, 44, 24, 54], 4, hexc("#8a8f98"), OL)  # shoulder plate
        d.line([(10, 48), (22, 48)], fill=hexc("#c0c6cf"))
    if style == "priest":
        d.rectangle([29, 46, 35, 60], fill=hexc("#f6efd8"), outline=OL)
        d.rectangle([31, 49, 33, 57], fill=hexc("#d8a828"))
        d.rectangle([29, 52, 35, 54], fill=hexc("#d8a828"))
    if style == "butler":
        d.rectangle([26, 35, 38, 36], fill=hair)                          # 胡须
        d.polygon([(26, 46), (32, 56), (38, 46)], fill=(245, 245, 245), outline=OL)  # 白领
        d.rectangle([31, 54, 33, 58], fill=(160, 40, 40))
    if style == "mage":
        rr(d, [21, 33, 43, 58], 6, hair, OL)                              # 长须
        d.line([(32, 40), (32, 56)], fill=shade(hair, 0.85))
        d.rectangle([28, 34, 36, 36], fill=(150, 70, 70))
    if style == "scholar":
        for ex in (23, 34):
            d.rectangle([ex, 25, ex + 7, 32], outline=hexc("#6a5a40"))
        d.line([(31, 28), (33, 28)], fill=hexc("#6a5a40"))
    if style == "rival":
        d.polygon([(10, 46), (24, 46), (20, 60), (10, 60)], fill=hexc("#a83030"), outline=OL)
        d.rectangle([22, 48, 25, 51], fill=hexc("#d8b030"), outline=OL)
    if style == "chancellor":
        d.polygon([(18, 46), (46, 46), (42, 38), (22, 38)], fill=shade(cloth, 1.1), outline=OL)  # 高领
        d.rectangle([28, 37, 36, 41], fill=hair)                          # 山羊胡
        d.rectangle([29, 41, 35, 44], fill=hair)
        d.rectangle([30, 47, 34, 50], fill=hexc("#c8a030"), outline=OL)
    if extra == "pendant":
        d.line([(28, 47), (32, 52), (36, 47)], fill=hexc("#f0e8c0"))
        d.rectangle([31, 52, 33, 54], fill=hexc("#7ad0f0"), outline=OL)
    if extra == "collar":
        d.polygon([(24, 46), (32, 54), (40, 46), (40, 49), (32, 57),
                   (24, 49)], fill=shade(cloth, 1.3))
    if extra == "belt":
        d.rectangle([12, 60, 52, 63], fill=hexc("#4a3020"))
        d.rectangle([30, 60, 34, 63], fill=hexc("#d0a840"))
    # soft vignette frame
    d.rectangle([0, 0, S - 1, S - 1], outline=shade(bgc, 0.7))
    return img


def make_portraits():
    specs = {
        "hero": dict(skin="#f0c8a0", hair="#6b4226", cloth="#8a6a3a",
                     bg="#b7d49c", eye="#3a5a9a", style="short",
                     extra="belt"),
        "efna": dict(skin="#f8dcc6", hair="#e9e6f2", cloth="#6f93c6",
                     bg="#d9cdea", eye="#7a58c8", style="long",
                     extra="pendant"),
        "glen": dict(skin="#d4a070", hair="#a2a2a8", cloth="#5a4030",
                     bg="#a3adb8", eye="#3a3a3a", style="veteran"),
        "priest": dict(skin="#f0c8a0", hair="#e8e8e8", cloth="#f2ecdc",
                       bg="#f0dfaa", eye="#4a6a4a", style="priest"),
    }
    out = {}
    for key, kw in specs.items():
        out[key] = portrait(key, **kw)
    return out


# ------------------------------------------------------------------ scenes
W, H = 320, 180


def gradient_sky(d, top, bottom, y1, bands=9):
    top, bottom = hexc(top), hexc(bottom)
    for i in range(bands):
        t = i / (bands - 1)
        c = tuple(int(top[k] + (bottom[k] - top[k]) * t) for k in range(3))
        y0 = int(y1 * i / bands)
        y2 = int(y1 * (i + 1) / bands)
        d.rectangle([0, y0, W, y2], fill=c)


def hills(d, base, amp, color, phase, freq, jag=0.0, rnd=None):
    color = hexc(color) if isinstance(color, str) else color
    for x in range(W):
        v = math.sin(x * freq + phase) + 0.5 * math.sin(x * freq * 2.3 + phase * 1.7)
        y = int(base - amp * v / 1.5)
        d.line([(x, y), (x, H)], fill=color)


def noise(d, box, colors, density, seed):
    rnd = random.Random(seed)
    x0, y0, x1, y1 = box
    n = int((x1 - x0) * (y1 - y0) * density)
    for _ in range(n):
        d.point((rnd.randint(x0, x1), rnd.randint(y0, y1)),
                fill=rnd.choice(colors))


def tree(d, x, y, canopy, trunk="#5a3a22", size=1.0, snow=False, bare=False):
    canopy = hexc(canopy)
    trunk = hexc(trunk)
    tw, th = int(4 * size), int(14 * size)
    d.rectangle([x - tw // 2, y - th, x + tw // 2, y], fill=trunk, outline=OL)
    if bare:
        for dx, dy in ((-6, -8), (5, -10), (-3, -16), (3, -18)):
            d.line([(x, y - th + 2), (x + int(dx * size), y - th + int(dy * size))],
                   fill=trunk, width=1)
        if snow:
            d.line([(x - 6 * size, y - th - 6 * size), (x + 5 * size, y - th - 8 * size)],
                   fill=(245, 248, 252))
        return
    r = int(11 * size)
    cy = y - th - int(5 * size)
    for ox, oy, rad, f in ((-r // 2, 2, r - 2, 0.85), (r // 2, 2, r - 2, 0.85),
                           (0, -r // 2, r, 1.0)):
        d.ellipse([x + ox - rad, cy + oy - rad, x + ox + rad, cy + oy + rad],
                  fill=shade(canopy, f), outline=OL)
    d.ellipse([x - r // 2, cy - r + 1, x + 1, cy - r // 3], fill=shade(canopy, 1.25))
    if snow:
        d.arc([x - r, cy - r - 1, x + r, cy + r // 2], 200, 340, fill=(245, 248, 252))


def pine(d, x, y, h, col, snow=False):
    col = hexc(col)
    d.rectangle([x - 1, y - 3, x + 1, y], fill=hexc("#4a3020"))
    layers = max(3, h // 8)
    for i in range(layers):
        w = int((h / 2.2) * (1 - i / (layers + 0.5))) + 3
        yy = y - 3 - i * (h - 6) // layers
        d.polygon([(x - w, yy), (x + w, yy), (x, yy - h // layers - 4)],
                  fill=shade(col, 0.8 + 0.1 * i), outline=OL)
        if snow:
            d.line([(x - w + 2, yy - 1), (x + w - 2, yy - 1)], fill=(245, 248, 252))


def house(d, x, y, w, h, wall, roof, door="#6a4528", snow=False, chimney=True):
    wall, roof, door = hexc(wall), hexc(roof), hexc(door)
    d.rectangle([x, y - h, x + w, y], fill=wall, outline=OL)
    for k in range(y - h + 4, y, 5):  # plank lines
        d.line([(x + 1, k), (x + w - 1, k)], fill=shade(wall, 0.9))
    if chimney:
        d.rectangle([x + w - 9, y - h - 14, x + w - 4, y - h], fill=hexc("#7a7a82"), outline=OL)
    d.polygon([(x - 5, y - h), (x + w + 5, y - h), (x + w // 2, y - h - w // 2 - 2)],
              fill=roof, outline=OL)
    d.line([(x - 3, y - h - 1), (x + w + 3, y - h - 1)], fill=shade(roof, 0.75))
    if snow:
        d.polygon([(x - 3, y - h - 1), (x + w + 3, y - h - 1),
                   (x + w // 2, y - h - w // 2 + 1)], fill=(244, 247, 252))
    dw = max(6, w // 4)
    d.rectangle([x + w // 2 - dw // 2, y - 14, x + w // 2 + dw // 2, y], fill=door, outline=OL)
    d.rectangle([x + 4, y - h + 8, x + 11, y - h + 15], fill=hexc("#f6e08a"), outline=OL)
    d.line([(x + 7, y - h + 8), (x + 7, y - h + 15)], fill=OL)


def church(d, x, y, wall, roof):
    wall, roof = hexc(wall), hexc(roof)
    d.rectangle([x, y - 26, x + 26, y], fill=wall, outline=OL)
    d.rectangle([x + 8, y - 48, x + 18, y - 26], fill=wall, outline=OL)
    d.polygon([(x + 6, y - 48), (x + 20, y - 48), (x + 13, y - 62)], fill=roof, outline=OL)
    d.line([(x + 13, y - 62), (x + 13, y - 70)], fill=hexc("#d8b030"))
    d.line([(x + 10, y - 67), (x + 16, y - 67)], fill=hexc("#d8b030"))
    d.rectangle([x + 10, y - 12, x + 16, y], fill=hexc("#5a3a22"), outline=OL)
    d.ellipse([x + 10, y - 44, x + 16, y - 38], fill=hexc("#f6e08a"), outline=OL)


def fence(d, x0, x1, y, col="#7a5632", snow=False):
    col = hexc(col)
    for x in range(x0, x1, 8):
        d.rectangle([x, y - 8, x + 2, y], fill=col, outline=OL)
        if snow:
            d.point((x + 1, y - 9), fill=(245, 248, 252))
    d.line([(x0, y - 6), (x1, y - 6)], fill=col)
    d.line([(x0, y - 2), (x1, y - 2)], fill=col)


PALETTES = {
    "spring": dict(sky=("#8fc8ee", "#e4f3fb"), far="#9cc8a8", mid="#7fb86a",
                   ground="#6aa85a", ground2="#79b866", field_a="#5a9a48",
                   field_b="#7a5a3a", tree="#e8a8c0", wall="#e8d4b0",
                   roof="#b8553a", sun="#fff3b0", snow=False, bare=False),
    "autumn": dict(sky=("#f2a868", "#fbe3b4"), far="#c8a070", mid="#b09048",
                   ground="#a8944a", ground2="#b8a258", field_a="#e0b030",
                   field_b="#c89020", tree="#d8702a", wall="#e0c8a0",
                   roof="#8a4a30", sun="#ffe0a0", snow=False, bare=False),
    "winter": dict(sky=("#a8b8cc", "#e8eef4"), far="#c8d4e0", mid="#dce6ee",
                   ground="#eef3f8", ground2="#dfe8f0", field_a="#e4ecf4",
                   field_b="#c8d4e0", tree="#4a6a52", wall="#d8c4a0",
                   roof="#7a4a3a", sun="#f4f0e8", snow=True, bare=True),
}


def village(season):
    p = PALETTES[season]
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    gradient_sky(d, *p["sky"], 104)
    d.ellipse([240, 20, 262, 42], fill=hexc(p["sun"]))
    rnd = random.Random(season)
    for cx, cy in ((50, 28), (140, 40), (210, 22)):  # blocky clouds
        for k in range(4):
            d.rectangle([cx + k * 7, cy - (k % 2) * 3, cx + k * 7 + 12, cy + 5],
                        fill=(250, 250, 252))
    hills(d, 100, 14, p["far"], 0.8, 0.021)
    hills(d, 108, 10, p["mid"], 2.1, 0.034)
    d.rectangle([0, 110, W, H], fill=hexc(p["ground"]))
    noise(d, (0, 112, W, H), [hexc(p["ground2"]), shade(hexc(p["ground"]), 0.92)], 0.12, season)
    church(d, 146, 114, "#e6dcc8", p["roof"])
    house(d, 214, 126, 34, 20, p["wall"], p["roof"], snow=p["snow"])
    house(d, 262, 120, 28, 17, p["wall"], shade(hexc(p["roof"]), 0.9), snow=p["snow"])
    # field
    fa, fb = hexc(p["field_a"]), hexc(p["field_b"])
    d.rectangle([0, 128, 198, H], fill=fb)
    for i, y in enumerate(range(130, H, 7)):
        d.rectangle([2, y, 196, y + 3], fill=fa)
        for x in range(3 + (i % 2) * 3, 196, 6):
            d.point((x, y - 1), fill=shade(fa, 1.2))
            d.point((x, y + 4), fill=shade(fa, 0.7))
    d.rectangle([0, 128, 198, 129], fill=OL)
    d.line([(198, 128), (198, H)], fill=OL)
    fence(d, 200, 320, 150, snow=p["snow"])
    # path
    d.polygon([(214, H), (232, H), (238, 130), (232, 130)], fill=hexc("#d8c49a") if not p["snow"] else (232, 236, 242))
    # trees
    for tx, ty, s in ((20, 124, 1.0), (96, 120, 0.9), (122, 118, 0.8), (300, 160, 1.2), (308, 112, 0.8)):
        tree(d, tx, ty, p["tree"], size=s, snow=p["snow"], bare=p["bare"])
    if season == "autumn":  # falling leaves
        for _ in range(26):
            x, y = rnd.randrange(W), rnd.randrange(H)
            d.rectangle([x, y, x + 1, y + 1], fill=hexc("#d8702a"))
    if season == "winter":  # snow flakes
        for _ in range(70):
            x, y = rnd.randrange(W), rnd.randrange(H)
            d.point((x, y), fill=(255, 255, 255))
    return img


def mountain():
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    gradient_sky(d, "#7fb8e8", "#f2e8d0", 136)
    d.ellipse([40, 24, 58, 42], fill=hexc("#fff6c0"))
    # far peaks with snow
    for peaks, col in (([(-10, 110), (60, 40), (130, 110)], "#8aa0c0"),
                       ([(90, 115), (180, 30), (270, 115)], "#7c92b4"),
                       ([(200, 115), (280, 55), (340, 115)], "#8aa0c0")):
        d.polygon(peaks, fill=hexc(col), outline=OL)
        px, py = peaks[1]
        d.polygon([(px - 14, py + 18), (px, py), (px + 14, py + 18), (px + 6, py + 14),
                   (px, py + 20), (px - 6, py + 14)], fill=(244, 248, 252))
    d.rectangle([0, 130, W, H], fill=hexc("#4f7a58"))
    hills(d, 118, 12, "#4f7a58", 1.0, 0.03)
    hills(d, 130, 10, "#3f6a48", 2.4, 0.045)
    d.rectangle([0, 140, W, H], fill=hexc("#34583c"))
    noise(d, (0, 140, W, H), [hexc("#3f6a48"), hexc("#2c4a32")], 0.14, "mtn")
    # winding path
    pts = [(150, H), (170, 168), (160, 156), (180, 146), (176, 136)]
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=hexc("#b8a078"), width=14 - i * 3)
    rnd = random.Random("pines")
    xs = sorted([rnd.randint(0, 130) for _ in range(9)] + [rnd.randint(205, 320) for _ in range(9)])
    for x in xs:
        y = rnd.randint(140, 178)
        pine(d, x, y, rnd.randint(34, 58), "#2f6a40" if rnd.random() < 0.6 else "#3b7a4a")
    for x, y in ((100, 60), (112, 54), (122, 62)):  # birds
        d.line([(x - 3, y), (x, y + 2), (x + 3, y)], fill=OL)
    return img


def cave():
    img = Image.new("RGB", (W, H), hexc("#2a2630"))
    d = ImageDraw.Draw(img)
    rnd = random.Random("cave")
    noise(d, (0, 0, W, H), [hexc("#332e3a"), hexc("#221e28"), hexc("#3a3542")], 0.35, "rock")
    # cliff face
    d.rectangle([0, 0, W, 138], fill=hexc("#34303c"))
    noise(d, (0, 0, W, 138), [hexc("#3e3946"), hexc("#2a2630"), hexc("#46404f")], 0.3, "cliff")
    for _ in range(18):  # cracks
        x, y = rnd.randint(0, W), rnd.randint(0, 120)
        d.line([(x, y), (x + rnd.randint(-6, 6), y + rnd.randint(6, 18))], fill=hexc("#1c1922"))
    # ground
    d.rectangle([0, 138, W, H], fill=hexc("#5a4a3a"))
    noise(d, (0, 138, W, H), [hexc("#6a5846"), hexc("#4a3c2e"), hexc("#7a6652")], 0.2, "dirt")
    d.line([(0, 138), (W, 138)], fill=OL)
    # arch
    d.ellipse([100, 36, 220, 150], fill=hexc("#4a4452"), outline=OL)
    d.rectangle([100, 96, 220, 150], fill=hexc("#4a4452"))
    d.ellipse([112, 46, 208, 150], fill=hexc("#0e0b12"), outline=OL)
    d.rectangle([112, 98, 208, 139], fill=hexc("#0e0b12"))
    d.line([(112, 98), (112, 139)], fill=OL)
    d.line([(208, 98), (208, 139)], fill=OL)
    for i in range(10):  # keystones
        a = math.radians(200 + i * 14)
        cx, cy = 160 + int(56 * math.cos(a)), 98 + int(50 * math.sin(a))
        d.rectangle([cx - 5, cy - 4, cx + 5, cy + 4], fill=hexc("#5a5464"), outline=OL)
    # re-lay the ground over the arch's lower curve
    d.rectangle([96, 139, 224, 160], fill=hexc("#5a4a3a"))
    noise(d, (96, 139, 224, 160), [hexc("#6a5846"), hexc("#4a3c2e"), hexc("#7a6652")], 0.2, "dirt2")
    d.rectangle([112, 139, 208, 141], fill=hexc("#0e0b12"))
    # depth steps inside
    for k, c in enumerate(("#16121b", "#1a1620", "#120e16")):
        d.rectangle([140 + k * 6, 124 + k * 4, 180 - k * 6, 139], fill=hexc(c))
    d.rectangle([150, 126, 154, 128], fill=hexc("#f0f0e0"))  # glinting eyes in the dark
    d.rectangle([166, 126, 170, 128], fill=hexc("#f0f0e0"))
    # torches with dithered glow
    for tx in (70, 250):
        for r, f in ((34, 0.10), (24, 0.18), (14, 0.30)):
            for y in range(70 - r, 70 + r):
                for x in range(tx - r, tx + r):
                    if (x + y) % 2 == 0 and (x - tx) ** 2 + (y - 70) ** 2 < r * r:
                        base = img.getpixel((x, y))
                        img.putpixel((x, y), tuple(min(255, int(base[k] + (255, 170, 60)[k] * f)) for k in range(3)))
        d.rectangle([tx - 2, 76, tx + 2, 104], fill=hexc("#6a4528"), outline=OL)
        d.polygon([(tx - 5, 76), (tx + 5, 76), (tx + 3, 66), (tx, 56), (tx - 3, 66)], fill=hexc("#f08a20"), outline=OL)
        d.polygon([(tx - 2, 74), (tx + 2, 74), (tx, 62)], fill=hexc("#fff0a0"))
    # moss + rocks
    for _ in range(40):
        x, y = rnd.randint(0, W), rnd.randint(100, 176)
        d.rectangle([x, y, x + 1, y], fill=hexc("#4a7a3a"))
    for x, y, w in ((30, 160, 22), (250, 164, 26), (190, 170, 16), (70, 172, 12)):
        d.ellipse([x, y, x + w, y + w // 2 + 4], fill=hexc("#6a6470"), outline=OL)
        d.line([(x + 3, y + 3), (x + w // 2, y + 2)], fill=hexc("#8a8494"))
    # sign post: guild notice board
    d.rectangle([258, 112, 262, 140], fill=hexc("#6a4528"), outline=OL)
    d.rectangle([248, 100, 278, 118], fill=hexc("#8a6a3a"), outline=OL)
    for i in range(3):
        d.line([(252, 106 + i * 4), (274, 106 + i * 4)], fill=hexc("#3a2818"))
    return img


def make_scenes():
    return {
        "village_spring": village("spring"),
        "village_autumn": village("autumn"),
        "village_winter": village("winter"),
        "mountain": mountain(),
        "cave_entrance": cave(),
    }


def main():
    os.makedirs(OUT + "/portraits", exist_ok=True)
    os.makedirs(OUT + "/scenes", exist_ok=True)
    ports = make_portraits()
    scenes = make_scenes()
    for k, im in ports.items():
        im.save(f"{OUT}/portraits/portrait_{k}_normal.png")
    for k, im in scenes.items():
        im.save(f"{OUT}/scenes/scene_{k}.png")
    # preview sheet (nearest-neighbour upscale)
    sheet = Image.new("RGB", (1296, 8 + 256 + 8 + 3 * 368 + 8), (28, 28, 34))
    x = 8
    for im in ports.values():
        sheet.paste(im.resize((256, 256), Image.NEAREST), (x, 8))
        x += 256 + 8
    names = list(scenes)
    for i, k in enumerate(names):
        im = scenes[k].resize((640, 360), Image.NEAREST)
        cx = 8 + (i % 2) * 648
        cy = 8 + 256 + 8 + (i // 2) * 368
        if cy + 360 <= sheet.height and cx + 640 <= sheet.width:
            sheet.paste(im, (cx, cy))
    sheet.save(OUT + "/preview.png")


if __name__ == "__main__":
    main()
