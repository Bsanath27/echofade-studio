import { useState } from 'react'

export default function StepExport({
  audioPath, bgFile, lyrics, songTitle,
  speed, reverbRoom, reverbMix, bassBoost, trebleBoost, warmth,
  enable8D, orbitTime, orbitDucking, orbitWidening,
  fontFamily, fontColor, fontSize,
  posX, posY, textTransform, strokeWidth, strokeColor, shadowOffset,
  renderQuality, setRenderQuality,
  renderEngine, setRenderEngine,
  setStatus
}) {
  const [fileName, setFileName] = useState(songTitle ? `${songTitle} (Slowed + Reverb)` : 'lyric_video')
  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState('')

  const handleRender = async () => {
    if (!audioPath || !bgFile) return
    setIsRendering(true)
    setStatus('Rendering video...')
    setDownloadUrl('')

    const formData = new FormData()
    formData.append('audio_path', audioPath)
    formData.append('raw_lrc', lyrics)
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
    formData.append('font_family', fontFamily)
    formData.append('font_color', fontColor)
    formData.append('font_size', fontSize)
    formData.append('pos_x', posX)
    formData.append('pos_y', posY)
    formData.append('text_transform', textTransform)
    formData.append('stroke_width', strokeWidth)
    formData.append('stroke_color', strokeColor)
    formData.append('shadow_offset', shadowOffset)
    formData.append('quality', renderQuality)
    formData.append('engine', renderEngine)
    formData.append('file_name', fileName.replace(/[^a-zA-Z0-9_\-() ]/g, ''))
    formData.append('image', bgFile)

    setRenderProgress(0)

    const progressInterval = setInterval(async () => {
      try {
        const pRes = await fetch('http://127.0.0.1:8000/api/render-progress')
        const pData = await pRes.json()
        setRenderProgress(pData.progress || 0)
      } catch (e) {}
    }, 1000)

    try {
      const res = await fetch('http://127.0.0.1:8000/api/render', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.status === 'success') {
        setDownloadUrl(`http://127.0.0.1:8000${data.download_url}`)
        setStatus('')
        setRenderProgress(100)
      } else {
        setStatus(`Render failed: ${data.message || 'Unknown error'}`)
      }
    } catch {
      setStatus('Failed to connect to backend.')
    }
    
    clearInterval(progressInterval)
    setIsRendering(false)
  }

  return (
    <div>
      <div className="step-header">
        <h2>Export Video</h2>
        <p>Review your settings and render the final video</p>
      </div>

      {/* Summary */}
      <div className="panel">
        <div className="panel-title">Settings Summary</div>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="label">Speed</span>
            <span className="value">{speed}x</span>
          </div>
          <div className="summary-item">
            <span className="label">Reverb Mix</span>
            <span className="value">{reverbMix}%</span>
          </div>
          <div className="summary-item">
            <span className="label">Room Size</span>
            <span className="value">{Math.round(reverbRoom * 100)}%</span>
          </div>
          <div className="summary-item">
            <span className="label">8D Audio</span>
            <span className="value">{enable8D ? 'On' : 'Off'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Bass Boost</span>
            <span className="value">{bassBoost > 0 ? '+' : ''}{bassBoost} dB</span>
          </div>
          <div className="summary-item">
            <span className="label">Treble</span>
            <span className="value">{trebleBoost > 0 ? '+' : ''}{trebleBoost} dB</span>
          </div>
          <div className="summary-item">
            <span className="label">Warmth</span>
            <span className="value">{Math.round(warmth * 100)}%</span>
          </div>
          <div className="summary-item">
            <span className="label">Lyrics Lines</span>
            <span className="value">{lyrics ? lyrics.split('\n').filter(l => l.trim()).length : 0}</span>
          </div>
        </div>
      </div>

      {/* Advanced Render Settings */}
      <div className="panel" style={{marginTop: '20px'}}>
        <div className="panel-title">Render Settings</div>
        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
          <div className="control-group" style={{flex: 1, minWidth: '200px'}}>
            <label>Quality</label>
            <select className="select-input" value={renderQuality} onChange={(e) => setRenderQuality(e.target.value)}>
              <option value="final">Final Master (1080p, 24fps)</option>
              <option value="draft">Draft Preview (480p, 15fps)</option>
            </select>
          </div>
          <div className="control-group" style={{flex: 2, minWidth: '300px'}}>
            <label>Rendering Engine</label>
            <select className="select-input" value={renderEngine} onChange={(e) => setRenderEngine(e.target.value)}>
              <option value="ffmpeg">Ultra-Fast Burn-In (FFmpeg Subtitles) - Recommended</option>
              <option value="moviepy">Legacy Frame-by-Frame (MoviePy) - Slow</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel" style={{marginTop: '20px'}}>
        <div className="panel-title">Filename</div>
        <input 
          type="text" 
          placeholder="Output file name" 
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
        />
      </div>

      {/* Render */}
      <button 
        className="btn btn-primary btn-lg" 
        onClick={handleRender}
        disabled={isRendering || !audioPath || !bgFile}
      >
        {isRendering ? 'Rendering Video...' : '🎬  Render Final Video'}
      </button>

      {isRendering && (
        <div className="render-progress">
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{width: `${renderProgress}%`, transition: 'width 0.5s ease'}}></div>
          </div>
          <div className="render-status">Processing audio and compositing video frames... {renderProgress}%</div>
        </div>
      )}

      {downloadUrl && (
        <div className="download-card">
          <h3>✓ Video Rendered Successfully</h3>
          <video 
            controls 
            src={downloadUrl} 
            style={{
              width: '100%', 
              maxHeight: '400px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              background: '#000'
            }} 
          />
          <a href={downloadUrl} download className="btn btn-primary" style={{display: 'inline-block', textDecoration: 'none', padding: '14px 32px'}}>
            ⬇ Download Video
          </a>
        </div>
      )}
    </div>
  )
}
