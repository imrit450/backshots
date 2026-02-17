import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Camera, Sparkles, Phone, User, Edit3, ArrowRight } from 'lucide-react';
import Footer from '../components/Footer';
import { getTheme } from '../config/themes';

// Generate and persist a unique device ID for this browser
function getDeviceId(): string {
  const KEY = 'backshots_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export default function GuestLanding() {
  const { eventCode } = useParams<{ eventCode: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);

  // Pre-fill name from localStorage cache
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('guestDisplayName') || ''
  );
  const [phoneNumber, setPhoneNumber] = useState(
    () => localStorage.getItem('guestPhoneNumber') || ''
  );
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const theme = useMemo(() => getTheme(event?.theme), [event?.theme]);

  // Returning-device detection
  const [existingSession, setExistingSession] = useState<any>(null);
  const [showEditName, setShowEditName] = useState(false);
  const [checkingDevice, setCheckingDevice] = useState(true);

  const deviceId = getDeviceId();

  // Load event info + check if device already registered
  useEffect(() => {
    if (!eventCode) return;

    const loadEvent = api
      .getPublicEvent(eventCode)
      .then((data) => setEvent(data.event))
      .catch(() => setError('Event not found or no longer active'));

    const checkDevice = api
      .checkExistingSession(eventCode, deviceId)
      .then((data) => {
        if (data.existingSession) {
          setExistingSession(data.existingSession);
          // Pre-fill form with existing data
          setDisplayName(data.existingSession.displayName);
          if (data.existingSession.phoneNumber) {
            setPhoneNumber(data.existingSession.phoneNumber);
          }
        }
      })
      .catch(() => {
        // Silently fail — treat as new device
      });

    Promise.all([loadEvent, checkDevice]).finally(() => {
      setLoading(false);
      setCheckingDevice(false);
    });
  }, [eventCode, deviceId]);

  // Continue with existing session (no name change)
  const handleContinue = async () => {
    if (!eventCode || !existingSession) return;
    setJoining(true);
    setError('');
    try {
      const data = await api.createGuestSession(
        eventCode,
        existingSession.displayName,
        existingSession.phoneNumber || undefined,
        deviceId
      );
      sessionStorage.setItem('guestEvent', JSON.stringify(data.event));
      sessionStorage.setItem('guestSession', JSON.stringify(data.session));
      navigate(`/e/${eventCode}/camera`);
    } catch (err: any) {
      setError(err.message || 'Failed to rejoin event');
    } finally {
      setJoining(false);
    }
  };

  // Update name on existing session, then enter
  const handleUpdateAndJoin = async () => {
    if (!eventCode || !existingSession) return;
    if (!displayName.trim()) {
      setError('Please enter your name to continue');
      return;
    }
    setJoining(true);
    setError('');
    try {
      localStorage.setItem('guestDisplayName', displayName.trim());
      if (phoneNumber.trim()) {
        localStorage.setItem('guestPhoneNumber', phoneNumber.trim());
      }

      const data = await api.updateGuestSession(
        eventCode,
        existingSession.id,
        displayName.trim(),
        phoneNumber.trim() || undefined
      );
      sessionStorage.setItem('guestEvent', JSON.stringify(data.event));
      sessionStorage.setItem('guestSession', JSON.stringify(data.session));
      navigate(`/e/${eventCode}/camera`);
    } catch (err: any) {
      setError(err.message || 'Failed to update session');
    } finally {
      setJoining(false);
    }
  };

  // Create a brand-new session (first time for this device)
  const handleJoinNew = async () => {
    if (!eventCode) return;
    if (!displayName.trim()) {
      setError('Please enter your name to continue');
      return;
    }
    setJoining(true);
    setError('');
    try {
      localStorage.setItem('guestDisplayName', displayName.trim());
      if (phoneNumber.trim()) {
        localStorage.setItem('guestPhoneNumber', phoneNumber.trim());
      }

      const data = await api.createGuestSession(
        eventCode,
        displayName.trim(),
        phoneNumber.trim() || undefined,
        deviceId
      );
      sessionStorage.setItem('guestEvent', JSON.stringify(data.event));
      sessionStorage.setItem('guestSession', JSON.stringify(data.session));
      navigate(`/e/${eventCode}/camera`);
    } catch (err: any) {
      setError(err.message || 'Failed to join event');
    } finally {
      setJoining(false);
    }
  };

  // ─── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-pine-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold-300 border-t-transparent" />
      </div>
    );
  }

  // ─── Error state (no event) ─────────────────────────────────
  if (error && !event) {
    return (
      <div className="min-h-screen bg-pine-800 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-300 rounded-2xl mb-4">
            <Camera className="w-8 h-8 text-pine-800" />
          </div>
          <h1 className="font-display text-3xl text-white mb-2">Oops!</h1>
          <p className="text-white/60 font-sans text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // ─── Returning device: existing session found ───────────────
  if (existingSession && !showEditName) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: theme.bgGradient }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full blur-3xl" style={{ backgroundColor: theme.glow }} />
          <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full blur-3xl" style={{ backgroundColor: theme.glow }} />
        </div>

        <div className="relative z-10 w-full max-w-sm text-center">
          {event?.iconUrl ? (
            <div className="inline-flex items-center justify-center w-20 h-20 backdrop-blur-sm rounded-3xl mb-6 shadow-2xl overflow-hidden" style={{ backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}33`, borderWidth: 1 }}>
              <img src={event.iconUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 backdrop-blur-sm rounded-3xl mb-6 shadow-2xl" style={{ backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}33`, borderWidth: 1 }}>
              <Camera className="w-10 h-10" style={{ color: theme.accent }} />
            </div>
          )}

          <h1 className="font-display text-3xl mb-2" style={{ color: theme.textPrimary }}>{event?.title}</h1>

          <div className="bg-white/8 backdrop-blur-sm rounded-2xl p-5 mb-6 mt-6" style={{ borderColor: theme.inputBorder, borderWidth: 1 }}>
            <p className="text-sm mb-1 font-sans" style={{ color: theme.textSecondary }}>Welcome back!</p>
            <p className="font-display text-2xl" style={{ color: theme.textPrimary }}>{existingSession.displayName}</p>
            {existingSession.phoneNumber && (
              <p className="text-white/40 text-sm mt-1 font-sans">{existingSession.phoneNumber}</p>
            )}
            <p className="text-white/30 text-xs mt-2 font-sans">
              {existingSession.photoCount} photo{existingSession.photoCount !== 1 ? 's' : ''} taken
            </p>
          </div>

          {error && (
            <div className="mb-4 text-red-200 text-sm bg-red-500/20 px-4 py-2 rounded-xl font-sans">
              {error}
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={joining}
            className="w-full py-4 px-6 font-bold text-lg rounded-2xl shadow-2xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            style={{ backgroundColor: theme.buttonBg, color: theme.buttonText }}
          >
            {joining ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
                Joining...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <ArrowRight className="w-5 h-5" />
                Continue as {existingSession.displayName}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowEditName(true)}
            disabled={joining}
            className="w-full py-3 px-6 bg-white/8 text-white/70 font-medium text-sm rounded-2xl hover:bg-white/12 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
            style={{ borderColor: theme.inputBorder, borderWidth: 1 }}
          >
            <span className="flex items-center justify-center gap-2">
              <Edit3 className="w-4 h-4" />
              Change my name
            </span>
          </button>

          <p className="text-white/30 text-xs mt-6 font-sans">
            Scan. Capture. Celebrate.
          </p>
          <Footer className="mt-4" />
        </div>
      </div>
    );
  }

  // ─── New device OR editing name ─────────────────────────────
  const isEditing = !!existingSession && showEditName;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: theme.bgGradient }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full blur-3xl" style={{ backgroundColor: theme.glow }} />
        <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full blur-3xl" style={{ backgroundColor: theme.glow }} />
      </div>

      <div className="relative z-10 w-full max-w-sm text-center">
        {event?.iconUrl ? (
          <div className="inline-flex items-center justify-center w-20 h-20 backdrop-blur-sm rounded-3xl mb-6 shadow-2xl overflow-hidden" style={{ backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}33`, borderWidth: 1 }}>
            <img src={event.iconUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="inline-flex items-center justify-center w-20 h-20 backdrop-blur-sm rounded-3xl mb-6 shadow-2xl" style={{ backgroundColor: `${theme.accent}15`, borderColor: `${theme.accent}33`, borderWidth: 1 }}>
            <Camera className="w-10 h-10" style={{ color: theme.accent }} />
          </div>
        )}

        <h1 className="font-display text-3xl mb-2" style={{ color: theme.textPrimary }}>{event?.title}</h1>
        <p className="mb-8 flex items-center justify-center gap-1 font-sans text-sm" style={{ color: theme.textSecondary }}>
          <Sparkles className="w-4 h-4" />
          {isEditing ? 'Update your details' : 'Capture the moment'}
        </p>

        <div className="mb-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10" style={{ color: `${theme.accent}66` }} />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name *"
              required
              style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder }}
              className="appearance-none w-full pl-12 pr-5 py-4 rounded-2xl backdrop-blur-sm border
              text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20
              text-lg font-sans"
            />
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10" style={{ color: `${theme.accent}66` }} />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Phone number (optional)"
              style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder }}
              className="appearance-none w-full pl-12 pr-5 py-4 rounded-2xl backdrop-blur-sm border
              text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20
              text-lg font-sans"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 text-red-200 text-sm bg-red-500/20 px-4 py-2 rounded-xl font-sans">
            {error}
          </div>
        )}

        <button
          onClick={isEditing ? handleUpdateAndJoin : handleJoinNew}
          disabled={joining || !displayName.trim()}
          className="w-full py-4 px-6 font-bold text-lg rounded-2xl shadow-2xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: theme.buttonBg, color: theme.buttonText }}
        >
          {joining ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
              {isEditing ? 'Updating...' : 'Joining...'}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" />
              {isEditing ? 'Update & Open Camera' : 'Open Camera'}
            </span>
          )}
        </button>

        {isEditing && (
          <button
            onClick={() => setShowEditName(false)}
            className="w-full mt-3 py-3 text-white/40 text-sm hover:text-white/60 transition-colors font-sans"
          >
            Cancel
          </button>
        )}

        <p className="text-white/30 text-xs mt-6 font-sans">
          Scan. Capture. Celebrate.
        </p>
        <Footer className="mt-4" />
      </div>
    </div>
  );
}
