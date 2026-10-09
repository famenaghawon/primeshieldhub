import csv, os

os.chdir(r'C:\Users\myori\Desktop\primeshieldhub')

products = list(csv.DictReader(open('image-prompts-all.csv', 'r')))
existing = set(os.listdir('assets/products'))
missing = [p for p in products if p['filename'] not in existing]

print(f"Missing images: {len(missing)} / {len(products)}")
if missing:
    print("\nFirst 20 missing:")
    for p in missing[:20]:
        print(f"  {p['filename']}")
