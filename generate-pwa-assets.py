"""
PrimeShieldHub Quantum PWA Asset Generator
Outputs to frontend/public/ for Cloudflare Pages deployment
"""

from PIL import Image, ImageDraw, ImageFont
import os, math, json

# ============================================================
# CONFIGURATION — Output to frontend/public/
# ============================================================
BASE_DIR = os.path.join("frontend", "public")
ICON_DIR = os.path.join(BASE_DIR, "icons")
SHORTCUT_DIR = os.path.join(ICON_DIR, "shortcuts")
SCREENSHOT_DIR = os.path.join(BASE_DIR, "assets", "screenshots")
MANIFEST_FILE = os.path.join(BASE_DIR, "quantum-manifest.json")
SW_FILE = os.path.join(BASE_DIR, "sw.js")
OFFLINE_FILE = os.path.join(BASE_DIR, "offline.html")

# Brand colors
BG_COLOR = (3, 3, 5)
GOLD = (214, 178, 94)
GOLD_LIGHT = (235, 210, 140)
WHITE = (255, 255, 255)
DARK_SURFACE = (20, 20, 30)

# Create all directories
for d in [ICON_DIR, SHORTCUT_DIR, SCREENSHOT_DIR]:
    os.makedirs(d, exist_ok=True)

print("=" * 60)
print("⚡ PRIMESHIELDHUB QUANTUM — PWA ASSET GENERATOR")
print(f"   Output: {BASE_DIR}/")
print("=" * 60)

# ============================================================
# HELPER: Draw Quantum Shield logo
# ============================================================
def draw_quantum_logo(draw, size, cx, cy, scale=1.0):
    r = int(35 * scale)
    
    # Outer glow rings
    for i in range(3):
        glow_r = r + (3-i) * int(6 * scale)
        alpha = max(5, 25 - i * 10)
        draw.ellipse(
            [cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r],
            outline=(GOLD[0], GOLD[1], GOLD[2], alpha),
            width=int(2 * scale)
        )
    
    # Shield hexagon
    points = []
    for angle in range(0, 360, 60):
        rad = math.radians(angle - 30)
        px = cx + r * math.cos(rad)
        py = cy + r * math.sin(rad)
        points.append((px, py))
    draw.polygon(points, outline=GOLD, width=int(3 * scale))
    
    # Inner geometric lines
    for angle in [0, 120, 240]:
        rad = math.radians(angle - 30)
        px = cx + int(r * 0.65) * math.cos(rad)
        py = cy + int(r * 0.65) * math.sin(rad)
        draw.line([(cx, cy), (px, py)], fill=GOLD, width=int(2 * scale))
    
    # Center diamond
    diamond_r = int(8 * scale)
    dp = []
    for i in range(4):
        rad = math.radians(45 + i * 90)
        dp.append((cx + diamond_r * math.cos(rad), cy + diamond_r * math.sin(rad)))
    draw.polygon(dp, outline=GOLD, width=int(2 * scale))


# ============================================================
# 1. ICONS (10 standard + 3 maskable = 13 total)
# ============================================================
print("\n📱 Generating icons...")

ICON_SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512]
MASKABLE_SIZES = [192, 512, 1024]

