import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"
VIDEO_URL = "https://youtu.be/ixRLjjTRczE?si=oe3jh6yLoZ7qwwOa"
IMAGE_PATH = "/Users/sanathbs/.gemini/antigravity-ide/brain/ac76b409-750e-42de-9904-796c0f323ec8/lyric_bg_1782553845845.png"

def run_workflow():
    print("1. Fetching Audio...")
    res = requests.post(f"{BASE_URL}/api/fetch-audio", data={"url": VIDEO_URL})
    
    if res.status_code != 200:
        print(f"Fetch failed with {res.status_code}: {res.text}")
        return
        
    data = res.json()
    if data["status"] != "success":
        print("Fetch returned error:", data)
        return
        
    audio_path = data["metadata"]["filepath"]
    lyrics = data["lyrics"]
    print(f"Audio downloaded to: {audio_path}")
    
    print("\n2. Rendering Video...")
    render_data = {
        "audio_path": audio_path,
        "lyrics_json": json.dumps(lyrics),
        "speed": 0.85, # Let's make it slowed
        "reverb": 35.0, # decent amount of reverb
        "enable_8d": False,
        "enable_beat_sync": False
    }
    
    with open(IMAGE_PATH, "rb") as img_file:
        files = {"image": ("bg.png", img_file, "image/png")}
        res_render = requests.post(f"{BASE_URL}/api/render", data=render_data, files=files)
        
    if res_render.status_code != 200:
        print(f"Render failed with {res_render.status_code}: {res_render.text}")
        return
        
    render_resp = res_render.json()
    if render_resp["status"] != "success":
        print("Render returned error:", render_resp)
        return
        
    print(f"SUCCESS! Video rendered at: {render_resp['video_url']}")

if __name__ == "__main__":
    run_workflow()
