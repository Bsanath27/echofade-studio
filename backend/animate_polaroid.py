import numpy as np
from moviepy import ImageClip, CompositeVideoClip, VideoClip
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont
import math
import os
import random

def vertical_blur(img, radius):
    if radius <= 0: return img
    arr = np.array(img, dtype=np.float32)
    h, w, c = arr.shape
    accum = np.zeros_like(arr)
    steps = int(radius) * 2 + 1
    for offset in range(-int(radius), int(radius)+1):
        shifted = np.zeros_like(arr)
        if offset > 0:
            shifted[offset:] = arr[:-offset]
        elif offset < 0:
            shifted[:offset] = arr[-offset:]
        else:
            shifted = arr.copy()
        accum += shifted
    accum /= steps
    return Image.fromarray(accum.astype(np.uint8))


def generate_polaroid_drop(bg_image_path, photo_path, text, output_path, seed=None, fps=24):
    """
    Programmatically animates a cinematic polaroid drop over a static background,
    featuring randomized Paper Sky automation parameters and exact physics.
    """
    if seed is not None:
        np.random.seed(seed)
        random.seed(seed)
        
    # --- Automation Parameters ---
    resting_angle = np.random.uniform(-2.5, 2.5)
    offset_x = np.random.randint(-25, 26)
    bounce_height = np.random.randint(12, 26)
    drop_duration = np.random.uniform(0.25, 0.33)
    shadow_end_alpha = np.random.randint(90, 121)
    
    # 1. Base Setup
    width, height = 1080, 1920
    
    bg_img_raw = Image.open(bg_image_path).convert("RGB")
    bg_w, bg_h = bg_img_raw.size
    scale_bg = max(width / bg_w, height / bg_h)
    new_w, new_h = int(bg_w * scale_bg), int(bg_h * scale_bg)
    bg_img = bg_img_raw.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = (new_w - width) // 2
    top = (new_h - height) // 2
    bg_img = bg_img.crop((left, top, left + width, top + height))
    
    # Environmental Shadow Tint
    small_bg = bg_img.resize((1, 1))
    avg_color = small_bg.getpixel((0, 0))
    shadow_color = (int(avg_color[0]*0.2), int(avg_color[1]*0.2), int(avg_color[2]*0.2))
    
    # Cinematic Background
    bg_img = bg_img.filter(ImageFilter.GaussianBlur(25))
    enhancer = ImageEnhance.Brightness(bg_img)
    bg_img = enhancer.enhance(0.3)
    
    vignette = Image.new('RGBA', (width, height), (0,0,0,0))
    vdraw = ImageDraw.Draw(vignette)
    for i in range(255):
        r = int(math.hypot(width/2, height/2) * (1 - i/255.0))
        if r > 0:
            vdraw.ellipse([(width/2 - r, height/2 - r), (width/2 + r, height/2 + r)], fill=(0,0,0, i//2))
    bg_img.paste(vignette, (0,0), vignette)
    
    bg_clip = ImageClip(np.array(bg_img)).with_duration(3.0)

    # 2. Create the Premium Polaroid Asset
    polaroid_w, polaroid_h = 800, 960
    corner_radius = 20
    pol_mask = Image.new('L', (polaroid_w, polaroid_h), 0)
    draw_mask = ImageDraw.Draw(pol_mask)
    draw_mask.rounded_rectangle([0, 0, polaroid_w, polaroid_h], radius=corner_radius, fill=255)
    
    pol_img = Image.new('RGBA', (polaroid_w, polaroid_h), (0,0,0,0))
    paper_color = (252, 250, 246, 255) # Matte Cotton
    
    base = Image.new('RGBA', (polaroid_w, polaroid_h), paper_color)
    base.putalpha(pol_mask)
    pol_img.paste(base, (0,0), base)
    
    # Randomized Fiber Texture
    noise = np.random.randint(0, 255, (polaroid_h, polaroid_w), dtype=np.uint8)
    noise_img = Image.fromarray(noise, 'L').filter(ImageFilter.GaussianBlur(1.5))
    noise_rgba = Image.new('RGBA', (polaroid_w, polaroid_h), (200, 195, 185, 255))
    noise_alpha = noise_img.point(lambda p: int(p * 0.04)) 
    noise_rgba.putalpha(noise_alpha)
    pol_img = Image.alpha_composite(pol_img, noise_rgba)
    pol_img.putalpha(pol_mask)
    
    draw = ImageDraw.Draw(pol_img)
    draw.rounded_rectangle([0, 0, polaroid_w-1, polaroid_h-1], radius=corner_radius, outline=(255,255,255,200), width=2)
    draw.rounded_rectangle([1, 1, polaroid_w, polaroid_h], radius=corner_radius, outline=(0,0,0,15), width=1)
    
    photo_size = 700
    margin = 50
    photo_radius = 8
    
    shadow_rect = Image.new('RGBA', (photo_size, photo_size), (0, 0, 0, 120))
    shadow_rect = shadow_rect.filter(ImageFilter.GaussianBlur(12))
    pol_img.paste(shadow_rect, (margin + 2, margin + 4), shadow_rect)
    
    user_photo = Image.open(photo_path).convert("RGBA")
    up_w, up_h = user_photo.size
    min_dim = min(up_w, up_h)
    user_photo = user_photo.crop(((up_w - min_dim)//2, (up_h - min_dim)//2, (up_w + min_dim)//2, (up_h + min_dim)//2))
    user_photo = user_photo.resize((photo_size, photo_size), Image.Resampling.LANCZOS)
    
    # Subtle exposure adjustment based on background
    blue_overlay = Image.new('RGBA', user_photo.size, (15, 25, 45, 60)) 
    user_photo = Image.alpha_composite(user_photo, blue_overlay)
    user_photo = ImageEnhance.Color(user_photo).enhance(1.1)
    user_photo = ImageEnhance.Contrast(user_photo).enhance(1.1)
    
    brights = user_photo.point(lambda p: p if p > 180 else 0)
    glow = brights.filter(ImageFilter.GaussianBlur(25))
    user_photo = Image.blend(user_photo, glow, 0.4)
    
    photo_mask = Image.new('L', (photo_size, photo_size), 0)
    ImageDraw.Draw(photo_mask).rounded_rectangle([0, 0, photo_size, photo_size], radius=photo_radius, fill=255)
    user_photo.putalpha(photo_mask)

    pol_img.paste(user_photo, (margin, margin), user_photo)
    
    # Editorial Typography (Charcoal)
    draw = ImageDraw.Draw(pol_img)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Times.ttc", 55)
    except:
        font = ImageFont.load_default()
    
    text_bbox = draw.textbbox((0,0), text, font=font) if hasattr(draw, 'textbbox') else draw.textsize(text, font=font)
    text_w = text_bbox[2] - text_bbox[0] if hasattr(draw, 'textbbox') else text_bbox[0]
    text_x = (polaroid_w - text_w) / 2
    text_y = 750 + (210 - (text_bbox[3] - text_bbox[1])) / 2
    draw.text((text_x, text_y), text, fill=(34, 33, 32, 255), font=font)

    # Base Supersampled Image
    pol_img_2x_base = pol_img.resize((polaroid_w * 2, polaroid_h * 2), Image.Resampling.LANCZOS)
    # Pre-rotate it because rotation is fixed!
    rotated_pol_2x_base = pol_img_2x_base.rotate(resting_angle, resample=Image.Resampling.BICUBIC, expand=True)
    # Pre-scale it back down
    rotated_pol_base = rotated_pol_2x_base.resize((int(rotated_pol_2x_base.width / 2), int(rotated_pol_2x_base.height / 2)), Image.Resampling.LANCZOS)


    # 3. Physics Constants
    DROP_START_Y = -960
    BOUNCE_1_DURATION = 0.12
    BOUNCE_2_HEIGHT = 3
    BOUNCE_2_DURATION = 0.08
    DROP_START_TIME = 0.08

    SHADOW_START_BLUR = 50
    SHADOW_END_BLUR = 8
    SHADOW_START_DIST = 80
    SHADOW_END_DIST = 12
    SHADOW_START_ALPHA = 30
    MOTION_BLUR_MAX = 14

    def make_frame(t):
        t_drop = t - DROP_START_TIME
        
        y = 0
        shadow_blur = SHADOW_END_BLUR
        shadow_dist = SHADOW_END_DIST
        shadow_alpha = shadow_end_alpha
        v_blur = 0
        
        if t < DROP_START_TIME:
            # Shadow fading in
            y = DROP_START_Y
            progress = t / DROP_START_TIME
            shadow_blur = SHADOW_START_BLUR
            shadow_dist = SHADOW_START_DIST
            shadow_alpha = int(SHADOW_START_ALPHA * progress)
            
        elif t_drop < drop_duration:
            # Dropping
            progress = t_drop / drop_duration
            y = DROP_START_Y * (1 - progress**2)
            
            shadow_blur = SHADOW_START_BLUR - (SHADOW_START_BLUR - SHADOW_END_BLUR) * progress
            shadow_dist = SHADOW_START_DIST - (SHADOW_START_DIST - SHADOW_END_DIST) * progress
            shadow_alpha = int(SHADOW_START_ALPHA + (shadow_end_alpha - SHADOW_START_ALPHA) * progress)
            
            v_blur = int(MOTION_BLUR_MAX * math.sin(progress * math.pi))
            
        elif t_drop < drop_duration + BOUNCE_1_DURATION:
            # First Bounce (sine arc)
            progress = (t_drop - drop_duration) / BOUNCE_1_DURATION
            y = -bounce_height * math.sin(progress * math.pi)
            
        elif t_drop < drop_duration + BOUNCE_1_DURATION + BOUNCE_2_DURATION:
            # Second Bounce
            progress = (t_drop - drop_duration - BOUNCE_1_DURATION) / BOUNCE_2_DURATION
            y = -BOUNCE_2_HEIGHT * math.sin(progress * math.pi)
            
        else:
            y = 0

        # Create canvas for this frame
        canvas = Image.new('RGBA', (width, height), (0,0,0,0))
        
        rotated_pol = rotated_pol_base
        
        if v_blur > 0:
            rotated_pol = vertical_blur(rotated_pol_base, v_blur)
            
        # Draw Shadow
        shadow = Image.new('RGBA', rotated_pol.size, (0,0,0,0))
        shadow_mask = rotated_pol.split()[3]
        shadow.paste((shadow_color[0], shadow_color[1], shadow_color[2], shadow_alpha), (0,0), shadow_mask)
        shadow = shadow.filter(ImageFilter.GaussianBlur(float(shadow_blur)))
        
        paste_x = int((width - rotated_pol.width) / 2) + offset_x
        paste_y = int((height - rotated_pol.height) / 2 + y)
        
        # Ensure polaroid is visible only if y > DROP_START_Y
        if y > DROP_START_Y + 10:
            canvas.paste(shadow, (paste_x, paste_y + int(shadow_dist)), shadow)
            canvas.paste(rotated_pol, (paste_x, paste_y), rotated_pol)
        else:
            # Just shadow
            canvas.paste(shadow, (paste_x, paste_y + int(shadow_dist)), shadow)
            
        return np.array(canvas)

    animated_polaroid = VideoClip(make_frame, duration=3.0)
    final_video = CompositeVideoClip([bg_clip, animated_polaroid])
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    final_video.write_videofile(output_path, fps=fps, codec="libx264", audio=False)
    print(f"Animation saved to {output_path}")

if __name__ == "__main__":
    photo = "../assets/backgrounds/bg_19.jpg"
    out = "../temp/cinematic_drop.mp4"
    
    if os.path.exists(photo):
        # We test with a fixed seed so we can review one specific variation
        generate_polaroid_drop(photo, photo, "Nostalgia", out, seed=42)
