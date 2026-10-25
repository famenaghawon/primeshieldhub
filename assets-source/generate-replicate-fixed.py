import requests
import csv
import os
import time

# ============================================================
# CONFIGURATION
# ============================================================
REPLICATE_API_TOKEN = "YOUR_REPLICATE_TOKEN_FROM_ENV"  # Your r8_ token
CSV_FILE = "image-prompts.csv"
OUTPUT_DIR = "assets/products"

HEADERS = {
    "Authorization": f"Bearer {REPLICATE_API_TOKEN}",
    "Content-Type": "application/json"
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
print("REPLICATE.COM - FIXED VERSION")
print("=" * 60)
print(f"Total products: {len(products)}")
print(f"Already generated: {len(products) - len(remaining)}")
print(f"Remaining: {len(remaining)}")
print("=" * 60)
print("")
print("NOTE: Free accounts get 6 requests/minute.")
print(f"This will take about {len(remaining) / 6:.0f} minutes.")
print("The script handles rate limiting automatically.")
print("")

response = input("Start generation? (y/n): ")
if response.lower() != 'y':
    exit()

# ============================================================
# GENERATION
# ============================================================
success_count = 0
fail_count = 0
start_time = time.time()

# Track requests for rate limiting (6 per minute)
requests_this_minute = 0
minute_start = time.time()

for i, product in enumerate(remaining):
    filename = product['filename']
    prompt = product['prompt']
    
    # Rate limiting: wait if we've made 5+ requests this minute
    if requests_this_minute >= 5:
        elapsed = time.time() - minute_start
        if elapsed < 60:
            wait_time = 60 - elapsed + 1
            print(f"\n  â³ Rate limit: waiting {wait_time:.0f}s...")
            time.sleep(wait_time)
        requests_this_minute = 0
        minute_start = time.time()
    
    # Reset counter if a minute has passed
    if time.time() - minute_start > 60:
        requests_this_minute = 0
        minute_start = time.time()
    
    print(f"\n[{i+1}/{len(remaining)}] {filename}")
    
    try:
        # Use the correct model path - SDXL Lightning
        response = requests.post(
            "https://api.replicate.com/v1/models/bytedance/sdxl-lightning-4step/predictions",
            headers=HEADERS,
            json={
                "input": {
                    "prompt": prompt,
                    "negative_prompt": "text, watermark, logo, words, human, hands, blurry, low quality, distorted",
                    "width": 1024,
                    "height": 1024,
                    "num_outputs": 1,
                }
            }
        )
        
        requests_this_minute += 1
        
        if response.status_code == 201:
            prediction = response.json()
            prediction_id = prediction["id"]
            
            # Wait for completion
            for attempt in range(120):
                time.sleep(1)
                
                poll = requests.get(
                    f"https://api.replicate.com/v1/predictions/{prediction_id}",
                    headers={"Authorization": f"Bearer {REPLICATE_API_TOKEN}"}
                )
                
                if poll.status_code == 200:
                    data = poll.json()
                    status = data["status"]
                    
                    if status == "succeeded":
                        output = data["output"]
                        image_url = output[0] if isinstance(output, list) else output
                        
                        # Download
                        img = requests.get(image_url)
                        if img.status_code == 200:
                            filepath = os.path.join(OUTPUT_DIR, filename)
                            with open(filepath, "wb") as f:
                                f.write(img.content)
                            size = os.path.getsize(filepath) / 1024
                            print(f"  âœ… Saved ({size:.0f} KB)")
                            success_count += 1
                        break
                    
                    elif status == "failed":
                        print(f"  âŒ Failed: {data.get('error', '')[:150]}")
                        fail_count += 1
                        break
                    
                    elif status == "canceled":
                        print(f"  âš ï¸  Canceled")
                        fail_count += 1
                        break
                    
                    elif attempt % 5 == 0:
                        print(f"  â³ Generating... ({attempt}s)", end="\r")
        
        elif response.status_code == 429:
            print(f"  âš ï¸  Rate limited. Waiting 70 seconds...")
            time.sleep(70)
            requests_this_minute = 0
            minute_start = time.time()
            fail_count += 1
        
        else:
            print(f"  âŒ HTTP {response.status_code}: {response.text[:150]}")
            fail_count += 1
    
    except Exception as e:
        print(f"  âŒ Error: {str(e)[:150]}")
        fail_count += 1
    
    # Progress
    elapsed = time.time() - start_time
    completed = success_count + fail_count
    if completed > 0:
        rate = completed / elapsed
        eta = (len(remaining) - i - 1) / rate if rate > 0 else 0
        print(f"  ðŸ“Š {success_count} ok, {fail_count} fail | ETA: {eta/60:.0f} min")

# ============================================================
# SUMMARY
# ============================================================
elapsed = time.time() - start_time
total_images = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith('.jpg')])

print(f"\n{'=' * 60}")
print(f"DONE!")
print(f"  âœ… Generated this run: {success_count}")
print(f"  âŒ Failed this run: {fail_count}")
print(f"  ðŸ“ Total images: {total_images}")
print(f"  â±ï¸  Time: {elapsed/60:.1f} min")
print(f"  ðŸ’° Cost: ~${success_count * 0.002:.2f}")
print(f"{'=' * 60}")

