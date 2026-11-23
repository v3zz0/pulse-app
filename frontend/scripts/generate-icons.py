"""Esporta favicon e icone PWA dal logo ufficiale "Spinta". Richiede Python 3 + Pillow.
Nessuna ricolorazione: il simbolo (trasparente) viene solo centrato su fondo scuro,
perché la P crema non sarebbe visibile su fondo chiaro.
Uso: python3 frontend/scripts/generate-icons.py
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
symbol = Image.open(root / 'branding/pulse-spinta-icona.png').convert('RGBA')
symbol = symbol.crop(symbol.getbbox())  # solo il simbolo, senza margini trasparenti
public = root / 'public'
icons = public / 'icons'
icons.mkdir(exist_ok=True)
BG = (27, 23, 21, 255)  # #1b1715, fondo del tema scuro

def tile(size, ratio):
    """Simbolo centrato su fondo pieno; ratio = lato massimo del simbolo rispetto all'icona."""
    canvas = Image.new('RGBA', (size, size), BG)
    scale = ratio * size / max(symbol.size)
    s = symbol.resize((round(symbol.width * scale), round(symbol.height * scale)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(s, ((size - s.width) // 2, (size - s.height) // 2))
    return canvas.convert('RGB')

for size in (16, 32):
    tile(size, 0.92).save(public / f'favicon-{size}x{size}.png', optimize=True)
tile(256, 0.92).save(public / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
tile(180, 0.78).save(public / 'apple-touch-icon.png', optimize=True)
for size in (192, 512):
    tile(size, 0.82).save(icons / f'pulse-{size}.png', optimize=True)
    # Maskable: Android ritaglia fino al cerchio centrale (80%): simbolo entro il 60%.
    tile(size, 0.60).save(icons / f'pulse-maskable-{size}.png', optimize=True)
print('Esportati favicon ICO (16/32/48), PNG 16/32, Apple 180, PWA any/maskable 192/512.')
