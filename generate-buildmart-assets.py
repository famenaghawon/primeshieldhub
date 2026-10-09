"""
PrimeShieldHub BuildMart - Complete Asset Generator
Creates all 91+ product images, category icons, brand logos, UI assets, avatars, and placeholders
"""

from PIL import Image, ImageDraw, ImageFont
import os, math

# ============================================================
# CONFIG
# ============================================================
BASE = "frontend/public/assets/images"
DIRS = [
    f"{BASE}/buildmart",
    f"{BASE}/projects/gallery",
    f"{BASE}/products",
    f"{BASE}/contractors/testimonials",
    f"{BASE}/delivery",
    f"{BASE}/categories",
    f"{BASE}/brand",
    f"{BASE}/ui",
    f"{BASE}/avatars",
    f"{BASE}/knowledge",
    f"{BASE}/search",
    f"{BASE}/quote",
    f"{BASE}/wholesale",
    f"{BASE}/logistics",
]
for d in DIRS:
    os.makedirs(d, exist_ok=True)

BG = (3, 3, 5)
GOLD = (214, 178, 94)
WHITE = (255, 255, 255)
GRAY = (150, 150, 160)
ORANGE = (255, 140, 0)
GREEN = (34, 139, 34)
BLUE = (30, 100, 200)

