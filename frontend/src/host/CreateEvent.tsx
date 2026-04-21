import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { ImagePlus, X, Check, Minus, Plus } from 'lucide-react';
import { THEME_LIST } from '../config/themes';
import { getPlan } from '../config/plans';

function getDefaultStartDatetimeLocal(): string {
  const now = new Date();
  const tzOffsetMinutes = now.getTimezoneOffset();
  const local = new Date(now.getTime() - tzOffsetMinutes * 60_000);
  return local.toISOString().slice(0, 16);
}

function StepperInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-bright hover:text-on-surface transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="w-20 bg-transparent border-0 border-b-2 border-outline-variant focus:outline-none focus:border-primary px-0 py-1.5 text-on-surface text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min={min}
        max={max}
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-bright hover:text-on-surface transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function CreateEvent() {
  const navigate = useNavigate();
  const { host, isAdmin, canCreateEvents, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const effectivePlan = getPlan(host?.plan || 'free');
  const canCreateByPlan = effectivePlan.maxEvents !== 0;
  const canCreate = isAdmin || canCreateEvents || canCreateByPlan;

  useEffect(() => {
    if (authLoading) return;
    if (!canCreate) {
      navigate('/host');
    }
  }, [canCreate, authLoading, navigate]);

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

  // Derive stepper ceilings from the user's plan.
  // -1 means "unlimited" on the plan; we represent it as a high UI ceiling.
  const planMaxPhotos  = effectivePlan.maxPhotosPerGuest === -1 ? 999 : effectivePlan.maxPhotosPerGuest;
  const planMaxStorage = effectivePlan.maxStorageMb      === -1 ? 102400 : effectivePlan.maxStorageMb;

  // Human-readable plan limit shown next to each field
  const photosLabel  = effectivePlan.maxPhotosPerGuest === -1 ? 'Unlimited' : `${planMaxPhotos} / plan`;
  const storageLabel = effectivePlan.maxStorageMb === -1
    ? 'Unlimited'
    : planMaxStorage >= 1024
      ? `${(planMaxStorage / 1024).toFixed(0)} GB / plan`
      : `${planMaxStorage} MB / plan`;

  const [formInitialized, setFormInitialized] = useState(false);
  const [form, setForm] = useState({
    title: '',
    location: '',
    startDatetime: getDefaultStartDatetimeLocal(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    revealDelayHours: 0,
    uploadCutoffHours: 24,
    maxPhotosPerGuest: planMaxPhotos,
    maxPhotosTotal: 500,
    maxStorageMb: planMaxStorage,
    guestGalleryEnabled: true,
    moderationMode: 'AUTO' as 'AUTO' | 'APPROVE_FIRST',
    theme: 'classic',
  });

  // Re-sync defaults once the real host plan loads (replaces optimistic 'free' defaults)
  useEffect(() => {
    if (!formInitialized && host) {
      setFormInitialized(true);
      const p = getPlan(host.plan);
      const maxPhotos  = p.maxPhotosPerGuest === -1 ? 999 : p.maxPhotosPerGuest;
      const maxStorage = p.maxStorageMb      === -1 ? 102400 : p.maxStorageMb;
      setForm((prev) => ({
        ...prev,
        maxPhotosPerGuest: maxPhotos,
        maxStorageMb: maxStorage,
      }));
    }
  }, [host, formInitialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.createEvent({
        ...form,
        startDatetime: new Date(form.startDatetime).toISOString(),
      });
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

  const inputClass =
    'w-full bg-transparent border-0 border-b-2 border-outline-variant focus:outline-none focus:border-primary px-0 py-3 text-on-surface placeholder-on-surface-variant text-sm transition-colors duration-200';

  return (
    <Layout title="Create Event" subtitle="NEW EVENT" showBack backTo="/host">
      <div className="max-w-2xl mx-auto">
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const target = e.target as HTMLElement;
              if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                e.preventDefault();
              }
            }
          }}
        >
          {error && (
            <div className="mb-6 flex items-center gap-3 bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          {/* ── Section 1: Event Identity ─────────────────── */}
          <div className="bg-surface-container-low rounded-xl p-6 mb-6">
            <h2 className="font-headline font-bold text-on-surface text-lg mb-6">Event Identity</h2>

            {/* Icon upload */}
            <input
              ref={iconInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleIconSelect}
              className="hidden"
            />

            {iconPreview ? (
              <div className="relative w-full flex flex-col items-center justify-center py-6 bg-surface-container rounded-xl border-2 border-primary/40 mb-6">
                <div className="relative">
                  <img
                    src={iconPreview}
                    alt="Event icon"
                    className="w-24 h-24 rounded-xl object-cover border border-outline-variant/40 shadow-lg"
                  />
                  <button
                    type="button"
                    onClick={clearIcon}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-error rounded-full flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <p className="text-on-surface-variant text-xs mt-3">Click the × to remove</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => iconInputRef.current?.click()}
                className="flex flex-col items-center justify-center py-8 w-full bg-surface-container rounded-xl border-2 border-dashed border-outline-variant/30 hover:border-primary/40 cursor-pointer mb-6 transition-colors duration-200 group"
              >
                <ImagePlus className="w-8 h-8 text-on-surface-variant group-hover:text-primary transition-colors mb-2" />
                <span className="text-sm font-medium text-on-surface-variant group-hover:text-primary transition-colors">
                  Upload Event Icon
                </span>
                <span className="text-xs text-on-surface-variant/60 mt-1">
                  Optional · JPEG, PNG, or WebP · Max 5MB
                </span>
              </button>
            )}

            {/* Event Title */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                Event Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                className={inputClass}
                placeholder="Sarah & Mike's Wedding"
                required
              />
            </div>

            {/* Location */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                Location <span className="normal-case font-normal opacity-50">(optional)</span>
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                className={inputClass}
                placeholder="The Grand Ballroom, New York"
              />
            </div>

            {/* Date & Timezone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                  Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={form.startDatetime}
                  onChange={(e) => setForm({ ...form, startDatetime: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ── Section 2: Theme ──────────────────────────── */}
          <div className="bg-surface-container-low rounded-xl p-6 mb-6">
            <h2 className="font-headline font-bold text-on-surface text-lg mb-1">Theme</h2>
            <p className="text-on-surface-variant text-sm mb-5">
              Choose a color theme for the guest experience.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {THEME_LIST.map((t) => {
                const selected = form.theme === t.id;
                const [c1, c2, c3] = t.swatchColors;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm({ ...form, theme: t.id })}
                    className={`relative bg-surface-container rounded-xl border-2 cursor-pointer overflow-hidden transition-all duration-200 text-left ${
                      selected
                        ? 'border-primary ring-1 ring-primary/20'
                        : 'border-transparent hover:border-primary/30'
                    }`}
                  >
                    {/* Real color preview using theme's actual swatch colors */}
                    <div
                      className="h-16 w-full"
                      style={{
                        background: `linear-gradient(135deg, ${c1} 0%, ${c2} 60%, ${c3}44 100%)`,
                      }}
                    />

                    {/* Selected checkmark */}
                    {selected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-md">
                        <Check className="w-3 h-3 text-on-primary" />
                      </div>
                    )}

                    <div className="p-3">
                      <div className="text-sm font-semibold text-on-surface leading-tight">{t.name}</div>
                      <div className="text-xs text-on-surface-variant mt-0.5">{t.occasion}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Section 3: Photo Settings ─────────────────── */}
          <div className="bg-surface-container-low rounded-xl p-6 mb-6">
            <h2 className="font-headline font-bold text-on-surface text-lg mb-6">Photo Settings</h2>

            <div className="space-y-5">
              {/* Reveal delay */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">timer</span>
                    <span className="text-sm font-semibold text-on-surface">Reveal Delay</span>
                  </div>
                  <p className="text-xs text-on-surface-variant pl-6">
                    Hours before photos are visible. 0 = immediate.
                  </p>
                </div>
                <StepperInput
                  value={form.revealDelayHours}
                  onChange={(v) => setForm({ ...form, revealDelayHours: v })}
                  min={0}
                  max={168}
                />
              </div>

              <div className="h-px bg-outline-variant/20" />

              {/* Upload cutoff */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">timer</span>
                    <span className="text-sm font-semibold text-on-surface">Upload Cutoff</span>
                  </div>
                  <p className="text-xs text-on-surface-variant pl-6">
                    Hours after event start before uploads close. 0 = no cutoff.
                  </p>
                </div>
                <StepperInput
                  value={form.uploadCutoffHours}
                  onChange={(v) => setForm({ ...form, uploadCutoffHours: v })}
                  min={0}
                  max={720}
                />
              </div>

              <div className="h-px bg-outline-variant/20" />

              {/* Max photos per guest */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                    <span className="text-sm font-semibold text-on-surface">Max Photos / Guest</span>
                  </div>
                  <p className="text-xs text-on-surface-variant pl-6">
                    Maximum uploads each guest can make.
                  </p>
                  <p className="text-xs text-primary/70 pl-6 mt-0.5">{photosLabel}</p>
                </div>
                <StepperInput
                  value={form.maxPhotosPerGuest}
                  onChange={(v) => setForm({ ...form, maxPhotosPerGuest: v })}
                  min={1}
                  max={planMaxPhotos}
                />
              </div>

              <div className="h-px bg-outline-variant/20" />

              {/* Max total photos */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">photo_library</span>
                    <span className="text-sm font-semibold text-on-surface">Max Total Photos</span>
                  </div>
                  <p className="text-xs text-on-surface-variant pl-6">
                    Total photos allowed across all guests.
                  </p>
                </div>
                <StepperInput
                  value={form.maxPhotosTotal}
                  onChange={(v) => setForm({ ...form, maxPhotosTotal: v })}
                  min={10}
                  max={10000}
                />
              </div>

              <div className="h-px bg-outline-variant/20" />

              {/* Max storage */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">storage</span>
                    <span className="text-sm font-semibold text-on-surface">Max Storage (MB)</span>
                  </div>
                  <p className="text-xs text-on-surface-variant pl-6">
                    Maximum disk space for this event.
                  </p>
                  <p className="text-xs text-primary/70 pl-6 mt-0.5">{storageLabel}</p>
                </div>
                <StepperInput
                  value={form.maxStorageMb}
                  onChange={(v) => setForm({ ...form, maxStorageMb: v })}
                  min={50}
                  max={planMaxStorage}
                />
              </div>

              <div className="h-px bg-outline-variant/20" />

              {/* Moderation mode */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
                  <span className="text-sm font-semibold text-on-surface">Moderation Mode</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      form.moderationMode === 'AUTO'
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant/30 hover:border-primary/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="moderation"
                      value="AUTO"
                      checked={form.moderationMode === 'AUTO'}
                      onChange={() => setForm({ ...form, moderationMode: 'AUTO' })}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <div className="text-sm font-semibold text-on-surface">Auto-approve</div>
                      <div className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                        Photos appear immediately (after reveal delay). You can still hide individual photos.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      form.moderationMode === 'APPROVE_FIRST'
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant/30 hover:border-primary/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="moderation"
                      value="APPROVE_FIRST"
                      checked={form.moderationMode === 'APPROVE_FIRST'}
                      onChange={() => setForm({ ...form, moderationMode: 'APPROVE_FIRST' })}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <div className="text-sm font-semibold text-on-surface">Approve first</div>
                      <div className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                        All photos need your approval before appearing in the gallery.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="h-px bg-outline-variant/20" />

              {/* Guest gallery toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">collections</span>
                    <span className="text-sm font-semibold text-on-surface">Guest Gallery</span>
                  </div>
                  <p className="text-xs text-on-surface-variant pl-6">
                    Allow guests to browse approved photos.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.guestGalleryEnabled}
                  onClick={() => setForm({ ...form, guestGalleryEnabled: !form.guestGalleryEnabled })}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                    form.guestGalleryEnabled ? 'bg-primary' : 'bg-surface-container-highest'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      form.guestGalleryEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-tr from-primary to-primary-dim text-on-primary font-bold text-base shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Creating Event…
              </span>
            ) : (
              'Create Event'
            )}
          </button>
        </form>
      </div>
    </Layout>
  );
}
