"""第二个剧本《灰烬中的家徽》的占位素材：7 张人物立绘 + 7 张场景图。"""
import os
import random
import math
from PIL import Image, ImageDraw
import gen_pixel as G
from gen_pixel import hexc, shade, OL, W, H, gradient_sky, hills, noise, tree, fence

OUT = G.OUT


def portraits():
    specs = {
        "noble": dict(skin="#f0d0b0", hair="#2a2430", cloth="#5a3a7a", bg="#8a7a9a", eye="#5a6a9a", style="short", extra="collar"),
        "vera": dict(skin="#f0d8c8", hair="#8a7a70", cloth="#8a6a8a", bg="#a89888", eye="#6a5a50", style="long", extra="pendant"),
        "alfred": dict(skin="#e0c0a0", hair="#d8d8d8", cloth="#26262c", bg="#8a8070", eye="#4a4a4a", style="butler"),
        "metis": dict(skin="#e8c8a8", hair="#f0f0f0", cloth="#3a5a9a", bg="#6a7aa0", eye="#3a7ab0", style="mage"),
        "elin": dict(skin="#f4dcc8", hair="#7a4a2a", cloth="#6a8a6a", bg="#c8d0a8", eye="#4a7a5a", style="scholar", extra="collar"),
        "valen": dict(skin="#f4dcc0", hair="#e8c860", cloth="#b8a040", bg="#c8a8a0", eye="#4a8ac0", style="rival"),
        "lockwood": dict(skin="#d8b898", hair="#2a2a2e", cloth="#2e2630", bg="#6a5a6a", eye="#7a2a2a", style="chancellor"),
    }
    return {k: G.portrait(k, **kw) for k, kw in specs.items()}


def dim(img, f):
    return Image.eval(img, lambda v: int(v * f))


def manor(season):
    pal = {"spring": ("#9cc8ee", "#e8f2fa", "#6a9858", "#7a8a6a", "#b86a50"),
           "autumn": ("#f0a870", "#f8dcb0", "#a08848", "#9a7a50", "#8a4a38"),
           "winter": ("#a0b0c8", "#e4eaf2", "#e8eef4", "#c8d0d8", "#7a4a3a")}[season]
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    gradient_sky(d, pal[0], pal[1], 100)
    d.rectangle([0, 90, W, H], fill=hexc("#8a9aa0" if season != "winter" else "#c8d4e0"))
    hills(d, 98, 10, "#8a9aa0" if season != "winter" else "#c8d4e0", 1.2, 0.028)
    d.rectangle([0, 104, W, H], fill=hexc(pal[2]))
    noise(d, (0, 106, W, H), [shade(hexc(pal[2]), 1.08), shade(hexc(pal[2]), 0.92)], 0.14, "m" + season)
    # 主楼：旧而宏大，屋顶缺瓦
    wall, roof = hexc("#b8aa98"), hexc(pal[4])
    d.rectangle([90, 62, 230, 120], fill=wall, outline=OL)
    for y in range(66, 120, 6):
        d.line([(91, y), (229, y)], fill=shade(wall, 0.93))
    d.polygon([(82, 62), (238, 62), (210, 36), (110, 36)], fill=roof, outline=OL)
    for x, y in ((130, 44), (170, 48), (196, 42)):      # 缺瓦
        d.rectangle([x, y, x + 6, y + 4], fill=shade(roof, 0.55))
    d.rectangle([120, 20, 132, 40], fill=hexc("#8a8a90"), outline=OL)   # 烟囱
    d.rectangle([170, 14, 190, 36], fill=wall, outline=OL)               # 塔楼
    d.polygon([(166, 14), (194, 14), (180, 0)], fill=shade(roof, 0.9), outline=OL)
    for x in (104, 124, 190, 210):                                       # 窗，只有一两扇亮着
        lit = x in (124, 210)
        d.rectangle([x, 76, x + 9, 92], fill=hexc("#f6d878") if lit else hexc("#4a4650"), outline=OL)
        d.line([(x + 4, 76), (x + 4, 92)], fill=OL)
    d.rectangle([150, 92, 172, 120], fill=hexc("#5a3a28"), outline=OL)   # 大门
    d.point((168, 108), fill=hexc("#d8b030"))
    # 铁艺围栏与大门
    for x in range(40, 280, 8):
        d.line([(x, 124), (x, 140)], fill=hexc("#3a3a42"))
        d.point((x, 123), fill=hexc("#3a3a42"))
    d.line([(40, 128), (280, 128)], fill=hexc("#3a3a42"))
    d.rectangle([148, 120, 174, 140], fill=hexc(pal[2]))
    d.line([(148, 124), (148, 140)], fill=hexc("#3a3a42")); d.line([(174, 124), (174, 140)], fill=hexc("#3a3a42"))
    # 小径与杂草
    d.polygon([(150, H), (172, H), (168, 140), (154, 140)], fill=hexc("#cfc2a0") if season != "winter" else (232, 236, 242))
    rnd = random.Random("weeds" + season)
    for _ in range(40):
        x, y = rnd.randint(30, 290), rnd.randint(142, 176)
        d.line([(x, y), (x + rnd.randint(-1, 1), y - rnd.randint(3, 6))], fill=hexc("#5a6a3a") if season != "winter" else hexc("#a8a090"))
    tcol = {"spring": "#e8a8c0", "autumn": "#d8702a", "winter": "#4a6a52"}[season]
    for x, y, sz in ((40, 150, 1.2), (270, 152, 1.1), (60, 118, 0.8)):
        tree(d, x, y, tcol, size=sz, snow=season == "winter", bare=season == "winter")
    if season == "winter":
        for _ in range(60):
            d.point((rnd.randrange(W), rnd.randrange(H)), fill=(255, 255, 255))
    return img


