from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageFont, ImageChops
import numpy as np, sys
src = sys.argv[1]
W, H = 1280, 720
im = Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS)
# crop-zoom slightly so the Moon is bigger
im = im.crop((0, 40, 1000, 602)).resize((W, H), Image.LANCZOS)
im = ImageEnhance.Contrast(im).enhance(float(sys.argv[3]) if len(sys.argv) > 3 else 1.1)
im = ImageEnhance.Color(im).enhance(1.35)
a = np.asarray(im).astype(np.float32) / 255
# warm grade
a[..., 0] = np.clip(a[..., 0] * 1.06, 0, 1); a[..., 2] *= 0.92
# bloom on bright/orange areas
lum = a.max(-1)
orange = np.clip((a[..., 0] - a[..., 2]) * 3, 0, 1) * np.clip(lum * 1.4 - 0.3, 0, 1)
bright = np.clip((lum - 0.9) * 4, 0, 1)
mask = np.maximum(orange * 0.8, bright * 0.3)[..., None] * a
bl = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(18))
bl2 = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(50))
a = np.clip(a + np.asarray(bl).astype(np.float32) / 255 * 0.35 + np.asarray(bl2).astype(np.float32) / 255 * 0.3, 0, 1)
# vignette
yy, xx = np.mgrid[0:H, 0:W]; r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2)
a *= (1 - np.clip((r - 0.35) * 1.3, 0, 0.6))[..., None]
im = Image.fromarray((a * 255).astype(np.uint8))
d = ImageDraw.Draw(im)
black = '/usr/share/fonts/opentype/inter/Inter-Black.otf'
semi = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
serif = 'node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff2'
def text(xy, s, font, fill, stroke=10, shadow=True):
    if shadow:
        sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).text((xy[0] + 6, xy[1] + 8), s, font=font, fill=200, stroke_width=stroke, stroke_fill=200)
        sh = sh.filter(ImageFilter.GaussianBlur(10)); im.paste((0, 0, 0), (0, 0), sh)
    ImageDraw.Draw(im).text(xy, s, font=font, fill=fill, stroke_width=stroke, stroke_fill=(10, 6, 4))
f1 = ImageFont.truetype(black, 150); f2 = ImageFont.truetype(black, 112)
text((44, 210), "IT'S", f1, (255, 255, 255))
text((44, 380), 'FALLING', f2, (255, 206, 46))
# HUD-style badge (matches the video's on-screen counter)
try:
    fs = ImageFont.truetype(serif, 76)
except Exception:
    fs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', 64)
fl = ImageFont.truetype(semi, 24)
x0 = 930
text((x0, 40), 'M O O N   D I S T A N C E', fl, (255, 255, 255), stroke=3, shadow=True)
text((x0 - 4, 68), '18,400 km', fs, (255, 255, 255), stroke=4, shadow=True)
im.save(sys.argv[2], quality=95)
print('ok')
