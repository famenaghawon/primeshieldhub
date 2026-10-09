import replicate
import requests
import csv
import os
import time
from datetime import datetime

# ============================================================
# CONFIGURATION
# ============================================================
REPLICATE_API_TOKEN = "YOUR_REPLICATE_TOKEN_FROM_ENV"  # Paste your r8_ token here
CSV_FILE = "image-prompts.csv"
OUTPUT_DIR = "assets/products"

# Model to use (SDXL is cheap and fast)
MODEL = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"

# ============================================================
# SETUP
# ============================================================
os.environ["YOUR_REPLICATE_TOKEN_FROM_ENV"] = REPLICATE_API_TOKEN
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
print("REPLICATE.COM - AUTOMATED IMAGE GENERATION")
print("=" * 60)
print(f"Total products in CSV: {len(products)}")
print(f"Already generated: {len(products) - len(remaining)}")
print(f"Remaining to generate: {len(remaining)}")
print(f"Estimated cost: ${len(remaining) * 0.002:.2f} USD (at $0.002/image)")
print(f"Estimated time: {len(remaining) * 3} seconds (~{len(remaining) * 3 / 60:.1f} minutes)")
print("=" * 60)
print("")

# Confirm
response = input("Start generation? (y/n): ")
if response.lower() != 'y':
    print("Cancelled.")
    exit()

# ============================================================
# GENERATION LOOP
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
    
    try:
        # Run the model
        output = replicate.run(
            MODEL,
            input={
                "prompt": prompt,
                "negative_prompt": "text, watermark, logo, words, letters, human, hands, shadow, reflection, multiple products, background scene, blurry, low quality, distorted, disfigured",
                "width": 1024,
                "height": 1024,
                "num_outputs": 1,
                "num_inference_steps": 25,
                "guidance_scale": 7.5,
                "refine": "expert_ensemble_refiner",
                "high_noise_frac": 0.8,
                "apply_watermark": False,
            }
        )
        
        # Download the image
        image_url = output[0] if isinstance(output, list) else output
        
        img_response = requests.get(image_url)
        if img_response.status_code == 200:
            filepath = os.path.join(OUTPUT_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(img_response.content)
            
            file_size = os.path.getsize(filepath) / 1024
            print(f"  ✅ Saved ({file_size:.0f} KB)")
            success_count += 1
        else:
            print(f"  ❌ Download failed: HTTP {img_response.status_code}")
            fail_count += 1
        
        # Progress update
        elapsed = time.time() - start_time
        rate = (i + 1) / elapsed if elapsed > 0 else 0
        eta = (len(remaining) - i - 1) / rate if rate > 0 else 0
        print(f"  📊 Progress: {success_count} ok, {fail_count} fail | Rate: {rate:.1f}/sec | ETA: {eta/60:.0f} min")
        
    except Exception as e:
        print(f"  ❌ Error: {str(e)[:200]}")
        fail_count += 1
        time.sleep(2)  # Brief pause on error

# ============================================================
# SUMMARY
# ============================================================
elapsed = time.time() - start_time
print(f"\n{'=' * 60}")
print(f"🎉 GENERATION COMPLETE!")
print(f"   ✅ Successful: {success_count}")
print(f"   ❌ Failed: {fail_count}")
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
    print(f"\n⚠️  {len(still_remaining)} products still need images:")
    for f in still_remaining[:10]:
        print(f"   - {f}")
    if len(still_remaining) > 10:
        print(f"   ... and {len(still_remaining) - 10} more")
    print(f"\n   Run the script again to retry failed items.")