for size in ICON_SIZES:
    img = Image.new("RGBA", (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)
    scale = size / 512
    draw_quantum_logo(draw, size, size // 2, size // 2, scale)
    
    # Add subtle "Q" character
    try:
        font = ImageFont.truetype("arialbd.ttf", int(size * 0.35))
    except:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), "Q", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((size // 2 - tw // 2, size // 2 - th // 2), "Q", fill=GOLD, font=font)
    
    filename = f"quantum-icon-{size}.png"
    img.save(os.path.join(ICON_DIR, filename), "PNG")
    print(f"  ✅ {filename}")

# Maskable icons (padded for safe zone)
for size in MASKABLE_SIZES:
    img = Image.new("RGBA", (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)
    scale = size / 512 * 0.7  # 70% size for safe zone
    draw_quantum_logo(draw, size, size // 2, size // 2, scale)
    
    filename = f"quantum-icon-maskable-{size}.png"
    img.save(os.path.join(ICON_DIR, filename), "PNG")
    print(f"  ✅ {filename}")

# ============================================================
# 2. SHORTCUT ICONS (6 total)
# ============================================================
print("\n🔗 Generating shortcut icons...")

SHORTCUTS = [
    ("marketplace", "🏪", (214, 178, 94), "Marketplace"),
    ("reseller", "🛡️", (100, 180, 255), "Reseller"),
    ("ai", "🤖", (130, 230, 130), "AI Assistant"),
    ("track", "📦", (255, 170, 90), "Track Order"),
    ("enterprise", "💎", (190, 140, 255), "Enterprise"),
    ("founder", "👑", (255, 210, 50), "Founder"),
]

for key, emoji, color, name in SHORTCUTS:
    img = Image.new("RGBA", (96, 96), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Rounded square background
    r = 18
    draw.rounded_rectangle([8, 8, 88, 88], radius=r, fill=color)
    
    # Emoji
    try:
        font = ImageFont.truetype("seguiemj.ttf", 40)
    except:
        try:
            font = ImageFont.truetype("arial.ttf", 40)
        except:
            font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), emoji, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((48 - tw // 2, 48 - th // 2 - 3), emoji, font=font, fill=WHITE)
    
    filename = f"{key}-96.png"
    img.save(os.path.join(SHORTCUT_DIR, filename), "PNG")
    print(f"  ✅ {filename} — {name}")

# ============================================================
# 3. SCREENSHOTS (5 total)
# ============================================================
print("\n📸 Generating screenshots...")

SCREENSHOTS = [
    ("quantum-home-4k.webp", 3840, 2160, "PrimeShieldHub Quantum Marketplace", "Premier Gadget Destination", True),
    ("quantum-products-4k.webp", 3840, 2160, "Quantum Product Ecosystem", "Authenticity Guaranteed", True),
    ("quantum-mobile-portrait.webp", 1080, 1920, "Quantum Mobile", "Nigeria's Trusted Commerce", False),
    ("quantum-reseller-dashboard.webp", 1920, 1080, "Quantum Reseller Command", "B2B Ecosystem", True),
    ("quantum-ai-assistant.webp", 1920, 1080, "Quantum AI Assistant", "Intelligent Shopping", True),
]

for filename, w, h, title, subtitle, is_wide in SCREENSHOTS:
    img = Image.new("RGB", (w, h), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Gradient background
    for i in range(h):
        ratio = i / h
        r = int(BG_COLOR[0] + (DARK_SURFACE[0] - BG_COLOR[0]) * ratio)
        g = int(BG_COLOR[1] + (DARK_SURFACE[1] - BG_COLOR[1]) * ratio)
        b = int(BG_COLOR[2] + (DARK_SURFACE[2] - BG_COLOR[2]) * ratio)
        draw.line([(0, i), (w, i)], fill=(r, g, b))
    
    # Quantum grid
    grid_size = w // 30
    for x in range(0, w, grid_size):
        draw.line([(x, 0), (x, h)], fill=(GOLD[0], GOLD[1], GOLD[2], 10), width=1)
    for y in range(0, h, grid_size):
        draw.line([(0, y), (w, y)], fill=(GOLD[0], GOLD[1], GOLD[2], 10), width=1)
    
    # Logo
    logo_size = min(w, h) // 3
    draw_quantum_logo(draw, logo_size, w // 2, h // 3, logo_size / 256)
    
    # Title
    try:
        title_font = ImageFont.truetype("arialbd.ttf", w // 22)
        sub_font = ImageFont.truetype("arial.ttf", w // 40)
    except:
        title_font = ImageFont.load_default()
        sub_font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    draw.text((w // 2 - tw // 2, h * 2 // 3), title, fill=GOLD, font=title_font)
    
    bbox = draw.textbbox((0, 0), subtitle, font=sub_font)
    tw = bbox[2] - bbox[0]
    draw.text((w // 2 - tw // 2, h * 2 // 3 + h // 10), subtitle, fill=GOLD_LIGHT, font=sub_font)
    
    img.save(os.path.join(SCREENSHOT_DIR, filename), "WEBP", quality=90)
    print(f"  ✅ {filename} ({w}x{h})")

# ============================================================
# 4. MANIFEST
# ============================================================
print("\n📋 Generating manifest...")

manifest = {
    "name": "PRIMESHIELDHUB QUANTUM",
    "short_name": "⚡ PSH",
    "description": "Nigeria's Quantum Technology & Commerce Nexus — Authentic Gadgets, Enterprise Solutions, Reseller Ecosystem",
    "start_url": "/",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#030305",
    "theme_color": "#d6b25e",
    "lang": "en-NG",
    "dir": "ltr",
    "categories": ["shopping", "business", "technology", "lifestyle"],
    "icons": [
        {"src": "/icons/quantum-icon-48.png", "sizes": "48x48", "type": "image/png", "purpose": "any"},
        {"src": "/icons/quantum-icon-72.png", "sizes": "72x72", "type": "image/png", "purpose": "any"},
        {"src": "/icons/quantum-icon-96.png", "sizes": "96x96", "type": "image/png", "purpose": "any"},
        {"src": "/icons/quantum-icon-128.png", "sizes": "128x128", "type": "image/png", "purpose": "any"},
        {"src": "/icons/quantum-icon-144.png", "sizes": "144x144", "type": "image/png", "purpose": "any"},
        {"src": "/icons/quantum-icon-152.png", "sizes": "152x152", "type": "image/png", "purpose": "any"},
        {"src": "/icons/quantum-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "/icons/quantum-icon-256.png", "sizes": "256x256", "type": "image/png", "purpose": "any"},
        {"src": "/icons/quantum-icon-384.png", "sizes": "384x384", "type": "image/png", "purpose": "any"},
        {"src": "/icons/quantum-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "/icons/quantum-icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
        {"src": "/icons/quantum-icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        {"src": "/icons/quantum-icon-maskable-1024.png", "sizes": "1024x1024", "type": "image/png", "purpose": "maskable"}
    ],
    "screenshots": [
        {"src": "/assets/screenshots/quantum-home-4k.webp", "sizes": "3840x2160", "type": "image/webp", "platform": "wide", "label": "PrimeShieldHub Quantum Marketplace"},
        {"src": "/assets/screenshots/quantum-products-4k.webp", "sizes": "3840x2160", "type": "image/webp", "platform": "wide", "label": "Quantum Product Ecosystem"},
        {"src": "/assets/screenshots/quantum-mobile-portrait.webp", "sizes": "1080x1920", "type": "image/webp", "platform": "narrow", "label": "Quantum Mobile Experience"},
        {"src": "/assets/screenshots/quantum-reseller-dashboard.webp", "sizes": "1920x1080", "type": "image/webp", "platform": "wide", "label": "Quantum Reseller Command Center"},
        {"src": "/assets/screenshots/quantum-ai-assistant.webp", "sizes": "1920x1080", "type": "image/webp", "platform": "wide", "label": "Quantum AI Assistant"}
    ],
    "shortcuts": [
        {"name": "⚡ Marketplace", "short_name": "Marketplace", "description": "Premium gadgets and enterprise solutions", "url": "/", "icons": [{"src": "/icons/shortcuts/marketplace-96.png", "sizes": "96x96", "type": "image/png"}]},
        {"name": "🛡️ Reseller", "short_name": "Reseller", "description": "Wholesale pricing and B2B ecosystem", "url": "/reseller.html", "icons": [{"src": "/icons/shortcuts/reseller-96.png", "sizes": "96x96", "type": "image/png"}]},
        {"name": "🤖 AI Assistant", "short_name": "AI Help", "description": "Intelligent shopping assistant", "url": "/assistant.html", "icons": [{"src": "/icons/shortcuts/ai-96.png", "sizes": "96x96", "type": "image/png"}]},
        {"name": "📦 Track Order", "short_name": "Track", "description": "Real-time order tracking", "url": "/track-order.html", "icons": [{"src": "/icons/shortcuts/track-96.png", "sizes": "96x96", "type": "image/png"}]},
        {"name": "💎 Enterprise", "short_name": "Enterprise", "description": "Tailored B2B procurement", "url": "/wholesale.html", "icons": [{"src": "/icons/shortcuts/enterprise-96.png", "sizes": "96x96", "type": "image/png"}]},
        {"name": "👑 Founder", "short_name": "Founder", "description": "Freedom Evbakoe Amenaghawon", "url": "/founder.html", "icons": [{"src": "/icons/shortcuts/founder-96.png", "sizes": "96x96", "type": "image/png"}]}
    ],
    "display_override": ["standalone", "window-controls-overlay", "minimal-ui"],
    "launch_handler": {"client_mode": ["navigate-existing", "auto"]},
    "scope": "/",
    "edge_side_panel": {"preferred_width": 400}
}

with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
print(f"  ✅ quantum-manifest.json")

# ============================================================
# 5. SERVICE WORKER & OFFLINE PAGE
# ============================================================
print("\n⚙️  Generating sw.js and offline.html...")

sw_js = """// PrimeShieldHub Quantum SW v2.0
const CACHE = 'psh-quantum-v2.0.0';
const ASSETS = ['/','/offline.html','/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    e.request.mode === 'navigate'
      ? fetch(e.request).catch(() => caches.match('/offline.html'))
      : caches.match(e.request).then(r => r || fetch(e.request))
  );
});
"""
with open(SW_FILE, "w") as f:
    f.write(sw_js)
print(f"  ✅ sw.js")

offline_html = """<!DOCTYPE html>
<html lang="en-NG">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Offline — PrimeShieldHub Quantum</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#030305;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;text-align:center}
.container{padding:2rem}
.icon{font-size:80px;margin-bottom:1rem}
h1{color:#d6b25e;font-size:2rem;margin-bottom:.5rem}
p{color:#aaa;font-size:1.1rem;margin-bottom:2rem;max-width:400px;line-height:1.6}
button{background:#d6b25e;color:#030305;border:none;padding:14px 32px;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer}
button:hover{background:#e5c87a}
</style></head>
<body><div class="container">
<div class="icon">⚡</div>
<h1>Quantum Link Lost</h1>
<p>You're offline. Reconnect to continue your quantum shopping experience.</p>
<button onclick="location.reload()">🔄 Retry Connection</button>
</div></body></html>"""
with open(OFFLINE_FILE, "w", encoding="utf-8") as f:
    f.write(offline_html)
print(f"  ✅ offline.html")

# ============================================================
# SUMMARY
# ============================================================
print(f"\n{'=' * 60}")
print(f"✅ ALL PWA ASSETS GENERATED!")
print(f"{'=' * 60}")
print(f"  📱 Icons: {len(ICON_SIZES) + len(MASKABLE_SIZES)} → {ICON_DIR}/")
print(f"  🔗 Shortcuts: 6 → {SHORTCUT_DIR}/")
print(f"  📸 Screenshots: 5 → {SCREENSHOT_DIR}/")
print(f"  📋 Manifest: {MANIFEST_FILE}")
print(f"  ⚙️  SW: {SW_FILE}")
print(f"  📄 Offline: {OFFLINE_FILE}")
print(f"\n  🚀 Ready to deploy: wrangler pages deploy frontend/public")
print(f"{'=' * 60}")
