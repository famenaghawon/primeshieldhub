# Save as check-routes.py
import re
js = open('route-expansions.js', 'r').read()
print(f"Length: {len(js)} chars")
limits = re.findall(r'limit|LIMIT|\.slice|\.splice|100|MAX_RESULTS|MAX_PRODUCTS', js, re.IGNORECASE)
print(f"Limit references: {limits[:10] if limits else 'NONE'}")
