import { useState, useRef, useEffect } from 'react'
import { Box, Typography, Paper, TextField, Button, ToggleButtonGroup, ToggleButton, Select, MenuItem, Slider, Alert, CircularProgress, List, ListItem, ListItemText, ListItemSecondaryAction, Grid, InputLabel, FormControl, Chip } from '@mui/material'
import { FONT_PRESETS, BG_GRADIENTS } from '../presets'

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

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
  bgFile
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
  const [subjectOverlayUrl, setSubjectOverlayUrl] = useState('')
  const [maskMode, setMaskMode] = useState('auto')
  const [chromaColor, setChromaColor] = useState('#000000')
  const [chromaTolerance, setChromaTolerance] = useState(40)
  const [isPickingColor, setIsPickingColor] = useState(false)
  const audioRef = useRef(null)
  const maskInputRef = useRef(null)

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
      // Adjust time for speed, trim, and offset. Note: trimStart affects the relative position of lyrics to the audio.
      const adjustedTime = Math.max(0, (timeInSec / speed) - trimStart + lyricOffset)
      
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
      try {
        const formData = new FormData()
        formData.append('image', bgFile)
        const res = await fetch(`${API}/api/generate-mask`, { method: 'POST', body: formData })
        const data = await res.json()
        if (data.status === 'success') {
          setSubjectImagePath(data.mask_path)
          setSubjectOverlayUrl(`${API}${data.mask_url}`)
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
        <Typography variant="h4" fontWeight="bold" gutterBottom>Lyrics</Typography>
        <Typography color="text.secondary">Search, paste, or edit synchronized lyrics — then preview them against your mastered audio</Typography>
      </Box>

      {speed != 1.0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Timestamps auto-adjusted to match your <strong> {speed}x </strong> speed. Preview below to verify sync.
        </Alert>
      )}

      {!previewAudioUrl && (
        <Alert severity="info" sx={{ mb: 3 }}>
          To preview lyrics sync, go back to Step 2 and render an audio preview first.
        </Alert>
      )}

      {/* Audio + Lyrics Sync Preview (Moved to Top) */}
      {previewAudioUrl && parsedLines.length > 0 && (
        <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={3}>
            Live Preview
          </Typography>
          
          <Box mb={3} p={2} bgcolor="background.default" borderRadius={2} border={1} borderColor="divider">
            <audio ref={audioRef} controls src={previewAudioUrl} style={{width: '100%', height: 40}} />
          </Box>

          <Box sx={{
            display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
            borderRadius: 2, background: '#000', mx: 'auto', border: 1, borderColor: 'divider',
            ...(aspectRatio === '9:16'
              ? { height: 500, aspectRatio: '9 / 16', maxWidth: '100%' }
              : { width: '100%', aspectRatio: '16 / 9', maxHeight: 460 })
          }}>
            {isPickingColor && (
              <Box position="absolute" top={0} left={0} right={0} bgcolor="rgba(0,0,0,0.7)" color="white" p={1} zIndex={50} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Crosshair mode: Click anywhere on the background to pick a color</Typography>
                <Button size="small" variant="contained" color="error" onClick={() => setIsPickingColor(false)}>Cancel</Button>
              </Box>
            )}

            <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 10, bgcolor: 'rgba(0,0,0,0.6)', px: 1.5, py: 0.5, borderRadius: 1, backdropFilter: 'blur(4px)' }}>
              <Typography variant="caption" color="white" fontWeight="bold">Visual Layout Preview · {aspectRatio}</Typography>
            </Box>
            
            {/* Chosen gradient background (overrides the image when picked) */}
            {bgMode === 'gradient' && gradientColors && (
              <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, ${gradientColors.join(', ')})` }} />
            )}

            {/* Background Media */}
            {bgUrl && !(bgMode === 'gradient' && gradientColors) && (() => {
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

            {/* Visual Safe Area & Coordinate Mapping (Hidden during color pick) */}
            {!isPickingColor && (
              <Box sx={{position: 'absolute', inset: 0, zIndex: 5}}>
                {parsedLines.length > 0 && (
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
                      
                      return (
                        <Box key={lineIdx} sx={{
                          fontSize: offset === 0 ? `${Math.max(1, fontSize / 30)}rem` : `${Math.max(0.8, fontSize / 40)}rem`,
                          fontWeight: 700,
                          color: offset === 0 ? fontColor : 'rgba(255,255,255,0.4)',
                          textTransform: textTransform,
                          transition: 'all 0.3s ease',
                          fontFamily: fontFamily === 'Montserrat' ? "'Montserrat', sans-serif" : `"${fontFamily}", sans-serif`,
                          textShadow: offset === 0 ? (
                            [
                              strokeWidth > 0 ? `-${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, -${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}` : null,
                              shadowOffset > 0 ? `${shadowOffset}px ${shadowOffset}px ${Math.max(2, shadowOffset)}px rgba(0,0,0,0.8)` : null,
                              bloomRadius > 0 && bloomColor ? `0 0 ${bloomRadius}px ${bloomColor}, 0 0 ${bloomRadius * 1.5}px ${bloomColor}` : null
                            ].filter(Boolean).join(', ') || 'none'
                          ) : 'none'
                        }}>
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
        </Paper>
      )}

      {previewAudioUrl && parsedLines.length === 0 && lyrics && (
        <Alert severity="error" sx={{ mb: 3 }}>
          No valid timestamps found in your lyrics. Make sure each line starts with [mm:ss.xx] format.
        </Alert>
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
    </Box>
  )
}
