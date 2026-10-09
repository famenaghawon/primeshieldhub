import requests, csv, os, time

TOKEN = "YOUR_REPLICATE_TOKEN_FROM_ENV"
CSV_FILE = "image-prompts.csv"
OUTPUT_DIR = "assets/products"
os.makedirs(OUTPUT_DIR, exist_ok=True)
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# Verify
r = requests.get("https://api.replicate.com/v1/account", headers=HEADERS)
if r.status_code != 200:
    print(f"BAD TOKEN: {r.status_code}")
    exit()
print(f"OK: {r.json().get('username')} | Credit: ${r.json().get('credits', 'N/A')}")

# Load
with open(CSV_FILE, "r", encoding="utf-8") as f:
    products = list(csv.DictReader(f))
remaining = [p for p in products if not os.path.exists(os.path.join(OUTPUT_DIR, p['filename']))]
print(f"Total: {len(products)} | Done: {len(products)-len(remaining)} | Left: {len(remaining)}")
print(f"Cost: ~${len(remaining)*0.005:.2f} | ~{len(remaining)*5/60:.0f} min")
input("Press Enter to start...")

ok = 0; fail = 0; t0 = time.time()
for i, p in enumerate(remaining):
    print(f"[{i+1}/{len(remaining)}] {p['filename']}", end=" ")
    try:
        resp = requests.post("https://api.replicate.com/v1/models/stability-ai/sdxl/predictions", headers=HEADERS, json={"input":{"prompt":p['prompt'],"negative_prompt":"text,watermark,logo,human,blurry,low quality","width":1024,"height":1024,"num_outputs":1}})
        if resp.status_code == 201:
            pid = resp.json()["id"]
            for _ in range(120):
                time.sleep(1)
                poll = requests.get(f"https://api.replicate.com/v1/predictions/{pid}", headers=HEADERS)
                if poll.status_code == 200:
                    d = poll.json()
                    if d["status"] == "succeeded":
                        url = d["output"][0] if isinstance(d["output"], list) else d["output"]
                        img = requests.get(url)
                        path = os.path.join(OUTPUT_DIR, p['filename'])
                        with open(path, "wb") as f: f.write(img.content)
                        print(f"OK ({os.path.getsize(path)/1024:.0f}KB)")
                        ok += 1; break
                    elif d["status"] == "failed": print("FAIL"); fail += 1; break
        elif resp.status_code == 429: print("RATE"); time.sleep(15); fail += 1
        else: print(f"ERR{resp.status_code}"); fail += 1
    except KeyboardInterrupt: print(f"\nSTOPPED: {ok} done"); exit()
    except Exception as e: print(f"ERR:{str(e)[:50]}"); fail += 1
    time.sleep(1)
print(f"\nDONE! {ok} ok, {fail} fail, {time.time()-t0:.0f}s")
