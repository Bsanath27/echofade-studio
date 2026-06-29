import { useState } from 'react'
import { Box, Typography, Paper, ToggleButtonGroup, ToggleButton, TextField, Button, CircularProgress } from '@mui/material'

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export default function StepImport({
  audioPath, setAudioPath,
  songTitle, setSongTitle,
  bgFile, setBgFile,
  aspectRatio, setAspectRatio,
  setStatus
}) {
  const [sourceMode, setSourceMode] = useState('youtube') // 'youtube' | 'local'
  const [url, setUrl] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [dragOverAudio, setDragOverAudio] = useState(false)
  const [dragOverBg, setDragOverBg] = useState(false)

  const handleYoutubeFetch = async () => {
    if (!url.trim()) return
    setIsFetching(true)
    setStatus('Fetching audio from YouTube...')
    const formData = new FormData()
    formData.append('url', url)
    try {
      const res = await fetch(`${API}/api/fetch-audio`, {
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
      const res = await fetch(`${API}/api/upload-audio`, {
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
    <Box>
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Import Source</Typography>
        <Typography color="text.secondary">Bring in your audio and background visual</Typography>
      </Box>

      {/* Audio Source */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
          Audio Source
        </Typography>
        
        {audioPath ? (
          <Box display="flex" alignItems="center" gap={2} p={2} bgcolor="success.dark" borderRadius={2} color="success.contrastText">
            <Typography fontWeight="bold">✓</Typography>
            <Typography flexGrow={1} fontWeight="medium">{songTitle}</Typography>
            <Button variant="outlined" color="inherit" size="small" onClick={() => { setAudioPath(''); setSongTitle(''); }}>
              Change
            </Button>
          </Box>
        ) : (
          <Box>
            <ToggleButtonGroup
              value={sourceMode}
              exclusive
              onChange={(e, val) => val && setSourceMode(val)}
              fullWidth
              sx={{ mb: 3 }}
              size="small"
            >
              <ToggleButton value="youtube">YouTube URL</ToggleButton>
              <ToggleButton value="local">Local File</ToggleButton>
            </ToggleButtonGroup>

            {sourceMode === 'youtube' ? (
              <Box>
                <TextField 
                  fullWidth 
                  placeholder="https://youtube.com/watch?v=..." 
                  value={url} 
                  onChange={(e) => setUrl(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Button 
                  variant="contained" 
                  fullWidth 
                  size="large"
                  onClick={handleYoutubeFetch}
                  disabled={isFetching || !url.trim()}
                >
                  {isFetching ? <CircularProgress size={24} /> : 'Fetch Audio'}
                </Button>
              </Box>
            ) : (
              <Box 
                sx={{
                  border: '2px dashed',
                  borderColor: dragOverAudio ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  p: 5,
                  textAlign: 'center',
                  cursor: 'pointer',
                  bgcolor: dragOverAudio ? 'action.hover' : 'background.paper',
                  transition: 'all 0.2s'
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOverAudio(true) }}
                onDragLeave={() => setDragOverAudio(false)}
                onDrop={(e) => { 
                  e.preventDefault(); setDragOverAudio(false)
                  handleLocalUpload(e.dataTransfer.files[0])
                }}
                onClick={() => document.getElementById('audio-upload').click()}
              >
                <Typography variant="h3" color="text.secondary" mb={2}>Music</Typography>
                <Typography><strong>Drop your MP3 or WAV here</strong></Typography>
                <Typography color="text.secondary">or click to browse</Typography>
                <input 
                  id="audio-upload" type="file" accept="audio/*" 
                  style={{display: 'none'}}
                  onChange={(e) => handleLocalUpload(e.target.files[0])}
                />
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Output Format */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
          Output Format
        </Typography>
        <ToggleButtonGroup
          value={aspectRatio}
          exclusive
          onChange={(e, val) => val && setAspectRatio(val)}
          fullWidth
          size="large"
        >
          <ToggleButton value="16:9" sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
            <Typography fontWeight="bold">Landscape 16:9</Typography>
            <Typography variant="caption" color="text.secondary">YouTube · 1920x1080</Typography>
          </ToggleButton>
          <ToggleButton value="9:16" sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
            <Typography fontWeight="bold">Vertical 9:16</Typography>
            <Typography variant="caption" color="text.secondary">Shorts · Reels · TikTok · 1080x1920</Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {/* Background Visual */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
          Background Visual
        </Typography>
        
        {bgFile ? (
          <Box display="flex" alignItems="center" gap={2} p={2} bgcolor="success.dark" borderRadius={2} color="success.contrastText">
            <Typography fontWeight="bold">✓</Typography>
            <Typography flexGrow={1} fontWeight="medium">{bgFile.name}</Typography>
            <Button variant="outlined" color="inherit" size="small" onClick={() => setBgFile(null)}>Change</Button>
          </Box>
        ) : (
          <Box 
            sx={{
              border: '2px dashed',
              borderColor: dragOverBg ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 5,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: dragOverBg ? 'action.hover' : 'background.paper',
              transition: 'all 0.2s'
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOverBg(true) }}
            onDragLeave={() => setDragOverBg(false)}
            onDrop={(e) => { 
              e.preventDefault(); setDragOverBg(false)
              setBgFile(e.dataTransfer.files[0])
            }}
            onClick={() => document.getElementById('bg-upload').click()}
          >
            <Typography variant="h3" color="text.secondary" mb={2}>Image</Typography>
            <Typography><strong>Upload a background image or video</strong></Typography>
            <Typography color="text.secondary">
              {aspectRatio === '9:16' ? '9:16 recommended (1080x1920)' : '16:9 recommended (1920x1080)'} — it will be center-cropped to fill
            </Typography>
            <input 
              id="bg-upload" type="file" accept="image/*,video/*" 
              style={{display: 'none'}}
              onChange={handleBgSelect}
            />
          </Box>
        )}
      </Paper>
    </Box>
  )
}
