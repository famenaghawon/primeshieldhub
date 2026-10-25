import requests
import csv
import os
import time
import json

# ============================================================
# PASTE YOUR REPLICATE TOKEN HERE
# ============================================================
REPLICATE_API_TOKEN = "YOUR_REPLICATE_TOKEN_FROM_ENV"

# ============================================================
# SETUP
# ============================================================
CSV_FILE = "image-prompts.csv"
OUTPUT_DIR = "assets/products"
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {
    "Authorization": f"Bearer {REPLICATE_API_TOKEN}",
    "Content-Type": "application/json"
}

# Verify token first
print("Verifying API token...")
me = requests.get("https://api.replicate.com/v1/account", headers=HEADERS)
if me.status_code != 200:
    print(f"âŒ INVALID TOKEN: {me.status_code} - {me.text[:200]}")
    print("\nGet your token at: https://replicate.com/account/api-tokens")
    print("It should look like: r8_xxxxxxxxxxxxxxxxxxxx")
    exit(1)
print(f"âœ… Token valid â€” Account: {me.json().get('username', 'Unknown')}")

# Read CSV
with open(CSV_FILE, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    products = list(reader)

# Filter remaining
remaining = [p for p in products if not os.path.exists(os.path.join(OUTPUT_DIR, p['filename']))]

print(f"\n{'=' * 60}")
print(f"ðŸŽ  HAPPYHORSE IMAGE GENERATOR")
print(f"{'=' * 60}")
print(f"Total products: {len(products)}")
print(f"Already generated: {len(products) - len(remaining)}")
print(f"Remaining: {len(remaining)}")
print(f"Model: alibaba-pai/HappyHorse-1.0 (SDXL Lightning)")
print(f"Speed: ~2-3 seconds per image")
print(f"Cost: $0.002/image = ~${len(remaining) * 0.002:.2f} total")
print(f"Estimated time: {len(remaining) * 3 / 60:.0f} minutes")
print(f"{'=' * 60}")

response = input("\nStart? (y/n): ")
if response.lower() != 'y':
    exit()

# ============================================================
# GENERATION
# ============================================================
success = 0
failed = 0
start = time.time()

for i, product in enumerate(remaining):
    filename = product['filename']
    prompt = product['prompt']
    
    print(f"\n[{i+1}/{len(remaining)}] {filename}")
    
    try:
        # HappyHorse model - optimized for product photos
        resp = requests.post(
            "https://api.replicate.com/v1/models/alibaba-pai/happyhorse-sdxl-lightning/predictions",
            headers=HEADERS,
            json={
                "input": {
                    "prompt": prompt + ", product photography, white background, studio lighting, 8k, highly detailed",
                    "negative_prompt": "text, watermark, logo, signature, brand name, letters, words, human, person, hands, fingers, shadow, reflection, multiple items, messy, blurry, low quality, distorted, disfigured, ugly, grainy",
                    "width": 1024,
                    "height": 1024,
                    "num_outputs": 1,
                    "num_inference_steps": 4,
                    "guidance_scale": 1.0,
                }
            }
        )
        
        if resp.status_code == 201:
            prediction_id = resp.json()["id"]
            
            # Wait for completion
            for attempt in range(60):
                time.sleep(0.5)
                
                poll = requests.get(
                    f"https://api.replicate.com/v1/predictions/{prediction_id}",
                    headers=HEADERS
                )
                
                if poll.status_code == 200:
                    data = poll.json()
                    status = data["status"]
                    
                    if status == "succeeded":
                        image_url = data["output"]
                        if isinstance(image_url, list):
                            image_url = image_url[0]
                        
                        # Download
                        img_data = requests.get(image_url)
                        if img_data.status_code == 200:
                            filepath = os.path.join(OUTPUT_DIR, filename)
                            with open(filepath, "wb") as f:
                                f.write(img_data.content)
                            size = os.path.getsize(filepath) / 1024
                            print(f"  âœ… Saved ({size:.0f} KB) â€” {attempt * 0.5:.0f}s")
                            success += 1
                        else:
                            print(f"  âŒ Download failed")
                            failed += 1
                        break
                    
                    elif status == "failed":
                        print(f"  âŒ {data.get('error', 'Unknown error')[:150]}")
                        failed += 1
                        break
                    
                    elif status == "processing" and attempt % 4 == 0:
                        print(f"  â³ Generating{'.' * (attempt // 4 % 4)}", end="\r")
            
            else:
                print(f"  â° Timeout")
                failed += 1
        
        elif resp.status_code == 429:
            print(f"  âš ï¸ Rate limited â€” waiting 10s")
            time.sleep(10)
            failed += 1
        
        elif resp.status_code == 401:
            print(f"  âŒ Auth failed â€” check your token")
            print(f"  Get it at: https://replicate.com/account/api-tokens")
            exit(1)
        
        else:
            error_msg = resp.json().get("detail", resp.text[:150])
            print(f"  âŒ HTTP {resp.status_code}: {error_msg}")
            failed += 1
    
    except KeyboardInterrupt:
        print(f"\n\nâ¸ï¸  PAUSED â€” {success} images generated so far")
        print(f"   Run the script again to continue where you left off.")
        exit(0)
    
    except Exception as e:
        print(f"  âŒ Error: {str(e)[:150]}")
        failed += 1
    
    # Progress
    elapsed = time.time() - start
    done = success + failed
    rate = done / elapsed if elapsed > 0 else 0
    eta = (len(remaining) - i - 1) / rate if rate > 0 else 0
    print(f"  ðŸ“Š {success}âœ“ {failed}âœ— | {rate:.1f}/sec | ETA: {eta/60:.0f}min")

# ============================================================
# SUMMARY
# ============================================================
elapsed = time.time() - start
total = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith('.jpg')])

print(f"\n{'=' * 60}")
print(f"ðŸŽ‰ COMPLETE!")
print(f"  âœ… Generated: {success}")
print(f"  âŒ Failed: {failed}")
print(f"  ðŸ“ Total images: {total}/{len(products)}")
print(f"  â±ï¸  Time: {elapsed/60:.1f} min")
print(f"  ðŸ’° Cost: ~${success * 0.002:.2f}")
print(f"{'=' * 60}")

if total < len(products):
    print(f"\nâš ï¸  {len(products) - total} images still needed.")
    print(f"   Run the script again to get remaining ones.")


