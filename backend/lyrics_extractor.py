import requests
import json
import os
import re

def parse_lrc(lrc_text: str):
    """
    Parses LRC text into a list of dictionaries with timestamp, text, and optional words.
    Supports standard LRC: [01:23.45] Lyric line here
    And Enhanced LRC (ELRC): [01:23.45] <01:23.45>Lyric <01:24.10>line <01:24.50>here
    """
    if not lrc_text:
        return []

    lines = lrc_text.strip().split('\n')
    parsed = []
    
    # Regex to match [mm:ss.xx]
    line_pattern = re.compile(r'\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)')
    word_pattern = re.compile(r'\<(\d{2}):(\d{2})\.(\d{2,3})\>([^<]+)')
    
    for line in lines:
        match = line_pattern.match(line.strip())
        if match:
            mins = int(match.group(1))
            secs = int(match.group(2))
            millis = int(match.group(3))
            if len(match.group(3)) == 2:
                millis *= 10
                
            time_seconds = mins * 60 + secs + (millis / 1000.0)
            raw_content = match.group(4).strip()
            
            # Check for word-level timestamps <mm:ss.xx>
            word_matches = list(word_pattern.finditer(raw_content))
            words = []
            if word_matches:
                for idx, w_match in enumerate(word_matches):
                    w_mins = int(w_match.group(1))
                    w_secs = int(w_match.group(2))
                    w_millis = int(w_match.group(3))
                    if len(w_match.group(3)) == 2:
                        w_millis *= 10
                    w_start = w_mins * 60 + w_secs + (w_millis / 1000.0)
                    
                    w_text = w_match.group(4)
                    
                    # Estimate end time based on next word's start time, or +0.5s if last
                    if idx < len(word_matches) - 1:
                        nxt_mins = int(word_matches[idx+1].group(1))
                        nxt_secs = int(word_matches[idx+1].group(2))
                        nxt_millis = int(word_matches[idx+1].group(3))
                        if len(word_matches[idx+1].group(3)) == 2:
                            nxt_millis *= 10
                        w_end = nxt_mins * 60 + nxt_secs + (nxt_millis / 1000.0)
                    else:
                        w_end = w_start + 0.5
                        
                    words.append({
                        "word": w_text.strip(),
                        "start": round(w_start, 3),
                        "end": round(w_end, 3)
                    })
                
                # Remove timestamp tags for clean display text
                clean_text = word_pattern.sub(r'\4', raw_content)
                clean_text = re.sub(r'\s+', ' ', clean_text).strip()
            else:
                clean_text = raw_content
                
            if clean_text:
                item = {"time": time_seconds, "text": clean_text}
                if words:
                    item["words"] = words
                parsed.append(item)
                
    return parsed

def generate_estimated_words(text: str, start_time: float, end_time: float):
    """
    Generates word-level timestamps proportionally based on character lengths
    when explicit word-level timestamps are missing.
    """
    words_list = text.split()
    if not words_list:
        return []
        
    duration = max(0.1, end_time - start_time)
    total_chars = sum(len(w) for w in words_list)
    
    words = []
    curr_start = start_time
    for w in words_list:
        w_dur = duration * (len(w) / total_chars)
        w_end = curr_start + w_dur
        words.append({
            "word": w,
            "start": round(curr_start, 3),
            "end": round(w_end, 3)
        })
        curr_start = w_end
        
    return words

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
            
        # Find the first result that has synced lyrics and matches the artist
        clean_artist = artist.lower().strip()
        for track in results:
            track_artist = track.get("artistName", "").lower().strip()
            if track.get("syncedLyrics") and (clean_artist in track_artist or track_artist in clean_artist):
                print(f"Found synced lyrics for: {track.get('trackName')} by {track.get('artistName')}")
                raw_lrc = track["syncedLyrics"]
                return raw_lrc, parse_lrc(raw_lrc)
                
        print("Found tracks, but none had matching time-synced lyrics.")
        return None, []
    except Exception as e:
        print(f"Failed to fetch lyrics: {e}")
        return None, []

