import os
import sys
from PIL import Image, ImageDraw

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from rotoscope_engine import generate_subject_mask, split_image_background_and_subject
from ffmpeg_engine import create_video_ffmpeg


def create_sample_image(output_path: str):
    """Create a sample 1920x1080 image with a subject shape in the center."""
    img = Image.new("RGB", (1920, 1080), color=(30, 40, 60))
    draw = ImageDraw.Draw(img)
    # Draw background pattern
    for y in range(0, 1080, 40):
        draw.line([(0, y), (1920, y)], fill=(40, 50, 75), width=2)
    # Draw central subject (silhouette figure / oval)
    draw.ellipse([760, 240, 1160, 840], fill=(220, 100, 80), outline=(255, 255, 255), width=4)
    draw.rectangle([860, 440, 1060, 940], fill=(200, 80, 70))
    img.save(output_path, "JPEG")
    return output_path


def test_rotoscope_and_ffmpeg_compositing():
    print("=== Testing Rotoscope & Subject Masking Specialist Features ===")
    
    test_dir = os.path.join(backend_dir, "temp", "test_mask_run")
    os.makedirs(test_dir, exist_ok=True)
    
    bg_image_path = os.path.join(test_dir, "test_background.jpg")
    mask_png_path = os.path.join(test_dir, "test_subject_mask.png")
    output_video_path = os.path.join(test_dir, "test_3d_depth_output.mp4")
    
    # 1. Create sample background image
    print("1. Creating sample background image...")
    create_sample_image(bg_image_path)
    assert os.path.exists(bg_image_path), "Sample background image creation failed"
    print(f"   Background created: {bg_image_path}")
    
    # 2. Test rotoscope subject mask generation
    print("2. Testing rotoscope_engine.generate_subject_mask...")
    generated_mask = generate_subject_mask(bg_image_path, mask_png_path)
    assert os.path.exists(generated_mask), "Generated mask file missing"
    
    # Verify PNG has RGBA mode and alpha channel
    mask_img = Image.open(generated_mask)
    assert mask_img.mode == "RGBA", f"Expected RGBA image, got {mask_img.mode}"
    print(f"   Subject mask successfully generated: {generated_mask} (Size: {mask_img.size}, Mode: {mask_img.mode})")
    
    # Test split_image_background_and_subject helper
    bg_p, subj_p = split_image_background_and_subject(bg_image_path, test_dir)
    assert os.path.exists(bg_p) and os.path.exists(subj_p), "split_image_background_and_subject failed"
    print("   split_image_background_and_subject function verified.")
    
    # 3. Test FFmpeg engine with mask_subject=True
    print("3. Testing FFmpeg engine text-behind-subject 3D depth compositing...")
    
    # Use existing test audio or generate dummy WAV if needed
    audio_path = os.path.join(backend_dir, "test_audio.wav")
    if not os.path.exists(audio_path):
        import wave, struct
        audio_path = os.path.join(test_dir, "test_audio.wav")
        with wave.open(audio_path, 'w') as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(44100)
            # 3 seconds of silent/sine wave audio
            samples = [int(32767 * 0.1 * (i % 100 / 100)) for i in range(44100 * 3)]
            f.writeframes(struct.pack(f'<{len(samples)}h', *samples))
            
    sample_lyrics = [
        {"time": 0.5, "text": "Text Behind Subject Effect"},
        {"time": 2.0, "text": "3D Layer Compositing Active"}
    ]
    
    result_video = create_video_ffmpeg(
        image_path=bg_image_path,
        audio_path=audio_path,
        lyrics_data=sample_lyrics,
        output_path=output_video_path,
        speed=1.0,
        font_family="Montserrat",
        font_color="#FFD700",
        pos_x=50,
        pos_y=50,
        font_size=60,
        quality="draft",
        aspect_ratio="16:9",
        bg_mode="image",
        bg_blur=3.0,
        bg_dim=0.2,
        mask_subject=True,
        subject_image_path=generated_mask
    )
    
    assert os.path.exists(result_video), "Output video file was not created"
    video_size = os.path.getsize(result_video)
    assert video_size > 0, "Output video file is empty"
    print(f"   FFmpeg 3D Depth Compositing successful: {result_video} (Size: {video_size} bytes)")
    
    print("\n=== ALL ROTOSCOPE & SUBJECT MASKING TESTS PASSED SUCCESSFULLY! ===")


if __name__ == "__main__":
    test_rotoscope_and_ffmpeg_compositing()
