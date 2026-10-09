import json, os

with open('db-ids.json', 'rb') as f:
    raw = f.read()

data = json.loads(raw.decode('utf-8'))
products = data[0]['results']
files = set(os.listdir('assets/products'))

mismatches = [p for p in products if p['id'] + '.webp' not in files]

print(f"Products with mismatched images: {len(mismatches)}")
for p in mismatches:
    print(f"  {p['id']}.webp — {p['name'][:80]}")