def text_center(draw, text, y, font, fill=WHITE, w=800):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(((w - tw) // 2, y), text, fill=fill, font=font)

def product_card(filename, title, subtitle, color, w=800, h=800):
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)
    for i in range(h):
        ratio = i / h
        r = int(BG[0] + (color[0] - BG[0]) * ratio * 0.3)
        g = int(BG[1] + (color[1] - BG[1]) * ratio * 0.3)
        b = int(BG[2] + (color[2] - BG[2]) * ratio * 0.3)
        draw.line([(0, i), (w, i)], fill=(r, g, b))
    try:
        big = ImageFont.truetype("arialbd.ttf", 52)
        small = ImageFont.truetype("arial.ttf", 28)
    except:
        big = ImageFont.load_default()
        small = ImageFont.load_default()
    text_center(draw, title, 300, big, GOLD, w)
    text_center(draw, subtitle, 380, small, GRAY, w)
    draw.rounded_rectangle([w//2-100, h-120, w//2+100, h-40], radius=10, outline=GOLD, width=2)
    img.save(filename, "WEBP", quality=85)
    print(f"  ✅ {os.path.basename(filename)}")

def svg_icon(filename, label, color_hex):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="15" fill="{color_hex}" opacity="0.2"/><text x="50" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="{color_hex}">{label}</text></svg>'
    with open(filename, "w") as f:
        f.write(svg)
    print(f"  ✅ {os.path.basename(filename)}")

# ============================================================
# 1. PRODUCT IMAGES (34)
# ============================================================
print("📦 Generating BuildMart product images...")

PRODUCTS = [
    ("dangote-cement.webp", "DANGOTE", "Cement 42.5R", (150, 150, 150)),
    ("bua-cement.webp", "BUA", "Cement 42.5R", (180, 160, 140)),
    ("lafarge-cement.webp", "LAFARGE", "Cement 42.5R", (100, 140, 180)),
    ("rebar-16mm.webp", "16mm", "Steel Rebar", (120, 120, 130)),
    ("rebar-12mm.webp", "12mm", "Steel Rebar", (120, 120, 130)),
    ("rebar-10mm.webp", "10mm", "Steel Rebar", (120, 120, 130)),
    ("armoured-cable-2.5mm.webp", "2.5mm²", "Armoured Cable", (180, 150, 50)),
    ("armoured-cable-4mm.webp", "4mm²", "Armoured Cable", (180, 150, 50)),
    ("roofing-aluzinc.webp", "ALUZINC", "Roofing Sheets", (160, 170, 180)),
    ("roofing-stone-coated.webp", "STONE COATED", "Roofing Sheets", (140, 100, 80)),
    ("timber-plank-2x4.webp", "2×4", "Timber Plank", (140, 110, 70)),
    ("timber-plank-2x6.webp", "2×6", "Timber Plank", (140, 110, 70)),
    ("timber-plank-4x4.webp", "4×4", "Timber Plank", (140, 110, 70)),
    ("timber-plywood-12mm.webp", "12mm", "Plywood Sheet", (180, 160, 120)),
    ("timber-plywood-18mm.webp", "18mm", "Plywood Sheet", (180, 160, 120)),
    ("pvc-pipe-4inch.webp", "4 INCH", "PVC Pipe", (200, 200, 210)),
    ("pvc-pipe-2inch.webp", "2 INCH", "PVC Pipe", (200, 200, 210)),
    ("dulux-emulsion-20l.webp", "DULUX", "Emulsion 20L", (200, 180, 200)),
    ("berger-gloss-20l.webp", "BERGER", "Gloss Paint 20L", (220, 200, 180)),
    ("dulux-satin-20l.webp", "DULUX", "Satin Paint 20L", (200, 190, 210)),
    ("gas-cylinder-12kg.webp", "12KG", "Gas Cylinder", (180, 100, 50)),
    ("gas-cylinder-6kg.webp", "6KG", "Gas Cylinder", (180, 100, 50)),
    ("tile-ceramic-60x60.webp", "60×60cm", "Ceramic Tiles", (200, 180, 160)),
    ("door-handle-stainless.webp", "STAINLESS", "Door Handle", (180, 180, 190)),
    ("door-hinge-stainless.webp", "STAINLESS", "Door Hinge", (180, 180, 190)),
    ("padlock-heavy-duty.webp", "HEAVY DUTY", "Padlock", (150, 150, 160)),
    ("galvanized-nails-3inch.webp", "3 INCH", "Galvanized Nails", (140, 140, 150)),
    ("wood-screws-2inch.webp", "2 INCH", "Wood Screws", (140, 140, 150)),
    ("window-hinge-4inch.webp", "4 INCH", "Window Hinge", (180, 180, 190)),
    ("safety-hasps-heavy-duty.webp", "HEAVY DUTY", "Safety Hasp", (150, 150, 160)),
    ("concrete-mixer.webp", "CONCRETE", "Mixer Machine", (180, 150, 50)),
    ("wheelbarrow-heavy.webp", "HEAVY DUTY", "Wheelbarrow", (180, 130, 50)),
    ("shovel-digging.webp", "DIGGING", "Shovel", (100, 120, 100)),
    ("product-placeholder.webp", "BUILDMART", "Quality Materials", GOLD),
]

for filename, title, subtitle, color in PRODUCTS:
    product_card(f"{BASE}/products/{filename}", title, subtitle, color)

# ============================================================
# 2. CATEGORY ICONS (15)
# ============================================================
print("\n🏷️ Generating category icons...")

CATEGORIES = [
    ("cement-icon.svg", "CEM", "#888888"),
    ("steel-icon.svg", "STL", "#666666"),
    ("roofing-icon.svg", "ROF", "#8B4513"),
    ("plumbing-icon.svg", "PLB", "#4169E1"),
    ("electrical-icon.svg", "ELE", "#FFD700"),
    ("paint-icon.svg", "PNT", "#FF69B4"),
    ("tiles-icon.svg", "TLE", "#DEB887"),
    ("tools-icon.svg", "TLS", "#FF6347"),
    ("hardware-icon.svg", "HDW", "#808080"),
    ("timber-icon.svg", "TMB", "#8B4513"),
    ("blocks-icon.svg", "BLK", "#A9A9A9"),
    ("doors-icon.svg", "DOR", "#D2691E"),
    ("insulation-icon.svg", "INS", "#FFE4B5"),
    ("windows-icon.svg", "WIN", "#87CEEB"),
    ("aggregates-icon.svg", "AGG", "#BC8F8F"),
]

for filename, label, color in CATEGORIES:
    svg_icon(f"{BASE}/categories/{filename}", label, color)

# ============================================================
# 3. BRAND LOGOS (8)
# ============================================================
print("\n🏢 Generating brand logos...")

BRANDS = [
    ("dangote-logo.svg", "DANGOTE", "#006633"),
    ("bua-logo.svg", "BUA", "#CC0000"),
    ("lafarge-logo.svg", "LAFARGE", "#003399"),
    ("dulux-logo.svg", "DULUX", "#993399"),
    ("berger-logo.svg", "BERGER", "#FF6600"),
    ("nexans-logo.svg", "NEXANS", "#FF9900"),
    ("african-steel-logo.svg", "AFR STEEL", "#333333"),
    ("alucobond-logo.svg", "ALUCOBOND", "#6699CC"),
]

for filename, label, color in BRANDS:
    svg_icon(f"{BASE}/brand/{filename}", label, color)

# ============================================================
# 4. UI ASSETS (10)
# ============================================================
print("\n🖼️ Generating UI assets...")

# BuildMart logo SVG
with open(f"{BASE}/buildmart/logo.svg", "w") as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><text x="100" y="40" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="#d6b25e">PRIMESHIELDHUB</text><text x="100" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#fff">BUILDMART</text></svg>')
print("  ✅ logo.svg")

with open(f"{BASE}/buildmart/logo-white.svg", "w") as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><text x="100" y="40" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="#ffffff">PRIMESHIELDHUB</text><text x="100" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#d6b25e">BUILDMART</text></svg>')
print("  ✅ logo-white.svg")

# Hero & UI images
UI_IMAGES = [
    ("buildmart-hero-bg.webp", "BUILDMART", "Quality Building Materials", ORANGE),
    ("buildmart-storefront.webp", "STOREFRONT", "Visit Our Warehouse", BLUE),
    ("og-image.webp", "PRIMESHIELDHUB BUILDMART", "Nigeria's Construction Supply Partner", GOLD),
    ("warehouse-bg.webp", "WAREHOUSE", "Massive Stock Available", GREEN),
    ("product-placeholder-large.webp", "PRODUCT", "Image Coming Soon", GRAY),
    ("no-image.webp", "NO IMAGE", "Available", (100, 100, 100)),
]

for filename, title, subtitle, color in UI_IMAGES:
    product_card(f"{BASE}/ui/{filename}", title, subtitle, color, 1200, 630)

# QR placeholder
img = Image.new("RGB", (200, 200), WHITE)
draw = ImageDraw.Draw(img)
for i in range(0, 200, 10):
    for j in range(0, 200, 10):
        if (i + j) % 30 < 15:
            draw.rectangle([i, j, i+8, j+8], fill=(0, 0, 0))
img.save(f"{BASE}/ui/qr-placeholder.png", "PNG")
print("  ✅ qr-placeholder.png")

# ============================================================
# 5. PROJECT IMAGES (10)
# ============================================================
print("\n🏗️ Generating project images...")

PROJECTS = [
    ("project-hero.webp", "OUR PROJECTS", "Excellence in Construction", BLUE),
    ("before-construction.webp", "BEFORE", "Site Preparation", (150, 130, 100)),
    ("after-construction.webp", "AFTER", "Completed Project", GREEN),
    ("blueprint-sample.webp", "BLUEPRINT", "Architectural Plans", (50, 80, 150)),
]

for filename, title, subtitle, color in PROJECTS:
    product_card(f"{BASE}/projects/{filename}", title, subtitle, color, 1200, 800)

for i in range(1, 6):
    product_card(f"{BASE}/projects/project-gallery-{i}.webp", f"PROJECT {i}", "PrimeShieldHub BuildMart", BLUE, 800, 600)

for i in range(1, 3):
    product_card(f"{BASE}/projects/drone-aerial-{i}.webp", f"AERIAL VIEW {i}", "Drone Photography", (100, 150, 200), 800, 600)

# ============================================================
# 6. LOGISTICS (7)
# ============================================================
print("\n🚚 Generating logistics assets...")

LOGISTICS = [
    ("delivery-driver.webp", "DELIVERY", "Professional Drivers", GREEN),
    ("vehicle-hilux.webp", "TOYOTA HILUX", "Delivery Fleet", (80, 80, 90)),
    ("route-map.webp", "DELIVERY MAP", "Nationwide Coverage", BLUE),
]

for filename, title, subtitle, color in LOGISTICS:
    product_card(f"{BASE}/logistics/{filename}", title, subtitle, color, 800, 600)

with open(f"{BASE}/logistics/truck-icon.svg", "w") as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d6b25e" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>')
print("  ✅ truck-icon.svg")

with open(f"{BASE}/logistics/warehouse-icon.svg", "w") as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d6b25e" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>')
print("  ✅ warehouse-icon.svg")

with open(f"{BASE}/logistics/gps-icon.svg", "w") as f:
    f.write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d6b25e" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/></svg>')
print("  ✅ gps-icon.svg")

img = Image.new("RGB", (400, 300), (200, 200, 210))
draw = ImageDraw.Draw(img)
draw.rectangle([50, 50, 350, 250], outline=GREEN, width=2)
draw.text((180, 140), "MAP", fill=GREEN)
img.save(f"{BASE}/logistics/map-placeholder.png", "PNG")
print("  ✅ map-placeholder.png")

# ============================================================
# 7. AVATARS (7)
# ============================================================
print("\n👤 Generating avatars...")

AVATAR_COLORS = [ORANGE, BLUE, GREEN, (150, 100, 200), (200, 100, 100), (100, 180, 180), (180, 180, 100)]
AVATAR_NAMES = ["default", "chidi-okonkwo", "adeola-k", "k-musa", "emmanuel", "bola", "avatar-placeholder"]

for i, (name, color) in enumerate(zip(AVATAR_NAMES, AVATAR_COLORS)):
    img = Image.new("RGB", (200, 200), color)
    draw = ImageDraw.Draw(img)
    initials = "".join([w[0] for w in name.replace("-", " ").split()]).upper()[:2]
    try:
        font = ImageFont.truetype("arialbd.ttf", 80)
    except:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), initials, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((100 - tw // 2, 100 - th // 2), initials, fill=WHITE, font=font)
    img.save(f"{BASE}/avatars/{name}.webp", "WEBP", quality=90)
    print(f"  ✅ {name}.webp")

# ============================================================
# 8. KNOWLEDGE & SEARCH (7)
# ============================================================
print("\n📚 Generating knowledge/guide covers...")

for i in range(1, 7):
    product_card(f"{BASE}/knowledge/guide-cover-{i}.webp", f"GUIDE {i}", "Construction Knowledge", BLUE, 600, 800)

product_card(f"{BASE}/search/empty-state.webp", "NO RESULTS", "Try another search", GRAY, 600, 400)
product_card(f"{BASE}/search/boq-upload-bg.webp", "UPLOAD BOQ", "Bill of Quantities", GREEN, 800, 400)
product_card(f"{BASE}/quote/quote-bg.webp", "GET A QUOTE", "Competitive Pricing", ORANGE, 1200, 600)
product_card(f"{BASE}/wholesale/wholesale-bg.webp", "WHOLESALE", "Bulk Pricing Available", GOLD, 1200, 600)

# ============================================================
# SUMMARY
# ============================================================
print(f"\n{'=' * 60}")
print(f"✅ ALL BUILDMART ASSETS GENERATED!")
print(f"{'=' * 60}")
print(f"  📦 Products: 34 → {BASE}/products/")
print(f"  🏷️ Categories: 15 → {BASE}/categories/")
print(f"  🏢 Brands: 8 → {BASE}/brand/")
print(f"  🖼️ UI: 10+ → {BASE}/ui/ + {BASE}/buildmart/")
print(f"  🏗️ Projects: 10 → {BASE}/projects/")
print(f"  🚚 Logistics: 7 → {BASE}/logistics/")
print(f"  👤 Avatars: 7 → {BASE}/avatars/")
print(f"  📚 Knowledge: 6 → {BASE}/knowledge/")
print(f"  🔍 Search: 3 → {BASE}/search/")
print(f"\n  📍 Output: {BASE}/")
print(f"{'=' * 60}")
