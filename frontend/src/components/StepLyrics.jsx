import { useState, useRef, useEffect } from 'react'

export default function StepLyrics({
  lyrics, setLyrics, speed, previewAudioUrl, audioPath,
  fontFamily, setFontFamily,
  fontColor, setFontColor,
  fontSize, setFontSize,
  posX, setPosX,
  posY, setPosY,
  textTransform, setTextTransform,
  strokeWidth, setStrokeWidth,
  strokeColor, setStrokeColor,
  shadowOffset, setShadowOffset,
  lyricStyle, setLyricStyle,
  bgFile
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentLineIdx, setCurrentLineIdx] = useState(0)
  const [bgUrl, setBgUrl] = useState('')
  const audioRef = useRef(null)

  useEffect(() => {
    if (bgFile) {
      const url = URL.createObjectURL(bgFile)
      setBgUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [bgFile])

  // Parse LRC lines into [{time, text}]
  const parsedLines = (lyrics || '').split('\n')
    .map(line => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/)
      if (!match) return null
      const mins = parseInt(match[1])
      const secs = parseInt(match[2])
      const ms = parseInt(match[3])
      const timeInSec = mins * 60 + secs + ms / (match[3].length === 3 ? 1000 : 100)
      const adjustedTime = timeInSec / speed
      return { time: adjustedTime, text: match[4] || '♪' }
    })
    .filter(Boolean)

  // Track current line based on audio playback
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      const t = audio.currentTime
      let idx = -1
      for (let i = parsedLines.length - 1; i >= 0; i--) {
        if (t >= parsedLines[i].time) { idx = i; break }
      }
      setCurrentLineIdx(idx)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    return () => audio.removeEventListener('timeupdate', onTimeUpdate)
  }, [parsedLines])

  const handleGenerateAI = async () => {
    if (!audioPath) {
      alert('No audio found. Please import a track in Step 1 first!')
      return
    }
    setIsGenerating(true)
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/generate-lyrics?audio_path=${encodeURIComponent(audioPath)}`)
      const data = await res.json()
      if (data.status === 'success') {
        setLyrics(data.lyrics)
      } else {
        alert(data.message || 'Failed to generate lyrics')
      }
    } catch (e) { console.error(e) }
    setIsGenerating(false)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/search-lyrics?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data.status === 'success') {
        setResults(data.results.filter(r => r.syncedLyrics))
      }
    } catch (e) { console.error(e) }
    setIsSearching(false)
  }

  return (
    <div>
      <div className="step-header">
        <h2>Lyrics</h2>
        <p>Search, paste, or edit synchronized lyrics — then preview them against your mastered audio</p>
      </div>

      {speed != 1.0 && (
        <div className="sync-notice">
          <span>⚡</span>
          Timestamps auto-adjusted to match your <strong>&nbsp;{speed}x&nbsp;</strong> speed. Preview below to verify sync.
        </div>
      )}

      {/* Search */}
      <div className="panel">
        <div className="panel-title">Search Lyrics</div>
        <div className="lyrics-search-row">
          <input 
            type="text" 
            placeholder="Search by song name or artist..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn" onClick={handleSearch} disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="lyrics-results">
            {results.map(r => (
              <div key={r.id} className="lyrics-result-item">
                <span>{r.trackName} — {r.artistName}</span>
                <button className="btn" style={{padding: '4px 12px', fontSize: '0.8rem'}} onClick={() => {
                  setLyrics(r.syncedLyrics)
                  setResults([])
                }}>Use</button>
              </div>
            ))}
          </div>
        )}

        <div className="ai-generate-card" style={{marginTop: '20px', padding: '16px', background: 'rgba(255, 122, 0, 0.05)', border: '1px dashed var(--accent)', borderRadius: '8px', textAlign: 'center'}}>
          <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px'}}>Can't find the lyrics online? Let AI listen to the track and transcribe it automatically.</p>
          <button
            className="btn"
            onClick={handleGenerateAI}
            disabled={isGenerating || !audioPath}
            style={{background: 'var(--accent)', color: '#000', fontWeight: 'bold'}}
          >
            {isGenerating ? 'Listening & Transcribing... (This may take a minute)' : '✨ Auto-Generate Lyrics with AI'}
          </button>
        </div>
      </div>

      {/* Typography Controls */}
      <div className="panel">
        <div className="panel-title">Typography Settings</div>

        <div className="control-group" style={{marginBottom: '15px'}}>
          <label>Lyric Display Style</label>
          <div style={{display: 'flex', gap: '10px'}}>
            <button
              className={`source-tab ${lyricStyle === 'single' ? 'active' : ''}`}
              onClick={() => setLyricStyle('single')}
              style={{flex: 1}}
            >Single Line (Classic)</button>
            <button
              className={`source-tab ${lyricStyle === 'stack' ? 'active' : ''}`}
              onClick={() => setLyricStyle('stack')}
              style={{flex: 1}}
            >3-Line Stack (Karaoke)</button>
          </div>
        </div>

        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
          <div className="control-group" style={{flex: 1, minWidth: '200px'}}>
            <label>Font Family</label>
            <select className="select-input" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
              <option value="Montserrat">Montserrat (Modern / Default)</option>
              <option value="Avenir Next">Avenir Next (Clean / 7clouds)</option>
              <option value="Futura">Futura (Edgy / Trap Nation)</option>
              <option value="Didot">Didot (High-Fashion / Whitewine)</option>
              <option value="Baskerville">Baskerville (Classic / Jaded)</option>
              <option value="Helvetica Neue">Helvetica Neue (Clean UI)</option>
              <option value="Arial">Arial (Basic)</option>
              <option value="Impact">Impact (Meme)</option>
            </select>
          </div>
          
          <div className="control-group" style={{flex: 1, minWidth: '200px'}}>
            <label>Font Size</label>
            <input 
              type="range" 
              className="slider" 
              value={fontSize} 
              onChange={(e) => setFontSize(Number(e.target.value))}
              min="20" max="150"
            />
            <div className="slider-value">{fontSize}px</div>
          </div>
        </div>

        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '15px'}}>
          <div className="control-group" style={{flex: 1, minWidth: '150px'}}>
            <label>Position X</label>
            <input type="range" className="slider" value={posX} min="0" max="100" onChange={(e) => setPosX(Number(e.target.value))} />
            <div className="slider-value">{posX}%</div>
          </div>
          
          <div className="control-group" style={{flex: 1, minWidth: '150px'}}>
            <label>Position Y</label>
            <input type="range" className="slider" value={posY} min="0" max="100" onChange={(e) => setPosY(Number(e.target.value))} />
            <div className="slider-value">{posY}%</div>
          </div>
        </div>

        <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '15px'}}>
          <div className="control-group" style={{width: '80px'}}>
            <label>Text Color</label>
            <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)}
              style={{width: '100%', height: '42px', padding: '2px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer'}}
            />
          </div>

          <div className="control-group" style={{width: '80px'}}>
            <label>Stroke</label>
            <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)}
              style={{width: '100%', height: '42px', padding: '2px', background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer'}}
            />
          </div>

          <div className="control-group" style={{flex: 1, minWidth: '120px'}}>
            <label>Stroke Width</label>
            <input type="range" className="slider" value={strokeWidth} min="0" max="10" onChange={(e) => setStrokeWidth(Number(e.target.value))} />
            <div className="slider-value">{strokeWidth}px</div>
          </div>

          <div className="control-group" style={{flex: 1, minWidth: '120px'}}>
            <label>Shadow Offset</label>
            <input type="range" className="slider" value={shadowOffset} min="0" max="20" onChange={(e) => setShadowOffset(Number(e.target.value))} />
            <div className="slider-value">{shadowOffset}px</div>
          </div>
          
          <div className="control-group" style={{width: '120px'}}>
            <label>Format</label>
            <select className="select-input" value={textTransform} onChange={(e) => setTextTransform(e.target.value)}>
              <option value="uppercase">ALL CAPS</option>
              <option value="none">Normal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="panel">
        <div className="panel-title">Lyrics Editor</div>
        <textarea 
          rows="10" 
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder={"[00:00.00] Paste your synced lyrics here..."}
          style={{fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', lineHeight: '1.8'}}
        />
      </div>

      {/* Audio + Lyrics Sync Preview */}
      {previewAudioUrl && parsedLines.length > 0 && (
        <div className="panel">
          <div className="panel-title">🎧 Lyrics Sync Preview</div>
          <div className="audio-player-card" style={{marginTop: 0, marginBottom: '16px'}}>
            <audio ref={audioRef} controls src={previewAudioUrl} style={{width: '100%'}} />
          </div>

          <div className="control-group" style={{flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', borderRadius: '8px', background: '#000', height: '300px'}}>
            <label style={{position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.7rem'}}>Visual Layout Preview</label>
            
            {/* Background Media */}
            {bgUrl && (
              bgFile?.type?.startsWith('video/') ? (
                <video src={bgUrl} autoPlay loop muted style={{width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0}} />
              ) : (
                <img src={bgUrl} style={{width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0}} />
              )
            )}
            
            {/* Visual Safe Area & Coordinate Mapping */}
            <div style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}>
              {parsedLines.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: `${posY}%`,
                  left: `${posX}%`,
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  width: '90%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px'
                }}>
                  {(lyricStyle === 'stack' ? [-1, 0, 1] : [0]).map(offset => {
                    const lineIdx = currentLineIdx + offset
                    if (lineIdx < 0 || lineIdx >= parsedLines.length) return null
                    const line = parsedLines[lineIdx]
                    
                    return (
                      <div key={lineIdx} style={{
                        fontSize: offset === 0 ? `${Math.max(1, fontSize / 30)}rem` : `${Math.max(0.8, fontSize / 40)}rem`,
                        fontWeight: '700',
                        color: offset === 0 ? fontColor : 'rgba(255,255,255,0.4)',
                        textTransform: textTransform,
                        transition: 'all 0.3s ease',
                        fontFamily: fontFamily === 'Montserrat' ? "'Montserrat', sans-serif" : `"${fontFamily}", sans-serif`,
                        textShadow: offset === 0 ? (
                          [
                            strokeWidth > 0 ? `-${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, -${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}` : null,
                            shadowOffset > 0 ? `${shadowOffset}px ${shadowOffset}px ${Math.max(2, shadowOffset)}px rgba(0,0,0,0.8)` : null
                          ].filter(Boolean).join(', ') || 'none'
                        ) : 'none'
                      }}>
                        {line.text}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {previewAudioUrl && parsedLines.length === 0 && lyrics && (
        <div className="sync-notice" style={{background: 'rgba(255,50,50,0.08)', borderColor: 'rgba(255,50,50,0.2)', color: '#ff5050'}}>
          <span>⚠</span>
          No valid timestamps found in your lyrics. Make sure each line starts with [mm:ss.xx] format.
        </div>
      )}

      {!previewAudioUrl && (
        <div className="sync-notice">
          <span>💡</span>
          To preview lyrics sync, go back to Step 2 and render an audio preview first.
        </div>
      )}
    </div>
  )
}
