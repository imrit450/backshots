import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { LogoWordmark } from '../components/Logo';

const PHOTO_POLL_MS = 6_000;
const CAROUSEL_INTERVAL_MS = 5_000;

export default function Livestream() {
  const { eventId } = useParams<{ eventId: string }>();

  const [event, setEvent] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [qrData, setQrData] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [sliding, setSliding] = useState(false);
  const [loading, setLoading] = useState(true);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so the poll callback can read the current hero index without a stale closure
  const heroIndexRef = useRef(0);

  // Initial load
  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      api.getEvent(eventId),
      api.getEventStats(eventId),
      api.getEventQR(eventId),
      api.getPhotos(eventId, { status: 'APPROVED', limit: '20' }),
    ])
      .then(([eventData, statsData, qrRes, photosData]) => {
        setEvent(eventData.event);
        setStats(statsData.stats);
        setQrData(qrRes);
        setPhotos(photosData.photos || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventId]);

  // Keep heroIndexRef in sync so the poll closure always has the current value
  useEffect(() => {
    heroIndexRef.current = heroIndex;
  }, [heroIndex]);

  // Poll for new photos + stats
  const poll = useCallback(async () => {
    if (!eventId) return;
    try {
      const [statsData, photosData] = await Promise.all([
        api.getEventStats(eventId),
        api.getPhotos(eventId, { status: 'APPROVED', limit: '20' }),
      ]);
      setStats(statsData.stats);

      const incoming: any[] = photosData.photos || [];
      setPhotos((current) => {
        const currentIds = new Set(current.map((p) => p.id));
        const newPhotos = incoming.filter((p) => !currentIds.has(p.id));
        if (newPhotos.length === 0) return current;

        // Slot new photos in right after the "next" photo so they appear
        // 2nd in the upcoming queue — not at the far end of the rotation.
        const insertAt = Math.min(heroIndexRef.current + 2, current.length);
        const updated = [...current];
        updated.splice(insertAt, 0, ...newPhotos);
        return updated;
      });
    } catch {
      // silent
    }
  }, [eventId]);

  useEffect(() => {
    const interval = setInterval(poll, PHOTO_POLL_MS);
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
    if (photos.length < 2) return;
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((i) => {
        const next = (i + 1) % photos.length;
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
  }, [photos.length]);

  // Reset hero index if photos array shrinks
  useEffect(() => {
    if (heroIndex >= photos.length && photos.length > 0) {
      setHeroIndex(0);
    }
  }, [photos.length, heroIndex]);

  const n = photos.length;
  const heroPhoto   = n > 0 ? photos[heroIndex] : null;
  const leftPhoto   = n > 1 ? photos[(heroIndex - 1 + n) % n] : null;
  const rightPhoto  = n > 1 ? photos[(heroIndex + 1) % n] : null;
  const prevPhoto   = prevIndex !== null ? (photos[prevIndex] ?? null) : null;
  // suppress unused warning — kept for ambient bg
  void useMemo(() => photos.filter((p) => !p.hidden), [photos]);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#c19cff] border-t-transparent" />
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
      {/* ── Ambient blurred background from hero photo ── */}
      {heroPhoto?.largeUrl ? (
        <div
          className="absolute inset-0 z-0 transition-all duration-1000"
          style={{
            backgroundImage: `url(${heroPhoto.largeUrl})`,
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
          <div className="flex flex-col items-end">
            <span
              className="font-black"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#c19cff', fontSize: 22 }}
            >
              {(stats?.totalPhotos ?? 0).toLocaleString()}
            </span>
            <span
              className="uppercase tracking-widest font-bold"
              style={{ fontSize: 9, color: '#adaaaa' }}
            >
              Photos Captured
            </span>
          </div>

          {/* Back to dashboard */}
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
              opacity: leftPhoto ? 0.38 : 0,
              transform: 'scale(0.9)',
              border: '1px solid rgba(72,72,71,0.2)',
              transition: 'opacity 0.6s ease',
            }}
          >
            {leftPhoto && (
              <img key={leftPhoto.id} src={leftPhoto.largeUrl} alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ animation: 'sideImageIn 0.7s cubic-bezier(0.4,0,0.2,1) forwards' }} />
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
            {heroPhoto ? (
              <>
                {/* Blurred fill for any aspect mismatch */}
                <img
                  src={heroPhoto.largeUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: 'blur(20px) brightness(0.5)', transform: 'scale(1.1)' }}
                />

                {/* Outgoing photo */}
                {prevPhoto && sliding && (
                  <img
                    key={`prev-${prevPhoto.id}`}
                    src={prevPhoto.largeUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ animation: 'slideOutLeft 0.6s cubic-bezier(0.4,0,0.2,1) forwards', zIndex: 2 }}
                  />
                )}

                {/* Incoming photo */}
                <img
                  key={heroPhoto.id}
                  src={heroPhoto.largeUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    animation: sliding ? 'slideInRight 0.6s cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
                    zIndex: 3,
                  }}
                />

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
                        {heroPhoto.guestName || 'Guest'}
                      </p>
                      <p style={{ fontSize: 10, color: '#adaaaa' }}>
                        Featured Moment
                        {heroPhoto.capturedAt ? ` · ${new Date(heroPhoto.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                    </div>
                    {/* Dots */}
                    {photos.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        {photos.slice(0, 9).map((_, i) => (
                          <button key={i} onClick={() => goToIndex(i)}
                            style={{
                              width: i === heroIndex ? 14 : 5, height: 5, borderRadius: 3, padding: 0, border: 'none', cursor: 'pointer',
                              background: i === heroIndex ? '#c19cff' : 'rgba(255,255,255,0.2)',
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
                <p style={{ color: '#adaaaa', fontSize: 13 }}>Waiting for approved photos...</p>
              </div>
            )}
          </div>

          {/* ── Right (next) portrait — dimmed ── */}
          <div
            className="relative flex-shrink-0 rounded-2xl overflow-hidden"
            style={{
              height: '100%',
              aspectRatio: '3/4',
              opacity: rightPhoto ? 0.38 : 0,
              transform: 'scale(0.9)',
              border: '1px solid rgba(72,72,71,0.2)',
              transition: 'opacity 0.6s ease',
            }}
          >
            {rightPhoto && (
              <img key={rightPhoto.id} src={rightPhoto.largeUrl} alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ animation: 'sideImageIn 0.7s cubic-bezier(0.4,0,0.2,1) forwards' }} />
            )}
          </div>
        </div>
      </main>

      {/* ── QR code — bottom right ── */}
      {qrData && (
        <div
          className="absolute bottom-8 right-8 z-50 flex flex-col items-center gap-3"
        >
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
          Auto-syncing every {PHOTO_POLL_MS / 1000}s
        </span>
      </div>
    </div>
  );
}
