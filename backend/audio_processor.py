import os
import json
import shutil
from pedalboard import Pedalboard, Reverb, HighShelfFilter, LowShelfFilter, HighpassFilter, LowpassFilter, Distortion, Limiter, Gain
from pedalboard.io import AudioFile
from pydub import AudioSegment
import numpy as np

def apply_audio_effects(
    input_path: str,
    output_path: str,
    speed: float = 1.0,
    reverb_room_size: float = 0.5,
    reverb_mix: float = 0.2,
    bass_boost_db: float = 0.0,
    treble_boost_db: float = 0.0,
    vintage_warmth: float = 0.0,
    enable_8d: bool = False,
    orbit_time: float = 20.0,
    orbit_ducking: float = 4.0,
    orbit_widening: float = 0.15,
    preview: bool = False,
    progress_file: str = None,
    progress_start: int = 0,
    progress_end: int = 100
) -> str:
    """
    Applies pure vinyl slowdown, true 360-degree 8D spatial panning, Abbey Road EQ'd reverb, saturation, EQ, and limiter.
    """
    stages = ["slowdown"] + (["8d"] if enable_8d else []) + ["eq_reverb", "mastering"]
    total_stages = len(stages)

    def report_stage(stage_name):
        if not progress_file:
            return
        idx = stages.index(stage_name) + 1
        pct = progress_start + int((idx / total_stages) * (progress_end - progress_start))
        try:
            with open(progress_file, 'w') as f:
                json.dump({"progress": pct, "stage": stage_name}, f)
        except:
            pass

    temp_path = input_path.replace(".wav", "_temp_pydub.wav")
    
    # 1. PyDub: Preview slice & Pure Vinyl Slowdown
    audio_segment = AudioSegment.from_wav(input_path)
    
    if preview:
        audio_segment = audio_segment[:30000] # First 30s
        
    if speed != 1.0:
        new_sample_rate = int(audio_segment.frame_rate * float(speed))
        audio_segment = audio_segment._spawn(audio_segment.raw_data, overrides={
            "frame_rate": new_sample_rate
        }).set_frame_rate(audio_segment.frame_rate)
        
    audio_segment.export(temp_path, format="wav")
    report_stage("slowdown")

    # 2. Pedalboard: Parallel Processing Chain (Reverb & Mastering)
    with AudioFile(temp_path) as f:
        audio = f.read(f.frames)
        samplerate = f.samplerate
        
    # Ensure audio is stereo for 8D and reverb processing
    if audio.shape[0] == 1:
        audio = np.vstack((audio, audio))
        
        # 3. NumPy: True 360° 8D Audio (Per-sample resolution, zero zipper noise)
    if enable_8d:
        num_samples = audio.shape[1]
        t = np.arange(num_samples) / samplerate
        
        # X-Axis (Left to Right)
        pan_val = np.sin(2 * np.pi * t / orbit_time)
        # Y-Axis (Strictly Back Semi-circle)
        # Forces the audio to only travel Left -> Back -> Right -> Back
        depth_val = -np.sqrt(1.0 - pan_val**2)
        
        # 1. Subtle Distance (Uniform Volume)
        # Duck by up to orbit_ducking dB when directly behind the head
        gain_db = depth_val * orbit_ducking
        vol_multiplier = 10 ** (gain_db / 20.0)
        
        # 2. Equal power panning
        angle = (pan_val + 1) * (np.pi / 4)
        left_pan = np.cos(angle)
        right_pan = np.sin(angle)
        
        # Apply standard panning and subtle distance volume. 
        left_ch = audio[0, :] * left_pan * vol_multiplier
        right_ch = audio[1, :] * right_pan * vol_multiplier
        
        # 3. Subtle Stereo Widening
        # Dynamic phase widening to push sound outside headphones.
        widening_amount = orbit_widening * np.abs(pan_val)
        audio[0, :] = left_ch - (right_ch * widening_amount)
        audio[1, :] = right_ch - (left_ch * widening_amount)
        report_stage("8d")

    # Dry Chain: Basic EQ and Saturation
    dry_board = Pedalboard([
        LowShelfFilter(cutoff_frequency_hz=150, gain_db=bass_boost_db),
        HighShelfFilter(cutoff_frequency_hz=8000, gain_db=treble_boost_db),
    ])
    if vintage_warmth > 0:
        dry_board.append(Distortion(drive_db=vintage_warmth * 5)) # Safe drive scaling
        
    # Wet Chain (Reverb): Abbey Road EQ (HPF 600Hz, LPF 10kHz) -> Reverb
    wet_board = Pedalboard([
        HighpassFilter(cutoff_frequency_hz=600),
        LowpassFilter(cutoff_frequency_hz=10000),
        Reverb(room_size=reverb_room_size, wet_level=reverb_mix, dry_level=0.0)
    ])
    
    # Process chains in parallel
    processed_dry = dry_board(audio, samplerate)
    processed_wet = wet_board(audio, samplerate)
    
    # Mix signals together
    mixed_audio = processed_dry + processed_wet
    report_stage("eq_reverb")

    # Mastering Chain
    master_board = Pedalboard([
        Gain(gain_db=-3.0), # Prevent clipping from heavy bass boosts
        Limiter(threshold_db=-1.0)
    ])

    final_effected = master_board(mixed_audio, samplerate)

    with AudioFile(output_path, 'w', samplerate, final_effected.shape[0]) as f:
        f.write(final_effected)
    report_stage("mastering")

    # Cleanup temp
    if os.path.exists(temp_path): os.remove(temp_path)

    return output_path
