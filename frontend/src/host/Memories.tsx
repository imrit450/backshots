import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { getTheme } from '../config/themes';
import { CalendarDays, MapPin, Camera, Video, ChevronRight, ImageOff } from 'lucide-react';

interface Memory {
  guestSession: {
    id: string;
    displayName: string;
    photoCount: number;
    createdAt: string;
  };
  event: {
    id: string;
    title: string;
    location: string | null;
    startDatetime: string;
    timezone: string;
    theme: string;
    eventCode: string;
    iconUrl: string | null;
    hostName: string;
    isOwnEvent: boolean;
  };
  photos: Array<{
    id: string;
    thumbUrl: string | null;
    largeUrl: string | null;
    capturedAt: string;
    status: string;
  }>;
  videos: Array<{
    id: string;
    url: string;
    durationSec: number;
    capturedAt: string;
    status: string;
  }>;
}

function formatDate(iso: string, timezone?: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone || 'UTC',
  });
}

function MemoryCard({ memory, onClick }: { memory: Memory; onClick: () => void }) {
  const theme = getTheme(memory.event.theme);
  const previewPhotos = memory.photos.filter((p) => p.thumbUrl).slice(0, 4);
  const totalMedia = memory.photos.length + memory.videos.length;

  return (
    <button
      onClick={onClick}
      className="w-full text-left group bg-surface-container rounded-2xl overflow-hidden border border-outline-variant/30 hover:border-primary/40 hover:shadow-lg transition-all duration-200"
    >
      {/* Photo strip */}
      <div className="relative h-36 overflow-hidden" style={{ background: theme.bgGradient }}>
        {previewPhotos.length > 0 ? (
          <div className={`grid h-full ${previewPhotos.length === 1 ? 'grid-cols-1' : previewPhotos.length === 2 ? 'grid-cols-2' : previewPhotos.length === 3 ? 'grid-cols-3' : 'grid-cols-4'} gap-px`}>
            {previewPhotos.map((p) => (
              <div key={p.id} className="h-full overflow-hidden">
                <img
                  src={p.thumbUrl!}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full opacity-30">
            <ImageOff className="w-10 h-10 text-white" />
          </div>
        )}

        {/* Event icon overlay */}
        {memory.event.iconUrl && (
          <div className="absolute top-3 left-3 w-10 h-10 rounded-xl overflow-hidden shadow-lg border-2 border-white/20">
            <img src={memory.event.iconUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Media count badge */}
        {totalMedia > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {memory.photos.length > 0 && (
              <span className="flex items-center gap-1">
                <Camera className="w-3 h-3" />
                {memory.photos.length}
              </span>
            )}
            {memory.photos.length > 0 && memory.videos.length > 0 && (
              <span className="text-white/40">·</span>
            )}
            {memory.videos.length > 0 && (
              <span className="flex items-center gap-1">
                <Video className="w-3 h-3" />
                {memory.videos.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-on-surface truncate">{memory.event.title}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {formatDate(memory.event.startDatetime, memory.event.timezone)}
            </span>
            {memory.event.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{memory.event.location}</span>
              </span>
            )}
          </div>
          {!memory.event.isOwnEvent && (
            <p className="text-xs text-on-surface-variant/60 mt-0.5">
              Hosted by {memory.event.hostName}
            </p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-on-surface-variant/40 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}

function MemoryDetail({ memory, onBack }: { memory: Memory; onBack: () => void }) {
  const theme = getTheme(memory.event.theme);
  const approvedPhotos = memory.photos.filter((p) => p.status === 'APPROVED' && (p.largeUrl || p.thumbUrl));
  const approvedVideos = memory.videos.filter((v) => v.status === 'APPROVED');
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <div>
      {/* Back button + header */}
      <div
        className="rounded-2xl overflow-hidden mb-6"
        style={{ background: theme.bgGradient }}
      >
        <div className="px-6 py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm mb-4 opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: theme.textPrimary }}
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            All Memories
          </button>
          {memory.event.iconUrl && (
            <img
              src={memory.event.iconUrl}
              alt=""
              className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20 mb-4"
            />
          )}
          <h1
            className="text-2xl font-bold font-headline leading-tight"
            style={{ color: theme.textPrimary }}
          >
            {memory.event.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm" style={{ color: theme.textSecondary }}>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              {formatDate(memory.event.startDatetime, memory.event.timezone)}
            </span>
            {memory.event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {memory.event.location}
              </span>
            )}
          </div>
          {!memory.event.isOwnEvent && (
            <p className="text-sm mt-1.5 opacity-60" style={{ color: theme.textPrimary }}>
              Hosted by {memory.event.hostName}
            </p>
          )}
          <p className="text-sm mt-1.5 opacity-60" style={{ color: theme.textPrimary }}>
            You joined as {memory.guestSession.displayName}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-surface-container rounded-2xl p-4 text-center border border-outline-variant/30">
          <Camera className="w-5 h-5 mx-auto mb-1.5 text-primary" />
          <p className="text-2xl font-bold text-on-surface">{memory.photos.length}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">Photos</p>
        </div>
        <div className="bg-surface-container rounded-2xl p-4 text-center border border-outline-variant/30">
          <Video className="w-5 h-5 mx-auto mb-1.5 text-secondary" />
          <p className="text-2xl font-bold text-on-surface">{memory.videos.length}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">Videos</p>
        </div>
      </div>

      {/* Photo grid */}
      {approvedPhotos.length === 0 && approvedVideos.length === 0 ? (
        <div className="bg-surface-container rounded-2xl p-10 text-center border border-outline-variant/30">
          <ImageOff className="w-10 h-10 mx-auto mb-3 text-on-surface-variant/30" />
          <p className="text-on-surface-variant text-sm">
            No approved media yet — check back once the host reviews uploads.
          </p>
        </div>
      ) : (
        <div>
          {approvedPhotos.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                Photos
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5 mb-6">
                {approvedPhotos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setLightbox(p.largeUrl || p.thumbUrl!)}
                    className="aspect-square rounded-xl overflow-hidden bg-surface-container-high hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={p.thumbUrl || p.largeUrl!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          {approvedVideos.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-3">
                Videos
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {approvedVideos.map((v) => (
                  <div key={v.id} className="rounded-xl overflow-hidden bg-black aspect-video">
                    <video
                      src={v.url}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
            onClick={() => setLightbox(null)}
          >
            <span className="material-symbols-outlined text-[28px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function Memories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Memory | null>(null);

  useEffect(() => {
    api.getMyMemories()
      .then((d) => setMemories(d.memories))
      .catch((e) => setError(e.message || 'Failed to load memories'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout title="My Memories" subtitle="Events you attended as a guest">
      {selected ? (
        <MemoryDetail memory={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          )}

          {!loading && error && (
            <div className="bg-error/10 border border-error/20 rounded-2xl p-6 text-center">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && memories.length === 0 && (
            <div className="bg-surface-container rounded-2xl p-12 text-center border border-outline-variant/30">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-on-surface mb-2">No memories yet</h2>
              <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
                When you join another event as a guest while logged in, your photos will appear here.
              </p>
            </div>
          )}

          {!loading && !error && memories.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {memories.map((m) => (
                <MemoryCard
                  key={m.guestSession.id}
                  memory={m}
                  onClick={() => setSelected(m)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
