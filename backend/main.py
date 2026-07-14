from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from urllib.parse import quote
import uvicorn
import os
import shutil
import json
import uuid
import subprocess
import asyncio
import threading
import queue
import re
from PIL import Image
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass
from proglog import ProgressBarLogger

from downloader import download_audio, download_media, extract_media_info
from lyrics_extractor import extract_lyrics, parse_lrc
from audio_processor import apply_audio_effects
from video_composer import create_video
import requests

app = FastAPI(title="Lyric Video Generator API")
WHISPER_MODEL = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp"
JOBS_DIR = os.path.join(TEMP_DIR, "jobs")
PREVIEW_DIR = os.path.join(TEMP_DIR, "preview")
MAX_KEPT_JOBS = 5

for d in (TEMP_DIR, JOBS_DIR, PREVIEW_DIR):
    os.makedirs(d, exist_ok=True)


def prune_old_jobs():
    """Keep only the MAX_KEPT_JOBS most recently created job directories."""
    try:
        jobs = [os.path.join(JOBS_DIR, d) for d in os.listdir(JOBS_DIR)]
        jobs = [d for d in jobs if os.path.isdir(d)]
        jobs.sort(key=os.path.getmtime, reverse=True)
        for stale in jobs[MAX_KEPT_JOBS:]:
            shutil.rmtree(stale, ignore_errors=True)
    except Exception as e:
        print(f"Job pruning failed (non-fatal): {e}")


class RenderLogger(ProgressBarLogger):
    """Wraps MoviePy's progress bars and remaps them into a sub-range of the
    overall progress (audio mastering occupies the first slice, video render
    occupies the rest)."""
    def __init__(self, filename, progress_start=15, progress_end=100):
        super().__init__()
        self.filename = filename
        self.progress_start = progress_start
        self.progress_end = progress_end
        self.last_percentage = -1

    def bars_callback(self, bar, attr, value, old_value=None):
        total = self.bars[bar].get('total', 1)
        if total > 0:
            raw_percentage = min(int((value / total) * 100), 100)
            scaled = self.progress_start + int((raw_percentage / 100) * (self.progress_end - self.progress_start))
            if scaled != self.last_percentage:
                self.last_percentage = scaled
                try:
                    with open(self.filename, 'w') as f:
                        json.dump({"progress": scaled, "stage": "rendering"}, f)
                except:
                    pass

