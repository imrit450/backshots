import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { LogoWordmark } from '../components/Logo';

const POLL_MS = 6_000;
const CAROUSEL_INTERVAL_MS = 5_000;

type MediaItem = ({ _type: 'photo' } | { _type: 'video' }) & Record<string, any>;

function mergeMedia(photos: any[], videos: any[]): MediaItem[] {
  const p = photos.map((x) => ({ _type: 'photo' as const, ...x }));
  const v = videos.map((x) => ({ _type: 'video' as const, ...x }));
  return [...p, ...v].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
  );
}

// ---------------------------------------------------------------------------
// Blob-URL image cache — each photo URL is fetched exactly once per session
// and stored as a blob: URL so subsequent renders read from memory.
// ---------------------------------------------------------------------------
function useBlobCache() {
  // original URL → blob: URL
  const cache = useRef<Map<string, string>>(new Map());
  // URLs currently in flight
  const inflight = useRef<Set<string>>(new Set());
  // Trigger re-renders when new entries are ready
  const [, bump] = useState(0);

  const preload = useCallback((url: string) => {
    if (!url || cache.current.has(url) || inflight.current.has(url)) return;
    inflight.current.add(url);
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        cache.current.set(url, URL.createObjectURL(blob));
        inflight.current.delete(url);
        bump((n) => n + 1);
      })
      .catch(() => inflight.current.delete(url));
  }, []);

  const resolve = useCallback(
    (url: string) => cache.current.get(url) ?? url,
    []
  );

  // Revoke blob URLs on unmount to free memory
  useEffect(
    () => () => {
      cache.current.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
    },
    []
  );

  return { preload, resolve };
}

