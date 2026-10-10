import os
import re

root_folder = r"C:\Users\myori\Desktop\primeshieldhub\frontend\public"
found = {}

for dirpath, dirnames, filenames in os.walk(root_folder):
    for filename in filenames:
        if not filename.endswith(('.html', '.js', '.css', '.json')):
            continue
        filepath = os.path.join(dirpath, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except:
            continue
        
        # Find any sequence starting with the mojibake prefix characters
        # These are the "tell" characters that indicate corruption
        matches = re.findall(r'[ÃÂÂ£â€°Â°Å¾Å½Å¡Å“Â®Â©Â¿Â½][^\s<>"\'`=,;:()\[\]{}]{0,8}', content)
        for m in matches:
            found.setdefault(m, set()).add(filepath)

# Print results
print("=" * 70)
print("BROKEN SEQUENCES FOUND:")
print("=" * 70)
for seq, files in sorted(found.items(), key=lambda x: -len(x[1])):
    print(f'\n"{seq}"  (in {len(files)} file(s))')
    for f in list(files)[:3]:
        print(f'    - {os.path.relpath(f, root_folder)}')
    if len(files) > 3:
        print(f'    ... and {len(files) - 3} more')
