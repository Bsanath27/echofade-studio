import React, { useMemo } from 'react';
import { useCurrentFrame, random } from 'remotion';

export const DustParticles: React.FC<{ count?: number }> = ({ count = 50 }) => {
  const frame = useCurrentFrame();

  const particles = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => ({
      x: random(`x-${i}`) * 100, // percentage
      y: random(`y-${i}`) * 100, // percentage
      size: random(`size-${i}`) * 4 + 1, // px
      speedX: (random(`sx-${i}`) - 0.5) * 0.1,
      speedY: (random(`sy-${i}`) - 0.5) * 0.1 - 0.05, // generally drift upwards
      opacity: random(`op-${i}`) * 0.5 + 0.1,
    }));
  }, [count]);

  return (
    <div style={{ position: 'absolute', width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', mixBlendMode: 'screen' }}>
      {particles.map((p, i) => {
        const currentX = (p.x + p.speedX * frame) % 100;
        const currentY = (p.y + p.speedY * frame) % 100;
        
        // Wrap around logic handles negative modulo
        const wrappedX = currentX < 0 ? 100 + currentX : currentX;
        const wrappedY = currentY < 0 ? 100 + currentY : currentY;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${wrappedX}%`,
              top: `${wrappedY}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: 'white',
              borderRadius: '50%',
              opacity: p.opacity,
              filter: 'blur(1px)',
            }}
          />
        );
      })}
    </div>
  );
};
