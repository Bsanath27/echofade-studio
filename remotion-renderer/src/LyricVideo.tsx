import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, Audio, OffthreadVideo } from 'remotion';
import React, { useMemo } from 'react';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { DustParticles } from './components/DustParticles';
import { KineticText } from './components/KineticText';

const GrainOverlay: React.FC<{ strength: number }> = ({ strength }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;
    const amount = (strength / 100) * 255;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * amount;
      data[i] = Math.min(255, Math.max(0, 128 + noise));
      data[i+1] = Math.min(255, Math.max(0, 128 + noise));
      data[i+2] = Math.min(255, Math.max(0, 128 + noise));
      data[i+3] = (strength / 100) * 45; // alpha scaling for visible noise
    }
    ctx.putImageData(imgData, 0, 0);
  }, [frame, width, height, strength]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'overlay', zIndex: 3 }} 
    />
  );
};

export const LyricVideo: React.FC<{
  audioUrl: string;
  bgUrl: string;
  lyrics: { time: number; text: string; words?: { word: string; start: number; end: number }[] }[];
  theme: string;
  lyricPreset?: string;
  beatBounce?: boolean;
  particles?: boolean;
  showIntro?: boolean;
  songTitle?: string;
  bloomColor?: string;
  bloomRadius?: number;
  beatShake?: boolean;
  chromaticAberration?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  posX?: number;
  posY?: number;
  textTransform?: string;
  strokeWidth?: number;
  strokeColor?: string;
  shadowOffset?: number;
  lyricStyle?: string;
  bgMode?: string;
  bgBlur?: number;
  bgDim?: number;
  gradientColors?: string[] | null;
  grain?: number;
  vignetteStrength?: number;
  maskSubject?: boolean;
  subjectImageUrl?: string;
  overlayUrl?: string;
  overlayOpacity?: number;
  overlayMode?: string;
}> = ({
  audioUrl, bgUrl, lyrics, lyricPreset = 'line-pop', beatBounce = false, particles = false,
  showIntro = false, songTitle = '', bloomColor, bloomRadius, beatShake = false, chromaticAberration = false,
  fontFamily = 'Montserrat', fontSize = 60, fontColor = '#ffffff', posX = 50, posY = 50,
  textTransform = 'uppercase', strokeWidth = 2, strokeColor = '#000000', shadowOffset = 4, lyricStyle = 'single',
  bgMode = 'image', bgBlur = 0, bgDim = 0, gradientColors = null,
  grain = 0, vignetteStrength = 0, maskSubject = false, subjectImageUrl = '',
  overlayUrl = '', overlayOpacity = 0.4, overlayMode = 'screen'
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Audio visualization (Optional: only if audioUrl is provided and valid and beatBounce is enabled)
  const audioData = useAudioData(audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
  
  let scaleBump = 1;
  let dx = 0;
  let dy = 0;
  let chromaOffset = 0;
  
  if (audioData) {
    const visualization = visualizeAudio({
      fps,
      frame,
      audioData,
      numberOfSamples: 16,
    });
    // Use the low frequencies (bass/kick)
    const bass = visualization[0] + visualization[1];
    
    if (beatBounce) {
      scaleBump = 1 + (bass * 0.05); // Max 5% scale bump on beat
    }
    
    if (beatShake) {
      dx = Math.sin(bass * 15.0) * 20.0 * bass;
      dy = Math.cos(bass * 12.0) * 20.0 * bass;
    }
    
    if (chromaticAberration && bass > 0.3) {
      chromaOffset = ((bass - 0.3) / 0.7) * 15;
    }
  }

  const gradStyle = gradientColors && gradientColors.length > 0
    ? `linear-gradient(135deg, ${gradientColors.join(', ')})`
    : 'linear-gradient(135deg, #111, #333)';

  const isVideo = bgUrl && (
    bgUrl.toLowerCase().includes('.mp4') ||
    bgUrl.toLowerCase().includes('.mov') ||
    bgUrl.toLowerCase().includes('.webm') ||
    bgUrl.toLowerCase().includes('.gif') ||
    bgUrl.startsWith('data:video/')
  );

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      
      {/* Background with optional Beat Bump, Shake, and Chromatic Aberration */}
      <AbsoluteFill style={{ transform: `scale(${scaleBump}) translate(${dx}px, ${dy}px)`, transition: 'transform 0.1s ease-out' }}>
        {bgMode === 'image' && bgUrl ? (
          isVideo ? (
            <OffthreadVideo 
              src={bgUrl} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: bgBlur > 0 ? `blur(${bgBlur}px)` : 'none' }} 
              loop
              muted
            />
          ) : (
            <>
              <Img 
                src={bgUrl} 
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: bgBlur > 0 ? `blur(${bgBlur}px)` : 'none' }} 
              />
              {chromaticAberration && chromaOffset > 0 && (
                <Img 
                  src={bgUrl} 
                  style={{ position: 'absolute', top: 0, left: `${chromaOffset}px`, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'screen', filter: bgBlur > 0 ? `blur(${bgBlur}px) sepia(100%) hue-rotate(300deg) saturate(300%)` : 'sepia(100%) hue-rotate(300deg) saturate(300%)' }} 
                />
              )}
            </>
          )
        ) : bgMode === 'gradient' ? (
          <div style={{ width: '100%', height: '100%', background: gradStyle }} />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: 'black' }} />
        )}
      </AbsoluteFill>

      {/* Dim Overlay */}
      {bgDim > 0 && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'black', opacity: bgDim, pointerEvents: 'none', zIndex: 1 }} />
      )}

      {/* Video Overlay Layer */}
      {overlayUrl && (
        <AbsoluteFill style={{ mixBlendMode: overlayMode as any, opacity: overlayOpacity, pointerEvents: 'none', zIndex: 2 }}>
          <OffthreadVideo 
            src={overlayUrl} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loop
            muted
          />
        </AbsoluteFill>
      )}

      {/* Vignette Overlay */}
      {vignetteStrength > 0 && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',
          background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${vignetteStrength * 0.95}) 100%)`,
          zIndex: 2
        }} />
      )}

      {/* Grain Overlay */}
      {grain > 0 && <GrainOverlay strength={grain} />}
      
      {/* Particles */}
      {particles && <DustParticles count={100} />}
      
      {/* Intro Title Screen */}
      {showIntro && songTitle && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: frame < Math.min((lyrics[0]?.time || 4) * fps, 4 * fps) ? 1 : 0,
          transition: 'opacity 0.5s ease-out',
          zIndex: 10
        }}>
          <h1 style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '120px',
            fontWeight: 900,
            color: 'white',
            textTransform: 'uppercase',
            textShadow: '0px 10px 30px rgba(0,0,0,0.8)',
            textAlign: 'center',
            margin: 0
          }}>
            {songTitle}
          </h1>
        </div>
      )}
      
      {/* Kinetic Typography */}
      {lyrics.map((lyric, index) => {
        // Calculate duration until the next lyric (or 3 seconds if it's the last one)
        const nextTime = lyrics[index + 1]?.time;
        const duration = nextTime ? nextTime - lyric.time : 3;
        
        return (
          <KineticText 
            key={index} 
            text={lyric.text} 
            startTime={lyric.time} 
            duration={duration} 
            preset={lyricPreset}
            words={lyric.words}
            bloomColor={bloomColor}
            bloomRadius={bloomRadius}
            fontFamily={fontFamily}
            fontSize={fontSize}
            fontColor={fontColor}
            posX={posX}
            posY={posY}
            textTransform={textTransform}
            strokeWidth={strokeWidth}
            strokeColor={strokeColor}
            shadowOffset={shadowOffset}
            lyricStyle={lyricStyle}
          />
        );
      })}

      {/* Subject Mask Overlay Layer (3D Depth) */}
      {maskSubject && subjectImageUrl && (
        <AbsoluteFill style={{ transform: `scale(${scaleBump}) translate(${dx}px, ${dy}px)`, transition: 'transform 0.1s ease-out', pointerEvents: 'none', zIndex: 5 }}>
          <Img 
            src={subjectImageUrl} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        </AbsoluteFill>
      )}
      
      {audioUrl && <Audio src={audioUrl} />}
    </AbsoluteFill>
  );
};
