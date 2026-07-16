import os
from PIL import Image
import numpy as np

frame_dir = "temp/intro_frames"
files = sorted([f for f in os.listdir(frame_dir) if f.endswith(".png")])

print("--- Tracking Polaroid Cutout (Grayscale checkerboard) frame-by-frame ---")
for f in files:
    path = os.path.join(frame_dir, f)
    img = Image.open(path)
    arr = np.array(img)
    
    # Grayscale mask
    gray_mask = (arr[:, :, 0] == arr[:, :, 1]) & (arr[:, :, 1] == arr[:, :, 2])
    y_indices, x_indices = np.where(gray_mask)
    
    if len(x_indices) > 0:
        min_x, max_x = x_indices.min(), x_indices.max()
        min_y, max_y = y_indices.min(), y_indices.max()
        print(f"Frame {f}: Bounding Box X=[{min_x}, {max_x}], Y=[{min_y}, {max_y}] | Size: {max_x-min_x}x{max_y-min_y}")
    else:
        print(f"Frame {f}: No cutout found")
