import json

with open("db-products.json", "r", encoding="utf-8") as f:
    data = json.load(f)

products = data[0]["results"]

csv_lines = ["filename,product_name,category,prompt"]

for p in products:
    pid = p["id"]
    name = p["name"]
    category = p["category"]
    filename = f"{pid}.webp"
    
    # Generate prompt from product name
    prompt = f"Professional product photo of {name} on pure white background, front view, studio lighting, e-commerce style, 800x800, no text, no watermark, photorealistic"
    
    # Escape quotes in name and prompt
    name_escaped = name.replace('"', '""')
    prompt_escaped = prompt.replace('"', '""')
    
    csv_lines.append(f'{filename},"{name_escaped}","{category}","{prompt_escaped}"')

with open("image-prompts-1000.csv", "w", encoding="utf-8") as f:
    f.write("\n".join(csv_lines))

print(f"Created CSV with {len(products)} products")
