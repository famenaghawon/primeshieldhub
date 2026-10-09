import requests, csv, os, time

TOKEN = "YOUR_REPLICATE_TOKEN_FROM_ENV"
CSV_FILE = "image-prompts.csv"
OUTPUT_DIR = "assets/products"
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
SDXL_VERSION = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"

# Load CSV
with open(CSV_FILE, "r", encoding="utf-8") as f:
    products = list(csv.DictReader(f))

# Filter done
remaining = [p for p in products if not os.path.exists(os.path.join(OUTPUT_DIR, p['filename']))]

print(f"Total: {len(products)} | Done: {len(products)-len(remaining)} | Left: {len(remaining)}")
print(f"Cost: ~${len(remaining)*0.005:.2f} | ~{len(remaining)*4/60:.0f} min")
print(f"Model: SDXL (working!)")
input("Press Enter to start...")

ok = 0
fail = 0
t0 = time.time()

for i, p in enumerate(remaining):
    print(f"\n[{i+1}/{len(remaining)}] {p['filename']}", end=" ")
    
    try:
        # Create prediction
        r = requests.post("https://api.replicate.com/v1/predictions", headers=HEADERS, json={
            "version": SDXL_VERSION,
            "input": {
                "prompt": p['prompt'],
                "negative_prompt": "text, watermark, logo, human, hands, blurry, low quality, distorted",
                "width": 1024,
                "height": 1024,
                "num_outputs": 1
            }
        })
        
        if r.status_code == 201:
            pid = r.json()["id"]
            
            # Wait for completion
            for attempt in range(60):
                time.sleep(1)
                poll = requests.get(f"https://api.replicate.com/v1/predictions/{pid}", headers=HEADERS)
                
                if poll.status_code == 200:
                    d = poll.json()
                    status = d.get("status")
                    
                    if status == "succeeded":
                        output = d.get("output", [])
                        url = output[0] if isinstance(output, list) else output
                        
                        # Download
                        img = requests.get(url)
                        if img.status_code == 200:
                            path = os.path.join(OUTPUT_DIR, p['filename'])
                            with open(path, "wb") as f:
                                f.write(img.content)
                            size = os.path.getsize(path) / 1024
                            print(f"✅ {size:.0f}KB ({attempt}s)")
                            ok += 1
                        else:
                            print(f"❌ Download failed")
                            fail += 1
                        break
                    
                    elif status == "failed":
                        print(f"❌ {d.get('error','')[:100]}")
                        fail += 1
                        break
                    
                    elif attempt % 5 == 0:
                        print(f"⏳", end="", flush=True)
        
        elif r.status_code == 429:
            print("⏸️ Rate limit - waiting 15s")
            time.sleep(15)
            fail += 1
        else:
            print(f"❌ HTTP{r.status_code}")
            fail += 1
    
    except KeyboardInterrupt:
        print(f"\n\n⏸️ Stopped. {ok} images generated.")
        print(f"Run again to continue where you left off.")
        exit(0)
    except Exception as e:
        print(f"❌ {str(e)[:80]}")
        fail += 1
    
    # Progress
    elapsed = time.time() - t0
    done = ok + fail
    rate = done / elapsed if elapsed > 0 else 0
    eta = (len(remaining) - i - 1) / rate if rate > 0 else 0
    print(f"| {ok}✓ {fail}✗ | ETA: {eta/60:.0f}min", end="")

# Summary
elapsed = time.time() - t0
total = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith(('.jpg','.png'))])
print(f"\n\n{'='*50}")
print(f"✅ COMPLETE!")
print(f"   Generated: {ok}")
print(f"   Failed: {fail}")
print(f"   Total images: {total}/{len(products)}")
print(f"   Time: {elapsed/60:.0f} min")
print(f"   Cost: ~${ok*0.005:.2f}")
print(f"{'='*50}")
