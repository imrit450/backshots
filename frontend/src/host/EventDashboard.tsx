import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { api } from '../api/client';
import {
  Image,
  Users,
  Eye,
  EyeOff,
  Clock,
  CheckCircle,
  XCircle,
  QrCode,
  Settings,
  Shield,
  Download,
  Images,
  HardDrive,
} from 'lucide-react';

const POLL_INTERVAL = 10_000; // 10 seconds

export default function EventDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

  // Poll for new photos
  const pollStats = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await api.getEventStats(eventId);
      const newCount = data.stats.totalPhotos;
      const prevCount = lastPhotoCount.current;

      if (prevCount !== null && newCount > prevCount) {
        const diff = newCount - prevCount;
        addToast({
          type: 'photo',
          message: `${diff} new photo${diff > 1 ? 's' : ''} uploaded!`,
          duration: 6000,
          onClick: () => navigate(`/host/events/${eventId}/moderation`),
        });
      }

      lastPhotoCount.current = newCount;
      setStats(data.stats);
    } catch {
      // Silently fail polling
    }
  }, [eventId, addToast, navigate]);

  useEffect(() => {
    const interval = setInterval(pollStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollStats]);

  if (loading) {
    return (
      <Layout showBack backTo="/host">
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-pine-800 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!event) {
    return (
      <Layout showBack backTo="/host">
        <div className="text-center py-16 text-gray-500">Event not found</div>
      </Layout>
    );
  }

  const formatStorage = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const statCards = [
    {
      label: `Photos (max ${stats?.maxPhotosTotal || '—'})`,
      value: stats?.totalPhotos || 0,
      icon: Image,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: `Storage (max ${stats?.maxStorageMb || '—'} MB)`,
      value: formatStorage(stats?.storageUsedBytes || 0),
      icon: HardDrive,
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      label: 'Guests',
      value: stats?.guestCount || 0,
      icon: Users,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Approved',
      value: stats?.approvedPhotos || 0,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Pending',
      value: stats?.pendingPhotos || 0,
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50',
    },
    {
      label: 'Hidden',
      value: stats?.hiddenPhotos || 0,
      icon: EyeOff,
      color: 'text-gray-600 bg-gray-50',
    },
    {
      label: 'Rejected',
      value: stats?.rejectedPhotos || 0,
      icon: XCircle,
      color: 'text-red-600 bg-red-50',
    },
  ];

  return (
    <Layout title={event.title} showBack backTo="/host">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Link
          to={`/host/events/${eventId}/moderation`}
          className="card hover:shadow-md transition-shadow flex items-center gap-3 p-4"
        >
          <Shield className="w-8 h-8 text-pine-700" />
          <div>
            <div className="font-semibold text-sm text-gray-900">Moderate</div>
            <div className="text-xs text-gray-500">Review photos</div>
          </div>
        </Link>
        <Link
          to={`/host/events/${eventId}/gallery`}
          className="card hover:shadow-md transition-shadow flex items-center gap-3 p-4"
        >
          <Images className="w-8 h-8 text-green-500" />
          <div>
            <div className="font-semibold text-sm text-gray-900">Gallery</div>
            <div className="text-xs text-gray-500">View all</div>
          </div>
        </Link>
        <Link
          to={`/host/events/${eventId}/settings`}
          className="card hover:shadow-md transition-shadow flex items-center gap-3 p-4"
        >
          <Settings className="w-8 h-8 text-gray-500" />
          <div>
            <div className="font-semibold text-sm text-gray-900">Settings</div>
            <div className="text-xs text-gray-500">Configure</div>
          </div>
        </Link>
        <Link
          to={`/host/events/${eventId}/export`}
          className="card hover:shadow-md transition-shadow flex items-center gap-3 p-4"
        >
          <Download className="w-8 h-8 text-blue-500" />
          <div>
            <div className="font-semibold text-sm text-gray-900">Export</div>
            <div className="text-xs text-gray-500">Download ZIP</div>
          </div>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className={`inline-flex p-2 rounded-lg ${stat.color} mb-2`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* QR Code & Event Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code Card */}
        {qrData && (
          <div className="card text-center">
            {/* Event icon above QR */}
            {event.iconUrl && (
              <div className="mb-4">
                <img src={event.iconUrl} alt="" className="w-14 h-14 rounded-xl object-cover mx-auto border border-pine-50" />
              </div>
            )}
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5" />
              Share with Guests
            </h2>
            <div className="inline-block bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <img src={qrData.qrCode} alt="Event QR Code" className="w-56 h-56" />
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">Event Code</p>
              <code className="text-2xl font-mono font-bold text-pine-700 tracking-wider">
                {qrData.eventCode}
              </code>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">Share Link</p>
              <div className="flex items-center gap-2 justify-center">
                <code className="text-sm bg-gray-50 px-3 py-2 rounded-lg text-gray-700 break-all">
                  {qrData.eventUrl}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(qrData.eventUrl)}
                  className="btn-ghost text-sm flex-shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Info Card */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Event Details</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Status</dt>
              <dd>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    event.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {event.isActive ? 'Active' : 'Inactive'}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Date</dt>
              <dd className="text-sm font-medium">
                {new Date(event.startDatetime).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Reveal Delay</dt>
              <dd className="text-sm font-medium">
                {event.revealDelayHours === 0
                  ? 'Immediate'
                  : `${event.revealDelayHours} hour(s)`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Max Photos/Guest</dt>
              <dd className="text-sm font-medium">{event.maxPhotosPerGuest}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Moderation</dt>
              <dd className="text-sm font-medium">
                {event.moderationMode === 'AUTO' ? 'Auto-approve' : 'Approve first'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Guest Gallery</dt>
              <dd className="text-sm font-medium">
                {event.guestGalleryEnabled ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
          </dl>

          {/* Top Guests */}
          {stats?.topGuests && stats.topGuests.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Top Contributors</h3>
              <div className="space-y-2">
                {stats.topGuests.slice(0, 5).map((guest: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {guest.displayName || 'Anonymous'}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {guest.photoCount} photos
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
