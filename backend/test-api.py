import requests

r = requests.get('https://api.primeshieldhub.com/api/products?store=gadgets&limit=2000')
data = r.json()
products = data.get('products', data)  # handle both wrapped and unwrapped responses
print(f"Gadgets: {len(products)}")

r2 = requests.get('https://api.primeshieldhub.com/api/products?store=buildmart&limit=200')
data2 = r2.json()
products2 = data2.get('products', data2)
print(f"BuildMart: {len(products2)}")
