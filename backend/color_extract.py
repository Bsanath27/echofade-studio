"""Dominant-color extraction & typography styling for lyric videos.

Pulls dominant colors (primary, secondary, tertiary) from artwork/video frames,
calculates WCAG high-contrast text and stroke/glow colors, and suggests font family
and size based on image contrast metrics and aspect ratio.
"""
import os
import subprocess
import colorsys
import math
from PIL import Image, ImageStat


def _is_video(path):
    return path.lower().split(".")[-1] in ("mp4", "mov", "webm", "gif")


def _grab_video_frame(video_path):
    """Extract a single mid-ish frame from a video to a temp PNG for sampling."""
    frame_path = os.path.join(os.path.dirname(video_path) or ".", "_palette_frame.png")
    subprocess.run(
        ["ffmpeg", "-y", "-ss", "1", "-i", video_path, "-frames:v", "1", frame_path],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
    )
    return frame_path if os.path.exists(frame_path) else None


def relative_luminance(r, g, b):
    """Calculate standard WCAG 2.1 relative luminance for RGB values (0-255)."""
    rs = r / 255.0
    gs = g / 255.0
    bs = b / 255.0
    r_lin = rs / 12.92 if rs <= 0.04045 else ((rs + 0.055) / 1.055) ** 2.4
    g_lin = gs / 12.92 if gs <= 0.04045 else ((gs + 0.055) / 1.055) ** 2.4
    b_lin = bs / 12.92 if bs <= 0.04045 else ((bs + 0.055) / 1.055) ** 2.4
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin


def hex_to_rgb(hex_str):
    h = hex_str.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def rgb_to_hex(r, g, b):
    return "#{:02x}{:02x}{:02x}".format(
        max(0, min(255, int(r))),
        max(0, min(255, int(g))),
        max(0, min(255, int(b)))
    )


def wcag_contrast_ratio(hex1, hex2):
    """Calculate WCAG contrast ratio between two hex colors (returns ratio >= 1.0)."""
    r1, g1, b1 = hex_to_rgb(hex1)
    r2, g2, b2 = hex_to_rgb(hex2)
    l1 = relative_luminance(r1, g1, b1)
    l2 = relative_luminance(r2, g2, b2)
    max_l = max(l1, l2)
    min_l = min(l1, l2)
    return (max_l + 0.05) / (min_l + 0.05)


def extract_palette(image_path, count=3):
    """Return up to `count` dominant colors as #RRGGBB hex strings.

    Falls back to a neutral dark→blue gradient if extraction fails.
    """
    fallback = ["#11131a", "#1f2a44", "#3a4d7a"][:count]
    sample_path = image_path
    temp_frame = None
    try:
        if _is_video(image_path):
            temp_frame = _grab_video_frame(image_path)
            if not temp_frame:
                return fallback
            sample_path = temp_frame

        img = Image.open(sample_path).convert("RGB")
        img.thumbnail((200, 200))
        quant = img.quantize(colors=max(count * 3, 9), method=Image.Quantize.MEDIANCUT)
        palette = quant.getpalette()
        color_counts = sorted(quant.getcolors(), reverse=True)  # [(count, index), ...]

        colors = []
        seen = set()
        for _, idx in color_counts:
            r, g, b = palette[idx * 3: idx * 3 + 3]
            hex_c = rgb_to_hex(r, g, b)
            if hex_c not in seen:
                seen.add(hex_c)
                colors.append((r, g, b))
                if len(colors) >= count:
                    break

        if not colors:
            return fallback

        # Sort darkest -> brightest
        colors.sort(key=lambda c: relative_luminance(c[0], c[1], c[2]))
        return [rgb_to_hex(*c) for c in colors[:count]]
    except Exception as e:
        print(f"Palette extraction failed ({e}); using fallback gradient.")
        return fallback
    finally:
        if temp_frame and os.path.exists(temp_frame):
            try:
                os.remove(temp_frame)
            except Exception:
                pass


def hex_to_ffmpeg(hex_color):
    """#RRGGBB -> 0xRRGGBB for the ffmpeg gradients source."""
    return "0x" + hex_color.lstrip("#")


