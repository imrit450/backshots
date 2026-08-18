import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { EVENT_THEMES } from '../config/themes';
import {
  Image,
  Users,
  HardDrive,
  Clock,
  CheckCircle,
  QrCode,
  Settings,
  Shield,
  Download,
  Images,
  Copy,
  Check,
  Trophy,
  Radio,
  CalendarDays,
  Timer,
  Camera,
  Eye,
  Share2,
  MapPin,
  X,
  Phone,
} from 'lucide-react';

// ── Share card generator ────────────────────────────────────────────
function drawSparkStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size;
  const sx = cx - s / 2;
  const sy = cy - s / 2;
  const pt = (x: number, y: number): [number, number] => [sx + (x / 200) * s, sy + (y / 200) * s];

  const grad = ctx.createLinearGradient(sx, sy, sx + s, sy + s);
  grad.addColorStop(0, '#FFD700');
  grad.addColorStop(0.5, '#FF819F');
  grad.addColorStop(1, '#C19CFF');

  ctx.beginPath();
  ctx.moveTo(...pt(100, 0));
  ctx.lineTo(...pt(130, 70));
  ctx.lineTo(...pt(200, 100));
  ctx.lineTo(...pt(130, 130));
  ctx.lineTo(...pt(100, 200));
  ctx.lineTo(...pt(70, 130));
  ctx.lineTo(...pt(0, 100));
  ctx.lineTo(...pt(70, 70));
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, (30 / 200) * s, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fill();

  const er = (4 / 200) * s;
  const eo = (10 / 200) * s;
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(cx - eo, cy, er, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + eo, cy, er, 0, Math.PI * 2); ctx.fill();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Parse the two dominant colors from a CSS linear-gradient string
function parseGradientColors(cssGradient: string): [string, string] {
  const matches = cssGradient.match(/#[0-9a-fA-F]{3,6}/g);
  if (matches && matches.length >= 2) return [matches[0], matches[matches.length - 1]];
  return ['#1a0e2e', '#0d0d1a'];
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateShareCard(event: any, qrData: any): Promise<string> {
  const W = 720, H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Theme colors ──────────────────────────────────────────────
  const theme = EVENT_THEMES[event.theme] || EVENT_THEMES.classic;
  const [bgFrom, bgTo] = parseGradientColors(theme.bgGradient);
  const accentColor = theme.accent;

  // Background using event theme
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, bgFrom);
  bg.addColorStop(1, bgTo);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow using theme accent
  const glowRgb = parseInt(accentColor.slice(1), 16);
  const glowR = (glowRgb >> 16) & 255;
  const glowG = (glowRgb >> 8) & 255;
  const glowB = glowRgb & 255;
  const glow = ctx.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, 400);
  glow.addColorStop(0, `rgba(${glowR},${glowG},${glowB},0.12)`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Branding top ──────────────────────────────────────────────
  drawSparkStar(ctx, W / 2, 96, 72);

  ctx.textAlign = 'center';
  ctx.font = 'bold 34px "Plus Jakarta Sans", system-ui, sans-serif';
  const lGrad = ctx.createLinearGradient(W / 2 - 70, 0, W / 2 + 70, 0);
  lGrad.addColorStop(0, '#FFD700');
  lGrad.addColorStop(0.5, '#FF819F');
  lGrad.addColorStop(1, '#C19CFF');
  ctx.fillStyle = lGrad;
  ctx.fillText('Lumora', W / 2, 174);

  // ── Thin separator ────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 198); ctx.lineTo(W - 80, 198); ctx.stroke();

  // ── Event title ───────────────────────────────────────────────
  ctx.font = 'bold 58px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const titleLines = wrapText(ctx, event.title || 'Event', W - 100);
  const titleLineH = 70;
  let cursorY = 272;
  for (const line of titleLines.slice(0, 3)) {
    ctx.fillText(line, W / 2, cursorY);
    cursorY += titleLineH;
  }

  // ── Date ──────────────────────────────────────────────────────
  const dateStr = new Date(event.startDatetime).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  ctx.font = '26px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.50)';
  ctx.fillText(dateStr, W / 2, cursorY + 8);
  cursorY += 8 + 32;

  // ── Location ──────────────────────────────────────────────────
  if (event.location) {
    ctx.font = '24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = accentColor + 'cc';
    ctx.fillText(`📍 ${event.location}`, W / 2, cursorY + 4);
    cursorY += 4 + 28;
  }

  // ── QR card ───────────────────────────────────────────────────
  const qrCardSize = 360;
  const qrCardX = (W - qrCardSize) / 2;
  const qrCardY = cursorY + 52;

  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 20);
  ctx.fill();

  const qrImg = new window.Image();
  await new Promise<void>((resolve) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => resolve();
    qrImg.src = qrData.qrCode;
  });
  const pad = 24;
  ctx.drawImage(qrImg, qrCardX + pad, qrCardY + pad, qrCardSize - pad * 2, qrCardSize - pad * 2);

  // ── "Scan to join" label above code ───────────────────────────
  const belowCardY = qrCardY + qrCardSize + 36;
  ctx.font = '18px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.fillText('SCAN TO JOIN', W / 2, belowCardY);

  // ── Event code ────────────────────────────────────────────────
  ctx.font = 'bold 52px "Plus Jakarta Sans", monospace, sans-serif';
  const codeGrad = ctx.createLinearGradient(W / 2 - 120, 0, W / 2 + 120, 0);
  codeGrad.addColorStop(0, accentColor);
  codeGrad.addColorStop(1, accentColor + 'cc');
  ctx.fillStyle = codeGrad;
  ctx.fillText(qrData.eventCode, W / 2, belowCardY + 58);

  // ── Bottom footer ─────────────────────────────────────────────
  const footerY = H - 80;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, footerY - 20); ctx.lineTo(W - 80, footerY - 20); ctx.stroke();

  drawSparkStar(ctx, W / 2 - 80, footerY + 8, 26);
  ctx.font = '19px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.textAlign = 'left';
  ctx.fillText('Capture every moment with Lumora', W / 2 - 58, footerY + 13);
  ctx.textAlign = 'center';

  return canvas.toDataURL('image/png');
}

