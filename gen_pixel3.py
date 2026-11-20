"""第三、四个剧本《暗巷里的钥匙》《远海的星图》的占位素材：13 张人物立绘 + 18 张场景图。"""
import math
import random
from PIL import Image, ImageDraw
import gen_pixel as G
from gen_pixel import hexc, shade, OL, W, H, gradient_sky, noise

OUT = G.OUT


def portraits():
    specs = {
        # 盗贼
        "thief": dict(skin="#e8c8a8", hair="#3a2a2a", cloth="#3a3a48", bg="#5a5a70", eye="#7a5a3a", style="short", extra="collar"),
        "rat": dict(skin="#d8b898", hair="#8a8a8a", cloth="#4a4038", bg="#6a6058", eye="#4a4a3a", style="veteran"),
        "lila": dict(skin="#f0d0b8", hair="#6a3a2a", cloth="#7a5a6a", bg="#9a8090", eye="#5a4a3a", style="long"),
        "cass": dict(skin="#f0d8c0", hair="#2a2a3a", cloth="#2a3a6a", bg="#5a6a8a", eye="#3a5a7a", style="rival", extra="belt"),
        "gu": dict(skin="#d0b090", hair="#c8c8c8", cloth="#4a3a4a", bg="#5a4a58", eye="#3a3a3a", style="butler"),
        "mask": dict(skin="#f2f2f2", hair="#202028", cloth="#1e1e28", bg="#4a4a5a", eye="#202028", style="chancellor"),
        # 航海
        "sailor": dict(skin="#e8c098", hair="#5a3a22", cloth="#3a6a8a", bg="#8ab8d0", eye="#3a6a9a", style="short", extra="belt"),
        "haide": dict(skin="#d8a880", hair="#d8d8d8", cloth="#2a4a6a", bg="#7a98a8", eye="#3a5a6a", style="veteran"),
        "vel": dict(skin="#f0d0b0", hair="#3a2a4a", cloth="#4a7a7a", bg="#98b8b0", eye="#4a6a9a", style="scholar", extra="pendant"),
        "scarlett": dict(skin="#e8c0a0", hair="#a02a2a", cloth="#8a2a30", bg="#b89088", eye="#2a2a2a", style="long", extra="belt"),
        "merchant": dict(skin="#e8c8a8", hair="#6a5a4a", cloth="#8a6a2a", bg="#b8a878", eye="#4a4a2a", style="chancellor"),
        "bram": dict(skin="#e0b890", hair="#7a4a2a", cloth="#6a7a4a", bg="#98a878", eye="#4a5a3a", style="short"),
        "nerea": dict(skin="#c8e0e8", hair="#2a6a8a", cloth="#2a8a9a", bg="#78b8c8", eye="#2a7ab0", style="long", extra="pendant"),
    }
    return {k: G.portrait(k, **kw) for k, kw in specs.items()}


def canvas(top, bottom, y1=110, bands=10):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    gradient_sky(d, top, bottom, y1, bands)
    return img, d


def stars(d, n, seed, ymax=70, col="#f0f0e0"):
    r = random.Random(seed)
    for _ in range(n):
        d.point((r.randrange(W), r.randrange(ymax)), fill=hexc(col))


def moon(d, x, y, r=9, col="#f4ecc8"):
    d.ellipse([x - r, y - r, x + r, y + r], fill=hexc(col), outline=shade(hexc(col), 0.8))


