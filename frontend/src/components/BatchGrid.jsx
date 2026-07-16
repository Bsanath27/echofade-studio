import { useState, useEffect, useRef } from 'react'
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, TextField, Button, Select, MenuItem, LinearProgress, 
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, 
  Slider, List, ListItemButton, ListItemText, CircularProgress, Divider,
  Tabs, Tab, Chip, ToggleButtonGroup, ToggleButton, FormControl, InputLabel
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import { PRESETS, FONT_PRESETS } from '../presets'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const STAGE_LABELS = {
  queued: 'Queued', downloading: 'Downloading...', fetching_lyrics: 'Fetching lyrics...',
  processing: 'Mastering...', rendering: 'Rendering...', done: 'Done', error: 'Error'
}

let rowSeq = 0
const newRow = () => ({
  id: ++rowSeq, link: '', bgFile: null,
  preset: 'Classic Slowed+Reverb', aspect: '16:9', quality: 'final',
  bgStyle: 'cinematic', lyricStyle: 'single',
  jobId: null, status: null, progress: 0, stage: '', title: '', error: '', downloadUrl: '',
  lyrics: '', lyricOffset: 0.0, posX: 50, posY: 50, lyricsProvided: false,
  trimStart: 0, trimEnd: 0, duration: 0,
  
  // Custom Typography & Styling properties
  fontFamily: 'Montserrat',
  fontColor: '#ffffff',
  fontSize: 60,
  textTransform: 'uppercase',
  strokeWidth: 2,
  strokeColor: '#000000',
  shadowOffset: 4,
  lyricPreset: 'line-pop',
  bloomColor: '',
  bloomRadius: 0,
  introMode: 'none',
  introText: '',
  layoutTheme: 'lyric_video',
  paperskyBgMode: 'memory',
  paperskyAtmosphere: 'Blue Hour',
  paperskyCaption: 'Nostalgia'
})