export default function Livestream() {
  const { eventId } = useParams<{ eventId: string }>();
  const { isAuthenticated } = useAuth();
  const { preload, resolve } = useBlobCache();

  const [event, setEvent] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [qrData, setQrData] = useState<any>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [sliding, setSliding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [livestreamDisabled, setLivestreamDisabled] = useState(false);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroIndexRef = useRef(0);

  // Preload all photo URLs whenever the items list grows
  useEffect(() => {
    items.forEach((item) => {
      if (item._type === 'photo' && item.largeUrl) preload(item.largeUrl);
    });
  }, [items, preload]);

  // Initial load
  useEffect(() => {
    if (!eventId) return;
    api.getStreamData(eventId)
      .then((data) => {
        setLivestreamDisabled(false);
        setEvent(data.event);
        setStats(data.stats);
        setQrData(data.qr);
        setItems(mergeMedia(data.photos || [], data.videos || []));
      })
      .catch((err: any) => {
        if (err?.message?.toLowerCase().includes('disabled')) {
          setLivestreamDisabled(true);
        }
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  // Keep heroIndexRef in sync so the poll closure always has the current value
  useEffect(() => {
    heroIndexRef.current = heroIndex;
  }, [heroIndex]);

  // Poll for new media + stats
  const poll = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await api.getStreamData(eventId);
      setLivestreamDisabled(false);
      setStats(data.stats);

      const incoming = mergeMedia(data.photos || [], data.videos || []);
      setItems((current) => {
        const currentIds = new Set(current.map((i) => i.id));
        const newItems = incoming.filter((i) => !currentIds.has(i.id));
        if (newItems.length === 0) return current;
        const insertAt = Math.min(heroIndexRef.current + 2, current.length);
        const updated = [...current];
        updated.splice(insertAt, 0, ...newItems);
        return updated;
      });
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('disabled')) {
        setLivestreamDisabled(true);
      }
    }
  }, [eventId]);

  useEffect(() => {
    const interval = setInterval(poll, POLL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  const goToIndex = useCallback((next: number) => {
    setHeroIndex((current) => {
      if (current === next) return current;
      setPrevIndex(current);
      setSliding(true);
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
      slideTimerRef.current = setTimeout(() => {
        setPrevIndex(null);
        setSliding(false);
      }, 600);
      return next;
    });
  }, []);

  // Auto-advance hero carousel
  useEffect(() => {
    if (items.length < 2) return;
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((i) => {
        const next = (i + 1) % items.length;
        setPrevIndex(i);
        setSliding(true);
        if (slideTimerRef.current) clearTimeout(slideTimerRef.current);
        slideTimerRef.current = setTimeout(() => {
          setPrevIndex(null);
          setSliding(false);
        }, 600);
        return next;
      });
    }, CAROUSEL_INTERVAL_MS);
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [items.length]);

  // Reset hero index if items array shrinks
  useEffect(() => {
    if (heroIndex >= items.length && items.length > 0) {
      setHeroIndex(0);
    }
  }, [items.length, heroIndex]);

  const n = items.length;
  const heroItem  = n > 0 ? items[heroIndex] : null;
  const leftItem  = n > 1 ? items[(heroIndex - 1 + n) % n] : null;
  const rightItem = n > 1 ? items[(heroIndex + 1) % n] : null;
  const prevItem  = prevIndex !== null ? (items[prevIndex] ?? null) : null;

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#c19cff] border-t-transparent" />
      </div>
    );
  }

  if (livestreamDisabled) {
    return (
      <div className="w-screen h-screen bg-[#0e0e0e] flex flex-col items-center justify-center gap-4">
        <span style={{ fontSize: 48, opacity: 0.25 }}>📡</span>
        <p style={{ color: '#adaaaa', fontSize: 15, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          Livestream is currently disabled
        </p>
        <p style={{ color: '#555', fontSize: 12 }}>The host has turned off the live feed for this event.</p>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden font-body"
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0e0e0e',
        color: '#ffffff',
      }}
    >
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(105%); }
          to   { transform: translateX(0); }
        }
        @keyframes slideOutLeft {
          from { transform: translateX(0); }
          to   { transform: translateX(-105%); }
        }
        @keyframes sideImageIn {
          from { opacity: 0; filter: blur(16px); }
          to   { opacity: 1; filter: blur(0px); }
        }
      `}</style>

      {/* ── Ambient blurred background from hero item ── */}
      {heroItem?._type === 'photo' && heroItem.largeUrl ? (
        <div
          className="absolute inset-0 z-0 transition-all duration-1000"
          style={{
            backgroundImage: `url(${resolve(heroItem.largeUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(64px) brightness(0.28) saturate(3)',
            transform: 'scale(1.1)',
          }}
        />
      ) : (
        <div
          className="absolute inset-0 z-0"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(145,70,255,0.12) 0%, transparent 70%)' }}
        />
      )}

      {/* ── Top nav ── */}
      <nav
        className="absolute top-0 left-0 w-full z-50 flex justify-between items-center px-10 py-5"
        style={{ backdropFilter: 'blur(16px)', background: 'rgba(14,14,14,0.5)' }}
      >
        <div className="flex items-center gap-4">
          <LogoWordmark iconSize={24} textSize="text-xl" />
          <div style={{ width: 1, height: 24, background: 'rgba(72,72,71,0.5)' }} />
          <div className="flex flex-col">
            <span
              className="uppercase tracking-widest font-bold"
              style={{ fontSize: 9, color: '#adaaaa', fontFamily: 'Inter, sans-serif' }}
            >
              Live Event Feed
            </span>
            <span
              className="font-bold flex items-center gap-1.5"
              style={{ fontSize: 11, color: '#ff7441', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              <span
                className="rounded-full animate-pulse"
                style={{ width: 6, height: 6, background: '#ff7441', display: 'inline-block' }}
              />
              {event?.title?.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span
                className="font-black"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#c19cff', fontSize: 22 }}
              >
                {(stats?.totalPhotos ?? 0).toLocaleString()}
              </span>
              <span className="uppercase tracking-widest font-bold" style={{ fontSize: 9, color: '#adaaaa' }}>
                Photos
              </span>
            </div>
            <div style={{ width: 1, height: 28, background: 'rgba(72,72,71,0.4)' }} />
            <div className="flex flex-col items-end">
              <span
                className="font-black"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#ff819f', fontSize: 22 }}
              >
                {items.filter((i) => i._type === 'video').length}
              </span>
              <span className="uppercase tracking-widest font-bold" style={{ fontSize: 9, color: '#adaaaa' }}>
                Videos
              </span>
            </div>
          </div>

          {/* Back to dashboard — only for logged-in hosts */}
          {isAuthenticated && (
            <Link
              to={`/host/events/${eventId}`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-colors"
              style={{
                fontSize: 12,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 700,
                background: 'rgba(38,38,38,0.7)',
                color: '#adaaaa',
                border: '1px solid rgba(72,72,71,0.4)',
                backdropFilter: 'blur(8px)',
                textDecoration: 'none',
              }}
            >
              ← Dashboard
            </Link>
          )}
        </div>
      </nav>

      {/* ── Main canvas — portrait triptych ── */}
      <main
        className="absolute inset-0 flex items-center justify-center z-10"
        style={{ paddingTop: 92, paddingLeft: 32, paddingRight: 32, paddingBottom: 72 }}
      >
        <div className="relative flex items-center justify-center gap-5 w-full h-full">

          {/* ── Left (previous) portrait — dimmed ── */}
          <div
            className="relative flex-shrink-0 rounded-2xl overflow-hidden"
            style={{
              height: '100%',
              aspectRatio: '3/4',
              opacity: leftItem ? 0.38 : 0,
              transform: 'scale(0.9)',
              border: '1px solid rgba(72,72,71,0.2)',
              transition: 'opacity 0.6s ease',
            }}
          >
            {leftItem && (
              leftItem._type === 'video' ? (
                <video key={leftItem.id} src={leftItem.url}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ animation: 'sideImageIn 0.7s cubic-bezier(0.4,0,0.2,1) forwards' }}
                  autoPlay loop muted playsInline preload="auto" />
              ) : (
                <img key={leftItem.id} src={resolve(leftItem.largeUrl)} alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ animation: 'sideImageIn 0.7s cubic-bezier(0.4,0,0.2,1) forwards' }} />
              )
            )}
          </div>

          {/* ── Center (hero) portrait ── */}
          <div
            className="relative flex-shrink-0 rounded-3xl overflow-hidden z-20"
            style={{
              height: '100%',
              aspectRatio: '3/4',
              border: '1px solid rgba(193,156,255,0.25)',
              boxShadow: '0 0 40px 6px rgba(145,70,255,0.18)',
            }}
          >
            {heroItem ? (
              <>
                {/* Blurred fill background */}
                {heroItem._type === 'photo' ? (
                  <img
                    src={resolve(heroItem.largeUrl)} alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: 'blur(20px) brightness(0.5)', transform: 'scale(1.1)' }}
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: 'rgba(20,10,36,0.9)' }} />
                )}

                {/* Outgoing item */}
                {prevItem && sliding && (
                  prevItem._type === 'video' ? (
                    <video
                      key={`prev-${prevItem.id}`}
                      src={prevItem.url}
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ animation: 'slideOutLeft 0.6s cubic-bezier(0.4,0,0.2,1) forwards', zIndex: 2 }}
                      autoPlay loop muted playsInline preload="auto"
                    />
                  ) : (
                    <img
                      key={`prev-${prevItem.id}`}
                      src={resolve(prevItem.largeUrl)} alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ animation: 'slideOutLeft 0.6s cubic-bezier(0.4,0,0.2,1) forwards', zIndex: 2 }}
                    />
                  )
                )}

                {/* Incoming item */}
                {heroItem._type === 'video' ? (
                  <video
                    key={heroItem.id}
                    src={heroItem.url}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      animation: sliding ? 'slideInRight 0.6s cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
                      zIndex: 3,
                    }}
                    autoPlay loop muted playsInline preload="auto"
                  />
                ) : (
                  <img
                    key={heroItem.id}
                    src={resolve(heroItem.largeUrl)} alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      animation: sliding ? 'slideInRight 0.6s cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
                      zIndex: 3,
                    }}
                  />
                )}

                {/* Video badge */}
                {heroItem._type === 'video' && (
                  <div
                    className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full"
                    style={{ background: 'rgba(255,129,159,0.85)', backdropFilter: 'blur(8px)' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.05em' }}>
                      VIDEO · {heroItem.durationSec}s
                    </span>
                  </div>
                )}

                {/* Corner accents */}
                <div className="absolute top-0 left-0 pointer-events-none z-10"
                  style={{ width: 48, height: 48, borderTop: '2px solid rgba(193,156,255,0.6)', borderLeft: '2px solid rgba(193,156,255,0.6)' }} />
                <div className="absolute bottom-0 right-0 pointer-events-none z-10"
                  style={{ width: 48, height: 48, borderBottom: '2px solid rgba(255,116,65,0.5)', borderRight: '2px solid rgba(255,116,65,0.5)' }} />

                {/* Info overlay */}
                <div
                  className="absolute bottom-0 left-0 right-0 px-5 py-4 z-10"
                  style={{
                    backdropFilter: 'blur(16px)',
                    background: 'rgba(14,14,14,0.65)',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-white leading-tight"
                        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                        {heroItem.guestName || 'Guest'}
                      </p>
                      <p style={{ fontSize: 10, color: '#adaaaa' }}>
                        {heroItem._type === 'video' ? 'Video Clip' : 'Featured Moment'}
                        {heroItem.capturedAt ? ` · ${new Date(heroItem.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                    </div>
                    {/* Dots */}
                    {items.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        {items.slice(0, 9).map((item, i) => (
                          <button key={i} onClick={() => goToIndex(i)}
                            style={{
                              width: i === heroIndex ? 14 : 5, height: 5, borderRadius: 3, padding: 0, border: 'none', cursor: 'pointer',
                              background: i === heroIndex
                                ? (item._type === 'video' ? '#ff819f' : '#c19cff')
                                : 'rgba(255,255,255,0.2)',
                              transition: 'all 0.3s',
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3"
                style={{ background: 'rgba(19,19,19,0.85)' }}>
                <span style={{ fontSize: 40, opacity: 0.2 }}>📷</span>
                <p style={{ color: '#adaaaa', fontSize: 13 }}>Waiting for approved media...</p>
              </div>
            )}
          </div>

          {/* ── Right (next) portrait — dimmed ── */}
          <div
            className="relative flex-shrink-0 rounded-2xl overflow-hidden"
            style={{
              height: '100%',
              aspectRatio: '3/4',
              opacity: rightItem ? 0.38 : 0,
              transform: 'scale(0.9)',
              border: '1px solid rgba(72,72,71,0.2)',
              transition: 'opacity 0.6s ease',
            }}
          >
            {rightItem && (
              rightItem._type === 'video' ? (
                <video key={rightItem.id} src={rightItem.url}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ animation: 'sideImageIn 0.7s cubic-bezier(0.4,0,0.2,1) forwards' }}
                  autoPlay loop muted playsInline preload="auto" />
              ) : (
                <img key={rightItem.id} src={resolve(rightItem.largeUrl)} alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ animation: 'sideImageIn 0.7s cubic-bezier(0.4,0,0.2,1) forwards' }} />
              )
            )}
          </div>
        </div>
      </main>

      {/* ── QR code — bottom right ── */}
      {qrData && (
        <div className="absolute bottom-8 right-8 z-50 flex flex-col items-center gap-3">
          <div
            className="p-3 rounded-2xl"
            style={{
              background: '#ffffff',
              boxShadow: '0 0 20px 2px rgba(193,156,255,0.2)',
            }}
          >
            <img src={qrData.qrCode} alt="Scan to join" style={{ width: 96, height: 96, display: 'block' }} />
          </div>
          <div className="text-center">
            <p
              className="font-black uppercase tracking-widest"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: '#c19cff' }}
            >
              Scan to Join
            </p>
            <p style={{ fontSize: 9, color: '#adaaaa', marginTop: 2 }}>&amp; Upload Live</p>
          </div>
        </div>
      )}

      {/* ── Live indicator — bottom left ── */}
      <div
        className="absolute bottom-8 left-8 z-50 flex items-center gap-3 px-5 py-2.5 rounded-full"
        style={{
          backdropFilter: 'blur(16px)',
          background: 'rgba(38,38,38,0.6)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <span
          className="rounded-full"
          style={{
            width: 8,
            height: 8,
            background: '#ff7441',
            boxShadow: '0 0 10px #ff7441',
            display: 'inline-block',
          }}
        />
        <span
          className="font-bold uppercase tracking-widest"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, color: '#ffffff' }}
        >
          Live Feed
        </span>
        <span style={{ width: 1, height: 14, background: 'rgba(72,72,71,0.4)', display: 'inline-block' }} />
        <span style={{ fontSize: 10, color: '#adaaaa' }}>
          Auto-syncing every {POLL_MS / 1000}s
        </span>
      </div>
    </div>
  );
}
