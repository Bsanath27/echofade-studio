import numpy as np
import math
import os
import random
from moviepy import ImageClip, CompositeVideoClip, VideoClip, VideoFileClip, AudioFileClip, vfx
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont
import time

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


def create_papersky_video(
    media_path: str,
    audio_path: str,
    output_path: str,
    settings: dict,
    progress_file: str = None,
    lyrics_data: list = None
):
    """
    Renders the Paper Sky Cinematic Polaroid layout.
    Supports Image and Video inside the polaroid.
    Background Mode: 'memory' or 'atmosphere'
    """
    # 1. Setup Assets and Settings
    width, height = 1080, 1920
    fps = 24
    
    audio_clip = AudioFileClip(audio_path)
    duration = audio_clip.duration
    
    bg_mode = settings.get('papersky_bg_mode', 'memory').lower()
    atmosphere_asset = settings.get('papersky_atmosphere', 'Blue Hour')
    caption_text = settings.get('papersky_caption', 'Nostalgia')
    
    seed = settings.get('papersky_seed', None)
    if seed is not None:
        np.random.seed(seed)
        random.seed(seed)
        
    # --- Automation Parameters ---
    resting_angle = np.random.uniform(-2.5, 2.5)
    offset_x = np.random.randint(-25, 26)
    bounce_height = np.random.randint(12, 26)
    drop_duration = np.random.uniform(0.25, 0.33)
    shadow_end_alpha = np.random.randint(90, 121)
    
    # 2. Setup Foreground Media (Image or Video)
    ext = media_path.lower().split(".")[-1]
    is_video = ext in ["mp4", "mov", "webm", "gif"]
    
    if is_video:
        fg_clip = VideoFileClip(media_path).with_effects([vfx.Loop(duration=duration)])
    else:
        # Static image
        fg_img_cache = Image.open(media_path).convert("RGB")
        fg_clip = None

    def get_fg_frame(t):
        if is_video:
            return Image.fromarray(fg_clip.get_frame(t))
        return fg_img_cache

    # 3. Setup Background
    if bg_mode == 'atmosphere':
        # Find the asset
        mapping = {
            "blue hour": "bg_02.jpg",
            "rain letter": "bg_03.jpg",
            "cinema noir": "bg_04.jpg",
            "quiet ocean": "bg_05.jpg",
            "morning paper": "bg_07.jpg",
            "forest echo": "bg_08.jpg",
            "autumn light": "bg_10.jpg",
            "moonlight": "bg_11.jpg"
        }
        asset_filename = mapping.get(atmosphere_asset.lower(), "bg_02.jpg")
        asset_path = os.path.join(os.path.dirname(__file__), "..", "assets", "backgrounds", asset_filename)
        if not os.path.exists(asset_path):
            print(f"Atmosphere asset {asset_filename} not found, falling back to memory mode.")
            bg_mode = 'memory'
        else:
            bg_img_raw = Image.open(asset_path).convert("RGB")
            bg_w, bg_h = bg_img_raw.size
            scale_bg = max(width / bg_w, height / bg_h)
            new_w, new_h = int(bg_w * scale_bg), int(bg_h * scale_bg)
            bg_img = bg_img_raw.resize((new_w, new_h), Image.Resampling.LANCZOS)
            left = (new_w - width) // 2
            top = (new_h - height) // 2
            bg_img = bg_img.crop((left, top, left + width, top + height))
            
            # Museum archival paper grade
            vignette = Image.new('RGBA', (width, height), (0,0,0,0))
            vdraw = ImageDraw.Draw(vignette)
            for i in range(255):
                r = int(math.hypot(width/2, height/2) * (1 - i/255.0))
                if r > 0:
                    vdraw.ellipse([(width/2 - r, height/2 - r), (width/2 + r, height/2 + r)], fill=(0,0,0, i//3))
            bg_img.paste(vignette, (0,0), vignette)
            bg_clip = ImageClip(np.array(bg_img)).with_duration(duration)

    elif bg_mode == 'custom':
        custom_bg_path = settings.get('papersky_bg_image_path')
        if not custom_bg_path or not os.path.exists(custom_bg_path):
            print("Custom background image not found, falling back to memory mode.")
            bg_mode = 'memory'
        else:
            bg_img_raw = Image.open(custom_bg_path).convert("RGB")
            bg_w, bg_h = bg_img_raw.size
            scale_bg = max(width / bg_w, height / bg_h)
            new_w, new_h = int(bg_w * scale_bg), int(bg_h * scale_bg)
            bg_img = bg_img_raw.resize((new_w, new_h), Image.Resampling.LANCZOS)
            left = (new_w - width) // 2
            top = (new_h - height) // 2
            bg_img = bg_img.crop((left, top, left + width, top + height))
            
            # Museum archival paper grade (Vignette)
            vignette = Image.new('RGBA', (width, height), (0,0,0,0))
            vdraw = ImageDraw.Draw(vignette)
            for i in range(255):
                r = int(math.hypot(width/2, height/2) * (1 - i/255.0))
                if r > 0:
                    vdraw.ellipse([(width/2 - r, height/2 - r), (width/2 + r, height/2 + r)], fill=(0,0,0, i//3))
            bg_img.paste(vignette, (0,0), vignette)
            bg_clip = ImageClip(np.array(bg_img)).with_duration(duration)

    if bg_mode == 'memory':
        # We need a dynamic background if foreground is video, else static
        if not is_video:
            # Generate static memory background
            bg_img_raw = fg_img_cache.copy()
            bg_w, bg_h = bg_img_raw.size
            scale_bg = max(width / bg_w, height / bg_h) * 1.35 # 135% scale
            new_w, new_h = int(bg_w * scale_bg), int(bg_h * scale_bg)
            bg_img = bg_img_raw.resize((new_w, new_h), Image.Resampling.LANCZOS)
            left = (new_w - width) // 2
            top = (new_h - height) // 2
            bg_img = bg_img.crop((left, top, left + width, top + height))
            
            bg_img = bg_img.filter(ImageFilter.GaussianBlur(35))
            bg_img = ImageEnhance.Color(bg_img).enhance(0.6)
            bg_img = ImageEnhance.Contrast(bg_img).enhance(0.8)
            
            vignette = Image.new('RGBA', (width, height), (0,0,0,0))
            vdraw = ImageDraw.Draw(vignette)
            for i in range(255):
                r = int(math.hypot(width/2, height/2) * (1 - i/255.0))
                if r > 0:
                    vdraw.ellipse([(width/2 - r, height/2 - r), (width/2 + r, height/2 + r)], fill=(0,0,0, int(i*0.8)))
            bg_img.paste(vignette, (0,0), vignette)
            bg_clip = ImageClip(np.array(bg_img)).with_duration(duration)
        else:
            # Video memory background
            def make_bg_frame(t):
                f_img = get_fg_frame(t)
                bg_w, bg_h = f_img.size
                scale_bg = max(width / bg_w, height / bg_h) * 1.35
                new_w, new_h = int(bg_w * scale_bg), int(bg_h * scale_bg)
                bg_img = f_img.resize((new_w, new_h), Image.Resampling.BILINEAR)
                left = (new_w - width) // 2
                top = (new_h - height) // 2
                bg_img = bg_img.crop((left, top, left + width, top + height))
                
                bg_img = bg_img.filter(ImageFilter.GaussianBlur(35))
                bg_img = ImageEnhance.Color(bg_img).enhance(0.6)
                bg_img = ImageEnhance.Contrast(bg_img).enhance(0.8)
                
                vignette = Image.new('RGBA', (width, height), (0,0,0,0))
                vdraw = ImageDraw.Draw(vignette)
                for i in range(255):
                    r = int(math.hypot(width/2, height/2) * (1 - i/255.0))
                    if r > 0:
                        vdraw.ellipse([(width/2 - r, height/2 - r), (width/2 + r, height/2 + r)], fill=(0,0,0, int(i*0.8)))
                bg_img.paste(vignette, (0,0), vignette)
                return np.array(bg_img)
            
            bg_clip = VideoClip(make_bg_frame, duration=duration)
            
    # Shadow Color (grabbed from t=0 background center)
    sample_frame = Image.fromarray(bg_clip.get_frame(0))
    small_bg = sample_frame.resize((1, 1))
    avg_color = small_bg.getpixel((0, 0))
    shadow_color = (int(avg_color[0]*0.2), int(avg_color[1]*0.2), int(avg_color[2]*0.2))
    
    # 4. Prepare Static Polaroid Frame Elements
    polaroid_w, polaroid_h = 800, 960
    corner_radius = 20
    pol_mask = Image.new('L', (polaroid_w, polaroid_h), 0)
    draw_mask = ImageDraw.Draw(pol_mask)
    draw_mask.rounded_rectangle([0, 0, polaroid_w, polaroid_h], radius=corner_radius, fill=255)
    
    base_frame = Image.new('RGBA', (polaroid_w, polaroid_h), (0,0,0,0))
    paper_color = (252, 250, 246, 255) # Matte Cotton
    base_color = Image.new('RGBA', (polaroid_w, polaroid_h), paper_color)
    base_color.putalpha(pol_mask)
    base_frame.paste(base_color, (0,0), base_color)
    
    # Noise texture
    noise = np.random.randint(0, 255, (polaroid_h, polaroid_w), dtype=np.uint8)
    noise_img = Image.fromarray(noise, 'L').filter(ImageFilter.GaussianBlur(1.5))
    noise_rgba = Image.new('RGBA', (polaroid_w, polaroid_h), (200, 195, 185, 255))
    noise_alpha = noise_img.point(lambda p: int(p * 0.04)) 
    noise_rgba.putalpha(noise_alpha)
    base_frame = Image.alpha_composite(base_frame, noise_rgba)
    base_frame.putalpha(pol_mask)
    
    # Outlines
    draw = ImageDraw.Draw(base_frame)
    draw.rounded_rectangle([0, 0, polaroid_w-1, polaroid_h-1], radius=corner_radius, outline=(255,255,255,200), width=2)
    draw.rounded_rectangle([1, 1, polaroid_w, polaroid_h], radius=corner_radius, outline=(0,0,0,15), width=1)
    
    photo_size = 700
    margin = 50
    photo_radius = 8
    
    # Inner shadow
    shadow_rect = Image.new('RGBA', (photo_size, photo_size), (0, 0, 0, 120))
    shadow_rect = shadow_rect.filter(ImageFilter.GaussianBlur(12))
    base_frame.paste(shadow_rect, (margin + 2, margin + 4), shadow_rect)
    
    # Font Selection (Fallback for Genty)
    font_choice = settings.get('papersky_font', 'Pacifico')
    font_paths = {
        'Pacifico': '/System/Library/Fonts/Supplemental/Brush Script.ttf', # Best native script fallback
    }
    try:
        font_path = font_paths.get(font_choice, '/System/Library/Fonts/Supplemental/Brush Script.ttf')
        if not os.path.exists(font_path):
            font_path = '/System/Library/Fonts/Supplemental/Brush Script.ttf'
        
        font_size = int(settings.get('papersky_font_size', 42))
        font = ImageFont.truetype(font_path, font_size)
    except:
        font = ImageFont.load_default()

    # Parse hex color safely
    hex_color = settings.get('papersky_font_color', '#F6F4EF').lstrip('#')
    try:
        r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    except:
        r, g, b = (246, 244, 239)
        
    text_color = (r, g, b, int(255 * 0.95))
    shadow_color = (0, 0, 0, 100) # Subtle shadow

    photo_mask = Image.new('L', (photo_size, photo_size), 0)
    ImageDraw.Draw(photo_mask).rounded_rectangle([0, 0, photo_size, photo_size], radius=photo_radius, fill=255)
    
    # Pre-render texts outside the frame loop for MASSIVE performance boost
    song_title = settings.get('papersky_song_title', '')
    caption = settings.get('papersky_caption', '')
    
    song_title_overlay = None
    if song_title:
        placement = settings.get('papersky_placement', 'bottom-center')
        song_title_overlay = Image.new('RGBA', (700, 700), (0,0,0,0))
        tdraw = ImageDraw.Draw(song_title_overlay)
        
        if hasattr(tdraw, 'textbbox'):
            bbox = tdraw.textbbox((0,0), song_title, font=font, align="center")
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
        else:
            text_w, text_h = tdraw.textsize(song_title, font=font)
        
        padding = 50
        
        # X coordinate
        if 'left' in placement:
            tx = padding
        elif 'right' in placement:
            tx = 700 - text_w - padding
        else:
            tx = (700 - text_w) / 2
            
        # Y coordinate
        if 'top' in placement:
            ty = padding
        elif 'center' == placement:
            ty = (700 - text_h) / 2
        else: # bottom
            ty = 700 - text_h - padding
        
        tdraw.text((tx+2, ty+2), song_title, fill=shadow_color, font=font)
        tdraw.text((tx, ty), song_title, fill=text_color, font=font)

    caption_overlay = None
    if caption:
        caption_overlay = Image.new('RGBA', (polaroid_w, 200), (0,0,0,0))
        cdraw = ImageDraw.Draw(caption_overlay)
        
        try:
            caption_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf', 50)
        except:
            caption_font = ImageFont.load_default()
            
        # Ink Colors mapped to Atmosphere
        atmosphere = settings.get('papersky_atmosphere', 'Morning Paper')
        ink_colors = {
            'Blue Hour': (89, 109, 138, 255),
            'Rain Letter': (89, 109, 138, 255),
            'Quiet Ocean': (89, 109, 138, 255),
            'Forest Echo': (107, 116, 100, 255),
            'Autumn Light': (106, 81, 71, 255),
            'Moonlight': (117, 108, 131, 255),
            'Cinema Noir': (59, 59, 59, 255),
        }
        ink_color = ink_colors.get(atmosphere, (68, 66, 62, 255))
        
        import textwrap
        lines = textwrap.wrap(caption, width=28)
        caption_spaced = "\n".join(lines)
        
        if hasattr(cdraw, 'multiline_textbbox'):
            text_bbox = cdraw.multiline_textbbox((0,0), caption_spaced, font=caption_font, align="center")
            text_w = text_bbox[2] - text_bbox[0]
            text_h = text_bbox[3] - text_bbox[1]
        else:
            text_w, text_h = cdraw.textsize(caption_spaced, font=caption_font)
        
        tx = (polaroid_w - text_w) / 2
        ty = (200 - text_h) / 2
        
        if hasattr(cdraw, 'multiline_text'):
            cdraw.multiline_text((tx, ty), caption_spaced, fill=ink_color, font=caption_font, align="center", spacing=4)
        else:
            cdraw.text((tx, ty), caption_spaced, fill=ink_color, font=caption_font)

    # Physics Constants
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
    
    import threading
    
    # 5. Make Frame function
    def make_frame(t):
        if progress_file:
            prog = 15 + int((t / duration) * 85)
            try:
                import json
                with open(progress_file, "w") as f:
                    json.dump({"progress": prog, "stage": "rendering"}, f)
            except:
                pass

        t_drop = t - DROP_START_TIME
        
        y = 0
        shadow_blur = SHADOW_END_BLUR
        shadow_dist = SHADOW_END_DIST
        shadow_alpha = shadow_end_alpha
        v_blur = 0
        
        if t < DROP_START_TIME:
            y = DROP_START_Y
            progress = t / DROP_START_TIME if DROP_START_TIME > 0 else 1.0
            shadow_blur = SHADOW_START_BLUR
            shadow_dist = SHADOW_START_DIST
            shadow_alpha = int(SHADOW_START_ALPHA * progress)
            
        elif t_drop < drop_duration:
            progress = t_drop / drop_duration
            y = DROP_START_Y * (1 - progress**2)
            
            shadow_blur = SHADOW_START_BLUR - (SHADOW_START_BLUR - SHADOW_END_BLUR) * progress
            shadow_dist = SHADOW_START_DIST - (SHADOW_START_DIST - SHADOW_END_DIST) * progress
            shadow_alpha = int(SHADOW_START_ALPHA + (shadow_end_alpha - SHADOW_START_ALPHA) * progress)
            
            v_blur = int(MOTION_BLUR_MAX * math.sin(progress * math.pi))
            
        elif t_drop < drop_duration + BOUNCE_1_DURATION:
            progress = (t_drop - drop_duration) / BOUNCE_1_DURATION
            y = -bounce_height * math.sin(progress * math.pi)
            
        elif t_drop < drop_duration + BOUNCE_1_DURATION + BOUNCE_2_DURATION:
            progress = (t_drop - drop_duration - BOUNCE_1_DURATION) / BOUNCE_2_DURATION
            y = -BOUNCE_2_HEIGHT * math.sin(progress * math.pi)
            
        else:
            y = 0

        # Build Polaroid for this frame
        current_pol = base_frame.copy()
        
        # Get frame media
        user_media = get_fg_frame(t).convert("RGBA")
        up_w, up_h = user_media.size
        min_dim = min(up_w, up_h)
        user_media = user_media.crop(((up_w - min_dim)//2, (up_h - min_dim)//2, (up_w + min_dim)//2, (up_h + min_dim)//2))
        user_media = user_media.resize((photo_size, photo_size), Image.Resampling.LANCZOS)
        
        # Grading
        blue_overlay = Image.new('RGBA', user_media.size, (15, 25, 45, 60)) 
        user_media = Image.alpha_composite(user_media, blue_overlay)
        user_media = ImageEnhance.Color(user_media).enhance(1.1)
        user_media = ImageEnhance.Contrast(user_media).enhance(1.1)
        
        brights = user_media.point(lambda p: p if p > 180 else 0)
        glow = brights.filter(ImageFilter.GaussianBlur(25))
        user_media = Image.blend(user_media, glow, 0.4)
        user_media.putalpha(photo_mask)
        
        if song_title_overlay:
            user_media.paste(song_title_overlay, (0, 0), song_title_overlay)

        # Paste the media (with text on it) onto the polaroid
        current_pol.paste(user_media, (margin, margin), user_media)
        
        if caption_overlay:
            current_pol.paste(caption_overlay, (0, 750 + (210 - 200)//2), caption_overlay)
        
        # Base Supersample (skipping full 2x for speed, doing direct rotation)
        rotated_pol = current_pol.rotate(resting_angle, resample=Image.Resampling.BICUBIC, expand=True)
        
        if v_blur > 0:
            rotated_pol = vertical_blur(rotated_pol, v_blur)
            
        shadow = Image.new('RGBA', rotated_pol.size, (0,0,0,0))
        shadow_mask = rotated_pol.split()[3]
        shadow.paste((shadow_color[0], shadow_color[1], shadow_color[2], shadow_alpha), (0,0), shadow_mask)
        shadow = shadow.filter(ImageFilter.GaussianBlur(float(shadow_blur)))
        
        # Add a gentle camera float/drift effect after the drop bounce completes
        drift_x = 0
        drift_y = 0
        if t_drop > drop_duration + BOUNCE_1_DURATION + BOUNCE_2_DURATION:
            float_time = t - (DROP_START_TIME + drop_duration + BOUNCE_1_DURATION + BOUNCE_2_DURATION)
            # Gentle figure-8 drift
            drift_x = int(6 * math.sin(float_time * 0.8))
            drift_y = int(4 * math.cos(float_time * 0.6))

        canvas = Image.new('RGBA', (width, height), (0,0,0,0))
        paste_x = int((width - rotated_pol.width) / 2) + offset_x + drift_x
        paste_y = int((height - rotated_pol.height) / 2 + y) + drift_y
        
        if y > DROP_START_Y + 10:
            canvas.paste(shadow, (paste_x, paste_y + int(shadow_dist)), shadow)
            canvas.paste(rotated_pol, (paste_x, paste_y), rotated_pol)
        else:
            canvas.paste(shadow, (paste_x, paste_y + int(shadow_dist)), shadow)
            
        return np.array(canvas)

    animated_polaroid = VideoClip(make_frame, duration=duration)
    final_video = CompositeVideoClip([bg_clip, animated_polaroid]).with_audio(audio_clip)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    import platform
    vcodec = "h264_videotoolbox" if platform.system() == "Darwin" else "libx264"
    
    final_video.write_videofile(
        output_path, 
        fps=fps, 
        codec=vcodec, 
        audio_codec="aac",
        threads=4
    )
    return {"status": "success", "file": output_path, "url": output_path.replace(os.getcwd() + "/temp", "/temp")}
