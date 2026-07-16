// ── Font / typography presets ──
// Looks pulled from the dominant lyric-video aesthetics (7clouds-clean, bold
// outline, minimal, soft-glow, fashion-serif, mass-impact). Each sets the full
// typography stack so one click gives a finished look.
export const FONT_PRESETS = [
  { name: 'CloudKid Glow',   font: 'Montserrat',    size: 64, stroke: 0, strokeColor: '#000000', shadow: 0,  color: '#ffffff', bloomColor: '#00e5ff', bloomRadius: 15, transform: 'uppercase', preset: 'overshoot-spring' },
  { name: 'Trap Nation',     font: 'Futura',        size: 72, stroke: 3, strokeColor: '#000000', shadow: 0,  color: '#ffffff', bloomColor: '',        bloomRadius: 0,  transform: 'uppercase', preset: 'line-pop' },
  { name: 'Lyrical Lemonade',font: 'Impact',        size: 88, stroke: 4, strokeColor: '#000000', shadow: 0,  color: '#ffd700', bloomColor: '',        bloomRadius: 0,  transform: 'uppercase', preset: 'word-stagger' },
  { name: 'Acoustic Chill',  font: 'Baskerville',   size: 60, stroke: 0, strokeColor: '#000000', shadow: 2,  color: '#ffffff', bloomColor: '',        bloomRadius: 0,  transform: 'none',      preset: 'fade-up' },
  { name: '7clouds Modern',  font: 'Avenir Next',   size: 64, stroke: 0, strokeColor: '#000000', shadow: 6,  color: '#ffffff', bloomColor: '',        bloomRadius: 0,  transform: 'uppercase', preset: 'line-pop' },
  { name: 'Cinematic Title', font: 'Didot',         size: 66, stroke: 0, strokeColor: '#000000', shadow: 8,  color: '#ffffff', bloomColor: '#ffffff', bloomRadius: 8,  transform: 'none',      preset: 'fade-up' },
  { name: 'Retro Waves',     font: 'Helvetica Neue',size: 70, stroke: 0, strokeColor: '#000000', shadow: 4,  color: '#ff007f', bloomColor: '#ff007f', bloomRadius: 12, transform: 'uppercase', preset: 'overshoot-spring' },
  { name: 'Cyberpunk Neon',  font: 'Futura',        size: 76, stroke: 2, strokeColor: '#000000', shadow: 0,  color: '#39ff14', bloomColor: '#39ff14', bloomRadius: 20, transform: 'uppercase', preset: 'line-pop' },
  { name: 'Elegant Poetry',  font: 'Didot',         size: 56, stroke: 0, strokeColor: '#000000', shadow: 0,  color: '#fffdd0', bloomColor: '#fffdd0', bloomRadius: 5,  transform: 'none',      preset: 'fade-up' },
]

// ── 8D spatial presets ── (each enables 8D and sets the orbit motion)
export const EIGHTD_PRESETS = [
  { name: 'Slow Float',     orbitTime: 28, orbitDucking: 3, orbitWidening: 18 },
  { name: 'Classic Orbit',  orbitTime: 20, orbitDucking: 4, orbitWidening: 22 },
  { name: 'Fast Spin',      orbitTime: 10, orbitDucking: 5, orbitWidening: 30 },
  { name: 'Wide Cinematic', orbitTime: 24, orbitDucking: 4, orbitWidening: 42 },
  { name: 'Subtle Sway',    orbitTime: 34, orbitDucking: 2, orbitWidening: 12 },
]

// ── Colourful background gradient palettes ── (top→bottom)
export const BG_GRADIENTS = [
  { name: 'Sunset',     colors: ['#FF512F', '#DD2476'] },
  { name: 'Aurora',     colors: ['#1FA2FF', '#12D8FA', '#A6FFCB'] },
  { name: 'Vaporwave',  colors: ['#a18cd1', '#fbc2eb'] },
  { name: 'Neon',       colors: ['#7F00FF', '#E100FF'] },
  { name: 'Ocean',      colors: ['#2E3192', '#1BFFFF'] },
  { name: 'Ember',      colors: ['#f12711', '#f5af19'] },
  { name: 'Midnight',   colors: ['#0F2027', '#2C5364'] },
  { name: 'Rose Gold',  colors: ['#ee9ca7', '#ffdde1'] },
]

