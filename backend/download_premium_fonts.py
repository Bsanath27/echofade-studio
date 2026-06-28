import urllib.request
import ssl
import os

# Bypass SSL verification
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

os.makedirs('fonts', exist_ok=True)

fonts = {
    "Cinzel-Bold.ttf": "https://github.com/google/fonts/raw/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf",
    "PermanentMarker-Regular.ttf": "https://github.com/google/fonts/raw/main/apache/permanentmarker/PermanentMarker-Regular.ttf",
    "Roboto-Bold.ttf": "https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Bold.ttf"
}

for name, url in fonts.items():
    print(f"Downloading {name}...")
    try:
        response = urllib.request.urlopen(url, context=ctx)
        with open(f"fonts/{name}", "wb") as f:
            f.write(response.read())
        print(f"Success: {name}")
    except Exception as e:
        print(f"Failed to download {name}: {e}")
