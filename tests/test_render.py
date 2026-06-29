import sys
import os

sys.path.append(os.path.abspath("backend"))

from lyrics_extractor import extract_lyrics
from video_composer import create_video

IMAGE_PATH = "backend/temp/bg_image.png"
AUDIO_PATH = "backend/temp/processed_audio.wav"
TEMP_DIR = "backend/temp"

def run():
    print("Extracting lyrics...")
    lyrics = extract_lyrics("Tom Odell - Another Love", "7clouds")
    
    print("Compositing video...")
    output_video = os.path.join(TEMP_DIR, "final_test.mp4")
    
    try:
        create_video(
            image_path=IMAGE_PATH,
            audio_path=AUDIO_PATH,
            lyrics_data=lyrics,
            output_path=output_video,
            enable_beat_sync=False
        )
        print(f"SUCCESS! Video at {output_video}")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run()
