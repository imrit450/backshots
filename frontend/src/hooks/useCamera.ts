import { useState, useRef, useCallback, useEffect } from 'react';

interface ZoomCaps {
  min: number;
  max: number;
  step: number;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => void;
  capturePhoto: (cssZoom?: number) => Blob | null;
  stream: MediaStream | null;
  torchSupported: boolean;
  torchOn: boolean;
  setTorch: (on: boolean) => Promise<void>;
  focusAtPoint: (x: number, y: number) => Promise<boolean>;
  zoomCaps: ZoomCaps | null;
  currentZoom: number;
  applyZoom: (value: number) => Promise<void>;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<ZoomCaps | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    setIsReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsReady(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Request video + audio (for video recording). If the user has denied
      // microphone access, fall back to video-only so the camera still works.
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: true,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities?.() as any;
          setTorchSupported(!!capabilities?.torch);

          if (capabilities?.zoom) {
            setZoomCaps({
              min: capabilities.zoom.min ?? 1,
              max: capabilities.zoom.max ?? 5,
              step: capabilities.zoom.step ?? 0.1,
            });
          } else {
            setZoomCaps(null);
          }
        } catch {
          setTorchSupported(false);
          setZoomCaps(null);
        }
      } else {
        setTorchSupported(false);
        setZoomCaps(null);
      }
      setTorchOn(false);
      setCurrentZoom(1);

      await new Promise((resolve) => requestAnimationFrame(resolve));

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = mediaStream;

      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 2) { resolve(); return; }
        const onLoaded = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          video.removeEventListener('error', onError);
          reject(new Error('Video element error'));
        };
        video.addEventListener('loadedmetadata', onLoaded);
        video.addEventListener('error', onError);
      });

      try {
        await video.play();
      } catch (playErr: any) {
        if (playErr.name === 'AbortError') return;
        throw playErr;
      }

      setIsReady(true);
    } catch (err: any) {
      if (!streamRef.current) return;
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera access to take photos.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'AbortError') {
        return;
      } else {
        setError('Failed to access camera: ' + err.message);
      }
    }
  }, [facingMode]);

  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  useEffect(() => {
    if (isReady || streamRef.current) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlaying = () => {
      if (streamRef.current) setIsReady(true);
    };
    video.addEventListener('playing', onPlaying);
    return () => video.removeEventListener('playing', onPlaying);
  }, []);

  const setTorch = useCallback(async (on: boolean) => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;
    try {
      await videoTrack.applyConstraints({ advanced: [{ torch: on } as any] });
      setTorchOn(on);
    } catch { /* not available */ }
  }, []);

  const applyZoom = useCallback(async (value: number) => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;
    try {
      const capabilities = videoTrack.getCapabilities?.() as any;
      if (capabilities?.zoom) {
        const z = Math.max(capabilities.zoom.min, Math.min(capabilities.zoom.max, value));
        await videoTrack.applyConstraints({ advanced: [{ zoom: z } as any] });
        setCurrentZoom(z);
      }
    } catch { /* not supported */ }
  }, []);

  const focusAtPoint = useCallback(async (x: number, y: number): Promise<boolean> => {
    if (!streamRef.current) return false;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return false;
    try {
      const capabilities = videoTrack.getCapabilities?.() as any;
      if (capabilities?.focusMode?.includes('manual') || capabilities?.focusMode?.includes('single-shot')) {
        const constraints: any = {
          advanced: [{
            focusMode: capabilities.focusMode.includes('single-shot') ? 'single-shot' : 'manual',
          }],
        };
        if (capabilities.pointsOfInterest) {
          constraints.advanced[0].pointsOfInterest = [{ x, y }];
        }
        await videoTrack.applyConstraints(constraints);
        if (capabilities.focusMode?.includes('continuous')) {
          setTimeout(async () => {
            try {
              await videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
            } catch { /* ignore */ }
          }, 2000);
        }
        return true;
      }
      if (capabilities?.focusMode?.includes('continuous')) {
        await videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
        return true;
      }
    } catch { /* not supported */ }
    return false;
  }, []);

  const capturePhoto = useCallback((cssZoom = 1): Blob | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    if (cssZoom > 1) {
      // Crop the center of the frame to match the CSS zoom level
      const srcW = video.videoWidth / cssZoom;
      const srcH = video.videoHeight / cssZoom;
      const srcX = (video.videoWidth - srcW) / 2;
      const srcY = (video.videoHeight - srcH) / 2;
      ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(video, 0, 0);
    }
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const byteString = atob(dataUrl.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new Blob([ab], { type: 'image/jpeg' });
  }, [facingMode]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    isReady,
    error,
    facingMode,
    startCamera,
    stopCamera,
    switchCamera,
    capturePhoto,
    stream,
    torchSupported,
    torchOn,
    setTorch,
    focusAtPoint,
    zoomCaps,
    currentZoom,
    applyZoom,
  };
}
