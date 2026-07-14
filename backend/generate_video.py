import os
import uuid
from main import execute_render
from color_extract import suggest_typography_colors

def run():
    print("Extracting colors...")
    bg_path = "test_bg_blue.jpg"
    audio_path = "test_audio.wav"
    
    if not os.path.exists(bg_path) or not os.path.exists(audio_path):
        print("Missing test files.")
        return

    # 1. Suggest Colors
    colors = suggest_typography_colors(bg_path)
    print("Suggested Colors:", colors)
    
    # Pick the Complementary palette
    palette = colors["palettes"][0]
    font_color = palette["font_color"]
    stroke_color = palette["stroke_color"]
    
    print(f"Picked palette '{palette['name']}': Font={font_color}, Stroke={stroke_color}")
    
    # 2. Render Video
    job_id = "test_suggester"
    job_dir = os.path.join("temp", "jobs", job_id)
    os.makedirs(job_dir, exist_ok=True)
    progress_file = os.path.join(job_dir, "progress.json")
    
    raw_lrc = "[00:00.00] Testing the magic color suggester\n[00:02.00] It automatically picks colors!\n[00:04.00] Works perfectly."
    
    settings = {
        "speed": 1.0,
        "reverb_room_size": 0,
        "reverb_mix": 0,
        "bass_boost_db": 0,
        "treble_boost_db": 0,
        "vintage_warmth": 0,
        "enable_8d": False,
        "orbit_time": 10,
        "orbit_ducking": 0,
        "orbit_widening": 0,
        "font_family": "Montserrat",
        "font_color": font_color,
        "font_size": 50,
        "pos_x": 50,
        "pos_y": 50,
        "text_transform": "uppercase",
        "stroke_width": 3,
        "stroke_color": stroke_color,
        "shadow_offset": 0,
        "quality": "draft",
        "engine": "ffmpeg",
        "lyric_style": "single",
        "lyric_preset": "line-pop",
        "canvas_mode": False,
        "aspect_ratio": "16:9",
        "bg_mode": "image",
        "bg_blur": 0,
        "bg_dim": 0.3,
        "ken_burns": False,
        "grain": 0,
        "vignette_strength": 0,
        "gradient_colors": None,
        "file_name": "Suggested_Colors_Render",
        "beat_bounce": False,
        "particles": False
    }
    
    print("Rendering video...")
    execute_render(
        job_id=job_id,
        job_dir=job_dir,
        audio_path=audio_path,
        raw_lrc=raw_lrc,
        image_path=bg_path,
        settings=settings,
        progress_file=progress_file
    )
    
    print("Done! Check backend/temp/jobs/test_suggester/Suggested_Colors_Render.mp4")

if __name__ == "__main__":
    run()
