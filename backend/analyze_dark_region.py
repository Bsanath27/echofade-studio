from PIL import Image
import numpy as np

img = Image.open("temp/intro_frames/frame_1.00.png")
arr = np.array(img)

# Let's check for dark pixels (representing the inner photo cutout/slot)
# Let's try thresholding values to see where the dark region is.
# Print the coordinates of pixels where R < 90, G < 90, B < 80
mask = (arr[:, :, 0] < 90) & (arr[:, :, 1] < 80) & (arr[:, :, 2] < 70)
y_indices, x_indices = np.where(mask)

if len(x_indices) > 0:
    min_x, max_x = x_indices.min(), x_indices.max()
    min_y, max_y = y_indices.min(), y_indices.max()
    print(f"Dark region bounding box: X=[{min_x}, {max_x}], Y=[{min_y}, {max_y}]")
    print(f"Region size: {max_x - min_x}x{max_y - min_y}")
    print(f"Total dark pixels: {len(x_indices)} ({len(x_indices)/(arr.shape[0]*arr.shape[1])*100:.2f}%)")
else:
    print("No dark pixels found with this threshold.")
