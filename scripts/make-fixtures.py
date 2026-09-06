"""Generate local test fixtures for tools verification (dev only, gitignored)."""
import io, math, struct, os
from PIL import Image

os.makedirs('dev-assets', exist_ok=True)

# ---- 1. GPS-tagged JPEG (privacy kit) ----
import piexif

img = Image.new('RGB', (1200, 800), (30, 41, 59))
# draw something asymmetric so compression is visible
for x in range(0, 1200, 60):
    for y in range(0, 800, 60):
        if (x + y) % 120 == 0:
            img.paste((79, 140, 255), (x, y, x + 30, y + 30))
img.save('dev-assets/gps-photo.jpg', quality=90, exif=piexif.dump({
    'GPS': {
        piexif.GPSIFD.GPSLatitudeRef: b'N',
        piexif.GPSIFD.GPSLatitude: ((41, 1), (0, 1), (0, 1)),
        piexif.GPSIFD.GPSLongitudeRef: b'E',
        piexif.GPSIFD.GPSLongitude: ((29, 1), (0, 1), (0, 1)),
    },
    '0th': {
        piexif.ImageIFD.Make: b'NavCam',
        piexif.ImageIFD.Model: b'Pixel 99',
        piexif.ImageIFD.DateTime: b'2026:09:05 14:30:00',
    },
}))
print('gps-photo.jpg ok')

# ---- 2. Receipt-like photos (3, varied, no GPS) ----
for i, (w, h, col) in enumerate([(800, 1200, (245, 241, 230)), (900, 1100, (240, 244, 235)), (750, 1250, (248, 240, 235))]):
    im = Image.new('RGB', (w, h), col)
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    d.rectangle((40, 40, w - 40, 140), outline=(60, 60, 60), width=3)
    d.text((70, 70), f'RECEIPT #{i + 1}  NAVIGATORSLAB STORE', fill=(30, 30, 30))
    for line in range(8):
        y = 200 + line * 90
        d.text((70, y), f'Item {line + 1} ................ {(line + 1) * 3}.50', fill=(50, 50, 50))
    im.save(f'dev-assets/receipt-{i + 1}.jpg', quality=88)
print('receipts ok')

# ---- 3. Big PNG for shrinker (well over 2MB raw) ----
big = Image.new('RGB', (4000, 3000))
for y in range(3000):
    for x in range(0, 4000, 40):
        big.putpixel((x, y), (x % 255, y % 255, (x * y) % 255))
big.save('dev-assets/big-photo.png')
print('big-photo.png ok')

# ---- 4. WAV tone (audio trimmer): 3s 440Hz sine ----
sr = 44100
n = sr * 3
frames = bytearray()
for i in range(n):
    v = int(20000 * math.sin(2 * math.pi * 440 * i / sr) * (0.6 + 0.4 * math.sin(2 * math.pi * 0.5 * i / sr)))
    frames += struct.pack('<h', v)
with open('dev-assets/tone.wav', 'wb') as f:
    f.write(b'RIFF')
    f.write(struct.pack('<I', 36 + len(frames)))
    f.write(b'WAVEfmt ')
    f.write(struct.pack('<IHHIIHH', 16, 1, 1, sr, sr * 2, 2, 16))
    f.write(b'data')
    f.write(struct.pack('<I', len(frames)))
    f.write(bytes(frames))
print('tone.wav ok')