app.mount("/files", StaticFiles(directory=TEMP_DIR), name="files")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import logging
    logging.error(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


def _sanitize_filename(name):
    cleaned = re.sub(r'[^a-zA-Z0-9_\-() ]', '', name).strip()
    return cleaned or "lyric_video"


def execute_render(job_id, job_dir, audio_path, raw_lrc, image_path, settings, progress_file):
    """Shared render core used by both the single-render endpoint and the batch
    worker. `settings` is in apply_audio_effects-native units (reverb_mix,
    vintage_warmth, orbit_widening all 0-1). Audio mastering fills 0-15% of the
    progress bar, video render fills 15-100%. Returns dict with video/download URLs.
    """
    from video_composer import create_video
    from ffmpeg_engine import create_video_ffmpeg
    from remotion_engine import create_video_remotion

    s = settings
    lyrics_data = parse_lrc(raw_lrc)
    
    # 1. Adjust Lyrics for Trimming
    trim_start = s.get('trim_start', 0.0)
    trim_end = s.get('trim_end', 0.0)
    if trim_end > trim_start:
        filtered_lyrics = []
        for idx, lyric in enumerate(lyrics_data):
            t = lyric['time']
            next_t = lyrics_data[idx + 1]['time'] if idx < len(lyrics_data) - 1 else t + 10.0
            if next_t > trim_start and t < trim_end:
                new_t = max(0.0, t - trim_start)
                filtered_lyrics.append({"time": new_t, "text": lyric["text"]})
        lyrics_data = filtered_lyrics
    elif trim_start > 0:
        new_lyrics = []
        for lyric in lyrics_data:
            if lyric['time'] >= trim_start:
                new_lyrics.append({"time": lyric['time'] - trim_start, "text": lyric["text"]})
        lyrics_data = new_lyrics

    # 2. Adjust Lyrics for Custom Offset
    if 'lyric_offset' in s and s['lyric_offset'] != 0:
        for lyric in lyrics_data:
            lyric['time'] = max(0.0, lyric['time'] + s['lyric_offset'])

    # Convert HEIC to JPG using Pillow (cross-platform)
    image_ext = image_path.lower().split(".")[-1]
    if image_ext in ['heic', 'heif']:
        jpg_path = os.path.join(job_dir, "bg_image.jpg")
        try:
            Image.open(image_path).convert('RGB').save(jpg_path, "JPEG")
            image_path = jpg_path
        except Exception as e:
            print(f"Failed to convert HEIC to JPG: {e}")

    # 1. Audio mastering (0-15%)
    processed_audio_path = os.path.join(job_dir, "processed_audio.wav")
    apply_audio_effects(
        input_path=audio_path,
        output_path=processed_audio_path,
        speed=s['speed'],
        reverb_room_size=s['reverb_room_size'],
        reverb_mix=s['reverb_mix'],
        bass_boost_db=s['bass_boost_db'],
        treble_boost_db=s['treble_boost_db'],
        vintage_warmth=s['vintage_warmth'],
        enable_8d=s['enable_8d'],
        orbit_time=s['orbit_time'],
        orbit_ducking=s['orbit_ducking'],
        orbit_widening=s['orbit_widening'],
        progress_file=progress_file,
        progress_start=0,
        progress_end=40,
        trim_start=trim_start,
        trim_end=trim_end
    )

    # 2. Video renders (15-100%)
    aspect_ratios = [ar.strip() for ar in str(s.get('aspect_ratio', '16:9')).split(',') if ar.strip()]
    if s.get('canvas_mode', False):
        aspect_ratios = ['9:16']
        lyrics_data = [] # Canvas has no lyrics
        
    num_renders = len(aspect_ratios)
    rendered_files = []

    for i, ar in enumerate(aspect_ratios):
        start_prog = 40 + (i * (60 / num_renders))
        end_prog = 40 + ((i + 1) * (60 / num_renders))
        
        ar_safe = ar.replace(':', 'x')
        base_name = s['file_name']
        if base_name.lower().endswith('.mp4'):
            base_name = base_name[:-4]
            
        if num_renders > 1 or s.get('canvas_mode'):
            suffix = "_canvas" if s.get('canvas_mode') else f"_{ar_safe}"
            final_filename = f"{base_name}{suffix}.mp4"
        else:
            final_filename = f"{base_name}.mp4"
            
        output_path = os.path.join(job_dir, final_filename)
        
        composer_kwargs = dict(
            image_path=image_path, audio_path=processed_audio_path, lyrics_data=lyrics_data,
            output_path=output_path, speed=s['speed'], font_family=s['font_family'],
            font_color=s['font_color'], pos_x=s['pos_x'], pos_y=s['pos_y'],
            text_transform=s['text_transform'], stroke_width=s['stroke_width'],
            stroke_color=s['stroke_color'], shadow_offset=s['shadow_offset'],
            font_size=s['font_size'], quality=s['quality'], aspect_ratio=ar,
            show_intro=s.get('show_intro', False), song_title=s.get('song_title', ''),
        )

        if s['engine'] == "ffmpeg":
            if s.get('canvas_mode'):
                composer_kwargs['duration'] = 8.0 # Force 8s loop
            from ffmpeg_engine import create_video_ffmpeg
            create_video_ffmpeg(
                **composer_kwargs, lyric_style=s['lyric_style'], bg_mode=s['bg_mode'],
                bg_blur=s['bg_blur'], bg_dim=s['bg_dim'], ken_burns=s['ken_burns'],
                grain=s['grain'], vignette_strength=s['vignette_strength'],
                gradient_colors=s.get('gradient_colors'),
                mask_subject=s.get('mask_subject', False),
                subject_image_path=s.get('subject_image_path'),
                overlay_video_path=s.get('overlay_video_path'),
                overlay_opacity=s.get('overlay_opacity', 0.4),
                overlay_mode=s.get('overlay_mode', 'screen'),
                progress_file=progress_file, progress_start=start_prog, progress_end=end_prog,
            )
        elif s['engine'] == "remotion":
            from remotion_engine import create_video_remotion
            create_video_remotion(
                **composer_kwargs,
                lyric_preset=s.get('lyric_preset', 'line-pop'),
                beat_bounce=s.get('beat_bounce', False),
                particles=s.get('particles', False),
                bloom_color=s.get('bloom_color'),
                bloom_radius=s.get('bloom_radius'),
                beat_shake=s.get('beat_shake', False),
                chromatic_aberration=s.get('chromatic_aberration', False),
                progress_file=progress_file, progress_start=start_prog, progress_end=end_prog,
            )
        else:
            create_video(**composer_kwargs, logger=RenderLogger(progress_file, progress_start=start_prog, progress_end=end_prog))
            
        rendered_files.append((output_path, final_filename))

    with open(progress_file, 'w') as f:
        json.dump({"progress": 100, "stage": "done"}, f)

    # Copy all rendered files to outputs directory
    ROOT_OUTPUTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "outputs"))
    os.makedirs(ROOT_OUTPUTS_DIR, exist_ok=True)
    
    returned_urls = {}
    for i, (out_path, f_name) in enumerate(rendered_files):
        final_output_path = os.path.join(ROOT_OUTPUTS_DIR, f_name)
        if os.path.exists(final_output_path):
            base, ext = os.path.splitext(f_name)
            final_output_path = os.path.join(ROOT_OUTPUTS_DIR, f"{base}_{job_id}{ext}")
            f_name = os.path.basename(final_output_path)
        shutil.copyfile(out_path, final_output_path)
        
        url_path = quote(f"jobs/{job_id}/{os.path.basename(out_path)}", safe='/')
        if i == 0:
            returned_urls = {"video_url": f"/files/{url_path}", "download_url": f"/api/download/{url_path}"}

    prune_old_jobs()
    return {"status": "success", **returned_urls}


