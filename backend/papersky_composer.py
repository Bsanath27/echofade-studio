import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy import VideoFileClip

# ──────────────────────────────────────────────────────────────────────────────
# Quad corner coordinates per frame: TL=(x,y), TR=(x,y), BR=(x,y), BL=(x,y)
# Detected via pure-grayscale mask (R≈G≈B, diff≤1) on the checkerboard cutout.
# ──────────────────────────────────────────────────────────────────────────────
QUAD_CORNERS = {
    7: ((167, 80), (552, 71), (555, 449), (171, 457)),
    8: ((165, 127), (552, 119), (556, 502), (169, 520)),
    9: ((165, 187), (552, 179), (556, 562), (169, 580)),
    10: ((165, 234), (552, 226), (556, 609), (169, 627)),
    11: ((165, 270), (552, 262), (556, 645), (169, 663)),
    12: ((161, 361), (550, 343), (562, 723), (179, 731)),
    13: ((161, 394), (550, 376), (562, 756), (179, 764)),
    14: ((161, 422), (550, 404), (562, 784), (179, 792)),
    15: ((167, 415), (556, 410), (556, 790), (173, 786)),
    16: ((183, 403), (557, 411), (548, 783), (169, 777)),
    17: ((183, 394), (562, 412), (543, 784), (164, 767)),
    18: ((187, 387), (566, 413), (539, 788), (160, 762)),
    19: ((189, 378), (565, 411), (538, 783), (156, 759)),
    20: ((189, 378), (565, 411), (538, 783), (156, 759)),
    21: ((189, 378), (565, 411), (538, 783), (156, 759)),
    22: ((185, 389), (566, 412), (537, 784), (155, 758)),
    23: ((183, 391), (564, 410), (540, 787), (163, 763)),
    24: ((179, 395), (560, 406), (544, 783), (165, 773)),
    25: ((177, 397), (558, 404), (546, 781), (167, 775)),
    26: ((173, 403), (554, 402), (550, 777), (171, 779)),
    27: ((169, 407), (550, 398), (554, 773), (175, 783)),
    28: ((165, 411), (546, 394), (558, 769), (179, 787)),
    29: ((163, 413), (544, 392), (560, 767), (181, 789)),
    30: ((163, 413), (544, 392), (560, 767), (181, 789)),
    31: ((163, 413), (544, 392), (560, 767), (181, 789)),
    32: ((164, 412), (545, 393), (559, 768), (180, 788)),
    33: ((165, 411), (546, 394), (558, 769), (179, 787)),
    34: ((166, 410), (547, 395), (557, 770), (178, 786)),
    35: ((168, 408), (549, 397), (555, 772), (176, 784)),
    36: ((170, 406), (551, 399), (554, 779), (174, 782)),
    37: ((172, 404), (553, 401), (552, 781), (172, 780)),
    38: ((174, 402), (555, 403), (550, 783), (170, 778)),
    39: ((177, 399), (558, 406), (547, 786), (167, 775)),
    40: ((177, 399), (558, 406), (547, 786), (167, 775)),
    41: ((177, 399), (558, 406), (547, 786), (167, 775)),
    42: ((177, 399), (558, 406), (547, 786), (167, 775)),
    43: ((177, 399), (558, 406), (547, 786), (167, 775)),
    44: ((177, 399), (558, 406), (547, 786), (167, 775)),
    45: ((171, 407), (552, 409), (550, 781), (167, 779)),
    46: ((171, 407), (552, 409), (550, 781), (167, 779)),
    47: ((171, 407), (552, 409), (550, 781), (167, 779)),
    48: ((171, 407), (552, 409), (550, 781), (167, 779)),
    49: ((171, 407), (552, 409), (550, 781), (167, 779)),
    50: ((171, 407), (552, 409), (550, 781), (167, 779)),
    51: ((171, 407), (552, 409), (550, 781), (167, 779)),
    52: ((171, 407), (552, 409), (550, 781), (167, 779)),
    53: ((171, 407), (552, 409), (550, 781), (167, 779)),
    54: ((171, 407), (552, 409), (550, 781), (167, 779)),
    55: ((171, 407), (552, 409), (550, 781), (167, 779)),
    56: ((171, 407), (552, 409), (550, 781), (167, 779)),
    57: ((171, 407), (552, 409), (550, 781), (167, 779)),
    58: ((171, 407), (552, 409), (550, 781), (167, 779)),
    59: ((171, 407), (552, 409), (550, 781), (167, 779)),
    60: ((171, 407), (552, 409), (550, 781), (167, 779)),
    61: ((171, 407), (552, 409), (550, 781), (167, 779)),
    62: ((171, 407), (552, 409), (550, 781), (167, 779)),
    63: ((171, 407), (552, 409), (550, 781), (167, 779)),
    64: ((171, 407), (552, 409), (550, 781), (167, 779)),
    65: ((171, 407), (552, 409), (550, 781), (167, 779)),
    66: ((171, 407), (552, 409), (550, 781), (167, 779)),
    67: ((171, 407), (552, 409), (550, 781), (167, 779)),
    68: ((171, 407), (552, 409), (550, 781), (167, 779)),
    69: ((171, 407), (552, 409), (550, 781), (167, 779)),
    70: ((171, 407), (552, 409), (550, 781), (167, 779)),
    71: ((171, 407), (552, 409), (550, 781), (167, 779)),
}

