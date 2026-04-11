import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Camera, ChevronLeft, Play } from 'lucide-react';
import { LogoIcon } from '../components/Logo';

type MediaItem =
  | ({ _type: 'photo' } & Record<string, any>)
  | ({ _type: 'video' } & Record<string, any>);

export default function GuestGallery() {
  const { eventCode } = useParams<{ eventCode: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest');
  const event = JSON.parse(sessionStorage.getItem('guestEvent') || '{}');

  useEffect(() => {
    if (!eventCode) return;
    setLoading(true);
    api
      .getGuestGallery(eventCode, { sort })
      .then((data) => {
        const photos: MediaItem[] = (data.photos || []).map((p: any) => ({ _type: 'photo' as const, ...p }));
        const videos: MediaItem[] = ((data as any).videos || []).map((v: any) => ({ _type: 'video' as const, ...v }));
        const merged = [...photos, ...videos].sort(
          (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
        );
        setItems(merged);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventCode, sort]);

  return (
    <div className="min-h-screen bg-surface">
      {/* Fixed top bar */}
      <header className="fixed top-0 w-full z-30 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20">
        <div className="px-6 py-4 flex items-center justify-between gap-3">
          {/* Left: back + event info */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/e/${eventCode}/camera`)}
              className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center flex-shrink-0 hover:bg-surface-bright transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-on-surface" />
            </button>

            {event.iconUrl && (
              <img
                src={event.iconUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-outline-variant/30"
              />
            )}

            <div className="min-w-0">
              <h1 className="font-headline font-bold text-on-surface text-sm truncate leading-tight">
                {event.title || 'Gallery'}
              </h1>
              <p className="text-on-surface-variant text-xs leading-tight">
                {loading ? 'Loading...' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {/* Right: sort toggle + camera shortcut */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sort toggle pills */}
            <div className="flex items-center bg-surface-container-highest rounded-xl p-1">
              <button
                onClick={() => setSort('latest')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                  sort === 'latest'
                    ? 'bg-surface-bright text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Latest
              </button>
              <button
                onClick={() => setSort('oldest')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                  sort === 'oldest'
                    ? 'bg-surface-bright text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Oldest
              </button>
            </div>

            {/* Camera shortcut */}
            <button
              onClick={() => navigate(`/e/${eventCode}/camera`)}
              className="w-9 h-9 rounded-full kinetic-gradient shutter-glow flex items-center justify-center flex-shrink-0"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Media grid — offset for fixed header */}
      <div className="pt-20 px-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex justify-center py-20">
            <p className="text-on-surface-variant text-sm">Nothing here yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {items.map((item) => (
              <div key={item.id} className="relative aspect-square rounded-sm overflow-hidden bg-surface-container-highest">
                {item._type === 'video' ? (
                  <>
                    <video
                      src={item.url}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute bottom-1 left-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
                      <Play className="w-2.5 h-2.5 fill-white" />
                      {item.durationSec}s
                    </div>
                  </>
                ) : (
                  <img
                    src={item.thumbUrl}
                    alt={item.guestName || ''}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom fade + footer */}
      <div className="fixed bottom-0 w-full z-20 pointer-events-none pb-4 pt-8 flex justify-center bg-gradient-to-t from-surface to-transparent">
        <LogoIcon size={14} className="opacity-30 pointer-events-auto" />
      </div>
    </div>
  );
}
