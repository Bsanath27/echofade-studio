import os
import subprocess
import json
import re
import platform

def generate_ass_subtitles(lyrics_data, ass_path, font_family, font_size, font_color, pos_x, pos_y, text_transform, stroke_width, stroke_color, shadow_offset, speed, duration, bg_width, bg_height, lyric_style="single", show_intro=False, song_title=""):
    # Convert hex color (#RRGGBB) to ASS color (&HAABBGGRR)
    def hex_to_ass(hex_col, alpha="00"):
        hex_col = hex_col.lstrip('#')
        if len(hex_col) == 6:
            r, g, b = hex_col[0:2], hex_col[2:4], hex_col[4:6]
            return f"&H{alpha}{b}{g}{r}"
        return f"&H{alpha}FFFFFF"

    # Map fonts for libass based on OS
    system = platform.system()
    if system == "Darwin":
        font_map = {
            "Montserrat": "Montserrat",
            "Arial": "Arial",
            "Helvetica Neue": "Helvetica Neue",
            "Impact": "Impact",
            "Avenir Next": "Avenir Next",
            "Futura": "Futura",
            "Didot": "Didot",
            "Baskerville": "Baskerville"
        }
    else:
        font_map = {
            "Montserrat": "Montserrat",
            "Arial": "Arial",
            "Helvetica Neue": "Trebuchet MS",
            "Impact": "Impact",
            "Avenir Next": "Arial",
            "Futura": "Arial",
            "Didot": "Georgia",
            "Baskerville": "Georgia"
        }
    ass_font = font_map.get(font_family, "Arial")
    
    primary_col = hex_to_ass(font_color)
    secondary_col = hex_to_ass(font_color, alpha="80") # 50% dimmed font color for karaoke unread state
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
    lines.append(f"Style: Default,{ass_font},{font_size},{primary_col},{secondary_col},{outline_col},{back_col},-1,0,0,0,100,100,0,0,1,{stroke_width},{shadow_offset},5,10,10,10,1")
    lines.append("")
    lines.append("[Events]")
    lines.append("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text")

    def transform(t):
        return t.upper() if text_transform == "uppercase" else t

    if show_intro and song_title:
        # Determine duration: up to first lyric or max 4 seconds
        first_lyric_time = lyrics_data[0]['time'] / speed if lyrics_data else duration
        intro_duration = min(4.0, first_lyric_time)
        if intro_duration > 0.5:
            intro_start = to_ass_time(0.0)
            intro_end = to_ass_time(intro_duration)
            title = transform(song_title)
            title_font_size = int(font_size * 1.5)
            # Add bold & larger text for intro, with fade in/out
            payload = f"{{\\pos({center_x},{center_y})\\fs{title_font_size}\\b1\\fad(500,500)}}{title}"
            lines.append(f"Dialogue: 0,{intro_start},{intro_end},Default,,0,0,0,,{payload}")

    # Vertical offset between stack lines, scaled to the chosen font size
    stack_offset = int(font_size * 1.4)
    dim_font_size = max(1, int(font_size * 0.75))

    for i, line in enumerate(lyrics_data):
        start_time = line['time'] / speed
        end_time = lyrics_data[i+1]['time'] / speed if i < len(lyrics_data) - 1 else duration

        text = transform(line['text'])

        ass_start = to_ass_time(start_time)
        ass_end = to_ass_time(end_time)

        words = line.get('words')
        if words and len(words) > 0:
            k_parts = []
            for w in words:
                w_start = w.get('start', start_time) / speed
                w_end = w.get('end', end_time) / speed
                dur_cs = max(1, int((w_end - w_start) * 100))
                w_text = transform(w.get('word', ''))
                k_parts.append(f"{{\\kf{dur_cs}}}{w_text}")
            text_payload = f"{{\\pos({center_x},{center_y})\\fad(300,300)}}" + " ".join(k_parts)
            lines.append(f"Dialogue: 0,{ass_start},{ass_end},Default,,0,0,0,,{text_payload}")
        else:
            text_payload = f"{{\\pos({center_x},{center_y})\\fad(500,500)}}{text}"
            lines.append(f"Dialogue: 0,{ass_start},{ass_end},Default,,0,0,0,,{text_payload}")

        if lyric_style == "stack":
            # Dim previous/next lines above & below, matching the live preview's
            # 3-line karaoke stack. Always rendered in semi-transparent white,
            # regardless of the user's chosen font color, mirroring the preview.
            if i > 0:
                prev_text = transform(lyrics_data[i-1]['text'])
                prev_payload = f"{{\\pos({center_x},{center_y - stack_offset})\\alpha&H99&\\fs{dim_font_size}\\c&HFFFFFF&\\bord0\\shad0\\fad(500,500)}}{prev_text}"
                lines.append(f"Dialogue: 0,{ass_start},{ass_end},Default,,0,0,0,,{prev_payload}")
            if i < len(lyrics_data) - 1:
                next_text = transform(lyrics_data[i+1]['text'])
                next_payload = f"{{\\pos({center_x},{center_y + stack_offset})\\alpha&H99&\\fs{dim_font_size}\\c&HFFFFFF&\\bord0\\shad0\\fad(500,500)}}{next_text}"
                lines.append(f"Dialogue: 0,{ass_start},{ass_end},Default,,0,0,0,,{next_payload}")

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

