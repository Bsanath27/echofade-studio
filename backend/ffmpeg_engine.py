import os
import subprocess
import json
import re

def generate_ass_subtitles(lyrics_data, ass_path, font_family, font_size, font_color, pos_x, pos_y, text_transform, stroke_width, stroke_color, shadow_offset, speed, duration, bg_width, bg_height):
    # Convert hex color (#RRGGBB) to ASS color (&HAABBGGRR)
    def hex_to_ass(hex_col, alpha="00"):
        hex_col = hex_col.lstrip('#')
        if len(hex_col) == 6:
            r, g, b = hex_col[0:2], hex_col[2:4], hex_col[4:6]
            return f"&H{alpha}{b}{g}{r}"
        return f"&H{alpha}FFFFFF"

    # Map fonts for libass
    font_map = {
        "Montserrat": "Montserrat",
        "Arial": "Arial",
        "Helvetica Neue": "Trebuchet MS",
        "Impact": "Impact",
        "Avenir Next": "DIN Alternate",
        "Futura": "DIN Alternate",
        "Didot": "Georgia",
        "Baskerville": "Georgia"
    }
    ass_font = font_map.get(font_family, "Arial")
    
    primary_col = hex_to_ass(font_color)
    outline_col = hex_to_ass(stroke_color) if stroke_width > 0 else "&H00000000"
    back_col = "&H80000000" # semi-transparent black shadow

    # Calculate exact coordinates
    center_x = int(bg_width * (pos_x / 100.0))
    center_y = int(bg_height * (pos_y / 100.0))

    # To ASS time format: H:MM:SS.cs
    def to_ass_time(sec):
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        s = int(sec % 60)
        cs = int((sec - int(sec)) * 100)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    lines = []
    lines.append("[Script Info]")
    lines.append("ScriptType: v4.00+")
    lines.append(f"PlayResX: {bg_width}")
    lines.append(f"PlayResY: {bg_height}")
    lines.append("")
    lines.append("[V4+ Styles]")
    lines.append("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding")
    lines.append(f"Style: Default,{ass_font},{font_size},{primary_col},&H000000FF,{outline_col},{back_col},-1,0,0,0,100,100,0,0,1,{stroke_width},{shadow_offset},5,10,10,10,1")
    lines.append("")
    lines.append("[Events]")
    lines.append("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text")

    for i, line in enumerate(lyrics_data):
        start_time = line['time'] / speed
        end_time = lyrics_data[i+1]['time'] / speed if i < len(lyrics_data) - 1 else duration
        
        text = line['text']
        if text_transform == "uppercase":
            text = text.upper()
            
        ass_start = to_ass_time(start_time)
        ass_end = to_ass_time(end_time)
        
        # Override tags: pos(x,y) and fad(in,out)
        text_payload = f"{{\\pos({center_x},{center_y})\\fad(500,500)}}{text}"
        lines.append(f"Dialogue: 0,{ass_start},{ass_end},Default,,0,0,0,,{text_payload}")

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

def create_video_ffmpeg(image_path, audio_path, lyrics_data, output_path, duration=0, speed=1.0, 
                        font_family="Montserrat", font_color="#ffffff", pos_x=50, pos_y=50, 
                        text_transform="uppercase", stroke_width=2, stroke_color="#000000", 
                        shadow_offset=4, font_size=60, quality="final", enable_beat_sync=False, 
                        progress_file=None):
    print("Initializing Ultra-Fast FFmpeg Engine...")
    
    # 1. Determine background properties
    ext = image_path.lower().split(".")[-1]
    is_video = ext in ["mp4", "mov", "webm", "gif"]
    
    res_w, res_h = (1920, 1080) if quality == "final" else (854, 480)
    fps = 24 if quality == "final" else 15
    
    # Scale font size for draft (to maintain proportion)
    if quality == "draft":
        font_size = int(font_size * (480 / 1080))
        stroke_width = max(1, int(stroke_width * (480 / 1080))) if stroke_width > 0 else 0
        shadow_offset = max(1, int(shadow_offset * (480 / 1080))) if shadow_offset > 0 else 0

    # 2. Get Audio Duration
    cmd_probe = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path]
    duration_str = subprocess.check_output(cmd_probe).decode('utf-8').strip()
    duration = float(duration_str)

    # 3. Generate ASS Subtitles
    ass_path = os.path.join(os.path.dirname(output_path), "subtitles.ass")
    generate_ass_subtitles(
        lyrics_data, ass_path, font_family, font_size, font_color, 
        pos_x, pos_y, text_transform, stroke_width, stroke_color, 
        shadow_offset, speed, duration, res_w, res_h
    )

    # 4. Construct FFmpeg Command
    cmd = ["ffmpeg", "-y"]
    
    if is_video:
        cmd.extend(["-stream_loop", "-1", "-i", image_path])
    else:
        cmd.extend(["-loop", "1", "-framerate", str(fps), "-i", image_path])
        
    cmd.extend(["-i", audio_path])
    
    # Video Filter: Scale -> Pad/Crop (ensure exact resolution) -> ASS Subtitles
    vf_chain = f"scale={res_w}:{res_h}:force_original_aspect_ratio=increase,crop={res_w}:{res_h},ass='{ass_path}'"
    
    cmd.extend([
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-vf", vf_chain,
        "-c:v", "h264_videotoolbox", 
        "-pix_fmt", "yuv420p",
        "-preset", "ultrafast" if quality == "draft" else "fast",
        "-b:v", "2M" if quality == "draft" else "10M",
        "-c:a", "aac",
        "-t", str(duration),
        output_path
    ])
    
    print(f"Executing: {' '.join(cmd)}")
    
    # 5. Execute and Parse Progress
    process = subprocess.Popen(cmd, stderr=subprocess.PIPE, universal_newlines=True)
    
    time_pattern = re.compile(r"time=(\d{2}):(\d{2}):(\d{2}\.\d{2})")
    
    for line in process.stderr:
        match = time_pattern.search(line)
        if match and progress_file:
            h, m, s = match.groups()
            current_time = int(h)*3600 + int(m)*60 + float(s)
            percentage = min(int((current_time / duration) * 100), 100)
            try:
                with open(progress_file, 'w') as f:
                    json.dump({"progress": percentage}, f)
            except:
                pass
                
    process.wait()
    if process.returncode != 0:
        raise Exception("FFmpeg rendering failed")
        
    return output_path
