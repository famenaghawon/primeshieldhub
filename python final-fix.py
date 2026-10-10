import os, re

root = r"C:\Users\myori\Desktop\primeshieldhub\frontend\public"

# Order matters — most specific first
patterns = [
    # Currency & punctuation (restore to correct characters)
    (r'â‚¦', '₦'), (r'Â£', '£'), (r'â‚¬', '€'), (r'Â©', '©'), (r'Â®', '®'),
    (r'â€”', '—'), (r'â€“', '–'), (r'â€œ', '"'), (r'â€', '"'), (r'â€™', "'"),
    (r'â€¦', '…'), (r'â€¢', '•'), (r'Â·', '·'), (r'â€º', '›'),
    (r'Ã¢â€šÂ¬', '€'), (r'Ã¢â€”Â', '•'), (r'Ã¢Â€Âº', '›'),
    
    # Common emojis — replace with Font Awesome icon HTML
    (r'ðŸ“±', '<i class="fas fa-mobile-alt"></i>'),
    (r'ðŸ’»', '<i class="fas fa-laptop"></i>'),
    (r'ðŸ“¦', '<i class="fas fa-box"></i>'),
    (r'ðŸš€', '<i class="fas fa-rocket"></i>'),
    (r'ðŸ›’', '<i class="fas fa-shopping-cart"></i>'),
    (r'ðŸ”¥', '<i class="fas fa-fire"></i>'),
    (r'âœ…', '<i class="fas fa-check-circle"></i>'),
    (r'â­ï¸', '<i class="fas fa-star"></i>'),
    (r'â­', '<i class="fas fa-star"></i>'),
    (r'ðŸ“¢', '<i class="fas fa-bullhorn"></i>'),
    (r'ðŸ’¡', '<i class="fas fa-lightbulb"></i>'),
    (r'ðŸ“Š', '<i class="fas fa-chart-bar"></i>'),
    (r'ðŸ“ˆ', '<i class="fas fa-chart-line"></i>'),
    (r'ðŸ”’', '<i class="fas fa-lock"></i>'),
    (r'ðŸ›¡ï¸', '<i class="fas fa-shield-alt"></i>'),
    (r'âš¡', '<i class="fas fa-bolt"></i>'),
    (r'ðŸ‘¤', '<i class="fas fa-user"></i>'),
    (r'ðŸ“§', '<i class="fas fa-envelope"></i>'),
    (r'ðŸ“ž', '<i class="fas fa-phone"></i>'),
    (r'ðŸ’³', '<i class="fas fa-credit-card"></i>'),
    (r'ðŸ¤–', '<i class="fas fa-robot"></i>'),
    (r'ðŸŽ¯', '<i class="fas fa-bullseye"></i>'),
    (r'ðŸ‰', '<i class="fas fa-truck"></i>'),
    (r'ðŸ””', '<i class="fas fa-bell"></i>'),
    (r'ðŸ”', '<i class="fas fa-search"></i>'),
    (r'âœ¨', '<i class="fas fa-star"></i>'),
    
    # Catch-all: any remaining UTF-8 mojibake sequence with a "broken" lead byte
    # will be replaced with a generic icon.
    (r'[ÃÂ][^\s<>"\'`=,;:()\[\]{}\u0000-\u001F]{1,10}', '<i class="fas fa-circle"></i>'),
    (r'ðŸ[^\s<>"\'`=,;:()\[\]{}\u0000-\u001F]{1,8}', '<i class="fas fa-circle"></i>'),
    (r'â[€-ÿ][€-ÿ]?[€-ÿ]?', ''),  # Strip remaining â+ bytes
]

total = 0
for dirpath, dirnames, filenames in os.walk(root):
    for filename in filenames:
        if not filename.endswith(('.html', '.js', '.css', '.json')):
            continue
        fp = os.path.join(dirpath, filename)
        try:
            with open(fp, 'r', encoding='utf-8') as f:
                c = f.read()
        except:
            print(f'SKIP: {fp}')
            continue
        original = c
        for pat, rep in patterns:
            c = re.sub(pat, rep, c)
        if c != original:
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(c)
            print(f'FIXED: {os.path.relpath(fp, root)}')
            total += 1

print(f'\nDone! Total files fixed: {total}')
