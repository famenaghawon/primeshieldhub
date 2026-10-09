import requests

r = requests.get('https://api.primeshieldhub.com/api/products?store=gadgets&limit=2000')
data = r.json()
products = data.get('products', data)  # handle both formats

print(f"Total products: {len(products)}")

missing = [p for p in products if not p.get('image_url') or p.get('image_url') == '']
print(f"Missing image_url: {len(missing)}")

if missing:
    for p in missing[:10]:
        print(f"  {p['id']}: {p['name'][:60]}")
