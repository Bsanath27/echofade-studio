import os
import sys
import time
import requests
import json
import uuid
import shutil
import colorsys
from PIL import Image

# Add backend directory to sys.path so we can import color_extract
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))
from color_extract import extract_palette

# Configuration
API_URL = "http://127.0.0.1:8000"
DOWNLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../test_videos"))
BG_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../assets/backgrounds"))
CACHE_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "workflow_cache.json"))

if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, "r") as f:
            CACHE = json.load(f)
    except Exception:
        CACHE = {}
else:
    CACHE = {}

def save_cache():
    with open(CACHE_FILE, "w") as f:
        json.dump(CACHE, f, indent=4)

# Purge any incorrect lyrics cache (e.g. Halsey lyrics for Eminem's Without Me)
purged = False
for url, entry in list(CACHE.items()):
    if "lyrics" in entry and "halsey" in entry["lyrics"].lower():
        print(f"  [Cache Clean] Purging incorrect cached Halsey lyrics from: {url}")
        del entry["lyrics"]
        purged = True
if purged:
    save_cache()

# Bespoke curated 20 songs with exact best 30s clips, matching backgrounds, and premium styles
# Backgrounds mapped below strictly use files that are already successfully downloaded (no black fallbacks)
SONGS = [
    {
        "artist": "Travis Scott", "title": "SICKO MODE", "url": "https://www.youtube.com/watch?v=d-JBBNg8YKs",
        "trim_start": 60.0, "trim_end": 90.0, "speed": 0.85, "bg_img": "bg_21.jpg", # Cyberpunk Street
        "font": "Impact", "orbit_time": 12.0, "style": "single", "transform": "uppercase"
    },
    {
        "artist": "The Weeknd", "title": "Starboy", "url": "https://www.youtube.com/watch?v=dMMUH_ZaEQ4",
        "trim_start": 56.0, "trim_end": 86.0, "speed": 0.85, "bg_img": "bg_03.jpg", # Night drive
        "font": "Avenir Next", "orbit_time": 14.0, "style": "single", "transform": "uppercase"
    },
    {
        "artist": "Post Malone", "title": "Circles", "url": "https://www.youtube.com/watch?v=wXhTHyIgQ_U",
        "trim_start": 42.0, "trim_end": 72.0, "speed": 0.9, "bg_img": "bg_15.jpg", # Sunset
        "font": "Helvetica Neue", "orbit_time": 16.0, "style": "karaoke", "transform": "lowercase"
    },
    {
        "artist": "Drake", "title": "God's Plan", "url": "https://www.youtube.com/watch?v=xpVfcZ0ZcFM",
        "trim_start": 85.0, "trim_end": 115.0, "speed": 0.85, "bg_img": "bg_19.jpg", # Skyline
        "font": "Impact", "orbit_time": 13.0, "style": "single", "transform": "uppercase"
    },
    {
        "artist": "Billie Eilish", "title": "bad guy", "url": "https://www.youtube.com/watch?v=DyDfgMOUjCI",
        "trim_start": 40.0, "trim_end": 70.0, "speed": 0.85, "bg_img": "bg_16.jpg", # Neon abstract
        "font": "Arial Black", "orbit_time": 11.0, "style": "single", "transform": "lowercase"
    },
    {
        "artist": "Dua Lipa", "title": "Don't Start Now", "url": "https://www.youtube.com/watch?v=oygrmJFKYZY",
        "trim_start": 50.0, "trim_end": 80.0, "speed": 0.9, "bg_img": "bg_05.jpg", # Synthwave
        "font": "Avenir Next", "orbit_time": 14.0, "style": "karaoke", "transform": "uppercase"
    },
    {
        "artist": "Eminem", "title": "Without Me", "url": "https://www.youtube.com/watch?v=YVkUvmDQ3HY",
        "trim_start": 76.0, "trim_end": 106.0, "speed": 0.95, "bg_img": "bg_08.jpg", # Urban Street
        "font": "Impact", "orbit_time": 12.0, "style": "single", "transform": "uppercase"
    },
    {
        "artist": "Harry Styles", "title": "As It Was", "url": "https://www.youtube.com/watch?v=H5v3kku4y6Q",
        "trim_start": 43.0, "trim_end": 73.0, "speed": 0.85, "bg_img": "bg_25.jpg", # Deep Purple Sunset
        "font": "Baskerville", "orbit_time": 18.0, "style": "karaoke", "transform": "lowercase"
    },
    {
        "artist": "Imagine Dragons", "title": "Believer", "url": "https://www.youtube.com/watch?v=7wtfhZwyrcc",
        "trim_start": 65.0, "trim_end": 95.0, "speed": 0.85, "bg_img": "bg_24.jpg", # Misty Mountains
        "font": "Futura", "orbit_time": 13.0, "style": "single", "transform": "uppercase"
    },
    {
        "artist": "Arctic Monkeys", "title": "Do I Wanna Know?", "url": "https://www.youtube.com/watch?v=bpOSxM0rNPM",
        "trim_start": 67.0, "trim_end": 97.0, "speed": 0.85, "bg_img": "bg_04.jpg", # Foggy Forest
        "font": "Courier New", "orbit_time": 20.0, "style": "karaoke", "transform": "lowercase"
    },
    {
        "artist": "XXXTENTACION", "title": "SAD!", "url": "https://www.youtube.com/watch?v=pgN-vvVVxMA",
        "trim_start": 23.0, "trim_end": 53.0, "speed": 0.85, "bg_img": "bg_10.jpg", # Silhouette Sunset
        "font": "Arial Black", "orbit_time": 18.0, "style": "single", "transform": "uppercase"
    },
    {
        "artist": "Lil Nas X", "title": "INDUSTRY BABY", "url": "https://www.youtube.com/watch?v=UTHLKHL_whs",
        "trim_start": 34.0, "trim_end": 64.0, "speed": 0.9, "bg_img": "bg_12.jpg", # Sports car night
        "font": "Impact", "orbit_time": 12.0, "style": "single", "transform": "uppercase"
    },
    {
        "artist": "Coldplay", "title": "Yellow", "url": "https://www.youtube.com/watch?v=yKNxeF4KMsY",
        "trim_start": 70.0, "trim_end": 100.0, "speed": 0.85, "bg_img": "bg_13.jpg", # Starry space
        "font": "Palatino", "orbit_time": 22.0, "style": "karaoke", "transform": "lowercase"
    },
    {
        "artist": "Frank Ocean", "title": "Pink + White", "url": "https://www.youtube.com/watch?v=uzS3WG6__G4",
        "trim_start": 75.0, "trim_end": 105.0, "speed": 0.85, "bg_img": "bg_17.jpg", # Ocean/Grid
        "font": "Baskerville", "orbit_time": 18.0, "style": "single", "transform": "lowercase"
    },
    {
        "artist": "Kendrick Lamar", "title": "HUMBLE.", "url": "https://www.youtube.com/watch?v=tvTRZJ-4EyI",
        "trim_start": 42.0, "trim_end": 72.0, "speed": 0.85, "bg_img": "bg_23.jpg", # Dark Starry Space
        "font": "Impact", "orbit_time": 11.0, "style": "single", "transform": "uppercase"
    },
    {
        "artist": "Taylor Swift", "title": "Cruel Summer", "url": "https://www.youtube.com/watch?v=ic8j13piAhQ",
        "trim_start": 148.0, "trim_end": 178.0, "speed": 0.9, "bg_img": "bg_02.jpg", # Silhouette Galaxy
        "font": "Avenir Next", "orbit_time": 15.0, "style": "karaoke", "transform": "uppercase"
    },
    {
        "artist": "The Neighbourhood", "title": "Sweater Weather", "url": "https://www.youtube.com/watch?v=GCdwKhTtNNw",
        "trim_start": 90.0, "trim_end": 120.0, "speed": 0.85, "bg_img": "bg_20.jpg", # Rainy Window
        "font": "Courier New", "orbit_time": 19.0, "style": "single", "transform": "lowercase"
    },
    {
        "artist": "J. Cole", "title": "No Role Modelz", "url": "https://www.youtube.com/watch?v=0eBJz1F7U1U",
        "trim_start": 46.0, "trim_end": 76.0, "speed": 0.85, "bg_img": "bg_11.jpg", # Cyberpunk Street
        "font": "Helvetica Neue", "orbit_time": 13.0, "style": "single", "transform": "uppercase"
    },
    {
        "artist": "Mac Miller", "title": "The Spins", "url": "https://www.youtube.com/watch?v=mkjdJkUu6OQ",
        "trim_start": 50.0, "trim_end": 80.0, "speed": 0.85, "bg_img": "bg_14.jpg", # Moody Dark Road
        "font": "Arial Black", "orbit_time": 14.0, "style": "single", "transform": "lowercase"
    },
    {
        "artist": "Olivia Rodrigo", "title": "good 4 u", "url": "https://www.youtube.com/watch?v=gNi_6U5Pm_o",
        "trim_start": 48.0, "trim_end": 78.0, "speed": 0.9, "bg_img": "bg_07.jpg", # Abstract Sci-Fi
        "font": "Impact", "orbit_time": 12.0, "style": "karaoke", "transform": "uppercase"
    }
]

