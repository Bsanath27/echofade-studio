from PIL import Image
import numpy as np

img = Image.open("temp/intro_frames/frame_1.00.png")
# Resize to a small size for ASCII representation
w, h = 80, 142
img_small = img.resize((w, h), Image.Resampling.BILINEAR)
arr = np.array(img_small.convert("L")) # convert to grayscale

# Map grayscale values (0-255) to ASCII characters
chars = "@%#*+=-:. " # 10 levels from dark to light
num_chars = len(chars)

print("--- Frame 1.00s ASCII Art ---")
for y in range(h):
    line = ""
    for x in range(w):
        val = arr[y, x]
        idx = int(val / 256 * num_chars)
        line += chars[idx]
    print(line)
