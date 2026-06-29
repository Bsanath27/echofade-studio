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
  aspectRatio,
  bgMode, setBgMode,
  bgBlur, setBgBlur,
  bgDim, setBgDim,
  kenBurns, setKenBurns,
  grain, setGrain,
  vignette, setVignette,
  gradientColors, setGradientColors,
  bgFile
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFont, setActiveFont] = useState(null)

  const applyFontPreset = (p) => {
    setFontFamily(p.font); setFontSize(p.size); setStrokeWidth(p.stroke)
    setStrokeColor(p.strokeColor); setShadowOffset(p.shadow); setFontColor(p.color)
    setTextTransform(p.transform); setActiveFont(p.name)
  }
  const activeGradient = gradientColors ? BG_GRADIENTS.find(g => JSON.stringify(g.colors) === JSON.stringify(gradientColors))?.name : null
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
              const blurPx = bgMode === 'gradient' ? 45 : bgBlur * 0.45
              const baseScale = kenBurns ? 1 : 1 + Math.min(blurPx / 40, 0.5)
              const mediaStyle = {
                width: '100%', height: '100%', objectFit: 'cover',
                position: 'absolute', top: 0, left: 0,
                filter: blurPx > 0 ? `blur(${blurPx}px)` : 'none',
                transform: `scale(${baseScale})`,
                transformOrigin: 'center',
                transition: kenBurns ? 'transform 20s ease-in-out' : 'none'
              }
              return isVid
                ? <video src={bgUrl} autoPlay loop muted style={mediaStyle} />
                : <img src={bgUrl} style={mediaStyle} />
            })()}

            {/* Overlays */}
            {bgDim > 0 && <Box sx={{position: 'absolute', inset: 0, bgcolor: 'black', opacity: bgDim}} />}
            {grain > 0 && <Box sx={{
              position: 'absolute', inset: 0, mixBlendMode: 'overlay',
              opacity: Math.min(grain / 30 * 0.65, 0.65),
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
            }} />}
            {vignette > 0 && <Box sx={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${vignette}) 100%)`
            }} />}

            {/* Visual Safe Area & Coordinate Mapping */}
            <Box sx={{position: 'absolute', inset: 0}}>
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
                    const lineIdx = currentLineIdx + offset
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
                            shadowOffset > 0 ? `${shadowOffset}px ${shadowOffset}px ${Math.max(2, shadowOffset)}px rgba(0,0,0,0.8)` : null
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
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={3}>
          Typography Settings
        </Typography>

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
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary" gutterBottom>Text Color</Typography>
            <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} style={{ width: '100%', height: 42, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary" gutterBottom>Stroke Color</Typography>
            <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} style={{ width: '100%', height: 42, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
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
