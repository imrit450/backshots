import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { ImagePlus, X, Loader, Check } from 'lucide-react';
import { THEME_LIST } from '../config/themes';

export default function EventSettings() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [iconUploading, setIconUploading] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '',
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

  if (loading) {
    return (
      <Layout title="Settings" showBack backTo={`/host/events/${eventId}`}>
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-pine-800 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Event Settings" showBack backTo={`/host/events/${eventId}`}>
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>}
          {success && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-xl text-sm">{success}</div>}

          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">General</h2>

            {/* Event Icon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Icon</label>
              <div className="flex items-center gap-4">
                {iconUrl ? (
                  <div className="relative">
                    <img
                      src={iconUrl}
                      alt="Event icon"
                      className="w-16 h-16 rounded-xl object-cover border border-pine-100"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveIcon}
                      disabled={iconUploading}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm disabled:opacity-50"
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
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-pine-200 flex items-center justify-center hover:border-gold-300 hover:bg-gold-50 transition-colors disabled:opacity-50"
                  >
                    {iconUploading ? (
                      <Loader className="w-6 h-6 text-pine-300 animate-spin" />
                    ) : (
                      <ImagePlus className="w-6 h-6 text-pine-300" />
                    )}
                  </button>
                )}
                <div className="text-sm text-gray-500">
                  {iconUrl ? (
                    <button
                      type="button"
                      onClick={() => iconInputRef.current?.click()}
                      disabled={iconUploading}
                      className="text-pine-700 font-medium hover:text-pine-800 disabled:opacity-50"
                    >
                      Change icon
                    </button>
                  ) : (
                    <p>Upload an icon for your event</p>
                  )}
                  <p className="text-xs text-gray-400">JPEG, PNG, or WebP. Max 5MB.</p>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Date & Time</label>
              <input
                type="datetime-local"
                value={form.startDatetime}
                onChange={(e) => setForm({ ...form, startDatetime: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <input
                type="text"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="input"
                placeholder="e.g. UTC, America/New_York"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 text-pine-700 rounded"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Event is active (guests can join and take photos)
              </label>
            </div>
          </div>

          {/* Theme Picker */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">Event Theme</h2>
            <p className="text-sm text-gray-500">Color theme for the guest experience.</p>
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
                        ? 'border-pine-700 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-pine-700 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="flex gap-1 mb-2">
                      {t.swatchColors.map((c, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full border border-gray-200"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="text-sm font-medium text-charcoal">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.occasion}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">Photo Settings</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reveal Delay (hours)
                </label>
                <input
                  type="number"
                  value={form.revealDelayHours}
                  onChange={(e) => setForm({ ...form, revealDelayHours: parseInt(e.target.value) || 0 })}
                  className="input"
                  min={0}
                  max={168}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Cutoff (hours after event)
                </label>
                <input
                  type="number"
                  value={form.uploadCutoffHours}
                  onChange={(e) => setForm({ ...form, uploadCutoffHours: parseInt(e.target.value) || 0 })}
                  className="input"
                  min={0}
                  max={720}
                  title="0 = no cutoff. Guests cannot upload after this many hours past event start."
                />
                <p className="text-xs text-gray-500 mt-0.5">0 = no cutoff</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Photos/Guest
                </label>
                <input
                  type="number"
                  value={form.maxPhotosPerGuest}
                  onChange={(e) => setForm({ ...form, maxPhotosPerGuest: parseInt(e.target.value) || 1 })}
                  className="input"
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Total Photos
                </label>
                <input
                  type="number"
                  value={form.maxPhotosTotal}
                  onChange={(e) => setForm({ ...form, maxPhotosTotal: parseInt(e.target.value) || 10 })}
                  className="input"
                  min={10}
                  max={10000}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Storage (MB)
                </label>
                <input
                  type="number"
                  value={form.maxStorageMb}
                  onChange={(e) => setForm({ ...form, maxStorageMb: parseInt(e.target.value) || 50 })}
                  className="input"
                  min={50}
                  max={10000}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Moderation</label>
              <select
                value={form.moderationMode}
                onChange={(e) => setForm({ ...form, moderationMode: e.target.value as any })}
                className="input"
              >
                <option value="AUTO">Auto-approve</option>
                <option value="APPROVE_FIRST">Approve first</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="galleryEnabled"
                checked={form.guestGalleryEnabled}
                onChange={(e) => setForm({ ...form, guestGalleryEnabled: e.target.checked })}
                className="w-4 h-4 text-pine-700 rounded"
              />
              <label htmlFor="galleryEnabled" className="text-sm text-gray-700">
                Enable guest gallery
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
