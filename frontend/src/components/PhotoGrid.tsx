import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Photo {
  id: string;
  thumbUrl: string;
  largeUrl?: string;
  capturedAt: string;
  guestName?: string;
  title?: string;
  status?: string;
  hidden?: boolean;
}

interface PhotoGridProps {
  photos: Photo[];
  onPhotoAction?: (photoId: string, action: string) => void;
  showActions?: boolean;
}

export default function PhotoGrid({ photos, onPhotoAction, showActions }: PhotoGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-4">📷</div>
        <p className="text-lg font-display">No photos yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="relative aspect-square group cursor-pointer overflow-hidden rounded-xl bg-gray-100"
            onClick={() => setLightboxIndex(index)}
          >
            <img
              src={photo.thumbUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />

            {/* Status badges */}
            {photo.hidden && (
              <div className="absolute top-2 left-2 badge-danger text-[10px]">Hidden</div>
            )}
            {photo.status === 'PENDING' && (
              <div className="absolute top-2 right-2 badge-warning text-[10px]">Pending</div>
            )}
            {photo.status === 'REJECTED' && (
              <div className="absolute top-2 right-2 badge-danger text-[10px]">Rejected</div>
            )}

            {/* Always-visible subtle overlay with title & guest name */}
            {(photo.title || photo.guestName) && (
              <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/60 via-black/25 to-transparent">
                {photo.title && (
                  <p className="text-white text-[11px] font-display leading-tight truncate">
                    {photo.title}
                  </p>
                )}
                {photo.guestName && (
                  <p className="text-white/50 text-[10px] truncate mt-0.5">
                    by {photo.guestName}
                  </p>
                )}
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="w-8 h-8" />
          </button>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 text-white/80 hover:text-white z-10"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
            >
              <ChevronLeft className="w-10 h-10" />
            </button>
          )}

          {lightboxIndex < photos.length - 1 && (
            <button
              className="absolute right-4 text-white/80 hover:text-white z-10"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
            >
              <ChevronRight className="w-10 h-10" />
            </button>
          )}

          <div className="max-w-4xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={photos[lightboxIndex].largeUrl || photos[lightboxIndex].thumbUrl}
              alt=""
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-4 text-center">
              {photos[lightboxIndex].title && (
                <p className="text-white font-display text-lg mb-1">
                  {photos[lightboxIndex].title}
                </p>
              )}
              <div className="text-white/50 text-sm font-sans">
                {photos[lightboxIndex].guestName && (
                  <span>by {photos[lightboxIndex].guestName} &middot; </span>
                )}
                {new Date(photos[lightboxIndex].capturedAt).toLocaleString()}
              </div>
            </div>
            {showActions && onPhotoAction && (
              <div className="mt-3 flex gap-2 justify-center">
                <button
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
                  onClick={() =>
                    onPhotoAction(
                      photos[lightboxIndex!].id,
                      photos[lightboxIndex!].hidden ? 'unhide' : 'hide'
                    )
                  }
                >
                  {photos[lightboxIndex].hidden ? 'Unhide' : 'Hide'}
                </button>
                {photos[lightboxIndex].status === 'PENDING' && (
                  <>
                    <button
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
                      onClick={() => onPhotoAction(photos[lightboxIndex!].id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                      onClick={() => onPhotoAction(photos[lightboxIndex!].id, 'reject')}
                    >
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
