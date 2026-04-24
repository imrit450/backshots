# Lumora / Backshots — Claude Context

## What this project is
Event photo-sharing platform. Hosts create events with a QR code; guests scan the QR, open a camera in the browser, take photos/videos, and upload them. Hosts moderate and can enable a public livestream view. Built by Zilware.mu.

## Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind, served via nginx in Docker
- **Backend**: Node/Express + Prisma + PostgreSQL
- **Scorer**: Python BRISQUE image quality service
- **Auth**: Clerk (publishable key via `VITE_CLERK_PUBLISHABLE_KEY`)
- **Infra**: Docker Compose (`docker-compose.prod.yml`) on port 8080

## Running the app
```bash
cd /Applications/backshots
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```
The app runs at **http://localhost:8080**. There is no separate dev server — always redeploy via Docker after changes. TypeScript check before deploy: `cd frontend && npx tsc --noEmit`.

## Key files
### Frontend
- `frontend/src/guest/Camera.tsx` — guest camera UI (photo + video capture, pinch zoom, flash, timer, orientation handling)
- `frontend/src/hooks/useCamera.ts` — camera logic; web (`getUserMedia`) and native (Capacitor `CameraPreview`) paths gated by `IS_NATIVE`
- `frontend/src/host/EventSettings.tsx` — host event settings; livestream toggle auto-saves immediately (no Submit needed)
- `frontend/src/host/Livestream.tsx` — public livestream page with blob URL in-memory caching
- `frontend/src/components/InstallPrompt.tsx` — PWA install banner (Android: native `beforeinstallprompt`; iOS: manual "Share → Add to Home Screen" instructions)
- `frontend/src/hooks/useDynamicManifest.ts` — swaps `<link rel="manifest">` to a blob URL with `start_url` set to the current event path, so installed PWA opens directly to the event
- `frontend/public/sw.js` — service worker: caches static assets, network-first for navigation, never intercepts `/v1` or `/uploads`
- `frontend/capacitor.config.ts` — Capacitor native app config (`appId: mu.zilware.lumora`)
- `frontend/scripts/setup-native.sh` — generates `ios/` and `android/` Capacitor projects (run once)
- `.github/workflows/build-android.yml` — GitHub Actions APK build; requires secrets `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_BASE`

### Backend
- `backend/src/routes/videos.ts` — video upload; responds immediately, fires background FFmpeg transcode
- `backend/src/services/videoProcessor.ts` — FFmpeg transcode service: WebM → MP4, `loudnorm` audio normalisation, 30fps, H.264 + AAC, `faststart`
- `backend/src/services/media.ts` — image processing (thumbnails, BRISQUE scoring)
- `backend/src/services/storage.ts` — file storage abstraction (local filesystem or S3)
- `backend/src/index.ts` — Express server; `/uploads` served with `maxAge: 7d, immutable: true`
- `backend/Dockerfile` — includes `ffmpeg` (required for video transcoding)

## PWA
- Manifest, service worker, iOS meta tags all in place
- `useDynamicManifest` sets `start_url` to the event path so home screen icon opens directly to the event
- `App.tsx` detects standalone mode + saved `pwa_last_event_path` in localStorage → redirects to last event on relaunch
- Capacitor native wrapper is code-complete but `ios/` and `android/` are gitignored; generate with `bash frontend/scripts/setup-native.sh`

## Camera — web path details

### Stream setup (`useCamera.ts`)
- No forced aspect ratio — `width/height: { ideal: 1920 }` lets device choose naturally
- Audio constraints: `echoCancellation: false, noiseSuppression: false`
- **iOS**: `autoGainControl: true` (MUST be true — false = near-silent), mono, 48kHz
- **Android**: `autoGainControl: false`, stereo, 48kHz
- `IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)` defined at module level in `useCamera.ts` and `Camera.tsx`

### Recording (`Camera.tsx`)
- **Codec priority**: VP8+Opus for both iOS and Android — VP9 on Android Chrome produces WebM with broken Opus granule positions; the browser replays it with robotic/pitch-shifted audio. FFmpeg fixes it server-side but the local preview sounds wrong. VP8+Opus plays back cleanly in-browser on both platforms.
- **Bitrates**: iOS `videoBitsPerSecond: 1_500_000` (VP8 is software-encoded, lower = less lag); Android `2_500_000`; audio `384_000`
- **Timeslice**: `mr.start(100)` — 100ms chunks
- No Web Audio gain node — it was tried and caused audio corruption; removed

### Pinch-to-zoom
- CSS transform written directly to `camera.videoRef.current.style.transform` — **no React state update** during pinch (prevents UI freeze)
- Hardware zoom (`camera.zoomCaps`) throttled to 100ms intervals
- `touchmove` with `{ passive: false }` on `document` prevents iOS Safari page zoom — this runs on ALL mobile (not just native), because iOS 10+ ignores `user-scalable=no`

### Photo capture
- Canvas draws `video.videoWidth × video.videoHeight` — no rotation applied; stream already matches device orientation
- Front camera: `ctx.scale(-1, 1)` mirror flip

## Video post-processing pipeline
After upload the raw WebM is saved and the API responds immediately. `setImmediate` fires:
1. `transcodeVideo(buffer, mime)` in `videoProcessor.ts` writes to tmpdir, runs FFmpeg
2. FFmpeg: `fps=30, libx264 fast crf23, aac 192k, loudnorm=I=-16:TP=-1.5:LRA=11, faststart`
3. Processed MP4 uploaded to storage, DB `url` updated, raw WebM deleted
4. By the time a host moderates the video, the clean MP4 is ready

## Plan tier caps (`frontend/src/config/plans.ts`)
- `maxPhotosPerGuest === -1` → unlimited → use `999` as stepper max in CreateEvent
- `maxStorageMb === -1` → unlimited → use `102400` (100 GB) as stepper max
- Storage label: `>= 1024 MB → show as GB`

## Known gotchas
- Docker needs `--env-file .env.production` passed explicitly
- `VITE_API_BASE` must include `/v1` (e.g. `https://your-server.com/v1`) for native/PWA builds
- iOS ignores `user-scalable=no` (iOS 10+) — use non-passive `touchmove` preventDefault
- iOS `autoGainControl: false` = near-silent audio — always `true` on iOS
- MP4 from MediaRecorder = fragmented MP4 = broken playback — use WebM for recording
- `CameraPreview.stopRecordVideo()` typed as `Promise<void>` but returns file path — cast to `any`
- FFmpeg is installed in the backend Docker image (`apk add ffmpeg` in runner stage)
- `screen.orientation` API may be undefined on some browsers — always use optional chaining
