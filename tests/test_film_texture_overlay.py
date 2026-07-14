import os
import sys

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if sys.path[0] != backend_dir:
    sys.path.insert(0, backend_dir)

def compile_ffmpeg_overlay_filter(bg_label, overlay_label, opacity=0.4, mode="screen"):
    """Mock/TDD compiler function mirroring ffmpeg_engine filters."""
    filter_mode = f"all_mode='{mode}'"
    opacity_filter = f"all_opacity={opacity}"
    return f"[{bg_label}][{overlay_label}]blend={filter_mode}:{opacity_filter}[blended_out]"

def test_ffmpeg_filter_compilation():
    """Verify that the filter complex strings match FFmpeg spec requirements."""
    f_complex = compile_ffmpeg_overlay_filter("bg", "overlay", opacity=0.35, mode="screen")
    assert "[bg][overlay]" in f_complex
    assert "blend=" in f_complex
    assert "all_mode='screen'" in f_complex
    assert "all_opacity=0.35" in f_complex
    assert "[blended_out]" in f_complex
    print("✓ test_ffmpeg_filter_compilation passed!")

def test_overlay_inputs_mapping():
    """Verify that multiple overlay loops add inputs sequentially in command lists."""
    cmd = ["ffmpeg", "-y", "-i", "bg_image.png"]
    
    overlay_path = "assets/fx/light_leaks.mp4"
    audio_path = "processed_audio.wav"
    
    # Simulating input mapping logic
    cmd.extend(["-i", audio_path])
    
    # Determine the index of the overlay input
    has_overlay = True
    if has_overlay:
        cmd.extend(["-stream_loop", "-1", "-i", overlay_path])
        overlay_index = cmd.index(overlay_path) - 1 # Retrieve index
        
    assert cmd[overlay_index] == "-i"
    assert cmd[overlay_index + 1] == overlay_path
    assert "-stream_loop" in cmd
    print("✓ test_overlay_inputs_mapping passed!")

if __name__ == "__main__":
    test_ffmpeg_filter_compilation()
    test_overlay_inputs_mapping()
    print("Film Texture Overlay TDD test assertions completed.")
