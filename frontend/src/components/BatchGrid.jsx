import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Button, Select, MenuItem, LinearProgress, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { PRESETS } from '../presets'

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
  jobId: null, status: null, progress: 0, stage: '', title: '', error: '', downloadUrl: ''
})

export default function BatchGrid() {
  const [rows, setRows] = useState([newRow(), newRow()])
  const [isRunning, setIsRunning] = useState(false)
  const pollRef = useRef(null)

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
      fd.append('lyric_style', r.lyricStyle)
      fd.append('image', r.bgFile)
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

  const pendingCount = rows.filter(r => r.link.trim() && r.bgFile && !r.jobId).length

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
        Lyrics are fetched automatically from lrclib for each track. Videos render one at a time; you can keep adding rows while the queue runs.
      </Typography>
    </Box>
  )
}
