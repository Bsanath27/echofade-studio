# Cinematic Lyric Visuals — Design

Date: 2026-06-28
Scope: Mac-only (consistent with the project's current decision). Bring the
visual language of channels like 7clouds — cinematic backgrounds, channel-grade
fonts, and animated lyrics — into the existing render pipeline.

## Goal

Make the rendered videos look like the polished slowed+reverb / lyric channels
(7clouds and peers): blurred dimmed backgrounds with subtle motion, clean bold
typography, and lyrics that animate (fade, pop, slide, word-by-word karaoke),
finished with film grain / vignette / glow. Delivered as four independent,
individually shippable phases plus one-click "Visual Presets" that bundle a full
look.

## Reference aesthetic (research synthesis)

- **Fonts:** 7clouds' brush logo is *Edo SZ* (proprietary). The lyric *body* is a
  clean bold sans (Montserrat/Poppins/Gilroy family). We bundle open-licensed
  lookalikes and let the user upload their own `.ttf`/`.otf` for personal use.
- **Backgrounds:** album art scaled up + heavy gaussian blur; a 20–30% dark
  overlay so text pops; optionally a color-extracted gradient instead of the
  literal image; slow Ken Burns zoom; film grain; vignette.
- **Animation:** fade in/out, word-by-word karaoke highlight (the signature
  modern look), entry pop/scale, slide-up on line change, soft glow.

## Key architectural insight

The renderer is `ffmpeg ... -vf "scale,crop,ass='subs.ass'"`. Nearly all of this
is **additive** to that chain — no rewrite, no heavy new dependencies:

- Background treatments = more ffmpeg video filters before `ass`
  (`gblur`, `drawbox`, `zoompan`, `noise`, `vignette`, `gradients`).
- Text treatments = ASS override tags (`\t`, `\move`, `\blur`, `\fad`, `\kf`).
- Color extraction = a small Pillow pre-pass (Pillow already present via MoviePy).
- Font name parsing for uploads = `fonttools` (new, lightweight dependency).

**All new visual features target the ffmpeg engine only** (the default,
recommended path). The legacy MoviePy engine ignores them and keeps its current
behavior — we do not double-implement on the deprecated path.

These features affect video only, so they are added to `POST /api/render`. The
audio preview endpoint is unchanged.

---

## Phase 1 — Cinematic backgrounds

New render params (all with safe defaults that reproduce current output when off):

| Param | Range / values | Default | Filter |
|---|---|---|---|
| `bg_mode` | `image` \| `gradient` | `image` | input source |
| `bg_blur` | 0–40 (sigma) | 0 | `gblur=sigma=N` |
| `bg_dim` | 0–0.6 (overlay opacity) | 0 | `drawbox=...:color=black@N:t=fill` |
| `ken_burns` | bool | false | `zoompan` slow zoom |
| `grain` | 0–30 | 0 | `noise=alls=N:allf=t+u` |
| `vignette` | 0–1 (strength) | 0 | `vignette=a=ANGLE` |

**Filter order** (built dynamically, only including enabled stages):
`scale/crop → zoompan(Ken Burns) → gblur → drawbox(dim) → noise(grain) →
vignette → ass`. Text (`ass`) stays last so lyrics remain crisp above grain and
vignette.

**Ken Burns** uses `zoompan` with a per-frame zoom increment on the looped still
(e.g. `z='min(pzoom+0.0002,1.2)'`, recentered), `s={res_w}x{res_h}:fps={fps}`.
Applied to still images only; skipped for video backgrounds.

**Gradient mode** (`bg_mode=gradient`): a Pillow pre-pass extracts 2–3 dominant
colors from the uploaded image (PIL quantize), then the ffmpeg `gradients` source
filter generates an animated gradient at the target resolution using those
colors, replacing the image input. Grain/vignette still apply.

**Draft quality** reduces effect cost (smaller blur sigma, grain optional) to keep
preview renders fast.

**UI:** a "Background Style" panel added to **Step 3 (Lyrics)** so background and
text are designed together against the live preview. The Step 3 preview
approximates effects in CSS: `filter: blur() brightness()`, a vignette radial
overlay, a tiled-noise grain overlay, and a slow CSS `transform: scale()`
animation for Ken Burns.

State lives in `App.jsx`, passed to `StepLyrics` (preview) and `StepExport`
(render request).

---

## Phase 2 — Font pack + custom upload

**Bundled open fonts** in `backend/fonts/` (all OFL/Apache, redistributable):
Montserrat (have it), Poppins, Oswald, Bebas Neue, Anton, and one free brush/
handwritten face (e.g. Caveat or Permanent Marker) as an open Edo-SZ-style
stand-in for title text.

**libass wiring:** pass the fonts directory to the filter
(`ass='{path}':fontsdir='{fonts_dir}'`) and use each font's exact internal family
name (read via `fonttools` `TTFont` name table) as the ASS `Fontname`, so libass
resolves bundled fonts deterministically instead of relying on system fontconfig.
This also fixes today's Mac-only `font_map` that points at `/System/Library/...`.

**Custom upload:** `POST /api/upload-font` saves a `.ttf`/`.otf` into a user-fonts
directory (also included in `fontsdir`), parses its family name with `fonttools`,
and returns it. The font then appears in the dropdown.

**UI:** the font dropdown lists bundled + uploaded fonts; an "Upload font" button;
each option previewed in-browser via an `@font-face` that loads the file from a
new `/fonts/{name}` static route.

**Dependency:** add `fonttools` to `requirements.txt`.

---

## Phase 3 — Lyric animation styles

New param `animation_style`: `fade` (current) | `pop` | `slide` | `word` |
`typewriter` (typewriter is a stretch). Plus `glow` (bool) and `glow_intensity`.

Implemented in `generate_ass_subtitles`, branching per style. Works with both
`single` and `stack` lyric layouts (animation applies to the active line):

- **fade:** `\fad(500,500)` (unchanged).
- **pop:** fade + scale up on entry — `{\fad(200,300)\fscx80\fscy80\t(0,250,\fscx100\fscy100)}`.
- **slide:** `\move(x, y+40, x, y, 0, 300)` + fade — line rises into place.
- **word (karaoke highlight):** build the line as
  `{\kf<cs>}word1 {\kf<cs>}word2 ...`; Style SecondaryColour = dim/unsung,
  PrimaryColour = bright/sung, so `\kf` sweeps the fill across each word.
  **Word timing source:**
  - *Interpolated (default):* distribute the line's duration across words
    weighted by character count. Works for any LRC, no dependency.
  - *Whisper-precise (optional toggle):* re-run Whisper with
    `word_timestamps=True` on the original audio for exact per-word timing.
    Slower; only offered when AI transcription is in play.
- **glow:** emit a blurred duplicate Dialogue behind the text
  (`\blur{intensity}\bord0` in the accent color), then the crisp text on top.

**UI:** an "Animation" selector in Step 3 + a glow toggle/slider. The live
preview already tracks `audio.currentTime`, so it can animate word highlight and
entry transitions in real time for true WYSIWYG.

---

## Phase 4 — One-click Visual Presets

A "look" bundles every visual knob (bg_mode, bg_blur, bg_dim, ken_burns, grain,
vignette, font, animation_style, glow, font_color, stroke, lyric_style). Named
presets, applied from a pill bar in Step 3 (mirroring the audio presets in
Step 2):

- **7clouds Classic** — blurred + dimmed image, slow Ken Burns, Poppins/Montserrat
  bold white, fade, subtle shadow, light vignette.
- **Lofi Grain** — warm, heavy grain + vignette, slightly dimmed, Oswald, fade.
- **Aurora Gradient** — `bg_mode=gradient` (color-extracted, animated), Poppins,
  pop-in, glow.
- **Karaoke Bounce** — word-by-word highlight, Bebas/Anton, glow, light blur.
- **Spotify Card** *(stretch)* — now-playing card layout; larger layout change,
  optional, deferred unless prioritized.

---

## Files touched (by phase)

- **P1:** `backend/ffmpeg_engine.py` (dynamic `-vf` builder, gradient pre-pass),
  `backend/main.py` (new render form fields), `frontend/src/App.jsx` (+state),
  `frontend/src/components/StepLyrics.jsx` (Background Style panel + preview
  approximations), `frontend/src/components/StepExport.jsx` (send fields).
  New: a small `backend/color_extract.py` (Pillow dominant-color helper).
- **P2:** `backend/fonts/` (bundled `.ttf`), `backend/ffmpeg_engine.py`
  (`fontsdir` + internal-name map), `backend/main.py` (`/api/upload-font`,
  `/fonts` route), `requirements.txt` (`fonttools`), `StepLyrics.jsx` (font
  upload + `@font-face` previews).
- **P3:** `backend/ffmpeg_engine.py` (animation branches, glow), optional Whisper
  word-timestamp path in `backend/main.py`, `StepLyrics.jsx` (animation selector
  + preview animation).
- **P4:** `frontend/src/components/StepLyrics.jsx` (visual preset pill bar +
  apply logic).

## Out of scope

- MoviePy legacy engine parity for any new visual feature.
- Portability work (still Mac-only by project decision).
- The "Spotify Card" layout (stretch within P4).
- Beat-synced background cutting / multi-clip backgrounds.

## Verification plan

Per phase: render short test clips through the ffmpeg engine with the new params,
extract frames with ffprobe/ffmpeg, and visually confirm (the workflow already
used in this project). Specifically:

- P1: confirm blur/dim/grain/vignette visibly applied and Ken Burns produces
  motion across frames; gradient mode produces a colored animated background.
- P2: confirm bundled fonts render via `fontsdir`, and an uploaded `.ttf` is
  resolvable by its parsed family name.
- P3: extract frames mid-line to confirm word highlight sweep, pop/slide entry,
  and glow; confirm fade still matches current behavior.
- P4: apply each preset and confirm it sets the full visual state and renders the
  intended look.

## Risks & mitigations

- **libass font resolution** — bundled/uploaded fonts must match their internal
  family name exactly. Mitigation: parse the name table with `fonttools` and use
  that string; always pass `fontsdir`.
- **Ken Burns jitter** on looped stills — tune `zoompan` increment/`d`; fall back
  to a CSS-style scale-crop if needed.
- **Word-timing drift** on lines with long instrumental gaps — acceptable for the
  interpolated default; Whisper-precise available when accuracy matters.
- **Render time** grows with stacked filters — keep draft mode light; document the
  cost.
- **`gradients` filter availability** in the installed ffmpeg build — verify
  during P1; fall back to a Pillow-rendered static gradient if absent.