os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def wait_for_api():
    print("Checking if API is running...")
    for _ in range(10):
        try:
            requests.get(f"{API_URL}/api/health", timeout=2)
            print("API is up!")
            return True
        except:
            time.sleep(2)
    print("API is not running. Please start the backend server.")
    return False

def pick_premium_color(bg_filename):
    bg_image_path = os.path.join(BG_DIR, bg_filename)
    if not os.path.exists(bg_image_path):
        return "#FFFFFF"
    try:
        # Extract 3 dominant colors from darkest to brightest
        palette = extract_palette(bg_image_path, count=3)
        brightest_hex = palette[-1]
        
        # Parse hex to RGB (0-1)
        h = brightest_hex.lstrip('#')
        r, g, b = tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4))
        
        # Convert RGB to HSL
        hue, light, sat = colorsys.rgb_to_hls(r, g, b)
        
        # Lock lightness to 0.85 for bright pastel, maintain hue and boost saturation
        light = 0.85
        sat = max(sat, 0.5)
        
        # Convert HSL back to RGB
        r_new, g_new, b_new = colorsys.hls_to_rgb(hue, light, sat)
        color_hex = "#{:02x}{:02x}{:02x}".format(int(r_new*255), int(g_new*255), int(b_new*255))
        return color_hex
    except Exception as e:
        print(f"  [Color Picker] Failed: {e}")
        return "#FFFFFF"

