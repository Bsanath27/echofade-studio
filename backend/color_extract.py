"""Dominant-color extraction for gradient backgrounds.

Pulls the most prominent colors from an image so we can build a color-matched
gradient instead of using the literal artwork. Pillow is already available via
MoviePy, so this adds no new dependency.
"""
import os
import subprocess
from PIL import Image


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


def extract_palette(image_path, count=3):
    """Return up to `count` dominant colors as #RRGGBB hex strings, darkest→brightest.

    Falls back to a neutral dark→blue gradient if extraction fails for any reason.
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
        # Downscale for speed, then quantize to a small palette by frequency.
        img.thumbnail((200, 200))
        quant = img.quantize(colors=max(count * 2, 6), method=Image.Quantize.MEDIANCUT)
        palette = quant.getpalette()
        color_counts = sorted(quant.getcolors(), reverse=True)  # [(count, index), ...]

        colors = []
        for _, idx in color_counts:
            r, g, b = palette[idx * 3: idx * 3 + 3]
            colors.append((r, g, b))
            if len(colors) >= count:
                break

        if not colors:
            return fallback

        # Sort darkest -> brightest so the gradient reads top-dark, bottom-light.
        colors.sort(key=lambda c: c[0] + c[1] + c[2])
        return ["#{:02x}{:02x}{:02x}".format(*c) for c in colors[:count]]
    except Exception as e:
        print(f"Palette extraction failed ({e}); using fallback gradient.")
        return fallback
    finally:
        if temp_frame and os.path.exists(temp_frame):
            os.remove(temp_frame)


def hex_to_ffmpeg(hex_color):
    """#RRGGBB -> 0xRRGGBB for the ffmpeg gradients source."""
    return "0x" + hex_color.lstrip("#")
