import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { ImagePlus, X, Check } from 'lucide-react';
import { THEME_LIST, getTheme } from '../config/themes';

export default function CreateEvent() {
  const navigate = useNavigate();
  const { canCreateEvents, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!canCreateEvents) {
      navigate('/host');
    }
  }, [canCreateEvents, authLoading, navigate]);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const clearIcon = () => {
    setIconFile(null);
    setIconPreview(null);
    if (iconInputRef.current) iconInputRef.current.value = '';
  };

  const [form, setForm] = useState({
    title: '',
    startDatetime: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    revealDelayHours: 0,
    uploadCutoffHours: 24,
    maxPhotosPerGuest: 20,
    maxPhotosTotal: 500,
    maxStorageMb: 500,
    guestGalleryEnabled: true,
    moderationMode: 'AUTO' as 'AUTO' | 'APPROVE_FIRST',
    theme: 'classic',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.createEvent({
        ...form,
        startDatetime: new Date(form.startDatetime).toISOString(),
      });
      // Upload icon if selected
      if (iconFile) {
        try {
          await api.uploadEventIcon(data.event.id, iconFile);
        } catch {
          // Non-blocking — event still created
        }
      }
      navigate(`/host/events/${data.event.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="New Event" showBack backTo="/host">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl text-charcoal mb-6">Create New Event</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}

          <div className="card space-y-4">
            <h2 className="font-display text-xl text-charcoal">Event Details</h2>

            {/* Event Icon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Icon</label>
              <div className="flex items-center gap-4">
                {iconPreview ? (
                  <div className="relative">
                    <img
                      src={iconPreview}
                      alt="Event icon"
                      className="w-16 h-16 rounded-xl object-cover border border-pine-100"
                    />
                    <button
                      type="button"
                      onClick={clearIcon}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => iconInputRef.current?.click()}
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-pine-200 flex items-center justify-center hover:border-gold-300 hover:bg-gold-50 transition-colors"
                  >
                    <ImagePlus className="w-6 h-6 text-pine-300" />
                  </button>
                )}
                <div className="text-sm text-gray-500">
                  <p>Optional. Square image works best.</p>
                  <p className="text-xs text-gray-400">JPEG, PNG, or WebP. Max 5MB.</p>
                </div>
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleIconSelect}
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
                placeholder="Sarah & Mike's Wedding"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={form.startDatetime}
                  onChange={(e) => setForm({ ...form, startDatetime: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Theme Picker */}
          <div className="card space-y-4">
            <h2 className="font-display text-xl text-charcoal">Event Theme</h2>
            <p className="text-sm text-gray-500">Choose a color theme for the guest experience.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEME_LIST.map((t) => {
                const selected = form.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm({ ...form, theme: t.id })}
                    className={`relative rounded-xl p-3 text-left transition-all border-2 ${
                      selected
                        ? 'border-pine-700 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {selected && (
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
            <h2 className="font-display text-xl text-charcoal">Photo Settings</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reveal Delay (hours)
                </label>
                <input
                  type="number"
                  value={form.revealDelayHours}
                  onChange={(e) =>
                    setForm({ ...form, revealDelayHours: parseInt(e.target.value) || 0 })
                  }
                  className="input"
                  min={0}
                  max={168}
                />
                <p className="text-xs text-gray-400 mt-1">
                  0 = photos visible immediately. Set delay for surprise reveal.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Cutoff (hours after event)
                </label>
                <input
                  type="number"
                  value={form.uploadCutoffHours}
                  onChange={(e) =>
                    setForm({ ...form, uploadCutoffHours: parseInt(e.target.value) || 0 })
                  }
                  className="input"
                  min={0}
                  max={720}
                />
                <p className="text-xs text-gray-400 mt-1">
                  0 = no cutoff. Guests cannot upload after this many hours past event start.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Photos Per Guest
                </label>
                <input
                  type="number"
                  value={form.maxPhotosPerGuest}
                  onChange={(e) =>
                    setForm({ ...form, maxPhotosPerGuest: parseInt(e.target.value) || 1 })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, maxPhotosTotal: parseInt(e.target.value) || 10 })
                  }
                  className="input"
                  min={10}
                  max={10000}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Total photos allowed across all guests.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Storage (MB)
                </label>
                <input
                  type="number"
                  value={form.maxStorageMb}
                  onChange={(e) =>
                    setForm({ ...form, maxStorageMb: parseInt(e.target.value) || 50 })
                  }
                  className="input"
                  min={50}
                  max={10000}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Maximum disk storage for this event.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Moderation Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    form.moderationMode === 'AUTO'
                      ? 'border-gold-300 bg-gold-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="moderation"
                    value="AUTO"
                    checked={form.moderationMode === 'AUTO'}
                    onChange={() => setForm({ ...form, moderationMode: 'AUTO' })}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Auto-approve</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Photos appear in gallery immediately (after reveal delay).
                      You can still hide individual photos.
                    </div>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    form.moderationMode === 'APPROVE_FIRST'
                      ? 'border-gold-300 bg-gold-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="moderation"
                    value="APPROVE_FIRST"
                    checked={form.moderationMode === 'APPROVE_FIRST'}
                    onChange={() => setForm({ ...form, moderationMode: 'APPROVE_FIRST' })}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Approve first</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      All photos need your approval before appearing in the gallery.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="galleryEnabled"
                checked={form.guestGalleryEnabled}
                onChange={(e) => setForm({ ...form, guestGalleryEnabled: e.target.checked })}
                className="w-4 h-4 text-pine-700 rounded accent-pine-700"
              />
              <label htmlFor="galleryEnabled" className="text-sm text-gray-700">
                Enable guest gallery (guests can see approved photos)
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate('/host')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