def create_video_ffmpeg(image_path, audio_path, lyrics_data, output_path, duration=0, speed=1.0,
                        font_family="Montserrat", font_color="#ffffff", pos_x=50, pos_y=50,
                        text_transform="uppercase", stroke_width=2, stroke_color="#000000",
                        shadow_offset=4, font_size=60, quality="final", lyric_style="single",
                        aspect_ratio="16:9",
                        bg_mode="image", bg_blur=0, bg_dim=0.0, ken_burns=False,
                        grain=0, vignette_strength=0.0, gradient_colors=None,
                        show_intro=False, song_title="",
                        mask_subject=False, subject_image_path=None,
                        overlay_video_path=None, overlay_opacity=0.4, overlay_mode="screen",
                        progress_file=None, progress_start=0, progress_end=100):
    print("Initializing Ultra-Fast FFmpeg Engine...")

    # 1. Determine background properties
    ext = image_path.lower().split(".")[-1]
    is_video = ext in ["mp4", "mov", "webm", "gif"]

    if aspect_ratio == "9:16":
        res_w, res_h = (1080, 1920) if quality == "final" else (480, 854)
    else:
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
        shadow_offset, speed, duration, res_w, res_h, lyric_style, show_intro, song_title
    )

    # Ensure Montserrat is in the local fonts directory for FFmpeg/libass
    fonts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "fonts"))
    os.makedirs(fonts_dir, exist_ok=True)
    src_montserrat = os.path.abspath(os.path.join(os.path.dirname(__file__), "Montserrat-Bold.ttf"))
    dst_montserrat = os.path.join(fonts_dir, "Montserrat-Bold.ttf")
    if os.path.exists(src_montserrat) and not os.path.exists(dst_montserrat):
        try:
            import shutil
            shutil.copyfile(src_montserrat, dst_montserrat)
        except Exception as e:
            print(f"Could not copy Montserrat to fonts dir: {e}")

    escaped_ass = ass_path.replace("\\", "/").replace(":", "\\:")
    escaped_fonts = fonts_dir.replace("\\", "/").replace(":", "\\:")

    # 4. Check & prepare subject mask if Text-Behind-Subject is enabled
    if mask_subject:
        if not subject_image_path or not os.path.exists(subject_image_path):
            from rotoscope_engine import generate_subject_mask
            mask_dir = os.path.dirname(output_path)
            subject_image_path = os.path.join(mask_dir, "subject_mask.png")
            generate_subject_mask(image_path, subject_image_path)

    # 5. Construct FFmpeg Command
    cmd = ["ffmpeg", "-y"]

    use_gradient = (bg_mode == "gradient")

    if use_gradient:
        from color_extract import hex_to_ffmpeg
        # Use the user-chosen palette if provided, otherwise color-match from the image.
        if gradient_colors:
            palette = list(gradient_colors)
            while len(palette) < 3:
                palette.append(palette[-1])
        else:
            from color_extract import extract_palette
            palette = extract_palette(image_path, count=3)
        c0 = hex_to_ffmpeg(palette[0])
        c1 = hex_to_ffmpeg(palette[-1])
        c2 = hex_to_ffmpeg(palette[len(palette) // 2])
        grad = (f"gradients=s={res_w}x{res_h}:c0={c0}:c1={c1}:c2={c2}:c3={c0}"
                f":x0=0:y0=0:x1={res_w}:y1={res_h}:speed=0.01:d={duration}:r={fps}")
        cmd.extend(["-f", "lavfi", "-i", grad])
    elif is_video:
        cmd.extend(["-stream_loop", "-1", "-i", image_path])
    else:
        cmd.extend(["-loop", "1", "-framerate", str(fps), "-i", image_path])

    # Audio input (Input 1)
    cmd.extend(["-i", audio_path])

    # Subject Overlay input (Input 2 if mask_subject)
    if mask_subject:
        cmd.extend(["-loop", "1", "-framerate", str(fps), "-i", subject_image_path])

    overlay_v_idx = -1
    if overlay_video_path and os.path.exists(overlay_video_path):
        cmd.extend(["-stream_loop", "-1", "-i", overlay_video_path])
        overlay_v_idx = 3 if mask_subject else 2

    vcodec = "h264_videotoolbox" if platform.system() == "Darwin" else "libx264"

    if mask_subject:
        # Complex filtergraph: [Background] -> [ASS Text Layer] -> [Subject Overlay PNG]
        bg_stages = []
        if not use_gradient:
            bg_stages.append(f"scale={res_w}:{res_h}:force_original_aspect_ratio=increase,crop={res_w}:{res_h}")

        if ken_burns and not is_video and not use_gradient:
            total_frames = max(1, int(duration * fps))
            bg_stages.append(
                f"zoompan=z='min(1+0.18*on/{total_frames},1.18)'"
                f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                f":d=1:s={res_w}x{res_h}:fps={fps}"
            )

        if bg_blur and float(bg_blur) > 0:
            bg_stages.append(f"gblur=sigma={float(bg_blur)}")
        if bg_dim and float(bg_dim) > 0:
            bg_stages.append(f"drawbox=x=0:y=0:w=iw:h=ih:t=fill:color=black@{min(float(bg_dim), 0.85)}")
        if grain and float(grain) > 0:
            bg_stages.append(f"noise=alls={int(float(grain))}:allf=t")
        if vignette_strength and float(vignette_strength) > 0:
            angle = min(float(vignette_strength), 1.0) * 0.7854  # up to PI/4
            bg_stages.append(f"vignette=a={angle:.4f}")

        bg_stages.append(f"ass=filename='{escaped_ass}':fontsdir='{escaped_fonts}'")
        bg_chain = ",".join(bg_stages)

        filter_complex = (
            f"[0:v]{bg_chain}[bg_text];"
            f"[2:v]scale={res_w}:{res_h}:force_original_aspect_ratio=increase,crop={res_w}:{res_h}[fg];"
            f"[bg_text][fg]overlay=0:0"
        )
        if overlay_v_idx != -1:
            filter_complex += f"[v_base];[{overlay_v_idx}:v]scale={res_w}:{res_h}:force_original_aspect_ratio=increase,crop={res_w}:{res_h},format=yuva420p[ovrl];[v_base][ovrl]blend=all_mode='{overlay_mode}':all_opacity={overlay_opacity}[v]"
        else:
            filter_complex += "[v]"

        cmd.extend([
            "-filter_complex", filter_complex,
            "-map", "[v]",
            "-map", "1:a:0",
            "-c:v", vcodec,
            "-pix_fmt", "yuv420p",
            "-preset", "ultrafast" if quality == "draft" else "fast",
            "-threads", "0",
            "-b:v", "1M" if quality == "draft" else "3M",
            "-c:a", "aac",
            "-t", str(duration),
            output_path
        ])
    else:
        # Single video filter chain
        vf_stages = []
        if not use_gradient:
            vf_stages.append(f"scale={res_w}:{res_h}:force_original_aspect_ratio=increase,crop={res_w}:{res_h}")

        if ken_burns and not is_video and not use_gradient:
            total_frames = max(1, int(duration * fps))
            vf_stages.append(
                f"zoompan=z='min(1+0.18*on/{total_frames},1.18)'"
                f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                f":d=1:s={res_w}x{res_h}:fps={fps}"
            )

        if bg_blur and float(bg_blur) > 0:
            vf_stages.append(f"gblur=sigma={float(bg_blur)}")
        if bg_dim and float(bg_dim) > 0:
            vf_stages.append(f"drawbox=x=0:y=0:w=iw:h=ih:t=fill:color=black@{min(float(bg_dim), 0.85)}")
        if grain and float(grain) > 0:
            vf_stages.append(f"noise=alls={int(float(grain))}:allf=t")
        if vignette_strength and float(vignette_strength) > 0:
            angle = min(float(vignette_strength), 1.0) * 0.7854  # up to PI/4
            vf_stages.append(f"vignette=a={angle:.4f}")

        vf_stages.append(f"ass=filename='{escaped_ass}':fontsdir='{escaped_fonts}'")
        vf_chain = ",".join(vf_stages)

        if overlay_v_idx != -1:
            filter_complex = f"[0:v]{vf_chain}[v_base];[{overlay_v_idx}:v]scale={res_w}:{res_h}:force_original_aspect_ratio=increase,crop={res_w}:{res_h},format=yuva420p[ovrl];[v_base][ovrl]blend=all_mode='{overlay_mode}':all_opacity={overlay_opacity}[v]"
            cmd.extend([
                "-filter_complex", filter_complex,
                "-map", "[v]",
                "-map", "1:a:0",
                "-c:v", vcodec,
                "-pix_fmt", "yuv420p",
                "-preset", "ultrafast" if quality == "draft" else "fast",
                "-threads", "0",
                "-b:v", "1M" if quality == "draft" else "3M",
                "-c:a", "aac",
                "-t", str(duration),
                output_path
            ])
        else:
            cmd.extend([
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-vf", vf_chain,
                "-c:v", vcodec,
                "-pix_fmt", "yuv420p",
                "-preset", "ultrafast" if quality == "draft" else "fast",
                "-threads", "0",
                "-b:v", "1M" if quality == "draft" else "3M",
                "-c:a", "aac",
                "-t", str(duration),
                output_path
            ])
    
    print(f"Executing: {' '.join(cmd)}")
    
    # 6. Execute and Parse Progress
    process = subprocess.Popen(cmd, stderr=subprocess.PIPE, universal_newlines=True)
    
    time_pattern = re.compile(r"time=(\d{2}):(\d{2}):(\d{2}\.\d{2})")
    
    for line in process.stderr:
        match = time_pattern.search(line)
        if match and progress_file:
            h, m, s = match.groups()
            current_time = int(h)*3600 + int(m)*60 + float(s)
            raw_percentage = min(int((current_time / duration) * 100), 100)
            scaled = progress_start + int((raw_percentage / 100) * (progress_end - progress_start))
            try:
                with open(progress_file, 'w') as f:
                    json.dump({"progress": scaled, "stage": "rendering"}, f)
            except:
                pass
                
    process.wait()
    if process.returncode != 0:
        raise Exception("FFmpeg rendering failed")
        
    return output_path
