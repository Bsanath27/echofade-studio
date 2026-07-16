import os
from papersky_composer import compose_papersky_intro

intro_src = os.path.abspath(os.path.join(
    os.path.dirname(__file__), "..", "assets", "backgrounds", "intro reel",
    "Motion_graphic_overlay_transpare…_202607151914.mp4"
))
image_path = "/Users/sanathbs/03_Dev_Lab/projects/Personal/youtube videos/lyric-video-generator-v2/assets/backgrounds/bg_19.jpg"
output_path = "/Users/sanathbs/03_Dev_Lab/projects/Personal/youtube videos/lyric-video-generator-v2/demo_intro.mp4"
font_path = os.path.join(os.path.dirname(__file__), 'Montserrat-Bold.ttf')

print(f"Using intro video: {intro_src}")
print(f"Using image: {image_path}")

compose_papersky_intro(
    intro_video_path=intro_src,
    bg_image_path=image_path,
    text="Demo Intro",
    output_path=output_path,
    font_path=font_path,
    font_size=34,
    font_color="#262626",
    quality="ultrafast"
)
print("Demo generated at", output_path)
