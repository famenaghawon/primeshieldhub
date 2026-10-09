import requests
r = requests.get('https://api.primeshieldhub.com/api/products')
print(f"Products returned: {len(r.json())}")
print(f"Response size: {len(r.content)} bytes")
print(f"Content-Type: {r.headers.get('Content-Type')}")
print(f"CF-Cache-Status: {r.headers.get('CF-Cache-Status', 'N/A')}")
