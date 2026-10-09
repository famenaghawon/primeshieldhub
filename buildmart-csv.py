# Save as buildmart-csv.py
import json

with open('buildmart-products.json', 'r') as f:
    products = json.load(f)

lines = ['filename,product_name,category,prompt']
for p in products:
    pid = p.get('id', '')
    name = p.get('name', '').replace('"', '""')
    category = p.get('category', '')
    prompt = f'Professional product photo of {p.get("name","")} on pure white background, studio lighting, e-commerce style, construction materials, no text, no watermark, photorealistic'
    lines.append(f'{pid}.webp,"{name}","{category}","{prompt}"')

with open('image-prompts-buildmart.csv', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'BuildMart CSV created with {len(products)} products')
