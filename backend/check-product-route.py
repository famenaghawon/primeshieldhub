# Save as check-product-route.py
import re
js = open('src/index.js', 'r').read()
# Find the products route handler section
idx = js.find('/api/products')
print(js[idx:idx+500])