# ── Batch render queue (sequential worker) ──
BATCH_JOBS = {}            # job_id -> status dict
BATCH_QUEUE = queue.Queue()
BATCH_LOCK = threading.Lock()


def _update_job(job_id, **kw):
    with BATCH_LOCK:
        job = BATCH_JOBS.setdefault(job_id, {"id": job_id})
        job.update(kw)


def _batch_worker():
    while True:
        spec = BATCH_QUEUE.get()
        job_id = spec["job_id"]
        try:
            _update_job(job_id, status="downloading", stage="Downloading audio", progress=0)
            info = download_audio(spec["link"], output_dir=TEMP_DIR)
            if not info:
                _update_job(job_id, status="error", stage="Download failed", error="Could not download audio from link")
                continue

            title = info.get("title", "Untitled")
            _update_job(job_id, title=title, status="fetching_lyrics", stage="Fetching lyrics")
            raw_lrc, _ = extract_lyrics(info["title"], info["artist"])
            raw_lrc = raw_lrc or ""

            job_dir = os.path.join(JOBS_DIR, job_id)
            os.makedirs(job_dir, exist_ok=True)
            progress_file = os.path.join(TEMP_DIR, f"{job_id}_progress.json")

            settings = dict(spec["settings"])
            settings["file_name"] = f"{_sanitize_filename(title)} (Slowed + Reverb)"

            _update_job(job_id, status="rendering", stage="Rendering", progress=0, has_lyrics=bool(raw_lrc))
            result = execute_render(job_id, job_dir, info["filepath"], raw_lrc, spec["image_path"], settings, progress_file)
            _update_job(job_id, status="done", stage="Done", progress=100, **result)
        except Exception as e:
            _update_job(job_id, status="error", stage="Error", error=str(e))
        finally:
            BATCH_QUEUE.task_done()


threading.Thread(target=_batch_worker, daemon=True).start()


class LyricsRequest(BaseModel):
    url: str

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Lyric Video Generator API is running"}

@app.post("/api/suggest-colors")
async def suggest_colors(
    image: UploadFile = File(...),
    aspect_ratio: str = Form("16:9")
):
    """Analyze an uploaded background image and return color theory palettes, WCAG text contrast, and font recommendations."""
    try:
        from color_extract import suggest_typography_colors
        
        # Save image temporarily
        temp_id = uuid.uuid4().hex[:8]
        ext = image.filename.split(".")[-1].lower() if "." in image.filename else "jpg"
        temp_path = os.path.join(TEMP_DIR, f"temp_color_bg_{temp_id}.{ext}")
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
            
        suggestions = suggest_typography_colors(temp_path, aspect_ratio=aspect_ratio)
        
        # Cleanup
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
            
        return {"status": "success", "data": suggestions}
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        return JSONResponse({"status": "error", "message": err_msg}, status_code=500)

@app.post("/api/fetch-audio")
async def fetch_audio(url: str = Form(...)):
    print(f"Downloading audio from {url}...")
    try:
        info = download_audio(url, output_dir=TEMP_DIR)

        if not info:
            return {"status": "error", "message": "Failed to download audio. Check the youtube link."}

        raw_lrc, parsed_lyrics = extract_lyrics(info['title'], info['artist'])

        return {
            "status": "success",
            "metadata": info,
            "raw_lrc": raw_lrc,
            "lyrics": parsed_lyrics
        }
    except Exception as e:
        import traceback
        return JSONResponse({"status": "error", "message": traceback.format_exc()}, status_code=500)

