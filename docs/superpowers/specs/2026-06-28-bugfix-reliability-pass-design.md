# Bug-fix & Reliability Pass — Design

Date: 2026-06-28
Scope: Mac-only (no portability work in this pass). Fix the bugs that block the core
import → master → lyrics → export loop from reliably producing a usable video.

## Context

Antigravity Studio is a 4-step local wizard (FastAPI + React/Vite) that turns a song
into a "slowed + reverb" style lyric video. The end-to-end loop has several
correctness bugs that block real use, plus some rough edges around progress
feedback and preview/output parity. This pass fixes all of them.

## Bugs fixed

### 1. Broken download/preview URL (critical)
`POST /api/render` saves the output as `{file_name}.mp4` but returns `video_url` /
`download_url` built from the un-suffixed `file_name`, and does not URL-encode
spaces/parens in the path. Default filenames like `"Title (Slowed + Reverb)"` 404
on both the in-page `<video>` preview and the download link.

**Fix:** compute the final filename once (always normalized to end in `.mp4`), use
it both for the path written to disk and for the returned URLs, and
`urllib.parse.quote()` the URL path segment.

### 2. AI lyric generation is a dead end (critical)
`GET /api/generate-lyrics` hardcodes `temp/processed_audio.wav`, which is only
written during a full render — never during the Step 2 preview, and never before a
render that needs lyrics as an input. The endpoint is practically unreachable in
the intended flow.

**Fix:** the endpoint takes the original `audio_path` (the raw download/upload, not
the speed/effects-processed file) and transcribes that directly. The frontend
passes `audioPath` through to `StepLyrics` and calls the endpoint with it.

### 3. AI lyric timestamps double-adjusted for speed (critical)
Because Whisper was transcribing the *already slowed* audio, its timestamps were on
the slowed timeline. The video composer then divides every timestamp by `speed`
again, double-applying the adjustment and drifting the sync.

**Fix:** a consequence of #2 — transcribing the *original* (unprocessed) audio puts
AI-generated timestamps on the same timeline convention as lrclib lyrics, so the
existing `/speed` division in the composer is correct and uniform across both
lyric sources.

### 4. Dead beat-sync code
`enable_beat_sync` is wired through the API, both render engines, and the frontend,
but in `video_composer.py` it loads librosa, computes beat times, and then does
nothing with them (`pass`). It is unused.