# Stable quad after frame 71
STATIC_QUAD = ((171, 407), (552, 409), (550, 781), (167, 779))

# Text area: bottom white border of the polaroid card, below the photo cutout.
# Detected by finding the center of the white region below the bottom edge of the cutout.
# The text center Y is approximately 62px below the bottom edge of the cutout.
TEXT_Y_OFFSET = 62


def _find_perspective_coeffs(src_coords, dst_coords):
    """Calculate the 8 perspective transform coefficients.

    Maps src_coords -> dst_coords where each is a list of 4 (x, y) tuples:
      [top-left, top-right, bottom-right, bottom-left]

    Returns 8 coefficients for PIL's Image.transform(PERSPECTIVE).
    The transform maps (x', y') in source to (x, y) in destination via:
      x = (a*x' + b*y' + c) / (g*x' + h*y' + 1)
      y = (d*x' + e*y' + f) / (g*x' + h*y' + 1)
    """
    matrix = []
    for s, d in zip(src_coords, dst_coords):
        matrix.append([d[0], d[1], 1, 0, 0, 0, -s[0] * d[0], -s[0] * d[1]])
        matrix.append([0, 0, 0, d[0], d[1], 1, -s[1] * d[0], -s[1] * d[1]])
    A = np.array(matrix, dtype=np.float64)
    B = np.array([s for pair in src_coords for s in pair], dtype=np.float64)
    coeffs = np.linalg.solve(A, B)
    return tuple(coeffs.tolist())


def _warp_image_into_quad(user_bg_img, quad, frame_size=(720, 1280)):
    """Warp user_bg_img into the quad on a transparent canvas of frame_size.

    quad: (TL, TR, BR, BL) each as (x, y)
    Returns an RGBA PIL Image of frame_size with the warped image and transparency
    outside the quad.
    """
    w, h = frame_size
    img_w, img_h = user_bg_img.size

    # Source corners (corners of the user background image)
    src = [(0, 0), (img_w, 0), (img_w, img_h), (0, img_h)]
    # Destination corners (quad in the video frame)
    dst = list(quad)

    coeffs = _find_perspective_coeffs(src, dst)

    # Create RGBA version of the user image for masking
    if user_bg_img.mode != "RGBA":
        rgba_bg = user_bg_img.convert("RGBA")
    else:
        rgba_bg = user_bg_img.copy()

    # Warp into the full frame size
    warped = rgba_bg.transform(
        (w, h),
        Image.Transform.PERSPECTIVE,
        coeffs,
        Image.Resampling.BICUBIC,
    )
    return warped


