import os
from PIL import Image, ImageDraw, ImageFilter

# Set U2NET_HOME to a workspace path to avoid macOS permission/sandbox restrictions on ~/.u2net
os.environ["U2NET_HOME"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "models"))

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

try:
    from rembg import remove, new_session
    # Pre-load the U2-Net model at import time so the first click is fast
    _rembg_session = new_session("u2net")
    HAVE_REMBG = True
    print(f"[Rotoscope] rembg U2-Net model loaded and cached from: {os.environ['U2NET_HOME']}")
except Exception as import_err:
    import traceback
    print(f"[Rotoscope] Failed to initialize rembg AI model: {import_err}")
    traceback.print_exc()
    _rembg_session = None
    HAVE_REMBG = False

try:
    import cv2
    import numpy as np
    HAVE_OPENCV = True
except Exception:
    HAVE_OPENCV = False

import numpy as np
import hashlib

# Max dimension for AI processing — keeps inference fast (<1s)
_MAX_AI_DIM = 1024

# Cache rembg alpha masks so repeat clicks on same image skip the AI entirely
# Key: hash of image bytes, Value: (alpha_np array, original PIL image)
_rembg_cache = {}


def generate_subject_mask_detailed(image_path: str, output_path: str = None, points: list = None) -> tuple[str, str]:
    """
    Extracts the foreground subject from an image using AI segmentation (rembg/U2-Net).
    The click points serve as a trigger — the AI determines the full object boundary.
    Returns (absolute_mask_path, method_used).
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Input image not found: {image_path}")

    if not output_path:
        base_dir = os.path.dirname(image_path)
        filename = os.path.splitext(os.path.basename(image_path))[0]
        output_path = os.path.join(base_dir, f"{filename}_subject.png")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    # ── PRIMARY: rembg AI segmentation (U2-Net neural network) ──
    # rembg segments ALL foreground objects. We then use the click point
    # to select only the connected region the user actually clicked on.
    if HAVE_REMBG:
        try:
            import time
            t0 = time.time()

            # Cache key = hash of image file bytes
            with open(image_path, "rb") as f:
                img_hash = hashlib.md5(f.read()).hexdigest()

            original_img = Image.open(image_path).convert("RGBA")
            orig_w, orig_h = original_img.size

            if img_hash in _rembg_cache:
                # ── CACHE HIT: skip AI, just reuse the alpha mask ──
                alpha_np = _rembg_cache[img_hash]
                print(f"[Rotoscope] Cache hit — skipping AI inference, using cached mask")
            else:
                # ── CACHE MISS: run AI inference ──
                print(f"[Rotoscope] Running AI subject segmentation (rembg/U2-Net) on {image_path}...")

                # Downscale for fast AI inference
                scale = 1.0
                if max(orig_w, orig_h) > _MAX_AI_DIM:
                    scale = _MAX_AI_DIM / max(orig_w, orig_h)
                    small_w, small_h = int(orig_w * scale), int(orig_h * scale)
                    work_img = original_img.resize((small_w, small_h), Image.LANCZOS)
                    print(f"[Rotoscope] Downscaled {orig_w}x{orig_h} → {small_w}x{small_h} for fast inference")
                else:
                    work_img = original_img

                result_img = remove(work_img, session=_rembg_session)

                if scale < 1.0:
                    alpha_small = result_img.split()[3]
                    alpha_full = alpha_small.resize((orig_w, orig_h), Image.LANCZOS)
                else:
                    alpha_full = result_img.split()[3]

                alpha_np = np.array(alpha_full)  # shape (h, w), 0-255
                _rembg_cache[img_hash] = alpha_np  # cache for future clicks
                print(f"[Rotoscope] AI inference done, mask cached")

            # ── Point-aware region selection ──
            # Use click coordinates to pick which connected region to keep
            pos_pts = [pt for pt in (points or []) if pt[2]] if points else []
            neg_pts = [pt for pt in (points or []) if not pt[2]] if points else []

            if pos_pts:
                # Lower threshold to 15 to keep faint connections (like neck, thin straps, hair wisps)
                binary = (alpha_np > 15).astype(np.uint8)

                # Check if first click is on foreground or background of the rembg mask
                px = min(orig_w - 1, max(0, int(pos_pts[0][0])))
                py = min(orig_h - 1, max(0, int(pos_pts[0][1])))

                clicked_on_fg = binary[py, px] == 1
                if not clicked_on_fg:
                    # User clicked on something rembg considers background — invert mask
                    binary = 1 - binary
                    print(f"[Rotoscope] Click at ({px},{py}) is on BG — inverting mask")

                # BFS flood fill from click point to select only the connected region
                selected_mask = np.zeros_like(binary)
                visited = np.zeros_like(binary, dtype=bool)
                h, w = binary.shape

                for pt in pos_pts:
                    sx = min(w - 1, max(0, int(pt[0])))
                    sy = min(h - 1, max(0, int(pt[1])))
                    
                    if binary[sy, sx] == 0:
                        # User clicked outside the U2-Net AI mask (missed subject parts).
                        # Force-add a small disk seed in selected_mask to allow GrabCut to segment it.
                        r = 20
                        Y, X = np.ogrid[:h, :w]
                        dist = (X - sx)**2 + (Y - sy)**2
                        selected_mask[dist < r**2] = 255
                        visited[dist < r**2] = True
                        continue

                    if visited[sy, sx]:
                        continue
                    queue = [(sy, sx)]
                    visited[sy, sx] = True
                    while queue:
                        batch = queue
                        queue = []
                        for cy, cx in batch:
                            selected_mask[cy, cx] = 255
                            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                                ny, nx = cy + dy, cx + dx
                                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and binary[ny, nx] == 1:
                                    visited[ny, nx] = True
                                    queue.append((ny, nx))

                # Apply negative clicks (subtract them from selected_mask)
                for pt in neg_pts:
                    nx = min(w - 1, max(0, int(pt[0])))
                    ny = min(h - 1, max(0, int(pt[1])))
                    # Draw a black circle on the selected mask to remove background clutter/leaks
                    Y, X = np.ogrid[:h, :w]
                    dist_from_center = np.sqrt((X - nx)**2 + (Y - ny)**2)
                    selected_mask[dist_from_center < 50] = 0

                # Dilate the selected binary mask generously using PIL MaxFilter to avoid clipping soft/feathered boundaries
                selected_pil = Image.fromarray(selected_mask, mode="L")
                dilated_pil = selected_pil.filter(ImageFilter.MaxFilter(size=15))
                dilated_np = np.array(dilated_pil)

                # Multiply original feathered alpha mask by this dilated selection mask
                final_alpha_np = (alpha_np * (dilated_np / 255.0)).astype(np.uint8)
                print(f"[Rotoscope] Kept connected components of clicked points")
            else:
                # No click points — return full rembg mask but apply any negative points if present
                if neg_pts:
                    h, w = alpha_np.shape
                    selected_mask = np.ones_like(alpha_np) * 255
                    for pt in neg_pts:
                        nx = min(w - 1, max(0, int(pt[0])))
                        ny = min(h - 1, max(0, int(pt[1])))
                        Y, X = np.ogrid[:h, :w]
                        dist_from_center = np.sqrt((X - nx)**2 + (Y - py)**2)
                        selected_mask[dist_from_center < 50] = 0
                    final_alpha_np = (alpha_np * (selected_mask / 255.0)).astype(np.uint8)
                else:
                    final_alpha_np = alpha_np.copy()

            # ── SECOND STAGE: GrabCut Boundary Edge Refinement ──
            # Use OpenCV GrabCut to align U2-Net's raw mask boundaries precisely to the image's real color edges.
            if HAVE_OPENCV:
                try:
                    print("[Rotoscope] Running GrabCut edge refinement to make mask pixel-accurate...")
                    # Convert PIL image to BGR numpy array
                    img_np = np.array(original_img)
                    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
                    h, w = final_alpha_np.shape[:2]

                    # 0: GC_BGD, 1: GC_FGD, 2: GC_PR_BGD, 3: GC_PR_FGD
                    gc_mask = np.zeros((h, w), dtype=np.uint8) + cv2.GC_PR_BGD
                    
                    # Set trimap regions based on U2-Net alpha confidence (probable labels only, so GrabCut can correct them)
                    gc_mask[final_alpha_np > 80] = cv2.GC_PR_FGD
                    gc_mask[final_alpha_np < 15] = cv2.GC_PR_BGD
                    gc_mask[final_alpha_np > 235] = cv2.GC_PR_FGD

                    # Set sure foreground/background points from user clicks (these lock/force the labels)
                    for pt in pos_pts:
                        px = min(w - 1, max(0, int(pt[0])))
                        py = min(h - 1, max(0, int(pt[1])))
                        cv2.circle(gc_mask, (px, py), 15, cv2.GC_FGD, -1)
                    for pt in neg_pts:
                        nx = min(w - 1, max(0, int(pt[0])))
                        ny = min(h - 1, max(0, int(pt[1])))
                        cv2.circle(gc_mask, (nx, ny), 22, cv2.GC_BGD, -1)

                    bgd_model = np.zeros((1, 65), np.float64)
                    fgd_model = np.zeros((1, 65), np.float64)
                    
                    # Refine border using GrabCut
                    cv2.grabCut(img_bgr, gc_mask, None, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_MASK)
                    
                    # Create final refined alpha mask
                    refined_mask = np.where((gc_mask == cv2.GC_BGD) | (gc_mask == cv2.GC_PR_BGD), 0, 255).astype(np.uint8)
                    
                    # Soft feathering of the GrabCut border to avoid aliasing
                    refined_mask = cv2.GaussianBlur(refined_mask, (5, 5), 0)
                    
                    final_alpha_np = refined_mask
                    print("[Rotoscope] GrabCut edge refinement completed successfully")
                except Exception as gc_err:
                    print(f"[Rotoscope] GrabCut edge refinement failed ({gc_err}), using default alpha")

            original_img.putalpha(Image.fromarray(final_alpha_np, mode="L"))
            original_img.save(output_path, "PNG")
            elapsed = time.time() - t0
            print(f"[Rotoscope] AI segmentation and refinement done in {elapsed:.1f}s: {output_path}")
            return os.path.abspath(output_path), "rembg"
        except Exception as e:
            print(f"[Rotoscope] rembg AI segmentation failed ({e}), trying fallbacks...")

    # ── FALLBACK 1: OpenCV GrabCut with point hints ──
    if HAVE_OPENCV:
        try:
            print(f"[Rotoscope] Running OpenCV GrabCut segmentation on {image_path}...")
            img = cv2.imread(image_path)
            if img is not None:
                h, w = img.shape[:2]

                if points:
                    # Use points to seed the GrabCut mask
                    mask = np.zeros(img.shape[:2], np.uint8) + cv2.GC_PR_BGD
                    pos_pts = [pt for pt in points if pt[2]]
                    neg_pts = [pt for pt in points if not pt[2]]

                    if pos_pts:
                        xs = [pt[0] for pt in pos_pts]
                        ys = [pt[1] for pt in pos_pts]
                        pad = max(w, h) // 4
                        min_x = max(0, int(min(xs)) - pad)
                        max_x = min(w, int(max(xs)) + pad)
                        min_y = max(0, int(min(ys)) - pad)
                        max_y = min(h, int(max(ys)) + pad)
                        mask[min_y:max_y, min_x:max_x] = cv2.GC_PR_FGD

                    for pt in pos_pts:
                        px, py = int(pt[0]), int(pt[1])
                        if 0 <= px < w and 0 <= py < h:
                            cv2.circle(mask, (px, py), 20, cv2.GC_FGD, -1)
                    for pt in neg_pts:
                        px, py = int(pt[0]), int(pt[1])
                        if 0 <= px < w and 0 <= py < h:
                            cv2.circle(mask, (px, py), 25, cv2.GC_BGD, -1)

                    bgd_model = np.zeros((1, 65), np.float64)
                    fgd_model = np.zeros((1, 65), np.float64)
                    cv2.grabCut(img, mask, None, bgd_model, fgd_model, 8, cv2.GC_INIT_WITH_MASK)
                else:
                    # No points — use center rectangle
                    margin_w, margin_h = int(w * 0.1), int(h * 0.1)
                    rect = (margin_w, margin_h, w - 2 * margin_w, h - 2 * margin_h)
                    mask = np.zeros(img.shape[:2], np.uint8)
                    bgd_model = np.zeros((1, 65), np.float64)
                    fgd_model = np.zeros((1, 65), np.float64)
                    cv2.grabCut(img, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)

                mask2 = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8')
                mask_blur = cv2.GaussianBlur(mask2.astype(np.float32), (11, 11), 0)
                img_rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
                img_rgba[:, :, 3] = (mask_blur * 255).astype(np.uint8)
                cv2.imwrite(output_path, img_rgba)
                print(f"[Rotoscope] OpenCV GrabCut segmentation successful: {output_path}")
                return os.path.abspath(output_path), "grabcut"
        except Exception as e:
            print(f"[Rotoscope] OpenCV GrabCut failed ({e}), trying flood fill...")

    # ── FALLBACK 2: Flood-fill region growing from click points ──
    # This follows connected pixel regions from the click point, tracing real edges.
    if points:
        try:
            print(f"[Rotoscope] Running flood-fill region growing from click points on {image_path}...")
            img_pil = Image.open(image_path).convert("RGB")
            w, h = img_pil.size
            img_np = np.array(img_pil, dtype=np.float32)

            pos_pts = [pt for pt in points if pt[2]]
            if not pos_pts:
                pos_pts = points  # treat all as positive if none marked

            mask_np = np.zeros((h, w), dtype=np.uint8)

            for pt in pos_pts:
                px = min(w - 1, max(0, int(pt[0])))
                py = min(h - 1, max(0, int(pt[1])))
                seed_color = img_np[py, px]

                # BFS flood fill from the seed point
                tolerance = 35.0
                visited = np.zeros((h, w), dtype=bool)
                queue = [(py, px)]
                visited[py, px] = True

                while queue:
                    batch = queue
                    queue = []
                    for cy, cx in batch:
                        mask_np[cy, cx] = 255
                        # Check 4-connected neighbours
                        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                                visited[ny, nx] = True
                                diff = np.linalg.norm(img_np[ny, nx] - seed_color)
                                if diff < tolerance:
                                    queue.append((ny, nx))

            mask_pil = Image.fromarray(mask_np, mode="L")
            blur_radius = max(3, min(w, h) // 60)
            mask_pil = mask_pil.filter(ImageFilter.GaussianBlur(radius=blur_radius))

            img_rgba = img_pil.convert("RGBA")
            img_rgba.putalpha(mask_pil)
            img_rgba.save(output_path, "PNG")
            print(f"[Rotoscope] Flood-fill mask saved: {output_path}")
            return os.path.abspath(output_path), "floodfill"
        except Exception as e:
            print(f"[Rotoscope] Flood-fill failed ({e}), using final fallback...")

    # ── FINAL FALLBACK: PIL centered oval ──
    print(f"[Rotoscope] Using PIL fallback (no AI model available). Install rembg for proper results.")
    print(f"[Rotoscope] Run: pip install rembg onnxruntime")
    img = Image.open(image_path).convert("RGBA")
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    bbox = [int(w * 0.15), int(h * 0.1), int(w * 0.85), int(h * 0.9)]
    draw.ellipse(bbox, fill=255)
    blur_radius = max(5, min(w, h) // 20)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    img.putalpha(mask)
    img.save(output_path, "PNG")
    print(f"[Rotoscope] PIL fallback mask saved: {output_path}")
    return os.path.abspath(output_path), "pil"


def generate_subject_mask(image_path: str, output_path: str = None) -> str:
    """
    Extracts the foreground subject from an image and saves it as a transparent PNG.
    """
    path, _ = generate_subject_mask_detailed(image_path, output_path)
    return path

def generate_chroma_mask(image_path: str, target_hex: str, tolerance: int = 40, output_path: str = None) -> str:
    """
    Creates a transparent PNG where the target_hex color (and colors within tolerance) are masked out (alpha=0),
    and all other colors are opaque (alpha=255).
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Input image not found: {image_path}")

    if not output_path:
        base_dir = os.path.dirname(image_path)
        filename = os.path.splitext(os.path.basename(image_path))[0]
        output_path = os.path.join(base_dir, f"{filename}_chroma.png")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    target_hex = target_hex.lstrip('#')
    if len(target_hex) == 6:
        tr, tg, tb = tuple(int(target_hex[i:i+2], 16) for i in (0, 2, 4))
    else:
        tr, tg, tb = 255, 255, 255

    if HAVE_OPENCV:
        try:
            print(f"[Rotoscope] Generating Chroma Mask for {image_path} with target #{target_hex}...")
            img = cv2.imread(image_path)
            if img is not None:
                img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
                # Create bounds
                lower_bound = np.array([max(0, tr - tolerance), max(0, tg - tolerance), max(0, tb - tolerance)])
                upper_bound = np.array([min(255, tr + tolerance), min(255, tg + tolerance), min(255, tb + tolerance)])
                
                # Mask where the color IS in range (we want these to be transparent, alpha=0)
                # cv2.inRange gives 255 for pixels IN range, 0 for pixels OUT of range.
                in_range_mask = cv2.inRange(img_rgb, lower_bound, upper_bound)
                
                # We want alpha=255 where it's OUT of range, so we invert
                alpha_channel = cv2.bitwise_not(in_range_mask)
                
                # Feathering (soft edge)
                alpha_channel = cv2.GaussianBlur(alpha_channel, (5, 5), 0)
                
                img_rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
                img_rgba[:, :, 3] = alpha_channel
                
                cv2.imwrite(output_path, img_rgba)
                return os.path.abspath(output_path)
        except Exception as e:
            print(f"[Rotoscope] OpenCV chroma key failed ({e}), falling back to PIL...")

    # Fallback to PIL
    print(f"[Rotoscope] Using PIL fallback chroma key for {image_path}...")
    img = Image.open(image_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        r, g, b, a = item
        # Euclidean distance
        dist = ((r - tr)**2 + (g - tg)**2 + (b - tb)**2) ** 0.5
        if dist <= tolerance:
            # Map distance to alpha (soft edge)
            alpha = int((dist / tolerance) * 255)
            new_data.append((r, g, b, alpha))
        else:
            new_data.append((r, g, b, a))
            
    img.putdata(new_data)
    img = img.filter(ImageFilter.GaussianBlur(radius=1))
    img.save(output_path, "PNG")
    return os.path.abspath(output_path)


def split_image_background_and_subject(image_path: str, output_dir: str = None) -> tuple[str, str]:
    """
    Splits an image into a background image and a transparent subject overlay PNG.
    
    Returns:
        tuple[str, str]: (background_image_path, subject_overlay_png_path)
    """
    if not output_dir:
        output_dir = os.path.dirname(image_path)
        
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    subject_path = os.path.join(output_dir, f"{base_name}_subject.png")
    
    subject_overlay = generate_subject_mask(image_path, subject_path)
    return image_path, subject_overlay
