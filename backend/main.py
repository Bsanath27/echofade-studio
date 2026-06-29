from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
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

    s = settings
    lyrics_data = parse_lrc(raw_lrc)

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
        progress_end=15,
    )

    # 2. Video render (15-100%)
    final_filename = s['file_name'] if s['file_name'].lower().endswith('.mp4') else f"{s['file_name']}.mp4"
    output_path = os.path.join(job_dir, final_filename)
    composer_kwargs = dict(
        image_path=image_path, audio_path=processed_audio_path, lyrics_data=lyrics_data,
        output_path=output_path, speed=s['speed'], font_family=s['font_family'],
        font_color=s['font_color'], pos_x=s['pos_x'], pos_y=s['pos_y'],
        text_transform=s['text_transform'], stroke_width=s['stroke_width'],
        stroke_color=s['stroke_color'], shadow_offset=s['shadow_offset'],
        font_size=s['font_size'], quality=s['quality'], aspect_ratio=s['aspect_ratio'],
    )
    if s['engine'] == "ffmpeg":
        create_video_ffmpeg(
            **composer_kwargs, lyric_style=s['lyric_style'], bg_mode=s['bg_mode'],
            bg_blur=s['bg_blur'], bg_dim=s['bg_dim'], ken_burns=s['ken_burns'],
            grain=s['grain'], vignette_strength=s['vignette_strength'],
            gradient_colors=s.get('gradient_colors'),
            progress_file=progress_file, progress_start=15, progress_end=100,
        )
    else:
        create_video(**composer_kwargs, logger=RenderLogger(progress_file, progress_start=15, progress_end=100))

    with open(progress_file, 'w') as f:
        json.dump({"progress": 100, "stage": "done"}, f)

    # Copy to the shared outputs folder (dedupe by job_id if name collides)
    ROOT_OUTPUTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "outputs"))
    os.makedirs(ROOT_OUTPUTS_DIR, exist_ok=True)
    final_output_path = os.path.join(ROOT_OUTPUTS_DIR, final_filename)
    if os.path.exists(final_output_path):
        base, ext = os.path.splitext(final_filename)
        final_output_path = os.path.join(ROOT_OUTPUTS_DIR, f"{base}_{job_id}{ext}")
    shutil.copyfile(output_path, final_output_path)

    prune_old_jobs()
    url_path = quote(f"jobs/{job_id}/{final_filename}", safe='/')
    return {"video_url": f"/files/{url_path}", "download_url": f"/api/download/{url_path}"}


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

@app.post("/api/fetch-audio")
async def fetch_audio(url: str = Form(...)):
    print(f"Downloading audio from {url}...")
    info = download_audio(url, output_dir=TEMP_DIR)

    if not info:
        return {"status": "error", "message": "Failed to download audio."}

    raw_lrc, parsed_lyrics = extract_lyrics(info['title'], info['artist'])

    return {
        "status": "success",
        "metadata": info,
        "raw_lrc": raw_lrc,
        "lyrics": parsed_lyrics
    }

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
async def downloader_fetch(url: str = Form(...), format: str = Form("mp4")):
    # Since download blocks, we run it in a thread to keep FastAPI responsive
    result = await asyncio.to_thread(download_media, url, format, TEMP_DIR)
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
    orbit_widening: float = Form(0.15)
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
        progress_file=progress_file,
        progress_start=0,
        progress_end=100
    )
    with open(progress_file, 'w') as f:
        json.dump({"progress": 100, "stage": "done"}, f)
    return {"status": "success", "audio_url": f"/files/preview/preview_audio_{job_id}.wav?t={uuid.uuid4().hex[:8]}"}

@app.get("/api/generate-lyrics")
async def generate_lyrics(audio_path: str):
    """
    Auto-generates LRC lyrics using a local Whisper model, transcribing the
    original (unprocessed) audio so timestamps land on the same timeline as
    lrclib lyrics and aren't double-adjusted by the speed change later.
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
        
        print("Transcribing audio...")
        result = await asyncio.to_thread(WHISPER_MODEL.transcribe, full_path)

        # Format into LRC
        lrc_lines = []
        for segment in result["segments"]:
            start = segment["start"]
            text = segment["text"].strip()

            # Format time to mm:ss.xx
            mins = int(start // 60)
            secs = int(start % 60)
            millis = int((start - int(start)) * 100)
            lrc_lines.append(f"[{mins:02d}:{secs:02d}.{millis:02d}] {text}")

        return {"status": "success", "lyrics": "\n".join(lrc_lines)}
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
    job_id: str = Form(None),
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
            file_name=file_name,
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
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
