import sys
import os
import tempfile

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from lyrics_extractor import parse_lrc, generate_estimated_words
from ffmpeg_engine import generate_ass_subtitles

def test_parse_lrc_standard():
    standard_lrc = "[00:04.12] Hello world again\n[00:08.50] Second lyric line"
    parsed = parse_lrc(standard_lrc)
    assert len(parsed) == 2
    assert parsed[0]["time"] == 4.12
    assert parsed[0]["text"] == "Hello world again"
    assert "words" not in parsed[0]
    print("✓ test_parse_lrc_standard passed!")

def test_parse_lrc_elrc():
    elrc = "[00:04.12] <00:04.12>Hello <00:04.60>world <00:05.10>again\n[00:08.50] <00:08.50>Second <00:09.00>line"
    parsed = parse_lrc(elrc)
    assert len(parsed) == 2
    assert parsed[0]["time"] == 4.12
    assert parsed[0]["text"] == "Hello world again"
    assert "words" in parsed[0]
    words = parsed[0]["words"]
    assert len(words) == 3
    assert words[0]["word"] == "Hello"
    assert words[0]["start"] == 4.12
    assert words[0]["end"] == 4.60
    assert words[1]["word"] == "world"
    assert words[1]["start"] == 4.60
    assert words[1]["end"] == 5.10
    print("✓ test_parse_lrc_elrc passed!")

def test_generate_estimated_words():
    text = "Hello world"
    words = generate_estimated_words(text, start_time=10.0, end_time=14.0)
    assert len(words) == 2
    assert words[0]["word"] == "Hello"
    assert words[0]["start"] == 10.0
    assert words[1]["word"] == "world"
    assert words[1]["end"] == 14.0
    print("✓ test_generate_estimated_words passed!")

def test_ass_karaoke_generation():
    lyrics_data = [
        {
            "time": 2.0,
            "text": "KARAOKE NIGHT",
            "words": [
                {"word": "KARAOKE", "start": 2.0, "end": 3.0},
                {"word": "NIGHT", "start": 3.0, "end": 4.0}
            ]
        }
    ]
    
    with tempfile.TemporaryDirectory() as tmp_dir:
        ass_path = os.path.join(tmp_dir, "test_sub.ass")
        generate_ass_subtitles(
            lyrics_data=lyrics_data,
            ass_path=ass_path,
            font_family="Arial",
            font_size=60,
            font_color="#ffffff",
            pos_x=50,
            pos_y=50,
            text_transform="uppercase",
            stroke_width=2,
            stroke_color="#000000",
            shadow_offset=4,
            speed=1.0,
            duration=5.0,
            bg_width=1920,
            bg_height=1080,
            lyric_style="single"
        )
        
        with open(ass_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        assert "Style: Default" in content
        assert r"{\kf100}KARAOKE {\kf100}NIGHT" in content
        print("✓ test_ass_karaoke_generation passed!")

if __name__ == "__main__":
    test_parse_lrc_standard()
    test_parse_lrc_elrc()
    test_generate_estimated_words()
    test_ass_karaoke_generation()
    print("ALL KARAOKE & KINETIC SYNC TESTS PASSED!")
