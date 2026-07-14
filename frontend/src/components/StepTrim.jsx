import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, TextField, Grid, Slider, CircularProgress } from '@mui/material'

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export default function StepTrim({
  trimStart, setTrimStart,
  trimEnd, setTrimEnd,
  previewAudioUrl,
  audioPath
}) {
  const [duration, setDuration] = useState(0)
  const [peaks, setPeaks] = useState([])
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const canvasRef = useRef(null)
  const rawAudioRef = useRef(null)
  const previewAudioRef = useRef(null)

  // Resolve audio path to a served URL
  const getAudioUrl = (path) => {
    if (!path) return '';
    const normalizedPath = path.replace(/\\/g, '/');
    const tempIdx = normalizedPath.indexOf('/temp/');
    if (tempIdx !== -1) {
      return `${API}/files/${normalizedPath.substring(tempIdx + 6)}`;
    }
    if (normalizedPath.startsWith('temp/')) {
      return `${API}/files/${normalizedPath.substring(5)}`;
    }
    return '';
  }

  const rawAudioUrl = getAudioUrl(audioPath)

  // 1. Fetch duration from hidden audio element
  useEffect(() => {
    if (!rawAudioUrl) return
    const audio = new Audio(rawAudioUrl)
    const handleMetadata = () => {
      setDuration(audio.duration)
      if (!trimEnd || trimEnd === 0 || trimEnd > audio.duration) {
        setTrimEnd(audio.duration)
      }
    }
    audio.addEventListener('loadedmetadata', handleMetadata)
    return () => {
      audio.removeEventListener('loadedmetadata', handleMetadata)
      audio.pause()
    }
  }, [rawAudioUrl])

  // 2. Fetch waveform peaks
  useEffect(() => {
    if (!audioPath) return
    setIsLoadingWaveform(true)
    fetch(`${API}/api/audio-waveform?audio_path=${encodeURIComponent(audioPath)}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setPeaks(data.peaks)
        }
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoadingWaveform(false))
  }, [audioPath])

  // 3. Render waveform to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0 || duration === 0) return
    const ctx = canvas.getContext('2d')
    
    // Clear and handle scaling for retina displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    ctx.scale(dpr, dpr)
    
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)
    
    const barWidth = w / peaks.length
    const activeStart = trimStart || 0
    const activeEnd = trimEnd || duration

    peaks.forEach((peak, i) => {
      const x = i * barWidth
      const barHeight = peak * h * 0.75
      const y = (h - barHeight) / 2
      
      const currentSec = (i / peaks.length) * duration
      const isActive = currentSec >= activeStart && currentSec <= activeEnd
      
      ctx.fillStyle = isActive ? '#ff7a00' : '#3f3f46' // active orange vs zinc-700
      
      // Draw rounded rectangle for bar
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(x + 1, y, Math.max(1, barWidth - 1), barHeight, 2)
      } else {
        ctx.rect(x + 1, y, Math.max(1, barWidth - 1), barHeight)
      }
      ctx.fill()
    })

    // Draw active playhead line
    if (playbackTime > 0 && playbackTime <= duration) {
      const playheadX = (playbackTime / duration) * w
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.shadowBlur = 6
      ctx.shadowColor = 'rgba(255, 255, 255, 0.9)'
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, h)
      ctx.stroke()
      ctx.shadowBlur = 0 // reset shadow
    }
  }, [peaks, trimStart, trimEnd, duration, playbackTime])

  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    const ms = Math.floor((secs - Math.floor(secs)) * 10)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`
  }

  const handleSliderChange = (event, newValue) => {
    setTrimStart(newValue[0])
    setTrimEnd(newValue[1])
    if (rawAudioRef.current) {
      rawAudioRef.current.currentTime = newValue[0]
      setPlaybackTime(newValue[0])
    }
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={1}>Trim Segment</Typography>
      <Typography color="text.secondary" mb={3}>
        Select the specific segment of the audio you want to use for your reel.
      </Typography>

      <Paper sx={{ p: 3, mb: 3, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" color="primary" fontWeight="bold" mb={0.5}>
          ✂️ Audio Waveform / Segment Trimmer
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={3}>
          Drag the handles below to select a clip. Highlighted orange region represents the output segment.
        </Typography>

        {isLoadingWaveform ? (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height={120} gap={1}>
            <CircularProgress size={28} />
            <Typography variant="caption" color="text.secondary">Analyzing audio waveforms...</Typography>
          </Box>
        ) : peaks.length > 0 && duration > 0 ? (
          <Box mb={4} px={1}>
            {/* Waveform Canvas */}
            <canvas 
              ref={canvasRef} 
              style={{ width: '100%', height: 100, display: 'block', backgroundColor: 'transparent' }} 
            />
            {/* Range Slider Stacking */}
            <Box mt={1} position="relative">
              <Slider
                value={[trimStart || 0, trimEnd || duration]}
                onChange={handleSliderChange}
                min={0}
                max={duration}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(val) => formatTime(val)}
                sx={{
                  color: 'primary.main',
                  height: 4,
                  padding: '13px 0',
                  '& .MuiSlider-thumb': {
                    height: 20,
                    width: 20,
                    backgroundColor: '#fff',
                    border: '2px solid currentColor',
                    '&:hover': {
                      boxShadow: '0 0 0 8px rgba(255, 122, 0, 0.16)',
                    },
                    '& .Mui-focusVisible': {
                      boxShadow: 'none',
                    },
                  },
                  '& .MuiSlider-track': {
                    height: 4,
                  },
                  '& .MuiSlider-rail': {
                    color: 'rgba(255,255,255,0.1)',
                    height: 4,
                  },
                }}
              />
            </Box>
          </Box>
        ) : (
          <Box p={3} textAlign="center" border={1} borderColor="divider" borderRadius={2} mb={3}>
            <Typography variant="caption" color="text.secondary">No waveform data available. Import an audio file in Step 1 first.</Typography>
          </Box>
        )}

        <Grid container spacing={3} mb={2}>
          <Grid item xs={12} sm={6}>
            <TextField 
              label="Start Time (seconds)"
              type="number"
              value={trimStart !== undefined ? Number(trimStart).toFixed(1) : "0.0"}
              onChange={(e) => setTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
              fullWidth
              size="small"
              helperText={`Start point: ${formatTime(trimStart || 0)}`}
              InputProps={{ inputProps: { min: 0, max: duration, step: 0.1 } }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField 
              label="End Time (seconds)"
              type="number"
              value={trimEnd !== undefined ? Number(trimEnd).toFixed(1) : duration.toFixed(1)}
              onChange={(e) => setTrimEnd(Math.min(duration, Math.max(trimStart || 0, parseFloat(e.target.value) || duration)))}
              fullWidth
              size="small"
              helperText={`End point: ${formatTime(trimEnd || duration)}`}
              InputProps={{ inputProps: { min: trimStart || 0, max: duration, step: 0.1 } }}
            />
          </Grid>
        </Grid>

        <Box mt={3} pt={2} borderTop={1} borderColor="divider">
          <Grid container spacing={3}>
            {/* Raw Original Track Player */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" mb={1} fontWeight="bold">Original Audio Track</Typography>
              {rawAudioUrl ? (
                <audio 
                  ref={rawAudioRef}
                  controls 
                  src={rawAudioUrl} 
                  style={{width: '100%', height: 40}} 
                  onPlay={() => { if (previewAudioRef.current) previewAudioRef.current.pause() }}
                  onTimeUpdate={() => { if (rawAudioRef.current) setPlaybackTime(rawAudioRef.current.currentTime) }}
                />
              ) : (
                <Typography variant="caption" color="text.secondary">No original audio loaded.</Typography>
              )}
            </Grid>

            {/* Rendered Processed Segment Player */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" mb={1} fontWeight="bold">Processed Segment Preview</Typography>
              {previewAudioUrl ? (
                <audio 
                  ref={previewAudioRef}
                  controls 
                  src={previewAudioUrl} 
                  style={{width: '100%', height: 40}} 
                  onPlay={() => { if (rawAudioRef.current) rawAudioRef.current.pause() }}
                  onTimeUpdate={() => { if (previewAudioRef.current) setPlaybackTime((trimStart || 0) + previewAudioRef.current.currentTime) }}
                />
              ) : (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  To hear the processed segment (with speed, reverb, EQ effects), go back to Step 2 and render a preview.
                </Typography>
              )}
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  )
}
