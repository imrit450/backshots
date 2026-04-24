import { useState, useEffect, useCallback, useRef } from 'react';
import { LogoIcon } from '../components/Logo';
import { useParams, useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { api } from '../api/client';
import { Capacitor } from '@capacitor/core';
import { useDynamicManifest } from '../hooks/useDynamicManifest';
import {
  Camera,
  SwitchCamera,
  Zap,
  ZapOff,
  X,
  Check,
  CheckCircle,
  XCircle,
  RotateCcw,
  Images,
  Loader,
  User,
  Type,
  FileText,
  Trash2,
  Sun,
  Timer,
  Square,
  Download,
} from 'lucide-react';

const IS_NATIVE = Capacitor.isNativePlatform();
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

async function saveToDevice(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  // iOS 15+: Web Share API can route to "Save to Photos"
  if (IS_IOS && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; } catch { /* cancelled */ }
  }
  // Android / desktop: trigger a download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Show install prompt only on mobile web (not already in the native app)
const IS_MOBILE_WEB = !IS_NATIVE && /iPhone|iPad|Android/i.test(navigator.userAgent);

// TODO: Replace with real store links once published
const APP_STORE_URL   = 'https://apps.apple.com/app/lumora'; // placeholder
const PLAY_STORE_URL  = 'https://play.google.com/store/apps/details?id=mu.zilware.lumora'; // placeholder

interface MyPhoto {
  id: string;
  thumbUrl: string;
  status: string;
}

function loadMyPhotos(eventId: string): MyPhoto[] {
  try { return JSON.parse(sessionStorage.getItem(`myPhotos_${eventId}`) || '[]'); }
  catch { return []; }
}
function saveMyPhotos(eventId: string, photos: MyPhoto[]) {
  sessionStorage.setItem(`myPhotos_${eventId}`, JSON.stringify(photos));
}

type ScreenState = 'camera' | 'preview' | 'success' | 'myPhotos' | 'photoPreview';
type CameraMode = 'photo' | 'video';
type TimerValue = 0 | 3 | 5 | 10;
const TIMER_CYCLE: TimerValue[] = [0, 3, 5, 10];

function getBestMimeType(): string {
  // WebM + VP8 + Opus is intentionally preferred over VP9 on both Android and iOS.
  //
  // WHY NOT VP9 on Android: Android Chrome MediaRecorder's VP9+Opus WebM output has
  // a well-known bug where Opus granule positions / preskip values are written
  // incorrectly. The browser's own <video> element plays this back as robotic /
  // pitch-shifted audio. FFmpeg corrects it during the server-side transcode, so
  // uploaded clips sound fine — but the local preview sounds terrible.
  // VP8+Opus does not have this bug and plays back cleanly in-browser.
  //
  // iOS Safari only supports VP8 anyway.
  const types = ['video/webm;codecs=vp8,opus', 'video/webm'];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export default function GuestCamera() {
  const { eventCode } = useParams<{ eventCode: string }>();
  const navigate = useNavigate();
  const camera = useCamera();
  useDynamicManifest(`/e/${eventCode}`);

  const [screen, setScreen] = useState<ScreenState>('camera');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [flashEnabled, setFlashEnabled] = useState(() => localStorage.getItem('flashEnabled') === 'true');
  const [screenFlash, setScreenFlash] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [myPhotos, setMyPhotos] = useState<MyPhoto[]>([]);
  const [previewPhoto, setPreviewPhoto] = useState<MyPhoto | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [longPressActive, setLongPressActive] = useState(false);

  // Mode
  const [mode, setMode] = useState<CameraMode>('photo');

  // Web video recording (MediaRecorder path)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const recordingElapsedRef = useRef(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const recordingMimeRef = useRef('');
  const stoppingNativeVideoRef = useRef(false); // guard against double-stop

  // Timer
  const [timer, setTimer] = useState<TimerValue>(0);
  const [timerCountdown, setTimerCountdown] = useState<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Brightness
  const [brightness, setBrightness] = useState(100);
  const [showBrightnessSlider, setShowBrightnessSlider] = useState(false);

  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const zoomLevelRef = useRef(1);
  const hwZoomThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Title & description
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoDescription, setPhotoDescription] = useState('');

  // Install prompt (mobile web only)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  const session = JSON.parse(sessionStorage.getItem('guestSession') || '{}');
  const event = JSON.parse(sessionStorage.getItem('guestEvent') || '{}');
  const guestName = localStorage.getItem('guestDisplayName') || session.displayName || '';

  const uploadsClosed = (() => {
    const cutoff = event.uploadCutoffHours ?? 24;
    if (cutoff <= 0) return false;
    const start = event.startDatetime ? new Date(event.startDatetime).getTime() : 0;
    if (!start) return false;
    return Date.now() > start + cutoff * 3600_000;
  })();

  const refreshPhotoStatuses = useCallback(async () => {
    if (!event.id) return;
    try {
      const data = await api.getMyPhotos(event.id);
      const serverPhotos: MyPhoto[] = data.photos.map((p: any) => ({
        id: p.id, thumbUrl: p.thumbUrl, status: p.status,
      }));
      setMyPhotos(serverPhotos);
      saveMyPhotos(event.id, serverPhotos);
    } catch { /* silently fail */ }
  }, [event.id]);

  useEffect(() => {
    if (!session.id) {
      navigate(`/e/${eventCode}`, { replace: true });
      return;
    }
    camera.startCamera();
    if (event.id) {
      setMyPhotos(loadMyPhotos(event.id));
      refreshPhotoStatuses();
    }
    return () => camera.stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!event.id) return;
    const interval = setInterval(refreshPhotoStatuses, 15_000);
    return () => clearInterval(interval);
  }, [event.id, refreshPhotoStatuses]);

  // Prevent the browser/WkWebView from intercepting pinch gestures and zooming the page UI.
  // Applies on both native (WkWebView) and iOS Safari PWA — meta viewport user-scalable=no
  // is ignored by iOS 10+ for accessibility reasons, so we must preventDefault in JS.
  useEffect(() => {
    const handler = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener('touchmove', handler, { passive: false });
    return () => document.removeEventListener('touchmove', handler);
  }, []);

  // ── Pinch-to-zoom (web only) ───────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (IS_NATIVE) return; // native plugin handles pinch natively
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
      pinchRef.current = { startDist: dist, startZoom: zoomLevelRef.current };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (IS_NATIVE) return;
    if (e.touches.length !== 2 || !pinchRef.current) return;
    const dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
    const newZoom = Math.max(1, Math.min(5, pinchRef.current.startZoom * (dist / pinchRef.current.startDist)));
    zoomLevelRef.current = newZoom;

    if (camera.zoomCaps) {
      // Throttle hardware zoom to avoid flooding the track constraints API
      if (!hwZoomThrottleRef.current) {
        hwZoomThrottleRef.current = setTimeout(() => {
          camera.applyZoom(zoomLevelRef.current);
          hwZoomThrottleRef.current = null;
        }, 100);
      }
    } else {
      // Apply CSS transform directly to DOM — no React re-render
      const video = camera.videoRef.current;
      if (video) {
        const mirror = camera.facingMode === 'user' ? -1 : 1;
        video.style.transform = `scaleX(${mirror}) scale(${newZoom})`;
      }
    }
  }, [camera]);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null;
    if (hwZoomThrottleRef.current) { clearTimeout(hwZoomThrottleRef.current); hwZoomThrottleRef.current = null; }
  }, []);

  // ── Stop web video recording ───────────────────────────────────────────
  const stopWebVideoRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (flashEnabled && camera.torchSupported) camera.setTorch(false);
  }, [flashEnabled, camera]);

  // ── Stop native video recording ────────────────────────────────────────
  const stopNativeVideoRecording = useCallback(async () => {
    if (stoppingNativeVideoRef.current) return;
    stoppingNativeVideoRef.current = true;
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (flashEnabled && camera.torchSupported) camera.setTorch(false);
    const result = await camera.stopNativeVideo();
    stoppingNativeVideoRef.current = false;
    if (result) {
      setCapturedBlob(result.blob);
      setVideoPreviewUrl(URL.createObjectURL(result.blob));
      setVideoDurationSec(result.durationSec);
      setScreen('preview');
    }
    setRecording(false);
    setRecordingElapsed(0);
    recordingElapsedRef.current = 0;
  }, [flashEnabled, camera]);

  // ── Core capture logic ─────────────────────────────────────────────────
  const fireCapture = useCallback(async () => {
    if (mode === 'video') {
      if (recording) {
        if (IS_NATIVE) {
          await stopNativeVideoRecording();
        } else {
          stopWebVideoRecording();
        }
        return;
      }

      // ── Start video recording ──
      if (IS_NATIVE) {
        try {
          if (flashEnabled && camera.torchSupported) camera.setTorch(true);
          await camera.startNativeVideo();
          setRecording(true);
          setRecordingElapsed(0);
          recordingElapsedRef.current = 0;
          setError('');

          recordingIntervalRef.current = setInterval(() => {
            recordingElapsedRef.current += 1;
            setRecordingElapsed(recordingElapsedRef.current);
            if (recordingElapsedRef.current >= 10) {
              stopNativeVideoRecording();
            }
          }, 1000);
        } catch (err: any) {
          setError(err.message || 'Unable to start video recording');
          setRecording(false);
        }
        return;
      }

      // ── Web MediaRecorder path ──
      // Single recorder — dual recorders on the same stream cause audio codec
      // interference (robotic/distorted sound). Android hardware encodes VP9 at
      // high bitrates without lag; iOS uses VP8 (software) so we keep it lower.
      try {
        const rawStream = camera.videoRef.current?.srcObject as MediaStream | null;
        if (!rawStream) throw new Error('Camera not ready');

        recordedChunksRef.current = [];
        const mimeType = getBestMimeType();
        recordingMimeRef.current = mimeType;
        const mr = new MediaRecorder(rawStream, {
          ...(mimeType ? { mimeType } : {}),
          // iOS: VP8 is software-encoded — keep bitrate moderate to avoid lag
          // Android: VP9/VP8 hardware-encoded — crank it up for quality
          videoBitsPerSecond: IS_IOS ? 2_000_000 : 8_000_000,
          audioBitsPerSecond: IS_IOS ? 128_000 : 256_000,
        });
        mediaRecorderRef.current = mr;

        if (flashEnabled && camera.torchSupported) camera.setTorch(true);

        setRecording(true);
        setRecordingElapsed(0);
        recordingElapsedRef.current = 0;
        setError('');

        mr.ondataavailable = (e: BlobEvent) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        mr.onstop = () => {
          if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
          if (flashEnabled && camera.torchSupported) camera.setTorch(false);
          // Strip codec suffix so Blob type is clean "video/webm" (multer check)
          const fileType = recordingMimeRef.current.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
          const blob = new Blob(recordedChunksRef.current, { type: fileType });
          setCapturedBlob(blob);
          setVideoPreviewUrl(URL.createObjectURL(blob));
          setVideoDurationSec(Math.max(1, Math.min(10, recordingElapsedRef.current)));
          setScreen('preview');
          setRecording(false);
          setRecordingElapsed(0);
        };

        // No timeslice — all audio/video data is buffered and delivered as one
        // clean blob on stop(). Fragmented 100 ms chunks cause audio artefacts
        // in the preview player (choppy / distorted); FFmpeg handles them fine
        // server-side but the in-browser preview sounds bad. The 10 s auto-stop
        // still works because we call mr.stop() explicitly in the interval.
        mr.start();

        recordingIntervalRef.current = setInterval(() => {
          recordingElapsedRef.current += 1;
          setRecordingElapsed(recordingElapsedRef.current);
          if (recordingElapsedRef.current >= 10) {
            if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
          }
        }, 1000);

        return;
      } catch (err: any) {
        setError(err.message || 'Unable to start video recording');
        setRecording(false);
        return;
      }
    }

    // ── Photo mode ──
    setScreenFlash(false);

    if (flashEnabled) {
      if (camera.torchSupported) {
        await camera.setTorch(true);
        await new Promise((r) => setTimeout(r, 400));
      } else if (!IS_NATIVE) {
        setScreenFlash(true);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 500)));
        });
      }
    }

    const blob = await camera.capturePhoto(zoomLevelRef.current);

    setTimeout(() => setScreenFlash(false), 200);
    if (flashEnabled && camera.torchSupported) setTimeout(() => camera.setTorch(false), 100);

    if (blob) {
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      setPhotoTitle('');
      setPhotoDescription('');
      setScreen('preview');
    }
  }, [camera, flashEnabled, mode, recording, stopWebVideoRecording, stopNativeVideoRecording]);

  const handleCapture = useCallback(async () => {
    if (mode === 'video' && recording) {
      if (IS_NATIVE) { await stopNativeVideoRecording(); } else { stopWebVideoRecording(); }
      return;
    }
    if (timerCountdown !== null) return;
    if (timer > 0 && mode === 'photo') {
      let count = timer;
      setTimerCountdown(count);
      timerIntervalRef.current = setInterval(() => {
        count--;
        setTimerCountdown(count);
        if (count <= 0) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          setTimerCountdown(null);
          fireCapture();
        }
      }, 1000);
      return;
    }
    fireCapture();
  }, [mode, recording, timer, timerCountdown, stopWebVideoRecording, stopNativeVideoRecording, fireCapture]);

  const cancelTimer = useCallback(() => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    setTimerCountdown(null);
  }, []);

  const handleRetake = useCallback(() => {
    setCapturedBlob(null);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    setCapturedUrl(null);
    setError('');
    setPhotoTitle('');
    setPhotoDescription('');
    zoomLevelRef.current = 1;
    if (camera.videoRef.current) camera.videoRef.current.style.transform = `scaleX(${camera.facingMode === 'user' ? -1 : 1})`;
    setScreen('camera');
    camera.startCamera();
  }, [capturedUrl, videoPreviewUrl, camera]);

  const handleSubmit = async () => {
    if (!capturedBlob || !event.id) return;
    setUploading(true);
    setError('');
    try {
      if (mode === 'video') {
        await api.uploadVideo(event.id, capturedBlob, videoDurationSec || 1, photoTitle.trim() || undefined, photoDescription.trim() || undefined);
        setScreen('success');
      } else {
        const data = await api.uploadPhoto(event.id, capturedBlob, photoTitle.trim() || undefined, photoDescription.trim() || undefined);
        const newPhoto: MyPhoto = { id: data.photo.id, thumbUrl: data.photo.thumbUrl, status: data.photo.status };
        const updated = [newPhoto, ...myPhotos];
        setMyPhotos(updated);
        saveMyPhotos(event.id, updated);
        setRemaining(data.remainingPhotos);
        setCapturedBlob(null);
        if (capturedUrl) URL.revokeObjectURL(capturedUrl);
        setCapturedUrl(null);
        setPhotoTitle('');
        setPhotoDescription('');
        setScreen('camera');
        camera.startCamera();
        setShowSuccessToast(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setShowSuccessToast(false), 3000);
        // Install prompt disabled until app store listings are live
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleTakeAnother = () => {
    setCapturedBlob(null);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setCapturedUrl(null);
    setVideoPreviewUrl(null);
    setError('');
    setPhotoTitle('');
    setPhotoDescription('');
    setScreen('camera');
    camera.startCamera();
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!event.id || deleting) return;
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    setDeleting(photoId);
    try {
      await api.deleteGuestPhoto(event.id, photoId);
      const updated = myPhotos.filter((p) => p.id !== photoId);
      setMyPhotos(updated);
      saveMyPhotos(event.id, updated);
      if (previewPhoto?.id === photoId) { setPreviewPhoto(null); setScreen('myPhotos'); }
      if (remaining !== null) setRemaining(remaining + 1);
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo');
    } finally {
      setDeleting(null);
    }
  };

  const cycleTimer = () => {
    const idx = TIMER_CYCLE.indexOf(timer);
    setTimer(TIMER_CYCLE[(idx + 1) % TIMER_CYCLE.length]);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={`fixed inset-0 overflow-hidden ${IS_NATIVE ? 'bg-transparent' : 'bg-black'}`}>
      {/* Screen flash overlay (web only) */}
      {!IS_NATIVE && screenFlash && (
        <div className="fixed inset-0 pointer-events-none bg-white" style={{ zIndex: 9999, opacity: 1 }} />
      )}

      {/* ══════ CAMERA VIDEO (web only — native renders behind WebView) ══════ */}
      <div
        className="absolute inset-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (!camera.isReady || camera.error || screen !== 'camera') return;
          if (showBrightnessSlider) { setShowBrightnessSlider(false); return; }
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;
          let nx = px / rect.width;
          const ny = py / rect.height;
          if (camera.facingMode === 'user') nx = 1 - nx;
          setFocusPoint({ x: px, y: py });
          if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
          focusTimerRef.current = setTimeout(() => setFocusPoint(null), 1200);
          if (!IS_NATIVE) camera.focusAtPoint(nx, ny);
        }}
      >
        {/* Web viewfinder */}
        {!IS_NATIVE && (
          <video
            ref={camera.videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${camera.error ? 'hidden' : ''}`}
            style={{
              transform: `scaleX(${camera.facingMode === 'user' ? -1 : 1})`,
              filter: `brightness(${brightness}%)`,
              transformOrigin: 'center center',
            }}
          />
        )}

        {/* Viewfinder grid */}
        {!camera.error && (
          <div className="absolute inset-0 viewfinder-grid opacity-30 pointer-events-none" />
        )}

        {/* Corner brackets */}
        {!camera.error && (
          <>
            <div className="absolute top-20 left-6 w-8 h-8 border-t-2 border-l-2 border-primary/40 pointer-events-none" />
            <div className="absolute top-20 right-6 w-8 h-8 border-t-2 border-r-2 border-primary/40 pointer-events-none" />
            <div className="absolute bottom-44 left-6 w-8 h-8 border-b-2 border-l-2 border-primary/40 pointer-events-none" />
            <div className="absolute bottom-44 right-6 w-8 h-8 border-b-2 border-r-2 border-primary/40 pointer-events-none" />
          </>
        )}

        {/* Tap-to-focus ring */}
        {focusPoint && (
          <div className="absolute pointer-events-none" style={{ left: focusPoint.x - 30, top: focusPoint.y - 30, width: 60, height: 60 }}>
            <div className="w-full h-full rounded-full border-2 border-primary" style={{ animation: 'focusRing 0.6s ease-out forwards' }} />
          </div>
        )}

        {/* Camera error */}
        {camera.error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-surface">
            <div className="text-center">
              <Camera className="w-16 h-16 text-on-surface-variant/30 mx-auto mb-4" />
              <p className="text-on-surface-variant mb-4 text-sm">{camera.error}</p>
              <button onClick={camera.startCamera} className="px-6 py-3 bg-surface-container-highest rounded-full text-on-surface font-medium text-sm">
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas (web only) */}
      {!IS_NATIVE && <canvas ref={camera.canvasRef} className="hidden" />}

      {/* ══════ TIMER COUNTDOWN ══════ */}
      {timerCountdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[160px] font-extrabold text-white leading-none" style={{ textShadow: '0 0 60px rgba(193,156,255,0.8)', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            {timerCountdown}
          </div>
          <button onClick={cancelTimer} className="mt-6 px-5 py-2 rounded-full bg-black/50 text-white text-sm font-medium pointer-events-auto">
            Cancel
          </button>
        </div>
      )}

      {/* ══════ TOP HEADER BAR ══════ */}
      {screen === 'camera' && (
        <div className="fixed top-0 w-full z-50 flex justify-between items-center px-6 py-6 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-on-surface-variant" />
            </div>
            <div>
              <p className="font-headline font-bold text-white text-sm leading-tight">{guestName || 'Guest'}</p>
              <LogoIcon size={12} className="opacity-40" />
            </div>
          </div>

          {recording ? (
            <div className="flex items-center gap-2 bg-red-600/80 backdrop-blur-md px-4 py-2 rounded-full">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white font-bold text-sm">{recordingElapsed}s</span>
              <span className="text-white/60 text-xs">/ 10s</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="bg-surface-container-highest/60 backdrop-blur-md px-4 py-2 rounded-full border border-outline-variant/20">
                <span className="font-headline font-extrabold text-primary text-lg leading-none">
                  {remaining !== null ? remaining : myPhotos.length > 0 ? myPhotos.length : '∞'}
                </span>
              </div>
              <p className="text-white/40 text-[8px] tracking-widest mt-1 uppercase">
                {remaining !== null ? 'Roll Remaining' : 'Shots Taken'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════ SIDE CONTROLS ══════ */}
      {screen === 'camera' && (
        <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4">
          {/* Flash */}
          <button
            onClick={() => { const next = !flashEnabled; setFlashEnabled(next); localStorage.setItem('flashEnabled', String(next)); }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-outline-variant/20 flex items-center justify-center"
          >
            {flashEnabled ? <Zap className="w-4 h-4 text-primary" /> : <ZapOff className="w-4 h-4 text-white/60" />}
          </button>

          {/* Brightness (web only) */}
          {!IS_NATIVE && (
            <div className="relative">
              <button
                onClick={() => setShowBrightnessSlider((v) => !v)}
                className={`w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-outline-variant/20 flex items-center justify-center ${brightness !== 100 ? 'border-primary/60' : ''}`}
              >
                <Sun className={`w-4 h-4 ${brightness !== 100 ? 'text-primary' : 'text-white/60'}`} />
              </button>
              {showBrightnessSlider && (
                <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-black/70 backdrop-blur-md rounded-2xl px-4 py-3 border border-outline-variant/20 w-48">
                  <Sun className="w-3 h-3 text-white/40 flex-shrink-0" />
                  <input type="range" min={50} max={200} step={5} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="flex-1 accent-primary h-1" />
                  <Sun className="w-4 h-4 text-white/80 flex-shrink-0" />
                </div>
              )}
            </div>
          )}

          {/* Timer */}
          <button
            onClick={cycleTimer}
            className={`w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-outline-variant/20 flex items-center justify-center ${timer > 0 ? 'border-primary/60' : ''}`}
          >
            {timer > 0 ? <span className="text-primary text-xs font-bold leading-none">{timer}s</span> : <Timer className="w-4 h-4 text-white/60" />}
          </button>

          {/* Zoom indicator (web only) */}
          {!IS_NATIVE && (zoomLevelRef.current > 1.05 || camera.currentZoom > 1.05) && (
            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-outline-variant/20 flex items-center justify-center">
              <span className="text-white/80 text-[10px] font-bold leading-none">
                {(camera.currentZoom > 1.05 ? camera.currentZoom : zoomLevelRef.current).toFixed(1)}×
              </span>
            </div>
          )}
        </div>
      )}

      {/* ══════ SUCCESS TOAST ══════ */}
      {showSuccessToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-slide-in">
          <div className="bg-tertiary-container/90 backdrop-blur-xl text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg">
            <CheckCircle className="w-4 h-4 text-white" />
            <span className="text-sm font-medium">Your photo is live!</span>
          </div>
        </div>
      )}

      {/* ══════ INSTALL APP PROMPT (mobile web only) ══════ */}
      {showInstallPrompt && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowInstallPrompt(false); localStorage.setItem('installPromptDismissed', '1'); }} />
          <div className="relative w-full max-w-sm bg-surface-container-low rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => { setShowInstallPrompt(false); localStorage.setItem('installPromptDismissed', '1'); }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center"
            >
              <X className="w-4 h-4 text-on-surface-variant" />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl kinetic-gradient shutter-glow flex items-center justify-center flex-shrink-0">
                <Download className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-headline font-bold text-on-surface text-base leading-tight">Get the Lumora App</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Better quality photos & videos</p>
              </div>
            </div>

            <p className="text-sm text-on-surface-variant mb-5 leading-relaxed">
              The native app uses your phone's full camera — hardware encoding, 4K, and lossless audio — for stunning event memories.
            </p>

            <div className="flex gap-3">
              <a
                href={/iPhone|iPad/i.test(navigator.userAgent) ? APP_STORE_URL : PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => localStorage.setItem('installPromptDismissed', '1')}
                className="flex-1 py-3 kinetic-gradient shutter-glow rounded-xl text-white font-headline font-bold text-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {/iPhone|iPad/i.test(navigator.userAgent) ? 'App Store' : 'Google Play'}
              </a>
              <button
                onClick={() => { setShowInstallPrompt(false); localStorage.setItem('installPromptDismissed', '1'); }}
                className="flex-1 py-3 bg-surface-container-highest rounded-xl text-on-surface font-headline font-bold text-sm"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ BOTTOM CONTROLS ══════ */}
      {screen === 'camera' && (
        <div className="fixed bottom-0 w-full z-50">
          <div className="absolute bottom-0 w-full h-64 bg-gradient-to-t from-black to-transparent -z-10" />

          {uploadsClosed && (
            <div className="mx-4 mb-3 p-3 rounded-xl bg-amber-500/20 border border-amber-400/30 text-center">
              <p className="text-amber-100 text-xs font-medium">Photo uploads have closed for this event.</p>
            </div>
          )}

          <div className="flex justify-around items-center px-8 pb-12 pt-4">
            {/* Switch camera */}
            <button
              onClick={() => { zoomLevelRef.current = 1; camera.switchCamera(); }}
              disabled={recording}
              className="w-14 h-14 rounded-full bg-surface-container-highest/40 backdrop-blur-xl border border-outline-variant/20 flex items-center justify-center disabled:opacity-40"
            >
              <SwitchCamera className="w-6 h-6 text-white" />
            </button>

            {/* Capture / Stop */}
            <div className="relative flex items-center justify-center">
              <div className={`absolute -inset-4 rounded-full blur-2xl ${recording ? 'bg-red-500/30' : longPressActive ? 'bg-red-500/20' : 'bg-primary/20'}`} />
              <button
                onClick={handleCapture}
                disabled={(!camera.isReady || uploadsClosed) && !recording}
                onPointerDown={() => {
                  if (recording || mode === 'video') return;
                  longPressTimerRef.current = setTimeout(() => { setMode('video'); setLongPressActive(false); }, 500);
                  setLongPressActive(true);
                }}
                onPointerUp={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } setLongPressActive(false); }}
                onPointerLeave={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } setLongPressActive(false); }}
                className={`relative w-24 h-24 rounded-full border-[6px] transition-transform duration-150 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${
                  recording ? 'bg-red-600 border-white/20 shadow-[0_0_40px_rgba(239,68,68,0.5)] hover:scale-105 active:scale-95'
                  : longPressActive ? 'kinetic-gradient border-red-400/60 shadow-[0_0_40px_rgba(239,68,68,0.4)] scale-110'
                  : 'kinetic-gradient border-white/20 shadow-[0_0_40px_rgba(193,156,255,0.4)] hover:scale-105 active:scale-95'
                }`}
              >
                {recording ? <Square className="w-8 h-8 text-white fill-white" />
                  : mode === 'video' ? <div className="w-7 h-7 rounded-sm bg-white/90" />
                  : <Camera className="w-8 h-8 text-white" />}
              </button>
            </div>

            {/* Gallery */}
            <button
              onClick={() => {
                if (myPhotos.length > 0) { refreshPhotoStatuses(); setScreen('myPhotos'); }
                else if (event.guestGalleryEnabled) navigate(`/e/${eventCode}/gallery`);
              }}
              className="w-14 h-14 rounded-full bg-surface-container-highest/40 backdrop-blur-xl border border-outline-variant/20 overflow-hidden flex items-center justify-center"
            >
              {myPhotos.length > 0
                ? <img src={myPhotos[0].thumbUrl} alt="" className="w-full h-full object-cover" />
                : <Images className="w-6 h-6 text-white/60" />}
            </button>
          </div>

          {/* Mode selector */}
          <div className="flex justify-center pb-6">
            <div className="flex items-center gap-6 px-4 py-2 bg-surface-container-low/40 backdrop-blur-sm rounded-full">
              {(['video', 'photo'] as CameraMode[]).map((m) => (
                <button key={m} onClick={() => !recording && setMode(m)} disabled={recording}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors duration-200 disabled:opacity-40 ${mode === m ? 'text-secondary' : 'text-white/40'}`}
                >
                  {mode === m && <span className="w-1.5 h-1.5 rounded-full bg-secondary inline-block" style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }} />}
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════ PREVIEW OVERLAY ══════ */}
      {screen === 'preview' && (capturedUrl || videoPreviewUrl) && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] min-h-0">
            {mode === 'video' && videoPreviewUrl ? (
              <video src={videoPreviewUrl} controls autoPlay loop playsInline className="max-w-full max-h-full rounded-2xl" style={{ maxHeight: '60vh' }} />
            ) : capturedUrl ? (
              <img src={capturedUrl} alt="Captured" className="max-w-full max-h-full object-contain rounded-2xl" />
            ) : null}
          </div>

          <div className="flex-shrink-0 bg-surface-container-low/90 backdrop-blur-xl rounded-t-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="relative mb-4">
              <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
              <input type="text" value={photoTitle} onChange={(e) => setPhotoTitle(e.target.value)} placeholder="Add a title (optional)" maxLength={100}
                className="w-full pl-10 pr-4 py-3 bg-transparent border-0 border-b border-outline-variant/40 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div className="relative mb-6">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-on-surface-variant/40" />
              <textarea value={photoDescription} onChange={(e) => setPhotoDescription(e.target.value)} placeholder="Add a description (optional)" maxLength={500} rows={2}
                className="w-full pl-10 pr-4 py-3 bg-transparent border-0 border-b border-outline-variant/40 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:border-primary transition-colors resize-none" />
            </div>

            {error && <div className="mb-4 text-error text-sm bg-error/10 px-4 py-2 rounded-xl border border-error/20 text-center">{error}</div>}

            <div className="flex gap-3">
              <button onClick={handleRetake} disabled={uploading} className="flex-1 py-4 bg-surface-container-highest rounded-xl text-on-surface font-headline font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all">
                <RotateCcw className="w-4 h-4" /> Retake
              </button>
              <button
                onClick={() => capturedBlob && saveToDevice(capturedBlob, `photo-${Date.now()}.jpg`)}
                disabled={!capturedBlob || uploading}
                title="Save to device"
                className="py-4 px-5 bg-surface-container-highest rounded-xl text-on-surface flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all"
              >
                <Download className="w-5 h-5" />
              </button>
              <button onClick={handleSubmit} disabled={uploading || uploadsClosed} className="flex-1 py-4 kinetic-gradient shutter-glow rounded-xl text-white font-headline font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all">
                {uploading ? <><Loader className="w-4 h-4 animate-spin" /> Uploading...</> : <><Check className="w-4 h-4" /> Upload</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ SUCCESS OVERLAY ══════ */}
      {screen === 'success' && (
        <div className="fixed inset-0 bg-surface flex flex-col items-center justify-center p-6 z-50">
          <div className="relative z-10 flex flex-col items-center w-full max-w-sm text-center">
            <div className="w-20 h-20 rounded-full kinetic-gradient shutter-glow flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h1 className="font-headline font-extrabold text-3xl text-on-surface mb-2">Submitted!</h1>
            <p className="text-on-surface-variant mb-8 text-sm">
              {remaining !== null && remaining > 0 ? `You can take ${remaining} more photo${remaining === 1 ? '' : 's'}` : remaining === 0 ? "You've reached the photo limit" : 'Your content has been uploaded successfully'}
            </p>
            <div className="w-full space-y-3">
              {(remaining === null || remaining > 0) && (
                <button onClick={handleTakeAnother} className="w-full py-4 kinetic-gradient shutter-glow font-headline font-bold rounded-xl flex items-center justify-center gap-2 text-white active:scale-95 transition-all">
                  <Camera className="w-5 h-5" /> Take Another
                </button>
              )}
              {myPhotos.length > 0 && (
                <button onClick={() => setScreen('myPhotos')} className="w-full py-4 bg-surface-container-highest text-on-surface font-headline font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                  <User className="w-5 h-5" /> My Gallery ({myPhotos.length})
                </button>
              )}
              {event.guestGalleryEnabled && (
                <button onClick={() => navigate(`/e/${eventCode}/gallery`)} className="w-full py-4 bg-surface-container-low text-on-surface-variant font-headline font-bold rounded-xl flex items-center justify-center gap-2 border border-outline-variant/20 active:scale-95 transition-all">
                  <Images className="w-5 h-5" /> View Event Gallery
                </button>
              )}
            </div>
            <LogoIcon size={14} className="mx-auto mt-6 opacity-30" />
          </div>
        </div>
      )}

      {/* ══════ MY PHOTOS SHEET ══════ */}
      {screen === 'myPhotos' && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setScreen('camera')} />
          <div className="bg-surface-container-low rounded-t-3xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20 flex-shrink-0">
              <h2 className="font-headline font-bold text-on-surface text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> My Gallery ({myPhotos.length})
              </h2>
              <button onClick={() => setScreen('camera')} className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center">
                <X className="w-4 h-4 text-on-surface" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {myPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                  <Camera className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">No photos yet. Start capturing!</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {myPhotos.map((photo) => (
                    <div key={photo.id} className={`aspect-square rounded-xl overflow-hidden bg-surface-container-highest relative ${deleting === photo.id ? 'opacity-40 pointer-events-none' : ''}`}>
                      <button onClick={() => { setPreviewPhoto(photo); setScreen('photoPreview'); }} className="w-full h-full">
                        <img src={photo.thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </button>
                      {photo.status === 'PENDING' && <div className="absolute top-1.5 left-1.5"><span className="badge-pending text-[8px]">Pending</span></div>}
                      {photo.status === 'APPROVED' && <div className="absolute top-1.5 left-1.5"><span className="badge-approved text-[8px] flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5" /> Live</span></div>}
                      {photo.status === 'REJECTED' && <div className="absolute top-1.5 left-1.5"><span className="badge-rejected text-[8px] flex items-center gap-0.5"><XCircle className="w-2.5 h-2.5" /> Rejected</span></div>}
                      {photo.status === 'PENDING' && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }} className="absolute top-1.5 right-1.5 w-6 h-6 bg-error/80 backdrop-blur rounded-full flex items-center justify-center">
                          {deleting === photo.id ? <Loader className="w-3 h-3 text-white animate-spin" /> : <Trash2 className="w-3 h-3 text-white" />}
                        </button>
                      )}
                      {deleting === photo.id && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader className="w-6 h-6 text-white animate-spin" /></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 border-t border-outline-variant/20">
              <button onClick={() => { setScreen('camera'); camera.startCamera(); }} className="w-full py-4 kinetic-gradient shutter-glow font-headline font-bold text-white rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Camera className="w-5 h-5" /> Back to Camera
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ FULL-SCREEN PHOTO PREVIEW ══════ */}
      {screen === 'photoPreview' && previewPhoto && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col" onClick={() => setScreen('myPhotos')}>
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]" onClick={(e) => e.stopPropagation()}>
            <button className="w-10 h-10 bg-surface-container-highest/60 backdrop-blur rounded-full flex items-center justify-center" onClick={() => setScreen('myPhotos')}>
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2">
              {previewPhoto.status === 'PENDING' && <span className="badge-pending">Pending Review</span>}
              {previewPhoto.status === 'APPROVED' && <span className="badge-approved flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>}
              {previewPhoto.status === 'REJECTED' && <span className="badge-rejected flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</span>}
            </div>
            {previewPhoto.status === 'PENDING' ? (
              <button className="w-10 h-10 bg-error/70 backdrop-blur rounded-full flex items-center justify-center" onClick={(e) => { e.stopPropagation(); handleDeletePhoto(previewPhoto.id); }} disabled={deleting === previewPhoto.id}>
                {deleting === previewPhoto.id ? <Loader className="w-4 h-4 text-white animate-spin" /> : <Trash2 className="w-4 h-4 text-white" />}
              </button>
            ) : <div className="w-10 h-10" />}
          </div>
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <img src={previewPhoto.thumbUrl} alt="" className="max-w-full max-h-full object-contain rounded-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
