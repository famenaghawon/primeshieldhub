import csv

# Top 30 priority products for your storefront
PRIORITY_PRODUCTS = [
    "apple-iphone-16-pro-max-256gb.jpg",
    "samsung-galaxy-s25-ultra-1tb.jpg",
    "tecno-pop-20-4gb-64gb.jpg",
    "infinix-smart-20-4gb-64gb.jpg",
    "samsung-galaxy-a07-4gb-128gb.jpg",
    "apple-airpods-pro-2nd-gen-usb-c.jpg",
    "oraimo-spacebuds-neo.jpg",
    "jbl-go-4-portable-speaker.jpg",
    "apple-macbook-air-m3-16gb-256gb.jpg",
    "hp-15s-i5-12th-8gb-512gb.jpg",
    "anker-prime-20k-powerbank.jpg",
    "oraimo-powerbox-20000.jpg",
    # Add more priority filenames...
]

# Read CSV and filter for priority items
with open("image-prompts.csv", "r") as f:
    reader = csv.DictReader(f)
    all_products = list(reader)

priority_list = [p for p in all_products if p['filename'] in PRIORITY_PRODUCTS]
print(f"Priority products to generate: {len(priority_list)}")
# Feed priority_list to the same generation function
