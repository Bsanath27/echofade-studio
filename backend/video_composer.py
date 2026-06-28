from moviepy import ImageClip, VideoFileClip, AudioFileClip, TextClip, CompositeVideoClip, vfx
import os

def create_video(
    image_path: str,
    audio_path: str,
    lyrics_data: list,
    output_path: str,
    speed: float = 1.0,
    font_family: str = "Montserrat",
    font_color: str = "#ffffff",
    pos_x: int = 50,
    pos_y: int = 50,
    text_transform: str = "uppercase",
    stroke_width: int = 2,
    stroke_color: str = "#000000",
    shadow_offset: int = 4,
    font_size: int = 60,
    quality: str = "final",
    logger = None
):
    """
    Composites the background image, processed audio, and text overlays into an MP4.
    Automatically scales lyric timestamps based on the audio speed multiplier.
    """
    audio_clip = AudioFileClip(audio_path)
    duration = audio_clip.duration
    
    # 1. Base Image/Video Layer
    ext = image_path.lower().split(".")[-1]
    is_video = ext in ["mp4", "mov", "webm", "gif"]
    
    res_h, res_w = (1080, 1920) if quality == "final" else (480, 854)
    
    # Scale font size for draft mode
    if quality == "draft":
        font_size = int(font_size * (480 / 1080))
        stroke_width = max(1, int(stroke_width * (480 / 1080))) if stroke_width > 0 else 0
        shadow_offset = max(1, int(shadow_offset * (480 / 1080))) if shadow_offset > 0 else 0
    
    if is_video:
        base_image = VideoFileClip(image_path, target_resolution=(res_h, res_w))
        base_image = base_image.with_effects([vfx.Loop(duration=duration)])
    else:
        base_image = ImageClip(image_path).with_duration(duration)
        # Ensure standard 16:9 resolution
        base_image = base_image.resized(height=res_h, width=res_w)
    
    clips = [base_image]

    # 2. Text Overlays (Lyrics)
    print("Generating text clips with shadows and speed synchronization...")
    
    # Map fonts to standalone Bold .ttf files (Pillow requires absolute paths to .ttf, and .ttc files default to thin)
    font_map = {
        "Montserrat": os.path.join(os.path.dirname(__file__), 'Montserrat-Bold.ttf'),
        "Arial": "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "Helvetica Neue": "/System/Library/Fonts/Supplemental/Trebuchet MS Bold.ttf",
        "Impact": "/System/Library/Fonts/Supplemental/Impact.ttf",
        "Avenir Next": "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf",
        "Futura": "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf",
        "Didot": "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "Baskerville": "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
    }
    font_path = font_map.get(font_family, font_map["Montserrat"])
    
    for i, line in enumerate(lyrics_data):
        # Auto-sync lyric timings based on speed!
        start_time = line['time'] / speed
        end_time = lyrics_data[i+1]['time'] / speed if i < len(lyrics_data) - 1 else audio_clip.duration
        
        raw_text = line["text"]
        if text_transform == "uppercase":
            raw_text = raw_text.upper()
            
        text_with_padding = raw_text + "\n "
        
        # Create Main Text (Constrain width to 90% of screen)
        text_clip = TextClip(
            text=text_with_padding, 
            font_size=font_size, 
            color=font_color, 
            font=font_path,
            method='caption',
            size=(int(res_w * 0.9), None),
            stroke_color=stroke_color if stroke_width > 0 else None,
            stroke_width=stroke_width
        )
        
        # Calculate absolute top-left coordinate so the center of the clip lands exactly at pos_x / pos_y
        center_x = res_w * (pos_x / 100.0)
        center_y = res_h * (pos_y / 100.0)
        top_left_x = center_x - (text_clip.size[0] / 2.0)
        top_left_y = center_y - (text_clip.size[1] / 2.0)
        
        text_clip = text_clip.with_position((top_left_x, top_left_y))\
         .with_start(start_time)\
         .with_end(end_time)\
         .with_effects([vfx.CrossFadeIn(0.5), vfx.CrossFadeOut(0.5)])
         
        # Create Shadow/Glow (Rendered slightly offset in black) if enabled
        if shadow_offset > 0:
            shadow_clip = TextClip(
                text=text_with_padding, 
                font_size=font_size, 
                color='black', 
                font=font_path,
                method='caption',
                size=(int(res_w * 0.9), None)
            ).with_position((top_left_x + shadow_offset, top_left_y + shadow_offset))\
             .with_start(start_time)\
             .with_end(end_time)\
             .with_effects([vfx.CrossFadeIn(0.5), vfx.CrossFadeOut(0.5)])
            clips.append(shadow_clip)

        # Layer them
        clips.append(text_clip)

    # 4. Final Compositing
    print("Compositing final video...")
    final_video = CompositeVideoClip(clips)
    final_video = final_video.with_audio(audio_clip)
    
    # Render
    final_video.write_videofile(
        output_path,
        fps=24 if quality == "final" else 15,
        codec='h264_videotoolbox',
        preset='fast' if quality == "final" else 'ultrafast',
        ffmpeg_params=['-pix_fmt', 'yuv420p'],
        audio_codec='aac',
        temp_audiofile='temp-audio.m4a',
        remove_temp=True,
        threads=8,
        logger=logger
    )
    
    return output_path