@app.post("/api/upload-audio")
async def upload_audio(audio: UploadFile = File(...)):
    """Accept a local MP3/WAV file upload."""
    ext = audio.filename.split(".")[-1]
    job_id = uuid.uuid4().hex[:8]
    save_path = os.path.join(TEMP_DIR, f"uploaded_audio_{job_id}.{ext}")
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)
    return {
        "status": "success",
        "metadata": {
            "filepath": save_path,
            "title": audio.filename.rsplit('.', 1)[0],
            "artist": "Unknown"
        }
    }

@app.get("/api/audio-waveform")
async def audio_waveform(audio_path: str):
    """Generate downsampled peak amplitude data for visual waveform rendering."""
    if not audio_path or not os.path.exists(audio_path):
        return JSONResponse({"status": "error", "message": "Audio file not found"}, status_code=400)
    try:
        from pydub import AudioSegment
        import numpy as np
        
        # Load audio and decode to mono 8000Hz for fast processing
        audio = AudioSegment.from_file(audio_path)
        audio = audio.set_channels(1).set_frame_rate(8000)
        
        samples = np.abs(np.array(audio.get_array_of_samples(), dtype=np.float32))
        
        num_peaks = 150
        chunk_size = len(samples) // num_peaks
        if chunk_size < 1:
            chunk_size = 1
            
        peaks = []
        for i in range(num_peaks):
            start = i * chunk_size
            end = start + chunk_size
            chunk = samples[start:end]
            if len(chunk) > 0:
                peaks.append(float(np.max(chunk)))
            else:
                peaks.append(0.0)
                
        # Normalize between 0.0 and 1.0
        max_val = max(peaks) if peaks else 1.0
        if max_val > 0:
            peaks = [p / max_val for p in peaks]
            
        return {"status": "success", "peaks": peaks}
    except Exception as e:
        import traceback
        return JSONResponse({"status": "error", "message": str(e), "traceback": traceback.format_exc()}, status_code=500)

@app.get("/api/download/{file_path:path}")
async def download_file(file_path: str):
    """Serve a rendered video for download (file_path is relative to temp/, e.g. jobs/<id>/<name>.mp4)."""
    full_path = os.path.realpath(os.path.join(TEMP_DIR, file_path))
    temp_root = os.path.realpath(TEMP_DIR)
    if not full_path.startswith(temp_root + os.sep):
        return JSONResponse({"status": "error", "message": "Invalid path"}, status_code=400)
    if os.path.exists(full_path):
        return FileResponse(full_path, media_type="video/mp4", filename=os.path.basename(full_path))
    return JSONResponse({"status": "error", "message": "File not found"}, status_code=404)

@app.get("/api/search-lyrics")
def search_lyrics(q: str):
    try:
        response = requests.get("https://lrclib.net/api/search", params={"q": q}, timeout=10)
        response.raise_for_status()
        return {"status": "success", "results": response.json()}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/downloader/info")
def downloader_info(url: str):
    info = extract_media_info(url)
    if info:
        return {"status": "success", "info": info}
    return JSONResponse({"status": "error", "message": "Failed to fetch metadata"}, status_code=400)

@app.post("/api/downloader/fetch")
async def downloader_fetch(url: str = Form(...), format: str = Form("mp4"), start_time: float = Form(0.0), end_time: float = Form(0.0)):
    # Since download blocks, we run it in a thread to keep FastAPI responsive
    result = await asyncio.to_thread(download_media, url, format, TEMP_DIR, start_time, end_time)
    if result:
        filename = os.path.basename(result["filepath"])
        
        # Optionally copy to root outputs folder for organization
        ROOT_OUTPUTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "outputs"))
        os.makedirs(ROOT_OUTPUTS_DIR, exist_ok=True)
        shutil.copyfile(result["filepath"], os.path.join(ROOT_OUTPUTS_DIR, filename))
        
        url_path = quote(filename, safe='/')
        return {"status": "success", "download_url": f"/api/download/{url_path}"}
    return JSONResponse({"status": "error", "message": "Failed to download media"}, status_code=500)

