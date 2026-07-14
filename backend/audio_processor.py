import os
import json
import shutil
import subprocess
from pedalboard import Pedalboard, Reverb, HighShelfFilter, LowShelfFilter, HighpassFilter, LowpassFilter, Distortion, Limiter, Gain
from pedalboard.io import AudioFile
from pydub import AudioSegment
import numpy as np

def measure_lufs(audio_data: np.ndarray, samplerate: int) -> float:
    """
    Measures integrated loudness (LUFS) using BS.1770 K-weighting approximation.
    audio_data shape: (channels, num_samples)
    """
    if audio_data.ndim == 1:
        audio_data = np.vstack((audio_data, audio_data))
    elif audio_data.shape[0] == 1:
        audio_data = np.vstack((audio_data, audio_data))
        
    # K-weighting filter stage 1 & 2 using Pedalboard
    k_weight_board = Pedalboard([
        HighpassFilter(cutoff_frequency_hz=38.0),
        HighShelfFilter(cutoff_frequency_hz=1500.0, gain_db=4.0)
    ])
    try:
        k_weighted = k_weight_board(audio_data, samplerate)
    except Exception:
        k_weighted = audio_data

    # Mean square power per channel
    mean_sq = np.mean(k_weighted ** 2, axis=1)
    total_power = np.sum(mean_sq)
    if total_power <= 1e-12:
        return -70.0
    lufs = -0.691 + 10.0 * np.log10(total_power)
    return float(lufs)


