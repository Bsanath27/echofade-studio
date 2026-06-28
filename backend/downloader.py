import os
import yt_dlp
from typing import Optional, Dict

def download_audio(url: str, output_dir: str = "temp") -> Optional[Dict]:
    """
    Downloads the highest quality audio from a YouTube URL.
    Returns metadata including the path to the downloaded file.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'{output_dir}/%(title)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'unknown_title')
            # yt-dlp sanitizes filenames (e.g. replacing '|' with '_'). 
            # We must use prepare_filename to get the actual path it wrote to.
            original_filepath = ydl.prepare_filename(info)
            # The postprocessor changes the extension to .wav
            filepath = os.path.splitext(original_filepath)[0] + ".wav"
            
            return {
                "title": title,
                "artist": info.get('uploader', 'unknown_artist'),
                "filepath": filepath
            }
    except Exception as e:
        print(f"Error downloading audio: {e}")
        return None
