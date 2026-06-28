from moviepy import ColorClip
import sys

def test_videotoolbox():
    clip = ColorClip(size=(640, 360), color=(255, 0, 0), duration=2)
    try:
        clip.write_videofile("test.mp4", fps=24, codec="h264_videotoolbox", logger=None)
        print("VideoToolbox worked")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_videotoolbox()
