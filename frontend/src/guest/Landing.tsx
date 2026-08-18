import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { api } from '../api/client';
import { Camera, ArrowRight, Edit3 } from 'lucide-react';
import { LogoWordmark, LogoIcon } from '../components/Logo';
import { useDynamicManifest } from '../hooks/useDynamicManifest';

// Generate and persist a unique device ID for this browser
function getDeviceId(): string {
  const KEY = 'lumora_device_id';
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
  useDynamicManifest(`/e/${eventCode}`);
  const { isLoaded: clerkLoaded, isSignedIn, user } = useUser();
  const [event, setEvent] = useState<any>(null);

  // Pre-fill name from localStorage cache initially
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem('guestDisplayName') || ''
  );
  const [phoneNumber, setPhoneNumber] = useState(
    () => localStorage.getItem('guestPhoneNumber') || ''
  );

  // Once Clerk loads, override with the logged-in user's profile if available
  useEffect(() => {
    if (!clerkLoaded || !isSignedIn || !user) return;
    const name = user.fullName ?? user.firstName ?? user.emailAddresses[0]?.emailAddress ?? '';
    if (name) setDisplayName(name);
    const phone = user.phoneNumbers?.[0]?.phoneNumber ?? '';
    if (phone) setPhoneNumber(phone);
  }, [clerkLoaded, isSignedIn, user]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  // Returning-device detection
  const [existingSession, setExistingSession] = useState<any>(null);
  const [showEditName, setShowEditName] = useState(false);

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

  // ─── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ─── Error state (no event) ───────────────────────────────────
  if (error && !event) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        {/* Nav */}
        <nav className="px-6 py-4 flex justify-between items-center">
          <LogoWordmark iconSize={20} textSize="text-base" />
          <Link
            to="/host/login"
            className="bg-surface-container-highest text-on-surface-variant text-xs rounded-full px-3 py-1 hover:text-primary hover:bg-surface-container transition-colors"
          >
            Guest Mode
          </Link>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-on-surface-variant" />
          </div>
          <h1 className="font-headline font-extrabold text-2xl text-on-surface mb-2">
            Event Not Found
          </h1>
          <p className="text-on-surface-variant text-sm">{error}</p>
        </div>

        <LogoIcon size={14} className="mx-auto opacity-30" />
      </div>
    );
  }

  // ─── Returning device: existing session found ─────────────────
  if (existingSession && !showEditName) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        {/* Nav */}
        <nav className="px-6 py-5 flex justify-between items-center flex-shrink-0">
          <LogoWordmark iconSize={20} textSize="text-base" />
          <Link
            to="/host/login"
            className="bg-surface-container-highest text-on-surface-variant text-xs rounded-full px-3 py-1.5 hover:text-primary hover:bg-surface-container transition-colors"
          >
            Sign in
          </Link>
        </nav>

        {/* Hero */}
        <div className="flex flex-col items-center pt-4 pb-8 px-6 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 w-24 h-24 rounded-2xl overflow-hidden shadow-xl mb-4">
            {event?.iconUrl ? (
              <img src={event.iconUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="kinetic-gradient w-full h-full flex items-center justify-center">
                <Camera className="w-10 h-10 text-white/80" />
              </div>
            )}
          </div>

          <span className="relative z-10 bg-tertiary/10 text-tertiary border border-tertiary/30 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-widest mb-3">
            ● LIVE NOW
          </span>

          <h1 className="relative z-10 font-headline font-extrabold text-2xl text-center text-on-surface leading-tight">
            {event?.title}
          </h1>
        </div>

        {/* Welcome back card */}
        <div className="flex-1 px-6 pb-6">
          <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/20">
            <p className="text-on-surface-variant/60 text-xs font-bold tracking-widest uppercase mb-3">Welcome back</p>
            <p className="font-headline font-bold text-2xl text-on-surface mb-1">
              {existingSession.displayName}
            </p>
            {existingSession.phoneNumber && (
              <p className="text-on-surface-variant text-sm">{existingSession.phoneNumber}</p>
            )}
            <p className="text-on-surface-variant/40 text-xs mt-2">
              {existingSession.photoCount} photo{existingSession.photoCount !== 1 ? 's' : ''} taken at this event
            </p>

            {error && (
              <div className="mt-4 text-error text-sm bg-error/10 px-4 py-3 rounded-xl border border-error/20 text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleContinue}
              disabled={joining}
              className="group w-full mt-6 kinetic-gradient py-4 rounded-2xl text-on-primary font-headline font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_28px_rgba(145,70,255,0.4)]"
            >
              {joining ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Joining...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>

            <button
              onClick={() => setShowEditName(true)}
              disabled={joining}
              className="w-full mt-3 py-2 text-on-surface-variant/60 text-sm font-medium flex items-center justify-center gap-2 hover:text-on-surface transition-colors disabled:opacity-50"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Not you?
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pb-6 text-center space-y-1">
          <LogoIcon size={14} className="mx-auto opacity-30" />
          <p className="text-xs text-on-surface-variant/30">
            Have a host account?{' '}
            <Link to="/host/login" className="text-primary/70 hover:text-primary transition-colors">Sign in</Link>
            {' '}or{' '}
            <Link to="/host/signup" className="text-primary/70 hover:text-primary transition-colors">Register</Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── New device OR editing name ───────────────────────────────
  const isEditing = !!existingSession && showEditName;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-5 flex justify-between items-center flex-shrink-0">
        <span className="font-headline font-bold text-primary text-lg">Lumora</span>
        <Link
          to="/host/login"
          className="bg-surface-container-highest text-on-surface-variant text-xs rounded-full px-3 py-1.5 hover:text-primary hover:bg-surface-container transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <div className="flex flex-col items-center pt-4 pb-8 px-6 relative">
        {/* Ambient glow behind icon */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        {/* Event icon */}
        <div className="relative z-10 w-24 h-24 rounded-2xl overflow-hidden shadow-xl mb-4">
          {event?.iconUrl ? (
            <img src={event.iconUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="kinetic-gradient w-full h-full flex items-center justify-center">
              <Camera className="w-10 h-10 text-white/80" />
            </div>
          )}
        </div>

        {/* Live badge */}
        {event && (
          <span className="relative z-10 bg-tertiary/10 text-tertiary border border-tertiary/30 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-widest mb-3">
            ● LIVE NOW
          </span>
        )}

        {/* Event title */}
        <h1 className="relative z-10 font-headline font-extrabold text-2xl text-center text-on-surface leading-tight">
          {event?.title || 'Join Event'}
        </h1>
        <p className="relative z-10 text-on-surface-variant/50 text-sm mt-1">
          Snap and share your moments
        </p>
      </div>

      {/* Form card */}
      <div className="flex-1 px-6 pb-6">
        <div className="bg-surface-container-low rounded-3xl p-6 border border-outline-variant/20">
          {/* Name */}
          <div className="mb-7">
            <label className="block text-on-surface-variant/60 text-[10px] font-bold tracking-widest uppercase mb-2">
              Name <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Who are we seeing today?"
              required
              autoFocus
              className="w-full bg-transparent border-b border-outline-variant/60 focus:border-primary text-on-surface placeholder:text-on-surface-variant/25 px-0 py-2.5 text-base focus:outline-none transition-colors duration-200"
            />
          </div>

          {/* Phone */}
          <div className="mb-7">
            <label className="block text-on-surface-variant/60 text-[10px] font-bold tracking-widest uppercase mb-2">
              Phone <span className="text-on-surface-variant/30">optional</span>
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full bg-transparent border-b border-outline-variant/60 focus:border-primary text-on-surface placeholder:text-on-surface-variant/25 px-0 py-2.5 text-base focus:outline-none transition-colors duration-200"
            />
          </div>

          {error && (
            <div className="mb-5 text-error text-sm bg-error/10 px-4 py-3 rounded-xl border border-error/20 text-center">
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={isEditing ? handleUpdateAndJoin : handleJoinNew}
            disabled={joining || !displayName.trim()}
            className="group w-full kinetic-gradient py-4 rounded-2xl text-on-primary font-headline font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_28px_rgba(145,70,255,0.4)]"
          >
            {joining ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                {isEditing ? 'Updating...' : 'Joining...'}
              </>
            ) : (
              <>
                Open Camera
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>

          {isEditing && (
            <button
              onClick={() => setShowEditName(false)}
              className="w-full mt-3 py-2 text-on-surface-variant text-sm hover:text-on-surface transition-colors text-center"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 pb-6 text-center space-y-1">
        <LogoIcon size={14} className="mx-auto opacity-30" />
        <p className="text-xs text-on-surface-variant/30">
          Have a host account?{' '}
          <Link to="/host/login" className="text-primary/70 hover:text-primary transition-colors">Sign in</Link>
          {' '}or{' '}
          <Link to="/host/signup" className="text-primary/70 hover:text-primary transition-colors">Register</Link>
        </p>
      </div>
    </div>
  );
}
