import requests

r = requests.get('https://api.primeshieldhub.com/api/products?store=gadgets&limit=2000')
data = r.json()
products = data.get('products', data)

for p in products:
    url = 'https://primeshieldhub.com' + p['image_url']
    status = requests.get(url).status_code
    if status == 404:
        print(f"404: {p['image_url']} — {p['name'][:60]}")
