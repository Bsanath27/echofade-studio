import { useState } from 'react'

export default function StepImport({ 
  audioPath, setAudioPath, 
  songTitle, setSongTitle,
  bgFile, setBgFile,
  setStatus 
}) {
  const [sourceMode, setSourceMode] = useState('youtube') // 'youtube' | 'local'
  const [url, setUrl] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleYoutubeFetch = async () => {
    if (!url.trim()) return
    setIsFetching(true)
    setStatus('Fetching audio from YouTube...')
    const formData = new FormData()
    formData.append('url', url)
    try {
      const res = await fetch('http://127.0.0.1:8000/api/fetch-audio', {
        method: 'POST', body: formData
      })
      const data = await res.json()
      if (data.status === 'success') {
        setAudioPath(data.metadata.filepath)
        setSongTitle(data.metadata.title || 'Untitled')
        setStatus('')
      } else {
        setStatus('Error fetching audio.')
      }
    } catch {
      setStatus('Failed to connect to backend.')
    }
    setIsFetching(false)
  }

  const handleLocalUpload = async (file) => {
    if (!file) return
    setIsFetching(true)
    setStatus('Uploading audio file...')
    const formData = new FormData()
    formData.append('audio', file)
    try {
      const res = await fetch('http://127.0.0.1:8000/api/upload-audio', {
        method: 'POST', body: formData
      })
      const data = await res.json()
      if (data.status === 'success') {
        setAudioPath(data.metadata.filepath)
        setSongTitle(data.metadata.title || file.name)
        setStatus('')
      } else {
        setStatus('Error uploading file.')
      }
    } catch {
      setStatus('Failed to connect to backend.')
    }
    setIsFetching(false)
  }

  const handleBgSelect = (e) => {
    setBgFile(e.target.files[0])
  }

  return (
    <div>
      <div className="step-header">
        <h2>Import Source</h2>
        <p>Bring in your audio and background visual</p>
      </div>

      {/* Audio Source */}
      <div className="panel">
        <div className="panel-title">Audio Source</div>
        
        {audioPath ? (
          <div className="loaded-indicator">
            <span>✓</span>
            <span>{songTitle}</span>
            <button className="change-btn" onClick={() => { setAudioPath(''); setSongTitle(''); }}>
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="source-tabs">
              <button 
                className={`source-tab ${sourceMode === 'youtube' ? 'active' : ''}`}
                onClick={() => setSourceMode('youtube')}
              >YouTube URL</button>
              <button 
                className={`source-tab ${sourceMode === 'local' ? 'active' : ''}`}
                onClick={() => setSourceMode('local')}
              >Local File</button>
            </div>

            {sourceMode === 'youtube' ? (
              <div>
                <input 
                  type="text" 
                  placeholder="https://youtube.com/watch?v=..." 
                  value={url} 
                  onChange={(e) => setUrl(e.target.value)}
                  style={{marginBottom: '12px'}}
                />
                <button 
                  className="btn btn-primary" 
                  style={{width: '100%'}}
                  onClick={handleYoutubeFetch}
                  disabled={isFetching || !url.trim()}
                >
                  {isFetching ? 'Fetching...' : 'Fetch Audio'}
                </button>
              </div>
            ) : (
              <div 
                className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { 
                  e.preventDefault(); setDragOver(false)
                  handleLocalUpload(e.dataTransfer.files[0])
                }}
                onClick={() => document.getElementById('audio-upload').click()}
              >
                <div className="drop-zone-icon">🎵</div>
                <div className="drop-zone-text">
                  <strong>Drop your MP3 or WAV here</strong><br/>
                  or click to browse
                </div>
                <input 
                  id="audio-upload" type="file" accept="audio/*" 
                  style={{display: 'none'}}
                  onChange={(e) => handleLocalUpload(e.target.files[0])}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Background Visual */}
      <div className="panel">
        <div className="panel-title">Background Visual</div>
        
        {bgFile ? (
          <div className="loaded-indicator">
            <span>✓</span>
            <span>{bgFile.name}</span>
            <button className="change-btn" onClick={() => setBgFile(null)}>Change</button>
          </div>
        ) : (
          <div 
            className="drop-zone"
            onClick={() => document.getElementById('bg-upload').click()}
          >
            <div className="drop-zone-icon">🖼️</div>
            <div className="drop-zone-text">
              <strong>Upload a background image or video</strong><br/>
              16:9 recommended (1920×1080)
            </div>
            <input 
              id="bg-upload" type="file" accept="image/*,video/*" 
              style={{display: 'none'}}
              onChange={handleBgSelect}
            />
          </div>
        )}
      </div>
    </div>
  )
}
