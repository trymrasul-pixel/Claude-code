from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageFont
import sys
W, H = 1280, 720
im = Image.open(sys.argv[1]).convert('RGB').resize((W, H), Image.LANCZOS)
im = im.crop((150, 60, 1230, 668)).resize((W, H), Image.LANCZOS)
im = ImageEnhance.Contrast(im).enhance(1.15); im = ImageEnhance.Color(im).enhance(1.3)
black = '/usr/share/fonts/opentype/inter/Inter-Black.otf'
def text(xy, s, font, fill, stroke=9):
    sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).text((xy[0] + 6, xy[1] + 8), s, font=font, fill=200, stroke_width=stroke, stroke_fill=200)
    sh = sh.filter(ImageFilter.GaussianBlur(10)); im.paste((0, 0, 0), (0, 0), sh)
    ImageDraw.Draw(im).text(xy, s, font=font, fill=fill, stroke_width=stroke, stroke_fill=(8, 6, 4))
text((50, 18), '4 DAYS', ImageFont.truetype(black, 132), (255, 255, 255))
text((54, 162), 'TO IMPACT', ImageFont.truetype(black, 84), (255, 206, 46))
im.save(sys.argv[2], quality=95); print('ok')
