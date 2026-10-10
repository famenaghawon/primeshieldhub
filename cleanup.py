import os
import re

root_folder = r"C:\Users\myori\Desktop\primeshieldhub\frontend\public"

# ONLY these specific non-ASCII characters are "safe" — everything else
# that looks broken gets nuked. Safe chars: normal text, basic punctuation,
# the ₦, ★, ☆, →, ›, ·, —, –, •, …, ©, ™, ®, ×, ÷, °, and known good emojis
SAFE_PATTERN = re.compile(
    r'[a-zA-Z0-9\s\.\,\;\:\!\?\'\"\(\)\[\]\{\}\<\>\|\/\\\+\=\-\_\*\%\&\$\#\@\~'
    r'₦★☆→›·—–•…©™®×÷°½³'
    r'✅⭐🚀🔥💡📱📦📊📈📁📷📡📞📧📜💻💳💎🛡🛍🔄🔌🔊🔐🔧🔮🎧🎮🎯🎵🖥👤🤖🧪🚜🌟⚡✨☀❤⏱ℹ⬇▶️✏️✂️✔✓✕∞≥≤≈√£€₺'
    r']'
)

# Map known broken byte patterns to their correct emoji
FIXES = {
    # Category pill emojis
    'Ã¢Å“Â': '',       # broken fragment before Wearables - remove
    'Ã¢Å¡Â¡': '⚡',     # broken fragment before Gaming/Electronics  
    'Ã¢Â±Â': '📱',
    'Ã¢Â’Â': '💻',
    'Ã¢Â“Â±': '📱',
    'Ã¢Â”Â': '',
    'Ã¢Â•Â': '',
    'Ã¢Â—Â': '',
    'Ã¢Â™Â': '',
    
    # Search icon
    'Ã¢Å¾Â¡': '→',
    
    # Common broken fragments — strip them completely
    'Ã¢Å“Â': '',
    'Ã¢Å¡Â': '',
    'Ã¢Â': '',
    'Ã°Å¸': '',
    'Ã‚Â': '',
    'Ã£Â': '',
}

total = 0
for dirpath, dirnames, filenames in os.walk(root_folder):
    for filename in filenames:
        if not filename.endswith(('.html', '.js', '.css', '.json')):
            continue
        filepath = os.path.join(dirpath, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except:
            print(f'SKIPPED: {filepath}')
            continue
        
        original = content
        for broken, correct in FIXES.items():
            content = content.replace(broken, correct)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'CLEANED: {filepath}')
            total += 1

print(f'\nDone! Total files cleaned: {total}')