def tower():
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    gradient_sky(d, "#2a3a6a", "#a8b8e0", 130, bands=10)
    rnd = random.Random("tower")
    for _ in range(40):
        d.point((rnd.randrange(W), rnd.randrange(80)), fill=(255, 255, 230))
    d.ellipse([240, 20, 262, 42], fill=hexc("#f6f0c8"))
    d.rectangle([0, 112, W, H], fill=hexc("#3a4a6a"))
    hills(d, 130, 14, "#3a4a6a", 0.6, 0.02)
    d.rectangle([0, 138, W, H], fill=hexc("#2e3a52"))
    noise(d, (0, 140, W, H), [hexc("#3a4a66"), hexc("#26324a")], 0.14, "tw")
    st = hexc("#8a96b8")
    d.rectangle([128, 30, 192, 140], fill=st, outline=OL)                # 塔身
    for y in range(34, 140, 7):
        d.line([(129, y), (191, y)], fill=shade(st, 0.88))
    d.polygon([(120, 34), (200, 34), (160, 0)], fill=hexc("#3a4a9a"), outline=OL)   # 塔尖
    d.rectangle([156, -4, 164, 0], fill=hexc("#f0d878"))
    for y in (44, 66, 88, 110):                                          # 发光的窗
        d.rectangle([150, y, 170, y + 12], fill=hexc("#f6d878"), outline=OL)
        d.line([(160, y), (160, y + 12)], fill=OL)
    d.rectangle([148, 118, 172, 140], fill=hexc("#3a2a48"), outline=OL)  # 门
    for x0, h0 in ((100, 80), (214, 70)):                                # 两侧低塔
        d.rectangle([x0, 140 - h0, x0 + 22, 140], fill=shade(st, 0.9), outline=OL)
        d.polygon([(x0 - 4, 140 - h0), (x0 + 26, 140 - h0), (x0 + 11, 140 - h0 - 22)], fill=hexc("#4a5aa0"), outline=OL)
        d.rectangle([x0 + 8, 140 - h0 + 14, x0 + 14, 140 - h0 + 24], fill=hexc("#f6d878"), outline=OL)
    # 台阶与魔法光点
    for i in range(5):
        d.rectangle([140 - i * 3, 140 + i * 5, 180 + i * 3, 145 + i * 5], fill=shade(hexc("#a0a8c0"), 1 - 0.05 * i), outline=OL)
    for _ in range(26):
        x, y = rnd.randint(100, 220), rnd.randint(20, 130)
        d.rectangle([x, y, x + 1, y + 1], fill=hexc("#a8d8ff"))
    return img


def library():
    img = Image.new("RGB", (W, H), hexc("#2a2220"))
    d = ImageDraw.Draw(img)
    noise(d, (0, 0, W, H), [hexc("#332a26"), hexc("#241c1a")], 0.3, "lib")
    wood = hexc("#5a3a26")
    for x0 in (10, 120, 230):                                             # 书架
        d.rectangle([x0, 20, x0 + 80, 130], fill=wood, outline=OL)
        for y in (20, 54, 88, 122):
            d.rectangle([x0, y + 30, x0 + 80, y + 34], fill=shade(wood, 0.8))
        rnd = random.Random(f"b{x0}")
        for row in range(3):
            x = x0 + 4
            while x < x0 + 76:
                w = rnd.randint(3, 6)
                c = rnd.choice(["#8a3a30", "#3a5a8a", "#4a7a4a", "#8a7a3a", "#6a3a7a", "#a8a090"])
                d.rectangle([x, 24 + row * 34 + rnd.randint(0, 5), x + w, 52 + row * 34], fill=hexc(c), outline=OL)
                x += w + 1
    d.rectangle([0, 130, W, H], fill=hexc("#4a3424"))
    for x in range(0, W, 20):
        d.line([(x, 130), (x - 10, H)], fill=hexc("#3a2818"))
    d.rectangle([110, 120, 210, 150], fill=hexc("#6a4430"), outline=OL)  # 书桌
    d.rectangle([140, 108, 180, 120], fill=hexc("#e8dcc0"), outline=OL)  # 摊开的书
    d.line([(160, 108), (160, 120)], fill=OL)
    d.rectangle([196, 96, 200, 120], fill=hexc("#d8c890"), outline=OL)   # 蜡烛
    d.polygon([(195, 96), (201, 96), (198, 86)], fill=hexc("#f6a830"))
    for r, f in ((44, 0.10), (30, 0.18), (18, 0.30)):                    # 烛光
        for y in range(91 - r, 91 + r):
            for x in range(198 - r, 198 + r):
                if (x + y) % 2 == 0 and 0 <= x < W and 0 <= y < H and (x - 198) ** 2 + (y - 91) ** 2 < r * r:
                    b = img.getpixel((x, y))
                    img.putpixel((x, y), tuple(min(255, int(b[k] + (255, 190, 80)[k] * f)) for k in range(3)))
    return img


