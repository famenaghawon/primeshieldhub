import json

with open('all-gadgets.json', 'rb') as f:
    raw = f.read()

# Try different encodings and formats
data = None
for enc in ['utf-8-sig', 'utf-8', 'utf-16', 'latin-1']:
    try:
        decoded = raw.decode(enc)
        data = json.loads(decoded)
        break
    except:
        continue

if data is None:
    print("Could not decode JSON. Trying API...")
    import requests
    r = requests.get('https://api.primeshieldhub.com/api/products?store=gadgets&limit=3000')
    data = r.json()
    products = data.get('products', data)
else:
    # Handle both formats
    if isinstance(data, list) and len(data) > 0 and 'results' in data[0]:
        products = data[0]['results']
    elif isinstance(data, dict) and 'products' in data:
        products = data['products']
    elif isinstance(data, list):
        products = data
    else:
        print(f"Unknown format: {type(data)}")
        print(data.keys() if isinstance(data, dict) else data[:2])
        exit()

lines = ['filename,product_name,category,prompt']
for p in products:
    pid = p.get('id', '')
    name = p.get('name', '').replace('"', '""')
    category = p.get('category', '')
    prompt = f'Professional product photo of {p.get("name","")} on pure white background, studio lighting, e-commerce style, no text, no watermark, photorealistic'
    lines.append(f'{pid}.webp,"{name}","{category}","{prompt}"')

with open('image-prompts-all.csv', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'CSV created with {len(products)} products')
