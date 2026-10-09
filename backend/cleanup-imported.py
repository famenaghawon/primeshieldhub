import requests

r = requests.get('https://api.primeshieldhub.com/api/products?store=gadgets&limit=5000')
data = r.json()
products = data.get('products', data)

# Products we imported from JSON
imported_ids = [
    'jbl-tune-770nc','jbl-flip-6','jbl-flip-7','jbl-pb110','jbl-pb310','jbl-pb320',
    'jbl-pb-encore','jbl-pb-otg','jbl-audio-other','hk-onyx9-blk','hk-onyx9-gry',
    'itel-pb-60000','itel-star200-20k','itel-powerlite-10k','itel-pb-20k',
    'itel-iess-320t','itel-18w-tc','itel-clipper-c3','itel-watch-pro','itel-smartwatch-1',
    'conch2-oep-e11','apple-airpods-max','gen-25w-iphone','gen-50w-iphone',
    'iph17pm-512-act','iph17pm-256-act','iph17pm-256-na','iph15-128',
    'iph14pro-128','iph14pm-256','iph12-128','sony-ps5-slim','modio-m47',
    'led-rgb-strip','apple-magsafe-duo','hdd-1tb-usb3','usb-c-3pk-2m','hdmi-3x1-4k'
]

cleanup_sql = []

# Delete placeholder
cleanup_sql.append("DELETE FROM products WHERE id = 'jbl-audio-other';")

# Clean descriptions — remove everything after "For PRIMESHIELDHUB" if it contains pricing notes
for p in products:
    if p.get('id') in imported_ids:
        pid = p['id']
        desc = p.get('description', '')
        name = p.get('name', '')
        
        # Find "For PRIMESHIELDHUB" and cut from there
        idx = desc.find('For PRIMESHIELDHUB')
        if idx > 0:
            clean_desc = desc[:idx].strip()
        else:
            clean_desc = desc
        
        clean_desc_sql = clean_desc.replace("'", "''")
        cleanup_sql.append(f"UPDATE products SET description = '{clean_desc_sql}' WHERE id = '{pid}';")

with open('cleanup-imported.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(cleanup_sql))

print(f"Generated {len(cleanup_sql)} cleanup queries")
print(f"  - DELETE placeholder (jbl-audio-other)")
print(f"  - UPDATE descriptions for {len(cleanup_sql)-1} products")
