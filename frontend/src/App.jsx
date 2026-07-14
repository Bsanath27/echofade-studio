import { useState, useMemo, useEffect } from 'react'
import { ThemeProvider, createTheme, CssBaseline, Box, Drawer, Typography, ToggleButtonGroup, ToggleButton, Button, Alert } from '@mui/material'

import Navigation from './components/Navigation'
import StepImport from './components/StepImport'
import StepMaster from './components/StepMaster'
import StepTrim from './components/StepTrim'
import StepLyrics from './components/StepLyrics'
import StepExport from './components/StepExport'
import BatchGrid from './components/BatchGrid'
import Downloader from './components/Downloader'
import RotoscopeStudio from './components/RotoscopeStudio'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff7a00',
    },
    background: {
      default: '#09090b', // Solid premium dark background
      paper: '#18181b', // Slightly lighter for cards and drawer
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        }
      }
    }
  }
})

const drawerWidth = 280

function App() {
  const [mode, setMode] = useState('studio') // 'studio' | 'batch' | 'downloader'
  const [currentStep, setCurrentStep] = useState(1)
  const [status, setStatus] = useState('')

  // Shared state
  const [audioPath, setAudioPath] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const [bgFile, setBgFile] = useState(null)
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [lyrics, setLyrics] = useState('')
  const [previewAudioUrl, setPreviewAudioUrl] = useState('')
  
  // Typography
  const [fontFamily, setFontFamily] = useState('Montserrat')
  const [fontColor, setFontColor] = useState('#ffffff')
  const [fontSize, setFontSize] = useState(60)
  
  // Advanced Typography
  const [posX, setPosX] = useState(50)
  const [posY, setPosY] = useState(50)
  const [textTransform, setTextTransform] = useState('uppercase')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [shadowOffset, setShadowOffset] = useState(4)
  const [lyricStyle, setLyricStyle] = useState('single')
  const [lyricPreset, setLyricPreset] = useState('line-pop')
  const [canvasMode, setCanvasMode] = useState(false)
  
  // Advanced Aesthetics
  const [bloomColor, setBloomColor] = useState('')
  const [bloomRadius, setBloomRadius] = useState(0)
  const [beatShake, setBeatShake] = useState(false)
  const [chromaticAberration, setChromaticAberration] = useState(false)
  const [overlayVideoPath, setOverlayVideoPath] = useState('')
  const [maskSubject, setMaskSubject] = useState(false)
  const [subjectImagePath, setSubjectImagePath] = useState('')
  const [subjectOverlayUrl, setSubjectOverlayUrl] = useState('')
  
  // Timing and Intro
  const [lyricOffset, setLyricOffset] = useState(0.5)
  const [showIntro, setShowIntro] = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)

  // Background style (Phase 1: cinematic backgrounds)
  const [bgMode, setBgMode] = useState('image')
  const [bgBlur, setBgBlur] = useState(0)
  const [bgDim, setBgDim] = useState(0)
  const [kenBurns, setKenBurns] = useState(false)
  const [grain, setGrain] = useState(0)
  const [vignette, setVignette] = useState(0)
  const [gradientColors, setGradientColors] = useState(null) // null = auto-extract from image
  const [beatBounce, setBeatBounce] = useState(false)
  const [particles, setParticles] = useState(false)

  // Audio mastering
  const [speed, setSpeed] = useState(1.0)
  const [reverbRoom, setReverbRoom] = useState(0.5)
  const [reverbMix, setReverbMix] = useState(20)
  const [bassBoost, setBassBoost] = useState(0.0)
  const [trebleBoost, setTrebleBoost] = useState(0.0)
  const [warmth, setWarmth] = useState(0.0)
  const [enable8D, setEnable8D] = useState(false)
  const [orbitTime, setOrbitTime] = useState(20.0)
  const [orbitDucking, setOrbitDucking] = useState(4.0)
  const [orbitWidening, setOrbitWidening] = useState(15.0)

  // Rendering Options
  const [renderQuality, setRenderQuality] = useState('final')
  const [renderEngine, setRenderEngine] = useState('ffmpeg')
  const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [previewStage, setPreviewStage] = useState('')
  const [lastPreviewParamsString, setLastPreviewParamsString] = useState('')

  const getMasteringParamsString = () => {
    return JSON.stringify({
      audioPath, speed, reverbRoom, reverbMix, bassBoost, trebleBoost, warmth,
      enable8D, orbitTime, orbitDucking, orbitWidening, trimStart, trimEnd
    })
  }

  const handlePreview = async () => {
    if (!audioPath) return
    setIsPreviewing(true)
    setPreviewProgress(0)
    setPreviewStage('starting')
    setStatus('Rendering audio preview...')

    const jobId = Math.random().toString(36).substring(2, 10)
    const currentParams = getMasteringParamsString()

    const progressInterval = setInterval(async () => {
      try {
        const pRes = await fetch(`${API}/api/render-progress?job_id=${jobId}`)
        const pData = await pRes.json()
        setPreviewProgress(pData.progress || 0)
        setPreviewStage(pData.stage || '')
      } catch (e) {}
    }, 500)

    const formData = new FormData()
    formData.append('audio_path', audioPath)
    formData.append('job_id', jobId)
    formData.append('speed', speed)
    formData.append('reverb_room_size', reverbRoom)
    formData.append('reverb_mix', reverbMix)
    formData.append('bass_boost_db', bassBoost)
    formData.append('treble_boost_db', trebleBoost)
    formData.append('vintage_warmth', warmth)
    formData.append('enable_8d', enable8D)
    formData.append('orbit_time', orbitTime)
    formData.append('orbit_ducking', orbitDucking)
    formData.append('orbit_widening', orbitWidening / 100.0)
    formData.append('trim_start', trimStart || 0)
    formData.append('trim_end', trimEnd || 0)
    try {
      const ts = Date.now()
      const res = await fetch(`${API}/api/preview-audio`, { method: 'POST', body: formData })
      const data = await res.json()
      if (data.status === 'success') {
        setPreviewAudioUrl(`${API}${data.audio_url}?t=${ts}`)
        setLastPreviewParamsString(currentParams)
        setStatus('')
      } else {
        setStatus('Preview failed.')
      }
    } catch {
      setStatus('Failed to connect to backend.')
    }
    clearInterval(progressInterval)
    setIsPreviewing(false)
  }

  useEffect(() => {
    if ((currentStep === 4 || currentStep === 5) && audioPath) {
      const currentParams = getMasteringParamsString()
      if (currentParams !== lastPreviewParamsString && !isPreviewing) {
        handlePreview()
      }
    }
  }, [currentStep, audioPath, speed, reverbRoom, reverbMix, bassBoost, trebleBoost, warmth, enable8D, orbitTime, orbitDucking, orbitWidening, trimStart, trimEnd])

  // Compute which steps are complete
  const completedSteps = useMemo(() => {
    const completed = []
    if (audioPath && bgFile) completed.push(1)
    if (completed.includes(1) && currentStep > 2) completed.push(2)
    if (completed.includes(1) && currentStep > 3) completed.push(3)
    if (completed.includes(1) && currentStep > 4) completed.push(4)
    if (completed.includes(1) && currentStep > 5) completed.push(5)
    return completed
  }, [audioPath, bgFile, currentStep])

  const canGoNext = () => {
    if (currentStep === 1) return audioPath && bgFile
    if (currentStep === 2) return true
    if (currentStep === 3) return true
    if (currentStep === 4) return true
    if (currentStep === 5) return true
    return false
  }

  const goNext = () => {
    if (canGoNext() && currentStep < 6) setCurrentStep(currentStep + 1)
  }

  const goBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepImport
          audioPath={audioPath} setAudioPath={setAudioPath}
          songTitle={songTitle} setSongTitle={setSongTitle}
          bgFile={bgFile} setBgFile={setBgFile}
          aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
          setStatus={setStatus}
        />
      case 2:
        return <StepMaster 
          audioPath={audioPath}
          speed={speed} setSpeed={setSpeed}
          reverbRoom={reverbRoom} setReverbRoom={setReverbRoom}
          reverbMix={reverbMix} setReverbMix={setReverbMix}
          bassBoost={bassBoost} setBassBoost={setBassBoost}
          trebleBoost={trebleBoost} setTrebleBoost={setTrebleBoost}
          warmth={warmth} setWarmth={setWarmth}
          enable8D={enable8D} setEnable8D={setEnable8D}
          orbitTime={orbitTime} setOrbitTime={setOrbitTime}
          orbitDucking={orbitDucking} setOrbitDucking={setOrbitDucking}
          orbitWidening={orbitWidening} setOrbitWidening={setOrbitWidening}
          previewAudioUrl={previewAudioUrl} setPreviewAudioUrl={setPreviewAudioUrl}
          setStatus={setStatus}
          isPreviewing={isPreviewing} setIsPreviewing={setIsPreviewing}
          previewProgress={previewProgress} setPreviewProgress={setPreviewProgress}
          previewStage={previewStage} setPreviewStage={setPreviewStage}
          handlePreview={handlePreview}
        />
      case 3:
        return <StepTrim
          trimStart={trimStart} setTrimStart={setTrimStart}
          trimEnd={trimEnd} setTrimEnd={setTrimEnd}
          previewAudioUrl={previewAudioUrl}
          audioPath={audioPath}
        />
      case 4:
        return <StepLyrics
          lyrics={lyrics} setLyrics={setLyrics} speed={speed} previewAudioUrl={previewAudioUrl}
          audioPath={audioPath}
          fontFamily={fontFamily} setFontFamily={setFontFamily}
          fontColor={fontColor} setFontColor={setFontColor}
          fontSize={fontSize} setFontSize={setFontSize}
          posX={posX} setPosX={setPosX}
          posY={posY} setPosY={setPosY}
          textTransform={textTransform} setTextTransform={setTextTransform}
          strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
          strokeColor={strokeColor} setStrokeColor={setStrokeColor}
          shadowOffset={shadowOffset} setShadowOffset={setShadowOffset}
          lyricStyle={lyricStyle} setLyricStyle={setLyricStyle}
          lyricPreset={lyricPreset} setLyricPreset={setLyricPreset}
          lyricOffset={lyricOffset} setLyricOffset={setLyricOffset}
          trimStart={trimStart} setTrimStart={setTrimStart}
          trimEnd={trimEnd} setTrimEnd={setTrimEnd}
          showIntro={showIntro} setShowIntro={setShowIntro}
          songTitle={songTitle} setSongTitle={setSongTitle}
          canvasMode={canvasMode} setCanvasMode={setCanvasMode}
          aspectRatio={aspectRatio}
          bloomColor={bloomColor} setBloomColor={setBloomColor}
          bloomRadius={bloomRadius} setBloomRadius={setBloomRadius}
          beatShake={beatShake} setBeatShake={setBeatShake}
          chromaticAberration={chromaticAberration} setChromaticAberration={setChromaticAberration}
          overlayVideoPath={overlayVideoPath} setOverlayVideoPath={setOverlayVideoPath}
          maskSubject={maskSubject} setMaskSubject={setMaskSubject}
          subjectImagePath={subjectImagePath} setSubjectImagePath={setSubjectImagePath}
          subjectOverlayUrl={subjectOverlayUrl} setSubjectOverlayUrl={setSubjectOverlayUrl}
          bgMode={bgMode} setBgMode={setBgMode}
          bgBlur={bgBlur} setBgBlur={setBgBlur}
          bgDim={bgDim} setBgDim={setBgDim}
          kenBurns={kenBurns} setKenBurns={setKenBurns}
          grain={grain} setGrain={setGrain}
          vignette={vignette} setVignette={setVignette}
          gradientColors={gradientColors} setGradientColors={setGradientColors}
          beatBounce={beatBounce} setBeatBounce={setBeatBounce}
          particles={particles} setParticles={setParticles}
          bgFile={bgFile}
          isPreviewing={isPreviewing}
          previewProgress={previewProgress}
          previewStage={previewStage}
        />
      case 5:
        return <RotoscopeStudio 
          bgFile={bgFile} 
          subjectImagePath={subjectImagePath}
          setSubjectImagePath={setSubjectImagePath}
          subjectOverlayUrl={subjectOverlayUrl}
          setSubjectOverlayUrl={setSubjectOverlayUrl}
          lyrics={lyrics}
          songTitle={songTitle}
          speed={speed}
          previewAudioUrl={previewAudioUrl}
          fontFamily={fontFamily}
          fontColor={fontColor}
          fontSize={fontSize}
          posX={posX}
          posY={posY}
          textTransform={textTransform}
          strokeWidth={strokeWidth}
          strokeColor={strokeColor}
          shadowOffset={shadowOffset}
          lyricStyle={lyricStyle}
          lyricPreset={lyricPreset}
          lyricOffset={lyricOffset}
          bloomColor={bloomColor}
          bloomRadius={bloomRadius}
          beatShake={beatShake}
          chromaticAberration={chromaticAberration}
          overlayVideoPath={overlayVideoPath}
          bgBlur={bgBlur}
          bgDim={bgDim}
          kenBurns={kenBurns}
          grain={grain}
          vignette={vignette}
          gradientColors={gradientColors}
          beatBounce={beatBounce}
          particles={particles}
          maskSubject={maskSubject}
          setMaskSubject={setMaskSubject}
        />
      case 6:
        return <StepExport
          audioPath={audioPath} bgFile={bgFile} lyrics={lyrics} songTitle={songTitle}
          speed={speed} reverbRoom={reverbRoom} reverbMix={reverbMix}
          bassBoost={bassBoost} trebleBoost={trebleBoost} warmth={warmth}
          enable8D={enable8D} orbitTime={orbitTime} orbitDucking={orbitDucking} orbitWidening={orbitWidening}
          fontFamily={fontFamily} fontColor={fontColor} fontSize={fontSize}
          posX={posX} posY={posY} textTransform={textTransform}
          strokeWidth={strokeWidth} strokeColor={strokeColor} shadowOffset={shadowOffset}
          lyricStyle={lyricStyle} lyricPreset={lyricPreset} canvasMode={canvasMode} aspectRatio={aspectRatio}
          lyricOffset={lyricOffset} showIntro={showIntro} trimStart={trimStart} trimEnd={trimEnd}
          bgMode={bgMode} bgBlur={bgBlur} bgDim={bgDim} kenBurns={kenBurns} grain={grain} vignette={vignette}
          gradientColors={gradientColors} beatBounce={beatBounce} particles={particles}
          bloomColor={bloomColor} bloomRadius={bloomRadius} beatShake={beatShake}
          chromaticAberration={chromaticAberration} overlayVideoPath={overlayVideoPath}
          maskSubject={maskSubject} subjectImagePath={subjectImagePath}
          renderQuality={renderQuality} setRenderQuality={setRenderQuality}
          renderEngine={renderEngine} setRenderEngine={setRenderEngine}
          setStatus={setStatus}
        />
      default:
        return null
    }
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', p: 3 },
          }}
        >
          <Box mb={4}>
            <Typography variant="h6" fontWeight="bold">Antigravity Studio</Typography>
            <Typography variant="caption" color="text.secondary">Lyric Video Generator</Typography>
          </Box>

          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(e, newMode) => { if (newMode) setMode(newMode) }}
            aria-label="app mode"
            fullWidth
            sx={{ mb: 4 }}
            size="small"
          >
            <ToggleButton value="studio">Studio</ToggleButton>
            <ToggleButton value="batch">Batch</ToggleButton>
            <ToggleButton value="downloader">Download</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'studio' && (
            <Navigation currentStep={currentStep} setStep={setCurrentStep} completedSteps={completedSteps} />
          )}
        </Drawer>

        <Box component="main" sx={{ flexGrow: 1, p: { xs: 3, md: 6 }, overflowY: 'auto' }}>
          <Box maxWidth={(mode === 'batch' || mode === 'rotoscope') ? 1280 : mode === 'downloader' ? 720 : 900} mx="auto">
            {mode === 'batch' ? (
              <BatchGrid />
            ) : mode === 'downloader' ? (
              <Downloader />
            ) : (
              <>
                {status && (
                  <Alert severity="info" sx={{ mb: 3 }}>{status}</Alert>
                )}

                {renderStep()}

                {/* Bottom Nav */}
                <Box mt={4} pt={3} borderTop={1} borderColor="divider" display="flex" justifyContent="space-between">
                  <Box>
                    {currentStep > 1 && currentStep < 6 && (
                      <Button variant="outlined" onClick={goBack}>Back</Button>
                    )}
                    {currentStep === 6 && (
                      <Button variant="outlined" onClick={goBack}>Back to Masking</Button>
                    )}
                  </Box>
                  {currentStep < 6 && (
                    <Button 
                      variant="contained" 
                      color="primary" 
                      onClick={goNext}
                      disabled={!canGoNext()}
                    >
                      Next
                    </Button>
                  )}
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}

export default App
