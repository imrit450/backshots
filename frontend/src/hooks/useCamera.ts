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

      const videoConstraints: MediaTrackConstraints = {
        facingMode,
        width:  { ideal: 1920 },
        height: { ideal: 1920 },
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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    if (cssZoom > 1) {
      const srcW = video.videoWidth / cssZoom;
      const srcH = video.videoHeight / cssZoom;
      ctx.drawImage(video, (video.videoWidth - srcW) / 2, (video.videoHeight - srcH) / 2, srcW, srcH, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(video, 0, 0);
    }
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const b64 = dataUrl.split(',')[1];
    return base64ToBlob(b64, 'image/jpeg');
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
    torchSupported,
    torchOn,
    setTorch: webSetTorch,
    focusAtPoint: webFocusAtPoint,
    zoomCaps,
    currentZoom,
    applyZoom: webApplyZoom,
  };
}
