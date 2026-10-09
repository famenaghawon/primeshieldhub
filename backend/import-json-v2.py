# Save as import-json-v2.py
import json
import subprocess
import sys
import os
import re

def slugify(sku):
    """Use SKU as ID, lowercased"""
    return sku.lower().replace(' ', '-').replace('/', '-')

def map_category(category):
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

def build_clean_description(desc, specs):
    """Build clean description WITHOUT pricing notes or promo blocks"""
    # Format specifications
    if specs:
        spec_items = [s.strip() for s in specs.split(';') if s.strip()]
        spec_text = '\n'.join([f'• {s}' for s in spec_items])
    else:
        spec_text = '• Premium quality construction'
    
    clean = f"{desc}\n\nKey Specifications\n\n{spec_text}"
    return clean

def main():
    if len(sys.argv) < 2:
        print("Usage: python import-json-v2.py your-products.json")
        sys.exit(1)
    
    json_file = sys.argv[1]
    
    print(f"Loading {json_file}...")
    with open(json_file, 'r', encoding='utf-8') as f:
        raw_products = json.load(f)
    
    print(f"Found {len(raw_products)} products")
    
    lines = []
    now = "1718400000"
    
    for p in raw_products:
        pid = slugify(p.get('sku', ''))
        name = p.get('product_name', '').replace("'", "''")
        brand = p.get('brand', 'Generic').replace("'", "''")
        category = map_category(p.get('category', ''))
        price = int(p.get('recommended_retail_price_ngn', 0))
        wholesale = int(price * 0.85)
        reseller = int(price * 0.92)
        desc = build_clean_description(p.get('description', ''), p.get('specifications', ''))
        desc_sql = desc.replace("'", "''")
        image_url = f'/assets/products/{pid}.webp'
        
        sql = f"""INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt, wholesale_available, wholesale_price, image_url, reseller_price, rating, featured, brand, is_bestseller, is_new, store_type) VALUES ('{pid}', '{name}', '{category}', {price}, {price}, {wholesale}, 10, 0.2, '{image_url}', '{desc_sql}', 1, {now}, 1, {wholesale}, '{image_url}', {reseller}, 4.5, 0, '{brand}', 0, 1, 'gadgets');"""
        lines.append(sql)
    
    sql_content = '\n\n'.join(lines)
    sql_file = f"import-clean-{os.path.basename(json_file).replace('.json','')}.sql"
    
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    
    print(f"Generated {sql_file}")
    
    # Execute
    print("Importing...")
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "primeshieldhub-db", "--remote", f"--file={sql_file}"],
        capture_output=True, text=True, shell=True
    )
    
    if result.returncode == 0:
        print("✅ Import successful!")
    else:
        print("❌ Import failed:")
        print(result.stderr[:500] if result.stderr else result.stdout[:500])
    
    print(f"\nImported {len(lines)} products with CLEAN descriptions")

if __name__ == "__main__":
    main()
