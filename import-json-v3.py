"""
PrimeShieldHub JSON Product Importer v3
Supports: sku column, specifications column, clean descriptions
"""

import json
import subprocess
import sys
import os
import re

def slugify(sku):
    """Use SKU as base for ID, lowercased"""
    return sku.lower().replace(' ', '-').replace('/', '-')

def map_category(category):
    cat = category.lower().strip()
    mapping = {
        'headphones': 'audio',
        'over-ear headphones': 'audio',
        'portable speakers': 'audio',
        'party speakers': 'audio',
        'premium speakers': 'audio',
        'bluetooth speakers': 'audio',
        'wired earphones': 'audio',
        'wired headsets': 'audio',
        'true wireless earbuds': 'audio',
        'power banks': 'power',
        'portable power': 'power-stations',
        'wall chargers': 'chargers',
        'gan chargers': 'chargers',
        'multi-port chargers': 'chargers',
        'charging cables': 'accessories',
        'charging accessories': 'chargers',
        'grooming': 'personal-care',
        'hair clippers': 'personal-care',
        'smartwatches': 'wearables',
        'smartphones': 'smartphones',
        'gaming consoles': 'gaming',
        'tablets': 'tablets',
        'led lighting': 'smart-lighting',
        'led bulbs': 'smart-lighting',
        'rechargeable led bulbs': 'smart-lighting',
        'rechargeable flashlights': 'smart-lighting',
        'rechargeable fans': 'appliances',
        'photo & video lighting': 'accessories',
        'tripods & selfie sticks': 'accessories',
        'travel adapters': 'accessories',
        'usb flash drives': 'storage',
        'storage': 'storage',
        'cables': 'accessories',
        'hdmi accessories': 'accessories',
        'electrical accessories': 'accessories',
        'power protection': 'accessories',
        'lighting accessories': 'accessories',
        'stationery': 'accessories',
    }
    return mapping.get(cat, 'accessories')

def clean_text(text):
    """Remove problematic characters"""
    if not text:
        return ''
    text = text.replace('\u2013', '-')
    text = text.replace('\u2014', '-')
    text = text.replace('\u2018', "'")
    text = text.replace('\u2019', "'")
    text = text.replace('\u201c', '"')
    text = text.replace('\u201d', '"')
    text = text.replace('\u00d7', 'x')
    text = text.replace('\u2026', '...')
    text = re.sub(r'[^\x00-\x7F]+', '', text)
    return text

def main():
    if len(sys.argv) < 2:
        print("Usage: python import-json-v3.py your-products.json")
        sys.exit(1)
    
    json_file = sys.argv[1]
    print(f"Loading {json_file}...")
    
    with open(json_file, 'r', encoding='utf-8') as f:
        raw_products = json.load(f)
    
    print(f"Found {len(raw_products)} products")
    
    lines = []
    now = "1718400000"
    
    for p in raw_products:
        sku = clean_text(p.get('sku', ''))
        pid = slugify(sku) if sku else slugify(clean_text(p.get('product_name', '')))
        name = clean_text(p.get('product_name', '')).replace("'", "''")
        brand = clean_text(p.get('brand', 'Generic')).replace("'", "''")
        category = map_category(p.get('category', ''))
        price = int(p.get('recommended_retail_price_ngn', p.get('price', 0)))
        wholesale = int(price * 0.85)
        reseller = int(price * 0.92)
        desc = clean_text(p.get('description', ''))
        specs = clean_text(p.get('specifications', ''))
        
        # Build clean description with specs
        if specs:
            spec_items = [s.strip() for s in specs.split(';') if s.strip()]
            spec_text = '\n'.join([f'• {s}' for s in spec_items])
            full_desc = f"{desc}\n\nKey Specifications\n\n{spec_text}"
        else:
            full_desc = desc
        
        desc_sql = full_desc.replace("'", "''")
        specs_sql = specs.replace("'", "''")
        image_url = f'/assets/products/{pid.lower()}.webp'
        slug_sql = pid.lower()
        
        sql = f"""INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt, wholesale_available, wholesale_price, image_url, reseller_price, rating, featured, brand, is_bestseller, is_new, store_type, specifications, sku, slug) VALUES ('{pid.lower()}', '{name}', '{category}', {price}, {price}, {wholesale}, 10, 0.2, '{image_url}', '{desc_sql}', 1, {now}, 1, {wholesale}, '{image_url}', {reseller}, 4.5, 0, '{brand}', 0, 1, 'gadgets', '{specs_sql}', '{sku.lower()}', '{slug_sql}');"""
        lines.append(sql)
    
    sql_content = '\n\n'.join(lines)
    sql_file = f"import-v3-{os.path.basename(json_file).replace('.json','')}.sql"
    
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    
    print(f"Generated {sql_file} with {len(lines)} products")
    print(f"\nRun: npx wrangler d1 execute primeshieldhub-db --remote --file={sql_file}")

if __name__ == "__main__":
    main()
