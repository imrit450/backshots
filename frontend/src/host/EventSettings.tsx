import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';
import {
  ImagePlus,
  X,
  Loader,
  Check,
  Trash2,
  AlertTriangle,
  CalendarDays,
  Globe,
  Camera,
  Layers,
  ShieldCheck,
  Eye,
  Clock,
  HardDrive,
  Users,
  Power,
  Wand2,
} from 'lucide-react';
import { THEME_LIST } from '../config/themes';

export default function EventSettings() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [livestreamSaving, setLivestreamSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [iconUploading, setIconUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    location: '',
    startDatetime: '',
    timezone: 'UTC',
    revealDelayHours: 0,
    uploadCutoffHours: 24,
    maxPhotosPerGuest: 20,
    maxPhotosTotal: 500,
    maxStorageMb: 500,
    guestGalleryEnabled: true,
    moderationMode: 'AUTO' as 'AUTO' | 'APPROVE_FIRST',
    theme: 'classic',
    isActive: true,
    livestreamEnabled: true,
    enhancementEnabled: false,
  });

  useEffect(() => {
    if (!eventId) return;
    api
      .getEvent(eventId)
      .then((data) => {
        const startDt = data.event.startDatetime
          ? new Date(data.event.startDatetime).toISOString().slice(0, 16)
          : '';
        setForm({
          title: data.event.title,
          location: data.event.location || '',
          startDatetime: startDt,
          timezone: data.event.timezone || 'UTC',
          revealDelayHours: data.event.revealDelayHours,
          uploadCutoffHours: data.event.uploadCutoffHours ?? 24,
          maxPhotosPerGuest: data.event.maxPhotosPerGuest,
          maxPhotosTotal: data.event.maxPhotosTotal ?? 500,
          maxStorageMb: data.event.maxStorageMb ?? 500,
          guestGalleryEnabled: data.event.guestGalleryEnabled,
          moderationMode: data.event.moderationMode,
          theme: data.event.theme || 'classic',
          isActive: data.event.isActive,
          livestreamEnabled: data.event.livestreamEnabled ?? true,
          enhancementEnabled: data.event.enhancementEnabled ?? false,
        });
        setIconUrl(data.event.iconUrl || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !eventId) return;
    setIconUploading(true);
    try {
      const data = await api.uploadEventIcon(eventId, file);
      setIconUrl(data.event.iconUrl);
      setSuccess('Icon updated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload icon');
    } finally {
      setIconUploading(false);
      if (iconInputRef.current) iconInputRef.current.value = '';
    }
  };

  const handleRemoveIcon = async () => {
    if (!eventId) return;
    setIconUploading(true);
    try {
      await api.removeEventIcon(eventId);
      setIconUrl(null);
      setSuccess('Icon removed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove icon');
    } finally {
      setIconUploading(false);
    }
  };

  const handleLivestreamToggle = async () => {
    if (!eventId || livestreamSaving) return;
    const next = !form.livestreamEnabled;
    setForm((f) => ({ ...f, livestreamEnabled: next }));
    setLivestreamSaving(true);
    try {
      await api.updateEvent(eventId, { livestreamEnabled: next });
      setSuccess(`Livestream ${next ? 'enabled' : 'disabled'}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setForm((f) => ({ ...f, livestreamEnabled: !next }));
      setError(err.message || 'Failed to update livestream');
    } finally {
      setLivestreamSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.startDatetime) {
        payload.startDatetime = new Date(payload.startDatetime).toISOString();
      }
      await api.updateEvent(eventId!, payload);
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventId) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await api.deleteEvent(eventId);
      navigate('/host');
    } catch (err: any) {
      setError(err.message || 'Failed to delete event');
      setSaving(false);
    }
  };

  /* ── Shared input class ───────────────────────────── */
  const inputCls =
    'w-full bg-surface-container-highest border border-outline-variant/40 text-on-surface text-sm rounded-xl px-4 py-3 placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors';

  const labelCls = 'block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2';

  if (loading) {
    return (
      <Layout title="Event Settings" subtitle="SETTINGS" showBack backTo={`/host/events/${eventId}`}>
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Event Settings" subtitle="SETTINGS" showBack backTo={`/host/events/${eventId}`}>
      <div className="max-w-2xl mx-auto space-y-6 pb-16">

        {/* ── Inline banners ───────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 bg-error/10 border border-error/20 text-error px-5 py-4 rounded-xl text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 text-primary px-5 py-4 rounded-xl text-sm">
            <Check className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Section 1: Identity ──────────────────────── */}
          <div className="bg-surface-container-low rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">Identity</h2>
            </div>

            {/* Event Icon */}
            <div>
              <label className={labelCls}>Event Icon</label>
              <div className="flex items-center gap-5">
                {iconUrl ? (
                  <div className="relative flex-shrink-0">
                    <img
                      src={iconUrl}
                      alt="Event icon"
                      className="w-16 h-16 rounded-xl object-cover border border-outline-variant/40"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveIcon}
                      disabled={iconUploading}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-error rounded-full flex items-center justify-center shadow-md disabled:opacity-50"
                    >
                      {iconUploading ? (
                        <Loader className="w-3 h-3 text-white animate-spin" />
                      ) : (
                        <X className="w-3 h-3 text-white" />
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => iconInputRef.current?.click()}
                    disabled={iconUploading}
                    className="flex-shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-outline-variant/50 flex items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
                  >
                    {iconUploading ? (
                      <Loader className="w-6 h-6 text-primary animate-spin" />
                    ) : (
                      <ImagePlus className="w-6 h-6 text-on-surface-variant/40" />
                    )}
                  </button>
                )}
                <div className="space-y-1">
                  {iconUrl ? (
                    <button
                      type="button"
                      onClick={() => iconInputRef.current?.click()}
                      disabled={iconUploading}
                      className="text-sm font-semibold text-primary hover:text-primary-dim transition-colors disabled:opacity-50"
                    >
                      Change icon
                    </button>
                  ) : (
                    <p className="text-sm text-on-surface-variant">Upload an event icon</p>
                  )}
                  <p className="text-xs text-on-surface-variant/50">JPEG, PNG, or WebP. Max 5 MB.</p>
                </div>
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleIconUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className={labelCls}>Event Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputCls}
                placeholder="My Awesome Event"
                required
              />
            </div>

            {/* Location */}
            <div>
              <label className={labelCls}>
                Location <span className="normal-case font-normal opacity-50">(optional)</span>
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className={inputCls}
                placeholder="The Grand Ballroom, New York"
              />
            </div>

            {/* Date & Timezone row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3" />
                    Date & Time
                  </span>
                </label>
                <input
                  type="datetime-local"
                  value={form.startDatetime}
                  onChange={(e) => setForm({ ...form, startDatetime: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="w-3 h-3" />
                    Timezone
                  </span>
                </label>
                <input
                  type="text"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. UTC, America/New_York"
                />
              </div>
            </div>

            {/* Livestream toggle */}
            <div className="flex items-center justify-between bg-surface-container-highest rounded-xl px-5 py-4 border border-outline-variant/30">
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-on-surface">Livestream</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Allow anyone with the link to view the live media wall
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.livestreamEnabled}
                onClick={handleLivestreamToggle}
                disabled={livestreamSaving}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface-container-highest disabled:opacity-60 ${
                  form.livestreamEnabled ? 'bg-primary' : 'bg-outline-variant'
                }`}
              >
                {livestreamSaving ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Loader className="w-3 h-3 text-white animate-spin" />
                  </span>
                ) : (
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                      form.livestreamEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                )}
              </button>
            </div>

            {/* Event Active toggle */}
            <div className="flex items-center justify-between bg-surface-container-highest rounded-xl px-5 py-4 border border-outline-variant/30">
              <div className="flex items-start gap-3">
                <Power className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-on-surface">Event Active</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    When inactive, guests cannot join or upload
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface-container-highest ${
                  form.isActive ? 'bg-primary' : 'bg-outline-variant'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                    form.isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ── Section 2: Theme ─────────────────────────── */}
          <div className="bg-surface-container-low rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">Guest Theme</h2>
            </div>
            <p className="text-xs text-on-surface-variant -mt-2">
              Color theme shown to guests on the camera and gallery pages.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEME_LIST.map((t) => {
                const isSelected = form.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm({ ...form, theme: t.id })}
                    className={`relative rounded-xl p-3 text-left transition-all border-2 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                        : 'border-outline-variant/30 hover:border-outline-variant bg-surface-container-highest'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="flex gap-1 mb-2.5">
                      {t.swatchColors.map((c, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full border border-white/10 shadow-sm"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="text-xs font-semibold text-on-surface leading-tight">{t.name}</div>
                    <div className="text-[10px] text-on-surface-variant mt-0.5">{t.occasion}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Section 3: Photo Settings ────────────────── */}
          <div className="bg-surface-container-low rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">Photo Settings</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Reveal Delay */}
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Reveal Delay (hours)
                  </span>
                </label>
                <input
                  type="number"
                  value={form.revealDelayHours}
                  onChange={(e) => setForm({ ...form, revealDelayHours: parseInt(e.target.value) || 0 })}
                  className={inputCls}
                  min={0}
                  max={168}
                />
              </div>

              {/* Upload Cutoff */}
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Upload Cutoff (hours)
                  </span>
                </label>
                <input
                  type="number"
                  value={form.uploadCutoffHours}
                  onChange={(e) => setForm({ ...form, uploadCutoffHours: parseInt(e.target.value) || 0 })}
                  className={inputCls}
                  min={0}
                  max={720}
                  title="0 = no cutoff. Guests cannot upload after this many hours past event start."
                />
                <p className="text-[10px] text-on-surface-variant/50 mt-1.5">0 = no cutoff</p>
              </div>

              {/* Max Photos/Guest */}
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <Camera className="w-3 h-3" />
                    Max Photos / Guest
                  </span>
                </label>
                <input
                  type="number"
                  value={form.maxPhotosPerGuest}
                  onChange={(e) => setForm({ ...form, maxPhotosPerGuest: parseInt(e.target.value) || 1 })}
                  className={inputCls}
                  min={1}
                  max={100}
                />
              </div>

              {/* Max Total Photos */}
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    Max Total Photos
                  </span>
                </label>
                <input
                  type="number"
                  value={form.maxPhotosTotal}
                  onChange={(e) => setForm({ ...form, maxPhotosTotal: parseInt(e.target.value) || 10 })}
                  className={inputCls}
                  min={10}
                  max={10000}
                />
              </div>

              {/* Max Storage */}
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3" />
                    Max Storage (MB)
                  </span>
                </label>
                <input
                  type="number"
                  value={form.maxStorageMb}
                  onChange={(e) => setForm({ ...form, maxStorageMb: parseInt(e.target.value) || 50 })}
                  className={inputCls}
                  min={50}
                  max={10000}
                />
              </div>

              {/* Moderation */}
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3" />
                    Moderation
                  </span>
                </label>
                <select
                  value={form.moderationMode}
                  onChange={(e) => setForm({ ...form, moderationMode: e.target.value as any })}
                  className={inputCls}
                >
                  <option value="AUTO">Auto-approve</option>
                  <option value="APPROVE_FIRST">Approve first</option>
                </select>
              </div>
            </div>

            {/* Guest Gallery toggle */}
            <div className="flex items-center justify-between bg-surface-container-highest rounded-xl px-5 py-4 border border-outline-variant/30">
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-on-surface">Guest Gallery</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Allow guests to browse approved photos
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.guestGalleryEnabled}
                onClick={() => setForm({ ...form, guestGalleryEnabled: !form.guestGalleryEnabled })}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface-container-highest ${
                  form.guestGalleryEnabled ? 'bg-primary' : 'bg-outline-variant'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                    form.guestGalleryEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Enhancement toggle */}
            <div className="flex items-center justify-between bg-surface-container-highest rounded-xl px-5 py-4 border border-outline-variant/30">
              <div className="flex items-start gap-3">
                <Wand2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-on-surface">Photo &amp; Video Enhancement</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Automatically improve lighting, sharpness, and colour for uploads
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.enhancementEnabled}
                onClick={() => setForm({ ...form, enhancementEnabled: !form.enhancementEnabled })}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface-container-highest ${
                  form.enhancementEnabled ? 'bg-primary' : 'bg-outline-variant'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                    form.enhancementEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ── Save button ─────────────────────────────── */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 rounded-xl text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #c19cff, #9146ff)' }}
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </form>

        {/* ── Danger Zone ──────────────────────────────── */}
        <div className="bg-error/5 border border-error/20 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-error" />
            <h3 className="text-sm font-bold text-error uppercase tracking-wider">Danger Zone</h3>
          </div>
          <p className="text-xs text-on-surface-variant mb-5">
            Permanently delete this event and all associated photos, guest sessions, and exports. This action cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-error/10 text-error border border-error/20 hover:bg-error/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Event
          </button>
        </div>
      </div>

      {/* ── Delete confirmation modal ─────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Dark overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          />

          {/* Dialog */}
          <div className="relative bg-surface-container-low rounded-2xl p-8 w-full max-w-md shadow-2xl shadow-black/50">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-highest transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon */}
            <div className="w-12 h-12 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mb-5">
              <Trash2 className="w-5 h-5 text-error" />
            </div>

            <h3 className="text-xl font-headline font-bold text-on-surface mb-2">
              Delete Event?
            </h3>
            <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">
              This will permanently remove all photos, guest sessions, and exports for this event.
              <span className="font-semibold text-error"> This action cannot be undone.</span>
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-on-surface bg-surface-container-highest hover:bg-surface-bright transition-colors border border-outline-variant/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-error hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Forever
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
