import os
import sys
import numpy as np

# Add backend directory to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if sys.path[0] != backend_dir:
    sys.path.insert(0, backend_dir)

def calculate_shake_offset(amplitude, max_offset=20.0):
    """Mock/TDD function to verify shake offset math."""
    if amplitude <= 0.0:
        return 0.0, 0.0
    # Simulate random 2D displacement scaled by beat energy
    dx = np.sin(amplitude * 15.0) * max_offset * amplitude
    dy = np.cos(amplitude * 12.0) * max_offset * amplitude
    return float(dx), float(dy)

def calculate_chromatic_offset(amplitude, max_split=12):
    """Mock/TDD function to verify chromatic split pixel offsets."""
    if amplitude < 0.3: # Threshold gate
        return 0
    # Linearly scale offset above threshold
    return int((amplitude - 0.3) / 0.7 * max_split)

def test_shake_amplitude_mapping():
    """Verify that camera shake offsets scale correctly with beat amplitude."""
    # Zero amplitude = zero offset
    dx, dy = calculate_shake_offset(0.0)
    assert dx == 0.0 and dy == 0.0
    
    # Peak amplitude gives significant shake
    dx_peak, dy_peak = calculate_shake_offset(1.0, max_offset=30.0)
    assert abs(dx_peak) <= 30.0
    assert abs(dy_peak) <= 30.0
    
    # Assert deterministic scale
    dx_low, _ = calculate_shake_offset(0.1, max_offset=30.0)
    dx_high, _ = calculate_shake_offset(0.9, max_offset=30.0)
    # The low amp shake magnitude should be much smaller
    assert abs(dx_low) < abs(dx_high)
    print("✓ test_shake_amplitude_mapping passed!")

def test_chromatic_split_gate():
    """Verify that chromatic aberration thresholding works properly."""
    # Under threshold -> no split
    assert calculate_chromatic_offset(0.2) == 0
    # Exact threshold -> no split
    assert calculate_chromatic_offset(0.3) == 0
    # Above threshold -> returns split pixels
    assert calculate_chromatic_offset(0.8) > 0
    # Peak returns max bounds
    assert calculate_chromatic_offset(1.0, max_split=15) == 15
    print("✓ test_chromatic_split_gate passed!")

if __name__ == "__main__":
    test_shake_amplitude_mapping()
    test_chromatic_split_gate()
    print("Beat-Reactive FX TDD test assertions completed.")
