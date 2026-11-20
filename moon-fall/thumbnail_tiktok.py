# Vertical 1080x1920 cover for TikTok / Shorts from the 'thumbv' plate.
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageFont
import numpy as np, sys
src, dst = sys.argv[1], sys.argv[2]
W, H = 1080, 1920
im = Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS)
im = ImageEnhance.Contrast(im).enhance(1.1)
im = ImageEnhance.Color(im).enhance(1.35)
a = np.asarray(im).astype(np.float32) / 255
a[..., 0] = np.clip(a[..., 0] * 1.06, 0, 1); a[..., 2] *= 0.9
lum = a.max(-1)
orange = np.clip((a[..., 0] - a[..., 2]) * 3, 0, 1) * np.clip(lum * 1.4 - 0.3, 0, 1)
bright = np.clip((lum - 0.85) * 4, 0, 1)
mask = np.maximum(orange * 0.6, bright * 0.5)[..., None] * a
m8 = Image.fromarray((mask * 255).astype(np.uint8))
a = np.clip(a + np.asarray(m8.filter(ImageFilter.GaussianBlur(24))).astype(np.float32) / 255 * 0.35
            + np.asarray(m8.filter(ImageFilter.GaussianBlur(70))).astype(np.float32) / 255 * 0.35, 0, 1)
# darken top for text legibility + vignette
yy, xx = np.mgrid[0:H, 0:W]
a *= (1 - 0.45 * np.clip(1 - yy / 820, 0, 1) ** 1.5)[..., None]
r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2)
a *= (1 - np.clip((r - 0.38) * 1.4, 0, 0.6))[..., None]
im = Image.fromarray((a * 255).astype(np.uint8))
black = '/usr/share/fonts/opentype/inter/Inter-Black.otf'
semi = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
serif = 'node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff2'
def fit(s, path, size, maxw):
    while True:
        f = ImageFont.truetype(path, size)
        if ImageDraw.Draw(im).textlength(s, font=f) <= maxw: return f
        size -= 4
def text_c(y, s, font, fill, stroke=12):
    w = ImageDraw.Draw(im).textlength(s, font=font); x = (W - w) / 2
    sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).text((x + 6, y + 10), s, font=font, fill=210, stroke_width=stroke, stroke_fill=210)
    im.paste((0, 0, 0), (0, 0), sh.filter(ImageFilter.GaussianBlur(14)))
    ImageDraw.Draw(im).text((x, y), s, font=font, fill=fill, stroke_width=stroke, stroke_fill=(12, 6, 4))
f1 = fit('THE MOON', black, 170, 960)
text_c(170, 'WHAT IF', f1, (255, 255, 255))
text_c(170 + int(f1.size * 1.08), 'THE MOON', f1, (255, 255, 255))
f3 = fit('FELL?', black, 250, 960)
text_c(170 + int(f1.size * 2.16), 'FELL?', f3, (255, 206, 46), stroke=14)
# HUD badge, same style as the video's counter
try: fs = ImageFont.truetype(serif, 104)
except Exception: fs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', 90)
fl = ImageFont.truetype(semi, 34)
text_c(1390, 'M O O N   D I S T A N C E', fl, (255, 255, 255), stroke=4)
text_c(1436, '18,400 km', fs, (255, 255, 255), stroke=5)
im.save(dst, quality=95)
print('ok')