def get_lyrics(artist, title, url):
    print(f"  Fetching lyrics for {artist} - {title}...")
    if url in CACHE and "lyrics" in CACHE[url]:
        print("  [Cached] Lyrics loaded from cache.")
        return CACHE[url]["lyrics"]
        
    clean_artist = artist.lower().strip()
    
    # Strategy 1: Search using Full Artist + Title Query
    try:
        res = requests.get(f"{API_URL}/api/search-lyrics", params={"q": f"{title} {artist}"}, timeout=10)
        data = res.json()
        if data.get("status") == "success" and data.get("results"):
            for result in data["results"]:
                track_artist = result.get("artistName", "").lower().strip()
                # Strict check to make sure the artist name matches
                if result.get("syncedLyrics") and (clean_artist in track_artist or track_artist in clean_artist):
                    lyrics = result["syncedLyrics"]
                    if url not in CACHE: CACHE[url] = {}
                    CACHE[url]["lyrics"] = lyrics
                    save_cache()
                    return lyrics
    except Exception as e:
        print(f"  Failed in Strategy 1 search: {e}")
        
    # Strategy 2: Fallback to searching Title only and filtering by Artist
    print(f"  [Fallback] Lyrics search by title only for {title}...")
    try:
        res = requests.get(f"{API_URL}/api/search-lyrics", params={"q": title}, timeout=10)
        data = res.json()
        if data.get("status") == "success" and data.get("results"):
            for result in data["results"]:
                track_artist = result.get("artistName", "").lower().strip()
                if result.get("syncedLyrics") and (clean_artist in track_artist or track_artist in clean_artist):
                    lyrics = result["syncedLyrics"]
                    if url not in CACHE: CACHE[url] = {}
                    CACHE[url]["lyrics"] = lyrics
                    save_cache()
                    return lyrics
    except Exception as e:
        print(f"  Failed in Strategy 2 fallback search: {e}")
        
    return "[00:00.00] ♪\n[00:05.00] ♪"

def download_audio(song, index):
    print(f"\n--- [Phase 1] Downloading Audio {index}/20: {song['title']} ---")
    
    url = song["url"]
    if url in CACHE and "audio_path" in CACHE[url]:
        cached_path = CACHE[url]["audio_path"]
        if os.path.exists(cached_path):
            print(f"  [Cached] Audio already downloaded at {cached_path}")
            return cached_path
            
    res = requests.post(f"{API_URL}/api/fetch-audio", data={"url": url})
    if res.status_code != 200 or res.json().get("status") != "success":
        print("  Download failed:", res.text)
        return None
    
    audio_path = res.json()["metadata"]["filepath"]
    print(f"  Audio downloaded to {audio_path}")
    
    if url not in CACHE: CACHE[url] = {}
    CACHE[url]["audio_path"] = audio_path
    save_cache()
    
    return audio_path

