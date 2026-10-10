import os

root_folder = r"C:\Users\myori\Desktop\primeshieldhub\frontend\public"

replacements = replacements = {
    # ===== ORIGINAL PAIRS =====
    'Ã¢â€šÂ¦': '₦',
    'Ã‚Â·':   '·',
    'Ã¢Â€Â™': "'",
    'Ã¢Â€Âœ': '"',
    'Ã¢Â€Â':  '"',
    'Ã¢Â€Â"': '—',
    'Ã¢Â€Â¦': '…',
    'Ã¢Â€Âº': '›',
    'Ã¢â€”Â': '•',
    'Ã¢Âœâ€¦': '✓',
    'Ã¯Â¿Â½':  '-',
    'Âfâ€šÃ„Ã´': '⚡',
    'Ã°Å¸â€Â':  '🚀',
    'Ã°Å¸â€Â¥': '🔥',
    'Ã¢ÂœÂ…': '✅',

    # ===== NEW PAIRS (the stubborn ones) =====
    'Â£â€¦Â¥': '›',           # Breadcrumb arrow in Home > Premium Gadgets
    'â€°â€¹â€¹â€¹â€¹â€¹': '⭐⭐⭐⭐⭐',  # 5-star rating
    'â€°â€¹â€¹â€¹â€¹': '⭐⭐⭐⭐',      # 4-star rating
    'â€°â€¹â€¹â€¹': '⭐⭐⭐',          # 3-star rating
    'Â£â€°,Â£|â€¦Â£': '🔔',      # Bell icon (Enable Notifications)
    'Â°Â¿Â½': '',                # Floating background junk - remove
    'Ã¢â€°Ë†': '≈',               # Approximately equal (if used in bg)
    'Ã¢â‚¬â„¢': "'",              # Yet another apostrophe variant
    'Ã¢â‚¬Å“': '"',              # Another quote variant
    'Ã¢â‚¬Â': '"',                # Right double quote variant
    'Ã¢â‚¬â€': '—',               # Em dash variant
    'Ã¢â‚¬Â¦': '…',                # Ellipsis variant
    'Ã‚Â£': '£',                  # If any British pound signs appear
    'Ã¢Â­Â': '⭐',                # Star emoji variant
    'Ã°Å¸â€Â®': '🎯',              # Another emoji variant
    'Ã°Å¸â€Â¯': '📱',              # Phone emoji variant
}

total_fixed = 0

for dirpath, dirnames, filenames in os.walk(root_folder):
    for filename in filenames:
        if not filename.endswith(('.html', '.js', '.css', '.json')):
            continue

        filepath = os.path.join(dirpath, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            original = content
            for broken, correct in replacements.items():
                if broken in content:
                    content = content.replace(broken, correct)

            if content != original:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"FIXED: {filepath}")
                total_fixed += 1
        except Exception as e:
            print(f"SKIPPED ({e}): {filepath}")

print(f"\nDone! Total files fixed: {total_fixed}")
