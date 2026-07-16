import { useState, useRef, useEffect } from 'react'
import { Box, Typography, Paper, TextField, Button, ToggleButtonGroup, ToggleButton, Select, MenuItem, Slider, Alert, CircularProgress, List, ListItem, ListItemText, ListItemSecondaryAction, Grid, InputLabel, FormControl, Chip, LinearProgress } from '@mui/material'
import { FONT_PRESETS, BG_GRADIENTS } from '../presets'

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

const STAGE_LABELS = {
  starting: 'Starting...',
  slowdown: 'Applying vinyl slowdown...',
  '8d': 'Rendering 8D spatial panning...',
  eq_reverb: 'Applying EQ & reverb...',
  mastering: 'Mastering audio...',
  done: 'Done!'
}

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
  lyricPreset, setLyricPreset,
  lyricOffset, setLyricOffset,
  songTitle, setSongTitle,
  showIntro, setShowIntro,
  trimStart, setTrimStart,
  trimEnd, setTrimEnd,
  canvasMode, setCanvasMode,
  aspectRatio,
  bgMode, setBgMode,
  bgBlur, setBgBlur,
  bgDim, setBgDim,
  kenBurns, setKenBurns,
  grain, setGrain,
  vignette, setVignette,
  gradientColors, setGradientColors,
  beatBounce, setBeatBounce,
  particles, setParticles,
  bloomColor, setBloomColor,
  bloomRadius, setBloomRadius,
  beatShake, setBeatShake,
  chromaticAberration, setChromaticAberration,
  overlayVideoPath, setOverlayVideoPath,
  maskSubject, setMaskSubject,
  subjectImagePath, setSubjectImagePath,
  subjectOverlayUrl, setSubjectOverlayUrl,
  bgFile,
  isPreviewing,
  previewProgress,
  previewStage,
  introMode, setIntroMode,
  introText, setIntroText,
  introVideoFile, setIntroVideoFile,
  layoutTheme, setLayoutTheme,
  paperskyBgMode, setPaperskyBgMode,
  paperskyAtmosphere, setPaperskyAtmosphere,
  paperskyCaption, setPaperskyCaption,
  paperskyCustomBgFile, setPaperskyCustomBgFile,
  paperskyCustomBgUrl, setPaperskyCustomBgUrl,
  paperskyFont, setPaperskyFont,
  paperskyFontSize, setPaperskyFontSize,
  paperskyFontColor, setPaperskyFontColor,
  paperskyPlacement, setPaperskyPlacement,
  paperskyTextMode, setPaperskyTextMode
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFont, setActiveFont] = useState(null)

  const applyFontPreset = (p) => {
    setFontFamily(p.font); setFontSize(p.size); setStrokeWidth(p.stroke)
    setStrokeColor(p.strokeColor); setShadowOffset(p.shadow); setFontColor(p.color)
    setTextTransform(p.transform); setActiveFont(p.name)
    if (p.bloomColor !== undefined) setBloomColor(p.bloomColor)
    if (p.bloomRadius !== undefined) setBloomRadius(p.bloomRadius)
    if (p.preset) setLyricPreset(p.preset)
  }
  const activeGradient = gradientColors ? BG_GRADIENTS.find(g => JSON.stringify(g.colors) === JSON.stringify(gradientColors))?.name : null
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentLineIdx, setCurrentLineIdx] = useState(0)
  const [bgUrl, setBgUrl] = useState('')
  const [maskMode, setMaskMode] = useState('auto')
  const [chromaColor, setChromaColor] = useState('#000000')
  const [chromaTolerance, setChromaTolerance] = useState(40)
  const [isPickingColor, setIsPickingColor] = useState(false)
  const audioRef = useRef(null)
  const maskInputRef = useRef(null)
  const particleCanvasRef = useRef(null)
  const [analyserData, setAnalyserData] = useState({ bass: 0, treble: 0 })
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const analyserLoopRef = useRef(null)
  const chromaHighlightCanvasRef = useRef(null)
  const [maskWarning, setMaskWarning] = useState(null)


  // 1. Audio Analyser setup for beat-reactive visual effects
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
        
        // Bass is in frequency bins 1 to 8 (20Hz - 150Hz)
        let bassSum = 0
        const bassBins = 8
        for (let i = 1; i <= bassBins; i++) {
          bassSum += dataArray[i]
        }
        const bassVal = bassSum / (bassBins * 255)

        // Treble is in higher bins 40 to 70 (1kHz - 3kHz)
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
      isPlaying = false
      if (analyserLoopRef.current) {
        cancelAnimationFrame(analyserLoopRef.current)
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close()
        } catch (e) {}
        audioContextRef.current = null
        analyserRef.current = null
        sourceRef.current = null
      }
    }
  }, [previewAudioUrl])

  // 2. Dust Particles Canvas Animation
  useEffect(() => {
    if (!particles) return
    const canvas = particleCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    let animationFrameId
    const numParticles = 25
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

  // 3. Client-side Chroma Mask highlighting visualizer on canvas
  useEffect(() => {
    if (maskMode !== 'chroma' || !bgUrl || !chromaColor || isPickingColor) {
      const canvas = chromaHighlightCanvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    const canvas = chromaHighlightCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imgData.data

      const hex = chromaColor.replace('#', '')
      const tr = parseInt(hex.substring(0, 2), 16)
      const tg = parseInt(hex.substring(2, 4), 16)
      const tb = parseInt(hex.substring(4, 6), 16)

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        
        const dist = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2)
        if (dist <= chromaTolerance) {
          data[i] = 0
          data[i + 1] = 255
          data[i + 2] = 0
          data[i + 3] = 160 // alpha
        } else {
          data[i + 3] = 0
        }
      }
      ctx.putImageData(imgData, 0, 0)
    }
    img.src = bgUrl
  }, [maskMode, bgUrl, chromaColor, chromaTolerance, isPickingColor])

  useEffect(() => {
    if (bgFile) {
      if (typeof bgFile === 'string') {
        setBgUrl(bgFile)
      } else {
        const url = URL.createObjectURL(bgFile)
        setBgUrl(url)
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
      // Adjust time for speed, trim, and offset. Note: trimStart affects the relative position of lyrics to the audio.
      const adjustedTime = Math.max(0, (timeInSec - trimStart + lyricOffset) / speed)
      
      // If we trimmed the audio, we might want to skip lyrics that fall before the trim window or after the trim window.
      // But we just render them since they are offscreen or don't trigger. 
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
      const res = await fetch(`${API}/api/generate-lyrics?audio_path=${encodeURIComponent(audioPath)}`)
      const data = await res.json()
      if (data.status === 'success') {
        setLyrics(data.lyrics)
      } else {
        alert(data.message || 'Failed to generate lyrics')
      }
    } catch (e) { console.error(e) }
    setIsGenerating(false)
  }

  const handleToggleMask = async () => {
    const newMaskState = !maskSubject
    setMaskSubject(newMaskState)
    if (newMaskState && !subjectImagePath && bgFile && maskMode === 'auto') {
      setIsGenerating(true)
      setMaskWarning(null)
      try {
        const formData = new FormData()
        formData.append('image', bgFile)
        const res = await fetch(`${API}/api/generate-mask`, { method: 'POST', body: formData })
        const data = await res.json()
        if (data.status === 'success') {
          setSubjectImagePath(data.mask_path)
          setSubjectOverlayUrl(`${API}${data.mask_url}`)
          if (data.method && data.method !== 'rembg') {
            setMaskWarning("AI subject extraction (rembg) is not installed on this system. Used a fallback center-cut mask instead. Upload a custom transparent PNG for perfect 3D lyrics.")
          }
        } else {
          alert('Failed to extract subject: ' + data.message)
          setMaskSubject(false)
        }
      } catch (e) {
        alert('Error generating subject mask.')
        setMaskSubject(false)
      }
      setIsGenerating(false)
    }
  }

  const handleGenerateChromaMask = async () => {
    if (!bgFile) return
    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append('image', bgFile)
      formData.append('target_hex', chromaColor)
      formData.append('tolerance', chromaTolerance)
      const res = await fetch(`${API}/api/generate-chroma-mask`, { method: 'POST', body: formData })
      
      if (res.status === 404) {
        alert("API Endpoint not found! Please RESTART your Python backend server so the new code takes effect.")
        setIsGenerating(false)
        return
      }

      const data = await res.json()
      if (data.status === 'success') {
        setSubjectImagePath(data.mask_path)
        setSubjectOverlayUrl(`${API}${data.mask_url}`)
        setMaskSubject(true)
      } else {
        alert('Failed to generate chroma mask: ' + (data.message || JSON.stringify(data.detail) || 'Unknown error'))
      }
    } catch (e) {
      alert('Error generating chroma mask. Make sure the backend is running.')
    }
    setIsGenerating(false)
  }

  const handleEyeDropper = async () => {
    if (!window.EyeDropper) {
      alert("Your browser does not support the EyeDropper API. Please use a Chromium-based browser (Chrome/Edge) or manually pick the color.")
      return
    }
    const eyeDropper = new EyeDropper()
    try {
      const result = await eyeDropper.open()
      setChromaColor(result.sRGBHex)
    } catch (e) {
      // user canceled
    }
  }

  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00.0'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    const ms = Math.floor((secs - Math.floor(secs)) * 10)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`
  }

  const adjustLineTime = (idx, delta) => {
    const lines = (lyrics || '').split('\n')
    let lineCounter = 0
    
    const updatedLines = lines.map(line => {
      const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/)
      if (match) {
        if (lineCounter === idx) {
          const mins = parseInt(match[1])
          const secs = parseInt(match[2])
          const ms = parseInt(match[3])
          const currentSec = mins * 60 + secs + ms / (match[3].length === 3 ? 1000 : 100)
          
          let newSec = currentSec + delta
          if (newSec < 0) newSec = 0
          
          const newMins = Math.floor(newSec / 60)
          const newSecs = Math.floor(newSec % 60)
          const newMs = Math.round((newSec - Math.floor(newSec)) * 100)
          
          const timeStr = `[${String(newMins).padStart(2, '0')}:${String(newSecs).padStart(2, '0')}.${String(newMs).padStart(2, '0')}]`
          return timeStr + match[4]
        }
        lineCounter++
      }
      return line
    })
    setLyrics(updatedLines.join('\n'))
  }

  const syncLineToPlayhead = (idx) => {
    const audio = audioRef.current
    if (!audio) return
    const playheadTime = audio.currentTime
    
    const originalSec = playheadTime * speed + trimStart - lyricOffset
    if (originalSec < 0) return

    const lines = (lyrics || '').split('\n')
    let lineCounter = 0
    
    const updatedLines = lines.map(line => {
      const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/)
      if (match) {
        if (lineCounter === idx) {
          const newMins = Math.floor(originalSec / 60)
          const newSecs = Math.floor(originalSec % 60)
          const newMs = Math.round((originalSec - Math.floor(originalSec)) * 100)
          
          const timeStr = `[${String(newMins).padStart(2, '0')}:${String(newSecs).padStart(2, '0')}.${String(newMs).padStart(2, '0')}]`
          return timeStr + match[4]
        }
        lineCounter++
      }
      return line
    })
    setLyrics(updatedLines.join('\n'))
  }

  const handlePreviewClick = (e) => {
    if (!isPickingColor || !bgFile) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const imgElement = e.currentTarget
    const nw = imgElement.naturalWidth
    const nh = imgElement.naturalHeight
    const W = rect.width
    const H = rect.height

    const imgRatio = nw / nh
    const containerRatio = W / H
    
    let renderW, renderH, offsetX, offsetY
    if (imgRatio > containerRatio) {
      renderW = W
      renderH = W / imgRatio
      offsetX = 0
      offsetY = (H - renderH) / 2
    } else {
      renderH = H
      renderW = H * imgRatio
      offsetY = 0
      offsetX = (W - renderW) / 2
    }
    
    if (clickX < offsetX || clickX > offsetX + renderW || clickY < offsetY || clickY > offsetY + renderH) {
      return // Clicked outside the image (on the letterbox)
    }
    
    const pixelX = ((clickX - offsetX) / renderW) * nw
    const pixelY = ((clickY - offsetY) / renderH) * nh

    const canvas = document.createElement('canvas')
    canvas.width = nw
    canvas.height = nh
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data
      const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(x => x.toString(16).padStart(2, '0')).join('')
      setChromaColor(hex)
      setIsPickingColor(false)
    }
    img.src = bgUrl
  }

  const handleCustomMaskUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append('mask', file)
      const res = await fetch(`${API}/api/upload-mask`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.status === 'success') {
        setSubjectImagePath(data.mask_path)
        setSubjectOverlayUrl(`${API}${data.mask_url}`)
        setMaskSubject(true)
      } else {
        alert('Failed to upload custom mask: ' + data.message)
      }
    } catch (err) {
      alert('Error uploading custom mask.')
    }
    setIsGenerating(false)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch(`${API}/api/search-lyrics?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data.status === 'success') {
        setResults(data.results.filter(r => r.syncedLyrics))
      }
    } catch (e) { console.error(e) }
    setIsSearching(false)
  }

  const [suggestedPalettes, setSuggestedPalettes] = useState(null)
  const [isSuggestingColors, setIsSuggestingColors] = useState(false)
  const [isAutoStyling, setIsAutoStyling] = useState(false)
  const [autoStyleStatus, setAutoStyleStatus] = useState(null)

  const handleAutoStyle = async () => {
    if (!bgFile) {
      alert('No background media selected. Please upload/select background artwork in Step 2 first!')
      return
    }
    setIsAutoStyling(true)
    setAutoStyleStatus(null)
    try {
      const formData = new FormData()
      formData.append('image', bgFile)
      if (aspectRatio) {
        formData.append('aspect_ratio', aspectRatio)
      }
      const res = await fetch(`${API}/api/suggest-colors`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.status === 'success' && data.data) {
        const suggestions = data.data
        const rec = suggestions.recommended_style

        if (rec) {
          if (rec.font_family) setFontFamily(rec.font_family)
          if (rec.font_size) setFontSize(rec.font_size)
          if (rec.font_color) setFontColor(rec.font_color)
          if (rec.stroke_color) setStrokeColor(rec.stroke_color)
          if (rec.stroke_width !== undefined) setStrokeWidth(rec.stroke_width)
          if (rec.shadow_offset !== undefined) setShadowOffset(rec.shadow_offset)
          if (rec.text_transform) setTextTransform(rec.text_transform)
          if (rec.glow_color) {
            setBloomColor(rec.glow_color)
            setBloomRadius(15)
          }
          if (suggestions.gradient_colors && setGradientColors && bgMode === 'gradient') {
            setGradientColors(suggestions.gradient_colors)
          }
          setAutoStyleStatus(`Auto-styled from image! Applied ${rec.font_family} (${rec.font_size}px), text ${rec.font_color}, stroke ${rec.stroke_color} (WCAG ${rec.wcag_rating}).`)
        }
        if (suggestions.palettes) {
          setSuggestedPalettes(suggestions.palettes)
        }
      } else {
        const errorMsg = data.message || (data.detail ? JSON.stringify(data.detail) : JSON.stringify(data))
        alert('Failed to auto-style: ' + errorMsg)
      }
    } catch (e) {
      console.error(e)
      alert('Network or parsing error: ' + String(e))
    }
    setIsAutoStyling(false)
  }

  const handleSuggestColors = async () => {
    if (!bgFile) {
      alert('No background image selected.')
      return
    }
    setIsSuggestingColors(true)
    try {
      const formData = new FormData()
      formData.append('image', bgFile)
      if (aspectRatio) {
        formData.append('aspect_ratio', aspectRatio)
      }
      const res = await fetch(`${API}/api/suggest-colors`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.status === 'success') {
        setSuggestedPalettes(data.data.palettes)
      } else {
        const errorMsg = data.message || data.detail ? JSON.stringify(data.detail) : JSON.stringify(data)
        alert('Failed to suggest colors: ' + errorMsg)
      }
    } catch (e) {
      console.error(e)
      alert('Network or parsing error: ' + String(e))
    }
    setIsSuggestingColors(false)
  }

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Style & Lyrics</Typography>
        <Typography color="text.secondary">Configure the visual layout, background, and synchronized lyrics for your composition.</Typography>
      </Box>

      {/* Layout Theme Toggle */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 2, border: 1, borderColor: 'primary.main', bgcolor: 'background.paper' }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Layout Theme</Typography>
        <ToggleButtonGroup
          value={layoutTheme}
          exclusive
          onChange={(e, newVal) => { if (newVal) setLayoutTheme(newVal) }}
          fullWidth
          sx={{ mb: 0 }}
        >
          <ToggleButton value="lyric_video">Lyric Video (Standard)</ToggleButton>
          <ToggleButton value="papersky">Paper Sky (Cinematic Polaroid)</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {layoutTheme === 'papersky' && (
        <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>Paper Sky Settings</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            The Paper Sky layout places your uploaded media inside a beautiful cinematic polaroid drop animation. No lyrics will be displayed.
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Background Mode</Typography>
            <Select size="small" value={paperskyBgMode} onChange={e => setPaperskyBgMode(e.target.value)}>
              <MenuItem value="memory">Memory (Generated from media)</MenuItem>
              <MenuItem value="atmosphere">Atmosphere (Premium presets)</MenuItem>
              <MenuItem value="custom">Custom Image (Upload your own)</MenuItem>
            </Select>
          </FormControl>

          {paperskyBgMode === 'atmosphere' && (
            <FormControl fullWidth sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>Atmosphere Asset</Typography>
              <Select size="small" value={paperskyAtmosphere} onChange={e => setPaperskyAtmosphere(e.target.value)}>
                <MenuItem value="Blue Hour">Blue Hour</MenuItem>
                <MenuItem value="Rain Letter">Rain Letter</MenuItem>
                <MenuItem value="Cinema Noir">Cinema Noir</MenuItem>
                <MenuItem value="Quiet Ocean">Quiet Ocean</MenuItem>
                <MenuItem value="Morning Paper">Morning Paper</MenuItem>
                <MenuItem value="Forest Echo">Forest Echo</MenuItem>
                <MenuItem value="Autumn Light">Autumn Light</MenuItem>
                <MenuItem value="Moonlight">Moonlight</MenuItem>
              </Select>
            </FormControl>
          )}

          {paperskyBgMode === 'custom' && (
            <FormControl fullWidth sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>Custom Background Image</Typography>
              <Button variant="outlined" component="label" sx={{ justifyContent: 'flex-start' }}>
                {paperskyCustomBgFile ? paperskyCustomBgFile.name : 'Upload Background Image...'}
                <input type="file" hidden accept="image/*" onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setPaperskyCustomBgFile(e.target.files[0])
                    setPaperskyCustomBgUrl(URL.createObjectURL(e.target.files[0]))
                  }
                }} />
              </Button>
            </FormControl>
          )}

          <FormControl fullWidth sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Polaroid Typography</Typography>
            <Select size="small" value={paperskyFont || 'Pacifico'} onChange={e => setPaperskyFont(e.target.value)}>
              <MenuItem value="Pacifico">Genty (Premium Retro Script)</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Font Size</Typography>
            <Slider 
              value={paperskyFontSize || 42} 
              onChange={(_, val) => setPaperskyFontSize(val)} 
              min={20} max={100} 
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Font Color</Typography>
            <input type="color" value={paperskyFontColor || '#F6F4EF'} onChange={e => setPaperskyFontColor(e.target.value)} style={{ width: '100%', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
          </Box>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Placement</Typography>
            <Select size="small" value={paperskyPlacement || 'bottom-center'} onChange={e => setPaperskyPlacement(e.target.value)}>
              <MenuItem value="bottom-left">Bottom Left</MenuItem>
              <MenuItem value="bottom-center">Bottom Center</MenuItem>
              <MenuItem value="top-left">Top Left</MenuItem>
              <MenuItem value="top-center">Top Center</MenuItem>
              <MenuItem value="center">Center</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Song Title</Typography>
            <TextField 
              size="small" 
              value={songTitle} 
              onChange={e => setSongTitle(e.target.value)} 
              placeholder="e.g. Skyfall"
            />
          </FormControl>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Polaroid Caption (Bottom White Space)</Typography>
            <TextField 
              size="small" 
              value={paperskyCaption} 
              onChange={e => setPaperskyCaption(e.target.value)} 
              placeholder="e.g. Nostalgia"
            />
          </FormControl>
        </Paper>
      )}

      <>

      {isPreviewing && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: "primary.main", bgcolor: "background.paper", borderRadius: 2 }}>
          <Typography variant="subtitle2" color="primary" fontWeight="bold" gutterBottom>
            🔄 Synthesizing fresh audio to match your mastering parameters...
          </Typography>
          <LinearProgress variant="determinate" value={previewProgress} sx={{ height: 8, borderRadius: 4, mb: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {STAGE_LABELS[previewStage] || 'Processing...'} {previewProgress}%
          </Typography>
        </Paper>
      )}

      {speed != 1.0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Timestamps auto-adjusted to match your <strong> {speed}x </strong> speed. Preview below to verify sync.
        </Alert>
      )}

      {!previewAudioUrl && layoutTheme !== 'papersky' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          To preview lyrics sync, go back to Step 2 and render an audio preview first.
        </Alert>
      )}

      {/* Audio + Lyrics Sync Preview (Moved to Top) */}
      {((previewAudioUrl && parsedLines.length > 0) || layoutTheme === 'papersky') && (
        <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={3}>
            Live Preview
          </Typography>
          
          <Box mb={3} p={2} bgcolor="background.default" borderRadius={2} border={1} borderColor="divider">
            <audio ref={audioRef} controls src={previewAudioUrl} style={{width: '100%', height: 40, pointerEvents: isPreviewing ? 'none' : 'auto', opacity: isPreviewing ? 0.5 : 1}} />
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

          <Box sx={{
            display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
            borderRadius: 2, background: '#000', mx: 'auto', border: 1, borderColor: 'divider',
            containerType: 'size',
            ...(aspectRatio === '9:16'
              ? { height: 500, aspectRatio: '9 / 16', maxWidth: '100%' }
              : { width: '100%', aspectRatio: '16 / 9', maxHeight: 460 })
          }}>
            {isPreviewing && (
              <Box position="absolute" inset={0} bgcolor="rgba(0,0,0,0.85)" display="flex" flexDirection="column" alignItems="center" justifyContent="center" zIndex={100} gap={1.5}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="primary" fontWeight="bold">Synthesizing audio effects...</Typography>
                <Typography variant="caption" color="text.secondary">Step 4 sync will load shortly</Typography>
              </Box>
            )}

            {isPickingColor && (
              <Box position="absolute" top={0} left={0} right={0} bgcolor="rgba(0,0,0,0.7)" color="white" p={1} zIndex={50} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Crosshair mode: Click anywhere on the background to pick a color</Typography>
                <Button size="small" variant="contained" color="error" onClick={() => setIsPickingColor(false)}>Cancel</Button>
              </Box>
            )}

            {/* Content wrapper that shakes and bounces to audio peaks */}
            <Box sx={{
              position: 'absolute', inset: 0,
              transform: `translate(${beatShake ? (Math.random() - 0.5) * analyserData.bass * 16 : 0}px, ${beatShake ? (Math.random() - 0.5) * analyserData.bass * 16 : 0}px) scale(${beatBounce ? (1 + analyserData.bass * 0.04) : 1})`,
              transformOrigin: 'center',
              width: '100%', height: '100%',
              transition: 'transform 0.05s ease-out'
            }}>
              <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 10, bgcolor: 'rgba(0,0,0,0.6)', px: 1.5, py: 0.5, borderRadius: 1, backdropFilter: 'blur(4px)' }}>
                <Typography variant="caption" color="white" fontWeight="bold">Visual Layout Preview · {aspectRatio}</Typography>
              </Box>
              
              {/* Chosen gradient background (overrides the image when picked) */}
              {bgMode === 'gradient' && gradientColors && (
                <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${gradientColors.join(', ')})` }} />
              )}

              {/* Background Media */}
              {bgUrl && !(bgMode === 'gradient' && gradientColors) && (() => {
                if (layoutTheme === 'papersky') {
                  if (paperskyBgMode === 'atmosphere') {
                     const mapping = {
                        "Blue Hour": "bg_02.jpg", "Rain Letter": "bg_03.jpg",
                        "Cinema Noir": "bg_04.jpg", "Quiet Ocean": "bg_05.jpg",
                        "Morning Paper": "bg_07.jpg", "Forest Echo": "bg_08.jpg",
                        "Autumn Light": "bg_10.jpg", "Moonlight": "bg_11.jpg"
                     }
                     const asset = mapping[paperskyAtmosphere] || "bg_02.jpg"
                     return <img src={`${API}/assets/backgrounds/${asset}`} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
                  } else if (paperskyBgMode === 'custom' && paperskyCustomBgUrl) {
                     return <img src={paperskyCustomBgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
                  } else {
                     const isVid = bgFile?.type?.startsWith('video/')
                     const mediaStyle = { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, filter: 'blur(25px)', transform: 'scale(1.1)', zIndex: 1 }
                     return isVid
                       ? <video src={bgUrl} autoPlay loop muted style={mediaStyle} onClick={handlePreviewClick} />
                       : <img src={bgUrl} style={mediaStyle} onClick={handlePreviewClick} />
                  }
                }
                const isVid = bgFile?.type?.startsWith('video/')
                const blurPx = isPickingColor ? 0 : (bgMode === 'gradient' ? 45 : bgBlur * 0.45)
                const baseScale = isPickingColor ? 1 : (kenBurns ? 1 : 1 + Math.min(blurPx / 40, 0.5))
                const mediaStyle = {
                  width: '100%', height: '100%', objectFit: 'cover',
                  position: 'absolute', top: 0, left: 0,
                  filter: blurPx > 0 ? `blur(${blurPx}px)` : 'none',
                  transform: `scale(${baseScale})`,
                  transformOrigin: 'center',
                  transition: kenBurns ? 'transform 20s ease-in-out' : 'none',
                  cursor: isPickingColor ? 'crosshair' : 'default',
                  zIndex: 1
                }
                return isVid
                  ? <video src={bgUrl} autoPlay loop muted style={mediaStyle} onClick={handlePreviewClick} />
                  : <img src={bgUrl} style={mediaStyle} onClick={handlePreviewClick} />
              })()}

              {/* Overlays (Hidden during color pick) */}
              {!isPickingColor && bgDim > 0 && <Box sx={{position: 'absolute', inset: 0, bgcolor: 'black', opacity: bgDim, zIndex: 2}} />}
              {!isPickingColor && grain > 0 && <Box sx={{
                position: 'absolute', inset: 0, mixBlendMode: 'overlay', zIndex: 3,
                opacity: Math.min(grain / 30 * 0.65, 0.65),
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
              }} />}
              {!isPickingColor && vignette > 0 && <Box sx={{
                position: 'absolute', inset: 0, zIndex: 4,
                background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${vignette}) 100%)`
              }} />}

              {/* Floating particles canvas layer */}
              {particles && (
                <canvas ref={particleCanvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6, width: '100%', height: '100%' }} />
              )}

              {/* Chroma Key highlight canvas overlay */}
              {maskMode === 'chroma' && !isPickingColor && (
                <canvas ref={chromaHighlightCanvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9, width: '100%', height: '100%', objectFit: 'cover' }} />
              )}

              {/* Visual Safe Area & Coordinate Mapping (Hidden during color pick) */}
              {!isPickingColor && (
                <Box sx={{position: 'absolute', inset: 0, zIndex: 5}}>
                  {layoutTheme === 'papersky' ? (
                    <Box sx={{
                      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                      width: '65%', aspectRatio: '800/960', bgcolor: '#FCFAF6',
                      borderRadius: '3%', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 10,
                      overflow: 'hidden'
                    }}>
                       <Box sx={{ 
                         position: 'absolute', top: '5.2%', left: '6.25%', width: '87.5%', height: '72.9%',
                         bgcolor: '#111', borderRadius: '2%', border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden' 
                       }}>
                         {bgUrl && (() => {
                           const isVid = bgFile?.type?.startsWith('video/')
                           return isVid 
                             ? <video src={bgUrl} autoPlay loop muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                             : <img src={bgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                         })()}
                         
                         {/* Text overlay INSIDE the image */}
                         <Box sx={{
                           position: 'absolute', 
                           inset: 0,
                           p: '8%',
                           display: 'flex', 
                           flexDirection: 'column', 
                           alignItems: paperskyPlacement?.includes('left') ? 'flex-start' : 'center', 
                           justifyContent: paperskyPlacement?.includes('top') ? 'flex-start' : paperskyPlacement === 'center' ? 'center' : 'flex-end',
                           textShadow: '0 4px 12px rgba(0,0,0,0.4)',
                           opacity: 0.95
                         }}>
                           <Typography variant="body1" sx={{ 
                             textAlign: paperskyPlacement?.includes('left') ? 'left' : 'center', 
                             fontFamily: "'Pacifico', cursive",
                             fontSize: `${(paperskyFontSize || 42) * 0.13}cqi`, 
                             lineHeight: 1.1, fontWeight: 500, 
                             letterSpacing: '0.02em',
                             color: paperskyFontColor || '#F6F4EF'
                           }}>
                             {songTitle || 'Song Title'}
                           </Typography>
                         </Box>
                       </Box>
                       <Box sx={{
                         position: 'absolute', top: '78.1%', left: 0, width: '100%', height: '21.9%',
                         display: 'flex', alignItems: 'center', justifyContent: 'center', px: '8%'
                       }}>
                         <Typography variant="body1" sx={{ 
                           textAlign: 'center', 
                           fontFamily: "'Kalam', cursive",
                           fontSize: '5.5cqi', lineHeight: 1.1, fontWeight: 400, 
                           letterSpacing: '0.08em',
                           color: (() => {
                             switch (paperskyAtmosphere) {
                               case 'Blue Hour': case 'Rain Letter': case 'Quiet Ocean': return '#596D8A'
                               case 'Forest Echo': return '#6B7464'
                               case 'Autumn Light': return '#6A5147'
                               case 'Moonlight': return '#756C83'
                               case 'Cinema Noir': return '#3B3B3B'
                               default: return '#44423E'
                             }
                           })()
                         }}>
                           {paperskyCaption}
                         </Typography>
                       </Box>
                    </Box>
                  ) : parsedLines.length > 0 && (
                    <Box sx={{
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
                        const effectiveLineIdx = currentLineIdx < 0 ? 0 : currentLineIdx
                        const lineIdx = effectiveLineIdx + offset
                        if (lineIdx < 0 || lineIdx >= parsedLines.length) return null
                        const line = parsedLines[lineIdx]
                        const isCAActive = chromaticAberration && analyserData.bass > 0.15
                        const caShift = isCAActive ? analyserData.bass * 10 : 0
                        
                        return (
                          <Box 
                            key={lineIdx} 
                            className={offset === 0 && lyricPreset === 'line-pop' ? 'kinetic-lyric-active' : ''}
                             sx={{
                              fontSize: offset === 0 ? `${fontSize / 10.8}cqh` : `${(fontSize * 0.75) / 10.8}cqh`,
                              fontWeight: 700,
                              color: offset === 0 ? fontColor : 'rgba(255,255,255,0.4)',
                              textTransform: textTransform,
                              transition: 'all 0.3s ease',
                              fontFamily: fontFamily === 'Montserrat' ? "'Montserrat', sans-serif" : `"${fontFamily}", sans-serif`,
                              textShadow: offset === 0 ? (
                                [
                                  isCAActive ? `-${caShift}px 0 0 rgba(255,0,0,0.65), ${caShift}px 0 0 rgba(0,255,255,0.65)` : null,
                                  strokeWidth > 0 ? `-${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, -${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}` : null,
                                  shadowOffset > 0 ? `${shadowOffset}px ${shadowOffset}px ${Math.max(2, shadowOffset)}px rgba(0,0,0,0.8)` : null,
                                  bloomRadius > 0 && bloomColor ? `0 0 ${bloomRadius}px ${bloomColor}, 0 0 ${bloomRadius * 1.5}px ${bloomColor}` : null
                                ].filter(Boolean).join(', ') || 'none'
                              ) : 'none'
                            }}
                          >
                            {line.text}
                          </Box>
                        )
                      })}
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Subject Mask Overlay (3D Depth Rotoscope) */}
              {!isPickingColor && maskSubject && subjectOverlayUrl && (
                <img src={subjectOverlayUrl} style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                  objectFit: 'cover', pointerEvents: 'none', zIndex: 10,
                  filter: kenBurns ? 'none' : (bgBlur > 0 ? `blur(${bgBlur * 0.45}px)` : 'none'),
                  transform: kenBurns ? 'scale(1)' : `scale(${1 + Math.min((bgBlur * 0.45) / 40, 0.5)})`,
                  transformOrigin: 'center'
                }} />
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {previewAudioUrl && parsedLines.length === 0 && lyrics && (
        <Alert severity="error" sx={{ mb: 3 }}>
          No valid timestamps found in your lyrics. Make sure each line starts with [mm:ss.xx] format.
        </Alert>
      )}

      {/* Timing Fine-Tuning Panel */}
      {parsedLines.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
            ⏱️ Line-by-Line Timing Fine-Tuning
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Fine-tune each line's entry time. Click ⏱️ to set the line's start time to the current audio position.
          </Typography>
          <Box sx={{ maxHeight: 220, overflowY: 'auto', bgcolor: 'background.default', p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
            <Grid container spacing={1}>
              {parsedLines.map((line, idx) => {
                const isActive = idx === currentLineIdx
                return (
                  <Grid item xs={12} key={idx} sx={{ display: 'flex', alignItems: 'center', py: 0.5, px: 1, borderRadius: 1, bgcolor: isActive ? 'rgba(255,122,0,0.08)' : 'transparent', border: isActive ? '1px solid rgba(255,122,0,0.2)' : '1px solid transparent', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', minWidth: 60 }}>
                      [{formatTime(line.time)}]
                    </Typography>
                    <Typography variant="body2" sx={{ ml: 1, flexGrow: 1, fontWeight: isActive ? 'bold' : 'normal', color: isActive ? 'primary.main' : 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {line.text}
                    </Typography>
                    <Box display="flex" gap={0.5}>
                      <Button size="small" variant="outlined" onClick={() => adjustLineTime(idx, -0.1)} sx={{ minWidth: 40, py: 0.2, px: 0.5, fontSize: '0.7rem', color: 'text.secondary', borderColor: 'divider' }}>-0.1s</Button>
                      <Button size="small" variant="outlined" onClick={() => adjustLineTime(idx, 0.1)} sx={{ minWidth: 40, py: 0.2, px: 0.5, fontSize: '0.7rem', color: 'text.secondary', borderColor: 'divider' }}>+0.1s</Button>
                      <Button 
                        size="small" 
                        variant="contained" 
                        color="secondary" 
                        onClick={() => syncLineToPlayhead(idx)} 
                        title="Sync to current playhead"
                        sx={{ minWidth: 32, p: 0.5, fontSize: '0.75rem' }}
                      >
                        ⏱️
                      </Button>
                    </Box>
                  </Grid>
                )
              })}
            </Grid>
          </Box>
        </Paper>
      )}

      {/* Editor */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
          Lyrics Editor
        </Typography>
        <TextField 
          multiline
          rows={6}
          fullWidth
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder="[00:00.00] Paste your synced lyrics here..."
          InputProps={{ sx: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', lineHeight: 1.8 } }}
        />
      </Paper>

      {/* Typography Controls */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" borderBottom={1} borderColor="divider" pb={1} mb={3}>
          <Typography variant="subtitle1" fontWeight="bold">
            Typography Settings
          </Typography>
          <Button
            variant="contained"
            onClick={handleAutoStyle}
            disabled={isAutoStyling}
            startIcon={isAutoStyling ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{
              fontWeight: 'bold',
              textTransform: 'none',
              borderRadius: 2,
              px: 2.5,
              py: 0.8,
              background: 'linear-gradient(135deg, #FF7A00 0%, #FF0055 100%)',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(255, 122, 0, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #E66E00 0%, #E6004C 100%)',
                boxShadow: '0 6px 18px rgba(255, 122, 0, 0.6)',
              }
            }}
          >
            {isAutoStyling ? 'Analyzing Artwork...' : '✨ Auto-Style from Image'}
          </Button>
        </Box>

        {autoStyleStatus && (
          <Alert severity="success" onClose={() => setAutoStyleStatus(null)} sx={{ mb: 3 }}>
            {autoStyleStatus}
          </Alert>
        )}

        <Box mb={4}>
          <Typography variant="body2" color="text.secondary" gutterBottom>Font Presets</Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            {FONT_PRESETS.map(p => (
              <Chip
                key={p.name}
                label={p.name}
                clickable
                color={activeFont === p.name ? 'primary' : 'default'}
                variant={activeFont === p.name ? 'filled' : 'outlined'}
                onClick={() => applyFontPreset(p)}
              />
            ))}
          </Box>
        </Box>

        <Box mb={4}>
          <Typography variant="body2" color="text.secondary" gutterBottom>Lyric Display Style</Typography>
          <ToggleButtonGroup
            value={lyricStyle}
            exclusive
            onChange={(e, val) => val && setLyricStyle(val)}
            fullWidth
            size="small"
          >
            <ToggleButton value="single">Single Line (Classic)</ToggleButton>
            <ToggleButton value="stack">3-Line Stack (Karaoke)</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box mb={4}>
          <Typography variant="body2" color="text.secondary" gutterBottom>Animation Preset (Remotion Only)</Typography>
          <ToggleButtonGroup
            value={lyricPreset}
            exclusive
            onChange={(e, val) => val && setLyricPreset(val)}
            fullWidth
            size="small"
          >
            <ToggleButton value="line-pop">Line Pop (Instant)</ToggleButton>
            <ToggleButton value="word-stagger">Word Stagger</ToggleButton>
            <ToggleButton value="fade-up">Fade Up</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box mb={4} p={2} border={1} borderColor="primary.main" borderRadius={2} bgcolor="rgba(255,122,0,0.05)">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="subtitle2" color="primary" fontWeight="bold">Spotify Canvas Mode</Typography>
              <Typography variant="caption" color="text.secondary">Forces 9:16, 8s duration, and hides lyrics</Typography>
            </Box>
            <Button 
              variant={canvasMode ? "contained" : "outlined"} 
              color="primary" 
              onClick={() => setCanvasMode(!canvasMode)}
            >
              {canvasMode ? 'Enabled' : 'Enable Canvas Mode'}
            </Button>
          </Box>
        </Box>


        
        <Box mb={4} p={2} border={1} borderColor="divider" borderRadius={2} bgcolor="background.default">
          <Typography variant="body2" color="text.secondary" gutterBottom>Lyric Delay / Offset</Typography>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="caption" color="text.secondary">Shift lyrics backward or forward in time</Typography>
            <Typography variant="body2" fontWeight="bold">{lyricOffset > 0 ? '+' : ''}{lyricOffset}s</Typography>
          </Box>
          <Slider 
            min={-5.0} max={5.0} step={0.1} 
            value={lyricOffset} 
            onChange={(e, val) => setLyricOffset(val)} 
            marks={[{value: 0, label: '0s'}]}
          />
        </Box>

        <Grid container spacing={4} mb={4}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Font Family</InputLabel>
              <Select value={fontFamily} label="Font Family" onChange={(e) => setFontFamily(e.target.value)}>
                <MenuItem value="Montserrat">Montserrat (Modern / Default)</MenuItem>
                <MenuItem value="Avenir Next">Avenir Next (Clean / 7clouds)</MenuItem>
                <MenuItem value="Futura">Futura (Edgy / Trap Nation)</MenuItem>
                <MenuItem value="Didot">Didot (High-Fashion / Whitewine)</MenuItem>
                <MenuItem value="Baskerville">Baskerville (Classic / Jaded)</MenuItem>
                <MenuItem value="Helvetica Neue">Helvetica Neue (Clean UI)</MenuItem>
                <MenuItem value="Arial">Arial (Basic)</MenuItem>
                <MenuItem value="Impact">Impact (Meme)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Font Size</Typography>
              <Typography variant="body2" fontWeight="bold">{fontSize}px</Typography>
            </Box>
            <Slider min={20} max={150} value={fontSize} onChange={(e, val) => setFontSize(val)} />
          </Grid>
        </Grid>
        
        <Box mb={4} p={2} border={1} borderColor={showIntro ? "primary.main" : "divider"} borderRadius={2} bgcolor={showIntro ? "rgba(255,122,0,0.05)" : "background.default"}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="subtitle2" color={showIntro ? "primary" : "text.primary"} fontWeight="bold">Show Intro Title Screen</Typography>
              <Typography variant="caption" color="text.secondary">Displays the song title for the first few seconds (Best for YouTube)</Typography>
            </Box>
            <Button 
              variant={showIntro ? "contained" : "outlined"} 
              color="primary" 
              onClick={() => setShowIntro(!showIntro)}
            >
              {showIntro ? 'Enabled' : 'Enable Intro'}
            </Button>
          </Box>
          {showIntro && (
            <TextField 
              fullWidth
              label="Song Title for Intro"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              size="small"
              sx={{ mt: 1 }}
            />
          )}
        </Box>

        <Box mb={4} p={2} border={1} borderColor={introMode !== 'none' ? "primary.main" : "divider"} borderRadius={2} bgcolor={introMode !== 'none' ? "rgba(255,122,0,0.05)" : "background.default"}>
          <Box mb={2}>
            <Typography variant="subtitle2" color={introMode !== 'none' ? "primary" : "text.primary"} fontWeight="bold">Intro Video Animation</Typography>
            <Typography variant="caption" color="text.secondary">Overlay a premium intro scene (e.g. Polaroid Card animation) at the start</Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Intro Animation Style</InputLabel>
                <Select
                  value={introMode}
                  onChange={(e) => setIntroMode(e.target.value)}
                  label="Intro Animation Style"
                >
                  <MenuItem value="none">None</MenuItem>
                  <MenuItem value="papersky">Polaroid Intro (PaperSky)</MenuItem>
                  <MenuItem value="custom">Custom Intro Upload</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {introMode === 'papersky' && (
              <Grid item xs={12} sm={6}>
                <TextField 
                  fullWidth
                  label="Polaroid Card Text"
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  size="small"
                  placeholder="e.g. Custom Polaroid Text"
                />
              </Grid>
            )}
            {introMode === 'custom' && (
              <Grid item xs={12} sm={6}>
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                  size="small"
                  sx={{ height: '40px' }}
                >
                  {introVideoFile ? introVideoFile.name : 'Upload Custom Video (.mp4)'}
                  <input
                    type="file"
                    accept="video/mp4"
                    hidden
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setIntroVideoFile(e.target.files[0])
                      }
                    }}
                  />
                </Button>
              </Grid>
            )}
          </Grid>
        </Box>

        <Grid container spacing={4} mb={4}>
          <Grid item xs={12} sm={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Position X</Typography>
              <Typography variant="body2" fontWeight="bold">{posX}%</Typography>
            </Box>
            <Slider min={0} max={100} value={posX} onChange={(e, val) => setPosX(val)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Position Y</Typography>
              <Typography variant="body2" fontWeight="bold">{posY}%</Typography>
            </Box>
            <Slider min={0} max={100} value={posY} onChange={(e, val) => setPosY(val)} />
          </Grid>
        </Grid>

        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="body2" color="text.secondary" fontWeight="bold">Magic Color Suggester (AI)</Typography>
              <Box display="flex" gap={1.5}>
                <Button size="small" variant="contained" color="secondary" onClick={handleAutoStyle} disabled={isAutoStyling}>
                  {isAutoStyling ? <CircularProgress size={18} /> : '✨ Auto-Style 1-Click'}
                </Button>
                <Button size="small" variant="outlined" color="primary" onClick={handleSuggestColors} disabled={isSuggestingColors}>
                  {isSuggestingColors ? <CircularProgress size={18} /> : 'Suggest Palettes'}
                </Button>
              </Box>
            </Box>
            {suggestedPalettes && (
              <Box display="flex" gap={1.5} flexWrap="wrap" mb={2}>
                {suggestedPalettes.map(p => (
                  <Chip 
                    key={p.name}
                    label={`${p.name}${p.wcag_rating ? ` (${p.wcag_rating})` : ''}`}
                    onClick={() => { setFontColor(p.font_color); setStrokeColor(p.stroke_color); setBloomColor(p.glow_color || p.stroke_color); setBloomRadius(15) }}
                    sx={{ bgcolor: p.font_color, color: p.stroke_color, fontWeight: 'bold', border: `2px solid ${p.stroke_color}`, cursor: 'pointer' }}
                  />
                ))}
              </Box>
            )}
          </Grid>
          <Grid item xs={6} sm={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>Text</Typography>
            <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} style={{ width: '100%', height: 42, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
          </Grid>
          <Grid item xs={6} sm={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>Stroke</Typography>
            <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} style={{ width: '100%', height: 42, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>Glow Color</Typography>
            <input type="color" value={bloomColor} onChange={(e) => setBloomColor(e.target.value)} style={{ width: '100%', height: 42, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Glow Radius (Bloom)</Typography>
              <Typography variant="body2" fontWeight="bold">{bloomRadius}px</Typography>
            </Box>
            <Slider min={0} max={40} value={bloomRadius} onChange={(e, val) => setBloomRadius(val)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Stroke Width</Typography>
              <Typography variant="body2" fontWeight="bold">{strokeWidth}px</Typography>
            </Box>
            <Slider min={0} max={10} value={strokeWidth} onChange={(e, val) => setStrokeWidth(val)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Shadow Offset</Typography>
              <Typography variant="body2" fontWeight="bold">{shadowOffset}px</Typography>
            </Box>
            <Slider min={0} max={20} value={shadowOffset} onChange={(e, val) => setShadowOffset(val)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Format</InputLabel>
              <Select value={textTransform} label="Format" onChange={(e) => setTextTransform(e.target.value)}>
                <MenuItem value="uppercase">ALL CAPS</MenuItem>
                <MenuItem value="none">Normal</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        {layoutTheme !== 'papersky' && (
          <>
            <Grid container spacing={4} mb={4}>
              <Grid item xs={12} sm={6}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Position X</Typography>
                  <Typography variant="body2" fontWeight="bold">{posX}%</Typography>
                </Box>
                <Slider min={0} max={100} value={posX} onChange={(e, val) => setPosX(val)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Position Y</Typography>
                  <Typography variant="body2" fontWeight="bold">{posY}%</Typography>
                </Box>
                <Slider min={0} max={100} value={posY} onChange={(e, val) => setPosY(val)} />
              </Grid>
            </Grid>

            <Grid container spacing={4}>
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold">Magic Color Suggester (AI)</Typography>
                  <Box display="flex" gap={1.5}>
                    <Button size="small" variant="contained" color="secondary" onClick={handleAutoStyle} disabled={isAutoStyling}>
                      {isAutoStyling ? <CircularProgress size={18} /> : '✨ Auto-Style 1-Click'}
                    </Button>
                    <Button size="small" variant="outlined" color="primary" onClick={handleSuggestColors} disabled={isSuggestingColors}>
                      {isSuggestingColors ? <CircularProgress size={18} /> : 'Suggest Palettes'}
                    </Button>
                  </Box>
                </Box>
                {suggestedPalettes && (
                  <Box display="flex" gap={1.5} flexWrap="wrap" mb={2}>
                    {suggestedPalettes.map(p => (
                      <Chip 
                        key={p.name}
                        label={`${p.name}${p.wcag_rating ? ` (${p.wcag_rating})` : ''}`}
                        onClick={() => { setFontColor(p.font_color); setStrokeColor(p.stroke_color); setBloomColor(p.glow_color || p.stroke_color); setBloomRadius(15) }}
                        sx={{ bgcolor: p.font_color, color: p.stroke_color, fontWeight: 'bold', border: `2px solid ${p.stroke_color}`, cursor: 'pointer' }}
                      />
                    ))}
                  </Box>
                )}
              </Grid>
              <Grid item xs={6} sm={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>Text</Typography>
                <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} style={{ width: '100%', height: 42, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>Stroke</Typography>
                <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} style={{ width: '100%', height: 42, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>Glow Color</Typography>
                <input type="color" value={bloomColor} onChange={(e) => setBloomColor(e.target.value)} style={{ width: '100%', height: 42, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Glow Radius (Bloom)</Typography>
                  <Typography variant="body2" fontWeight="bold">{bloomRadius}px</Typography>
                </Box>
                <Slider min={0} max={40} value={bloomRadius} onChange={(e, val) => setBloomRadius(val)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Stroke Width</Typography>
                  <Typography variant="body2" fontWeight="bold">{strokeWidth}px</Typography>
                </Box>
                <Slider min={0} max={10} value={strokeWidth} onChange={(e, val) => setStrokeWidth(val)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Shadow Offset</Typography>
                  <Typography variant="body2" fontWeight="bold">{shadowOffset}px</Typography>
                </Box>
                <Slider min={0} max={20} value={shadowOffset} onChange={(e, val) => setShadowOffset(val)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Format</InputLabel>
                  <Select value={textTransform} label="Format" onChange={(e) => setTextTransform(e.target.value)}>
                    <MenuItem value="uppercase">ALL CAPS</MenuItem>
                    <MenuItem value="none">Normal</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </>
        )}
      </Paper>

      {/* Background Style */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={3}>
          Background Style
        </Typography>

        <Box mb={4}>
          <Typography variant="body2" color="text.secondary" gutterBottom>Background Source</Typography>
          <ToggleButtonGroup
            value={bgMode}
            exclusive
            onChange={(e, val) => val && setBgMode(val)}
            fullWidth
            size="small"
          >
            <ToggleButton value="image">Your Image/Video</ToggleButton>
            <ToggleButton value="gradient">Color Gradient</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {bgMode === 'gradient' && (
          <Box mb={4}>
            <Typography variant="body2" color="text.secondary" gutterBottom>Gradient Colour</Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip
                label="Auto (from image)"
                clickable
                color={!gradientColors ? 'primary' : 'default'}
                variant={!gradientColors ? 'filled' : 'outlined'}
                onClick={() => setGradientColors(null)}
              />
              {BG_GRADIENTS.map(g => (
                <Chip
                  key={g.name}
                  label={g.name}
                  clickable
                  variant={activeGradient === g.name ? 'filled' : 'outlined'}
                  onClick={() => setGradientColors(g.colors)}
                  sx={{
                    fontWeight: 600,
                    color: activeGradient === g.name ? '#fff' : 'text.primary',
                    borderWidth: activeGradient === g.name ? 2 : 1,
                    borderColor: activeGradient === g.name ? '#fff' : 'divider',
                    background: `linear-gradient(135deg, ${g.colors.join(', ')})`,
                    '&:hover': { background: `linear-gradient(135deg, ${g.colors.join(', ')})`, opacity: 0.9 }
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        <Grid container spacing={4} mb={4}>
          <Grid item xs={12} sm={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Blur</Typography>
              <Typography variant="body2" fontWeight="bold">{bgBlur}</Typography>
            </Box>
            <Slider min={0} max={40} value={bgBlur} onChange={(e, val) => setBgBlur(val)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Darken</Typography>
              <Typography variant="body2" fontWeight="bold">{Math.round(bgDim * 100)}%</Typography>
            </Box>
            <Slider min={0} max={0.6} step={0.05} value={bgDim} onChange={(e, val) => setBgDim(val)} />
          </Grid>
        </Grid>

        <Grid container spacing={4} mb={4}>
          <Grid item xs={12} sm={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Film Grain</Typography>
              <Typography variant="body2" fontWeight="bold">{grain}</Typography>
            </Box>
            <Slider min={0} max={30} value={grain} onChange={(e, val) => setGrain(val)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Vignette</Typography>
              <Typography variant="body2" fontWeight="bold">{Math.round(vignette * 100)}%</Typography>
            </Box>
            <Slider min={0} max={1} step={0.05} value={vignette} onChange={(e, val) => setVignette(val)} />
          </Grid>
        </Grid>

        <Box mt={2} p={2} bgcolor="background.default" borderRadius={2} border={1} borderColor="divider" display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">Ken Burns — slow zoom on still images</Typography>
          <ToggleButton
            value="check"
            selected={kenBurns}
            onChange={() => setKenBurns(!kenBurns)}
            size="small"
            color="primary"
          >
            {kenBurns ? 'Enabled' : 'Disabled'}
          </ToggleButton>
        </Box>

        <Box mt={2} p={2} bgcolor="background.default" borderRadius={2} border={1} borderColor="divider" display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">Beat Bounce — background dances to the music</Typography>
          <ToggleButton
            value="check"
            selected={beatBounce}
            onChange={() => setBeatBounce(!beatBounce)}
            size="small"
            color="primary"
          >
            {beatBounce ? 'Enabled' : 'Disabled'}
          </ToggleButton>
        </Box>

        <Box mt={2} p={2} bgcolor="background.default" borderRadius={2} border={1} borderColor="divider" display="flex" justifyContent="space-between" alignItems="center">
          <Box>
             <Typography variant="body2">Camera Shake & Aberration</Typography>
             <Typography variant="caption" color="text.secondary">Screen shakes and RGB splits on heavy bass hits</Typography>
          </Box>
          <Box display="flex" gap={1}>
             <ToggleButton value="check" selected={beatShake} onChange={() => setBeatShake(!beatShake)} size="small" color="primary">Shake {beatShake ? 'On' : 'Off'}</ToggleButton>
             <ToggleButton value="check" selected={chromaticAberration} onChange={() => setChromaticAberration(!chromaticAberration)} size="small" color="primary">Aberration {chromaticAberration ? 'On' : 'Off'}</ToggleButton>
          </Box>
        </Box>

        <Box mt={2} p={2} bgcolor="background.default" borderRadius={2} border={1} borderColor="divider" display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">Dust Particles — floating atmospheric particles</Typography>
          <ToggleButton
            value="check"
            selected={particles}
            onChange={() => setParticles(!particles)}
            size="small"
            color="primary"
          >
            {particles ? 'Enabled' : 'Disabled'}
          </ToggleButton>
        </Box>

        <Box mt={2} p={2} bgcolor="background.default" borderRadius={2} border={1} borderColor="divider">
          {maskWarning && (
            <Alert severity="warning" onClose={() => setMaskWarning(null)} sx={{ mb: 2 }}>
              {maskWarning}
            </Alert>
          )}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Box>
              <Typography variant="body2" color="primary" fontWeight="bold">3D Depth Rotoscope (Text Behind Subject)</Typography>
              <Typography variant="caption" color="text.secondary" display="block">Mask parts of the background to place lyrics behind them</Typography>
            </Box>
            <ToggleButton value="check" selected={maskSubject} onChange={handleToggleMask} size="small" color="primary" disabled={isGenerating}>
              {maskSubject ? 'Masking On' : 'Masking Off'}
            </ToggleButton>
          </Box>
          
          <Box display="flex" gap={2} mt={2} mb={2}>
            <ToggleButtonGroup size="small" value={maskMode} exclusive onChange={(e, v) => v && setMaskMode(v)} color="primary">
              <ToggleButton value="auto">Auto AI Subject</ToggleButton>
              <ToggleButton value="chroma">Chroma Key (Color)</ToggleButton>
            </ToggleButtonGroup>
            
            <input type="file" accept="image/png" style={{ display: 'none' }} ref={maskInputRef} onChange={handleCustomMaskUpload} />
            <Button size="small" variant="outlined" onClick={() => maskInputRef.current.click()} disabled={isGenerating}>
              Upload Custom PNG
            </Button>
          </Box>
          
          {maskMode === 'chroma' && (
            <Box display="flex" gap={2} alignItems="center" bgcolor="background.paper" p={1.5} borderRadius={1} border={1} borderColor="divider">
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Color to Hide</Typography>
                <Box display="flex" gap={1} alignItems="center">
                  <input type="color" value={chromaColor} onChange={e => setChromaColor(e.target.value)} style={{ width: 40, height: 40, padding: 0, border: 'none', cursor: 'pointer' }} />
                  <Button size="small" variant="outlined" color={isPickingColor ? "secondary" : "primary"} onClick={() => setIsPickingColor(!isPickingColor)} sx={{ minWidth: 0, p: 0.5, px: 1, fontSize: '0.7rem' }}>
                    {isPickingColor ? "Cancel" : "Pick from Preview"}
                  </Button>
                </Box>
              </Box>
              <Box flex={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Tolerance (Match strictness)</Typography>
                  <Typography variant="caption" fontWeight="bold">{chromaTolerance}</Typography>
                </Box>
                <Slider min={0} max={255} value={chromaTolerance} onChange={(e, val) => setChromaTolerance(val)} size="small" />
              </Box>
              <Button size="small" variant="contained" onClick={handleGenerateChromaMask} disabled={isGenerating || !bgFile}>
                {isGenerating ? 'Processing...' : 'Apply Color Mask'}
              </Button>
            </Box>
          )}
          {maskMode === 'auto' && (
            <Typography variant="caption" color="text.secondary">
              AI automatically detects and extracts the main foreground subject. Just toggle "Masking On".
            </Typography>
          )}
        </Box>

        <Box mt={3}>
           <Typography variant="body2" color="text.secondary" gutterBottom>Overlay Texture Video (Optional)</Typography>
           <TextField fullWidth size="small" value={overlayVideoPath} onChange={e => setOverlayVideoPath(e.target.value)} placeholder="e.g. /path/to/looping_film_grain.mp4" />
        </Box>
      </Paper>

      {/* Search */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
          Find Lyrics
        </Typography>
        <Box display="flex" gap={2} mb={2}>
          <TextField 
            fullWidth 
            placeholder="Search by song name or artist..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            size="small"
          />
          <Button variant="contained" onClick={handleSearch} disabled={isSearching} sx={{ px: 4 }}>
            {isSearching ? <CircularProgress size={24} /> : 'Search'}
          </Button>
        </Box>

        {results.length > 0 && (
          <List sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'background.default', borderRadius: 2, border: 1, borderColor: 'divider', mb: 2 }}>
            {results.map(r => (
              <ListItem key={r.id} divider>
                <ListItemText primary={`${r.trackName} — ${r.artistName}`} />
                <ListItemSecondaryAction>
                  <Button variant="outlined" size="small" onClick={() => {
                    setLyrics(r.syncedLyrics)
                    setResults([])
                  }}>Use</Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}

        <Box mt={3} p={3} bgcolor="background.default" border={1} borderColor="divider" borderRadius={2} textAlign="center">
          <Typography variant="body2" color="text.secondary" mb={2}>
            Can't find the lyrics online? Let AI listen to the track and transcribe it automatically.
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleGenerateAI}
            disabled={isGenerating || !audioPath}
          >
            {isGenerating ? 'Listening & Transcribing...' : 'Auto-Generate Lyrics with AI'}
          </Button>
        </Box>
      </Paper>
      </>
    </Box>
  )
}
