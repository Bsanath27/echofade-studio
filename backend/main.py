from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import uvicorn
import os
import shutil
import json
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
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR)
    
class RenderLogger(ProgressBarLogger):
    def __init__(self, filename):
        super().__init__()
        self.filename = filename
        self.last_percentage = -1

    def bars_callback(self, bar, attr, value, old_value=None):
        total = self.bars[bar].get('total', 1)
        if total > 0:
            percentage = min(int((value / total) * 100), 100)
            if percentage != self.last_percentage:
                self.last_percentage = percentage
                try:
                    with open(self.filename, 'w') as f:
                        json.dump({"progress": percentage}, f)
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

@app.get("/api/download/{filename}")
async def download_file(filename: str):
    """Serve a rendered video for download."""
    file_path = os.path.join(TEMP_DIR, filename)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="video/mp4", filename=filename)
    return {"status": "error", "message": "File not found"}

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
    preview_audio_path = os.path.join(TEMP_DIR, "preview_audio.wav")
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
        orbit_widening=orbit_widening
    )
    return {"status": "success", "audio_url": "/files/preview_audio.wav"}

@app.get("/api/generate-lyrics")
async def generate_lyrics():
    """
    Auto-generates LRC lyrics using a local Whisper model.
    Looks for the last processed audio file in TEMP_DIR.
    """
    audio_file = os.path.join(TEMP_DIR, "processed_audio.wav")
    if not os.path.exists(audio_file):
        return JSONResponse({"status": "error", "message": "No processed audio found. Please master your audio in Step 2 first!"}, status_code=400)
    
    try:
        import whisper
        print("Loading Whisper model...")
        model = whisper.load_model("base")
        print("Transcribing audio...")
        result = model.transcribe(audio_file)
        
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
    enable_beat_sync: bool = Form(False),
    file_name: str = Form("final_lyric_video"),
    image: UploadFile = File(...)
):
    try:
        progress_file = os.path.join(TEMP_DIR, "render_progress.json")
        with open(progress_file, 'w') as f:
            json.dump({"progress": 0}, f)
            
        lyrics_data = parse_lrc(raw_lrc)
        
        # 1. Save uploaded image
        image_ext = image.filename.split(".")[-1].lower()
        image_path = os.path.join(TEMP_DIR, f"bg_image.{image_ext}")
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
            
        # Convert HEIC to JPG using macOS native sips
        if image_ext in ['heic', 'heif']:
            jpg_path = os.path.join(TEMP_DIR, "bg_image.jpg")
            os.system(f"sips -s format jpeg '{image_path}' --out '{jpg_path}' > /dev/null 2>&1")
            image_path = jpg_path
            
        # 2. Process Audio
        print("Processing audio...")
        processed_audio_path = os.path.join(TEMP_DIR, "processed_audio.wav")
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
            orbit_widening=orbit_widening
        )
        
        # Setup Logger
        progress_file = os.path.join(TEMP_DIR, "render_progress.json")
        with open(progress_file, 'w') as f:
            json.dump({"progress": 0}, f)
            
        # Route to appropriate engine
        from video_composer import create_video
        from ffmpeg_engine import create_video_ffmpeg
        
        composer_kwargs = dict(
            image_path=image_path,
            audio_path=processed_audio_path,
            lyrics_data=lyrics_data,
            output_path=os.path.join(TEMP_DIR, file_name if file_name.endswith('.mp4') else f"{file_name}.mp4"),
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
            enable_beat_sync=enable_beat_sync,
        )

        if engine == "ffmpeg":
            create_video_ffmpeg(
                **composer_kwargs,
                progress_file=progress_file
            )
        else:
            create_video(
                **composer_kwargs,
                logger=RenderLogger(progress_file)
            )
        
        return {"status": "success", "video_url": f"/files/{file_name}", "download_url": f"/api/download/{file_name}"}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
