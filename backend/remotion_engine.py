import os
import json
import subprocess
import glob
import multiprocessing


def _find_headless_shell(remotion_dir):
    """Locate chrome-headless-shell in node_modules/.remotion/.
    
    Returns the path to the executable, or None if not found.
    Remotion downloads it to: node_modules/.remotion/chrome-headless-shell/<platform>/<dir>/chrome-headless-shell
    """
    pattern = os.path.join(
        remotion_dir, "node_modules", ".remotion",
        "chrome-headless-shell", "*", "*", "chrome-headless-shell"
    )
    matches = glob.glob(pattern)
    if matches and os.path.isfile(matches[0]):
        return matches[0]
    return None


def create_video_remotion(
    image_path, audio_path, lyrics_data, output_path,
    progress_file=None, progress_start=0, progress_end=100,
    **kwargs
):
    """
    Renders the video using the Remotion React engine.
    """
    import urllib.parse
    job_dir = os.path.dirname(output_path)
    props_path = os.path.join(job_dir, "remotion_props.json")
    
    import base64
    import urllib.parse
    
    server_active = False
    try:
        import urllib.request
        with urllib.request.urlopen("http://127.0.0.1:8000/", timeout=0.5) as response:
            if response.status == 200:
                server_active = True
    except Exception:
        server_active = False

    temp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "temp"))

    if server_active:
        audio_rel_path = os.path.relpath(audio_path, temp_dir)
        audio_url = f"http://127.0.0.1:8000/files/{urllib.parse.quote(audio_rel_path)}"
        bg_url = f"http://127.0.0.1:8000/files/{urllib.parse.quote(os.path.relpath(image_path, temp_dir))}" if image_path else ""
    else:
        with open(audio_path, "rb") as f:
            audio_url = f"data:audio/wav;base64,{base64.b64encode(f.read()).decode('utf-8')}"
        if image_path and os.path.exists(image_path):
            ext = image_path.lower().split('.')[-1]
            mime = "image/png" if ext in ["png", "webp"] else "image/jpeg"
            with open(image_path, "rb") as f:
                bg_url = f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"
        else:
            bg_url = ""

    # Calculate audio duration using ffprobe
    duration_frames = 1800
    try:
        cmd_probe = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path]
        duration_sec = float(subprocess.check_output(cmd_probe).decode('utf-8').strip())
        duration_frames = int(duration_sec * 30) # 30fps
    except Exception as e:
        print(f"Warning: Failed to probe audio duration, defaulting to 60s. Error: {e}")

    speed = kwargs.get("speed", 1.0)
    scaled_lyrics = []
    for lyric in lyrics_data:
        item = {"time": lyric["time"] / speed, "text": lyric["text"]}
        if "words" in lyric and lyric["words"]:
            item["words"] = [
                {
                    "word": w["word"],
                    "start": w["start"] / speed,
                    "end": w["end"] / speed
                }
                for w in lyric["words"]
            ]
        scaled_lyrics.append(item)
    aspect_ratio = kwargs.get("aspect_ratio", "16:9")
    quality = kwargs.get("quality", "final")
    if aspect_ratio == "9:16":
        width, height = (1080, 1920) if quality == "final" else (480, 854)
    else:
        width, height = (1920, 1080) if quality == "final" else (854, 480)

    # Subject mask URL/data-uri resolution
    import base64
    subject_image_path = kwargs.get("subject_image_path")
    if server_active and subject_image_path:
        subject_rel_path = os.path.relpath(subject_image_path, temp_dir)
        subject_url = f"http://127.0.0.1:8000/files/{urllib.parse.quote(subject_rel_path)}"
    elif subject_image_path and os.path.exists(subject_image_path):
        ext = subject_image_path.lower().split('.')[-1]
        mime = "image/png" if ext in ["png", "webp"] else "image/jpeg"
        with open(subject_image_path, "rb") as f:
            subject_url = f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"
    else:
        subject_url = ""

    # Overlay video URL/data-uri resolution
    overlay_video_path = kwargs.get("overlay_video_path")
    if server_active and overlay_video_path:
        overlay_rel_path = os.path.relpath(overlay_video_path, temp_dir)
        overlay_url = f"http://127.0.0.1:8000/files/{urllib.parse.quote(overlay_rel_path)}"
    elif overlay_video_path and os.path.exists(overlay_video_path):
        ext = overlay_video_path.lower().split('.')[-1]
        mime = "video/mp4"
        with open(overlay_video_path, "rb") as f:
            overlay_url = f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"
    else:
        overlay_url = ""

    props = {
        "audioUrl": audio_url,
        "bgUrl": bg_url,
        "lyrics": scaled_lyrics,
        "theme": "dark",
        "durationInFrames": duration_frames,
        "width": width,
        "height": height,
        "lyricPreset": kwargs.get("lyric_preset", "line-pop"),
        "beatBounce": kwargs.get("beat_bounce", False),
        "particles": kwargs.get("particles", False),
        "showIntro": kwargs.get("show_intro", False),
        "songTitle": kwargs.get("song_title", ""),
        "bloomColor": kwargs.get("bloom_color"),
        "bloomRadius": kwargs.get("bloom_radius"),
        "beatShake": kwargs.get("beat_shake", False),
        "chromaticAberration": kwargs.get("chromatic_aberration", False),
        "fontFamily": kwargs.get("font_family", "Montserrat"),
        "fontSize": kwargs.get("font_size", 60),
        "fontColor": kwargs.get("font_color", "#ffffff"),
        "posX": kwargs.get("pos_x", 50),
        "posY": kwargs.get("pos_y", 50),
        "textTransform": kwargs.get("text_transform", "uppercase"),
        "strokeWidth": kwargs.get("stroke_width", 2),
        "strokeColor": kwargs.get("stroke_color", "#000000"),
        "shadowOffset": kwargs.get("shadow_offset", 4),
        "lyricStyle": kwargs.get("lyric_style", "single"),
        "bgMode": kwargs.get("bg_mode", "image"),
        "bgBlur": kwargs.get("bg_blur", 0.0),
        "bgDim": kwargs.get("bg_dim", 0.0),
        "gradientColors": kwargs.get("gradient_colors"),
        "grain": kwargs.get("grain", 0.0),
        "vignetteStrength": kwargs.get("vignette_strength", 0.0),
        "maskSubject": kwargs.get("mask_subject", False),
        "subjectImageUrl": subject_url,
        "overlayUrl": overlay_url,
        "overlayOpacity": kwargs.get("overlay_opacity", 0.4),
        "overlayMode": kwargs.get("overlay_mode", "screen"),
    }

    with open(props_path, 'w') as f:
        json.dump(props, f)

    if progress_file:
        with open(progress_file, 'w') as f:
            json.dump({"progress": progress_start, "stage": "Booting Remotion Chrome Engine..."}, f)

    # Path to the remotion-renderer directory
    backend_dir = os.path.dirname(__file__)
    project_root = os.path.abspath(os.path.join(backend_dir, ".."))
    remotion_dir = os.path.join(project_root, "remotion-renderer")

    # Use chrome-headless-shell from node_modules/.remotion/ to avoid macOS
    # permission issues with system Chrome (SingletonLock / Crashpad errors).
    headless_shell = _find_headless_shell(remotion_dir)

    cmd = [
        "npx", "remotion", "render",
        "src/index.ts", "LyricVideo",
        os.path.abspath(output_path),
        "--props", os.path.abspath(props_path),
        "--log=verbose",
        "--chrome-flag=--allow-file-access-from-files",
        "--chrome-flag=--disable-web-security",
        "--concurrency", str(multiprocessing.cpu_count())
    ]

    if headless_shell:
        cmd.extend(["--browser-executable", headless_shell])
        print(f"Using chrome-headless-shell: {headless_shell}")

    print(f"Running Remotion: {' '.join(cmd)}")

    # Build environment: set PUPPETEER_EXECUTABLE_PATH so Remotion's
    # getLocalBrowser() picks up the headless shell first and never
    # falls through to system Chrome.
    env = os.environ.copy()
    if headless_shell:
        env["PUPPETEER_EXECUTABLE_PATH"] = headless_shell

    try:
        # Run Remotion CLI
        process = subprocess.Popen(
            cmd,
            cwd=remotion_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            env=env
        )

        for line in process.stdout:
            print(f"[Remotion] {line.strip()}")
            if "Rendered" in line and "/" in line:
                try:
                    # Parse format like "Rendered 684/6178"
                    parts = line.split("Rendered")[1].strip().split("/")
                    current_frame = int(parts[0])
                    total_frames = int(parts[1].split()[0]) # split()[0] handles any trailing text
                    percent = (current_frame / total_frames) * 100
                    current_prog = progress_start + (percent / 100.0) * (progress_end - progress_start)
                    if progress_file:
                        with open(progress_file, 'w') as f:
                            json.dump({"progress": current_prog, "stage": f"Rendering video frames: {int(percent)}%"}, f)
                except Exception:
                    pass

        process.wait()

        if process.returncode != 0:
            if not headless_shell:
                raise RuntimeError(
                    "Remotion render failed with exit code "
                    f"{process.returncode}. chrome-headless-shell was not "
                    "found. Please run:\n\n"
                    "  bash scripts/setup-remotion-browser.sh\n\n"
                    "from the project root in Terminal.app to download it."
                )
            raise RuntimeError(
                f"Remotion render failed with exit code {process.returncode}."
            )

    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"Remotion engine failed: {str(e)}")

