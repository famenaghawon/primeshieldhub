import requests, csv, os, time
from PIL import Image
from io import BytesIO

TOKEN = "YOUR_REPLICATE_TOKEN_FROM_ENV"
CSV_FILE = "image-prompts-all.csv"
OUTPUT_DIR = "assets/products"
os.makedirs(OUTPUT_DIR, exist_ok=True)

HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
SDXL_VERSION = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"

with open(CSV_FILE, "r", encoding="utf-8") as f:
    products = list(csv.DictReader(f))

remaining = []
for p in products:
    webp_path = os.path.join(OUTPUT_DIR, p['filename'])
    if not os.path.exists(webp_path):
        remaining.append(p)

print(f"Total: {len(products)} | Done: {len(products)-len(remaining)} | Left: {len(remaining)}")
print(f"Cost: ~${len(remaining)*0.005:.2f} | ~{len(remaining)*4/60:.0f} min")

if len(remaining) > 100:
    print("Auto-starting in 3 seconds...")
    time.sleep(3)
else:
    input("Press Enter to start...")

ok = 0
fail = 0
t0 = time.time()

for i, p in enumerate(remaining):
    webp_filename = p['filename']
    print(f"\n[{i+1}/{len(remaining)}] {webp_filename}", end=" ")
    
    try:
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
            
            for attempt in range(60):
                time.sleep(1)
                poll = requests.get(f"https://api.replicate.com/v1/predictions/{pid}", headers=HEADERS)
                
                if poll.status_code == 200:
                    d = poll.json()
                    status = d.get("status")
                    
                    if status == "succeeded":
                        output = d.get("output", [])
                        url = output[0] if isinstance(output, list) else output
                        
                        img_response = requests.get(url)
                        if img_response.status_code == 200:
                            img = Image.open(BytesIO(img_response.content))
                            img = img.convert("RGB")
                            
                            path = os.path.join(OUTPUT_DIR, webp_filename)
                            img.save(path, "WEBP", quality=85, method=6)
                            
                            size = os.path.getsize(path) / 1024
                            print(f"OK {size:.0f}KB ({attempt}s)")
                            ok += 1
                        else:
                            print(f"FAIL download")
                            fail += 1
                        break
                    
                    elif status == "failed":
                        print(f"FAIL {d.get('error','')[:80]}")
                        fail += 1
                        break
                    
                    elif attempt % 5 == 0:
                        print(f".", end="", flush=True)
        
        elif r.status_code == 429:
            print("RATE LIMIT - wait 15s")
            time.sleep(15)
            fail += 1
        else:
            print(f"HTTP{r.status_code}")
            fail += 1
    
    except KeyboardInterrupt:
        print(f"\n\nStopped. {ok} generated. Run again to continue.")
        exit(0)
    except Exception as e:
        print(f"ERR {str(e)[:60]}")
        fail += 1
    
    elapsed = time.time() - t0
    done = ok + fail
    rate = done / elapsed if elapsed > 0 else 0
    eta = (len(remaining) - i - 1) / rate if rate > 0 else 0
    print(f"| {ok}ok {fail}bad | ETA {eta/60:.0f}m", end="")

elapsed = time.time() - t0
total = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith('.webp')])
print(f"\n\nDONE! Generated {ok} | Failed {fail} | Total webp: {total}/{len(products)} | {elapsed/60:.0f}min | ~${ok*0.005:.2f}")

