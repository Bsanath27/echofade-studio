"""Generate a self-contained quad mapper HTML with embedded base64 frame images."""
import os
import base64

frames_dir = "/Users/sanathbs/03_Dev_Lab/projects/Personal/youtube videos/lyric-video-generator-v2/temp/mapper_frames"
html_template = "/Users/sanathbs/03_Dev_Lab/projects/Personal/youtube videos/lyric-video-generator-v2/temp/quad_mapper.html"
output_path = "/Users/sanathbs/03_Dev_Lab/projects/Personal/youtube videos/lyric-video-generator-v2/temp/quad_mapper_final.html"

# Read the HTML template
with open(html_template, "r") as f:
    html = f.read()

# Build a JS object mapping frame index -> base64 data URL
print("Encoding frames as base64...")
b64_entries = []
for idx in range(72):
    png_path = os.path.join(frames_dir, f"frame_{idx:03d}.png")
    if os.path.exists(png_path):
        with open(png_path, "rb") as img_f:
            b64 = base64.b64encode(img_f.read()).decode("ascii")
        b64_entries.append(f'{idx}: "data:image/png;base64,{b64}"')
        # print(f"  Encoded frame {idx:03d} ({os.path.getsize(png_path)} bytes)")

b64_map = "const FRAME_DATA_URLS = {\n  " + ",\n  ".join(b64_entries) + "\n};\n"

# Replace the loadFrame function to use embedded data
old_load = """// ── Load frames ──
function loadFrame(idx) {
  return new Promise((resolve) => {
    if (frameImages[idx]) { resolve(frameImages[idx]); return; }
    const img = new Image();
    img.onload = () => { frameImages[idx] = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = `../temp/mapper_frames/frame_${String(idx).padStart(3,'0')}.png`;
  });
}"""

new_load = b64_map + """
// ── Load frames (embedded base64) ──
function loadFrame(idx) {
  return new Promise((resolve) => {
    if (frameImages[idx]) { resolve(frameImages[idx]); return; }
    const dataUrl = FRAME_DATA_URLS[idx];
    if (!dataUrl) { resolve(null); return; }
    const img = new Image();
    img.onload = () => { frameImages[idx] = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}"""

html = html.replace(old_load, new_load)

with open(output_path, "w") as f:
    f.write(html)

print(f"\nSaved self-contained mapper: {output_path}")
print(f"File size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB")
