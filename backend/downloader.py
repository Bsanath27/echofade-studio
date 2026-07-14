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
        'no_warnings': True,
        'source_address': '0.0.0.0',              # Force IPv4 to bypass IPv6 DNS resolving bottlenecks
        'youtube_include_dash_manifest': False,   # Speed up extraction by ignoring DASH manifests
        'youtube_include_hls_manifest': False,    # Speed up extraction by ignoring HLS manifests
        'check_formats': 'cached',                # Avoid slow verification of individual format streams
        'noplaylist': True,                       # Prevent downloading full playlist if URL is in a list
        'concurrent_fragments': 4,                # Download chunks concurrently for maximum speed
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

def download_media(url: str, format_type: str = "mp4", output_dir: str = "temp", start_time: float = 0.0, end_time: float = 0.0) -> Optional[Dict]:
    """
    Downloads media from a URL in the specified format (mp4, mp3, wav), with optional time range trimming.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    ydl_opts = {
        'outtmpl': f'{output_dir}/%(title)s.%(ext)s',
        'quiet': True,
        'no_warnings': True,
        'source_address': '0.0.0.0',              # Force IPv4
        'youtube_include_dash_manifest': False,
        'youtube_include_hls_manifest': False,
        'check_formats': 'cached',
        'noplaylist': True,
        'concurrent_fragments': 4,
    }

    if end_time > start_time:
        ydl_opts['download_ranges'] = yt_dlp.utils.download_range_func(None, [(start_time, end_time)])
        ydl_opts['force_keyframes_at_cuts'] = True
    
    if format_type in ["mp3", "wav"]:
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': format_type,
            'preferredquality': '192',
        }]
    else:
        ydl_opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
        ydl_opts['merge_output_format'] = 'mp4'

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'unknown_title')
            original_filepath = ydl.prepare_filename(info)
            
            if format_type in ["mp3", "wav"]:
                filepath = os.path.splitext(original_filepath)[0] + f".{format_type}"
            else:
                filepath = os.path.splitext(original_filepath)[0] + ".mp4"
                
            return {
                "title": title,
                "filepath": filepath,
                "thumbnail": info.get('thumbnail')
            }
    except Exception as e:
        print(f"Error downloading media: {e}")
        return None

def extract_media_info(url: str) -> Optional[Dict]:
    try:
        with yt_dlp.YoutubeDL({
            'quiet': True,
            'no_warnings': True,
            'source_address': '0.0.0.0',              # Force IPv4
            'youtube_include_dash_manifest': False,
            'youtube_include_hls_manifest': False,
            'check_formats': 'cached',
            'noplaylist': True,
        }) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                "title": info.get('title', 'Unknown'),
                "thumbnail": info.get('thumbnail'),
                "duration": info.get('duration', 0),
                "uploader": info.get('uploader', 'Unknown')
            }
    except Exception as e:
        print(f"Error fetching info: {e}")
        return None
