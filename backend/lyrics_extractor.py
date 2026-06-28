import requests
import json
import os
import re

def parse_lrc(lrc_text: str):
    """
    Parses LRC text into a list of dictionaries with timestamp and text.
    [01:23.45] Lyric line here -> {"time": 83.45, "text": "Lyric line here"}
    """
    lines = lrc_text.strip().split('\n')
    parsed = []
    
    # Regex to match [mm:ss.xx]
    pattern = re.compile(r'\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)')
    
    for line in lines:
        match = pattern.match(line)
        if match:
            mins = int(match.group(1))
            secs = int(match.group(2))
            millis = int(match.group(3))
            if len(match.group(3)) == 2:
                millis *= 10
                
            time_seconds = mins * 60 + secs + (millis / 1000.0)
            text = match.group(4).strip()
            if text:
                parsed.append({"time": time_seconds, "text": text})
                
    return parsed

def extract_lyrics(title: str, artist: str):
    """
    Queries lrclib.net for synced lyrics and returns them in our JSON format.
    Returns an empty list if none are found.
    """
    print(f"Fetching lyrics for {title} by {artist} from lrclib.net...")
    
    query = f"{title} {artist}".strip()
    try:
        response = requests.get("https://lrclib.net/api/search", params={"q": query}, timeout=10)
        response.raise_for_status()
        results = response.json()
        
        if not results:
            print("No lyrics found on lrclib.net.")
            return None, []
            
        # Find the first result that has synced lyrics
        for track in results:
            if track.get("syncedLyrics"):
                print(f"Found synced lyrics for: {track.get('trackName')} by {track.get('artistName')}")
                raw_lrc = track["syncedLyrics"]
                return raw_lrc, parse_lrc(raw_lrc)
                
        print("Found tracks, but none had time-synced lyrics.")
        return None, []
    except Exception as e:
        print(f"Failed to fetch lyrics: {e}")
        return None, []