def apply_loudness_normalization(
    input_wav_path: str,
    output_wav_path: str,
    target_lufs: float = -14.0,
    target_tp: float = -1.5,
    target_lra: float = 11.0
) -> bool:
    """
    Applies -14 LUFS loudness normalization (YouTube Shorts / Reels standard) using ffmpeg loudnorm
    if available, falling back to Pedalboard + BS.1770 K-weighted LUFS gain scaling.
    """
    # Attempt FFmpeg loudnorm filter
    ffmpeg_cmd = [
        "ffmpeg", "-y", "-i", input_wav_path,
        "-af", f"loudnorm=I={target_lufs}:LRA={target_lra}:TP={target_tp}",
        output_wav_path
    ]
    try:
        res = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        if res.returncode == 0 and os.path.exists(output_wav_path) and os.path.getsize(output_wav_path) > 0:
            return True
    except Exception:
        pass

    # Fallback: Pedalboard / NumPy BS.1770 loudness normalization
    try:
        with AudioFile(input_wav_path) as f:
            audio = f.read(f.frames)
            sr = f.samplerate

        current_lufs = measure_lufs(audio, sr)
        gain_needed_db = target_lufs - current_lufs

        # Apply gain adjustment + limiter for True Peak control
        norm_board = Pedalboard([
            Gain(gain_db=gain_needed_db),
            Limiter(threshold_db=target_tp)
        ])
        norm_audio = norm_board(audio, sr)

        with AudioFile(output_wav_path, 'w', sr, norm_audio.shape[0]) as f:
            f.write(norm_audio)
        return True
    except Exception as e:
        if input_wav_path != output_wav_path:
            shutil.copy(input_wav_path, output_wav_path)
        return False


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
    target_lufs: float = -14.0,
    enable_normalization: bool = True,
    preview: bool = False,
    progress_file: str = None,
    progress_start: int = 0,
    progress_end: int = 100,
    trim_start: float = 0.0,
    trim_end: float = 0.0
) -> str:
    """
    Applies pure vinyl slowdown, true 360-degree 8D spatial panning, Abbey Road EQ'd reverb,
    saturation, EQ, mastering limiter, and -14 LUFS loudness normalization.
    """
    stages = ["slowdown"] + (["8d"] if enable_8d else []) + ["eq_reverb", "mastering"]
    if enable_normalization:
        stages.append("normalization")
    total_stages = len(stages)

    def report_stage(stage_name):
        if not progress_file:
            return
        idx = stages.index(stage_name) + 1
        pct = progress_start + int((idx / total_stages) * (progress_end - progress_start))
        try:
            with open(progress_file, 'w') as f:
                json.dump({"progress": pct, "stage": stage_name}, f)
        except Exception:
            pass

    temp_path = input_path.replace(".wav", "_temp_pydub.wav")
    if temp_path == input_path:
        temp_path = input_path + "_temp_pydub.wav"
    
    temp_master_path = output_path.replace(".wav", "_temp_master.wav")
    if temp_master_path == output_path:
        temp_master_path = output_path + "_temp_master.wav"

    try:
        # 1. PyDub: Trim & Pure Vinyl Slowdown
        audio_segment = AudioSegment.from_file(input_path)
            
        if trim_end > trim_start:
            audio_segment = audio_segment[int(trim_start * 1000):int(trim_end * 1000)]
            

        if speed != 1.0:
            new_sample_rate = int(audio_segment.frame_rate * float(speed))
            audio_segment = audio_segment._spawn(audio_segment.raw_data, overrides={
                "frame_rate": new_sample_rate
            }).set_frame_rate(audio_segment.frame_rate)
            
        audio_segment.export(temp_path, format="wav")
        report_stage("slowdown")

        # 2. Pedalboard: Load Audio
        with AudioFile(temp_path) as f:
            audio = f.read(f.frames)
            samplerate = f.samplerate
            
        # Ensure audio is stereo for 8D and reverb processing
        if audio.shape[0] == 1:
            audio = np.vstack((audio, audio))
            
        # 3. NumPy: True 360° 8D Audio (Per-sample resolution, smooth LFO curves)
        if enable_8d:
            num_samples = audio.shape[1]
            t = np.arange(num_samples) / samplerate
            
            orbit_time_clean = max(float(orbit_time), 0.1) # Prevent ZeroDivisionError
            
            # 360-degree Continuous Orbit LFO Angle
            theta = 2.0 * np.pi * t / orbit_time_clean
            
            # X-Axis Panning (Smooth Sinusoidal Left-to-Right LFO)
            pan_val = np.sin(theta)
            
            # Y-Axis Distance / Front-Back Orbit Depth (Smooth Cosine Curve: 0=Front, 1=Back)
            depth_val = 0.5 * (1.0 - np.cos(theta))
            
            # 1. Distance Ducking (dB volume reduction when sound moves behind listener)
            gain_db = -depth_val * float(orbit_ducking)
            vol_multiplier = 10.0 ** (gain_db / 20.0)
            
            # 2. Equal Power Panning
            angle = (pan_val + 1.0) * (np.pi / 4.0)
            left_pan = np.cos(angle)
            right_pan = np.sin(angle)
            
            # Apply standard panning and distance volume
            left_ch = audio[0, :] * left_pan * vol_multiplier
            right_ch = audio[1, :] * right_pan * vol_multiplier
            
            # 3. Binaural Mid/Side Spatial Widening
            widening_val = float(orbit_widening)
            if widening_val > 0:
                mid = (left_ch + right_ch) * 0.5
                side = (left_ch - right_ch) * 0.5
                side_wide = side * (1.0 + widening_val * np.abs(pan_val))
                audio[0, :] = mid + side_wide
                audio[1, :] = mid - side_wide
            else:
                audio[0, :] = left_ch
                audio[1, :] = right_ch

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

        target_write_path = temp_master_path if enable_normalization else output_path
        with AudioFile(target_write_path, 'w', samplerate, final_effected.shape[0]) as f:
            f.write(final_effected)
        report_stage("mastering")

        # 4. -14 LUFS Loudness Normalization Stage
        if enable_normalization:
            apply_loudness_normalization(
                input_wav_path=temp_master_path,
                output_wav_path=output_path,
                target_lufs=target_lufs,
                target_tp=-1.5
            )
            report_stage("normalization")

    finally:
        # Cleanup temp files
        if os.path.exists(temp_path):
            try: os.remove(temp_path)
            except Exception: pass
        if os.path.exists(temp_master_path):
            try: os.remove(temp_master_path)
            except Exception: pass

    return output_path
