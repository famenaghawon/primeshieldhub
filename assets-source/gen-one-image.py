import requests, os, time
from PIL import Image
from io import BytesIO

TOKEN = "YOUR_REPLICATE_TOKEN_FROM_ENV"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
VERSION = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"

prompt = "Professional product photo of Apple MagSafe Duo Wireless Charger on pure white background, front view, studio lighting, e-commerce style, no text, no watermark, photorealistic"

print("Generating Apple MagSafe Duo Charger...")
r = requests.post("https://api.replicate.com/v1/predictions", headers=HEADERS, json={
    "version": VERSION,
    "input": {
        "prompt": prompt,
        "negative_prompt": "text, watermark, logo, human, hands, blurry, low quality, distorted",
        "width": 1024,
        "height": 1024,
        "num_outputs": 1
    }
})

if r.status_code == 201:
    pid = r.json()["id"]
    print(f"Prediction ID: {pid}")
    
    for attempt in range(60):
        time.sleep(1)
        poll = requests.get(f"https://api.replicate.com/v1/predictions/{pid}", headers=HEADERS)
        if poll.status_code == 200:
            d = poll.json()
            status = d.get("status")
            if attempt % 5 == 0:
                print(f"  Status: {status}")
            
            if status == "succeeded":
                url = d["output"][0] if isinstance(d["output"], list) else d["output"]
                img = Image.open(BytesIO(requests.get(url).content)).convert("RGB")
                path = "assets/products/apple-magsafe-duo-charger.webp"
                img.save(path, "WEBP", quality=85, method=6)
                print(f"âœ… Saved: {path} ({os.path.getsize(path)/1024:.0f}KB)")
                break
            elif status == "failed":
                print(f"âŒ Failed: {d.get('error')}")
                break
else:
    print(f"âŒ API Error: {r.status_code}")