@app.get("/api/render-progress")
def get_render_progress(job_id: str = None):
    try:
        filename = f"{job_id}_progress.json" if job_id else "render_progress.json"
        with open(os.path.join(TEMP_DIR, filename), "r") as f:
            return json.load(f)
    except:
        return {"progress": 0}

@app.post("/api/preview-audio")
def preview_audio(
    audio_path: str = Form(...),
    job_id: str = Form(None),
    speed: float = Form(1.0),
    reverb_room_size: float = Form(0.5),
    reverb_mix: float = Form(0.2),
    bass_boost_db: float = Form(0.0),
    treble_boost_db: float = Form(0.0),
    vintage_warmth: float = Form(0.0),
    enable_8d: bool = Form(False),
    orbit_time: float = Form(20.0),
    orbit_ducking: float = Form(4.0),
    orbit_widening: float = Form(0.15),
    trim_start: float = Form(0.0),
    trim_end: float = Form(0.0)
):
    if not job_id:
        job_id = uuid.uuid4().hex[:8]
    print("Generating audio preview...")
    progress_file = os.path.join(TEMP_DIR, f"{job_id}_progress.json")
    with open(progress_file, 'w') as f:
        json.dump({"progress": 0, "stage": "starting"}, f)

    preview_audio_path = os.path.join(PREVIEW_DIR, f"preview_audio_{job_id}.wav")
    apply_audio_effects(
        input_path=audio_path,
        output_path=preview_audio_path,
        speed=speed,
        reverb_room_size=reverb_room_size,
        reverb_mix=reverb_mix / 100.0,
        bass_boost_db=bass_boost_db,
        treble_boost_db=treble_boost_db,
        vintage_warmth=vintage_warmth / 100.0,
        enable_8d=enable_8d,
        orbit_time=orbit_time,
        orbit_ducking=orbit_ducking,
        orbit_widening=orbit_widening,
        preview=True,
        trim_start=trim_start,
        trim_end=trim_end,
        progress_file=progress_file,
        progress_start=0,
        progress_end=100
    )
    with open(progress_file, 'w') as f:
        json.dump({"progress": 100, "stage": "done"}, f)
    return {"status": "success", "audio_url": f"/files/preview/preview_audio_{job_id}.wav?t={uuid.uuid4().hex[:8]}"}

