"""
PrimeShieldHub JSON Product Importer v2
Handles the exact JSON format provided: brand, category, product_name, sku, description, specifications, recommended_retail_price_ngn
"""

import json
import subprocess
import sys
import os
import re
import uuid

def slugify(name):
    """Convert product name to a clean ID"""
    slug = name.lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    slug = slug[:50].strip('-')
    return slug or str(uuid.uuid4())[:8]

def map_category(category):
    """Map JSON categories to store categories"""
    cat = category.lower().strip()
    mapping = {
        'headphones': 'audio',
        'portable speakers': 'audio',
        'party speakers': 'audio',
        'premium speakers': 'audio',
        'wired earphones': 'audio',
        'power banks': 'power',
        'portable power': 'power-stations',
        'chargers': 'chargers',
        'charging accessories': 'chargers',
        'grooming': 'personal-care',
        'smartwatches': 'wearables',
        'smartphones': 'smartphones',
        'gaming consoles': 'gaming',
        'tablets': 'tablets',
        'led lighting': 'smart-lighting',
        'storage': 'storage',
        'cables': 'accessories',
        'hdmi accessories': 'accessories',
    }
    return mapping.get(cat, 'accessories')

def build_description(product):
    """Build sophisticated description from JSON fields"""
    brand = product.get('brand', 'Premium')
    name = product.get('product_name', '')
    desc = product.get('description', '')
    specs = product.get('specifications', '')
    price = product.get('recommended_retail_price_ngn', 0)
    sku = product.get('sku', '')
    pricing_note = product.get('pricing_note', '')
    
    # Format specifications into bullet points
    if specs:
        spec_items = [f"• {s.strip()}" for s in specs.split(';') if s.strip()]
        spec_section = "\n".join(spec_items)
    else:
        spec_section = "• Premium quality construction\n• Reliable performance\n• Full manufacturer warranty"
    
    full_desc = f"""{name}

{desc}

Key Specifications

{spec_section}

Features

✅ Premium {brand} quality and craftsmanship
✅ Designed for everyday Nigerian conditions
✅ Competitive pricing with authentic warranty
✅ Nationwide delivery available

Why Choose This Product

• Trusted {brand} engineering and reliability
• Exceptional value at ₦{price:,} retail
• Backed by PrimeShieldHub authenticity guarantee
• Comprehensive after-sales support

For PRIMESHIELDHUB

This {name} delivers outstanding performance at a competitive price point. PrimeShieldHub guarantees 100% authenticity with full manufacturer warranty and our signature Quantum Delivery across all 36 states in Nigeria and the FCT. {pricing_note}"""
    
    return full_desc

def normalize_product(raw, index):
    """Convert JSON product to standard structure"""
    name = raw.get('product_name') or raw.get('name') or f'Product {index}'
    brand = raw.get('brand', 'Generic')
    category_raw = raw.get('category', 'accessories')
    category = map_category(category_raw)
    sku = raw.get('sku', '')
    price = int(raw.get('recommended_retail_price_ngn', 0))
    
    # Generate ID from SKU if available, otherwise slugify
    if sku:
        pid = sku.lower().replace(' ', '-').replace('/', '-')
    else:
        pid = slugify(name)
    
    # Calculate pricing tiers
    wholesale_price = int(price * 0.85)
    reseller_price = int(price * 0.92)
    
    # Build sophisticated description
    description = build_description(raw)
    
    image_url = f'/assets/products/{pid}.webp'
    
    return {
        'id': pid,
        'name': name,
        'category': category,
        'basePrice': price,
        'price': price,
        'wholesalePrice': wholesale_price,
        'stock': 10,
        'weightKg': 0.2,
        'image': image_url,
        'description': description,
        'active': 1,
        'wholesale_available': 1,
        'wholesale_price': wholesale_price,
        'image_url': image_url,
        'reseller_price': reseller_price,
        'rating': 4.5,
        'featured': 0,
        'brand': brand,
        'is_bestseller': 0,
        'is_new': 1,
        'store_type': 'gadgets',
    }

def generate_sql(products):
    """Generate SQL INSERT OR REPLACE statements"""
    lines = []
    now = "1718400000"
    
    for p in products:
        desc = p['description'].replace("'", "''")
        name = p['name'].replace("'", "''")
        brand = p['brand'].replace("'", "''")
        
        sql = f"""INSERT OR REPLACE INTO products (
    id, name, category, basePrice, price, wholesalePrice, stock, weightKg,
    image, description, active, createdAt, wholesale_available, wholesale_price,
    image_url, reseller_price, rating, featured, brand, is_bestseller, is_new, store_type
) VALUES (
    '{p['id']}', '{name}', '{p['category']}', {p['basePrice']}, {p['price']},
    {p['wholesalePrice']}, {p['stock']}, {p['weightKg']}, '{p['image']}',
    '{desc}', {p['active']}, {now}, {p['wholesale_available']}, {p['wholesale_price']},
    '{p['image_url']}', {p['reseller_price']}, {p['rating']}, {p['featured']},
    '{brand}', {p['is_bestseller']}, {p['is_new']}, '{p['store_type']}'
);"""
        lines.append(sql)
    
    return '\n\n'.join(lines)

def main():
    if len(sys.argv) < 2:
        print("Usage: python import-json-products.py your-products.json")
        print("       or: python import-json-products.py your-products.json --store=buildmart")
        sys.exit(1)
    
    json_file = sys.argv[1]
    store_type = 'gadgets'
    
    for arg in sys.argv[2:]:
        if arg.startswith('--store='):
            store_type = arg.split('=')[1]
    
    print(f"Loading {json_file}...")
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, list):
        raw_products = data
    elif isinstance(data, dict) and 'products' in data:
        raw_products = data['products']
    else:
        raw_products = data
    
    print(f"Found {len(raw_products)} products")
    
    products = []
    for i, raw in enumerate(raw_products):
        p = normalize_product(raw, i)
        p['store_type'] = store_type
        products.append(p)
    
    # Generate SQL
    sql = generate_sql(products)
    sql_file = f"import-{os.path.basename(json_file).replace('.json','')}.sql"
    
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write(sql)
    print(f"Generated {sql_file} with {len(products)} products")
    
    # Execute
    print(f"\nImporting to D1 (store_type: {store_type})...")
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "primeshieldhub-db", "--remote", f"--file={sql_file}"],
        capture_output=True, text=True, shell=True
    )
    
    if result.returncode == 0:
        print("✅ Import successful!")
    else:
        print("❌ Import failed:")
        print(result.stderr[:1000] if result.stderr else result.stdout[:1000])
    
    # Summary
    print(f"\n{'='*50}")
    print(f"IMPORT SUMMARY")
    print(f"{'='*50}")
    print(f"  Total products: {len(products)}")
    print(f"  Store type: {store_type}")
    print(f"  SQL file: {sql_file}")
    categories = set(p['category'] for p in products)
    print(f"  Categories: {len(categories)}")
    for c in sorted(categories):
        count = sum(1 for p in products if p['category'] == c)
        print(f"    {c}: {count}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
