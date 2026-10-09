import requests, csv

# Fetch ALL products directly from API
r = requests.get('https://api.primeshieldhub.com/api/products?store=gadgets&limit=5000')
data = r.json()
products = data.get('products', data)
print(f"API returned: {len(products)} products")

# Also fetch buildmart
r2 = requests.get('https://api.primeshieldhub.com/api/products?store=buildmart&limit=500')
data2 = r2.json()
products2 = data2.get('products', data2)
print(f"BuildMart: {len(products2)} products")

all_products = products + products2
print(f"Total: {len(all_products)}")

lines = ['filename,product_name,category,prompt']
for p in all_products:
    pid = p.get('id', '')
    name = p.get('name', '').replace('"', '""')
    category = p.get('category', '')
    prompt = f'Professional product photo of {p.get("name","")} on pure white background, studio lighting, e-commerce style, no text, no watermark, photorealistic'
    lines.append(f'{pid}.webp,"{name}","{category}","{prompt}"')

with open('image-prompts-all.csv', 'w', encoding='utf-8', newline='') as f:
    f.write('\n'.join(lines))

print(f'CSV created with {len(all_products)} products')
