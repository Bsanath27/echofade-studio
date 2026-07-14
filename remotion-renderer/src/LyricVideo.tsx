import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, Audio } from 'remotion';
import React, { useMemo } from 'react';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { DustParticles } from './components/DustParticles';
import { KineticText } from './components/KineticText';

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
}> = ({ audioUrl, bgUrl, lyrics, lyricPreset = 'line-pop', beatBounce = false, particles = false, showIntro = false, songTitle = '', bloomColor, bloomRadius, beatShake = false, chromaticAberration = false }) => {
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

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      
      {/* Background with optional Beat Bump, Shake, and Chromatic Aberration */}
      <AbsoluteFill style={{ transform: `scale(${scaleBump}) translate(${dx}px, ${dy}px)`, transition: 'transform 0.1s ease-out' }}>
        {bgUrl ? (
          <>
            <Img 
              src={bgUrl} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, filter: 'blur(4px)' }} 
            />
            {chromaticAberration && chromaOffset > 0 && (
              <Img 
                src={bgUrl} 
                style={{ position: 'absolute', top: 0, left: `${chromaOffset}px`, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, mixBlendMode: 'screen', filter: 'blur(4px) sepia(100%) hue-rotate(300deg) saturate(300%)' }} 
              />
            )}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #111, #333)' }} />
        )}
      </AbsoluteFill>
      
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
          />
        );
      })}

      
      {audioUrl && <Audio src={audioUrl} />}
    </AbsoluteFill>
  );
};
