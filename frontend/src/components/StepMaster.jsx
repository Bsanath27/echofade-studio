import { useState } from 'react'
import { Box, Typography, Paper, Grid, Slider, Switch, FormControlLabel, Button, LinearProgress, Chip } from '@mui/material'
import { PRESETS, EIGHTD_PRESETS } from '../presets'

const STAGE_LABELS = {
  starting: 'Starting...',
  slowdown: 'Applying vinyl slowdown...',
  '8d': 'Rendering 8D spatial panning...',
  eq_reverb: 'Applying EQ & reverb...',
  mastering: 'Mastering audio...',
  done: 'Done!'
}

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

export default function StepMaster({
  audioPath,
  speed, setSpeed,
  reverbRoom, setReverbRoom,
  reverbMix, setReverbMix,
  bassBoost, setBassBoost,
  trebleBoost, setTrebleBoost,
  warmth, setWarmth,
  enable8D, setEnable8D,
  orbitTime, setOrbitTime,
  orbitDucking, setOrbitDucking,
  orbitWidening, setOrbitWidening,
  trimStart, setTrimStart,
  trimEnd, setTrimEnd,
  previewAudioUrl, setPreviewAudioUrl,
  setStatus,
  isPreviewing, setIsPreviewing,
  previewProgress, setPreviewProgress,
  previewStage, setPreviewStage,
  handlePreview
}) {
  const [activePreset, setActivePreset] = useState(null)
  const [active8D, setActive8D] = useState(null)

  const apply8DPreset = (p) => {
    setEnable8D(true)
    setOrbitTime(p.orbitTime); setOrbitDucking(p.orbitDucking); setOrbitWidening(p.orbitWidening)
    setActive8D(p.name); setActivePreset(null)
  }

  const applyPreset = (preset) => {
    const v = preset.values
    setSpeed(v.speed); setReverbRoom(v.reverbRoom); setReverbMix(v.reverbMix)
    setBassBoost(v.bassBoost); setTrebleBoost(v.trebleBoost); setWarmth(v.warmth)
    setEnable8D(v.enable8D); setOrbitTime(v.orbitTime); setOrbitDucking(v.orbitDucking); setOrbitWidening(v.orbitWidening)
    setActivePreset(preset.name)
  }


  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Master Audio</Typography>
        <Typography color="text.secondary">Shape the sound with effects, EQ, and spatial audio</Typography>
      </Box>

      {/* Presets */}
      <Box mb={3}>
        {['Universal', 'Tamil'].map(cat => {
          const group = PRESETS.filter(p => (p.category || 'Universal') === cat)
          if (group.length === 0) return null
          return (
            <Box key={cat} mb={2}>
              <Typography variant="caption" color="text.secondary" fontWeight="bold" textTransform="uppercase" letterSpacing={1}>
                {cat}
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                {group.map(p => (
                  <Chip
                    key={p.name}
                    label={p.name}
                    clickable
                    color={activePreset === p.name ? 'primary' : 'default'}
                    variant={activePreset === p.name ? 'filled' : 'outlined'}
                    onClick={() => applyPreset(p)}
                  />
                ))}
              </Box>
            </Box>
          )
        })}
        {activePreset && (
          <Typography variant="body2" color="text.secondary" fontStyle="italic" mt={1}>
            {PRESETS.find(p => p.name === activePreset)?.desc}
          </Typography>
        )}
      </Box>

      {/* Speed & Reverb */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
          Speed & Reverb
        </Typography>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Box mb={2}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Speed (Pitch & Tempo)</Typography>
                <Typography variant="body2" fontWeight="bold">{speed}x</Typography>
              </Box>
              <Slider min={0.5} max={1.5} step={0.05} value={speed} onChange={(e, val) => { setSpeed(val); setActivePreset(null) }} />
            </Box>
            <Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Vintage Warmth</Typography>
                <Typography variant="body2" fontWeight="bold">{Math.round(warmth * 100)}%</Typography>
              </Box>
              <Slider min={0} max={1} step={0.05} value={warmth} onChange={(e, val) => { setWarmth(val); setActivePreset(null) }} />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box mb={2}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Room Size</Typography>
                <Typography variant="body2" fontWeight="bold">{Math.round(reverbRoom * 100)}%</Typography>
              </Box>
              <Slider min={0} max={1} step={0.05} value={reverbRoom} onChange={(e, val) => { setReverbRoom(val); setActivePreset(null) }} />
            </Box>
            <Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Reverb Mix</Typography>
                <Typography variant="body2" fontWeight="bold">{reverbMix}%</Typography>
              </Box>
              <Slider min={0} max={100} step={1} value={reverbMix} onChange={(e, val) => { setReverbMix(val); setActivePreset(null) }} />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* EQ */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom borderBottom={1} borderColor="divider" pb={1} mb={2}>
          Equalizer
        </Typography>
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Sub-Bass (150Hz)</Typography>
              <Typography variant="body2" fontWeight="bold">{bassBoost > 0 ? '+' : ''}{bassBoost} dB</Typography>
            </Box>
            <Slider min={-10} max={10} step={0.5} value={bassBoost} onChange={(e, val) => { setBassBoost(val); setActivePreset(null) }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Air / Treble (8kHz)</Typography>
              <Typography variant="body2" fontWeight="bold">{trebleBoost > 0 ? '+' : ''}{trebleBoost} dB</Typography>
            </Box>
            <Slider min={-10} max={10} step={0.5} value={trebleBoost} onChange={(e, val) => { setTrebleBoost(val); setActivePreset(null) }} />
          </Grid>
        </Grid>
      </Paper>

      {/* 8D */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  p: 3, mb: 3, borderRadius: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle1" fontWeight="bold">Spatial 8D Audio</Typography>
          <FormControlLabel
            control={<Switch checked={enable8D} onChange={(e) => { setEnable8D(e.target.checked); setActivePreset(null); if (!e.target.checked) setActive8D(null) }} />}
            label={enable8D ? "Enabled" : "Disabled"}
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Quick presets — one tap enables 8D and sets the orbit
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
          {EIGHTD_PRESETS.map(p => (
            <Chip
              key={p.name}
              label={p.name}
              clickable
              size="small"
              color={active8D === p.name ? 'primary' : 'default'}
              variant={active8D === p.name ? 'filled' : 'outlined'}
              onClick={() => apply8DPreset(p)}
            />
          ))}
        </Box>

        {enable8D && (
          <Box mt={3} p={3} bgcolor="background.default" borderRadius={2} border={1} borderColor="divider">
            <Box mb={2}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Orbit Speed</Typography>
                <Typography variant="body2" fontWeight="bold">{orbitTime}s</Typography>
              </Box>
              <Slider min={5} max={40} step={1} value={orbitTime} onChange={(e, val) => { setOrbitTime(val); setActivePreset(null); setActive8D(null) }} />
            </Box>
            <Box mb={2}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Distance Ducking</Typography>
                <Typography variant="body2" fontWeight="bold">-{orbitDucking} dB</Typography>
              </Box>
              <Slider min={0} max={15} step={0.5} value={orbitDucking} onChange={(e, val) => { setOrbitDucking(val); setActivePreset(null); setActive8D(null) }} />
            </Box>
            <Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Stereo Widening</Typography>
                <Typography variant="body2" fontWeight="bold">{orbitWidening}%</Typography>
              </Box>
              <Slider min={0} max={50} step={1} value={orbitWidening} onChange={(e, val) => { setOrbitWidening(val); setActivePreset(null); setActive8D(null) }} />
            </Box>
          </Box>
        )}
      </Paper>

      {/* Preview */}
      <Button 
        variant="contained" 
        color="primary" 
        size="large" 
        fullWidth
        onClick={handlePreview}
        disabled={isPreviewing || !audioPath}
      >
        {isPreviewing ? 'Rendering Preview...' : 'Render Audio Preview'}
      </Button>

      {isPreviewing && (
        <Box mt={3}>
          <LinearProgress variant="determinate" value={previewProgress} sx={{ height: 8, borderRadius: 4, mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {STAGE_LABELS[previewStage] || 'Processing...'} {previewProgress}%
          </Typography>
        </Box>
      )}

      {previewAudioUrl && (
        <Paper elevation={0} sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper",  mt: 3, p: 2, borderRadius: 2 }}>
          <audio controls autoPlay src={previewAudioUrl} style={{ width: '100%', height: 40 }} />
        </Paper>
      )}
    </Box>
  )
}
