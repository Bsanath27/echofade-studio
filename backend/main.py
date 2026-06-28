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
from proglog import ProgressBarLogger

from downloader import download_audio
from lyrics_extractor import extract_lyrics, parse_lrc
from audio_processor import apply_audio_effects
from video_composer import create_video
import requests

app = FastAPI(title="Lyric Video Generator API")

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
    save_path = os.path.join(TEMP_DIR, f"uploaded_audio.{ext}")
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

@app.get("/api/render-progress")
def get_render_progress():
    try:
        with open(os.path.join(TEMP_DIR, "render_progress.json"), "r") as f:
            return json.load(f)
    except:
        return {"progress": 0}

@app.post("/api/preview-audio")
async def preview_audio(
    audio_path: str = Form(...),
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
    print("Generating audio preview...")
    progress_file = os.path.join(TEMP_DIR, "render_progress.json")
    with open(progress_file, 'w') as f:
        json.dump({"progress": 0, "stage": "starting"}, f)

    preview_audio_path = os.path.join(PREVIEW_DIR, "preview_audio.wav")
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
    return {"status": "success", "audio_url": f"/files/preview/preview_audio.wav?t={uuid.uuid4().hex[:8]}"}

@app.get("/api/generate-lyrics")
async def generate_lyrics(audio_path: str):
    """
    Auto-generates LRC lyrics using a local Whisper model, transcribing the
    original (unprocessed) audio so timestamps land on the same timeline as
    lrclib lyrics and aren't double-adjusted by the speed change later.
    """
    if not audio_path or not os.path.exists(audio_path):
        return JSONResponse({"status": "error", "message": "No audio found. Please import a track in Step 1 first!"}, status_code=400)

    try:
        import whisper
        print("Loading Whisper model...")
        model = whisper.load_model("base")
        print("Transcribing audio...")
        result = model.transcribe(audio_path)

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
async def render_video(
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
    file_name: str = Form("final_lyric_video"),
    image: UploadFile = File(...)
):
    try:
        # 0. Set up an isolated job directory so concurrent/successive renders
        # never clobber each other's inputs or outputs.
        job_id = uuid.uuid4().hex[:12]
        job_dir = os.path.join(JOBS_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)

        progress_file = os.path.join(TEMP_DIR, "render_progress.json")
        with open(progress_file, 'w') as f:
            json.dump({"progress": 0, "stage": "starting"}, f)

        lyrics_data = parse_lrc(raw_lrc)

        # 1. Save uploaded image into the job directory
        image_ext = image.filename.split(".")[-1].lower()
        image_path = os.path.join(job_dir, f"bg_image.{image_ext}")
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        # Convert HEIC to JPG using macOS native sips
        if image_ext in ['heic', 'heif']:
            jpg_path = os.path.join(job_dir, "bg_image.jpg")
            os.system(f"sips -s format jpeg '{image_path}' --out '{jpg_path}' > /dev/null 2>&1")
            image_path = jpg_path

        # 2. Process Audio (occupies the first 15% of the progress bar)
        print("Processing audio...")
        processed_audio_path = os.path.join(job_dir, "processed_audio.wav")
        apply_audio_effects(
            input_path=audio_path,
            output_path=processed_audio_path,
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
            progress_end=15
        )

        # 3. Render video (occupies the remaining 85%)
        from video_composer import create_video
        from ffmpeg_engine import create_video_ffmpeg

        final_filename = file_name if file_name.lower().endswith('.mp4') else f"{file_name}.mp4"
        output_path = os.path.join(job_dir, final_filename)

        composer_kwargs = dict(
            image_path=image_path,
            audio_path=processed_audio_path,
            lyrics_data=lyrics_data,
            output_path=output_path,
            speed=speed,
            font_family=font_family,
            font_color=font_color,
            pos_x=pos_x,
            pos_y=pos_y,
            text_transform=text_transform,
            stroke_width=stroke_width,
            stroke_color=stroke_color,
            shadow_offset=shadow_offset,
            font_size=font_size,
            quality=quality,
            aspect_ratio=aspect_ratio,
        )

        if engine == "ffmpeg":
            create_video_ffmpeg(
                **composer_kwargs,
                lyric_style=lyric_style,
                progress_file=progress_file,
                progress_start=15,
                progress_end=100
            )
        else:
            create_video(
                **composer_kwargs,
                logger=RenderLogger(progress_file, progress_start=15, progress_end=100)
            )

        with open(progress_file, 'w') as f:
            json.dump({"progress": 100, "stage": "done"}, f)

        prune_old_jobs()

        url_path = quote(f"jobs/{job_id}/{final_filename}", safe='/')
        return {"status": "success", "video_url": f"/files/{url_path}", "download_url": f"/api/download/{url_path}"}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
