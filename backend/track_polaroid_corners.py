import cv2
import numpy as np
import json
import os

video_path = "/Users/sanathbs/03_Dev_Lab/projects/Personal/youtube videos/lyric-video-generator-v2/assets/backgrounds/intro reel/Motion_graphic_overlay_transpare…_202607151914.mp4"
output_json = "/Users/sanathbs/03_Dev_Lab/projects/Personal/youtube videos/lyric-video-generator-v2/backend/papersky_tracking.json"

if not os.path.exists(video_path):
    print(f"Error: Video not found at {video_path}")
    exit(1)

cap = cv2.VideoCapture(video_path)
fps = cap.get(cv2.CAP_PROP_FPS)
frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

print(f"Tracking video: {video_path}")
print(f"Total frames: {frame_count}, FPS: {fps}")

tracking_data = []

# We only track the first 2 seconds (48 frames at 24 FPS)
max_frames_to_track = 50

for frame_idx in range(frame_count):
    ret, frame = cap.read()
    if not ret:
        break
    
    if frame_idx >= max_frames_to_track:
        break
        
    # Find pixels that are nearly grayscale (checkerboard pattern)
    # Check that channels are close to each other
    # Also exclude pure black or very dark areas (less than 30) and very bright areas (more than 240)
    b, g, r = cv2.split(frame)
    diff_rg = cv2.absdiff(r, g)
    diff_gb = cv2.absdiff(g, b)
    
    # Grayscale mask: differences less than 3
    gray_mask = (diff_rg < 3) & (diff_gb < 3) & (r > 30) & (r < 230)
    gray_mask = gray_mask.astype(np.uint8) * 255
    
    # Morphological closing to clean up checkerboard squares
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    closed = cv2.morphologyEx(gray_mask, cv2.MORPH_CLOSE, kernel)
    
    # Find contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    frame_data = {
        "frame": frame_idx,
        "visible": False,
        "photo_corners": None,
        "text_corners": None
    }
    
    if contours:
        # Get the largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        
        # Check if the area is large enough to be the polaroid slot (at least 20000 pixels)
        if area > 10000:
            # Approximate the contour to a polygon
            peri = cv2.arcLength(largest_contour, True)
            approx = cv2.approxPolyDP(largest_contour, 0.02 * peri, True)
            
            # If it has 4 corners, we found it!
            if len(approx) == 4:
                # Reshape to (4, 2)
                pts = approx.reshape(4, 2).astype(float).tolist()
                
                # Sort corners: top-left, top-right, bottom-right, bottom-left
                # Sort by y-coordinate to find top vs bottom
                pts = sorted(pts, key=lambda p: p[1])
                top_pts = sorted(pts[:2], key=lambda p: p[0])
                bottom_pts = sorted(pts[2:], key=lambda p: p[0])
                
                tl = top_pts[0]
                tr = top_pts[1]
                br = bottom_pts[1]
                bl = bottom_pts[0]
                
                # Extrapolate text region below the bottom edge (bl to br)
                # Let's compute direction vectors for the sides
                # Vector from TL to BL
                v_left = np.array(bl) - np.array(tl)
                # Vector from TR to BR
                v_right = np.array(br) - np.array(tr)
                
                # The text region starts at bl, br and extends downwards
                # Let's say it extends by about 35% of the photo height
                text_tl = bl
                text_tr = br
                text_bl = (np.array(bl) + 0.33 * v_left).tolist()
                text_br = (np.array(br) + 0.33 * v_right).tolist()
                
                frame_data["visible"] = True
                frame_data["photo_corners"] = [tl, tr, br, bl]
                frame_data["text_corners"] = [text_tl, text_tr, text_br, text_bl]
                
                print(f"Frame {frame_idx:02d}: Tracked successfully! Area: {area:.1f}")
            else:
                # If approx doesn't return 4 points, use bounding box corners
                x, y, w, h = cv2.boundingRect(largest_contour)
                tl = [float(x), float(y)]
                tr = [float(x + w), float(y)]
                br = [float(x + w), float(y + h)]
                bl = [float(x), float(y + h)]
                
                # Extrapolate text region
                v_left = np.array(bl) - np.array(tl)
                v_right = np.array(br) - np.array(tr)
                text_tl = bl
                text_tr = br
                text_bl = (np.array(bl) + 0.33 * v_left).tolist()
                text_br = (np.array(br) + 0.33 * v_right).tolist()
                
                frame_data["visible"] = True
                frame_data["photo_corners"] = [tl, tr, br, bl]
                frame_data["text_corners"] = [text_tl, text_tr, text_br, text_bl]
                print(f"Frame {frame_idx:02d}: Bounding box fallback used. Area: {area:.1f}")
        else:
            print(f"Frame {frame_idx:02d}: Polaroid cutout too small (Area: {area:.1f})")
    else:
        print(f"Frame {frame_idx:02d}: No contours found")
        
    tracking_data.append(frame_data)

cap.release()

# Save to JSON file
with open(output_json, "w") as f:
    json.dump(tracking_data, f, indent=2)

print(f"\nSaved tracking coordinates for {len(tracking_data)} frames to {output_json}")
