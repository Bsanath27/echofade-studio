import sys
import os
import json

sys.path.append(os.path.abspath("backend"))

from downloader import download_audio
from lyrics_extractor import extract_lyrics
from audio_processor import apply_audio_effects
from video_composer import create_video

VIDEO_URL = "https://youtu.be/ixRLjjTRczE?si=oe3jh6yLoZ7qwwOa"
IMAGE_PATH = "/Users/sanathbs/.gemini/antigravity-ide/brain/ac76b409-750e-42de-9904-796c0f323ec8/lyric_bg_1782553845845.png"
TEMP_DIR = "backend/temp"

def run():
    print("1. Fetching Audio...")
    info = download_audio(VIDEO_URL, output_dir=TEMP_DIR)
    if not info:
        print("Failed to download audio")
        return
        
    audio_path = info["filepath"]
    print(f"Downloaded audio to {audio_path}")
    
    print("2. Extracting lyrics...")
    lyrics = extract_lyrics(info["title"], info["artist"])
    
    print("3. Processing Audio...")
    processed_audio = os.path.join(TEMP_DIR, "processed_audio.wav")
    apply_audio_effects(
        input_path=audio_path,
        output_path=processed_audio,
        speed=0.85,
        reverb_amount=0.35,
        enable_8d=False
    )
    print(f"Processed audio to {processed_audio}")
    
    print("4. Compositing video...")
    output_video = os.path.join(TEMP_DIR, "final_test.mp4")
    create_video(
        image_path=IMAGE_PATH,
        audio_path=processed_audio,
        lyrics_data=lyrics,
        output_path=output_video,
        enable_beat_sync=False
    )
    print(f"SUCCESS! Video at {output_video}")

if __name__ == "__main__":
    run()
