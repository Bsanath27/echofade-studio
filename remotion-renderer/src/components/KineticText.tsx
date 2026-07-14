import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export interface WordData {
  word: string;
  start: number;
  end: number;
}

export const KineticText: React.FC<{
  text: string;
  startTime: number;
  duration: number; // in seconds
  preset?: string;
  words?: WordData[];
  bloomColor?: string;
  bloomRadius?: number;
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
}> = ({
  text, startTime, duration, preset = 'line-pop', words: rawWords, bloomColor, bloomRadius,
  fontFamily = 'Montserrat', fontSize = 60, fontColor = '#ffffff', posX = 50, posY = 50,
  textTransform = 'uppercase', strokeWidth = 2, strokeColor = '#000000', shadowOffset = 4, lyricStyle = 'single'
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentTime = frame / fps;
  const startFrame = startTime * fps;
  const durationFrames = duration * fps;

  // If we are before the start frame or past duration, don't render line
  if (frame < startFrame || frame > startFrame + durationFrames + fps) {
    return null;
  }

  const localFrame = frame - startFrame;
  const splitWords = text.split(' ').filter((w) => w.length > 0);

  // Compute timing for each word if rawWords is missing or mismatched
  const totalChars = splitWords.reduce((acc, w) => acc + w.length, 0) || 1;
  let runningCharCount = 0;

  const wordsWithTimings = splitWords.map((wordStr, idx) => {
    if (
      rawWords &&
      rawWords[idx] &&
      rawWords[idx].word.toLowerCase().replace(/[^a-z0-9]/g, '') ===
        wordStr.toLowerCase().replace(/[^a-z0-9]/g, '')
    ) {
      return {
        word: wordStr,
        start: rawWords[idx].start,
        end: rawWords[idx].end,
      };
    }

    // Fallback proportional calculation
    const wordDur = Math.max(0.1, duration * (wordStr.length / totalChars));
    const wStart = startTime + runningCharCount * (duration / totalChars);
    const wEnd = wStart + wordDur;
    runningCharCount += wordStr.length;

    return {
      word: wordStr,
      start: wStart,
      end: wEnd,
    };
  });

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        width: '85%',
        position: 'absolute',
        top: `${posY}%`,
        left: `${posX}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {wordsWithTimings.map((w, i) => {
        const isActive = currentTime >= w.start && currentTime < w.end;
        const isPast = currentTime >= w.end;
        const isFuture = currentTime < w.start;

        // Base line entrance animation
        let lineScale = 1;
        let lineOpacity = 1;
        let yOffset = 0;

        if (preset === 'overshoot-spring') {
          lineScale = spring({
            fps,
            frame: localFrame,
            config: { damping: 11, stiffness: 150, mass: 0.4 },
          });
          lineOpacity = interpolate(
            localFrame,
            [0, 5, durationFrames - 10, durationFrames],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
        } else if (preset === 'word-stagger') {
          const wordStartFrame = i * 1;
          lineScale = spring({
            fps,
            frame: localFrame - wordStartFrame,
            config: { damping: 12, stiffness: 200, mass: 0.5 },
          });
          lineOpacity = interpolate(
            localFrame - wordStartFrame,
            [0, 5, durationFrames - 10, durationFrames],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
        } else if (preset === 'line-pop') {
          lineScale = spring({
            fps,
            frame: localFrame,
            config: { damping: 14, stiffness: 180, mass: 0.6 },
          });
          lineOpacity = interpolate(
            localFrame,
            [0, 5, durationFrames - 10, durationFrames],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
        } else if (preset === 'fade-up') {
          yOffset = interpolate(localFrame, [0, 15], [40, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          lineOpacity = interpolate(
            localFrame,
            [0, 15, durationFrames - 15, durationFrames],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
        }

        // Active word spring pop & scale bump
        const activeFrame = Math.max(0, (currentTime - w.start) * fps);
        const wordSpring = isActive
          ? spring({
              fps,
              frame: activeFrame,
              config: { damping: 10, stiffness: 220, mass: 0.4 },
            })
          : 1;

        const activeScale = isActive ? 1.0 + (wordSpring - 1) * 0.25 + 0.15 : 1.0;

        // Word styling depending on active/past/future state
        let color = 'white';
        let opacity = lineOpacity;
        let textShadow = '0px 10px 30px rgba(0,0,0,0.8)';
        let transformStr = `translateY(${yOffset}px) scale(${lineScale * activeScale})`;

        const userColor = fontColor || '#ffffff';
        if (isActive) {
          color = userColor;
          opacity = 1;
          
          const shadows = [];
          if (bloomColor && bloomRadius) {
            shadows.push(`0 0 10px rgba(255, 255, 255, 0.8), 0 0 ${bloomRadius}px ${bloomColor}, 0 0 ${bloomRadius * 2}px ${bloomColor}`);
          }
          if (strokeWidth && strokeWidth > 0) {
            shadows.push(`-${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, -${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}`);
          }
          if (shadowOffset && shadowOffset > 0) {
            shadows.push(`${shadowOffset}px ${shadowOffset}px ${Math.max(2, shadowOffset)}px rgba(0,0,0,0.8)`);
          }
          textShadow = shadows.join(', ') || 'none';
        } else if (isPast) {
          color = userColor;
          opacity = 0.95;
          
          const shadows = [];
          if (strokeWidth && strokeWidth > 0) {
            shadows.push(`-${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, -${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}`);
          }
          if (shadowOffset && shadowOffset > 0) {
            shadows.push(`${shadowOffset}px ${shadowOffset}px ${Math.max(2, shadowOffset)}px rgba(0,0,0,0.8)`);
          }
          textShadow = shadows.join(', ') || 'none';
        } else if (isFuture) {
          color = 'rgba(255, 255, 255, 0.45)';
          opacity = 0.45 * lineOpacity;
          textShadow = 'none';
        }

        return (
          <span
            key={i}
            style={{
              fontFamily: fontFamily === 'Montserrat' ? "'Montserrat', sans-serif" : `"${fontFamily}", sans-serif`,
              fontSize: `${fontSize}px`,
              fontWeight: 900,
              color,
              display: 'inline-block',
              transform: transformStr,
              opacity,
              textShadow,
              textTransform: textTransform === 'uppercase' ? 'uppercase' : (textTransform === 'lowercase' ? 'lowercase' : 'none'),
              transition: 'color 0.1s ease, opacity 0.1s ease, text-shadow 0.1s ease',
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};
