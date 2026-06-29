import { useState } from 'react'
import { Box, Typography, Paper, TextField, Button, Select, MenuItem, LinearProgress, Alert, FormControl, InputLabel } from '@mui/material'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function Downloader() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState('mp4')
  
  const [info, setInfo] = useState(null)
  const [isLoadingInfo, setIsLoadingInfo] = useState(false)
  
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [error, setError] = useState('')

  const handleFetchInfo = async () => {
    if (!url.trim()) return
    setIsLoadingInfo(true)
    setError('')
    setDownloadUrl('')
    setInfo(null)
    
    try {
      const res = await fetch(`${API}/api/downloader/info?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      if (data.status === 'success') {
        setInfo(data.info)
      } else {
        setError(data.message || 'Failed to fetch metadata.')
      }
    } catch (e) {
      setError('Network error connecting to backend.')
    }
    setIsLoadingInfo(false)
  }

  const handleDownload = async () => {
    if (!url.trim()) return
    setIsDownloading(true)
    setError('')
    setDownloadUrl('')
    
    const formData = new FormData()
    formData.append('url', url)
    formData.append('format', format)
    
    try {
      const res = await fetch(`${API}/api/downloader/fetch`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.status === 'success') {
        setDownloadUrl(`${API}${data.download_url}`)
      } else {
        setError(data.message || 'Failed to download media.')
      }
    } catch (e) {
      setError('Network error connecting to backend.')
    }
    setIsDownloading(false)
  }

  return (
    <Box maxWidth={800} mx="auto">
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Media Downloader</Typography>
        <Typography color="text.secondary">Instantly fetch ultra-high quality videos or audio from YouTube or Instagram.</Typography>
      </Box>

      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", p: 3, mb: 3, borderRadius: 2 }}>
        <Box display="flex" gap={2}>
          <TextField 
            fullWidth 
            placeholder="Paste YouTube or Instagram link here..." 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleFetchInfo}
            disabled={isLoadingInfo || !url}
            sx={{ px: 4, whiteSpace: 'nowrap' }}
          >
            {isLoadingInfo ? 'Fetching...' : 'Get Info'}
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      {info && (
        <Paper elevation={0} sx={{ border: 1, borderColor: "divider", p: 3, borderRadius: 2 }}>
          <Box display="flex" gap={3} alignItems="center" mb={4}>
            {info.thumbnail ? (
              <Box 
                component="img" 
                src={info.thumbnail} 
                alt="Thumbnail" 
                sx={{ width: 160, height: 90, objectFit: 'cover', borderRadius: 2, border: 1, borderColor: 'divider' }} 
              />
            ) : (
              <Box sx={{ width: 160, height: 90, bgcolor: 'action.hover', borderRadius: 2 }} />
            )}
            <Box>
              <Typography variant="h6" gutterBottom>{info.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {info.uploader} • {Math.floor(info.duration / 60)}:{String(info.duration % 60).padStart(2, '0')}
              </Typography>
            </Box>
          </Box>
          
          <Box display="flex" gap={2} alignItems="flex-end">
            <Box flex={1}>
              <FormControl fullWidth>
                <InputLabel>Select Format</InputLabel>
                <Select value={format} label="Select Format" onChange={(e) => setFormat(e.target.value)}>
                  <MenuItem value="mp4">Video (MP4)</MenuItem>
                  <MenuItem value="mp3">Audio (MP3)</MenuItem>
                  <MenuItem value="wav">Audio (WAV - Lossless)</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            <Button 
              variant="contained" 
              color="primary" 
              sx={{ flex: 1, height: 56, fontSize: '1.1rem' }}
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? 'Processing...' : 'Download Media'}
            </Button>
          </Box>
          
          {isDownloading && (
            <Box mt={3} p={3} bgcolor="action.hover" borderRadius={2} textAlign="center">
              <LinearProgress sx={{ mb: 2, height: 8, borderRadius: 4 }} />
              <Typography color="primary" fontWeight="bold">
                Downloading and converting media in the background... This may take a minute.
              </Typography>
            </Box>
          )}
          
          {downloadUrl && (
            <Box mt={3} p={3} bgcolor="success.dark" color="success.contrastText" borderRadius={2} textAlign="center">
              <Typography variant="h6" fontWeight="bold" mb={2}>✓ Media Ready</Typography>
              <Button 
                variant="contained" 
                color="inherit" 
                href={downloadUrl} 
                download 
                sx={{ color: 'black', fontWeight: 'bold' }}
              >
                Save File to Device
              </Button>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  )
}