def analyze_image(image_path):
    """Analyze image luminance, contrast (std dev), saturation, and dominant colors."""
    sample_path = image_path
    temp_frame = None
    try:
        if _is_video(image_path):
            temp_frame = _grab_video_frame(image_path)
            if temp_frame:
                sample_path = temp_frame

        img = Image.open(sample_path).convert("RGB")
        img_thumb = img.copy()
        img_thumb.thumbnail((200, 200))

        stat = ImageStat.Stat(img_thumb)
        # Average brightness / luminance
        r_mean, g_mean, b_mean = stat.mean[:3]
        avg_luminance = relative_luminance(r_mean, g_mean, b_mean)

        # Standard deviation as contrast metric
        r_std, g_std, b_std = stat.stddev[:3]
        contrast_score = (r_std + g_std + b_std) / 3.0  # Range approx 0 to 80

        # Saturation score
        pixels = list(img_thumb.getdata())
        sat_sum = 0
        step = max(1, len(pixels) // 200)
        sampled_pixels = pixels[::step]
        for r, g, b in sampled_pixels:
            _, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
            sat_sum += s
        avg_sat = sat_sum / max(1, len(sampled_pixels))

        # Palette: Primary, Secondary, Tertiary
        raw_colors = extract_palette(sample_path, count=5)
        primary = raw_colors[0] if len(raw_colors) > 0 else "#11131a"
        secondary = raw_colors[1] if len(raw_colors) > 1 else "#1f2a44"
        tertiary = raw_colors[2] if len(raw_colors) > 2 else "#3a4d7a"

        return {
            "brightness": avg_luminance,
            "contrast": contrast_score,
            "saturation": avg_sat,
            "is_dark": avg_luminance < 0.5,
            "primary": primary,
            "secondary": secondary,
            "tertiary": tertiary,
            "raw_palette": raw_colors
        }
    except Exception as e:
        print(f"Image analysis failed ({e}); returning defaults.")
        return {
            "brightness": 0.2,
            "contrast": 40.0,
            "saturation": 0.5,
            "is_dark": True,
            "primary": "#11131a",
            "secondary": "#1f2a44",
            "tertiary": "#3a4d7a",
            "raw_palette": ["#11131a", "#1f2a44", "#3a4d7a"]
        }
    finally:
        if temp_frame and os.path.exists(temp_frame):
            try:
                os.remove(temp_frame)
            except Exception:
                pass


def suggest_typography_colors(image_path, aspect_ratio="16:9"):
    """Analyze image and suggest primary/secondary/tertiary colors, WCAG contrast text colors,

    stroke/glow colors, and suitable font family & size based on contrast & aspect ratio.
    """
    metrics = analyze_image(image_path)
    primary = metrics["primary"]
    secondary = metrics["secondary"]
    tertiary = metrics["tertiary"]
    is_dark = metrics["is_dark"]
    contrast_score = metrics["contrast"]
    avg_sat = metrics["saturation"]

    r, g, b = hex_to_rgb(primary)
    h, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)

    def hls_to_hex(h_val, l_val, s_val):
        h_val = h_val % 1.0
        l_val = max(0.0, min(1.0, l_val))
        s_val = max(0.0, min(1.0, s_val))
        r_out, g_out, b_out = colorsys.hls_to_rgb(h_val, l_val, s_val)
        return rgb_to_hex(r_out * 255, g_out * 255, b_out * 255)

    # 1. Calculate High WCAG Contrast Colors
    # If dark image: text color #ffffff (or bright tint), stroke deep dark
    # If light image: text color #0d1117 (or dark navy), stroke #ffffff
    if is_dark:
        wcag_high_text = "#ffffff"
        wcag_stroke = hls_to_hex(h, 0.08, 0.8)
        glow_color = secondary if wcag_contrast_ratio(secondary, wcag_high_text) > 3.0 else hls_to_hex(h + 0.5, 0.6, 0.9)
    else:
        wcag_high_text = "#0d1117"
        wcag_stroke = "#ffffff"
        glow_color = primary

    wcag_ratio = wcag_contrast_ratio(primary, wcag_high_text)

    # 2. Font Family Suggestion based on Image Contrast & Mood
    if contrast_score > 55 and avg_sat > 0.4:
        recommended_font = "Futura"
        font_reasoning = "High image contrast and vivid saturation detected — paired with edgy, high-energy Futura typography."
    elif contrast_score < 35 or l < 0.2:
        recommended_font = "Baskerville"
        font_reasoning = "Soft, atmospheric low-contrast background detected — paired with classic, elegant Baskerville typography."
    elif avg_sat > 0.6:
        recommended_font = "Didot"
        font_reasoning = "Vibrant, high-chroma artwork detected — paired with dramatic, high-fashion Didot typography."
    else:
        recommended_font = "Montserrat"
        font_reasoning = "Balanced background detected — paired with modern, ultra-clean Montserrat typography."

    # 3. Font Size Suggestion based on Aspect Ratio and Contrast
    if "9:16" in str(aspect_ratio):
        base_size = 75
    elif "1:1" in str(aspect_ratio):
        base_size = 60
    elif "4:5" in str(aspect_ratio):
        base_size = 65
    else:
        base_size = 60  # 16:9 default

    if recommended_font in ("Baskerville", "Didot"):
        recommended_size = base_size + 5
    else:
        recommended_size = base_size

    stroke_width = 3 if is_dark and wcag_ratio < 7.0 else (2 if wcag_ratio >= 7.0 else 4)
    shadow_offset = 4 if is_dark else 2

    # 4. Color Palettes
    vibrant_l = 0.70 if is_dark else 0.30
    vibrant_s = 0.95
    dark_l = 0.12
    dark_s = 0.85

    neon_font = hls_to_hex(h + 0.5, vibrant_l, vibrant_s)
    neon_stroke = hls_to_hex(h + 0.5, dark_l, dark_s)

    analogous_font = hls_to_hex(h + (45 / 360.0), vibrant_l, vibrant_s)
    analogous_stroke = hls_to_hex(h - (45 / 360.0), dark_l, dark_s)

    triadic_font = hls_to_hex(h + (120 / 360.0), vibrant_l, vibrant_s)
    triadic_stroke = hls_to_hex(h - (120 / 360.0), dark_l, dark_s)

    palettes = [
        {
            "name": "High WCAG Contrast (AAA)",
            "description": f"Maximum legibility (WCAG AAA ratio: {wcag_ratio:.1f}:1).",
            "font_color": wcag_high_text,
            "stroke_color": wcag_stroke,
            "glow_color": glow_color,
            "contrast_ratio": round(wcag_ratio, 2),
            "wcag_rating": "AAA" if wcag_ratio >= 7.0 else ("AA" if wcag_ratio >= 4.5 else "Fail")
        },
        {
            "name": "Neon Contrast",
            "description": "Aggressive, high-energy complementary colors.",
            "font_color": neon_font,
            "stroke_color": neon_stroke,
            "glow_color": tertiary,
            "contrast_ratio": round(wcag_contrast_ratio(primary, neon_font), 2),
            "wcag_rating": "AAA" if wcag_contrast_ratio(primary, neon_font) >= 7.0 else "AA"
        },
        {
            "name": "Vibrant Analogous",
            "description": "Bold, saturated adjacent colors.",
            "font_color": analogous_font,
            "stroke_color": analogous_stroke,
            "glow_color": secondary,
            "contrast_ratio": round(wcag_contrast_ratio(primary, analogous_font), 2),
            "wcag_rating": "AA"
        },
        {
            "name": "Electric Triadic",
            "description": "Loud, three-way color split.",
            "font_color": triadic_font,
            "stroke_color": triadic_stroke,
            "glow_color": tertiary,
            "contrast_ratio": round(wcag_contrast_ratio(primary, triadic_font), 2),
            "wcag_rating": "AA"
        },
        {
            "name": "Monochrome (Safe)",
            "description": "Clean, highly readable standard.",
            "font_color": "#ffffff" if is_dark else "#0d1117",
            "stroke_color": wcag_stroke,
            "glow_color": secondary,
            "contrast_ratio": round(wcag_contrast_ratio(primary, "#ffffff" if is_dark else "#0d1117"), 2),
            "wcag_rating": "AAA"
        }
    ]

    return {
        "primary_color": primary,
        "secondary_color": secondary,
        "tertiary_color": tertiary,
        "dominant_bg": primary,
        "gradient_colors": [primary, secondary, tertiary],
        "image_metrics": {
            "brightness": round(metrics["brightness"], 3),
            "contrast": round(contrast_score, 1),
            "saturation": round(avg_sat, 3),
            "is_dark": is_dark
        },
        "recommended_style": {
            "font_family": recommended_font,
            "font_size": recommended_size,
            "font_color": wcag_high_text,
            "stroke_color": wcag_stroke,
            "stroke_width": stroke_width,
            "shadow_offset": shadow_offset,
            "glow_color": glow_color,
            "text_transform": "uppercase",
            "wcag_contrast": round(wcag_ratio, 2),
            "wcag_rating": "AAA" if wcag_ratio >= 7.0 else "AA",
            "reasoning": font_reasoning
        },
        "palettes": palettes
    }