@app.post("/api/generate-mask")
async def generate_mask(
    image: UploadFile = File(None),
    image_path: str = Form(None),
    job_id: str = Form(None),
    points_json: str = Form(None)
):
    """
    Generate a transparent subject mask PNG for Text-Behind-Subject 3D depth effect.
    Accepts either an uploaded file or an existing server image_path, guided by clicked points.
    """
    try:
        if not job_id:
            job_id = uuid.uuid4().hex[:8]
            
        mask_dir = os.path.join(TEMP_DIR, "masks")
        os.makedirs(mask_dir, exist_ok=True)
        
        if image:
            ext = image.filename.split(".")[-1].lower() if image.filename else "png"
            input_path = os.path.join(mask_dir, f"input_{job_id}.{ext}")
            with open(input_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
        elif image_path:
            full_path = os.path.realpath(image_path)
            temp_root = os.path.realpath(TEMP_DIR)
            if not full_path.startswith(temp_root + os.sep) and not os.path.exists(image_path):
                return JSONResponse({"status": "error", "message": "Invalid or non-existent image path"}, status_code=400)
            input_path = image_path
        else:
            return JSONResponse({"status": "error", "message": "No image file or image_path provided"}, status_code=400)

        points = None
        if points_json:
            try:
                points = json.loads(points_json)
            except Exception:
                pass

        output_mask_path = os.path.join(mask_dir, f"mask_{job_id}.png")
        
        from rotoscope_engine import generate_subject_mask_detailed
        mask_path, method = await asyncio.to_thread(generate_subject_mask_detailed, input_path, output_mask_path, points)
        
        rel_path = os.path.relpath(mask_path, TEMP_DIR)
        url_path = quote(rel_path, safe='/')
        
        return {
            "status": "success",
            "mask_url": f"/files/{url_path}",
            "mask_path": mask_path,
            "method": method
        }
    except Exception as e:
        import traceback
        return JSONResponse({"status": "error", "message": str(e), "traceback": traceback.format_exc()}, status_code=500)

@app.post("/api/generate-chroma-mask")
async def generate_chroma_mask_endpoint(
    image: UploadFile = File(None),
    image_path: str = Form(None),
    target_hex: str = Form(...),
    tolerance: int = Form(40),
    job_id: str = Form(None)
):
    """Generate a Chroma Key mask based on a selected color."""
    try:
        if not job_id:
            job_id = uuid.uuid4().hex[:8]
            
        mask_dir = os.path.join(TEMP_DIR, "masks")
        os.makedirs(mask_dir, exist_ok=True)
        
        if image:
            ext = image.filename.split(".")[-1].lower() if image.filename else "png"
            input_path = os.path.join(mask_dir, f"input_chroma_{job_id}.{ext}")
            with open(input_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
        elif image_path:
            full_path = os.path.realpath(image_path)
            temp_root = os.path.realpath(TEMP_DIR)
            if not full_path.startswith(temp_root + os.sep) and not os.path.exists(image_path):
                return JSONResponse({"status": "error", "message": "Invalid or non-existent image path"}, status_code=400)
            input_path = image_path
        else:
            return JSONResponse({"status": "error", "message": "No image file or image_path provided"}, status_code=400)

        output_mask_path = os.path.join(mask_dir, f"mask_chroma_{job_id}.png")
        
        from rotoscope_engine import generate_chroma_mask
        mask_path = await asyncio.to_thread(generate_chroma_mask, input_path, target_hex, tolerance, output_mask_path)
        
        rel_path = os.path.relpath(mask_path, TEMP_DIR)
        url_path = quote(rel_path, safe='/')
        
        return {
            "status": "success",
            "mask_url": f"/files/{url_path}",
            "mask_path": mask_path
        }
    except Exception as e:
        import traceback
        return JSONResponse({"status": "error", "message": str(e), "traceback": traceback.format_exc()}, status_code=500)

@app.post("/api/upload-mask")
async def upload_mask(mask: UploadFile = File(...)):
    """Accept a pre-cut transparent PNG mask for 3D rotoscope."""
    try:
        job_id = uuid.uuid4().hex[:8]
        mask_dir = os.path.join(TEMP_DIR, "masks")
        os.makedirs(mask_dir, exist_ok=True)
        
        ext = mask.filename.split(".")[-1].lower() if mask.filename else "png"
        save_path = os.path.join(mask_dir, f"custom_mask_{job_id}.{ext}")
        
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(mask.file, buffer)
            
        rel_path = os.path.relpath(save_path, TEMP_DIR)
        url_path = quote(rel_path, safe='/')
        
        return {
            "status": "success",
            "mask_url": f"/files/{url_path}",
            "mask_path": save_path
        }
    except Exception as e:
        import traceback
        return JSONResponse({"status": "error", "message": str(e), "traceback": traceback.format_exc()}, status_code=500)


@app.get("/api/generate-lyrics")
async def generate_lyrics(audio_path: str):
    """
    Auto-generates LRC lyrics using a local Whisper model, transcribing the
    original (unprocessed) audio so timestamps land on the same timeline as
    lrclib lyrics and aren't double-adjusted by the speed change later.
    Extracts word-level timestamps using Whisper's word_timestamps=True.
    """
    if not audio_path or not os.path.exists(audio_path):
        return JSONResponse({"status": "error", "message": "No audio found. Please import a track in Step 1 first!"}, status_code=400)

    full_path = os.path.realpath(audio_path)
    temp_root = os.path.realpath(TEMP_DIR)
    if not full_path.startswith(temp_root + os.sep):
        return JSONResponse({"status": "error", "message": "Invalid audio path."}, status_code=400)

    try:
        global WHISPER_MODEL
        if WHISPER_MODEL is None:
            import whisper
            print("Loading Whisper model...")
            WHISPER_MODEL = whisper.load_model("base")
        
        print("Transcribing audio with word-level timestamps...")
        result = await asyncio.to_thread(WHISPER_MODEL.transcribe, full_path, word_timestamps=True)

        # Format into ELRC with word-level timestamps
        lrc_lines = []
        for segment in result["segments"]:
            start = segment["start"]
            text = segment["text"].strip()
            words = segment.get("words", [])

            mins = int(start // 60)
            secs = int(start % 60)
            millis = int((start - int(start)) * 100)

            if words:
                word_parts = []
                for w in words:
                    w_start = w["start"]
                    wm = int(w_start // 60)
                    ws = int(w_start % 60)
                    wms = int((w_start - int(w_start)) * 100)
                    word_parts.append(f"<{wm:02d}:{ws:02d}.{wms:02d}>{w['word']}")
                lrc_lines.append(f"[{mins:02d}:{secs:02d}.{millis:02d}] " + "".join(word_parts))
            else:
                lrc_lines.append(f"[{mins:02d}:{secs:02d}.{millis:02d}] {text}")

        raw_lrc = "\n".join(lrc_lines)
        parsed_lyrics = parse_lrc(raw_lrc)
        return {"status": "success", "lyrics": raw_lrc, "parsed_lyrics": parsed_lyrics}

    except ImportError:
        return JSONResponse({
            "status": "error",
            "message": "Whisper is not installed. Run this in your terminal: \n\ncd backend && source venv/bin/activate && pip install openai-whisper"
        }, status_code=500)
    except Exception as e:
        return JSONResponse({"status": "error", "message": f"Transcription failed: {str(e)}"}, status_code=500)

@app.post("/api/render")
def render_video(
    audio_path: str = Form(...),
    raw_lrc: str = Form(...),
    speed: float = Form(1.0),
    reverb_room_size: float = Form(0.5),
    reverb_mix: float = Form(0.2),
    bass_boost_db: float = Form(0.0),
    treble_boost_db: float = Form(0.0),
    vintage_warmth: float = Form(0.0),
    enable_8d: bool = Form(False),
    orbit_time: float = Form(20.0),
    orbit_ducking: float = Form(4.0),
    orbit_widening: float = Form(0.15),
    font_family: str = Form("Montserrat"),
    font_color: str = Form("#ffffff"),
    pos_x: int = Form(50),
    pos_y: int = Form(50),
    text_transform: str = Form("uppercase"),
    stroke_width: int = Form(2),
    stroke_color: str = Form("#000000"),
    shadow_offset: int = Form(4),
    font_size: int = Form(60),
    quality: str = Form("final"),
    engine: str = Form("ffmpeg"),
    lyric_style: str = Form("single"),
    aspect_ratio: str = Form("16:9"),
    bg_mode: str = Form("image"),
    bg_blur: float = Form(0.0),
    bg_dim: float = Form(0.0),
    ken_burns: bool = Form(False),
    grain: float = Form(0.0),
    vignette_strength: float = Form(0.0),
    gradient_colors: str = Form(None),
    file_name: str = Form("final_lyric_video"),
    beat_bounce: bool = Form(False),
    particles: bool = Form(False),
    lyric_preset: str = Form("line-pop"),
    lyric_offset: float = Form(0.0),
    show_intro: bool = Form(False),
    song_title: str = Form(""),
    trim_start: float = Form(0.0),
    trim_end: float = Form(0.0),
    canvas_mode: bool = Form(False),
    mask_subject: bool = Form(False),
    subject_image_path: str = Form(None),
    job_id: str = Form(None),
    bloom_color: str = Form(None),
    bloom_radius: int = Form(0),
    beat_shake: bool = Form(False),
    chromatic_aberration: bool = Form(False),
    overlay_video_path: str = Form(None),
    overlay_opacity: float = Form(0.4),
    overlay_mode: str = Form("screen"),
    image: UploadFile = File(...)
):
    try:
        if not job_id:
            job_id = uuid.uuid4().hex[:12]
        job_dir = os.path.join(JOBS_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)

        progress_file = os.path.join(TEMP_DIR, f"{job_id}_progress.json")
        with open(progress_file, 'w') as f:
            json.dump({"progress": 0, "stage": "starting"}, f)

        # Save uploaded background into the job directory
        image_ext = image.filename.split(".")[-1].lower()
        image_path = os.path.join(job_dir, f"bg_image.{image_ext}")
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        # Convert frontend units to apply_audio_effects-native units at the boundary:
        # reverb_mix arrives 0-100, vintage_warmth arrives 0-1, orbit_widening arrives 0-1.
        settings = dict(
            speed=speed, reverb_room_size=reverb_room_size, reverb_mix=reverb_mix / 100.0,
            bass_boost_db=bass_boost_db, treble_boost_db=treble_boost_db, vintage_warmth=vintage_warmth,
            enable_8d=enable_8d, orbit_time=orbit_time, orbit_ducking=orbit_ducking, orbit_widening=orbit_widening,
            font_family=font_family, font_color=font_color, pos_x=pos_x, pos_y=pos_y,
            text_transform=text_transform, stroke_width=stroke_width, stroke_color=stroke_color,
            shadow_offset=shadow_offset, font_size=font_size, quality=quality, engine=engine,
            lyric_style=lyric_style, aspect_ratio=aspect_ratio, bg_mode=bg_mode, bg_blur=bg_blur,
            bg_dim=bg_dim, ken_burns=ken_burns, grain=grain, vignette_strength=vignette_strength,
            gradient_colors=json.loads(gradient_colors) if gradient_colors else None,
            file_name=file_name, beat_bounce=beat_bounce, particles=particles,
            lyric_preset=lyric_preset, canvas_mode=canvas_mode,
            lyric_offset=lyric_offset, show_intro=show_intro, song_title=song_title,
            trim_start=trim_start, trim_end=trim_end,
            mask_subject=mask_subject, subject_image_path=subject_image_path,
            bloom_color=bloom_color, bloom_radius=bloom_radius, beat_shake=beat_shake,
            chromatic_aberration=chromatic_aberration, overlay_video_path=overlay_video_path,
            overlay_opacity=overlay_opacity, overlay_mode=overlay_mode
        )

        result = execute_render(job_id, job_dir, audio_path, raw_lrc, image_path, settings, progress_file)
        return {"status": "success", **result}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

# Background-style shortcuts for the batch grid (keeps per-row setup fast)
BATCH_BG_STYLES = {
    "plain":     dict(bg_mode="image",    bg_blur=0,  bg_dim=0.0,  ken_burns=False, grain=0,  vignette_strength=0.0),
    "cinematic": dict(bg_mode="image",    bg_blur=8,  bg_dim=0.3,  ken_burns=True,  grain=6,  vignette_strength=0.4),
    "gradient":  dict(bg_mode="gradient", bg_blur=0,  bg_dim=0.0,  ken_burns=False, grain=0,  vignette_strength=0.3),
}


@app.post("/api/batch/submit")
async def batch_submit(
    link: str = Form(...),
    preset_values: str = Form(...),   # JSON of {speed, reverbRoom, reverbMix, bassBoost, trebleBoost, warmth, enable8D, orbitTime, orbitDucking, orbitWidening}
    aspect_ratio: str = Form("16:9"),
    quality: str = Form("final"),
    bg_style: str = Form("cinematic"),
    lyric_style: str = Form("single"),
    image: UploadFile = File(...),
):
    job_id = uuid.uuid4().hex[:12]
    job_dir = os.path.join(JOBS_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    image_ext = image.filename.split(".")[-1].lower()
    image_path = os.path.join(job_dir, f"bg_image.{image_ext}")
    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    pv = json.loads(preset_values)
    bg = BATCH_BG_STYLES.get(bg_style, BATCH_BG_STYLES["cinematic"])
    settings = dict(
        speed=pv["speed"], reverb_room_size=pv["reverbRoom"], reverb_mix=pv["reverbMix"] / 100.0,
        bass_boost_db=pv["bassBoost"], treble_boost_db=pv["trebleBoost"], vintage_warmth=pv["warmth"],
        enable_8d=pv["enable8D"], orbit_time=pv["orbitTime"], orbit_ducking=pv["orbitDucking"],
        orbit_widening=pv["orbitWidening"] / 100.0,
        font_family="Montserrat", font_color="#ffffff", pos_x=50, pos_y=50, text_transform="uppercase",
        stroke_width=2, stroke_color="#000000", shadow_offset=4, font_size=60,
        quality=quality, engine="ffmpeg", lyric_style=lyric_style, aspect_ratio=aspect_ratio,
        **bg, file_name="lyric_video",
    )

    _update_job(job_id, status="queued", stage="Queued", progress=0, title=link, link=link)
    BATCH_QUEUE.put({"job_id": job_id, "link": link, "image_path": image_path, "settings": settings})
    return {"status": "success", "job_id": job_id}


@app.get("/api/batch/jobs")
def batch_jobs():
    with BATCH_LOCK:
        jobs = [dict(j) for j in BATCH_JOBS.values()]
    # Merge live render progress from each rendering job's progress file
    for j in jobs:
        if j.get("status") == "rendering":
            try:
                with open(os.path.join(TEMP_DIR, f"{j['id']}_progress.json")) as f:
                    p = json.load(f)
                    j["progress"] = p.get("progress", j.get("progress", 0))
            except Exception:
                pass
    return {"status": "success", "jobs": jobs}


@app.post("/api/batch/clear")
def batch_clear():
    """Remove finished/errored jobs from the list (does not stop in-flight jobs)."""
    with BATCH_LOCK:
        for jid in [k for k, v in BATCH_JOBS.items() if v.get("status") in ("done", "error")]:
            del BATCH_JOBS[jid]
    return {"status": "success"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
