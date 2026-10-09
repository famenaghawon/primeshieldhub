"""
PrimeShieldHub UI Assets Generator
Creates fallback product images, icons, and trust badges
"""

from PIL import Image, ImageDraw, ImageFont
import os, math

# ============================================================
# CONFIG
# ============================================================
OUTPUT_IMG = "assets/products"
OUTPUT_ICONS = "frontend/public/assets/icons"
os.makedirs(OUTPUT_IMG, exist_ok=True)
os.makedirs(OUTPUT_ICONS, exist_ok=True)

BG = (3, 3, 5)
GOLD = (214, 178, 94)
WHITE = (255, 255, 255)
GRAY = (150, 150, 160)

def draw_shield(draw, cx, cy, r):
    for angle in range(0, 360, 60):
        rad = math.radians(angle - 30)
        px = cx + r * math.cos(rad)
        py = cy + r * math.sin(rad)
        draw.line([(cx, cy), (px, py)], fill=GOLD, width=3)
    for i in range(4):
        rad = math.radians(45 + i * 90)
        px = cx + r * 0.5 * math.cos(rad)
        py = cy + r * 0.5 * math.sin(rad)
        draw.line([(cx, cy), (px, py)], fill=GOLD, width=2)

# ============================================================
# 1. FALLBACK PRODUCT IMAGES (8)
# ============================================================
print("📦 Generating fallback product images...")

FALLBACKS = [
    ("iphone-15-pro-max.webp", "iPhone 15\nPro Max", "smartphones"),
    ("s24-ultra.webp", "Samsung\nS24 Ultra", "smartphones"),
    ("airpods-pro-2.webp", "AirPods\nPro 2", "audio"),
    ("macbook-pro-m3.webp", "MacBook\nPro M3", "laptops"),
    ("watch-ultra-2.webp", "Apple Watch\nUltra 2", "wearables"),
    ("ipad-pro-m2.webp", "iPad\nPro M2", "tablets"),
    ("sony-xm5.webp", "Sony\nWH-1000XM5", "audio"),
    ("anker-pb.webp", "Anker\nPower Bank", "power"),
]

colors = {
    "smartphones": (30, 50, 80),
    "audio": (50, 30, 60),
    "laptops": (30, 60, 50),
    "wearables": (60, 30, 40),
    "tablets": (40, 40, 60),
    "power": (60, 50, 30),
}

for filename, label, cat in FALLBACKS:
    img = Image.new("RGB", (800, 800), BG)
    draw = ImageDraw.Draw(img)
    
    # Category accent
    accent = colors.get(cat, (40, 40, 50))
    for i in range(200):
        alpha = 100 - i // 2
        draw.rectangle([0, 600 + i, 800, 601 + i], fill=accent)
    
    # Shield logo
    draw_shield(draw, 400, 280, 80)
    
    # Label
    try:
        font = ImageFont.truetype("arialbd.ttf", 48)
    except:
        font = ImageFont.load_default()
    
    lines = label.split("\n")
    y = 420
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        draw.text((400 - tw // 2, y), line, fill=GOLD, font=font)
        y += 55
    
    # Category badge
    try:
        small = ImageFont.truetype("arial.ttf", 24)
    except:
        small = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), cat.upper(), font=small)
    tw = bbox[2] - bbox[0]
    draw.text((400 - tw // 2, 550), cat.upper(), fill=GRAY, font=small)
    
    img.save(os.path.join(OUTPUT_IMG, filename), "WEBP", quality=85)
    print(f"  ✅ {filename}")

# ============================================================
# 2. UI ICONS
# ============================================================
print("\n🎨 Generating UI icons...")

ICONS = [
    ("cart-icon.svg", "cart"),
    ("wishlist-icon.svg", "wishlist"),
    ("search-icon.svg", "search"),
    ("user-icon.svg", "user"),
]

for filename, icon_type in ICONS:
    svg_content = ""
    
    if icon_type == "cart":
        svg_content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d6b25e" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'
    elif icon_type == "wishlist":
        svg_content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d6b25e" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
    elif icon_type == "search":
        svg_content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d6b25e" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
    elif icon_type == "user":
        svg_content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d6b25e" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
    
    path = os.path.join(OUTPUT_ICONS, filename)
    with open(path, "w") as f:
        f.write(svg_content)
    print(f"  ✅ {filename}")

# ============================================================
# 3. TRUST BADGES
# ============================================================
print("\n🛡️ Generating trust badges...")

BADGES = [
    ("verified-badge.webp", "✓\nVERIFIED\nSELLER"),
    ("warranty-badge.webp", "🛡️\nFULL\nWARRANTY"),
    ("shipping-badge.webp", "🚚\nFAST\nDELIVERY"),
    ("secure-badge.webp", "🔒\nSECURE\nPAYMENT"),
]

for filename, label in BADGES:
    img = Image.new("RGB", (200, 200), BG)
    draw = ImageDraw.Draw(img)
    
    draw.rounded_rectangle([5, 5, 195, 195], radius=15, outline=GOLD, width=2)
    
    try:
        font = ImageFont.truetype("arial.ttf", 22)
    except:
        font = ImageFont.load_default()
    
    lines = label.split("\n")
    y = 40
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        color = GOLD if "✓" in line or line[0] in "🛡🚚🔒" else WHITE
        draw.text((100 - tw // 2, y), line, fill=color, font=font)
        y += 38
    
    img.save(os.path.join(OUTPUT_ICONS, filename), "WEBP", quality=90)
    print(f"  ✅ {filename}")

# ============================================================
# 4. CATEGORY BANNERS
# ============================================================
print("\n🏷️ Generating category banners...")

CATEGORIES = [
    ("smartphones-banner.webp", "SMARTPHONES"),
    ("laptops-banner.webp", "LAPTOPS"),
    ("audio-banner.webp", "AUDIO"),
    ("accessories-banner.webp", "ACCESSORIES"),
    ("power-banner.webp", "POWER BANKS"),
    ("wearables-banner.webp", "WEARABLES"),
]

for filename, cat in CATEGORIES:
    img = Image.new("RGB", (1200, 200), BG)
    draw = ImageDraw.Draw(img)
    
    for i in range(200):
        r = int(BG[0] + (20 - BG[0]) * (i / 200))
        g = int(BG[1] + (20 - BG[1]) * (i / 200))
        b = int(BG[2] + (30 - BG[2]) * (i / 200))
        draw.line([(0, i), (1200, i)], fill=(r, g, b))
    
    try:
        font = ImageFont.truetype("arialbd.ttf", 72)
    except:
        font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), cat, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((600 - tw // 2, 100 - th // 2), cat, fill=GOLD, font=font)
    
    # Accent line
    draw.line([(300, 140), (900, 140)], fill=GOLD, width=3)
    
    img.save(os.path.join(OUTPUT_ICONS, filename), "WEBP", quality=90)
    print(f"  ✅ {filename}")

print(f"\n{'=' * 50}")
print(f"✅ ALL UI ASSETS GENERATED!")
print(f"   Fallback images: {len(FALLBACKS)} → {OUTPUT_IMG}/")
print(f"   UI icons: {len(ICONS)} → {OUTPUT_ICONS}/")
print(f"   Trust badges: {len(BADGES)} → {OUTPUT_ICONS}/")
print(f"   Category banners: {len(CATEGORIES)} → {OUTPUT_ICONS}/")
print(f"{'=' * 50}")
