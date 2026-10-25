import requests
import csv
import os
import time
import json
from datetime import datetime

# ============================================================
# CONFIGURATION
# ============================================================
REPLICATE_API_TOKEN = "YOUR_REPLICATE_TOKEN_FROM_ENV"  # Paste your r8_ token here
CSV_FILE = "image-prompts.csv"
OUTPUT_DIR = "assets/products"

HEADERS = {
    "Authorization": f"Bearer {REPLICATE_API_TOKEN}",
    "Content-Type": "application/json",
    "Prefer": "wait"  # Wait for completion instead of polling
}

# ============================================================
# SETUP
# ============================================================
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Read CSV
with open(CSV_FILE, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    products = list(reader)

# Filter already generated
remaining = []
for p in products:
    filepath = os.path.join(OUTPUT_DIR, p['filename'])
    if not os.path.exists(filepath):
        remaining.append(p)

print("=" * 60)
print("REPLICATE.COM - DIRECT HTTP API GENERATION")
print("=" * 60)
print(f"Total products in CSV: {len(products)}")
print(f"Already generated: {len(products) - len(remaining)}")
print(f"Remaining to generate: {len(remaining)}")
print(f"Estimated cost: ${len(remaining) * 0.002:.2f} USD")
print(f"Estimated time: {len(remaining) * 5} seconds (~{len(remaining) * 5 / 60:.1f} minutes)")
print("=" * 60)

# Confirm
response = input("Start generation? (y/n): ")
if response.lower() != 'y':
    print("Cancelled.")
    exit()

# ============================================================
# MODEL VERSIONS (trying multiple in case one is slow)
# ============================================================
MODELS = [
    # SDXL Lightning - Fastest, ~2 sec/image
    {
        "version": "ac732df83cea7fff18b8472768c88ad041a75048176810ca16cb15a7d017dd63",
        "name": "SDXL Lightning (fastest)"
    },
    # Standard SDXL - ~5 sec/image
    {
        "version": "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        "name": "SDXL (standard)"
    }
]

CURRENT_MODEL = MODELS[0]  # Start with fastest
print(f"\nUsing model: {CURRENT_MODEL['name']}")

# ============================================================
# GENERATION FUNCTION
# ============================================================
def generate_image(prompt, filename, product_name):
    """Generate and download a single image"""
    
    input_params = {
        "prompt": prompt,
        "negative_prompt": "text, watermark, logo, words, letters, human, hands, shadow, reflection, multiple products, background scene, blurry, low quality, distorted, disfigured, signature, artist name",
        "width": 1024,
        "height": 1024,
        "num_outputs": 1,
        "num_inference_steps": 8,  # Lightning model: 4-8 steps is enough
        "guidance_scale": 1.5,     # Lightning model: 1-2 works best
        "scheduler": "K_EULER",
    }
    
    try:
        # Submit generation request
        response = requests.post(
            f"https://api.replicate.com/v1/models/stability-ai/sdxl/versions/{CURRENT_MODEL['version']}/predictions",
            headers=HEADERS,
            json={"input": input_params}
        )
        
        if response.status_code == 201:
            prediction = response.json()
            prediction_id = prediction["id"]
            
            # Poll for completion
            for attempt in range(60):  # Up to 60 seconds
                time.sleep(1)
                
                poll_response = requests.get(
                    f"https://api.replicate.com/v1/predictions/{prediction_id}",
                    headers={k: v for k, v in HEADERS.items() if k != "Prefer"}
                )
                
                if poll_response.status_code == 200:
                    status_data = poll_response.json()
                    status = status_data["status"]
                    
                    if status == "succeeded":
                        # Get image URL and download
                        output = status_data["output"]
                        image_url = output[0] if isinstance(output, list) else output
                        
                        img_response = requests.get(image_url)
                        if img_response.status_code == 200:
                            filepath = os.path.join(OUTPUT_DIR, filename)
                            with open(filepath, "wb") as f:
                                f.write(img_response.content)
                            return True, os.path.getsize(filepath) / 1024
                        else:
                            return False, f"Download failed: HTTP {img_response.status_code}"
                    
                    elif status == "failed":
                        return False, f"Generation failed: {status_data.get('error', 'Unknown')}"
                    
                    elif status == "canceled":
                        return False, "Generation canceled"
                
                # Show progress dot every 5 seconds
                if attempt % 5 == 0:
                    print(f"  ⏳ Waiting... ({attempt}s)", end="\r")
            
            return False, "Timeout after 60 seconds"
        else:
            return False, f"API Error: HTTP {response.status_code} - {response.text[:200]}"
    
    except Exception as e:
        return False, f"Exception: {str(e)[:200]}"


# ============================================================
# MAIN GENERATION LOOP
# ============================================================
success_count = 0
fail_count = 0
start_time = time.time()

for i, product in enumerate(remaining):
    filename = product['filename']
    prompt = product['prompt']
    product_name = product['product_name']
    
    print(f"\n[{i+1}/{len(remaining)}] {filename}")
    print(f"  Product: {product_name}")
    
    success, result = generate_image(prompt, filename, product_name)
    
    if success:
        file_size = result
        print(f"  ✅ Saved ({file_size:.0f} KB)")
        success_count += 1
    else:
        print(f"  ❌ {result}")
        fail_count += 1
    
    # Progress update
    elapsed = time.time() - start_time
    completed = i + 1
    rate = completed / elapsed if elapsed > 0 else 0
    eta = (len(remaining) - completed) / rate if rate > 0 else 0
    print(f"  📊 {success_count} ok, {fail_count} fail | {rate:.1f}/sec | ETA: {eta/60:.0f} min")

# ============================================================
# SUMMARY
# ============================================================
elapsed = time.time() - start_time

# Check final count
final_count = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith('.jpg')])

print(f"\n{'=' * 60}")
print(f"🎉 GENERATION COMPLETE!")
print(f"   ✅ Successful this run: {success_count}")
print(f"   ❌ Failed this run: {fail_count}")
print(f"   📁 Total images in folder: {final_count}")
print(f"   ⏱️  Time: {elapsed/60:.1f} minutes")
print(f"   💰 Estimated cost: ${success_count * 0.002:.2f} USD")
print(f"   📁 Output: {OUTPUT_DIR}/")
print(f"{'=' * 60}")

# Show remaining
still_remaining = []
for p in products:
    filepath = os.path.join(OUTPUT_DIR, p['filename'])
    if not os.path.exists(filepath):
        still_remaining.append(p['filename'])

if still_remaining:
    print(f"\n⚠️  {len(still_remaining)} products still need images.")
    print(f"   Run the script again to retry failed items.")
else:
    print(f"\n🎯 ALL {len(products)} IMAGES GENERATED SUCCESSFULLY!")
