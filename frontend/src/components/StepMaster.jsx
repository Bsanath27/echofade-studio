import { useState } from 'react'

const PRESETS = [
  { 
    name: 'Classic Slowed+Reverb',
    desc: 'The YouTube standard — gentle slowdown, medium reverb, warm bass',
    values: { speed: 0.85, reverbRoom: 0.55, reverbMix: 28, bassBoost: 2.5, trebleBoost: -1, warmth: 0.25, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 15 }
  },
  { 
    name: 'Daycore',
    desc: 'Deep pitch drop, heavy reverb, subterranean bass — the moody aesthetic',
    values: { speed: 0.75, reverbRoom: 0.7, reverbMix: 40, bassBoost: 5, trebleBoost: -3, warmth: 0.5, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  { 
    name: 'Lo-Fi Bedroom',
    desc: 'Warm analog saturation, rolled-off highs, cozy late-night vibe',
    values: { speed: 0.9, reverbRoom: 0.45, reverbMix: 22, bassBoost: 3, trebleBoost: -4, warmth: 0.7, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  { 
    name: 'Ethereal 8D',
    desc: 'Slow orbit with spacious reverb — sounds like floating in a cathedral',
    values: { speed: 0.88, reverbRoom: 0.75, reverbMix: 35, bassBoost: 1, trebleBoost: 0, warmth: 0.2, enable8D: true, orbitTime: 24, orbitDucking: 4, orbitWidening: 20 }
  },
  { 
    name: 'Club 8D',
    desc: 'Tighter orbit, punchy bass, minimal reverb — 8D that hits hard',
    values: { speed: 0.95, reverbRoom: 0.3, reverbMix: 15, bassBoost: 4, trebleBoost: 1, warmth: 0.1, enable8D: true, orbitTime: 12, orbitDucking: 6, orbitWidening: 30 }
  },
  { 
    name: 'Nightcore',
    desc: 'Sped up, bright, and airy — anime edit energy',
    values: { speed: 1.25, reverbRoom: 0.25, reverbMix: 12, bassBoost: -1, trebleBoost: 3, warmth: 0, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  { 
    name: 'Vapor Wave',
    desc: 'Extreme slow, heavy saturation, drenched in reverb — A E S T H E T I C',
    values: { speed: 0.7, reverbRoom: 0.85, reverbMix: 50, bassBoost: 4, trebleBoost: -5, warmth: 0.8, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  { 
    name: 'Clean + Subtle',
    desc: 'Barely slowed, light reverb — just enough to make it feel dreamy',
    values: { speed: 0.93, reverbRoom: 0.35, reverbMix: 18, bassBoost: 1, trebleBoost: 0, warmth: 0.1, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  }
]

export default function StepMaster({
  audioPath,
  speed, setSpeed,
  reverbRoom, setReverbRoom,
  reverbMix, setReverbMix,
  bassBoost, setBassBoost,
  trebleBoost, setTrebleBoost,
  warmth, setWarmth,
  enable8D, setEnable8D,
  orbitTime, setOrbitTime,
  orbitDucking, setOrbitDucking,
  orbitWidening, setOrbitWidening,
  previewAudioUrl, setPreviewAudioUrl,
  setStatus
}) {
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [activePreset, setActivePreset] = useState(null)

  const applyPreset = (preset) => {
    const v = preset.values
    setSpeed(v.speed); setReverbRoom(v.reverbRoom); setReverbMix(v.reverbMix)
    setBassBoost(v.bassBoost); setTrebleBoost(v.trebleBoost); setWarmth(v.warmth)
    setEnable8D(v.enable8D); setOrbitTime(v.orbitTime); setOrbitDucking(v.orbitDucking); setOrbitWidening(v.orbitWidening)
    setActivePreset(preset.name)
  }

  const handlePreview = async () => {
    setIsPreviewing(true)
    setStatus('Rendering full audio preview...')
    const formData = new FormData()
    formData.append('audio_path', audioPath)
    formData.append('speed', speed)
    formData.append('reverb_room_size', reverbRoom)
    formData.append('reverb_mix', reverbMix)
    formData.append('bass_boost_db', bassBoost)
    formData.append('treble_boost_db', trebleBoost)
    formData.append('vintage_warmth', warmth)
    formData.append('enable_8d', enable8D)
    formData.append('orbit_time', orbitTime)
    formData.append('orbit_ducking', orbitDucking)
    formData.append('orbit_widening', orbitWidening / 100.0)
    try {
      const ts = Date.now()
      const res = await fetch('http://127.0.0.1:8000/api/preview-audio', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.status === 'success') {
        setPreviewAudioUrl(`http://127.0.0.1:8000${data.audio_url}?t=${ts}`)
        setStatus('')
      } else {
        setStatus('Preview failed.')
      }
    } catch {
      setStatus('Failed to connect to backend.')
    }
    setIsPreviewing(false)
  }

  return (
    <div>
      <div className="step-header">
        <h2>Master Audio</h2>
        <p>Shape the sound with effects, EQ, and spatial audio</p>
      </div>

      {/* Presets */}
      <div className="preset-bar">
        {PRESETS.map(p => (
          <button 
            key={p.name}
            className={`preset-pill ${activePreset === p.name ? 'active' : ''}`}
            onClick={() => applyPreset(p)}
            title={p.desc}
          >{p.name}</button>
        ))}
      </div>
      {activePreset && (
        <p style={{fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '20px', marginTop: '-16px', fontStyle: 'italic'}}>
          {PRESETS.find(p => p.name === activePreset)?.desc}
        </p>
      )}

      {/* Speed & Reverb */}
      <div className="panel">
        <div className="panel-title">Speed & Reverb</div>
        <div className="panel-grid">
          <div>
            <div className="control-group">
              <div className="control-label">
                <span>Speed (Pitch & Tempo)</span>
                <span className="control-value">{speed}x</span>
              </div>
              <input type="range" min="0.5" max="1.5" step="0.05"
                value={speed} onChange={(e) => { setSpeed(e.target.value); setActivePreset(null) }} />
            </div>
            <div className="control-group">
              <div className="control-label">
                <span>Vintage Warmth</span>
                <span className="control-value">{Math.round(warmth * 100)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.05"
                value={warmth} onChange={(e) => { setWarmth(e.target.value); setActivePreset(null) }} />
            </div>
          </div>
          <div>
            <div className="control-group">
              <div className="control-label">
                <span>Room Size</span>
                <span className="control-value">{Math.round(reverbRoom * 100)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.05"
                value={reverbRoom} onChange={(e) => { setReverbRoom(e.target.value); setActivePreset(null) }} />
            </div>
            <div className="control-group">
              <div className="control-label">
                <span>Reverb Mix</span>
                <span className="control-value">{reverbMix}%</span>
              </div>
              <input type="range" min="0" max="100" step="1"
                value={reverbMix} onChange={(e) => { setReverbMix(e.target.value); setActivePreset(null) }} />
            </div>
          </div>
        </div>
      </div>

      {/* EQ */}
      <div className="panel">
        <div className="panel-title">Equalizer</div>
        <div className="panel-grid">
          <div className="control-group">
            <div className="control-label">
              <span>Sub-Bass (150Hz)</span>
              <span className="control-value">{bassBoost > 0 ? '+' : ''}{bassBoost} dB</span>
            </div>
            <input type="range" min="-10" max="10" step="0.5"
              value={bassBoost} onChange={(e) => { setBassBoost(e.target.value); setActivePreset(null) }} />
          </div>
          <div className="control-group">
            <div className="control-label">
              <span>Air / Treble (8kHz)</span>
              <span className="control-value">{trebleBoost > 0 ? '+' : ''}{trebleBoost} dB</span>
            </div>
            <input type="range" min="-10" max="10" step="0.5"
              value={trebleBoost} onChange={(e) => { setTrebleBoost(e.target.value); setActivePreset(null) }} />
          </div>
        </div>
      </div>

      {/* 8D */}
      <div className="panel">
        <div className="panel-title">Spatial 8D Audio</div>
        <div 
          className={`toggle-row ${enable8D ? 'on' : ''}`}
          onClick={() => { setEnable8D(!enable8D); setActivePreset(null) }}
        >
          <span>Enable 8D Spatial Panning</span>
          <div className="toggle-switch"></div>
        </div>

        {enable8D && (
          <div className="expand-section">
            <div className="control-group">
              <div className="control-label">
                <span>Orbit Speed</span>
                <span className="control-value">{orbitTime}s</span>
              </div>
              <input type="range" min="5" max="40" step="1"
                value={orbitTime} onChange={(e) => { setOrbitTime(e.target.value); setActivePreset(null) }} />
            </div>
            <div className="control-group">
              <div className="control-label">
                <span>Distance Ducking</span>
                <span className="control-value">-{orbitDucking} dB</span>
              </div>
              <input type="range" min="0" max="15" step="0.5"
                value={orbitDucking} onChange={(e) => { setOrbitDucking(e.target.value); setActivePreset(null) }} />
            </div>
            <div className="control-group">
              <div className="control-label">
                <span>Stereo Widening</span>
                <span className="control-value">{orbitWidening}%</span>
              </div>
              <input type="range" min="0" max="50" step="1"
                value={orbitWidening} onChange={(e) => { setOrbitWidening(e.target.value); setActivePreset(null) }} />
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <button 
        className="btn btn-primary btn-lg" 
        onClick={handlePreview}
        disabled={isPreviewing || !audioPath}
      >
        {isPreviewing ? 'Rendering Preview...' : '▶  Render Audio Preview'}
      </button>

      {previewAudioUrl && (
        <div className="audio-player-card">
          <audio controls autoPlay src={previewAudioUrl} />
        </div>
      )}
    </div>
  )
}
