import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check, EyeOff, Eye } from 'lucide-react';

interface Photo {
  id: string;
  thumbUrl: string;
  largeUrl?: string;
  capturedAt: string;
  guestName?: string;
  title?: string;
  status?: string;
  hidden?: boolean;
  qualityScore?: number;
}

interface PhotoGridProps {
  photos: Photo[];
  onPhotoAction?: (photoId: string, action: string) => void;
  showActions?: boolean;
}

function qualityPillStyle(score: number): { bg: string; text: string } {
  if (score >= 70) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400' };
  if (score >= 40) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' };
  return { bg: 'bg-error/20', text: 'text-error' };
}

export default function PhotoGrid({ photos, onPhotoAction, showActions }: PhotoGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'ArrowRight') {
        setLightboxIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      } else if (e.key === 'Escape') {
        setLightboxIndex(null);
      }
    },
    [lightboxIndex, photos.length]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center">
          <span
            className="material-symbols-outlined text-on-surface-variant text-[32px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 32" }}
          >
            photo_library
          </span>
        </div>
        <div className="text-center">
          <p className="font-headline text-base font-semibold text-on-surface">No photos yet</p>
          <p className="text-sm text-on-surface-variant mt-1">Photos will appear here once guests start shooting</p>
        </div>
      </div>
    );
  }

  const currentPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <>
      {/* ── Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className={[
              'relative aspect-square group cursor-pointer',
              'bg-surface-container-low rounded-xl overflow-hidden',
              'ring-1 ring-transparent hover:ring-primary/30',
              'transition-all duration-200',
              photo.hidden ? 'opacity-50 grayscale' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setLightboxIndex(index)}
          >
            <img
              src={photo.thumbUrl}
              alt={photo.title ?? ''}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />

            {/* Status badges — top-left */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {photo.hidden && (
                <span className="badge-hidden">Hidden</span>
              )}
            </div>

            {/* Status badge — top-right */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
              {photo.status === 'PENDING' && (
                <span className="badge-pending">Pending</span>
              )}
              {photo.status === 'REJECTED' && (
                <span className="badge-rejected">Rejected</span>
              )}
              {photo.status === 'APPROVED' && (
                <span className="badge-approved">Approved</span>
              )}
            </div>

            {/* Quality score pill — only when no status badge conflicts */}
            {typeof photo.qualityScore === 'number' && !photo.status && (
              <div className="absolute top-2 right-2">
                {(() => {
                  const { bg, text } = qualityPillStyle(photo.qualityScore!);
                  return (
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${bg} ${text}`}
                    >
                      {photo.qualityScore}
                    </span>
                  );
                })()}
              </div>
            )}

            {/* Hover overlay with guest info */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
              {photo.guestName && (
                <p className="text-white text-xs font-medium truncate leading-tight">
                  {photo.guestName}
                </p>
              )}
              <p className="text-white/50 text-[10px] truncate mt-0.5">
                {new Date(photo.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Lightbox ─────────────────────────────────────── */}
      {lightboxIndex !== null && currentPhoto && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-surface-container/60 backdrop-blur-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-surface-container/60 backdrop-blur-md text-on-surface-variant text-xs font-medium">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {/* Prev arrow */}
          {lightboxIndex > 0 && (
            <button
              className="absolute left-3 sm:left-6 z-10 p-2 sm:p-3 rounded-xl bg-surface-container/60 backdrop-blur-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next arrow */}
          {lightboxIndex < photos.length - 1 && (
            <button
              className="absolute right-3 sm:right-6 z-10 p-2 sm:p-3 rounded-xl bg-surface-container/60 backdrop-blur-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Image + meta */}
          <div
            className="flex flex-col items-center max-w-5xl w-full max-h-screen px-4 sm:px-16 py-16"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentPhoto.largeUrl || currentPhoto.thumbUrl}
              alt={currentPhoto.title ?? ''}
              className={[
                'max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl',
                currentPhoto.hidden ? 'opacity-50 grayscale' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />

            {/* Meta row */}
            <div className="mt-4 w-full max-w-lg text-center space-y-1">
              {currentPhoto.title && (
                <p className="font-headline text-base font-semibold text-on-surface">
                  {currentPhoto.title}
                </p>
              )}
              <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant flex-wrap">
                {currentPhoto.guestName && (
                  <span>by {currentPhoto.guestName}</span>
                )}
                {currentPhoto.guestName && <span className="text-outline-variant">·</span>}
                <span>{new Date(currentPhoto.capturedAt).toLocaleString()}</span>
                {currentPhoto.status && (
                  <>
                    <span className="text-outline-variant">·</span>
                    {currentPhoto.status === 'PENDING' && (
                      <span className="badge-pending">{currentPhoto.status}</span>
                    )}
                    {currentPhoto.status === 'APPROVED' && (
                      <span className="badge-approved">{currentPhoto.status}</span>
                    )}
                    {currentPhoto.status === 'REJECTED' && (
                      <span className="badge-rejected">{currentPhoto.status}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {showActions && onPhotoAction && (
              <div className="mt-4 flex gap-2 flex-wrap justify-center">
                {/* Hide / Unhide */}
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest text-sm font-medium transition-colors"
                  onClick={() =>
                    onPhotoAction(
                      currentPhoto.id,
                      currentPhoto.hidden ? 'unhide' : 'hide'
                    )
                  }
                >
                  {currentPhoto.hidden ? (
                    <>
                      <Eye className="w-4 h-4" />
                      Unhide
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Hide
                    </>
                  )}
                </button>

                {/* Approve / Reject — only for pending */}
                {currentPhoto.status === 'PENDING' && (
                  <>
                    <button
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-tr from-primary to-primary-dim text-white text-sm font-bold transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-primary/20"
                      onClick={() => onPhotoAction(currentPhoto.id, 'approve')}
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-error/10 text-error border border-error/20 hover:bg-error/20 text-sm font-bold transition-colors"
                      onClick={() => onPhotoAction(currentPhoto.id, 'reject')}
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
