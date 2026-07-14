import os
import requests

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../assets/backgrounds"))

# Curated Dataset: Trap Nation / 7cloud Aesthetic (Cinematic, Moody, Neon, Silhouette)
IMAGE_URLS = [
    # Original 10
    "https://images.unsplash.com/photo-1554217259-338b556b63f8?w=1080&h=1920&fit=crop",  # The Neon City
    "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1080&h=1920&fit=crop",  # The Silhouette (Starry Galaxy)
    "https://images.unsplash.com/photo-1517524285303-d6fc683dddf8?w=1080&h=1920&fit=crop",  # The Night Drive (Dark Car)
    "https://images.unsplash.com/photo-1444927714506-8492d94b4e3d?w=1080&h=1920&fit=crop",  # The Foggy Forest
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1080&h=1920&fit=crop",  # The Synthwave Glow
    "https://images.unsplash.com/photo-1495344517868-8ebaf0a2044e?w=1080&h=1920&fit=crop",  # The Sunset Cloud (Anime sky)
    "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1080&h=1920&fit=crop",  # The Sci-Fi Cosmos
    "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1080&h=1920&fit=crop",  # The Urban Cinematic Street
    "https://images.unsplash.com/photo-1518241353312-54f0ce0eb1ea?w=1080&h=1920&fit=crop",  # The Dark Mountain Peak
    "https://images.unsplash.com/photo-1494548162494-384bba4ab999?w=1080&h=1920&fit=crop",  # The Lone Silhouette Sunset
    
    # Expanded Dataset (20 More)
    "https://images.unsplash.com/photo-1555861496-0666c8981751?w=1080&h=1920&fit=crop",  # Cyberpunk Street
    "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=1080&h=1920&fit=crop",  # Sports Car At Night
    "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1080&h=1920&fit=crop",  # Dark Starry Space
    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1080&h=1920&fit=crop",  # Moody Dark Road
    "https://images.unsplash.com/photo-1505322022379-7c3353ee6291?w=1080&h=1920&fit=crop",  # Deep Purple Sunset
    "https://images.unsplash.com/photo-1563089145-599997674d42?w=1080&h=1920&fit=crop",  # Abstract Neon Lines
    "https://images.unsplash.com/photo-1614850715649-1d0106293bd1?w=1080&h=1920&fit=crop",  # Retrowave Abstract Grid
    "https://images.unsplash.com/photo-1483728642387-6c3abcd6c95e?w=1080&h=1920&fit=crop",  # Dark Snowy Mountain Peak
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1080&h=1920&fit=crop",  # Night City Skyline
    "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=1080&h=1920&fit=crop",  # Rainy Window Street Lights
    "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1080&h=1920&fit=crop",  # Lone Figure in Nature
    "https://images.unsplash.com/photo-1464802686167-b939a6910659?w=1080&h=1920&fit=crop",  # Nebula Cosmos
    "https://images.unsplash.com/photo-1551009175-15bdf9dcb580?w=1080&h=1920&fit=crop",  # Neon Sign in Dark
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&h=1920&fit=crop",  # Misty Dark Mountains
    "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1080&h=1920&fit=crop",  # Smooth Geometric Purple Gradient
    "https://images.unsplash.com/photo-1513653190199-880c102a0a38?w=1080&h=1920&fit=crop",  # Cyberpunk Rainy Alley
    "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1080&h=1920&fit=crop",  # Night Sky Over Ocean
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1080&h=1920&fit=crop",  # Dark Car Dashboard Cinematic
    "https://images.unsplash.com/photo-1485603700021-d007c0800b65?w=1080&h=1920&fit=crop",  # Lone Person Streetlights
    "https://images.unsplash.com/photo-1533134486753-c833f0edde8c?w=1080&h=1920&fit=crop"   # Glowing Neon Tunnel
]

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Downloading {len(IMAGE_URLS)} high-quality backgrounds to {OUTPUT_DIR}...")
    
    for i, url in enumerate(IMAGE_URLS, 1):
        filename = f"bg_{i:02d}.jpg"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        if os.path.exists(filepath):
            print(f"  Skipping {filename} - already exists.")
            continue
            
        print(f"  Downloading {filename}...")
        try:
            res = requests.get(url, stream=True)
            res.raise_for_status()
            with open(filepath, 'wb') as f:
                for chunk in res.iter_content(chunk_size=8192):
                    f.write(chunk)
        except Exception as e:
            print(f"  Failed to download {filename}: {e}")
            
    print("Background dataset downloaded successfully!")

if __name__ == "__main__":
    main()