export default function BatchGrid() {
  const [rows, setRows] = useState([newRow(), newRow()])
  const [isRunning, setIsRunning] = useState(false)
  const pollRef = useRef(null)

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState(null)
  
  // Tab control
  const [tabIndex, setTabIndex] = useState(0)

  // Dialog Local Fields (Lyrics & Audio)
  const [dialogLyrics, setDialogLyrics] = useState('')
  const [dialogOffset, setDialogOffset] = useState(0.0)
  const [dialogPosX, setDialogPosX] = useState(50)
  const [dialogPosY, setDialogPosY] = useState(50)
  const [dialogTrimStart, setDialogTrimStart] = useState(0)
  const [dialogTrimEnd, setDialogTrimEnd] = useState(0)
  const [dialogDuration, setDialogDuration] = useState(0)
  const [dialogIntroMode, setDialogIntroMode] = useState('none')
  const [dialogIntroText, setDialogIntroText] = useState('')
  const [dialogLayoutTheme, setDialogLayoutTheme] = useState('lyric_video')
  const [dialogPaperskyBgMode, setDialogPaperskyBgMode] = useState('memory')
  const [dialogPaperskyAtmosphere, setDialogPaperskyAtmosphere] = useState('Blue Hour')
  const [dialogPaperskyCaption, setDialogPaperskyCaption] = useState('Nostalgia')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [fetchingTitle, setFetchingTitle] = useState(false)
  const [bgPreviewUrl, setBgPreviewUrl] = useState('')

  // Dialog Local Fields (Typography & Styles)
  const [dialogFontFamily, setDialogFontFamily] = useState('Montserrat')
  const [dialogFontColor, setDialogFontColor] = useState('#ffffff')
  const [dialogFontSize, setDialogFontSize] = useState(60)
  const [dialogTextTransform, setDialogTextTransform] = useState('uppercase')
  const [dialogStrokeWidth, setDialogStrokeWidth] = useState(2)
  const [dialogStrokeColor, setDialogStrokeColor] = useState('#000000')
  const [dialogShadowOffset, setDialogShadowOffset] = useState(4)
  const [dialogLyricPreset, setDialogLyricPreset] = useState('line-pop')
  const [dialogBloomColor, setDialogBloomColor] = useState('')
  const [dialogBloomRadius, setDialogBloomRadius] = useState(0)
  const [dialogLyricStyle, setDialogLyricStyle] = useState('single')
  const [activeFontPreset, setActiveFontPreset] = useState(null)

  const update = (id, patch) => setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
  const addRow = () => setRows(rs => [...rs, newRow()])
  const removeRow = (id) => setRows(rs => rs.filter(r => r.id !== id))

  useEffect(() => {
    const anyActive = rows.some(r => r.jobId && r.status !== 'done' && r.status !== 'error')
    if (!anyActive) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      if (isRunning && rows.every(r => !r.jobId || r.status === 'done' || r.status === 'error')) setIsRunning(false)
      return
    }
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/batch/jobs`)
        const data = await res.json()
        const byId = Object.fromEntries((data.jobs || []).map(j => [j.id, j]))
        setRows(rs => rs.map(r => {
          const j = r.jobId && byId[r.jobId]
          if (!j) return r
          return {
            ...r, status: j.status, progress: j.progress || 0, stage: j.stage || '',
            title: j.title || r.title, error: j.error || '',
            downloadUrl: j.download_url ? `${API}${j.download_url}` : r.downloadUrl
          }
        }))
      } catch (e) {}
    }, 1500)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [rows, isRunning])

  // Create preview URL for the dialog background
  useEffect(() => {
    if (selectedRow && selectedRow.bgFile) {
      const url = URL.createObjectURL(selectedRow.bgFile)
      setBgPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setBgPreviewUrl('')
    }
  }, [selectedRow])

  // Automatically fetch video metadata (title) if we open dialog and don't have it yet
  useEffect(() => {
    if (dialogOpen && selectedRow && !selectedRow.title && selectedRow.link.trim()) {
      setFetchingTitle(true)
      fetch(`${API}/api/downloader/info?url=${encodeURIComponent(selectedRow.link.trim())}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success' && data.info) {
            setSearchQuery(data.info.title)
            setDialogDuration(data.info.duration)
            setDialogTrimEnd(selectedRow.trimEnd || data.info.duration)
            update(selectedRow.id, { 
              title: data.info.title,
              duration: data.info.duration,
              trimEnd: selectedRow.trimEnd || data.info.duration
            })
          }
        })
        .catch(err => console.error("Error fetching video info:", err))
        .finally(() => setFetchingTitle(false))
    } else if (dialogOpen && selectedRow) {
      setDialogDuration(selectedRow.duration || 0)
      setDialogTrimStart(selectedRow.trimStart || 0)
      setDialogTrimEnd(selectedRow.trimEnd || selectedRow.duration || 0)
    }
  }, [dialogOpen, selectedRow])

  const renderAll = async () => {
    const pending = rows.filter(r => r.link.trim() && r.bgFile && !r.jobId)
    if (pending.length === 0) return
    setIsRunning(true)
    for (const r of pending) {
      const preset = PRESETS.find(p => p.name === r.preset)
      const fd = new FormData()
      fd.append('link', r.link.trim())
      fd.append('preset_values', JSON.stringify(preset.values))
      fd.append('aspect_ratio', r.aspect)
      fd.append('quality', r.quality)
      fd.append('bg_style', r.bgStyle)
      fd.append('lyric_style', r.lyricStyle || 'single')
      fd.append('image', r.bgFile)
      
      // Pass custom lyrics overrides if provided
      if (r.lyricsProvided) {
        if (r.lyrics && r.lyrics.trim()) {
          fd.append('raw_lrc', r.lyrics)
        }
        fd.append('lyric_offset', r.lyricOffset || 0)
        fd.append('pos_x', r.posX || 50)
        fd.append('pos_y', r.posY || 50)
        
        // Font overrides
        fd.append('font_family', r.fontFamily || 'Montserrat')
        fd.append('font_color', r.fontColor || '#ffffff')
        fd.append('font_size', r.fontSize || 60)
        fd.append('text_transform', r.textTransform || 'uppercase')
        fd.append('stroke_width', r.strokeWidth || 2)
        fd.append('stroke_color', r.strokeColor || '#000000')
        fd.append('shadow_offset', r.shadowOffset || 4)
        fd.append('lyric_preset', r.lyricPreset || 'line-pop')
        fd.append('bloom_color', r.bloomColor || '')
        fd.append('bloom_radius', r.bloomRadius || 0)
        fd.append('lyric_style', r.lyricStyle || 'single')
        fd.append('intro_mode', r.introMode || 'none')
        fd.append('intro_text', r.introText || '')
        fd.append('layout_theme', r.layoutTheme || 'lyric_video')
        fd.append('papersky_bg_mode', r.paperskyBgMode || 'memory')
        fd.append('papersky_atmosphere', r.paperskyAtmosphere || 'Blue Hour')
        fd.append('papersky_caption', r.paperskyCaption || 'Nostalgia')
      }

      // Pass trim duration overrides if configured
      if (r.trimStart > 0 || (r.trimEnd > 0 && r.trimEnd < r.duration)) {
        fd.append('trim_start', r.trimStart || 0)
        fd.append('trim_end', r.trimEnd || 0)
      }

      try {
        const res = await fetch(`${API}/api/batch/submit`, { method: 'POST', body: fd })
        const data = await res.json()
        if (data.status === 'success') {
          update(r.id, { jobId: data.job_id, status: 'queued', stage: 'Queued', progress: 0 })
        } else {
          update(r.id, { status: 'error', error: data.message || 'Submit failed' })
        }
      } catch {
        update(r.id, { status: 'error', error: 'Failed to connect to backend' })
      }
    }
  }

  const clearFinished = async () => {
    try { await fetch(`${API}/api/batch/clear`, { method: 'POST' }) } catch {}
    setRows(rs => rs.filter(r => !(r.status === 'done' || r.status === 'error')))
  }

  const openLyricsDialog = (row) => {
    setSelectedRow(row)
    setDialogLyrics(row.lyrics || '')
    setDialogOffset(row.lyricOffset || 0.0)
    setDialogPosX(row.posX ?? 50)
    setDialogPosY(row.posY ?? 50)
    setDialogTrimStart(row.trimStart || 0)
    setDialogTrimEnd(row.trimEnd || 0)
    setDialogDuration(row.duration || 0)
    setDialogIntroMode(row.introMode || 'none')
    setDialogIntroText(row.introText || '')
    setDialogLayoutTheme(row.layoutTheme || 'lyric_video')
    setDialogPaperskyBgMode(row.paperskyBgMode || 'memory')
    setDialogPaperskyAtmosphere(row.paperskyAtmosphere || 'Blue Hour')
    setDialogPaperskyCaption(row.paperskyCaption || 'Nostalgia')
    setSearchQuery(row.title || '')
    setSearchResults([])

    // Style values initialization
    setDialogFontFamily(row.fontFamily || 'Montserrat')
    setDialogFontColor(row.fontColor || '#ffffff')
    setDialogFontSize(row.fontSize || 60)
    setDialogTextTransform(row.textTransform || 'uppercase')
    setDialogStrokeWidth(row.strokeWidth || 2)
    setDialogStrokeColor(row.strokeColor || '#000000')
    setDialogShadowOffset(row.shadowOffset || 4)
    setDialogLyricPreset(row.lyricPreset || 'line-pop')
    setDialogBloomColor(row.bloomColor || '')
    setDialogBloomRadius(row.bloomRadius || 0)
    setDialogLyricStyle(row.lyricStyle || 'single')
    setActiveFontPreset(null)

    setTabIndex(0)
    setDialogOpen(true)
  }

  const applyFontPresetBatch = (p) => {
    setDialogFontFamily(p.font)
    setDialogFontSize(p.size)
    setDialogStrokeWidth(p.stroke)
    setDialogStrokeColor(p.strokeColor)
    setDialogShadowOffset(p.shadow)
    setDialogFontColor(p.color)
    setDialogTextTransform(p.transform)
    setActiveFontPreset(p.name)
    if (p.bloomColor !== undefined) setDialogBloomColor(p.bloomColor)
    if (p.bloomRadius !== undefined) setDialogBloomRadius(p.bloomRadius)
    if (p.preset) setDialogLyricPreset(p.preset)
  }

  const handleSearchLyrics = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const res = await fetch(`${API}/api/search-lyrics?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data.status === 'success' && data.results) {
        setSearchResults(data.results.filter(r => r.syncedLyrics))
      }
    } catch (e) {
      console.error(e)
    }
    setIsSearching(false)
  }

  const handleSaveLyrics = () => {
    if (selectedRow) {
      update(selectedRow.id, {
        lyrics: dialogLyrics,
        lyricOffset: dialogOffset,
        posX: dialogPosX,
        posY: dialogPosY,
        trimStart: dialogTrimStart,
        trimEnd: dialogTrimEnd,
        duration: dialogDuration,
        
        // Font and styling overrides
        fontFamily: dialogFontFamily,
        fontColor: dialogFontColor,
        fontSize: dialogFontSize,
        textTransform: dialogTextTransform,
        strokeWidth: dialogStrokeWidth,
        strokeColor: dialogStrokeColor,
        shadowOffset: dialogShadowOffset,
        lyricPreset: dialogLyricPreset,
        bloomColor: dialogBloomColor,
        bloomRadius: dialogBloomRadius,
        lyricStyle: dialogLyricStyle,
        introMode: dialogIntroMode,
        introText: dialogIntroText,
        layoutTheme: dialogLayoutTheme,
        paperskyBgMode: dialogPaperskyBgMode,
        paperskyAtmosphere: dialogPaperskyAtmosphere,
        paperskyCaption: dialogPaperskyCaption,

        lyricsProvided: true
      })
    }
    setDialogOpen(false)
  }

  const handleClearLyrics = () => {
    if (selectedRow) {
      update(selectedRow.id, {
        lyrics: '',
        lyricOffset: 0.0,
        posX: 50,
        posY: 50,
        trimStart: 0,
        trimEnd: 0,
        duration: 0,

        fontFamily: 'Montserrat',
        fontColor: '#ffffff',
        fontSize: 60,
        textTransform: 'uppercase',
        strokeWidth: 2,
        strokeColor: '#000000',
        shadowOffset: 4,
        lyricPreset: 'line-pop',
        bloomColor: '',
        bloomRadius: 0,
        lyricStyle: 'single',
        introMode: 'none',
        introText: '',

        lyricsProvided: false
      })
    }
    setDialogOpen(false)
  }

  const pendingCount = rows.filter(r => r.link.trim() && r.bgFile && !r.jobId).length

  // Calculate layout bounds for preview container
  const isVertical = selectedRow?.aspect === '9:16'
  const previewWidth = isVertical ? 168 : 300
  const previewHeight = isVertical ? 300 : 168

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Batch Render</Typography>
        <Typography color="text.secondary">Queue many videos at once — paste a link, pick a background and a vibe per row, then render them all sequentially.</Typography>
      </Box>

      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: '60vh' }}>
          <Table stickyHeader size="small" sx={{ '& td, & th': { px: 1.25 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 180 }}>YouTube Link</TableCell>
                <TableCell sx={{ minWidth: 104 }}>Background</TableCell>
                <TableCell sx={{ minWidth: 130 }}>Preset</TableCell>
                <TableCell sx={{ width: 78 }}>Format</TableCell>
                <TableCell sx={{ width: 104 }}>Style</TableCell>
                <TableCell sx={{ width: 86 }}>Quality</TableCell>
                <TableCell sx={{ width: 110 }}>Lyrics & Pos</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Status</TableCell>
                <TableCell padding="checkbox"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                const locked = !!r.jobId
                const done = r.status === 'done'
                const errored = r.status === 'error'
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <TextField 
                        size="small" 
                        fullWidth 
                        placeholder="https://youtube.com/watch?v=..."
                        value={r.link} 
                        disabled={locked}
                        onChange={e => update(r.id, { link: e.target.value })} 
                      />
                      {r.title && <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.5 }}>{r.title}</Typography>}
                    </TableCell>

                    <TableCell>
                      <Button
                        component="label"
                        variant="outlined"
                        size="small"
                        disabled={locked}
                        sx={{ textTransform: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}
                      >
                        {r.bgFile ? r.bgFile.name : 'Choose...'}
                        <input type="file" accept="image/*,video/*" hidden onChange={e => update(r.id, { bgFile: e.target.files[0] })} />
                      </Button>
                    </TableCell>

                    <TableCell>
                      <Select size="small" fullWidth value={r.preset} disabled={locked} onChange={e => update(r.id, { preset: e.target.value })}>
                        {PRESETS.map(p => <MenuItem key={p.name} value={p.name}>{p.name}</MenuItem>)}
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Select size="small" fullWidth value={r.aspect} disabled={locked} onChange={e => update(r.id, { aspect: e.target.value })}>
                        <MenuItem value="16:9">16:9</MenuItem>
                        <MenuItem value="9:16">9:16</MenuItem>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Select size="small" fullWidth value={r.bgStyle} disabled={locked} onChange={e => update(r.id, { bgStyle: e.target.value })}>
                        <MenuItem value="cinematic">Cinematic</MenuItem>
                        <MenuItem value="gradient">Gradient</MenuItem>
                        <MenuItem value="plain">Plain</MenuItem>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Select size="small" fullWidth value={r.quality} disabled={locked} onChange={e => update(r.id, { quality: e.target.value })}>
                        <MenuItem value="final">Final</MenuItem>
                        <MenuItem value="draft">Draft</MenuItem>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <Button
                        variant={r.lyricsProvided ? "contained" : "outlined"}
                        color={r.lyricsProvided ? "success" : "primary"}
                        size="small"
                        disabled={locked}
                        onClick={() => openLyricsDialog(r)}
                        sx={{ textTransform: 'none', minWidth: 90 }}
                      >
                        {r.lyricsProvided ? "Configured" : "Configure..."}
                      </Button>
                    </TableCell>

                    <TableCell>
                      {!r.status && <Typography variant="body2" color="text.secondary">—</Typography>}
                      {r.status && !done && !errored && (
                        <Box>
                          <LinearProgress variant="determinate" value={r.progress} sx={{ height: 6, borderRadius: 3, mb: 0.5 }} />
                          <Typography variant="caption" color="text.secondary">
                            {STAGE_LABELS[r.status] || r.stage} {r.status === 'rendering' ? `${r.progress}%` : ''}
                          </Typography>
                        </Box>
                      )}
                      {done && <Button variant="contained" color="primary" size="small" href={r.downloadUrl} download>Download</Button>}
                      {errored && <Typography variant="caption" color="error" title={r.error}>Error: {r.error?.slice(0, 30)}</Typography>}
                    </TableCell>

                    <TableCell>
                      {!locked && (
                        <IconButton size="small" onClick={() => removeRow(r.id)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Box display="flex" p={2} borderTop={1} borderColor="divider" gap={2} flexWrap="wrap" alignItems="center">
          <Button variant="outlined" onClick={addRow}>Add Row</Button>
          <Button variant="outlined" onClick={clearFinished}>Clear Finished</Button>
          <Box flexGrow={1} />
          <Button variant="contained" color="primary" onClick={renderAll} disabled={pendingCount === 0} size="large">
            {isRunning ? 'Rendering Queue...' : `Render All (${pendingCount})`}
          </Button>
        </Box>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Lyrics are fetched automatically from lrclib for each track if not configured manually. Videos render one at a time; you can keep adding rows while the queue runs.
      </Typography>

      {/* Lyrics & Position Config Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { bgcolor: 'background.paper', borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight="bold">Lyrics, Position & Style Settings</Typography>
          <IconButton size="small" onClick={() => setDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ py: 2 }}>
          {/* Tabs header */}
          <Tabs 
            value={tabIndex} 
            onChange={(e, val) => setTabIndex(val)} 
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Lyrics & Audio Cut" sx={{ fontWeight: 'bold' }} />
            <Tab label="Typography & Colors" sx={{ fontWeight: 'bold' }} />
            <Tab label="Layout Theme" sx={{ fontWeight: 'bold' }} />
          </Tabs>

          <Grid container spacing={3}>
            {/* Left Side: Editor (Tab-dependent) */}
            <Grid item xs={12} md={7} display="flex" flexDirection="column" gap={2}>
              {tabIndex === 2 ? (
                <>
                  <Typography variant="subtitle2" fontWeight="bold" color="primary">3. Layout Theme Options</Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>Layout Theme</InputLabel>
                    <Select value={dialogLayoutTheme} label="Layout Theme" onChange={(e) => setDialogLayoutTheme(e.target.value)}>
                      <MenuItem value="lyric_video">Lyric Video (Standard)</MenuItem>
                      <MenuItem value="papersky">Paper Sky (Cinematic Polaroid)</MenuItem>
                    </Select>
                  </FormControl>

                  {dialogLayoutTheme === 'papersky' && (
                    <>
                      <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                        <InputLabel>Background Mode</InputLabel>
                        <Select value={dialogPaperskyBgMode} label="Background Mode" onChange={(e) => setDialogPaperskyBgMode(e.target.value)}>
                          <MenuItem value="memory">Memory (Generated from media)</MenuItem>
                          <MenuItem value="atmosphere">Atmosphere (Premium presets)</MenuItem>
                        </Select>
                      </FormControl>
                      
                      {dialogPaperskyBgMode === 'atmosphere' && (
                        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                          <InputLabel>Atmosphere Asset</InputLabel>
                          <Select value={dialogPaperskyAtmosphere} label="Atmosphere Asset" onChange={(e) => setDialogPaperskyAtmosphere(e.target.value)}>
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

                      <TextField
                        size="small"
                        fullWidth
                        sx={{ mt: 1 }}
                        label="Polaroid Caption"
                        value={dialogPaperskyCaption}
                        onChange={(e) => setDialogPaperskyCaption(e.target.value)}
                        placeholder="e.g. Nostalgia"
                      />
                    </>
                  )}
                </>
              ) : tabIndex === 0 ? (
                <>
                  <Typography variant="subtitle2" fontWeight="bold" color="primary">1. Search & Edit Synced Lyrics</Typography>
                  
                  <Box display="flex" gap={1}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Search lyrics (e.g. Artist - Song Title)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSearchLyrics() }}
                      disabled={fetchingTitle}
                    />
                    <Button 
                      variant="contained" 
                      onClick={handleSearchLyrics}
                      disabled={isSearching || fetchingTitle}
                      startIcon={isSearching || fetchingTitle ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                    >
                      Search
                    </Button>
                  </Box>

                  {searchResults.length > 0 && (
                    <Paper sx={{ border: 1, borderColor: 'divider', maxHeight: 150, overflowY: 'auto', p: 1, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.5, display: 'block', fontWeight: 'bold' }}>
                        Search Results (Click to load):
                      </Typography>
                      <List dense disablePadding>
                        {searchResults.map((track) => (
                          <ListItemButton
                            key={track.id}
                            onClick={() => {
                              setDialogLyrics(track.syncedLyrics || '')
                              setSearchResults([])
                            }}
                          >
                            <ListItemText
                              primary={`${track.trackName} — ${track.artistName}`}
                              secondary={track.albumName ? `Album: ${track.albumName}` : ''}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    </Paper>
                  )}

                  <TextField
                    multiline
                    rows={10}
                    fullWidth
                    label="Lyrics (LRC formatted synced lyrics)"
                    placeholder="[00:12.34] Lyrics line here..."
                    value={dialogLyrics}
                    onChange={(e) => setDialogLyrics(e.target.value)}
                    helperText="Paste LRC formatted synced lyrics directly, or search from lrclib above. Leave empty to auto-fetch lyrics on render."
                    sx={{
                      '& .MuiInputBase-input': {
                        fontFamily: 'monospace',
                        fontSize: '0.85rem'
                      }
                    }}
                  />
                </>
              ) : (
                <>
                  <Typography variant="subtitle2" fontWeight="bold" color="primary">1. Typography Presets & Options</Typography>
                  
                  {/* Font Presets */}
                  <Box mb={2}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
                      Font Presets
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {FONT_PRESETS.map(p => (
                        <Chip
                          key={p.name}
                          label={p.name}
                          clickable
                          color={activeFontPreset === p.name ? 'primary' : 'default'}
                          variant={activeFontPreset === p.name ? 'filled' : 'outlined'}
                          onClick={() => applyFontPresetBatch(p)}
                          size="small"
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Font family and size */}
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Font Family</InputLabel>
                        <Select value={dialogFontFamily} label="Font Family" onChange={(e) => { setDialogFontFamily(e.target.value); setActiveFontPreset(null) }}>
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
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" color="text.secondary">Font Size</Typography>
                        <Typography variant="body2" fontWeight="bold">{dialogFontSize}px</Typography>
                      </Box>
                      <Slider min={20} max={150} value={dialogFontSize} onChange={(e, val) => { setDialogFontSize(val); setActiveFontPreset(null) }} size="small" />
                    </Grid>
                  </Grid>

                  {/* Formatting & Animation style */}
                  <Grid container spacing={2} mt={1}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
                        Lyric Display Style
                      </Typography>
                      <ToggleButtonGroup
                        value={dialogLyricStyle}
                        exclusive
                        onChange={(e, val) => val && setDialogLyricStyle(val)}
                        fullWidth
                        size="small"
                      >
                        <ToggleButton value="single">Single Line</ToggleButton>
                        <ToggleButton value="stack">3-Line Stack</ToggleButton>
                      </ToggleButtonGroup>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small" sx={{ mt: 3.2 }}>
                        <InputLabel>Animation Preset</InputLabel>
                        <Select value={dialogLyricPreset} label="Animation Preset" onChange={(e) => { setDialogLyricPreset(e.target.value); setActiveFontPreset(null) }}>
                          <MenuItem value="line-pop">Line Pop (Kinetic)</MenuItem>
                          <MenuItem value="word-stagger">Word Stagger (Pop / Karaoke)</MenuItem>
                          <MenuItem value="overshoot-spring">Overshoot Spring (Bounce)</MenuItem>
                          <MenuItem value="fade-up">Fade Up (Cinematic)</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* Color pickers */}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontWeight: 'bold' }}>
                    Aesthetic Colors
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>Text Color</Typography>
                      <input type="color" value={dialogFontColor} onChange={(e) => { setDialogFontColor(e.target.value); setActiveFontPreset(null) }} style={{ width: '100%', height: 38, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>Stroke Color</Typography>
                      <input type="color" value={dialogStrokeColor} onChange={(e) => { setDialogStrokeColor(e.target.value); setActiveFontPreset(null) }} style={{ width: '100%', height: 38, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary" gutterBottom>Glow Color</Typography>
                      <input type="color" value={dialogBloomColor} onChange={(e) => { setDialogBloomColor(e.target.value); setActiveFontPreset(null) }} style={{ width: '100%', height: 38, cursor: 'pointer', border: '1px solid #444', borderRadius: 6 }} />
                    </Grid>
                  </Grid>

                  {/* Sliders for borders & glow */}
                  <Box display="flex" flexDirection="column" gap={2} mt={2}>
                    <Box>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" color="text.secondary">Stroke Width</Typography>
                        <Typography variant="body2" fontWeight="bold">{dialogStrokeWidth}px</Typography>
                      </Box>
                      <Slider min={0} max={10} value={dialogStrokeWidth} onChange={(e, val) => { setDialogStrokeWidth(val); setActiveFontPreset(null) }} size="small" />
                    </Box>

                    <Box>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" color="text.secondary">Shadow Offset</Typography>
                        <Typography variant="body2" fontWeight="bold">{dialogShadowOffset}px</Typography>
                      </Box>
                      <Slider min={0} max={15} value={dialogShadowOffset} onChange={(e, val) => { setDialogShadowOffset(val); setActiveFontPreset(null) }} size="small" />
                    </Box>

                    <Box>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" color="text.secondary">Glow Radius (Bloom)</Typography>
                        <Typography variant="body2" fontWeight="bold">{dialogBloomRadius}px</Typography>
                      </Box>
                      <Slider min={0} max={40} value={dialogBloomRadius} onChange={(e, val) => { setDialogBloomRadius(val); setActiveFontPreset(null) }} size="small" />
                    </Box>
                  </Box>
                </>
              )}
            </Grid>

            {/* Right Side: Visual Preview (Always visible) */}
            <Grid item xs={12} md={5} display="flex" flexDirection="column" gap={3}>
              <Typography variant="subtitle2" fontWeight="bold">2. Position & Layout Preview</Typography>
              
              {/* Visual Preview Box */}
              <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                <Typography variant="caption" color="text.secondary">Live Design Preview</Typography>
                <Box
                  sx={{
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 2,
                    bgcolor: '#09090b',
                    backgroundImage: bgPreviewUrl ? `url(${bgPreviewUrl})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    width: previewWidth,
                    height: previewHeight,
                    transition: 'all 0.2s ease',
                    boxShadow: '0px 4px 20px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}
                >
                  {/* Grid Lines Overlay */}
                  <Box sx={{ position: 'absolute', inset: 0, border: '1px dashed rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
                  
                  {/* Styled Lyric Mockup */}
                  <Typography 
                    sx={{
                      position: 'absolute',
                      left: `${dialogPosX}%`,
                      top: `${dialogPosY}%`,
                      transform: 'translate(-50%, -50%)',
                      color: dialogFontColor,
                      fontFamily: dialogFontFamily === 'Montserrat' ? "'Montserrat', sans-serif" : `"${dialogFontFamily}", sans-serif`,
                      fontSize: `${dialogFontSize * 0.23}px`,
                      fontWeight: 'bold',
                      textTransform: dialogTextTransform,
                      WebkitTextStroke: dialogStrokeWidth > 0 ? `${dialogStrokeWidth * 0.25}px ${dialogStrokeColor}` : 'none',
                      textShadow: `
                        ${dialogShadowOffset > 0 ? `${dialogShadowOffset * 0.25}px ${dialogShadowOffset * 0.25}px 0px rgba(0,0,0,0.5)` : ''}
                        ${dialogBloomRadius > 0 && dialogBloomColor ? `${dialogShadowOffset > 0 ? ',' : ''} 0px 0px ${dialogBloomRadius * 0.25}px ${dialogBloomColor}` : ''}
                      `,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                      maxWidth: '95%',
                      lineHeight: 1.1,
                      px: 0.5,
                      py: 0.25
                    }}
                  >
                    Lyric Preview Line
                  </Typography>
                </Box>
              </Box>

              {/* Sliders Container */}
              <Box display="flex" flexDirection="column" gap={2}>
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2" color="text.secondary">Horizontal Position (X)</Typography>
                    <Typography variant="body2" fontWeight="bold">{dialogPosX}%</Typography>
                  </Box>
                  <Slider 
                    min={10} 
                    max={90} 
                    value={dialogPosX} 
                    onChange={(e, val) => setDialogPosX(val)} 
                    size="small"
                  />
                </Box>

                <Box>
                  <Box display="flex" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2" color="text.secondary">Vertical Position (Y)</Typography>
                    <Typography variant="body2" fontWeight="bold">{dialogPosY}%</Typography>
                  </Box>
                  <Slider 
                    min={10} 
                    max={90} 
                    value={dialogPosY} 
                    onChange={(e, val) => setDialogPosY(val)} 
                    size="small"
                  />
                </Box>

                {tabIndex === 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />

                    <Box>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" color="text.secondary">Lyric Delay Offset (Seconds)</Typography>
                        <Typography variant="body2" fontWeight="bold">{dialogOffset > 0 ? `+${dialogOffset}` : dialogOffset}s</Typography>
                      </Box>
                      <Slider 
                        min={-5.0} 
                        max={5.0} 
                        step={0.1}
                        value={dialogOffset} 
                        onChange={(e, val) => setDialogOffset(val)} 
                        size="small"
                      />
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    {/* Duration/Trim Section */}
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>3. Audio Trim & Duration</Typography>
                      <Box display="flex" justifyContent="space-between" mb={0.5} mt={1.5}>
                        <Typography variant="body2" color="text.secondary">Trim Segment (Start - End)</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {Math.round(dialogTrimEnd - dialogTrimStart)}s total
                        </Typography>
                      </Box>
                      <Slider 
                        value={[dialogTrimStart, dialogTrimEnd || dialogDuration || 300]}
                        onChange={(e, val) => {
                          setDialogTrimStart(val[0])
                          setDialogTrimEnd(val[1])
                        }}
                        min={0}
                        max={dialogDuration || 300}
                        step={1}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(val) => {
                          const m = Math.floor(val / 60)
                          const s = Math.floor(val % 60)
                          return `${m}:${String(s).padStart(2, '0')}`
                        }}
                        size="small"
                      />
                      <Box display="flex" justifyContent="space-between" mt={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          Start: {Math.floor(dialogTrimStart / 60)}:{String(Math.floor(dialogTrimStart % 60)).padStart(2, '0')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          End: {Math.floor((dialogTrimEnd || dialogDuration) / 60)}:{String(Math.floor((dialogTrimEnd || dialogDuration) % 60)).padStart(2, '0')}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    {/* Intro Video Overlay Settings */}
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>4. Intro Video Animation</Typography>
                      <FormControl fullWidth size="small" sx={{ mt: 1.5 }}>
                        <InputLabel>Intro Style</InputLabel>
                        <Select
                          value={dialogIntroMode}
                          label="Intro Style"
                          onChange={(e) => setDialogIntroMode(e.target.value)}
                        >
                          <MenuItem value="none">None</MenuItem>
                          <MenuItem value="papersky">Polaroid Intro (PaperSky)</MenuItem>
                        </Select>
                      </FormControl>
                      {dialogIntroMode === 'papersky' && (
                        <TextField
                          fullWidth
                          size="small"
                          label="Polaroid Card Custom Text"
                          value={dialogIntroText}
                          onChange={(e) => setDialogIntroText(e.target.value)}
                          placeholder="Defaults to song title"
                          sx={{ mt: 1.5 }}
                        />
                      )}
                    </Box>
                  </>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider', justifyContent: 'space-between' }}>
          <Button variant="outlined" color="error" onClick={handleClearLyrics}>
            Clear / Auto-Fetch
          </Button>
          <Box display="flex" gap={1.5}>
            <Button variant="outlined" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={handleSaveLyrics}>
              Save Configuration
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
