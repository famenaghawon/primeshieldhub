import csv
import requests
import time
import os
import json

# ============================================================
# CONFIGURATION - EDIT THESE
# ============================================================
API_KEY = "d9a5adba-8347-481b-bbd5-47a666e72af1"  # Replace with your actual key
CSV_FILE = "image-prompts.csv"
OUTPUT_DIR = "assets/products"
BATCH_SIZE = 5  # Generate 5 images at a time (free tier limit)
DELAY_BETWEEN_BATCHES = 60  # Seconds between batches (rate limiting)

# ============================================================
# SETUP
# ============================================================
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {
    "accept": "application/json",
    "content-type": "application/json",
    "authorization": f"Bearer {API_KEY}"
}

# Read CSV
with open(CSV_FILE, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    products = list(reader)

# Filter out already generated images
remaining = []
for p in products:
    filepath = os.path.join(OUTPUT_DIR, p['filename'])
    if not os.path.exists(filepath):
        remaining.append(p)

print(f"Total products: {len(products)}")
print(f"Already generated: {len(products) - len(remaining)}")
print(f"Remaining to generate: {len(remaining)}")
print(f"Estimated time: {(len(remaining) / BATCH_SIZE) * DELAY_BETWEEN_BATCHES / 60:.1f} minutes")
print("=" * 60)

# ============================================================
# FUNCTIONS
# ============================================================

def generate_image(prompt, filename):
    """Generate a single image using Leonardo.ai API"""
    
    payload = {
        "alchemy": True,
        "height": 800,
        "width": 800,
        "modelId": "6bef9f1b-29cb-40c7-b9df-32b51c1f67d3",  # Leonardo Diffusion XL
        "num_images": 1,
        "presetStyle": "LEONARDO",  # Photorealistic style
        "prompt": prompt,
        "negative_prompt": "text, watermark, logo, words, letters, hands, shadow, reflection, multiple products, people, background scene, blurry, low quality, distorted",
        "guidance_scale": 7,
        "sd_version": "SDXL_1_0",
        "highContrast": False,
        "contrastRatio": 0.5
    }
    
    # Step 1: Create generation
    response = requests.post(
        "https://cloud.leonardo.ai/api/rest/v1/generations",
        json=payload,
        headers=HEADERS
    )
    
    if response.status_code != 200:
        print(f"  ❌ API Error: {response.status_code} - {response.text[:200]}")
        return False
    
    generation_id = response.json()["sdGenerationJob"]["generationId"]
    print(f"  Generation ID: {generation_id}")
    
    # Step 2: Wait for generation to complete
    for attempt in range(30):  # 30 x 2 seconds = 60 seconds max wait
        time.sleep(2)
        status_response = requests.get(
            f"https://cloud.leonardo.ai/api/rest/v1/generations/{generation_id}",
            headers=HEADERS
        )
        
        if status_response.status_code == 200:
            status_data = status_response.json()
            status = status_data["generations_by_pk"]["status"]
            
            if status == "COMPLETE":
                # Step 3: Download the image
                image_url = status_data["generations_by_pk"]["generated_images"][0]["url"]
                img_response = requests.get(image_url)
                
                if img_response.status_code == 200:
                    filepath = os.path.join(OUTPUT_DIR, filename)
                    with open(filepath, "wb") as f:
                        f.write(img_response.content)
                    print(f"  ✅ Saved: {filename}")
                    return True
                else:
                    print(f"  ❌ Download failed: {img_response.status_code}")
                    return False
                    
            elif status == "FAILED":
                print(f"  ❌ Generation failed")
                return False
        else:
            print(f"  ⚠️ Status check error: {status_response.status_code}")
    
    print(f"  ⏰ Timeout waiting for generation")
    return False


def process_batch(batch_products):
    """Process a batch of products"""
    for i, product in enumerate(batch_products):
        print(f"\n[{i+1}/{len(batch_products)}] {product['filename']}")
        print(f"  Product: {product['product_name']}")
        print(f"  Category: {product['category']}")
        print(f"  Generating...")
        
        success = generate_image(product['prompt'], product['filename'])
        
        if success:
            # Small delay between individual generations
            time.sleep(3)
        else:
            print(f"  ⚠️ Skipping after failure")
            time.sleep(5)


# ============================================================
# MAIN EXECUTION
# ============================================================

print("\n🚀 Starting image generation...")
print("Press Ctrl+C to stop at any time (progress is saved)\n")

# Process in batches
for batch_start in range(0, len(remaining), BATCH_SIZE):
    batch = remaining[batch_start:batch_start + BATCH_SIZE]
    batch_num = (batch_start // BATCH_SIZE) + 1
    total_batches = (len(remaining) + BATCH_SIZE - 1) // BATCH_SIZE
    
    print(f"\n{'='*60}")
    print(f"BATCH {batch_num}/{total_batches}")
    print(f"Products {batch_start+1} to {min(batch_start+BATCH_SIZE, len(remaining))}")
    print(f"{'='*60}")
    
    process_batch(batch)
    
    # Check remaining
    still_remaining = []
    for p in remaining:
        filepath = os.path.join(OUTPUT_DIR, p['filename'])
        if not os.path.exists(filepath):
            still_remaining.append(p)
    remaining = still_remaining
    
    if batch_start + BATCH_SIZE < len(products):
        print(f"\n⏳ Waiting {DELAY_BETWEEN_BATCHES} seconds before next batch...")
        print(f"   Progress: {len(products) - len(remaining)}/{len(products)} images generated")
        time.sleep(DELAY_BETWEEN_BATCHES)

print(f"\n{'='*60}")
print(f"🎉 GENERATION COMPLETE!")
print(f"   Successfully generated: {len(products) - len(remaining)} images")
print(f"   Saved to: {OUTPUT_DIR}/")
print(f"{'='*60}")