// Audio presets shared by the Master Audio wizard step and the Batch grid.
export const PRESETS = [
  {
    name: 'Original Audio (No Changes)',
    desc: 'Keep the audio exactly as is, with no slowed/reverb or 8D effects',
    values: { speed: 1.0, reverbRoom: 0.0, reverbMix: 0, bassBoost: 0.0, trebleBoost: 0.0, warmth: 0.0, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10, skipAudioProcessing: true }
  },
  {
    name: 'Classic Slowed+Reverb',
    desc: 'The YouTube standard — gentle slowdown, medium reverb, warm bass',
    values: { speed: 0.85, reverbRoom: 0.55, reverbMix: 28, bassBoost: 2.5, trebleBoost: -1, warmth: 0.25, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 15 }
  },
  {
    name: 'Daycore',
    desc: 'Deep pitch drop, heavy reverb, subterranean bass — the moody aesthetic',
    values: { speed: 0.75, reverbRoom: 0.7, reverbMix: 34, bassBoost: 3.5, trebleBoost: -3, warmth: 0.5, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Lo-Fi Bedroom',
    desc: 'Warm analog saturation, rolled-off highs, cozy late-night vibe',
    values: { speed: 0.9, reverbRoom: 0.45, reverbMix: 22, bassBoost: 3, trebleBoost: -4, warmth: 0.7, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Ethereal 8D',
    desc: 'Slow orbit with spacious reverb — sounds like floating in a cathedral',
    values: { speed: 0.88, reverbRoom: 0.75, reverbMix: 35, bassBoost: 1, trebleBoost: 0, warmth: 0.2, enable8D: true, orbitTime: 24, orbitDucking: 4, orbitWidening: 20 }
  },
  {
    name: 'Club 8D',
    desc: 'Tighter orbit, punchy bass, minimal reverb — 8D that hits hard',
    values: { speed: 0.95, reverbRoom: 0.3, reverbMix: 15, bassBoost: 4, trebleBoost: 1, warmth: 0.1, enable8D: true, orbitTime: 12, orbitDucking: 6, orbitWidening: 30 }
  },
  {
    name: 'Nightcore',
    desc: 'Sped up, bright, and airy — anime edit energy',
    values: { speed: 1.25, reverbRoom: 0.25, reverbMix: 12, bassBoost: -1, trebleBoost: 3, warmth: 0, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Vapor Wave',
    desc: 'Extreme slow, heavy saturation, drenched in reverb — A E S T H E T I C',
    values: { speed: 0.7, reverbRoom: 0.85, reverbMix: 44, bassBoost: 4, trebleBoost: -5, warmth: 0.8, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Clean + Subtle',
    desc: 'Barely slowed, light reverb — just enough to make it feel dreamy',
    values: { speed: 0.93, reverbRoom: 0.35, reverbMix: 18, bassBoost: 1, trebleBoost: 0, warmth: 0.1, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Sped-Up (TikTok)',
    desc: 'Gentle speed-up, bright and crisp — the mainstream "sped up version" sound',
    values: { speed: 1.15, reverbRoom: 0.3, reverbMix: 16, bassBoost: 0, trebleBoost: 1.5, warmth: 0.05, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Another Room',
    desc: 'Muffled, rolled-off highs — like it’s playing in the next room',
    values: { speed: 0.9, reverbRoom: 0.5, reverbMix: 30, bassBoost: 1, trebleBoost: -8, warmth: 0.15, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Phonk Drift',
    desc: 'Heavy saturated low-end, tight and punchy — for drift & car edits',
    values: { speed: 0.92, reverbRoom: 0.25, reverbMix: 12, bassBoost: 6, trebleBoost: 1, warmth: 0.45, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Arena Live',
    desc: 'Big-venue reverb — imagine you’re standing at the concert',
    values: { speed: 0.95, reverbRoom: 0.9, reverbMix: 32, bassBoost: 2, trebleBoost: -1, warmth: 0.1, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Sleep / Rain',
    desc: 'Soft and hazy with rolled-off rumble — for hours-long sleep & study',
    values: { speed: 0.82, reverbRoom: 0.8, reverbMix: 36, bassBoost: -1, trebleBoost: -3, warmth: 0.2, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },

  // ── Tamil-tuned presets ──
  {
    name: 'Tamil Feel (Melody)',
    category: 'Tamil',
    desc: 'The love-failure / melody default — gentle slow, warm lush reverb, vocals kept forward (Po Nee Po, Kanave Kanave)',
    values: { speed: 0.88, reverbRoom: 0.62, reverbMix: 30, bassBoost: 2.5, trebleBoost: 0.5, warmth: 0.3, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Sid Sriram Soul',
    category: 'Tamil',
    desc: 'Airy and spacious for breathy gospel-soul vocals — big reverb, extra air on top (Kalaavathi, Adiye, Ennodu Nee Irundhaal)',
    values: { speed: 0.90, reverbRoom: 0.72, reverbMix: 34, bassBoost: 1.5, trebleBoost: 2, warmth: 0.15, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'A.R. Rahman Hall',
    category: 'Tamil',
    desc: 'Grand orchestral hall for string-led Rahman melodies — biggest reverb, balanced tone (Munbe Vaa, Uyire, Mannipaaya)',
    values: { speed: 0.87, reverbRoom: 0.85, reverbMix: 36, bassBoost: 2, trebleBoost: 0, warmth: 0.2, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Kuthu Slowed (Mass)',
    category: 'Tamil',
    desc: 'Keeps the groove on Anirudh mass/beat tracks — barely slowed, punchy bass, tight reverb (Vaathi Coming, Arabic Kuthu)',
    values: { speed: 0.93, reverbRoom: 0.34, reverbMix: 16, bassBoost: 5, trebleBoost: 1, warmth: 0.2, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  },
  {
    name: 'Tamil Lofi Night',
    category: 'Tamil',
    desc: 'Cozy late-night Tamil lofi — warm saturation, softly rolled highs (Nenjukulle, Kannazhaga, Aaruyirae)',
    values: { speed: 0.89, reverbRoom: 0.5, reverbMix: 24, bassBoost: 3, trebleBoost: -2.5, warmth: 0.55, enable8D: false, orbitTime: 20, orbitDucking: 4, orbitWidening: 10 }
  }
]
