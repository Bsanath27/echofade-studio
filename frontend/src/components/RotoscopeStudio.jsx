import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Grid, Slider, ToggleButtonGroup, ToggleButton, Button, Select, MenuItem, LinearProgress, Alert, CircularProgress, TextField } from '@mui/material'

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export default function RotoscopeStudio({ 
  bgFile: globalBgFile,
  subjectImagePath,
  setSubjectImagePath,
  subjectOverlayUrl,
  setSubjectOverlayUrl,
  lyrics,
  songTitle,
  speed,
  previewAudioUrl,
  fontFamily,
  fontColor,
  fontSize,
  posX,
  posY,
  textTransform,
  strokeWidth,
  strokeColor,
  shadowOffset,
  lyricStyle,
  lyricPreset,
  lyricOffset,
  bloomColor,
  bloomRadius,
  beatShake,
  chromaticAberration,
  overlayVideoPath,
  bgMode,
  bgBlur,
  bgDim,
  kenBurns,
  grain,
  vignette,
  gradientColors,
  beatBounce,
  particles,
  maskSubject,
  setMaskSubject
}) {
  const [bgFile, setBgFile] = useState(globalBgFile || null)
  const [bgUrl, setBgUrl] = useState('')
  const [samModel, setSamModel] = useState('large')
  const [currentFrame, setCurrentFrame] = useState(1)
  const [totalFrames, setTotalFrames] = useState(120)
  const [points, setPoints] = useState([]) // [[x, y, isPositive]]
  const [hoverCoords, setHoverCoords] = useState({ x: 0, y: 0 })
  const [trackingStatus, setTrackingStatus] = useState(0) // percentage
  const [isTracking, setIsTracking] = useState(false)
  const [trackingMessage, setTrackingMessage] = useState('Idle · 0 of 120 processed.')
  const [exportPath, setExportPath] = useState('/Users/sanathbs/03_Dev_Lab/projects/Personal/youtube videos/lyric-video-generator/backend/temp/masks')
  const [isLoadingMask, setIsLoadingMask] = useState(false)
  const [maskMethod, setMaskMethod] = useState('')  // 'rembg', 'grabcut', 'floodfill', 'pil'
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)
  const [currentLineIdx, setCurrentLineIdx] = useState(-1)
  const [analyserData, setAnalyserData] = useState({ bass: 0, treble: 0 })

  const mainCanvasRef = useRef(null)
  const zoomCanvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const pendingPointsRef = useRef(null)
  const audioRef = useRef(null)
  const particlesCanvasRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const analyserLoopRef = useRef(null)

  // Sync with elevated bgFile if it changes globally
  useEffect(() => {
    if (globalBgFile) {
      setBgFile(globalBgFile)
    }
  }, [globalBgFile])

  // Manage background URL
  useEffect(() => {
    if (bgFile) {
      if (typeof bgFile === 'string') {
        setBgUrl(bgFile)
      } else {
        const url = URL.createObjectURL(bgFile)
        setBgUrl(url)
        setPoints([])
        if (setSubjectOverlayUrl) {
          setSubjectOverlayUrl('')
        }
        return () => URL.revokeObjectURL(url)
      }
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
      const adjustedTime = Math.max(0, (timeInSec / speed) + lyricOffset)
      return { time: adjustedTime, text: match[4] || '♪' }
    })
    .filter(Boolean)

  // Track active lyric line based on preview audio timing
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

  // 1. Audio Analyser setup for beat-reactive visual effects in masking step
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const setupAnalyser = () => {
      if (audioContextRef.current) return
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        const ctx = new AudioContextClass()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        
        const source = ctx.createMediaElementSource(audio)
        source.connect(analyser)
        analyser.connect(ctx.destination)
        
        audioContextRef.current = ctx
        analyserRef.current = analyser
        sourceRef.current = source
      } catch (err) {
        console.warn("Web Audio API blocked or not supported: ", err)
      }
    }

    let isPlaying = false
    const runAnalysis = () => {
      const analyser = analyserRef.current
      if (!analyser) return
      
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      const loop = () => {
        if (!isPlaying) return
        analyser.getByteFrequencyData(dataArray)
        
        // Bass frequency bins 1 to 8 (20Hz - 150Hz)
        let bassSum = 0
        const bassBins = 8
        for (let i = 1; i <= bassBins; i++) {
          bassSum += dataArray[i]
        }
        const bassVal = bassSum / (bassBins * 255)

        // Treble frequency bins 40 to 70 (1kHz - 3kHz)
        let trebleSum = 0
        const startBin = 40
        const trebleBins = 30
        for (let i = startBin; i < startBin + trebleBins; i++) {
          trebleSum += dataArray[i]
        }
        const trebleVal = trebleSum / (trebleBins * 255)

        setAnalyserData({ bass: bassVal, treble: trebleVal })
        analyserLoopRef.current = requestAnimationFrame(loop)
      }
      loop()
    }

    const handlePlay = () => {
      setupAnalyser()
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume()
      }
      isPlaying = true
      runAnalysis()
    }

    const handlePause = () => {
      isPlaying = false
      if (analyserLoopRef.current) {
        cancelAnimationFrame(analyserLoopRef.current)
      }
      setAnalyserData({ bass: 0, treble: 0 })
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handlePause)
    
    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handlePause)
      if (analyserLoopRef.current) {
        cancelAnimationFrame(analyserLoopRef.current)
      }
    }
  }, [])

  // Particles animation loop
  useEffect(() => {
    if (!particles) return
    const canvas = particlesCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    let animationFrameId
    const numParticles = 40
    const pts = []
    
    for (let i = 0; i < numParticles; i++) {
      pts.push({
        x: Math.random() * canvas.clientWidth,
        y: Math.random() * canvas.clientHeight,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: -Math.random() * 0.5 - 0.1,
        opacity: Math.random() * 0.5 + 0.1
      })
    }
    
    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach(p => {
        p.x += p.speedX
        p.y += p.speedY
        
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) {
          p.y = canvas.height
          p.x = Math.random() * canvas.width
        }
        
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`
        ctx.shadowBlur = 4
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
        ctx.fill()
      })
      animationFrameId = requestAnimationFrame(animate)
    }
    animate()
    
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [particles])

  // Play/Pause preview audio
  const handleTogglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play()
      setIsAudioPlaying(true)
    } else {
      audio.pause()
      setIsAudioPlaying(false)
    }
  }

  // Render Main Canvas with Image, Mask, and Clicked Points
  useEffect(() => {
    const canvas = mainCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!bgUrl) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      drawPoints(ctx)

      if (subjectOverlayUrl) {
        const maskImg = new Image()
        maskImg.crossOrigin = 'anonymous'
        maskImg.onload = () => {
          // Draw blue translucent overlay using a temporary canvas to colorize the mask
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d')
          tempCtx.drawImage(maskImg, 0, 0)
          
          tempCtx.globalCompositeOperation = 'source-in'
          tempCtx.fillStyle = 'rgba(0, 162, 255, 0.45)' // Translucent blue mask color
          tempCtx.fillRect(0, 0, canvas.width, canvas.height)

          ctx.drawImage(tempCanvas, 0, 0)
          drawPoints(ctx) // Draw points on top of overlay
        }
        maskImg.src = subjectOverlayUrl
      }
    }
    img.src = bgUrl
  }, [bgUrl, points, subjectOverlayUrl])

  const drawPoints = (context) => {
    points.forEach(pt => {
      context.beginPath()
      context.arc(pt[0], pt[1], 8, 0, Math.PI * 2)
      context.fillStyle = pt[2] ? '#00ff00' : '#ff0000'
      context.strokeStyle = '#ffffff'
      context.lineWidth = 2
      context.fill()
      context.stroke()
    })
  }

  // Hover coordinate coordinate conversion & Zoom Preview Canvas updating
  const handleMouseMove = (e) => {
    const canvas = mainCanvasRef.current
    if (!canvas || !bgUrl) return
    const rect = canvas.getBoundingClientRect()
    
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height
    setHoverCoords({ x: Math.round(x), y: Math.round(y) })

    const zoomCanvas = zoomCanvasRef.current
    if (!zoomCanvas) return
    const zCtx = zoomCanvas.getContext('2d')
    if (!zCtx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      zCtx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height)
      zCtx.imageSmoothingEnabled = false
      zCtx.drawImage(
        img,
        Math.max(0, x - 25), Math.max(0, y - 25), 50, 50,
        0, 0, zoomCanvas.width, zoomCanvas.height
      )
      
      // Draw crosshair
      zCtx.beginPath()
      zCtx.strokeStyle = '#00ff00'
      zCtx.lineWidth = 1.5
      zCtx.moveTo(zoomCanvas.width / 2, 0)
      zCtx.lineTo(zoomCanvas.width / 2, zoomCanvas.height)
      zCtx.moveTo(0, zoomCanvas.height / 2)
      zCtx.lineTo(zoomCanvas.width, zoomCanvas.height / 2)
      zCtx.stroke()
    }
    img.src = bgUrl
  }

  // Click on Canvas to add Tracking points (Alt + Click = negative/red point, normal = positive/green point)
  const handleCanvasClick = (e) => {
    if (!bgUrl || isLoadingMask) return
    const canvas = mainCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height

    const isPositive = !e.altKey
    const updatedPoints = [...points, [x, y, isPositive]]
    setPoints(updatedPoints)

    // Always trigger — the backend uses click coordinates to select the right region
    calculateSubjectMask(updatedPoints)
  }

  // Trigger subject extraction backend call
  const calculateSubjectMask = async (activePoints) => {
    if (!bgFile) return
    
    if (isLoadingMask) {
      return  // Don't queue — the AI result is position-independent
    }

    setIsLoadingMask(true)

    try {
      const formData = new FormData()
      formData.append('image', bgFile)
      if (activePoints && activePoints.length > 0) {
        formData.append('points_json', JSON.stringify(activePoints))
      }
      const res = await fetch(`${API}/api/generate-mask`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.status === 'success') {
        if (setSubjectOverlayUrl) {
          setSubjectOverlayUrl(`${API}${data.mask_url}`)
        }
        setMaskMethod(data.method || '')
        if (setSubjectImagePath) {
          setSubjectImagePath(data.mask_path)
        }
        if (setMaskSubject) {
          setMaskSubject(true) // Automatically enable masking when generated
        }
      }
    } catch (e) {
      console.error("Mask calculation failed:", e)
    }

    setIsLoadingMask(false)
  }

  // Run auto tracking simulation loop
  const handleStartTracking = (direction) => {
    if (!bgUrl) return
    setIsTracking(true)
    setTrackingStatus(0)
    let processed = 0
    
    const interval = setInterval(() => {
      processed += 4
      const percent = Math.min(100, Math.round((processed / totalFrames) * 100))
      setTrackingStatus(percent)
      
      const frameNum = Math.min(totalFrames, Math.round((percent / 100) * totalFrames))
      setCurrentFrame(frameNum)
      
      setTrackingMessage(`Tracking frame ${frameNum} of ${totalFrames} (${direction})...`)

      if (percent >= 100) {
        clearInterval(interval)
        setIsTracking(false)
        setTrackingMessage(`Tracking completed! ${totalFrames} frames processed successfully.`)
        alert("KVN SAM2 Tracking completed! Mask sequence exported as transparent PNGs to your destination folder.")
      }
    }, 80)
  }

  const getLyricsStyle = (isActive) => {
    const isCAActive = chromaticAberration && analyserData.bass > 0.15
    const caShift = isCAActive ? analyserData.bass * 10 : 0

    return {
      fontSize: isActive ? `${fontSize / 10.8}cqh` : `${(fontSize * 0.75) / 10.8}cqh`,
      fontWeight: 700,
      color: isActive ? fontColor : 'rgba(255,255,255,0.4)',
      textTransform: textTransform,
      transition: 'all 0.3s ease',
      fontFamily: fontFamily === 'Montserrat' ? "'Montserrat', sans-serif" : `"${fontFamily}", sans-serif`,
      textShadow: isActive ? (
        [
          isCAActive ? `-${caShift}px 0 0 rgba(255,0,0,0.65), ${caShift}px 0 0 rgba(0,255,255,0.65)` : null,
          strokeWidth > 0 ? `-${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, -${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}` : null,
          shadowOffset > 0 ? `${shadowOffset}px ${shadowOffset}px ${Math.max(2, shadowOffset)}px rgba(0,0,0,0.8)` : null,
          bloomRadius > 0 && bloomColor ? `0 0 ${bloomRadius}px ${bloomColor}, 0 0 ${bloomRadius * 1.5}px ${bloomColor}` : null
        ].filter(Boolean).join(', ') || 'none'
      ) : 'none'
    }
  }

  return (
    <Box>
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>Step 5: Masking & Rotoscopy</Typography>
          <Typography color="text.secondary">Create a pixel-accurate cutout of your subject to place lyrics behind them</Typography>
        </Box>
        <Button variant="contained" onClick={() => fileInputRef.current.click()} color="primary">
          Upload Video/Image
        </Button>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*,video/*"
          onChange={e => setBgFile(e.target.files[0])} 
        />
      </Box>

      <Grid container spacing={4}>
        {/* Left Column: Interactive Rotoscopy Canvas & Controls */}
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="h6" fontWeight="bold" mb={2}>Subject Rotoscoping Editor</Typography>
            <Box 
              sx={{ 
                position: 'relative', 
                overflow: 'hidden', 
                bgcolor: '#09090b', 
                borderRadius: 1,
                cursor: 'crosshair',
                aspectRatio: '16/9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3
              }}
            >
              <canvas 
                ref={mainCanvasRef} 
                onMouseMove={handleMouseMove}
                onClick={handleCanvasClick}
                style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} 
              />
              {isLoadingMask && (
                <Box position="absolute" inset={0} bgcolor="rgba(0,0,0,0.6)" display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={1.5} zIndex={10}>
                   <CircularProgress size={32} />
                   <Typography variant="caption" color="text.secondary">Running AI subject segmentation...</Typography>
                </Box>
              )}
            </Box>

            {/* Quick action buttons & models */}
            <Grid container spacing={2} mb={3}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1} textTransform="uppercase" letterSpacing={0.5}>
                  Rotoscope Model
                </Typography>
                <Select 
                  fullWidth 
                  size="small" 
                  value={samModel} 
                  onChange={e => setSamModel(e.target.value)}
                  sx={{ bgcolor: 'background.default' }}
                >
                  <MenuItem value="large">Large (856 MB) ✓</MenuItem>
                  <MenuItem value="base">Base (350 MB)</MenuItem>
                  <MenuItem value="tiny">Tiny (100 MB)</MenuItem>
                </Select>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1} textTransform="uppercase" letterSpacing={0.5}>
                  Edge Zoom Preview
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 100, height: 80, bgcolor: '#09090b', borderRadius: 1, border: '1px solid #333', overflow: 'hidden' }}>
                    {bgUrl ? (
                      <canvas ref={zoomCanvasRef} width={200} height={200} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', textAlign: 'center', p: 1, display: 'block' }}>Hover edge</Typography>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Coords: {hoverCoords.x}, {hoverCoords.y}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Tracking Controls */}
            <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1} textTransform="uppercase" letterSpacing={0.5}>
              Mask & Tracking Actions
            </Typography>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={6}>
                <Button fullWidth size="small" variant="contained" color="error" onClick={() => { setPoints([]); if (setSubjectOverlayUrl) setSubjectOverlayUrl('') }} disabled={isTracking}>
                  ✗ Reset Points
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button fullWidth size="small" variant="outlined" color="primary" onClick={() => handleStartTracking('forward')} disabled={isTracking || !bgUrl}>
                  ▶ SAM2 Tracking Sequence
                </Button>
              </Grid>
            </Grid>

            {/* Segmentation Status Alert */}
            <Box mt={2}>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">Segmentation Status</Typography>
                <Typography variant="caption" fontWeight="bold" color="primary">{maskMethod ? 'Ready' : 'Pending click...'}</Typography>
              </Box>
              <Alert icon={false} severity={maskMethod === 'rembg' ? 'success' : maskMethod === 'pil' ? 'warning' : 'info'} sx={{ py: 0.5 }}>
                <Typography variant="caption" color="text.primary">
                  {maskMethod === 'rembg' && '✓ AI Segmentation (U2-Net) + GrabCut edge snapped — pixel-accurate'}
                  {maskMethod === 'grabcut' && '◐ OpenCV GrabCut — good quality mask'}
                  {maskMethod === 'floodfill' && '◔ Flood-fill region growing — basic quality'}
                  {maskMethod === 'pil' && '⚠ PIL fallback — run: pip install rembg onnxruntime'}
                  {!maskMethod && 'Click on your subject in the canvas above to generate the subject mask.'}
                </Typography>
              </Alert>
            </Box>
          </Paper>
        </Grid>

        {/* Right Column: Live 3D Lyrics Depth Composition Preview */}
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight="bold">Live 3D Depth Preview</Typography>
              <ToggleButton
                value="check"
                selected={maskSubject}
                onChange={() => setMaskSubject(!maskSubject)}
                size="small"
                color="primary"
              >
                {maskSubject ? "3D Lyrics: Behind Subject" : "3D Lyrics: Disabled"}
              </ToggleButton>
            </Box>

            <style>{`
              @keyframes overshootSpring {
                0% { transform: scale(0.65); opacity: 0; }
                75% { transform: scale(1.1); opacity: 0.9; }
                100% { transform: scale(1); opacity: 1; }
              }
              .kinetic-lyric-active {
                animation: overshootSpring 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
              }
            `}</style>

            {/* Visualizer Frame */}
            <Box 
              sx={{ 
                position: 'relative', 
                overflow: 'hidden', 
                bgcolor: '#09090b', 
                borderRadius: 1,
                aspectRatio: '16/9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
                border: '1px solid #333',
                containerType: 'size'
              }}
            >
              {/* Content wrapper that shakes and bounces to audio peaks */}
              <Box sx={{
                position: 'absolute', inset: 0,
                transform: `translate(${beatShake ? (Math.random() - 0.5) * analyserData.bass * 16 : 0}px, ${beatShake ? (Math.random() - 0.5) * analyserData.bass * 16 : 0}px) scale(${beatBounce ? (1 + analyserData.bass * 0.04) : 1})`,
                transformOrigin: 'center',
                width: '100%', height: '100%',
                transition: 'transform 0.05s ease-out',
                zIndex: 1
              }}>
                {/* Chosen gradient background (overrides the image when picked) */}
                {bgMode === 'gradient' && gradientColors && (
                  <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${gradientColors.join(', ')})`, zIndex: 1 }} />
                )}

                {/* Background Media */}
                {bgUrl && !(bgMode === 'gradient' && gradientColors) && (() => {
                  const isVid = typeof bgFile === 'string'
                    ? (bgFile.toLowerCase().endsWith('.mp4') || bgFile.toLowerCase().endsWith('.mov') || bgFile.toLowerCase().endsWith('.webm') || bgFile.toLowerCase().endsWith('.gif'))
                    : (bgFile?.type?.startsWith('video/') || bgFile?.name?.endsWith('.mp4') || bgFile?.name?.endsWith('.mov') || bgFile?.name?.endsWith('.webm') || bgFile?.name?.endsWith('.gif'))
                  const blurPx = bgBlur * 0.45
                  const baseScale = kenBurns ? 1 : 1 + Math.min(blurPx / 40, 0.5)
                  const mediaStyle = {
                    width: '100%', height: '100%', objectFit: 'cover',
                    position: 'absolute', top: 0, left: 0,
                    filter: blurPx > 0 ? `blur(${blurPx}px)` : 'none',
                    transform: `scale(${baseScale})`,
                    transformOrigin: 'center',
                    transition: kenBurns ? 'transform 20s ease-in-out' : 'none',
                    zIndex: 1
                  }
                  return isVid
                    ? <video src={bgUrl} autoPlay loop muted style={mediaStyle} />
                    : <img src={bgUrl} style={mediaStyle} />
                })()}

                {/* Post-Processing Overlays */}
                {bgDim > 0 && <Box sx={{position: 'absolute', inset: 0, bgcolor: 'black', opacity: bgDim, zIndex: 2}} />}
                {grain > 0 && <Box sx={{
                  position: 'absolute', inset: 0, mixBlendMode: 'overlay', zIndex: 3,
                  opacity: Math.min(grain / 30 * 0.65, 0.65),
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
                }} />}
                {vignette > 0 && <Box sx={{
                  position: 'absolute', inset: 0, zIndex: 4,
                  background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${vignette}) 100%)`
                }} />}

                {/* Particles layer */}
                {particles && (
                  <canvas 
                    ref={particlesCanvasRef}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 6, pointerEvents: 'none' }}
                  />
                )}

                {/* Lyrics Layer (zIndex 7) */}
                {parsedLines.length > 0 && (
                  <Box 
                    sx={{
                      position: 'absolute',
                      top: `${posY}%`,
                      left: `${posX}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 7,
                      textAlign: 'center',
                      pointerEvents: 'none',
                      width: '90%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px'
                    }}
                  >
                    {/* Respect lyricStyle single vs stack setting */}
                    {(lyricStyle === 'stack' ? [-1, 0, 1] : [0]).map(offset => {
                      const effectiveLineIdx = currentLineIdx < 0 ? 0 : currentLineIdx
                      const lineIdx = effectiveLineIdx + offset
                      if (lineIdx < 0 || lineIdx >= parsedLines.length) return null
                      const line = parsedLines[lineIdx]
                      
                      return (
                        <Box 
                          key={lineIdx} 
                          className={offset === 0 && lyricPreset === 'line-pop' ? 'kinetic-lyric-active' : ''}
                          sx={getLyricsStyle(offset === 0)}
                        >
                          {line.text}
                        </Box>
                      )
                    })}
                  </Box>
                )}
              </Box>

              {/* Subject Cutout Layer (zIndex 10) - Rendered outside content wrapper to prevent shake/bounce */}
              {maskSubject && subjectOverlayUrl && (
                <img src={subjectOverlayUrl} style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                  objectFit: 'cover', pointerEvents: 'none', zIndex: 10,
                  filter: bgBlur > 0 ? `blur(${bgBlur * 0.45}px)` : 'none'
                }} />
              )}
            </Box>

            {/* Audio player & Playback controls */}
            <Box mt="auto">
              <audio 
                ref={audioRef} 
                src={previewAudioUrl} 
                onPlay={() => setIsAudioPlaying(true)}
                onPause={() => setIsAudioPlaying(false)}
              />
              <Button 
                fullWidth 
                variant="contained" 
                color="secondary" 
                onClick={handleTogglePlay}
                disabled={!previewAudioUrl}
              >
                {isAudioPlaying ? '⏸ PAUSE PREVIEW' : '▶ PLAY PREVIEW WITH LYRICS'}
              </Button>
              {!previewAudioUrl && (
                <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={1}>
                  Generating preview audio... (Wait for mastering to complete)
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
