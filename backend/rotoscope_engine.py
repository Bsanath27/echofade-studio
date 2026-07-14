import os
from PIL import Image, ImageDraw, ImageFilter

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

try:
    from rembg import remove
    HAVE_REMBG = True
except Exception:
    HAVE_REMBG = False

try:
    import cv2
    import numpy as np
    HAVE_OPENCV = True
except Exception:
    HAVE_OPENCV = False


def generate_subject_mask(image_path: str, output_path: str = None) -> str:
    """
    Extracts the foreground subject from an image and saves it as a transparent PNG.
    
    Uses `rembg` if available. If `rembg` fails or is not installed, falls back to
    OpenCV GrabCut segmentation or PIL feathered center masking.
    
    Args:
        image_path: Path to the input image.
        output_path: Path for the transparent subject overlay PNG output.
                     If None, defaults to `<image_dir>/<image_name>_subject.png`.
                     
    Returns:
        str: Absolute path to the generated subject PNG overlay with alpha channel.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Input image not found: {image_path}")

    if not output_path:
        base_dir = os.path.dirname(image_path)
        filename = os.path.splitext(os.path.basename(image_path))[0]
        output_path = os.path.join(base_dir, f"{filename}_subject.png")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    # 1. Try rembg
    if HAVE_REMBG:
        try:
            print(f"[Rotoscope] Attempting background removal using rembg for {image_path}...")
            input_img = Image.open(image_path).convert("RGBA")
            output_img = remove(input_img)
            output_img.save(output_path, "PNG")
            print(f"[Rotoscope] rembg segmentation successful: {output_path}")
            return os.path.abspath(output_path)
        except Exception as e:
            print(f"[Rotoscope] rembg failed ({e}), falling back...")

    # 2. Try OpenCV GrabCut fallback
    if HAVE_OPENCV:
        try:
            print(f"[Rotoscope] Attempting OpenCV GrabCut fallback for {image_path}...")
            img = cv2.imread(image_path)
            if img is not None:
                h, w = img.shape[:2]
                margin_w = int(w * 0.1)
                margin_h = int(h * 0.1)
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
                return os.path.abspath(output_path)
        except Exception as e:
            print(f"[Rotoscope] OpenCV fallback failed ({e}), falling back to PIL...")

    # 3. PIL Fallback (feathered center mask)
    print(f"[Rotoscope] Using PIL fallback subject extraction for {image_path}...")
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
    print(f"[Rotoscope] PIL fallback subject overlay saved: {output_path}")
    return os.path.abspath(output_path)

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
