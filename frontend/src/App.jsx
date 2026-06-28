import { useState, useMemo } from 'react'
import Navigation from './components/Navigation'
import StepImport from './components/StepImport'
import StepMaster from './components/StepMaster'
import StepLyrics from './components/StepLyrics'
import StepExport from './components/StepExport'

function App() {
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

  // Background style (Phase 1: cinematic backgrounds)
  const [bgMode, setBgMode] = useState('image')
  const [bgBlur, setBgBlur] = useState(0)
  const [bgDim, setBgDim] = useState(0)
  const [kenBurns, setKenBurns] = useState(false)
  const [grain, setGrain] = useState(0)
  const [vignette, setVignette] = useState(0)

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

  // Compute which steps are complete
  const completedSteps = useMemo(() => {
    const completed = []
    if (audioPath && bgFile) completed.push(1)
    // Step 2 is "complete" once the user has visited it (we don't gate on preview)
    if (completed.includes(1) && currentStep > 2) completed.push(2)
    if (completed.includes(1) && currentStep > 3) completed.push(3)
    return completed
  }, [audioPath, bgFile, currentStep])

  const canGoNext = () => {
    if (currentStep === 1) return audioPath && bgFile
    if (currentStep === 2) return true
    if (currentStep === 3) return true
    return false
  }

  const goNext = () => {
    if (canGoNext() && currentStep < 4) setCurrentStep(currentStep + 1)
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
        />
      case 3:
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
          aspectRatio={aspectRatio}
          bgMode={bgMode} setBgMode={setBgMode}
          bgBlur={bgBlur} setBgBlur={setBgBlur}
          bgDim={bgDim} setBgDim={setBgDim}
          kenBurns={kenBurns} setKenBurns={setKenBurns}
          grain={grain} setGrain={setGrain}
          vignette={vignette} setVignette={setVignette}
          bgFile={bgFile}
        />
      case 4:
        return <StepExport
          audioPath={audioPath} bgFile={bgFile} lyrics={lyrics} songTitle={songTitle}
          speed={speed} reverbRoom={reverbRoom} reverbMix={reverbMix}
          bassBoost={bassBoost} trebleBoost={trebleBoost} warmth={warmth}
          enable8D={enable8D} orbitTime={orbitTime} orbitDucking={orbitDucking} orbitWidening={orbitWidening}
          fontFamily={fontFamily} fontColor={fontColor} fontSize={fontSize}
          posX={posX} posY={posY} textTransform={textTransform}
          strokeWidth={strokeWidth} strokeColor={strokeColor} shadowOffset={shadowOffset}
          lyricStyle={lyricStyle} aspectRatio={aspectRatio}
          bgMode={bgMode} bgBlur={bgBlur} bgDim={bgDim} kenBurns={kenBurns} grain={grain} vignette={vignette}
          renderQuality={renderQuality} setRenderQuality={setRenderQuality}
          renderEngine={renderEngine} setRenderEngine={setRenderEngine}
          setStatus={setStatus}
        />
      default:
        return null
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>Antigravity Studio</h1>
          <p>Lyric Video Generator</p>
        </div>
        <Navigation currentStep={currentStep} setStep={setCurrentStep} completedSteps={completedSteps} />
      </aside>

      <main className="workspace">
        <div className="workspace-inner">
          {status && (
            <div style={{
              padding: '12px 16px', background: 'var(--accent-subtle)',
              border: '1px solid rgba(255,122,0,0.2)', borderRadius: '8px',
              marginBottom: '24px', color: 'var(--accent)', fontSize: '0.9rem', fontWeight: '500'
            }}>{status}</div>
          )}

          {renderStep()}

          {/* Bottom Nav */}
          {currentStep < 4 && (
            <div className="bottom-nav">
              <div>
                {currentStep > 1 && (
                  <button className="btn" onClick={goBack}>← Back</button>
                )}
              </div>
              <button 
                className="btn btn-primary" 
                onClick={goNext}
                disabled={!canGoNext()}
              >
                Next →
              </button>
            </div>
          )}
          {currentStep === 4 && (
            <div className="bottom-nav">
              <button className="btn" onClick={goBack}>← Back to Lyrics</button>
              <div></div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
