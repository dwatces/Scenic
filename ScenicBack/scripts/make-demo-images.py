"""Build the demo images in assets/demo/.

Scene photos are free-to-use photos from Pexels, credited on each scene
(util/demoData.js). They are cropped to 3:2 and saved as 1200 x 800 WebP,
small enough to sit inside a scene document, plus a 640 x 427 copy of the
same crop (<name>-card.webp) for scene cards. The member avatars are drawn:
an initial on a flat colour, so no real face stands in for a demo account.

Usage (from ScenicBack/, Python 3 with Pillow built with WebP support):
    python3 scripts/make-demo-images.py             # redraw the avatars
    python3 scripts/make-demo-images.py ORIGINALS   # and rebuild the photos

ORIGINALS is a folder of the full-size downloads, named <pexels id>.jpg.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

OUT = Path(__file__).resolve().parent.parent / "assets" / "demo"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# file name: (Pexels id, crop box in the original's pixels)
PHOTOS = {
    "milford-sound": ("17431554", (380, 0, 2739, 1573)),  # trims the wharf post on the left
    "lake-tekapo": ("62344", (8, 0, 4280, 2848)),
    "cathedral-cove": ("28240868", (0, 0, 4999, 3333)),
}
AVATARS = {
    "daniel": ("D", (47, 93, 138)),
    "aroha": ("A", (122, 74, 140)),
}


def photo(name, pexels_id, box, originals):
    image = ImageOps.exif_transpose(Image.open(originals / f"{pexels_id}.jpg")).convert("RGB")
    image = image.crop(box)
    # Re-encoding drops the original's EXIF, so no camera or location data ships.
    full = image.resize((1200, 800), Image.LANCZOS)
    full.save(OUT / f"{name}.webp", "WEBP", quality=74, method=6)
    # Cards show the photo 340 to 370 px wide, so 640 px stays sharp on high-density screens.
    card = image.resize((640, 427), Image.LANCZOS)
    card.save(OUT / f"{name}-card.webp", "WEBP", quality=72, method=6)


def avatar(name, initial, colour):
    image = Image.new("RGB", (256, 256), colour)
    draw = ImageDraw.Draw(image)
    draw.text((128, 128), initial, font=ImageFont.truetype(BOLD, 120), fill="white", anchor="mm")
    image.save(OUT / f"avatar-{name}.webp", "WEBP", quality=82, method=6)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) > 1:
        originals = Path(sys.argv[1])
        for file_name, (pexels_id, box) in PHOTOS.items():
            photo(file_name, pexels_id, box, originals)
    for file_name, (initial, colour) in AVATARS.items():
        avatar(file_name, initial, colour)
    for path in sorted(OUT.glob("*.webp")):
        print(f"{path.name}: {path.stat().st_size} bytes")
