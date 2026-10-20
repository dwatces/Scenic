"""Draw the demo placeholder images in assets/demo/.

They stand in for photos in demo mode and in seeded demo content, and say so
on the image itself ("Demo image"), so nothing passes for a real member's
photo. Generated, not downloaded: there is no licence question.

Usage (from ScenicBack/, needs Python 3 with Pillow built with WebP):
    python3 scripts/make-demo-images.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "assets" / "demo"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

SCENES = {
    # file name: (place, top colour, bottom colour)
    "milford-sound": ("Milford Sound", (13, 27, 51), (61, 122, 184)),
    "lake-tekapo": ("Lake Tekapo", (18, 52, 62), (86, 168, 166)),
    "cathedral-cove": ("Cathedral Cove", (16, 50, 74), (196, 164, 112)),
}
AVATARS = {
    "daniel": ("D", (47, 93, 138)),
    "aroha": ("A", (122, 74, 140)),
}


def gradient(size, top, bottom):
    width, height = size
    image = Image.new("RGB", size)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / (height - 1)
        colour = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        draw.line([(0, y), (width, y)], fill=colour)
    return image


def centred(draw, y, text, font, fill):
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    width = draw.im.size[0]
    draw.text(((width - (right - left)) / 2 - left, y - top), text, font=font, fill=fill)


def scene(name, place, top, bottom):
    image = gradient((1200, 800), top, bottom)
    draw = ImageDraw.Draw(image, "RGBA")
    # A quiet frame, so the placeholder reads as a placeholder at any size.
    draw.rounded_rectangle((40, 40, 1160, 760), radius=28, outline=(255, 255, 255, 70), width=3)
    centred(draw, 330, "Demo image", ImageFont.truetype(BOLD, 88), (255, 255, 255, 235))
    centred(draw, 450, place, ImageFont.truetype(REGULAR, 44), (255, 255, 255, 200))
    image.save(OUT / f"{name}.webp", "WEBP", quality=80, method=6)


def avatar(name, initial, colour):
    image = Image.new("RGB", (256, 256), colour)
    draw = ImageDraw.Draw(image, "RGBA")
    centred(draw, 52, initial, ImageFont.truetype(BOLD, 112), (255, 255, 255, 240))
    centred(draw, 178, "DEMO", ImageFont.truetype(BOLD, 26), (255, 255, 255, 210))
    image.save(OUT / f"avatar-{name}.webp", "WEBP", quality=82, method=6)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for file_name, (place, top, bottom) in SCENES.items():
        scene(file_name, place, top, bottom)
    for file_name, (initial, colour) in AVATARS.items():
        avatar(file_name, initial, colour)
    for path in sorted(OUT.glob("*.webp")):
        print(f"{path.name}: {path.stat().st_size} bytes")