def skyline(d, base, seed, col, hmin=18, hmax=60, windows=True, snow=False):
    r = random.Random(seed)
    x = 0
    while x < W:
        w = r.randint(16, 34)
        h = r.randint(hmin, hmax)
        c = hexc(col)
        d.rectangle([x, base - h, x + w, H], fill=c, outline=OL)
        if r.random() < 0.5:
            d.polygon([(x - 2, base - h), (x + w + 2, base - h), (x + w // 2, base - h - r.randint(8, 16))], fill=shade(c, 0.85), outline=OL)
        if windows:
            for wy in range(base - h + 6, base - 4, 9):
                for wx in range(x + 4, x + w - 4, 8):
                    if r.random() < 0.35:
                        d.rectangle([wx, wy, wx + 3, wy + 4], fill=hexc("#f6d878"))
        if snow:
            d.rectangle([x, base - h - 2, x + w, base - h], fill=hexc("#e8eef4"))
        x += w + r.randint(0, 4)


def cobbles(d, y0, col, seed):
    d.rectangle([0, y0, W, H], fill=hexc(col))
    noise(d, (0, y0, W, H), [shade(hexc(col), 1.15), shade(hexc(col), 0.8)], 0.12, seed)
    for y in range(y0 + 6, H, 8):
        d.line([(0, y), (W, y)], fill=shade(hexc(col), 0.85))


def alley(snow=False):
    img, d = canvas("#1a1a2e" if not snow else "#2a3048", "#3a3a56", 90)
    stars(d, 40, "alley" + str(snow), 40)
    moon(d, 250, 26)
    skyline(d, 120, "a1", "#2a2a3c" if not snow else "#4a5068", 36, 80, True, snow)
    # 两侧近景墙
    for x0, x1 in ((0, 56), (264, W)):
        d.rectangle([x0, 60, x1, H], fill=hexc("#36323e"), outline=OL)
        for y in range(66, H, 10):
            d.line([(x0 + 1, y), (x1 - 1, y)], fill=hexc("#2c2832"))
    cobbles(d, 130, "#4a4650" if not snow else "#c8d0dc", "c1" + str(snow))
    d.rectangle([150, 70, 154, 132], fill=hexc("#2a2a30"))          # 灯柱
    d.rectangle([145, 62, 159, 72], fill=hexc("#f6d878"), outline=OL)
    for k in range(18):
        d.ellipse([140 - k, 56 - k // 2, 164 + k, 82 + k // 2], outline=shade(hexc("#3a3a56"), 1.0 + 0.012 * (18 - k)))
    if snow:
        r = random.Random("sn")
        for _ in range(90):
            d.point((r.randrange(W), r.randrange(H)), fill=hexc("#f4f8fc"))
    return img


def rooftop():
    img, d = canvas("#141428", "#34385a", 100)
    stars(d, 70, "roof", 80)
    moon(d, 70, 30, 12)
    skyline(d, 128, "r1", "#26263a", 20, 50, True)
    # 近景：屋脊与烟囱
    d.polygon([(0, 150), (130, 112), (320, 150), (320, 180), (0, 180)], fill=hexc("#3a2e38"), outline=OL)
    for x in range(10, 310, 14):
        y = int(150 - (38 * (1 - abs(x - 130) / 190 if x < 130 else 38 * (1 - (x - 130) / 190)) / 38 * 38)) if False else None
    d.rectangle([200, 100, 214, 140], fill=hexc("#4a3a44"), outline=OL)
    d.rectangle([197, 96, 217, 102], fill=hexc("#5a4a54"), outline=OL)
    d.ellipse([120, 98, 126, 110], fill=hexc("#3a2a30"))
    # 人影
    d.ellipse([160, 98, 168, 106], fill=hexc("#101018"))
    d.rectangle([158, 105, 170, 126], fill=hexc("#101018"))
    return img


def black_market():
    img = Image.new("RGB", (W, H), hexc("#1e1a24"))
    d = ImageDraw.Draw(img)
    for x in range(0, W, 40):
        d.rectangle([x, 0, x + 6, H], fill=hexc("#2e2834"))
    d.rectangle([0, 0, W, 24], fill=hexc("#2a242e"))
    cobbles(d, 128, "#2e2a34", "bm")
    r = random.Random("bm")
    for x in (30, 118, 206, 270):
        d.rectangle([x, 84, x + 60, 128], fill=hexc("#3a2e3a"), outline=OL)
        d.polygon([(x - 4, 84), (x + 64, 84), (x + 50, 66), (x + 10, 66)], fill=hexc(r.choice(["#6a2a3a", "#2a4a6a", "#4a6a3a"])), outline=OL)
        d.ellipse([x + 22, 92, x + 30, 100], fill=hexc("#f6d878"))
        for k in range(10):
            d.ellipse([x + 26 - k * 2, 96 - k, x + 26 + k * 2 + 8, 104 + k], outline=shade(hexc("#1e1a24"), 1.0 + 0.04 * (10 - k)))
        d.rectangle([x + 8, 108, x + 52, 118], fill=hexc("#6a5a4a"), outline=OL)
    for x in (70, 160, 250):
        d.ellipse([x, 140, x + 10, 150], fill=hexc("#16121a"))
        d.rectangle([x - 2, 148, x + 12, 170], fill=hexc("#16121a"))
    return img


def tavern():
    img = Image.new("RGB", (W, H), hexc("#3a2a1e"))
    d = ImageDraw.Draw(img)
    for y in range(0, 110, 10):
        d.line([(0, y), (W, y)], fill=hexc("#2e2016"))
    for x in range(20, W, 56):                       # 木梁
        d.rectangle([x, 0, x + 6, 110], fill=hexc("#241810"))
    d.rectangle([0, 110, W, H], fill=hexc("#5a4030"))
    for x in range(0, W, 16):
        d.line([(x, 110), (x - 14, H)], fill=hexc("#4a3424"))
    d.rectangle([20, 70, 140, 110], fill=hexc("#6a4a30"), outline=OL)       # 吧台
    d.rectangle([20, 62, 140, 70], fill=hexc("#8a6a44"), outline=OL)
    for i, x in enumerate((36, 60, 86, 112)):
        d.rectangle([x, 44, x + 10, 62], fill=hexc(["#8a3a3a", "#3a6a8a", "#6a8a3a", "#8a6a2a"][i]), outline=OL)
    for cx in (200, 260):                             # 圆桌和人影
        d.ellipse([cx - 22, 120, cx + 22, 136], fill=hexc("#6a4a30"), outline=OL)
        d.rectangle([cx - 3, 134, cx + 3, 160], fill=hexc("#4a3020"))
        for dx in (-30, 30):
            d.ellipse([cx + dx - 5, 104, cx + dx + 5, 114], fill=hexc("#1a1210"))
            d.rectangle([cx + dx - 7, 113, cx + dx + 7, 136], fill=hexc("#1a1210"))
    for x in (60, 200, 280):                          # 吊灯
        d.line([(x, 0), (x, 30)], fill=OL)
        d.ellipse([x - 7, 28, x + 7, 40], fill=hexc("#f6d878"), outline=OL)
        for k in range(12):
            d.ellipse([x - 7 - k * 2, 30 - k, x + 7 + k * 2, 40 + k], outline=shade(hexc("#3a2a1e"), 1.0 + 0.03 * (12 - k)))
    return img


def sewer():
    img = Image.new("RGB", (W, H), hexc("#1c2a24"))
    d = ImageDraw.Draw(img)
    for y in range(0, 100, 8):
        for x in range((y // 8 % 2) * 12, W, 24):
            d.rectangle([x, y, x + 22, y + 6], fill=hexc("#2a3c32"), outline=hexc("#16221c"))
    d.ellipse([110, 20, 210, 100], fill=hexc("#0e1612"), outline=OL)        # 拱洞
    d.rectangle([0, 100, W, H], fill=hexc("#2a5a4a"))
    for y in range(106, H, 8):
        d.line([(0, y), (W, y)], fill=hexc("#356a58"))
    d.rectangle([0, 96, W, 104], fill=hexc("#3a463e"), outline=OL)          # 步道
    r = random.Random("sw")
    for _ in range(14):
        x, y = r.randrange(W), r.randrange(110, H)
        d.ellipse([x, y, x + 4, y + 2], fill=hexc("#8ac0a0"))
    d.ellipse([260, 84, 272, 96], fill=hexc("#3a3a3a"))                      # 老鼠
    d.point((270, 88), fill=hexc("#e03030"))
    return img


def warehouse():
    img = Image.new("RGB", (W, H), hexc("#3a3028"))
    d = ImageDraw.Draw(img)
    for x in range(0, W, 14):
        d.line([(x, 0), (x, 110)], fill=hexc("#2e261f"))
    d.rectangle([0, 110, W, H], fill=hexc("#4a3e34"))
    r = random.Random("wh")
    for _ in range(9):
        x, y, w = r.randrange(0, 270), r.randrange(80, 130), r.randint(26, 46)
        d.rectangle([x, y, x + w, y + w - 6], fill=hexc("#7a5a36"), outline=OL)
        d.line([(x, y), (x + w, y + w - 6)], fill=hexc("#5a4226"))
        d.line([(x + w, y), (x, y + w - 6)], fill=hexc("#5a4226"))
    d.rectangle([130, 40, 190, 112], fill=hexc("#2a2018"), outline=OL)       # 大门
    for k in range(3):
        d.line([(130, 40 + k * 24), (190, 40 + k * 24)], fill=hexc("#1c140e"))
    d.rectangle([240, 30, 262, 54], fill=hexc("#8a1a1a"), outline=OL)         # 红手印
    for dx in range(5):
        d.rectangle([242 + dx * 4, 22, 243 + dx * 4, 32], fill=hexc("#8a1a1a"))
    return img


def vault():
    img = Image.new("RGB", (W, H), hexc("#14141e"))
    d = ImageDraw.Draw(img)
    for y in range(0, 180, 12):
        d.line([(0, y), (W, y)], fill=hexc("#1c1c2a"))
    d.ellipse([60, 20, 260, 220], outline=hexc("#3a3a6a"), width=3)
    d.ellipse([84, 44, 236, 196], outline=hexc("#4a4a8a"), width=2)
    for a in range(0, 360, 30):                     # 符文
        x = 160 + int(90 * math.cos(math.radians(a)))
        y = 120 + int(90 * math.sin(math.radians(a)))
        d.rectangle([x - 3, y - 3, x + 3, y + 3], fill=hexc("#8a8ae0"))
    d.rectangle([150, 100, 170, 140], fill=hexc("#2a2a4a"), outline=OL)       # 石台
    d.ellipse([146, 70, 174, 98], fill=hexc("#a8c8ff"), outline=hexc("#6a8ad0"))   # 水晶
    for k in range(16):
        d.ellipse([160 - 14 - k * 2, 84 - 14 - k * 2, 160 + 14 + k * 2, 84 + 14 + k * 2], outline=shade(hexc("#14141e"), 1.0 + 0.1 * (16 - k)))
    d.rectangle([0, 150, W, H], fill=hexc("#1a1a28"))
    return img


# ------------------------------------------------------------------ 航海
def waves(d, y0, col, seed, spacing=7):
    r = random.Random(seed)
    d.rectangle([0, y0, W, H], fill=hexc(col))
    for y in range(y0 + 4, H, spacing):
        for x in range(r.randrange(10), W, 28):
            d.arc([x, y, x + 14, y + 6], 200, 340, fill=shade(hexc(col), 1.25))


def ship(d, x, y, s=1.0, col="#6a4a30", sail="#f0e8d0"):
    w = int(60 * s)
    d.polygon([(x, y), (x + w, y), (x + w - int(8 * s), y + int(12 * s)), (x + int(8 * s), y + int(12 * s))], fill=hexc(col), outline=OL)
    d.line([(x + w // 2, y), (x + w // 2, y - int(40 * s))], fill=OL, width=2)
    d.polygon([(x + w // 2 + 1, y - int(38 * s)), (x + w // 2 + 1, y - int(6 * s)), (x + w // 2 + int(24 * s), y - int(10 * s))], fill=hexc(sail), outline=OL)


def harbor(kind):
    pal = {"day": ("#78c0f0", "#d8f0f8", "#3a78b0"), "dusk": ("#e88858", "#f8d8a8", "#7a5a8a"), "storm": ("#4a5260", "#8a929c", "#3a4a58")}[kind]
    img, d = canvas(pal[0], pal[1], 100)
    if kind == "storm":
        for x in range(0, W, 40):
            d.ellipse([x - 20, 10, x + 50, 40], fill=hexc("#3a4250"))
    else:
        d.ellipse([240, 20, 270, 50], fill=hexc("#fff4c0" if kind == "day" else "#ffd890"))
    waves(d, 110, pal[2], "h" + kind)
    d.rectangle([0, 124, 120, H], fill=hexc("#6a5a48"), outline=OL)                     # 码头
    for x in range(4, 120, 12):
        d.line([(x, 124), (x, H)], fill=hexc("#4a3c30"))
    for x in (20, 70):
        d.rectangle([x, 100, x + 40, 124], fill=hexc("#8a6a4a"), outline=OL)
        d.polygon([(x - 4, 100), (x + 44, 100), (x + 20, 84)], fill=hexc("#9a4a3a"), outline=OL)
    ship(d, 150, 104, 1.2)
    ship(d, 250, 100, 0.8, "#5a4a3a")
    if kind == "storm":
        r = random.Random("storm")
        for _ in range(80):
            x, y = r.randrange(W), r.randrange(H)
            d.line([(x, y), (x - 3, y + 8)], fill=hexc("#aab4c0"))
        d.line([(210, 0), (196, 30), (206, 30), (190, 62)], fill=hexc("#f8f0a0"), width=2)
    return img


def sea():
    img, d = canvas("#58a8e0", "#cce8f4", 80)
    d.ellipse([40, 24, 62, 46], fill=hexc("#fff4c0"))
    waves(d, 90, "#2a68a0", "sea", 6)
    ship(d, 130, 96, 1.6, "#6a4a30")
    d.arc([220, 118, 244, 132], 180, 360, fill=hexc("#e0f0f8"), width=2)    # 跃起的海豚
    return img


def deck():
    img, d = canvas("#78b8e8", "#d0e8f4", 90)
    waves(d, 96, "#2a68a0", "deck", 7)
    d.rectangle([0, 130, W, H], fill=hexc("#8a6a44"), outline=OL)
    for x in range(0, W, 24):
        d.line([(x, 130), (x, H)], fill=hexc("#6a4e30"))
    d.line([(0, 130), (W, 130)], fill=OL, width=2)
    d.rectangle([158, 20, 164, 132], fill=hexc("#5a3a22"), outline=OL)       # 桅杆
    d.polygon([(166, 24), (166, 100), (250, 90), (250, 36)], fill=hexc("#f4ecd4"), outline=OL)
    d.polygon([(156, 28), (156, 96), (96, 88), (96, 40)], fill=hexc("#e8dcc0"), outline=OL)
    d.rectangle([20, 100, 54, 130], fill=hexc("#6a4a30"), outline=OL)         # 舵轮台
    d.ellipse([28, 90, 48, 110], outline=hexc("#c89a50"), width=2)
    return img


def island():
    img, d = canvas("#58b8e8", "#f0e8c0", 90)
    waves(d, 100, "#2a98b8", "isl", 6)
    d.ellipse([60, 96, 260, 150], fill=hexc("#e8d49a"), outline=OL)
    d.ellipse([90, 80, 230, 130], fill=hexc("#4a9a4a"), outline=OL)
    for x in (120, 160, 200):
        d.line([(x, 120), (x - 4 + (x % 3), 80)], fill=hexc("#5a3a22"), width=3)
        for a in range(5):
            ang = math.radians(a * 70 - 140)
            d.line([(x - 4 + (x % 3), 80), (x - 4 + (x % 3) + int(18 * math.cos(ang)), 80 + int(10 * math.sin(ang)))], fill=hexc("#2a7a3a"), width=2)
    d.polygon([(150, 118), (170, 118), (166, 130), (154, 130)], fill=hexc("#f8f0a0"), outline=OL)   # 星图石
    return img


def reef():
    img, d = canvas("#a8c8d8", "#e0eef0", 100)
    waves(d, 104, "#3a78a0", "reef", 7)
    for x, h in ((40, 40), (100, 56), (200, 48), (270, 36)):
        d.polygon([(x - 18, 130), (x - 8, 130 - h), (x + 4, 130 - h + 10), (x + 16, 130)], fill=hexc("#4a5058"), outline=OL)
    r = random.Random("reefmist")
    for _ in range(40):
        x, y = r.randrange(W), r.randrange(70, 130)
        d.ellipse([x, y, x + 30, y + 8], fill=hexc("#dce8ec"))
    ship(d, 130, 112, 1.0)
    return img


def wreck():
    img, d = canvas("#1a3a4a", "#2a5a6a", 100)
    waves(d, 40, "#1a4a5a", "wk", 8)
    d.rectangle([0, 140, W, H], fill=hexc("#5a5a4a"))
    d.polygon([(80, 150), (230, 150), (210, 110), (100, 100)], fill=hexc("#4a3a2a"), outline=OL)       # 船骸
    for x in range(100, 220, 14):
        d.line([(x, 106), (x + 6, 150)], fill=hexc("#2a2018"), width=2)
    d.line([(160, 100), (176, 40)], fill=hexc("#3a2a1a"), width=3)
    d.polygon([(176, 44), (176, 80), (210, 70)], fill=hexc("#3a4a4a"))
    r = random.Random("wkb")
    for _ in range(14):
        x, y = r.randrange(W), r.randrange(40, 140)
        d.ellipse([x, y, x + 4, y + 4], outline=hexc("#6ab0c0"))
    d.ellipse([250, 122, 262, 130], fill=hexc("#8ae0d0"))
    return img


def kraken_den():
    img, d = canvas("#0e2a3a", "#1a4a5a", 100)
    d.rectangle([0, 110, W, H], fill=hexc("#2a3a3a"))
    d.ellipse([60, 40, 260, 180], fill=hexc("#0a1a24"), outline=OL)       # 洞口
    for i in range(5):
        x0 = 90 + i * 34
        pts = [(x0, 140)]
        for k in range(1, 7):
            pts.append((x0 + int(10 * math.sin(k * 1.3 + i)), 140 - k * 12))
        d.line(pts, fill=hexc("#7a3a6a"), width=6)
        d.line(pts, fill=hexc("#a05a8a"), width=2)
    d.ellipse([140, 56, 152, 66], fill=hexc("#e8d84a"))
    d.ellipse([168, 56, 180, 66], fill=hexc("#e8d84a"))
    return img


def abyss():
    img, d = canvas("#080814", "#1a1a3a", 120, 12)
    for k in range(24):
        d.ellipse([160 - 20 - k * 6, 90 - 10 - k * 3, 160 + 20 + k * 6, 90 + 10 + k * 3], outline=shade(hexc("#1a1a3a"), 0.6 + 0.04 * k))
    d.rectangle([110, 40, 120, 150], fill=hexc("#2a2a4a"), outline=OL)     # 门
    d.rectangle([200, 40, 210, 150], fill=hexc("#2a2a4a"), outline=OL)
    d.arc([110, 10, 210, 80], 180, 360, fill=hexc("#3a3a6a"), width=6)
    d.rectangle([121, 44, 199, 150], fill=hexc("#6a8ae8"))
    for y in range(48, 150, 10):
        d.line([(121, y), (199, y)], fill=hexc("#8aaaf8"))
    d.rectangle([0, 150, W, H], fill=hexc("#101028"))
    return img


def main():
    ps = portraits()
    for k, im in ps.items():
        im.save(f"{OUT}/portraits/portrait_{k}_normal.png")
    sc = {"alley": alley(), "alley_snow": alley(True), "rooftop": rooftop(), "black_market": black_market(), "tavern": tavern(),
          "sewer": sewer(), "warehouse": warehouse(), "vault": vault(),
          "harbor": harbor("day"), "harbor_dusk": harbor("dusk"), "harbor_storm": harbor("storm"), "sea": sea(), "deck": deck(),
          "island": island(), "reef": reef(), "wreck": wreck(), "kraken_den": kraken_den(), "abyss": abyss()}
    for k, im in sc.items():
        im.save(f"{OUT}/scenes/scene_{k}.png")
    sheet = Image.new("RGB", (1296, 8 + 136 + 8 + 5 * 368), (28, 28, 34))
    x = 8
    for im in ps.values():
        sheet.paste(im.resize((92, 92), Image.NEAREST), (x, 8)); x += 98
    for i, (k, im) in enumerate(sc.items()):
        sheet.paste(im.resize((640, 360), Image.NEAREST), (8 + (i % 2) * 648, 150 + (i // 2) * 368))
    sheet.crop((0, 0, 1296, 150 + 9 * 368)).save(OUT + "/preview3.png")


if __name__ == "__main__":
    main()
