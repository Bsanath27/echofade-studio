import { Box, Typography, Paper, TextField, Grid } from '@mui/material'

export default function StepTrim({
  trimStart, setTrimStart,
  trimEnd, setTrimEnd,
  previewAudioUrl
}) {
  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={1}>Trim Segment</Typography>
      <Typography color="text.secondary" mb={3}>
        Select the specific segment of the audio you want to use for your reel.
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" color="primary" fontWeight="bold" mb={0.5}>
          ✂️ Video Segment / Reel Trimmer
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          Set start and end timestamps (in seconds) to cut a specific segment for your reel (e.g. Start: 30, End: 60). Leave End as 0 for full song.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField 
              label="Start Time (s)"
              type="number"
              value={trimStart || 0}
              onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
              fullWidth
              size="small"
              InputProps={{ inputProps: { min: 0, step: 0.1 } }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField 
              label="End Time (s)"
              type="number"
              value={trimEnd || 0}
              onChange={(e) => setTrimEnd(parseFloat(e.target.value) || 0)}
              fullWidth
              size="small"
              InputProps={{ inputProps: { min: 0, step: 0.1 } }}
            />
          </Grid>
        </Grid>

        <Box mt={3}>
          <Typography variant="subtitle2" mb={1}>Audio Preview</Typography>
          {previewAudioUrl ? (
            <audio controls src={previewAudioUrl} style={{width: '100%', height: 40}} />
          ) : (
             <Typography variant="caption" color="text.secondary">
              To preview the audio, go back to Step 2 and generate an audio preview first.
             </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  )
}
