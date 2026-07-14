import os
import sys
import time
import shutil
from PIL import Image

# Setup path and environment
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
os.environ["U2NET_HOME"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "models"))

from rotoscope_engine import generate_subject_mask_detailed

test_images = [
    "Good Will Hunting.jpeg",
    "la la land ♡.jpeg",
    "Dawn.jpeg",
    "zhuang dafei.jpeg"
]

src_dir = "/Users/sanathbs/Downloads/bg/landscape"
out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "temp", "sandbox_mask_test"))
os.makedirs(out_dir, exist_ok=True)

# Copy files locally first so they are inside the workspace
for img_name in test_images:
    src = os.path.join(src_dir, img_name)
    dst = os.path.join(out_dir, img_name)
    if os.path.exists(src):
        try:
            shutil.copyfile(src, dst)
        except Exception as e:
            print(f"Could not copy {img_name}: {e}")

print("=== Starting Landscape Masking Accuracy Verification ===")

for img_name in test_images:
    local_path = os.path.join(out_dir, img_name)
    if not os.path.exists(local_path):
        print(f"Skipping {img_name}: local file not found at {local_path}")
        continue
        
    out_path = os.path.join(out_dir, f"mask_{os.path.splitext(img_name)[0]}.png")
    
    print(f"\nProcessing: {img_name}")
    t0 = time.time()
    try:
        # Run detailed mask generator with no points first (automatic rembg mode)
        mask_path, method = generate_subject_mask_detailed(local_path, out_path, points=None)
        elapsed = time.time() - t0
        
        # Verify saved file properties
        mask_img = Image.open(mask_path)
        w, h = mask_img.size
        print(f"  Result: {method} in {elapsed:.2f}s")
        print(f"  Dimensions: {w}x{h}, Mode: {mask_img.mode}")
        
        # Analyze transparency ratio to check if it's masking anything
        alpha = mask_img.split()[3]
        alpha_data = list(alpha.getdata())
        fg_pixels = sum(1 for val in alpha_data if val > 200)
        total_pixels = len(alpha_data)
        fg_ratio = (fg_pixels / total_pixels) * 100
        print(f"  Foreground subject coverage: {fg_ratio:.1f}% of image")
        
    except Exception as e:
        print(f"  Failed: {e}")

print("\n=== Verification Completed ===")
