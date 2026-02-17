import { useState, useRef, useCallback, useEffect } from 'react';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  error: string | null;
  facingMode: 'user' | 'environment';
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => void;
  capturePhoto: () => Blob | null;
  stream: MediaStream | null;
  torchSupported: boolean;
  torchOn: boolean;
  setTorch: (on: boolean) => Promise<void>;
  focusAtPoint: (x: number, y: number) => Promise<boolean>;
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

      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);

      // Check if torch is supported on the video track
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities?.() as any;
          setTorchSupported(!!capabilities?.torch);
        } catch {
          setTorchSupported(false);
        }
      } else {
        setTorchSupported(false);
      }
      setTorchOn(false);

      // Wait a tick for React to ensure the video element is in the DOM
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const video = videoRef.current;
      if (!video) {
        // Video element not mounted yet; it will pick up the stream via autoPlay
        return;
      }

      video.srcObject = mediaStream;

      // Wait for metadata to load before attempting play
      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 2) {
          resolve();
          return;
        }
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
        // AbortError means the element was removed/reset - not a real camera error.
        // The autoPlay attribute on the video element will handle playback.
        if (playErr.name === 'AbortError') {
          return;
        }
        throw playErr;
      }

      setIsReady(true);
    } catch (err: any) {
      // Don't overwrite state if we've been stopped in the meantime
      if (!streamRef.current) return;

      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera access to take photos.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'AbortError') {
        // Ignore - autoPlay will handle it
        return;
      } else {
        setError('Failed to access camera: ' + err.message);
      }
    }
  }, [facingMode]);

  const switchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, []);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isReady || streamRef.current) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Mark ready when video starts playing (handles autoPlay case)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlaying = () => {
      if (streamRef.current) {
        setIsReady(true);
      }
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
    } catch {
      // Torch not available on this track
    }
  }, []);

  // Focus at a normalised point (0–1 range for both x and y)
  const focusAtPoint = useCallback(async (x: number, y: number): Promise<boolean> => {
    if (!streamRef.current) return false;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return false;

    try {
      const capabilities = videoTrack.getCapabilities?.() as any;

      // Method 1: Use focusMode + pointsOfInterest (Chrome Android)
      if (capabilities?.focusMode?.includes('manual') || capabilities?.focusMode?.includes('single-shot')) {
        const constraints: any = {
          advanced: [{
            focusMode: capabilities.focusMode.includes('single-shot') ? 'single-shot' : 'manual',
          }],
        };
        // pointsOfInterest expects an array of {x, y} in normalised coords
        if (capabilities.pointsOfInterest) {
          constraints.advanced[0].pointsOfInterest = [{ x, y }];
        }
        await videoTrack.applyConstraints(constraints);

        // After focusing, switch back to continuous if available
        if (capabilities.focusMode?.includes('continuous')) {
          setTimeout(async () => {
            try {
              await videoTrack.applyConstraints({
                advanced: [{ focusMode: 'continuous' } as any],
              });
            } catch { /* ignore */ }
          }, 2000);
        }
        return true;
      }

      // Method 2: If only continuous focus, briefly toggle to trigger re-focus
      if (capabilities?.focusMode?.includes('continuous')) {
        await videoTrack.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as any],
        });
        return true;
      }
    } catch {
      // Focus not supported on this device/browser
    }
    return false;
  }, []);

  const capturePhoto = useCallback((): Blob | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Mirror if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);

    // Convert to blob synchronously via dataURL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const byteString = atob(dataUrl.split(',')[1]);
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }, [facingMode]);

  // Cleanup on unmount
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
  };
}