def process_song(song, audio_path, index):
    print(f"\n--- [Phase 2] Processing Song {index}/20: {song['title']} ---")
    
    # 1. Get Lyrics
    lyrics = get_lyrics(song["artist"], song["title"], song["url"])
    
    # 2. Extract Mathematical color matching
    font_color = pick_premium_color(song["bg_img"])
    print(f"  [Color Picker] Generated premium matching color: {font_color}")
    
    job_id = uuid.uuid4().hex[:8]
    
    # Select specific background
    bg_image_path = os.path.join(BG_DIR, song["bg_img"])
    if not os.path.exists(bg_image_path):
        dummy_img_path = "/tmp/dummy_bg.jpg"
        if not os.path.exists(dummy_img_path):
            img = Image.new('RGB', (1080, 1920), color='black')
            img.save(dummy_img_path, format='JPEG')
        bg_image_path = dummy_img_path
        
    with open(bg_image_path, 'rb') as f:
        files = {'image': ('bg.jpg', f, 'image/jpeg')}
        
        data = {
            "job_id": job_id,
            "audio_path": audio_path,
            "raw_lrc": lyrics,
            "engine": "ffmpeg",
            "aspect_ratio": "9:16",
            "canvas_mode": False,
            "trim_start": song["trim_start"],
            "trim_end": song["trim_end"], 
            "speed": song["speed"],
            "enable_8d": True,             # ENABLING 8D Audio
            "orbit_time": song["orbit_time"], # Dynamic orbit sweep times
            "orbit_ducking": 4.5,          # Simulates depth when travelling behind head
            "orbit_widening": 0.18,        # Widens stereo image
            "reverb_room_size": song.get("reverb", 0.8),
            "reverb_mix": 25,
            "bass_boost_db": 3.0,
            "treble_boost_db": 1.0,
            "vintage_warmth": 0.4,
            "bg_mode": "image",
            "bg_blur": 15,                 # Cinematic blur
            "bg_dim": 0.5,                 # Vignette ready darkness
            "ken_burns": True,             # Slow smooth zoom motion
            "grain": 12.0,                 # Retro film grain texture
            "vignette_strength": 0.8,      # Dark radial vignette focus
            "lyric_preset": "line-pop",
            "lyric_style": song["style"],
            "font_family": song["font"],
            "font_color": font_color,      # Dynamically calculated color
            "font_size": 75,
            "pos_x": 50,
            "pos_y": 50,
            "text_transform": song["transform"],
            "stroke_width": 2,
            "stroke_color": "#000000",
            "shadow_offset": 4,
            "show_intro": True,
            "song_title": song["title"],
            "lyric_offset": 0.5,
            "render_quality": "High",
            "file_name": f"Short_{job_id}_{song['title'].replace(' ', '_')}"
        }
        
        print(f"  Submitting render job (Trim: {song['trim_start']}s, Font: {song['font']}, 8D Orbit: {song['orbit_time']}s)...")
        res = requests.post(f"{API_URL}/api/render", data=data, files=files)
        
    if res.status_code == 200:
        result = res.json()
        if result.get("status") == "success":
            video_url = result.get("video_url")
            if video_url:
                parts = video_url.strip("/").split("/")
                if len(parts) >= 4:
                    local_video_path = os.path.join("backend", "temp", "jobs", parts[2], parts[3])
                    if os.path.exists(local_video_path):
                        dest = os.path.join(DOWNLOAD_DIR, parts[3])
                        shutil.copy2(local_video_path, dest)
                        print(f"  Successfully rendered and copied to: {dest}")
                        return True
                    else:
                        print(f"  Rendered but could not find local file at {local_video_path}")
                        return False
    
    print("  Render failed:", res.text)
    return False

def main():
    if not wait_for_api():
        return
        
    print("\n==========================================")
    print("   PHASE 1: DOWNLOADING ALL AUDIO")
    print("==========================================")
    
    # Download all audio first
    for i, song in enumerate(SONGS[:5], 1):
        path = download_audio(song, i)
        song["local_audio_path"] = path  # Save the path into the dictionary
        
    print("\n==========================================")
    print("   PHASE 2: RENDERING VIDEOS")
    print("==========================================")
    
    success_count = 0
    for i, song in enumerate(SONGS[:5], 1):
        # Skip if audio failed to download
        if not song.get("local_audio_path"):
            print(f"\n--- Skipping {song['title']} (Audio download failed previously) ---")
            continue
            
        if process_song(song, song["local_audio_path"], i):
            success_count += 1
            
    print(f"\n--- Batch Job Complete! ---")
    print(f"Successfully processed {success_count}/{len(SONGS[:5])} songs.")
    print(f"Check {DOWNLOAD_DIR} for the videos.")

if __name__ == "__main__":
    main()