def street():
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    gradient_sky(d, "#5a4a7a", "#f0a870", 110, bands=10)
    d.ellipse([60, 70, 90, 100], fill=hexc("#ffd890"))
    d.rectangle([0, 112, W, H], fill=hexc("#6a6070"))
    noise(d, (0, 114, W, H), [hexc("#7a7080"), hexc("#5a5060")], 0.18, "st")
    cols = ["#8a7060", "#7a6a7a", "#9a8068", "#706070"]
    x = -10; rnd = random.Random("street")
    while x < W:
        w = rnd.randint(40, 62); h = rnd.randint(52, 84)
        c = hexc(rnd.choice(cols))
        d.rectangle([x, 112 - h, x + w, 112], fill=c, outline=OL)
        d.polygon([(x - 3, 112 - h), (x + w + 3, 112 - h), (x + w // 2, 112 - h - 18)], fill=hexc("#5a3a3a"), outline=OL)
        for wx in range(x + 6, x + w - 8, 14):
            for wy in range(112 - h + 10, 104, 18):
                lit = rnd.random() < 0.4
                d.rectangle([wx, wy, wx + 6, wy + 9], fill=hexc("#f6d878") if lit else hexc("#3a3440"), outline=OL)
        x += w + 4
    for lx in (50, 160, 270):                                              # 路灯
        d.rectangle([lx, 100, lx + 3, 150], fill=hexc("#2a2a30"))
        d.rectangle([lx - 3, 94, lx + 6, 102], fill=hexc("#f6d878"), outline=OL)
    d.polygon([(100, H), (220, H), (190, 120), (130, 120)], fill=hexc("#8a8090"))
    for y in range(124, H, 10):
        d.line([(110 + (y - 124) // 3, y), (210 - (y - 124) // 3, y)], fill=hexc("#6a6070"))
    return img


def court():
    img = Image.new("RGB", (W, H), hexc("#d8d0c0"))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 130], fill=hexc("#cfc6b4"))
    for x in range(0, W, 16):
        d.line([(x, 0), (x, 130)], fill=hexc("#c0b8a4"))
    for x0 in (20, 100, 220, 280):                                         # 立柱
        d.rectangle([x0, 14, x0 + 14, 132], fill=hexc("#e8e0d0"), outline=OL)
        d.rectangle([x0 - 3, 10, x0 + 17, 18], fill=hexc("#d0c8b4"), outline=OL)
    d.rectangle([0, 130, W, H], fill=hexc("#7a6a5a"))
    for i, y in enumerate(range(132, H, 12)):
        d.line([(0, y), (W, y)], fill=hexc("#6a5a4a"))
    d.polygon([(140, 20), (180, 20), (180, 80), (160, 92), (140, 80)], fill=hexc("#a83030"), outline=OL)  # 王国旗
    d.ellipse([153, 38, 167, 52], fill=hexc("#e8c040"), outline=OL)
    d.rectangle([110, 100, 210, 128], fill=hexc("#5a3a26"), outline=OL)       # 审判席
    d.rectangle([150, 86, 170, 100], fill=hexc("#6a4430"), outline=OL)
    d.polygon([(40, H), (280, H), (230, 134), (90, 134)], fill=hexc("#8a2a2a"))   # 红毯
    for bx in (14, 232):                                                    # 旁听席
        for r in range(3):
            d.rectangle([bx, 138 + r * 12, bx + 70, 146 + r * 12], fill=hexc("#6a4a30"), outline=OL)
    return img


def main():
    os.makedirs(OUT + "/portraits", exist_ok=True)
    os.makedirs(OUT + "/scenes", exist_ok=True)
    ps = portraits()
    for k, im in ps.items():
        im.save(f"{OUT}/portraits/portrait_{k}_normal.png")
    sc = {"manor_spring": manor("spring"), "manor_autumn": manor("autumn"), "manor_winter": manor("winter"),
          "tower": tower(), "library": library(), "street": street(), "court": court()}
    for k, im in sc.items():
        im.save(f"{OUT}/scenes/scene_{k}.png")
    sheet = Image.new("RGB", (1296, 8 + 256 + 8 + 4 * 368 + 8), (28, 28, 34))
    x = 8
    for im in ps.values():
        sheet.paste(im.resize((128, 128), Image.NEAREST), (x, 8)); x += 136
    for i, (k, im) in enumerate(sc.items()):
        sheet.paste(im.resize((640, 360), Image.NEAREST), (8 + (i % 2) * 648, 150 + (i // 2) * 368))
    sheet.save(OUT + "/preview2.png")


if __name__ == "__main__":
    main()
