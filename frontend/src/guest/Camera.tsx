import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCamera } from '../hooks/useCamera';
import { api } from '../api/client';
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
} from 'lucide-react';
import { getTheme } from '../config/themes';
import Footer from '../components/Footer';

interface MyPhoto {
  id: string;
  thumbUrl: string;
  status: string;
}

function loadMyPhotos(eventId: string): MyPhoto[] {
  try {
    return JSON.parse(sessionStorage.getItem(`myPhotos_${eventId}`) || '[]');
  } catch {
    return [];
  }
}

function saveMyPhotos(eventId: string, photos: MyPhoto[]) {
  sessionStorage.setItem(`myPhotos_${eventId}`, JSON.stringify(photos));
}

type ScreenState = 'camera' | 'preview' | 'success' | 'myPhotos' | 'photoPreview';

export default function GuestCamera() {
  const { eventCode } = useParams<{ eventCode: string }>();
  const navigate = useNavigate();
  const camera = useCamera();

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

  // Title & description for the photo
  const [photoTitle, setPhotoTitle] = useState('');
  const [photoDescription, setPhotoDescription] = useState('');

  const session = JSON.parse(sessionStorage.getItem('guestSession') || '{}');
  const event = JSON.parse(sessionStorage.getItem('guestEvent') || '{}');
  const theme = getTheme(event.theme);
  const guestName = localStorage.getItem('guestDisplayName') || session.displayName || '';

  // Uploads closed = cutoff hours have passed since event start
  const uploadsClosed = (() => {
    const cutoff = event.uploadCutoffHours ?? 24;
    if (cutoff <= 0) return false;
    const start = event.startDatetime ? new Date(event.startDatetime).getTime() : 0;
    if (!start) return false;
    const cutoffTime = start + cutoff * 60 * 60 * 1000;
    return Date.now() > cutoffTime;
  })();

  // Sync photo statuses from the server
  const refreshPhotoStatuses = useCallback(async () => {
    if (!event.id) return;
    try {
      const data = await api.getMyPhotos(event.id);
      const serverPhotos: MyPhoto[] = data.photos.map((p: any) => ({
        id: p.id,
        thumbUrl: p.thumbUrl,
        status: p.status,
      }));
      setMyPhotos(serverPhotos);
      saveMyPhotos(event.id, serverPhotos);
    } catch {
      // Silently fail — keep local state
    }
  }, [event.id]);

  useEffect(() => {
    if (!session.id) {
      navigate(`/e/${eventCode}`, { replace: true });
      return;
    }
    camera.startCamera();
    if (event.id) {
      setMyPhotos(loadMyPhotos(event.id));
      // Initial server sync
      refreshPhotoStatuses();
    }
    return () => camera.stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for status changes every 15 seconds
  useEffect(() => {
    if (!event.id) return;
    const interval = setInterval(refreshPhotoStatuses, 15_000);
    return () => clearInterval(interval);
  }, [event.id, refreshPhotoStatuses]);

  const handleCapture = useCallback(async () => {
    if (flashEnabled) {
      if (camera.torchSupported) {
        // Hardware torch: turn on, wait for it to warm up, capture, turn off
        await camera.setTorch(true);
        await new Promise((r) => setTimeout(r, 400));
      } else {
        // Screen flash: show white overlay, wait for paint + brightness
        setScreenFlash(true);
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(resolve, 500);
            });
          });
        });
      }
    }

    const blob = camera.capturePhoto();

    // Turn off flash/torch after capture
    if (flashEnabled) {
      if (camera.torchSupported) {
        // Small delay so the photo is fully captured with light, then off
        setTimeout(() => camera.setTorch(false), 100);
      } else {
        setTimeout(() => setScreenFlash(false), 200);
      }
    }

    if (blob) {
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      setPhotoTitle('');
      setPhotoDescription('');
      setScreen('preview');
    }
  }, [camera, flashEnabled]);

  const handleRetake = useCallback(() => {
    setCapturedBlob(null);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setError('');
    setPhotoTitle('');
    setPhotoDescription('');
    setScreen('camera');
    // Camera stream is still alive since video element stays in DOM.
    // Just re-assign srcObject and play in case it went stale.
    camera.startCamera();
  }, [capturedUrl, camera]);

  const handleSubmit = async () => {
    if (!capturedBlob || !event.id) return;
    setUploading(true);
    setError('');

    try {
      const data = await api.uploadPhoto(
        event.id,
        capturedBlob,
        photoTitle.trim() || undefined,
        photoDescription.trim() || undefined
      );
      const newPhoto: MyPhoto = {
        id: data.photo.id,
        thumbUrl: data.photo.thumbUrl,
        status: data.photo.status,
      };
      const updated = [newPhoto, ...myPhotos];
      setMyPhotos(updated);
      saveMyPhotos(event.id, updated);
      setRemaining(data.remainingPhotos);
      setScreen('success');
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleTakeAnother = () => {
    setCapturedBlob(null);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
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
      // If we're previewing the deleted photo, go back to grid
      if (previewPhoto?.id === photoId) {
        setPreviewPhoto(null);
        setScreen('myPhotos');
      }
      // Increment remaining count
      if (remaining !== null) {
        setRemaining(remaining + 1);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo');
    } finally {
      setDeleting(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Screen flash overlay — covers entire screen for front camera flash */}
      {screenFlash && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 9999, backgroundColor: '#ffffff', opacity: 1 }}
        />
      )}
      {/* ══════ CAMERA VIEW — always rendered underneath ══════ */}
      {/* Top Bar */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] z-10">
        <button
          onClick={() => navigate(`/e/${eventCode}`)}
          className="w-10 h-10 bg-black/40 backdrop-blur rounded-full flex items-center justify-center"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-center gap-2">
          {guestName && (
            <span className="text-white/50 text-xs bg-black/30 backdrop-blur px-2.5 py-1 rounded-full truncate max-w-[120px]">
              {guestName}
            </span>
          )}
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur px-2 py-1 rounded-full max-w-[180px]">
            {event.iconUrl && (
              <img src={event.iconUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            )}
            <span className="text-white/70 text-sm font-display truncate">
              {event.title}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            const next = !flashEnabled;
            setFlashEnabled(next);
            localStorage.setItem('flashEnabled', String(next));
          }}
          className="w-10 h-10 bg-black/40 backdrop-blur rounded-full flex items-center justify-center"
        >
          {flashEnabled ? (
            <Zap className="w-5 h-5" style={{ color: theme.accent }} />
          ) : (
            <ZapOff className="w-5 h-5 text-white/60" />
          )}
        </button>
      </div>

      {/* Camera View */}
      <div
        className="flex-1 relative min-h-0 overflow-hidden"
        onClick={(e) => {
          if (!camera.isReady || camera.error || screen !== 'camera') return;
          const rect = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;
          // Normalised 0–1 coords for the camera API
          let nx = px / rect.width;
          const ny = py / rect.height;
          // If front camera is mirrored, flip x
          if (camera.facingMode === 'user') nx = 1 - nx;

          // Show focus ring at tap position (pixel coords)
          setFocusPoint({ x: px, y: py });
          if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
          focusTimerRef.current = setTimeout(() => setFocusPoint(null), 1200);

          // Trigger camera focus
          camera.focusAtPoint(nx, ny);
        }}
      >
        <video
          ref={camera.videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${camera.error ? 'hidden' : ''}`}
          style={{
            transform: camera.facingMode === 'user' ? 'scaleX(-1)' : 'none',
          }}
        />

        {/* Tap-to-focus ring */}
        {focusPoint && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: focusPoint.x - 30,
              top: focusPoint.y - 30,
              width: 60,
              height: 60,
            }}
          >
            <div
              className="w-full h-full rounded-full border-2"
              style={{
                borderColor: theme.accent,
                animation: 'focusRing 0.6s ease-out forwards',
              }}
            />
          </div>
        )}

        {/* Screen flash handled at root level below */}
        {camera.error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center text-white">
              <Camera className="w-16 h-16 text-white/30 mx-auto mb-4" />
              <p className="text-white/70 mb-4">{camera.error}</p>
              <button
                onClick={camera.startCamera}
                className="px-6 py-3 bg-white/10 rounded-full text-white font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={camera.canvasRef} className="hidden" />

      {/* My Photos strip */}
      {myPhotos.length > 0 && screen === 'camera' && (
        <div className="flex-shrink-0 px-4 pt-3 bg-black">
          <button
            onClick={() => { refreshPhotoStatuses(); setScreen('myPhotos'); }}
            className="flex items-center gap-2 w-full"
          >
            <div className="flex -space-x-2">
              {myPhotos.slice(0, 4).map((photo, i) => (
                <div
                  key={photo.id}
                  className="w-10 h-10 rounded-lg overflow-hidden border-2 border-black flex-shrink-0"
                  style={{ zIndex: 4 - i }}
                >
                  <img src={photo.thumbUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <span className="text-xs font-medium" style={{ color: `${theme.accent}B3` }}>
              My Photos ({myPhotos.length})
            </span>
          </button>
        </div>
      )}

      {/* Bottom Controls */}
      {screen === 'camera' && (
        <>
          {uploadsClosed && (
            <div className="flex-shrink-0 mx-4 mb-2 p-4 rounded-xl bg-amber-500/20 border border-amber-400/30 text-center">
              <p className="text-amber-100 text-sm font-medium">
                Photo uploads have closed for this event.
              </p>
              <p className="text-amber-200/80 text-xs mt-1">
                You can still view your photos and the gallery.
              </p>
            </div>
          )}
          <div className="flex-shrink-0 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-10 bg-black">
          <button
            onClick={() => event.guestGalleryEnabled && navigate(`/e/${eventCode}/gallery`)}
            className={`flex flex-col items-center gap-1 ${
              !event.guestGalleryEnabled ? 'opacity-30' : ''
            }`}
            disabled={!event.guestGalleryEnabled}
          >
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
              <Images className="w-5 h-5 text-white" />
            </div>
            <span className="text-white/50 text-[10px]">Gallery</span>
          </button>

          <button
            onClick={handleCapture}
            disabled={!camera.isReady || uploadsClosed}
            className="w-[72px] h-[72px] rounded-full border-[4px] border-white flex items-center justify-center
            active:scale-90 transition-transform disabled:opacity-30 flex-shrink-0"
          >
            <div className="w-[60px] h-[60px] bg-white rounded-full active:bg-white/80 transition-colors" />
          </button>

          <button
            onClick={camera.switchCamera}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
              <SwitchCamera className="w-5 h-5 text-white" />
            </div>
            <span className="text-white/50 text-[10px]">Flip</span>
          </button>
        </div>
        </>
      )}

      {/* ══════ PREVIEW OVERLAY ══════ */}
      {screen === 'preview' && capturedUrl && (
        <div className="absolute inset-0 bg-black flex flex-col z-40">
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Photo preview */}
            <div className="flex-shrink-0 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <img
                src={capturedUrl}
                alt="Captured"
                className="max-w-full max-h-[45vh] object-contain rounded-2xl"
              />
            </div>

            {/* Title & Description fields */}
            <div className="flex-shrink-0 px-6 space-y-3">
              <div className="relative">
                <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={photoTitle}
                  onChange={(e) => setPhotoTitle(e.target.value)}
                  placeholder="Add a title (optional)"
                  maxLength={100}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/10
                  text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-white/30" />
                <textarea
                  value={photoDescription}
                  onChange={(e) => setPhotoDescription(e.target.value)}
                  placeholder="Add a description (optional)"
                  maxLength={500}
                  rows={2}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/10
                  text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-4 mb-2 text-red-200 text-sm bg-red-500/30 px-4 py-2 rounded-xl text-center">
              {error}
            </div>
          )}

          <div className="flex-shrink-0 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-6">
            <button
              onClick={handleRetake}
              disabled={uploading}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/70 text-xs">Retake</span>
            </button>

            {uploadsClosed && (
              <p className="text-amber-200 text-sm">Uploads have closed for this event.</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={uploading || uploadsClosed}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-colors" style={{ backgroundColor: theme.buttonBg }}>
                {uploading ? (
                  <Loader className="w-8 h-8 animate-spin" style={{ color: theme.buttonText }} />
                ) : (
                  <Check className="w-8 h-8" style={{ color: theme.buttonText }} />
                )}
              </div>
              <span className="text-white/70 text-xs">
                {uploading ? 'Uploading...' : 'Submit'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ══════ SUCCESS OVERLAY ══════ */}
      {screen === 'success' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white z-40" style={{ background: theme.bgGradient }}>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl" style={{ backgroundColor: `${theme.accent}1A` }} />
          </div>

          <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg" style={{ backgroundColor: theme.buttonBg }}>
              <Check className="w-10 h-10" style={{ color: theme.buttonText }} />
            </div>
            <h1 className="font-display text-3xl text-white mb-2">Photo Submitted!</h1>
            <p className="text-white/50 mb-8 text-center font-sans text-sm">
              {remaining !== null && remaining > 0
                ? `You can take ${remaining} more photo${remaining === 1 ? '' : 's'}`
                : remaining === 0
                ? "You've reached the photo limit"
                : 'Your photo has been uploaded successfully'}
            </p>

            <div className="w-full space-y-3">
              {remaining !== null && remaining > 0 && (
                <button
                  onClick={handleTakeAnother}
                  className="w-full py-4 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-colors"
                  style={{ backgroundColor: theme.buttonBg, color: theme.buttonText }}
                >
                  <Camera className="w-5 h-5" />
                  Take Another
                </button>
              )}

              {myPhotos.length > 0 && (
                <button
                  onClick={() => setScreen('myPhotos')}
                  className="w-full py-4 bg-white/8 backdrop-blur text-white font-semibold rounded-2xl flex items-center justify-center gap-2 border hover:bg-white/12 transition-colors"
                  style={{ borderColor: theme.inputBorder }}
                >
                  <User className="w-5 h-5" />
                  My Photos ({myPhotos.length})
                </button>
              )}

              {event.guestGalleryEnabled && (
                <button
                  onClick={() => navigate(`/e/${eventCode}/gallery`)}
                  className="w-full py-4 bg-white/5 backdrop-blur text-white/70 font-semibold rounded-2xl flex items-center justify-center gap-2 border border-white/10 hover:bg-white/8 transition-colors"
                >
                  <Images className="w-5 h-5" />
                  View Event Gallery
                </button>
              )}
            </div>

            <p className="text-white/25 text-xs mt-6 font-sans">Scan. Capture. Celebrate.</p>
            <Footer className="mt-4" />
          </div>
        </div>
      )}

      {/* ══════ MY PHOTOS OVERLAY ══════ */}
      {screen === 'myPhotos' && (
        <div className="absolute inset-0 bg-black z-40 flex flex-col">
          <div className="flex-shrink-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <button
              onClick={() => setScreen('camera')}
              className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="text-white font-display text-xl flex items-center gap-2">
              <User className="w-4 h-4" />
              My Photos ({myPhotos.length})
            </div>
            <div className="w-10" />
          </div>

          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {myPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/50">
                <Camera className="w-12 h-12 mb-3 opacity-50" />
                <p>No photos yet. Start capturing!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {myPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`aspect-square rounded-xl overflow-hidden bg-gray-800 relative ${
                      deleting === photo.id ? 'opacity-40 pointer-events-none' : ''
                    }`}
                  >
                    <button
                      onClick={() => {
                        setPreviewPhoto(photo);
                        setScreen('photoPreview');
                      }}
                      className="w-full h-full"
                    >
                      <img src={photo.thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                    {/* Status badge */}
                    {photo.status === 'PENDING' && (
                      <div className="absolute top-1 left-1 bg-yellow-500 text-[9px] text-white px-1.5 py-0.5 rounded-full font-medium">
                        Pending
                      </div>
                    )}
                    {photo.status === 'APPROVED' && (
                      <div className="absolute top-1 left-1 bg-green-500 text-[9px] text-white px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <CheckCircle className="w-2.5 h-2.5" />
                        Approved
                      </div>
                    )}
                    {photo.status === 'REJECTED' && (
                      <div className="absolute top-1 left-1 bg-red-500 text-[9px] text-white px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <XCircle className="w-2.5 h-2.5" />
                        Rejected
                      </div>
                    )}
                    {/* Delete button — only for pending photos */}
                    {photo.status === 'PENDING' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 backdrop-blur rounded-full flex items-center justify-center"
                        title="Delete"
                      >
                        {deleting === photo.id ? (
                          <Loader className="w-3 h-3 text-white animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3 text-white" />
                        )}
                      </button>
                    )}
                    {deleting === photo.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Loader className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => { setScreen('camera'); camera.startCamera(); }}
              className="w-full py-4 text-white font-bold rounded-2xl flex items-center justify-center gap-2"
              style={{ backgroundColor: theme.headerBg }}
            >
              <Camera className="w-5 h-5" />
              Back to Camera
            </button>
          </div>
        </div>
      )}

      {/* ══════ FULL-SCREEN PHOTO PREVIEW ══════ */}
      {screen === 'photoPreview' && previewPhoto && (
        <div
          className="absolute inset-0 bg-black z-50 flex flex-col"
          onClick={() => setScreen('myPhotos')}
        >
          {/* Top bar */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <button
              className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); setScreen('myPhotos'); }}
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="flex items-center gap-2">
              {previewPhoto.status === 'PENDING' && (
                <span className="bg-yellow-500 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                  Pending
                </span>
              )}
              {previewPhoto.status === 'APPROVED' && (
                <span className="bg-green-500 text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Approved
                </span>
              )}
              {previewPhoto.status === 'REJECTED' && (
                <span className="bg-red-500 text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Rejected
                </span>
              )}
            </div>

            {previewPhoto.status === 'PENDING' ? (
              <button
                className="w-10 h-10 bg-red-500/70 rounded-full flex items-center justify-center"
                onClick={(e) => { e.stopPropagation(); handleDeletePhoto(previewPhoto.id); }}
                disabled={deleting === previewPhoto.id}
              >
                {deleting === previewPhoto.id ? (
                  <Loader className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5 text-white" />
                )}
              </button>
            ) : (
              <div className="w-10" />
            )}
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center min-h-0 p-4">
            <img
              src={previewPhoto.thumbUrl}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
