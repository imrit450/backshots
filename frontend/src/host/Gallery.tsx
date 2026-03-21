import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { Download, EyeOff, Eye, Images, Loader2 } from 'lucide-react';

export default function HostGallery() {
  const { eventId } = useParams<{ eventId: string }>();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    api
      .getPhotos(eventId)
      .then((data) => setPhotos(data.photos))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventId]);

  const handlePhotoAction = async (photoId: string, action: string) => {
    if (!eventId) return;
    try {
      let data: any = {};
      if (action === 'hide') data.hidden = true;
      if (action === 'unhide') data.hidden = false;
      if (action === 'approve') data.status = 'APPROVED';
      if (action === 'reject') data.status = 'REJECTED';

      const res = await api.moderatePhoto(eventId, photoId, data);
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, ...res.photo } : p)));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredPhotos = showHidden ? photos : photos.filter((p) => !p.hidden);

  return (
    <Layout title="Gallery" subtitle="HOST VIEW" showBack backTo={`/host/events/${eventId}`}>
      {/* ── Header row ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-on-surface-variant text-sm font-medium">
          {filteredPhotos.length} photo{filteredPhotos.length !== 1 ? 's' : ''}
        </p>

        {/* Show Hidden toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <span className="text-sm font-medium text-on-surface-variant">Show Hidden</span>
          <button
            role="switch"
            aria-checked={showHidden}
            onClick={() => setShowHidden((v) => !v)}
            className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
              showHidden ? 'bg-primary' : 'bg-surface-container-highest'
            }`}
          >
            <span
              className={`inline-block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 mt-0.5 ${
                showHidden ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-on-surface-variant text-sm">Loading photos…</p>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center">
            <Images className="w-8 h-8 text-on-surface-variant/40" />
          </div>
          <p className="text-on-surface font-headline font-bold text-lg">No photos yet</p>
          <p className="text-on-surface-variant text-sm">
            {showHidden
              ? 'No photos in this event yet.'
              : 'All photos are hidden. Toggle "Show Hidden" to see them.'}
          </p>
        </div>
      ) : (
        /* ── Asymmetric photo grid ──────────────────────────────── */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPhotos.map((photo, index) => {
            const isFirst = index === 0;
            return (
              <div
                key={photo.id}
                className={`group relative rounded-xl overflow-hidden bg-surface-container-highest ${
                  isFirst ? 'md:col-span-2 md:row-span-2' : ''
                }`}
              >
                {/* Aspect ratio wrapper */}
                <div className={`relative w-full ${isFirst ? 'aspect-square' : 'aspect-square'}`}>
                  <img
                    src={photo.thumbUrl}
                    alt={photo.guestName || 'Photo'}
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                      photo.hidden ? 'grayscale opacity-60' : ''
                    }`}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />

                  {/* Hidden badge */}
                  {photo.hidden && (
                    <div className="absolute top-2 left-2 z-10">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-bright/80 backdrop-blur-sm text-on-surface-variant">
                        <EyeOff className="w-2.5 h-2.5" /> Hidden
                      </span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100">
                    {/* Guest name */}
                    <p className="text-white font-headline font-bold text-xs mb-2 truncate">
                      {photo.guestName || 'Anonymous'}
                    </p>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {/* Download */}
                      {photo.largeUrl && (
                        <a
                          href={photo.largeUrl}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {/* Hide / Show */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePhotoAction(photo.id, photo.hidden ? 'unhide' : 'hide');
                        }}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title={photo.hidden ? 'Show photo' : 'Hide photo'}
                      >
                        {photo.hidden ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
