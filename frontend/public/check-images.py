
import requests

r = requests.get('https://api.primeshieldhub.com/api/products')
data = r.json()

print(f"Total products: {len(data)}")

missing = [p for p in data if not p.get('image_url') or p.get('image_url') == '']
print(f"Missing image_url: {len(missing)}")

if missing:
    for p in missing[:10]:
        print(f"  {p['id']}: {p['name'][:60]}")
