import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { Download, EyeOff, Eye, Images, Loader2, Play } from 'lucide-react';

type MediaItem =
  | ({ _type: 'photo' } & Record<string, any>)
  | ({ _type: 'video' } & Record<string, any>);

export default function HostGallery() {
  const { eventId } = useParams<{ eventId: string }>();
  const [photos, setPhotos] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'photos' | 'videos'>('all');

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      api.getPhotos(eventId).then((d) => setPhotos(d.photos)),
      api.getVideos(eventId).then((d) => setVideos(d.videos)),
    ])
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

  const visiblePhotos = showHidden ? photos : photos.filter((p) => !p.hidden);
  const visibleVideos = showHidden ? videos : videos.filter((v) => !v.hidden);

  const allItems: MediaItem[] = [
    ...visiblePhotos.map((p) => ({ _type: 'photo' as const, ...p })),
    ...visibleVideos.map((v) => ({ _type: 'video' as const, ...v })),
  ].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());

  const displayed =
    activeTab === 'photos'
      ? allItems.filter((i) => i._type === 'photo')
      : activeTab === 'videos'
      ? allItems.filter((i) => i._type === 'video')
      : allItems;

  const isEmpty = displayed.length === 0;

  return (
    <Layout title="Gallery" subtitle="HOST VIEW" showBack backTo={`/host/events/${eventId}`}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-surface-container-highest rounded-xl p-1 self-start">
          {(['all', 'photos', 'videos'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-surface text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab === 'all'
                ? `All (${allItems.length})`
                : tab === 'photos'
                ? `Photos (${visiblePhotos.length})`
                : `Videos (${visibleVideos.length})`}
            </button>
          ))}
        </div>

        {/* Show Hidden toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <span className="text-sm font-medium text-on-surface-variant">Show Hidden</span>
          <button
            role="switch"
            aria-checked={showHidden}
            onClick={() => setShowHidden((v) => !v)}
            className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
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
          <p className="text-on-surface-variant text-sm">Loading…</p>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center">
            <Images className="w-8 h-8 text-on-surface-variant/40" />
          </div>
          <p className="text-on-surface font-headline font-bold text-lg">Nothing here yet</p>
          <p className="text-on-surface-variant text-sm text-center max-w-xs">
            {showHidden
              ? 'No media in this event yet.'
              : 'All media is hidden. Toggle "Show Hidden" to see it.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayed.map((item, index) => {
            const isFirst = index === 0;
            const isVideo = item._type === 'video';

            return (
              <div
                key={item.id}
                className={`group relative rounded-xl overflow-hidden bg-surface-container-highest ${
                  isFirst ? 'md:col-span-2 md:row-span-2' : ''
                }`}
              >
                <div className="relative w-full aspect-square">
                  {isVideo ? (
                    <video
                      src={item.url}
                      className={`absolute inset-0 w-full h-full object-cover ${
                        item.hidden ? 'grayscale opacity-60' : ''
                      }`}
                      muted
                      playsInline
                      preload="metadata"
                      onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                      onMouseLeave={(e) => {
                        const v = e.currentTarget as HTMLVideoElement;
                        v.pause();
                        v.currentTime = 0;
                      }}
                    />
                  ) : (
                    <img
                      src={item.thumbUrl}
                      alt={item.guestName || 'Photo'}
                      className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                        item.hidden ? 'grayscale opacity-60' : ''
                      }`}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}

                  {/* Video badge */}
                  {isVideo && (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-sm text-white">
                      <Play className="w-2.5 h-2.5 fill-white" />
                      {item.durationSec}s
                    </div>
                  )}

                  {/* Hidden badge */}
                  {item.hidden && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-bright/80 backdrop-blur-sm text-on-surface-variant">
                        <EyeOff className="w-2.5 h-2.5" /> Hidden
                      </span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100">
                    <p className="text-white font-headline font-bold text-xs mb-2 truncate">
                      {item.guestName || 'Anonymous'}
                    </p>
                    <div className="flex items-center gap-2">
                      {/* Download */}
                      <a
                        href={isVideo ? item.url : item.largeUrl}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      {/* Hide / Show — photos only for now */}
                      {!isVideo && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoAction(item.id, item.hidden ? 'unhide' : 'hide');
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                          title={item.hidden ? 'Show' : 'Hide'}
                        >
                          {item.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                      )}
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
