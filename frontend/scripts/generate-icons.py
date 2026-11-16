"""Deterministic export of the official bitmap. Requires Python 3 + Pillow.
No tracing, recoloring, distortion or invented logo elements.
Run from any directory: python3 frontend/scripts/generate-icons.py
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'branding/pulse-official.png').convert('RGB')
assert source.size == (1254, 1254), 'Re-review crop and safe area for a different source'
public = root / 'public'
icons = public / 'icons'
icons.mkdir(exist_ok=True)
# Crop only the surrounding background; keep the complete original symbol,
# centered on its bounds (262, 305)-(990, 970), with equal X/Y scale.
standard = source.crop((209, 221, 1043, 1055))
# Preserve the full original image, adding only dark padding. The symbol is
# inside a radius of 36% of the canvas (Android guarantees the central 40%).
maskable = Image.new('RGB', (1394, 1394), '#0B1018')
maskable.paste(source, (70, 70))

def export(image, size, path):
    image.resize((size, size), Image.Resampling.LANCZOS).save(path, optimize=True)

for size in (16, 32):
    export(standard, size, public / f'favicon-{size}x{size}.png')
standard.save(public / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
export(standard, 180, public / 'apple-touch-icon.png')
for size in (192, 512):
    export(standard, size, icons / f'pulse-{size}.png')
    export(maskable, size, icons / f'pulse-maskable-{size}.png')
print('Exported favicon ICO (16/32/48), PNG (16/32), Apple 180, PWA any/maskable (192/512).')