def compose_papersky_intro(
    intro_video_path: str,
    bg_image_path: str,
    text: str,
    output_path: str,
    font_path: str,
    font_size: int = 34,
    font_color: str = "#262626",
    quality: str = "final",
):
    """Compose the Papersky Polaroid intro video by perspective-warping the background
    image into the tracked card cutout and drawing custom text on the bottom border.
    """
    if not os.path.exists(intro_video_path):
        raise FileNotFoundError(f"Intro video not found: {intro_video_path}")
    if not os.path.exists(bg_image_path):
        raise FileNotFoundError(f"Background image not found: {bg_image_path}")

    intro_clip = VideoFileClip(intro_video_path)
    user_bg_img = Image.open(bg_image_path).convert("RGB")
    fps = intro_clip.fps

    try:
        pil_font = ImageFont.truetype(font_path, font_size)
    except Exception:
        pil_font = ImageFont.load_default()

    def _extrapolate_quad(frame_idx):
        """Extrapolate quad corners backwards for frames 0-6 where the card
        is sliding in from the top of the screen."""
        base_quad = QUAD_CORNERS[7]  # first detected frame
        speed = 45.7  # pixels per frame downward
        offset = int(round((7 - frame_idx) * speed))
        return tuple((x, y - offset) for (x, y) in base_quad)

    def _text_center(quad):
        """Calculate the text center position below the photo cutout."""
        _, _, br, bl = quad
        mid_x = (bl[0] + br[0]) // 2
        mid_y = max(bl[1], br[1]) + TEXT_Y_OFFSET
        return mid_x, mid_y

    def process_frame(get_frame_func, t):
        frame = get_frame_func(t)
        frame_idx = int(round(t * fps))

        # 1. Determine the quad for this frame
        if frame_idx >= 7:
            quad = QUAD_CORNERS.get(frame_idx, STATIC_QUAD)
        else:
            quad = _extrapolate_quad(frame_idx)

        tl, tr, br, bl = quad

        # If entirely off-screen, skip
        if max(tl[1], tr[1], br[1], bl[1]) <= 0:
            return frame

        # 2. Expand the quad aggressively by 30% (1.30x) for the photo to cover bad tracking
        cx = sum(p[0] for p in quad) / 4.0
        cy = sum(p[1] for p in quad) / 4.0
        expanded_quad = tuple((cx + (p[0] - cx) * 1.30, cy + (p[1] - cy) * 1.30) for p in quad)

        # 3. Perspective-warp the user image into the expanded quad
        warped = _warp_image_into_quad(user_bg_img, expanded_quad, frame_size=(frame.shape[1], frame.shape[0]))

        # 4. Make the video frame's inner checkerboard transparent robustly
        r = frame[:,:,0].astype(np.float32)
        g = frame[:,:,1].astype(np.float32)
        b = frame[:,:,2].astype(np.float32)
        lightness = (r + g + b) / 3.0

        # Identify all checkerboard-like pixels in the frame
        is_gray = (np.abs(r - g) <= 8) & (np.abs(g - b) <= 8) & (np.abs(r - b) <= 8)
        is_checker = is_gray & (lightness > 140) & (lightness < 230)

        # Use connected components to isolate the inner cutout (stopping at the polaroid frame)
        from scipy.ndimage import binary_dilation, label
        # Dilate slightly to connect checkerboard squares across compression gaps
        solid_checker = binary_dilation(is_checker, iterations=3)
        labeled, num = label(solid_checker)

        # Find the label that corresponds to the inner cutout by checking the quad center
        cy_int, cx_int = int(cy), int(cx)
        y_min, y_max = max(0, cy_int-25), min(frame.shape[0], cy_int+25)
        x_min, x_max = max(0, cx_int-25), min(frame.shape[1], cx_int+25)
        neighborhood = labeled[y_min:y_max, x_min:x_max]
        labels, counts = np.unique(neighborhood[neighborhood > 0], return_counts=True)
        
        alpha = np.full((frame.shape[0], frame.shape[1]), 255, dtype=np.uint8)
        
        if len(labels) > 0:
            target_label = labels[np.argmax(counts)]
            inner_mask = (labeled == target_label)
            
            # Preserve the drop shadow inside the cutout
            # shadow_alpha is 255 for dark pixels (<100), 0 for light pixels (>150)
            shadow_alpha = np.clip((150 - lightness) / 50 * 255, 0, 255).astype(np.uint8)
            alpha[inner_mask] = shadow_alpha[inner_mask]
        else:
            # Fallback if detection fails (should not happen)
            pass

        
        vid_rgba = np.dstack((frame, alpha))
        pil_frame = Image.fromarray(vid_rgba, "RGBA")

        # 5. Composite video frame ON TOP of the warped photo
        composed_frame = Image.alpha_composite(warped, pil_frame)

        # 6. Draw text
        if text:
            cx, cy = _text_center(quad)
            if 0 < cy < frame.shape[0] - 20:
                draw = ImageDraw.Draw(composed_frame)
                left, top, right, bottom = draw.textbbox((0, 0), text, font=pil_font)
                tw, th = right - left, bottom - top
                draw.text((cx - tw // 2, cy - th // 2), text, fill=font_color, font=pil_font)

        return np.array(composed_frame.convert("RGB"))

    composed_clip = intro_clip.transform(lambda gf, t: process_frame(gf, t))

    composed_clip.write_videofile(
        output_path,
        fps=24,
        codec="h264_videotoolbox" if os.name != "nt" else "libx264",
        preset="fast" if quality == "final" else "ultrafast",
        ffmpeg_params=["-pix_fmt", "yuv420p"],
        audio=False,
        threads=4,
        logger=None,
    )

    composed_clip.close()
    intro_clip.close()
    return output_path