const POLL_INTERVAL = 10_000;

export default function EventDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [showGuests, setShowGuests] = useState(false);
  const [guests, setGuests] = useState<any[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const lastPhotoCount = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      api.getEvent(eventId),
      api.getEventStats(eventId),
      api.getEventQR(eventId),
    ])
      .then(([eventData, statsData, qrResponse]) => {
        setEvent(eventData.event);
        setStats(statsData.stats);
        setQrData(qrResponse);
        lastPhotoCount.current = statsData.stats.totalPhotos;
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventId]);

  // Poll for updated stats (display only — moderation toasts are fired globally by Layout)
  const pollStats = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await api.getEventStats(eventId);
      lastPhotoCount.current = data.stats.totalPhotos;
      setStats(data.stats);
    } catch {
      // Silently fail polling
    }
  }, [eventId]);

  useEffect(() => {
    const interval = setInterval(pollStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollStats]);

  const handleCopy = () => {
    if (!qrData?.eventUrl) return;
    navigator.clipboard.writeText(qrData.eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareCard = async () => {
    if (!event || !qrData || generatingCard) return;
    setGeneratingCard(true);
    try {
      const dataUrl = await generateShareCard(event, qrData);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${event.title.replace(/\s+/g, '-').toLowerCase()}-invite.png`;
      a.click();
    } catch (err) {
      console.error('Failed to generate share card', err);
    } finally {
      setGeneratingCard(false);
    }
  };

  const formatStorage = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const storagePercent =
    stats && stats.maxStorageMb
      ? Math.min(100, Math.round(((stats.storageUsedBytes || 0) / (stats.maxStorageMb * 1024 * 1024)) * 100))
      : 0;

  if (loading) {
    return (
      <Layout showBack backTo="/host">
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!event) {
    return (
      <Layout showBack backTo="/host">
        <div className="text-center py-24 text-on-surface-variant">Event not found</div>
      </Layout>
    );
  }

  return (
    <Layout title={event.title} subtitle="EVENT DASHBOARD" showBack backTo="/host">

      {/* ── Top section: Event summary + QR ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* LEFT — Event summary card */}
        <div className="lg:col-span-2 bg-surface-container-low rounded-xl p-8 relative overflow-hidden">
          {/* Decorative glow blob */}
          <div
            className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #c19cff 0%, transparent 70%)' }}
          />

          {/* LIVE badge */}
          {event.isActive && (
            <div className="inline-flex items-center gap-2 bg-tertiary/10 text-tertiary border border-tertiary/30 px-3 py-1 rounded-full text-xs font-bold mb-5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary" />
              </span>
              LIVE NOW
            </div>
          )}

          {/* Event icon + title */}
          <div className="flex items-start gap-4 mb-8">
            {event.iconUrl && (
              <img
                src={event.iconUrl}
                alt=""
                className="w-14 h-14 rounded-xl object-cover border border-outline-variant/40 flex-shrink-0"
              />
            )}
            <h2 className="text-4xl font-headline font-extrabold text-on-surface leading-tight">
              {event.title}
            </h2>
          </div>

          {/* Quick action buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/host/events/${eventId}/gallery`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #c19cff, #9146ff)' }}
            >
              <Images className="w-4 h-4" />
              View Gallery
            </Link>
            <Link
              to={`/host/events/${eventId}/livestream`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-surface-container-highest text-on-surface hover:bg-surface-bright transition-colors"
            >
              <Radio className="w-4 h-4 text-secondary" />
              Livestream
            </Link>
            <Link
              to={`/host/events/${eventId}/moderation`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-surface-container-highest text-on-surface hover:bg-surface-bright transition-colors"
            >
              <Shield className="w-4 h-4" />
              Moderation
              {(stats?.pendingPhotos || 0) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-error text-white rounded-full text-[10px] font-bold leading-none">
                  {stats.pendingPhotos}
                </span>
              )}
            </Link>
            <Link
              to={`/host/events/${eventId}/settings`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-highest hover:text-on-surface transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <Link
              to={`/host/events/${eventId}/export`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-highest hover:text-on-surface transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </Link>
          </div>
        </div>

        {/* RIGHT — QR Code card */}
        <div className="bg-surface-container-low rounded-xl p-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-5">
            <QrCode className="w-4 h-4" />
            Share with Guests
          </div>

          {/* QR image */}
          {qrData && (
            <div className="bg-white p-4 rounded-xl shadow-lg shadow-black/30 mb-5">
              <img src={qrData.qrCode} alt="Event QR Code" className="w-44 h-44" />
            </div>
          )}

          {/* Event code */}
          {qrData && (
            <div className="mb-5">
              <p className="text-xs text-on-surface-variant mb-1 uppercase tracking-wider">Event Code</p>
              <code className="text-2xl font-mono font-black text-primary tracking-[0.2em]">
                {qrData.eventCode}
              </code>
            </div>
          )}

          {/* Share URL */}
          {qrData && (
            <div className="w-full bg-surface-container-highest px-4 py-2 rounded-lg flex items-center gap-3 border-b-2 border-outline-variant mb-4">
              <span className="text-xs text-on-surface-variant truncate flex-1 text-left font-mono">
                {qrData.eventUrl}
              </span>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-surface-bright transition-colors text-on-surface-variant hover:text-primary"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* Generate share card */}
          {qrData && (
            <button
              onClick={handleShareCard}
              disabled={generatingCard}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {generatingCard ? (
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              {generatingCard ? 'Generating…' : 'Download Invite Card'}
            </button>
          )}
        </div>
      </div>

      {/* ── Stats grid ───────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

        {/* Total Photos */}
        <div className="bg-surface-container-low rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Image className="w-4 h-4 text-primary" />
            </div>
            {(stats?.totalPhotos - (lastPhotoCount.current || stats?.totalPhotos) > 0) && (
              <span className="text-xs font-semibold text-secondary">
                +{stats.totalPhotos - (lastPhotoCount.current || stats.totalPhotos)} New
              </span>
            )}
          </div>
          <div className="text-5xl font-headline font-black text-on-surface leading-none mb-1">
            {stats?.totalPhotos || 0}
          </div>
          <div className="text-xs text-on-surface-variant">
            Total Photos
            {stats?.maxPhotosTotal && (
              <span className="ml-1 opacity-60">/ {stats.maxPhotosTotal}</span>
            )}
          </div>
        </div>

        {/* Storage */}
        <div className="bg-surface-container-low rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <HardDrive className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-semibold text-on-surface-variant">{storagePercent}%</span>
          </div>
          <div className="text-5xl font-headline font-black text-on-surface leading-none mb-1">
            {formatStorage(stats?.storageUsedBytes || 0)}
          </div>
          <div className="text-xs text-on-surface-variant mb-3">
            Storage Used
            {stats?.maxStorageMb && (
              <span className="ml-1 opacity-60">/ {stats.maxStorageMb} MB</span>
            )}
          </div>
          <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
        </div>

        {/* Total Guests */}
        <button
          onClick={async () => {
            setShowGuests(true);
            if (guests.length === 0) {
              setGuestsLoading(true);
              try {
                const data = await api.getEventGuests(eventId!);
                setGuests(data.guests);
              } catch { /* ignore */ }
              finally { setGuestsLoading(false); }
            }
          }}
          className="bg-surface-container-low rounded-xl p-6 text-left hover:bg-surface-container transition-colors group w-full"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-secondary/10">
              <Users className="w-4 h-4 text-secondary" />
            </div>
            <span className="text-xs text-secondary opacity-0 group-hover:opacity-100 transition-opacity font-medium">View all →</span>
          </div>
          <div className="text-5xl font-headline font-black text-on-surface leading-none mb-1">
            {stats?.guestCount || 0}
          </div>
          <div className="text-xs text-on-surface-variant">Total Guests</div>
        </button>

        {/* Guest list panel */}
        {showGuests && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowGuests(false)} />
            <div className="relative w-full max-w-md bg-surface h-full flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
                <div>
                  <h2 className="font-headline font-bold text-on-surface">Guests</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">{guests.length} joined</p>
                </div>
                <button onClick={() => setShowGuests(false)} className="p-2 rounded-lg hover:bg-surface-container transition-colors">
                  <X className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {guestsLoading ? (
                  <div className="flex justify-center py-16">
                    <div className="w-6 h-6 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
                  </div>
                ) : guests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
                    <Users className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">No guests yet</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-outline-variant/20">
                    {guests.map((g) => (
                      <li key={g.id} className="flex items-center gap-4 px-6 py-4">
                        <div className="w-9 h-9 rounded-full bg-secondary/15 text-secondary flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {g.displayName?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">{g.displayName || 'Anonymous'}</p>
                          {g.phoneNumber ? (
                            <a href={`tel:${g.phoneNumber}`} className="flex items-center gap-1 text-xs text-secondary hover:underline mt-0.5">
                              <Phone className="w-3 h-3" />{g.phoneNumber}
                            </a>
                          ) : (
                            <p className="text-xs text-on-surface-variant/50 mt-0.5">No phone</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-on-surface">{g.photoCount}</p>
                          <p className="text-xs text-on-surface-variant">photos</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Queue */}
        <div className="bg-surface-container-low rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-tertiary/10">
              <Clock className="w-4 h-4 text-tertiary" />
            </div>
          </div>
          <div className="flex items-end gap-3 mb-1">
            <div className="text-5xl font-headline font-black text-on-surface leading-none">
              {stats?.approvedPhotos || 0}
            </div>
            {(stats?.pendingPhotos || 0) > 0 && (
              <div className="mb-1 flex items-center gap-1">
                <span className="text-lg font-headline font-black text-error leading-none">
                  {stats.pendingPhotos}
                </span>
                <span className="text-xs text-error opacity-80">pending</span>
              </div>
            )}
          </div>
          <div className="text-xs text-on-surface-variant">
            Approved
            {(stats?.pendingPhotos || 0) === 0 && (
              <span className="ml-1.5 text-primary/60">all clear</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom section: Contributors + Event Info ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top Contributors */}
        <div className="lg:col-span-2 bg-surface-container-low rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-secondary" />
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Top Contributors</h3>
          </div>

          {stats?.topGuests && stats.topGuests.length > 0 ? (
            <div className="space-y-1">
              {stats.topGuests.slice(0, 8).map((guest: any, i: number) => {
                const maxCount = stats.topGuests[0]?.photoCount || 1;
                const barWidth = Math.round((guest.photoCount / maxCount) * 100);
                return (
                  <div
                    key={i}
                    className="group flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-surface-container-highest transition-colors cursor-default"
                  >
                    {/* Rank */}
                    <span className={`w-6 text-center text-xs font-black font-headline flex-shrink-0 ${
                      i === 0 ? 'text-secondary' : i === 1 ? 'text-on-surface-variant' : i === 2 ? 'text-tertiary/70' : 'text-on-surface-variant/40'
                    }`}>
                      {i + 1}
                    </span>

                    {/* Name + bar */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-on-surface truncate">
                          {guest.displayName || 'Anonymous'}
                        </span>
                        <span className="text-xs font-bold text-on-surface-variant ml-3 flex-shrink-0">
                          {guest.photoCount} <span className="font-normal opacity-60">photos</span>
                        </span>
                      </div>
                      <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${barWidth}%`,
                            background: i === 0
                              ? 'linear-gradient(90deg, #ff7441, #ff9a6c)'
                              : 'linear-gradient(90deg, #c19cff, #9146ff)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Camera className="w-10 h-10 text-on-surface-variant/20 mb-3" />
              <p className="text-sm text-on-surface-variant">No photos yet</p>
              <p className="text-xs text-on-surface-variant/50 mt-1">Contributors will appear here once guests start uploading</p>
            </div>
          )}
        </div>

        {/* Event Info */}
        <div className="bg-surface-container-low rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Radio className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Event Info</h3>
          </div>

          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">Status</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                event.isActive
                  ? 'bg-tertiary/10 text-tertiary'
                  : 'bg-surface-container-highest text-on-surface-variant'
              }`}>
                {event.isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                )}
                {event.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Location
                </span>
                <span className="text-xs font-medium text-on-surface text-right max-w-[55%]">
                  {event.location}
                </span>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Date
              </span>
              <span className="text-xs font-medium text-on-surface text-right max-w-[55%]">
                {new Date(event.startDatetime).toLocaleString()}
              </span>
            </div>

            {/* Reveal Delay */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5" />
                Reveal Delay
              </span>
              <span className="text-xs font-medium text-on-surface">
                {event.revealDelayHours === 0 ? 'Immediate' : `${event.revealDelayHours}h`}
              </span>
            </div>

            {/* Max Photos/Guest */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                Max / Guest
              </span>
              <span className="text-xs font-medium text-on-surface">{event.maxPhotosPerGuest}</span>
            </div>

            {/* Moderation */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Moderation
              </span>
              <span className="text-xs font-medium text-on-surface">
                {event.moderationMode === 'AUTO' ? 'Auto-approve' : 'Approve first'}
              </span>
            </div>

            {/* Guest Gallery */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Guest Gallery
              </span>
              <span className={`text-xs font-medium ${event.guestGalleryEnabled ? 'text-primary' : 'text-on-surface-variant'}`}>
                {event.guestGalleryEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* Divider */}
            <div className="h-px bg-outline-variant/30 my-2" />

            {/* Additional stats row */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center">
                <div className="text-xl font-headline font-black text-on-surface">{stats?.approvedPhotos || 0}</div>
                <div className="text-[10px] text-on-surface-variant mt-0.5">Approved</div>
              </div>
              <div className="text-center">
                <div className={`text-xl font-headline font-black ${(stats?.pendingPhotos || 0) > 0 ? 'text-error' : 'text-on-surface'}`}>
                  {stats?.pendingPhotos || 0}
                </div>
                <div className="text-[10px] text-on-surface-variant mt-0.5">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-headline font-black text-on-surface">{stats?.hiddenPhotos || 0}</div>
                <div className="text-[10px] text-on-surface-variant mt-0.5">Hidden</div>
              </div>
            </div>
          </div>

          {/* Settings shortcut */}
          <Link
            to={`/host/events/${eventId}/settings`}
            className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-highest hover:text-on-surface transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Edit Settings
          </Link>
        </div>
      </div>
    </Layout>
  );
}