**Fix:** remove the parameter and the no-op code from `main.py`,
`ffmpeg_engine.py`, `video_composer.py`. Drop `librosa` from `requirements.txt` if
nothing else depends on it (it doesn't — only the beat-sync stub used it).

### 5. Temp-file collisions
All renders share one fixed set of filenames in `temp/` (`bg_image.*`,
`processed_audio.wav`, the output file, `render_progress.json`). A second render
started before/instead of a first can clobber its inputs, and stale files from a
prior run (e.g. a leftover `bg_image.png` when the new background is `.jpg`) can
silently bleed into a new render.

**Fix:** each render gets its own `temp/jobs/{job_id}/` directory holding its
background image, processed audio, and output file. Previews use a separate
`temp/preview/` directory (overwritten each time — single active preview is fine
for local single-user use). `render_progress.json` stays at `temp/` root (one
active render at a time, locally). After each render, prune `temp/jobs/` to the
5 most recent directories.

The `/api/download/{filename}` route becomes `/api/download/{file_path:path}` to
accept the nested job path; the existing `/files` static mount already serves
nested paths for free.

### 6. No feedback during audio mastering
The pedalboard effects chain (`apply_audio_effects`) is one blocking call with no
progress output, so both the Step 2 preview and the audio phase of a full render
look frozen on longer tracks.

**Fix:** `apply_audio_effects` writes coarse stage markers (e.g. `slowdown`, `8d`,
`eq_reverb`, `mastering`) to the progress file as it moves through the chain. In
`POST /api/render` the audio-mastering phase maps to 0–15% of the overall bar (with
the current stage name surfaced); the video-render phase fills 15–100% as today.
`POST /api/preview-audio` shows an indeterminate animated bar with the rotating
stage label (no fixed percentage, since there's no render-progress concept for a
preview — just stage names).

### 7. Preview/output parity (lyric display style)
The Step 3 live preview renders a 3-line "karaoke stack" (previous line dimmed
above, current line bright and centered, next line dimmed below). The actual
ffmpeg/ASS renderer only ever produces a single centered line that fades in and
out. What you tune in Step 3 is not what you get in the output.

**Fix:** make lyric display style an explicit, user-facing choice rather than
picking one and discarding the other:

- New `lyric_style` setting: `"single"` (today's renderer behavior — one centered
  line, fade in/out) or `"stack"` (today's preview behavior — current line
  bright, previous/next lines dimmed above/below).
- Default: `"single"` (the classic slowed+reverb look).
- A toggle in Step 3 (Lyrics) controls it; state lives in `App.jsx` alongside the
  other typography state and flows to both the live preview and the render
  request.
- The live preview (`StepLyrics`) gets a `single` branch (render only the current
  line) alongside its existing `stack` rendering.
- The ASS subtitle generator (`ffmpeg_engine.py`) gets a `stack` branch: for each
  active line window, it emits the current line as today (bright, centered) plus
  two additional `Dialogue` events for the previous/next lines, vertically offset
  and reduced in alpha, using the same position/font/stroke/shadow/color settings.
- The legacy MoviePy engine (`video_composer.py`) keeps `single` only — it's
  already marked "Legacy / Slow" in the UI and is not the primary path; adding
  stack support there is out of scope for this pass.

## Out of scope (explicitly deferred)

- Any portability work (VideoToolbox → libx264 fallback, HEIC conversion without
  `sips`, bundling fonts instead of `/System/Library/Fonts` paths). Mac-only by
  decision for this pass.
- New creative features (vertical/Shorts mode, word-by-word karaoke, visualizers,
  textures, Ken Burns, loudness normalization, project save/load, thumbnails).
- CORS/credentials hardening and path-traversal hardening on `audio_path` — noted
  as known issues, not fixed here, since this is a local single-user tool for now.

## Files touched

- `backend/main.py` — render endpoint URL/filename fix, job namespacing, progress
  stage wiring, `generate-lyrics` audio-source fix, beat-sync removal,
  `lyric_style` passthrough, download route path param.
- `backend/audio_processor.py` — stage progress writes.
- `backend/ffmpeg_engine.py` — `stack` ASS rendering branch, beat-sync removal.
- `backend/video_composer.py` — beat-sync removal.
- `backend/requirements.txt` — add `openai-whisper` (already installed in the dev
  venv, just undeclared), drop `librosa`.
- `frontend/src/App.jsx` — `lyricStyle` state, `audioPath` passed to `StepLyrics`.
- `frontend/src/components/StepLyrics.jsx` — lyric-style toggle, `single` preview
  branch, AI-generate call uses `audioPath`.
- `frontend/src/components/StepMaster.jsx` — indeterminate stage progress on
  preview.
- `frontend/src/components/StepExport.jsx` — staged progress bar (audio vs video
  phase), `lyric_style` form field.

## Verification plan

Using the existing dev venv/node_modules and sample assets already present in
`backend/temp/` from prior manual testing:

1. Start backend (`make run-backend` or direct) and frontend (`make run-frontend`).
2. Hit `/api/generate-lyrics` with an original (unprocessed) audio path and confirm
   it returns LRC text without requiring a prior render.
3. Run a full render with default settings (`lyric_style=single`) and confirm the
   returned `video_url`/`download_url` resolve (HTTP 200, playable file) — this
   directly verifies bug #1 is fixed.
4. Run a second render with `lyric_style=stack` and inspect the generated `.ass`
   file / output video for the 3-line layout.
5. Confirm `temp/jobs/` contains separate directories per render and old ones get
   pruned after more than 5 renders (or inspect the prune logic directly).
6. Confirm `render_progress.json` shows the audio-mastering stage briefly before
   transitioning into video-render percentages.
