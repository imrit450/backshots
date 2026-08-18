import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { CameraPreview } from '@capacitor-community/camera-preview';

// Evaluated once at module load — never changes at runtime so safe to branch hooks.
const IS_NATIVE = Capacitor.isNativePlatform();
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

interface ZoomCaps {
  min: number;
  max: number;
  step: number;
}

export interface CaptureDiagnostics {
  path: 'imagecapture' | 'canvas-fallback';
  width: number;
  height: number;
  bytes: number;
  trackSettings: MediaTrackSettings | null;
}

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  isNative: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => void;
  // Async in both paths (native requires it; web wraps sync logic)
  capturePhoto: (cssZoom?: number) => Promise<Blob | null>;
  // Native video recording — no-ops on web (web handles via MediaRecorder in Camera.tsx)
  startNativeVideo: () => Promise<void>;
  stopNativeVideo: () => Promise<{ blob: Blob; durationSec: number } | null>;
  stream: MediaStream | null;
  // Diagnostics from the most recent capturePhoto() call — which pipeline was
  // used and what came out of it. Read this on-device (?camdebug=1) to verify
  // the ImageCapture path is actually engaging instead of silently falling back.
  lastCaptureInfo: CaptureDiagnostics | null;
  torchSupported: boolean;
  torchOn: boolean;
  setTorch: (on: boolean) => Promise<void>;
  focusAtPoint: (x: number, y: number) => Promise<boolean>;
  zoomCaps: ZoomCaps | null;
  currentZoom: number;
  applyZoom: (value: number) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64ToBlob(b64: string, mimeType: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

// Server rejects uploads over config.maxFileSize (10MB) — leave headroom since
// a full-sensor-resolution still (via ImageCapture) can land much bigger than
// the old video-frame snapshot ever could.
const MAX_PHOTO_UPLOAD_BYTES = 9 * 1024 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Re-encodes at decreasing JPEG quality until the blob fits the server's
// upload cap. Best-effort: if even the lowest quality doesn't fit, returns
// that anyway and lets the existing server-side error surface as before.
async function encodeWithSizeCap(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob | null> {
  const qualities = [0.95, 0.85, 0.75];
  let last: Blob | null = null;
  for (const q of qualities) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', q);
    last = blob;
    if (blob && blob.size <= maxBytes) return blob;
  }
  return last;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// Draws `source` (a live <video> frame or a captured ImageBitmap) onto the
// canvas, applying the same selfie-mirror and digital-zoom center-crop that
// the original video-frame-snapshot path applied — so swapping the pixel
// source doesn't change what the user sees in the output.
function drawCaptureSource(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  facingMode: 'user' | 'environment',
  cssZoom: number
) {
  canvas.width = srcWidth;
  canvas.height = srcHeight;
  if (facingMode === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  if (cssZoom > 1) {
    const w = srcWidth / cssZoom;
    const h = srcHeight / cssZoom;
    ctx.drawImage(source, (srcWidth - w) / 2, (srcHeight - h) / 2, w, h, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(source, 0, 0, srcWidth, srcHeight, 0, 0, canvas.width, canvas.height);
  }
}

async function videoFileToBlob(filePath: string): Promise<Blob> {
  // Capacitor.convertFileSrc maps file:// → capacitor://localhost/_capacitor_file_/...
  // which the WkWebView can fetch.
  const webUrl = Capacitor.convertFileSrc(filePath);
  const res = await fetch(webUrl);
  return res.blob();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCamera(): UseCameraReturn {
  // ── Shared state (always declared regardless of platform) ──────────────
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<ZoomCaps | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastCaptureInfo, setLastCaptureInfo] = useState<CaptureDiagnostics | null>(null);

  // ── Web-only refs ──────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Native-only refs ───────────────────────────────────────────────────
  const nativeRecordingStartedAt = useRef<number | null>(null);

  // ==========================================================================
  // NATIVE PATH
  // ==========================================================================

  const nativeStartCamera = useCallback(async () => {
    try {
      setError(null);
      setIsReady(false);
      await CameraPreview.stop().catch(() => {}); // stop any existing preview

      // Use a fixed 720×960 (3:4) preview surface — enough to look sharp on screen
      // but far lighter to composite than full device resolution (e.g. 1440×3200).
      // enableHighResolution is iOS-only and controls *capture* quality, not preview.
      await CameraPreview.start({
        position: facingMode === 'user' ? 'front' : 'rear',
        toBack: true,
        width: 720,
        height: 960,
        x: 0,
        y: 0,
        enableHighResolution: true,  // iOS capture quality — no effect on preview perf
        enableZoom: false,           // disable plugin's own Android pinch handler; we prevent zoom at the WebView level instead
        lockAndroidOrientation: true,
        disableAudio: false,
      });

      // Check flash support
      try {
        const { result } = await CameraPreview.getSupportedFlashModes();
        setTorchSupported(Array.isArray(result) && result.includes('torch'));
      } catch {
        setTorchSupported(false);
      }

      setTorchOn(false);
      setCurrentZoom(1);
      setZoomCaps({ min: 1, max: 5, step: 0.1 });
      setIsReady(true);
    } catch (err: any) {
      setError(err.message || 'Failed to start native camera');
    }
  }, [facingMode]);

  const nativeStopCamera = useCallback(() => {
    CameraPreview.stop().catch(() => {});
    setIsReady(false);
    setTorchOn(false);
  }, []);

  const nativeSwitchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    CameraPreview.flip().catch(() => {});
  }, []);

  const nativeCapturePhoto = useCallback(async (): Promise<Blob | null> => {
    try {
      const result = await CameraPreview.capture({
        quality: 95,
        width: 1080,
        height: 1440,
      });
      const b64 = result.value ?? (result as any).base64 ?? '';
      if (!b64) return null;
      return base64ToBlob(b64, 'image/jpeg');
    } catch (err: any) {
      setError(err.message || 'Capture failed');
      return null;
    }
  }, []);

  const nativeStartVideo = useCallback(async () => {
    nativeRecordingStartedAt.current = Date.now();
    await CameraPreview.startRecordVideo({
      quality: 'HIGH',
      width: 1080,
      height: 1440,
    } as any);
  }, []);

  const nativeStopVideo = useCallback(async (): Promise<{ blob: Blob; durationSec: number } | null> => {
    try {
      // Type definition says void but the native implementation returns the file path
      const result: any = await CameraPreview.stopRecordVideo();
      const filePath: string = result?.videoFilePath ?? result?.value ?? '';
      if (!filePath) return null;
      const durationSec = nativeRecordingStartedAt.current
        ? Math.round((Date.now() - nativeRecordingStartedAt.current) / 1000)
        : 1;
      nativeRecordingStartedAt.current = null;
      const blob = await videoFileToBlob(filePath);
      return { blob, durationSec: Math.max(1, Math.min(10, durationSec)) };
    } catch (err: any) {
      setError(err.message || 'Failed to stop recording');
      nativeRecordingStartedAt.current = null;
      return null;
    }
  }, []);

  const nativeSetTorch = useCallback(async (on: boolean) => {
    try {
      await CameraPreview.setFlashMode({ flashMode: on ? 'torch' : 'off' });
      setTorchOn(on);
    } catch { /* not supported */ }
  }, []);

  // The camera-preview plugin exposes no programmatic zoom API;
  // pinch-to-zoom is handled natively by the plugin (enableZoom: true).
  const nativeApplyZoom = useCallback(async (_value: number) => {}, []);

  // Re-start native camera when facingMode changes
  useEffect(() => {
    if (!IS_NATIVE) return;
    if (isReady || streamRef.current) {
      nativeStartCamera();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  useEffect(() => {
    if (!IS_NATIVE) return;
    return () => { CameraPreview.stop().catch(() => {}); };
  }, []);

  // ==========================================================================
  // WEB PATH
  // ==========================================================================

  const webStartCamera = useCallback(async () => {
    try {
      setError(null);
      setIsReady(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // NOTE: width/height ideal:1920 left as-is — it's a soft constraint (the
      // browser picks the nearest supported mode) and this stream doubles as
      // the MediaRecorder source for video, so raising it would also raise
      // video encode cost and hurt recording fluidity on mid-range Android.
      // Photo resolution is handled separately via ImageCapture in capturePhoto.
      const videoConstraints: MediaTrackConstraints = {
        facingMode,
        width:  { ideal: 1920 },
        height: { ideal: 1920 },
        frameRate: { ideal: 30 },
      };
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: IS_IOS ? {
            // iOS: AGC must stay on or volume is near-silent; stereo not supported
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: true,
            channelCount: { ideal: 1 },
            sampleRate: { ideal: 48000 },
          } : {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: { ideal: 2 },
            sampleRate: { ideal: 48000 },
          },
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        // Diagnostic: {ideal:...} is a soft constraint, so this is the only
        // way to know what the browser actually negotiated on a given device.
        console.log('[camera-diag] negotiated track settings', videoTrack.getSettings?.());
        try {
          const caps = videoTrack.getCapabilities?.() as any;
          setTorchSupported(!!caps?.torch);
          setZoomCaps(caps?.zoom
            ? { min: caps.zoom.min ?? 1, max: caps.zoom.max ?? 5, step: caps.zoom.step ?? 0.1 }
            : null
          );
        } catch {
          setTorchSupported(false);
          setZoomCaps(null);
        }
      }
      setTorchOn(false);
      setCurrentZoom(1);

      await new Promise((r) => requestAnimationFrame(r));

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = mediaStream;

      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 2) { resolve(); return; }
        const onLoaded = () => { video.removeEventListener('loadedmetadata', onLoaded); video.removeEventListener('error', onError); resolve(); };
        const onError  = () => { video.removeEventListener('loadedmetadata', onLoaded); video.removeEventListener('error', onError); reject(new Error('Video error')); };
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('error', onError);
      });

      try { await video.play(); } catch (e: any) { if (e.name === 'AbortError') return; throw e; }
      setIsReady(true);
    } catch (err: any) {
      if (!streamRef.current) return;
      if (err.name === 'NotAllowedError') setError('Camera access denied. Please allow camera access.');
      else if (err.name === 'NotFoundError') setError('No camera found on this device.');
      else if (err.name === 'AbortError') return;
      else setError('Failed to access camera: ' + err.message);
    }
  }, [facingMode]);

  const webStopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }
    setIsReady(false);
  }, []);

  const webSwitchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  const webCapturePhoto = useCallback(async (cssZoom = 1): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const track = streamRef.current?.getVideoTracks()[0];
    let usedPath: 'imagecapture' | 'canvas-fallback' = 'canvas-fallback';

    // Try the native still-capture pipeline first — it pulls a full-resolution
    // photo straight from the sensor, independent of the (lower) resolution the
    // video stream negotiated. Supported on Android Chrome; not on iOS Safari,
    // where this constructor simply doesn't exist and we fall through below.
    if (track && typeof (window as any).ImageCapture === 'function') {
      let bitmap: ImageBitmap | null = null;
      try {
        const imageCapture = new (window as any).ImageCapture(track);
        const photoBlob: Blob = await withTimeout(imageCapture.takePhoto(), 1500);
        bitmap = await createImageBitmap(photoBlob);
        drawCaptureSource(ctx, canvas, bitmap, bitmap.width, bitmap.height, facingMode, cssZoom);
        usedPath = 'imagecapture';
      } catch (err) {
        // Some Android devices throw here, return a video-resolution frame
        // anyway, or stall for seconds — fall back to the video snapshot below.
        console.warn('[camera-diag] ImageCapture.takePhoto failed, using canvas fallback', err);
      } finally {
        bitmap?.close?.();
      }
    }

    if (usedPath !== 'imagecapture') {
      drawCaptureSource(ctx, canvas, video, video.videoWidth, video.videoHeight, facingMode, cssZoom);
    }

    const blob = await encodeWithSizeCap(canvas, MAX_PHOTO_UPLOAD_BYTES);
    if (blob) {
      const info: CaptureDiagnostics = {
        path: usedPath,
        width: canvas.width,
        height: canvas.height,
        bytes: blob.size,
        trackSettings: track?.getSettings?.() ?? null,
      };
      console.log('[camera-diag] photo captured', info);
      setLastCaptureInfo(info);
    }
    return blob;
  }, [facingMode]);

  const webSetTorch = useCallback(async (on: boolean) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: on } as any] }); setTorchOn(on); } catch { /* not available */ }
  }, []);

  const webApplyZoom = useCallback(async (value: number) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const caps = track.getCapabilities?.() as any;
      if (caps?.zoom) {
        const z = Math.max(caps.zoom.min, Math.min(caps.zoom.max, value));
        await track.applyConstraints({ advanced: [{ zoom: z } as any] });
        setCurrentZoom(z);
      }
    } catch { /* not supported */ }
  }, []);

  const webFocusAtPoint = useCallback(async (x: number, y: number): Promise<boolean> => {
    if (!streamRef.current) return false;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return false;
    try {
      const caps = track.getCapabilities?.() as any;
      if (caps?.focusMode?.includes('manual') || caps?.focusMode?.includes('single-shot')) {
        const constraints: any = { advanced: [{ focusMode: caps.focusMode.includes('single-shot') ? 'single-shot' : 'manual' }] };
        if (caps.pointsOfInterest) constraints.advanced[0].pointsOfInterest = [{ x, y }];
        await track.applyConstraints(constraints);
        if (caps.focusMode?.includes('continuous')) {
          setTimeout(async () => {
            try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] }); } catch { /* ignore */ }
          }, 2000);
        }
        return true;
      }
    } catch { /* not supported */ }
    return false;
  }, []);

  useEffect(() => {
    if (IS_NATIVE) return;
    if (isReady || streamRef.current) webStartCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);


  useEffect(() => {
    if (IS_NATIVE) return;
    const video = videoRef.current;
    if (!video) return;
    const onPlaying = () => { if (streamRef.current) setIsReady(true); };
    video.addEventListener('playing', onPlaying);
    return () => video.removeEventListener('playing', onPlaying);
  }, []);

  useEffect(() => {
    if (IS_NATIVE) return;
    return () => {
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, []);

  // ==========================================================================
  // Unified return
  // ==========================================================================

  if (IS_NATIVE) {
    return {
      videoRef,
      canvasRef,
      isReady,
      isNative: true,
      error,
      facingMode,
      startCamera: nativeStartCamera,
      stopCamera: nativeStopCamera,
      switchCamera: nativeSwitchCamera,
      capturePhoto: nativeCapturePhoto,
      startNativeVideo: nativeStartVideo,
      stopNativeVideo: nativeStopVideo,
      stream: null,
      lastCaptureInfo: null,
      torchSupported,
      torchOn,
      setTorch: nativeSetTorch,
      focusAtPoint: async () => false,
      zoomCaps,
      currentZoom,
      applyZoom: nativeApplyZoom,
    };
  }

  return {
    videoRef,
    canvasRef,
    isReady,
    isNative: false,
    error,
    facingMode,
    startCamera: webStartCamera,
    stopCamera: webStopCamera,
    switchCamera: webSwitchCamera,
    capturePhoto: webCapturePhoto,
    startNativeVideo: async () => {},
    stopNativeVideo: async () => null,
    stream,
    lastCaptureInfo,
    torchSupported,
    torchOn,
    setTorch: webSetTorch,
    focusAtPoint: webFocusAtPoint,
    zoomCaps,
    currentZoom,
    applyZoom: webApplyZoom,
  };
}
