import os

root_folder = r"C:\Users\myori\Desktop\primeshieldhub\frontend\public"

# ORDER MATTERS — longer/more-specific patterns must be checked FIRST
# because otherwise short patterns would partially match them.
replacements = [
    # ===== LONGEST / MOST SPECIFIC FIRST =====
    # Multi-byte-corrupted emojis (3rd generation corruption)
    ('ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢Â‚Â¬', '🚀'),
    ('ÃƒÂ°Ã…Â¸Ã¢Â€ÂºÃ¢Â€Â™', '🛡'),
    ('ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â', '🚀'),
    ('ÃƒÂ°Ã…Â¸Ã¢Â€ÂÃ¢Â€Â', '🔄'),
    ('ÃƒÂ°Ã…Â¸Ã¢Â€ÂÃ¢Â€Â"', '🔄'),
    ('ÃƒÂ°Ã…Â¸Ã¢Â€ÂÃ‚Â', '🔊'),

    # Second-generation corruption (ÃƒÂ¢... style)
    ('ÃƒÂ¢Ã…Â¡Ã‚Â¡', '⚡'),
    ('ÃƒÂ¢Ã…Â¡Ã¢Â„Â¢', '⚠'),
    ('ÃƒÂ¢Ã…Â¡Ã¢Â€Â', '⚠'),
    ('ÃƒÂ¢Ã¢Â€Â¦Ã‚Â', '✓'),
    ('ÃƒÂ¢Ã¢Â€Â¦Ã¢Â€Âœ', '✓'),
    ('ÃƒÂ¢Ã¢Â€Â¦Ã¢Â€Â¦', '✓'),
    ('ÃƒÂ¢Ã¢Â€ÂÃ¢Â€Â', '–'),
    ('ÃƒÂ¢Ã¢Â€ÂÃ¢Â€Â"', '—'),
    ('ÃƒÂ¢Ã¢Â€ÂÃ¢Â€Â¢', '—'),
    ('ÃƒÂ¢Ã¢Â€ÂšÃ‚Â¬', '€'),
    ('ÃƒÂ¢Ã¢Â€ÂšÃ¢Â€Âš', '›'),
    ('ÃƒÂ¢Ã¢Â€ÂšÃ‚Â', '›'),
    ('ÃƒÂ¢Ã¢Â€Â°Ã‚Â¥', '✅'),
    ('ÃƒÂ¢Ã¢Â€Â°Ã‚Â¤', '⭐'),
    ('ÃƒÂ¢Ã¢Â€Â°Ã¢Â€Â', '⭐'),
    ('ÃƒÂ¢Ã¢Â€ÂšÃ‚Â', '›'),
    ('ÃƒÂ¢Ã…Â¾Ã‚Â¡', '→'),
    ('ÃƒÂ¢Ã…Â“Ã¢Â€Â”', '✕'),
    ('ÃƒÂ¢Ã…Â“Ã¢Â€Â¦', '✓'),
    ('ÃƒÂ¢Ã…Â¡Ã¢Â€Â', '⚡'),
    ('ÃƒÂ¢Ã…Â“Ã¢Â€Â"', '✕'),
    ('ÃƒÂ¢Ã¢Â€ÂœÃ¢Â€Â¦', '✓'),
    ('ÃƒÂ¢Ã¢Â€Â"Ã‚Â', '├'),
    ('ÃƒÂ¢Ã‚Â', ''),

    # First-generation corruption (the ones fix.py already tried)
    ('Ã¢â€šÂ¦', '₦'),
    ('Ã‚Â·', '·'),
    ('Ã¢Â€Â™', "'"),
    ('Ã¢Â€Âœ', '"'),
    ('Ã¢Â€Â', '"'),
    ('Ã¢Â€Â"', '—'),
    ('Ã¢Â€Â¦', '…'),
    ('Ã¢Â€Âº', '›'),
    ('Ã¢â€”Â', '•'),
    ('Ã¢Âœâ€¦', '✓'),
    ('Ã¢ÂœÂ…', '✅'),
    ('Ã¢ÂÅ¡', '⚡'),
    ('Ã¢ÂÂ¤', '⭐'),
    ('Ã¢Â­Â', '⭐'),
    ('Ã¢Ë†Å¾', '∞'),
    ('Ã¢â€°Â¤', '≤'),
    ('Ã¢â€°Â¥', '≥'),
    ('Ã¢â€°Ë†', '≈'),
    ('Ã¢â€šÂ¬', '€'),
    ('Ã‚Â©', '©'),
    ('Ã‚Â®', '®'),
    ('Ã¯Â¿Â½', ''),

    # Second-generation broken (Ã°Å¸... style, all emojis)
    ('Ã°Å¸Å¡â‚¬', '🚀'),
    ('Ã°Å¸â€™Â°', '💡'),
    ('Ã°Å¸â€œÂ±', '📱'),
    ('Ã°Å¸â€œÂ¦', '📦'),
    ('Ã°Å¸â€œâ€', '📊'),
    ('Ã°Å¸â€œË†', '📈'),
    ('Ã°Å¸â€œÂ', '📁'),
    ('Ã°Å¸â€œÅ¸', '📟'),
    ('Ã°Å¸â€œÂ·', '📷'),
    ('Ã°Å¸â€œÂ¸', '📸'),
    ('Ã°Å¸â€œÂ¡', '📡'),
    ('Ã°Å¸â€œÅ¾', '📞'),
    ('Ã°Å¸â€œÂ§', '📧'),
    ('Ã°Å¸â€œÅ"', '📜'),
    ('Ã°Å¸â€™Â»', '💻'),
    ('Ã°Å¸â€™Â³', '💳'),
    ('Ã°Å¸â€™Å½', '💎'),
    ('Ã°Å¸â€ºÂ¡', '🛡'),
    ('Ã°Å¸â€ºâ€', '🛍'),
    ('Ã°Å¸â€â€', '🔄'),
    ('Ã°Å¸â€Å"', '🔌'),
    ('Ã°Å¸â€Å’', '🔊'),
    ('Ã°Å¸â€Â', '🔐'),
    ('Ã°Å¸â€Â§', '🔧'),
    ('Ã°Å¸â€Â®', '🔮'),
    ('Ã°Å¸â€Â¥', '🔥'),
    ('Ã°Å¸Å½Â§', '🎧'),
    ('Ã°Å¸Å½Â®', '🎮'),
    ('Ã°Å¸Å½Â¯', '🎯'),
    ('Ã°Å¸Å½Âµ', '🎵'),
    ('Ã°Å¸â€“Â¥', '🖥'),
    ('Ã°Å¸â€˜Â¤', '👤'),
    ('Ã°Å¸Â¤â€“', '🤖'),
    ('Ã°Å¸Â§Âª', '🧪'),
    ('Ã°Å¸Å¡Å“', '🚜'),
    ('Ã°Å¸ÂÂ', '🌟'),
    ('Âfâ€šÃ„Ã´', '⚡'),

    # Broken emoji fragments (strip them entirely)
    ('Ã°Å¸â€', ''),
    ('Ã°Å¸Å¡', ''),
    ('Ã°Å¸Â¤', ''),
    ('Ã°Å¸Â§', ''),
    ('Ã°Å¸Â', ''),
    ('Ã°Å¸Å½', ''),
    ('Ã°Å¸â€œ', ''),
    ('Ã°Å¸â€™', ''),
    ('Ã°Å¸â€º', ''),
    ('Ã°Å¸â€', ''),
    ('Ã°Å¸â€Â', ''),

    # Fragments that need stripping (dangerous — might break HTML entities)
    ('ÃƒÂ¢Ã…Â¡Ã‚Â', ''),
    ('ÃƒÂ¢Ã…Â“Ã¢Â€Â', ''),
    ('ÃƒÂ¢Ã…Â“Ã‚Â', ''),
    ('ÃƒÂ¢Ã‚Â', ''),

    # Remaining mojibake fragments
    ('ÃƒÂ', ''),
    ('Ã‚Â', ''),
    ('Ã¢Â', ''),
    ('Ã°Å¸', ''),
    ('Ã', ''),  # last resort: strip remaining corrupted lead byte
]

total = 0
for dirpath, dirnames, filenames in os.walk(root_folder):
    for filename in filenames:
        if not filename.endswith(('.html', '.js', '.css', '.json')):
            continue
        filepath = os.path.join(dirpath, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f'SKIPPED (encoding): {filepath}')
            continue

        original = content
        for broken, correct in replacements:
            if broken in content:
                content = content.replace(broken, correct)

        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'FIXED: {os.path.relpath(filepath, root_folder)}')
            total += 1

print(f'\nDone! Total files fixed: {total}')
