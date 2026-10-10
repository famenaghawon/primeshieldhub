import os, re

root = r"C:\Users\myori\Desktop\primeshieldhub\frontend\public"

# Order matters — most specific first
patterns = [
    # Currency & punctuation (restore to correct characters)
    (r' ₦', '₦'), (r'£', '£'), (r'â‚¬', '€'), (r'©', '©'), (r'®', '®'),
    (r' —', '—'), (r' —', '–'), (r'"', '"'), (r'"', '"'), (r'"™', "'"),
    (r'"¦', '…'), (r'"¢', '•'), (r'.', '·'), (r'"º', '›'),
    (r'Ã¢"šÂ¬', '€'), (r'Ã¢ —Â', '•'), (r'Ã¢"Âº', '›'),
    
    # Common emojis — replace with Font Awesome icon HTML
    (r'<i class="fas fa-mobile-alt"></i>', '<i class="fas fa-mobile-alt"></i>'),
    (r'<i class="fas fa-laptop"></i>', '<i class="fas fa-laptop"></i>'),
    (r'<i class="fas fa-box"></i>', '<i class="fas fa-box"></i>'),
    (r'<i class="fas fa-rocket"></i><i class="fas fa-rocket"></i>', '<i class="fas fa-rocket"></i>'),
    (r'<i class="fas fa-shopping-cart"></i>', '<i class="fas fa-shopping-cart"></i>'),
    (r'<i class="fas fa-fire"></i>', '<i class="fas fa-fire"></i>'),
    (r'<i class="fas fa-check"></i>', '<i class="fas fa-check-circle"></i>'),
    (r'<i class="fas fa-star"></i>', '<i class="fas fa-star"></i>'),
    (r'<i class="fas fa-star"></i>', '<i class="fas fa-star"></i>'),
    (r' <i class="fas fa-bullhorn"></i>', '<i class="fas fa-bullhorn"></i>'),
    (r' <i class="fas fa-lightbulb"></i>
', '<i class="fas fa-lightbulb"></i>'),
    (r'<i class="fas fa-chart-bar"></i>', '<i class="fas fa-chart-bar"></i>'),
    (r'ðŸ“ˆ', '<i class="fas fa-chart-line"></i>'),
    (r'<i class="fas fa-lock"></i>', '<i class="fas fa-lock"></i>'),
    (r'<i class="fas fa-shield-alt"></i>', '<i class="fas fa-shield-alt"></i>'),
    (r'<i class="fas fa-bolt"></i>', '<i class="fas fa-bolt"></i>'),
    (r'<i class="fas fa-user"></i>', '<i class="fas fa-user"></i>'),
    (r'<i class="fas fa-envelope"></i>', '<i class="fas fa-envelope"></i>'),
    (r'<i class="fas fa-phone"></i>', '<i class="fas fa-phone"></i>'),
    (r'<i class="fas fa-credit-card"></i>', '<i class="fas fa-credit-card"></i>'),
    (r'<i class="fas fa-robot"></i>', '<i class="fas fa-robot"></i>'),
    (r' <i class="fas fa-bullseye"></i>', '<i class="fas fa-bullseye"></i>'),
    (r'<i class="fas fa-truck"></i>', '<i class="fas fa-truck"></i>'),
    (r'<i class="fas fa-bell"></i>', '<i class="fas fa-bell"></i>'),
    (r'<i class="fas fa-search"></i>', '<i class="fas fa-search"></i>'),
    (r'<i class="fas fa-sparkles"></i>', '<i class="fas fa-star"></i>'),
    
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
