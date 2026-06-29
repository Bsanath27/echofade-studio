import { useState } from 'react'
import { Box, Typography, Paper, Grid, TextField, Button, LinearProgress, Select, MenuItem, FormControl, InputLabel, Divider } from '@mui/material'

const STAGE_LABELS = {
  starting: 'Starting...',
  slowdown: 'Applying vinyl slowdown...',
  '8d': 'Rendering 8D spatial panning...',
  eq_reverb: 'Applying EQ & reverb...',
  mastering: 'Mastering audio...',
  rendering: 'Compositing video frames...',
  done: 'Done!'
}

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export default function StepExport({
  audioPath, bgFile, lyrics, songTitle,
  speed, reverbRoom, reverbMix, bassBoost, trebleBoost, warmth,
  enable8D, orbitTime, orbitDucking, orbitWidening,
  fontFamily, fontColor, fontSize,
  posX, posY, textTransform, strokeWidth, strokeColor, shadowOffset,
  lyricStyle, aspectRatio,
  bgMode, bgBlur, bgDim, kenBurns, grain, vignette, gradientColors,
  renderQuality, setRenderQuality,
  renderEngine, setRenderEngine,
  setStatus
}) {
  const [fileName, setFileName] = useState(songTitle ? `${songTitle} (Slowed + Reverb)` : 'lyric_video')
  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState(0)
  const [renderStage, setRenderStage] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')

  const handleRender = async () => {
    if (!audioPath || !bgFile) return
    setIsRendering(true)
    setStatus('Rendering video...')
    setDownloadUrl('')

    const jobId = Math.random().toString(36).substring(2, 10)

    const formData = new FormData()
    formData.append('audio_path', audioPath)
    formData.append('job_id', jobId)
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
    formData.append('lyric_style', lyricStyle)
    formData.append('aspect_ratio', aspectRatio)
    formData.append('bg_mode', bgMode)
    formData.append('bg_blur', bgBlur)
    formData.append('bg_dim', bgDim)
    formData.append('ken_burns', kenBurns)
    formData.append('grain', grain)
    formData.append('vignette_strength', vignette)
    if (gradientColors) formData.append('gradient_colors', JSON.stringify(gradientColors))
    formData.append('file_name', fileName.replace(/[^a-zA-Z0-9_\-() ]/g, ''))
    formData.append('image', bgFile)

    setRenderProgress(0)
    setRenderStage('starting')

    const progressInterval = setInterval(async () => {
      try {
        const pRes = await fetch(`${API}/api/render-progress?job_id=${jobId}`)
        const pData = await pRes.json()
        setRenderProgress(pData.progress || 0)
        setRenderStage(pData.stage || '')
      } catch (e) {}
    }, 1000)

    try {
      const res = await fetch(`${API}/api/render`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.status === 'success') {
        setDownloadUrl(`${API}${data.download_url}`)
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

  const SummaryItem = ({ label, value }) => (
    <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight="bold">{value}</Typography>
    </Box>
  )

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Export Video</Typography>
        <Typography color="text.secondary">Review your settings and render the final video</Typography>
      </Box>

      {/* Summary */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
          Settings Summary
        </Typography>
        <Grid container spacing={4}>
          <Grid item xs={12} sm={6}>
            <SummaryItem label="Speed" value={`${speed}x`} />
            <SummaryItem label="Reverb Mix" value={`${reverbMix}%`} />
            <SummaryItem label="Room Size" value={`${Math.round(reverbRoom * 100)}%`} />
            <SummaryItem label="8D Audio" value={enable8D ? 'On' : 'Off'} />
            <SummaryItem label="Format" value={aspectRatio === '9:16' ? 'Vertical 9:16' : 'Landscape 16:9'} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SummaryItem label="Bass Boost" value={`${bassBoost > 0 ? '+' : ''}${bassBoost} dB`} />
            <SummaryItem label="Treble" value={`${trebleBoost > 0 ? '+' : ''}${trebleBoost} dB`} />
            <SummaryItem label="Warmth" value={`${Math.round(warmth * 100)}%`} />
            <SummaryItem label="Lyrics Lines" value={lyrics ? lyrics.split('\n').filter(l => l.trim()).length : 0} />
          </Grid>
        </Grid>
      </Paper>

      {/* Advanced Render Settings */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
          Render Settings
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Quality</InputLabel>
              <Select value={renderQuality} label="Quality" onChange={(e) => setRenderQuality(e.target.value)}>
                <MenuItem value="final">Final Master (1080p, 24fps)</MenuItem>
                <MenuItem value="draft">Draft Preview (480p, 15fps)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Rendering Engine</InputLabel>
              <Select value={renderEngine} label="Rendering Engine" onChange={(e) => setRenderEngine(e.target.value)}>
                <MenuItem value="ffmpeg">Ultra-Fast Burn-In (FFmpeg Subtitles) - Recommended</MenuItem>
                <MenuItem value="moviepy">Legacy Frame-by-Frame (MoviePy) - Slow</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
          Filename
        </Typography>
        <TextField 
          fullWidth
          placeholder="Output file name" 
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          size="small"
        />
      </Paper>

      {/* Render Button */}
      <Button 
        variant="contained" 
        color="primary" 
        size="large" 
        fullWidth
        onClick={handleRender}
        disabled={isRendering || !audioPath || !bgFile}
        sx={{ mb: 3, py: 1.5, fontSize: '1.1rem' }}
      >
        {isRendering ? 'Rendering Video...' : 'Render Final Video'}
      </Button>

      {isRendering && (
        <Box mb={3}>
          <LinearProgress variant="determinate" value={renderProgress} sx={{ height: 10, borderRadius: 5, mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {STAGE_LABELS[renderStage] || 'Processing...'} {renderProgress}%
          </Typography>
        </Box>
      )}

      {downloadUrl && (
        <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  p: 4, borderRadius: 2, textAlign: 'center', bgcolor: 'success.dark', color: 'success.contrastText' }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Video Rendered Successfully
          </Typography>
          <video 
            controls 
            src={downloadUrl} 
            style={{ width: '100%', maxHeight: '400px', borderRadius: '8px', marginBottom: '20px', background: '#000' }} 
          />
          <Button 
            variant="contained" 
            color="inherit" 
            href={downloadUrl} 
            download 
            sx={{ color: 'black', fontWeight: 'bold' }}
          >
            Download Video
          </Button>
        </Paper>
      )}
    </Box>
  )
}
