import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import {
  Users,
  Calendar,
  Image,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  Trash2,
  BarChart3,
  ChevronRight,
  Crown,
  Search,
  X,
  HelpCircle,
  HardDrive,
  Camera,
} from 'lucide-react';
import { PLANS } from '../config/plans';

export default function Admin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'users' | 'events' | 'storage'>('users');
  const [hosts, setHosts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Storage (config + browser)
  const [storageHealth, setStorageHealth] = useState<any>(null);
  const [storagePrefix, setStoragePrefix] = useState('hosts/');
  const [storageObjects, setStorageObjects] = useState<any[]>([]);
  const [storageCursor, setStorageCursor] = useState<string | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageConfigInitLoading, setStorageConfigInitLoading] = useState(true);
  const [storageConfigActionLoading, setStorageConfigActionLoading] = useState(false);
  const [storageConfigSaved, setStorageConfigSaved] = useState<string>('');
  const [storageConfigError, setStorageConfigError] = useState<string>('');

  const [storageType, setStorageType] = useState<'filesystem' | 's3'>('s3');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('us-east-1');
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3AccessKeyId, setS3AccessKeyId] = useState('');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState('');
  const [s3PublicUrl, setS3PublicUrl] = useState('');
  const [s3ForcePathStyle, setS3ForcePathStyle] = useState(false);
  const [showStorageHelp, setShowStorageHelp] = useState(false);

  // Search & filter state
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('all');
  const [eventSearch, setEventSearch] = useState('');
  const [eventPlanFilter, setEventPlanFilter] = useState('all');
  const [eventDateFrom, setEventDateFrom] = useState('');
  const [eventDateTo, setEventDateTo] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!isAdmin) {
      navigate('/host');
      return;
    }

    Promise.all([
      api.getAdminHosts(),
      api.getAdminEvents(),
      api.getAdminStats(),
    ])
      .then(([hostsData, eventsData, statsData]) => {
        setHosts(hostsData.hosts);
        setEvents(eventsData.events);
        setStats(statsData.stats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    setStorageConfigInitLoading(true);
    api
      .getStorageConfig()
      .then((data) => {
        setStorageType(data.storageType);
        if (data.s3) {
          setS3Bucket(data.s3.bucket || '');
          setS3Region(data.s3.region || 'us-east-1');
          setS3Endpoint(data.s3.endpoint || '');
          setS3AccessKeyId(data.s3.accessKeyId || '');
          // masked "***" means a secret exists; keep input blank so we don't leak it
          setS3SecretAccessKey('');
          setS3PublicUrl(data.s3.publicUrl || '');
          setS3ForcePathStyle(!!data.s3.forcePathStyle);
        }
      })
      .catch((e: any) => setStorageConfigError(e.message || 'Failed to load storage config'))
      .finally(() => setStorageConfigInitLoading(false));
  }, [authLoading, isAdmin]);

  const loadStorage = async (reset = false) => {
    setStorageLoading(true);
    try {
      const health = await api.getStorageHealth();
      setStorageHealth(health);
      if (!health.ok) {
        setStorageObjects([]);
        setStorageCursor(null);
        return;
      }
      const cursor = reset ? null : storageCursor;
      const data = await api.listStorageObjects(storagePrefix.trim(), 50, cursor);
      setStorageCursor(data.nextCursor);
      setStorageObjects((prev) => (reset ? data.objects : [...prev, ...data.objects]));
    } catch (e: any) {
      setStorageHealth({ ok: false, error: e.message || 'Failed to load storage' });
    } finally {
      setStorageLoading(false);
    }
  };

  const buildStorageConfigBody = () => {
    if (storageType === 'filesystem') return { storageType: 'filesystem' as const };
    return {
      storageType: 's3' as const,
      s3: {
        bucket: s3Bucket.trim(),
        region: s3Region.trim() || 'us-east-1',
        endpoint: s3Endpoint.trim() || undefined,
        accessKeyId: s3AccessKeyId.trim() || undefined,
        secretAccessKey: s3SecretAccessKey.trim() || undefined,
        publicUrl: s3PublicUrl.trim(),
        forcePathStyle: s3ForcePathStyle,
      },
    };
  };

  const handleSaveStorageConfig = async () => {
    setStorageConfigError('');
    setStorageConfigSaved('');
    setStorageConfigActionLoading(true);
    try {
      await api.saveStorageConfig(buildStorageConfigBody() as any);
      setStorageConfigSaved('Saved. Backend storage updated immediately.');
      setS3SecretAccessKey(''); // never keep secret in state longer than needed
      // Refresh health after save
      const health = await api.getStorageHealth();
      setStorageHealth(health);
    } catch (e: any) {
      setStorageConfigError(e.message || 'Failed to save config');
    } finally {
      setStorageConfigActionLoading(false);
    }
  };

  const handleTestStorageConfig = async () => {
    setStorageConfigError('');
    setStorageConfigSaved('');
    setStorageConfigActionLoading(true);
    try {
      const out = await api.testStorageConfig(buildStorageConfigBody() as any);
      setStorageConfigSaved(out.ok ? `Connection OK${out.sampleKey ? ` (sample: ${out.sampleKey})` : ''}` : 'Connection failed');
    } catch (e: any) {
      setStorageConfigError(e.message || 'Storage test failed');
    } finally {
      setStorageConfigActionLoading(false);
    }
  };

  // Filtered users
  const filteredHosts = useMemo(() => {
    let result = hosts;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      result = result.filter(
        (h) =>
          h.displayName.toLowerCase().includes(q) ||
          h.email.toLowerCase().includes(q)
      );
    }
    if (userPlanFilter !== 'all') {
      result = result.filter((h) => (h.plan || 'free') === userPlanFilter);
    }
    return result;
  }, [hosts, userSearch, userPlanFilter]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    let result = events;
    if (eventSearch.trim()) {
      const q = eventSearch.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.host.displayName.toLowerCase().includes(q) ||
          e.host.email.toLowerCase().includes(q) ||
          e.eventCode.toLowerCase().includes(q)
      );
    }
    if (eventPlanFilter !== 'all') {
      result = result.filter((e) => (e.host.plan || 'free') === eventPlanFilter);
    }
    if (eventDateFrom) {
      const from = new Date(eventDateFrom);
      result = result.filter((e) => new Date(e.startDatetime) >= from);
    }
    if (eventDateTo) {
      const to = new Date(eventDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((e) => new Date(e.startDatetime) <= to);
    }
    return result;
  }, [events, eventSearch, eventPlanFilter, eventDateFrom, eventDateTo]);

  const handleToggleRole = async (hostId: string, currentRole: string) => {
    setActionLoading(hostId);
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      const data = await api.updateHost(hostId, {
        role: newRole,
        ...(newRole === 'admin' ? { canCreateEvents: true } : {}),
      });
      setHosts((prev) => prev.map((h) => (h.id === hostId ? data.host : h)));
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangePlan = async (hostId: string, newPlan: string) => {
    setActionLoading(hostId);
    try {
      const data = await api.updateHost(hostId, { plan: newPlan });
      setHosts((prev) => prev.map((h) => (h.id === hostId ? data.host : h)));
    } catch (err: any) {
      alert(err.message || 'Failed to update plan');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleCreateEvents = async (hostId: string, current: boolean) => {
    setActionLoading(hostId);
    try {
      const data = await api.updateHost(hostId, { canCreateEvents: !current });
      setHosts((prev) => prev.map((h) => (h.id === hostId ? data.host : h)));
    } catch (err: any) {
      alert(err.message || 'Failed to update permission');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEvent = async (eventId: string, title: string) => {
    if (!confirm(`Delete event "${title}"? This will permanently remove all photos, guest sessions, and exports.`)) {
      return;
    }
    setActionLoading(eventId);
    try {
      await api.adminDeleteEvent(eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      if (stats) {
        setStats({ ...stats, totalEvents: stats.totalEvents - 1 });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete event');
    } finally {
      setActionLoading(null);
    }
  };

  const clearUserFilters = () => {
    setUserSearch('');
    setUserPlanFilter('all');
  };

  const clearEventFilters = () => {
    setEventSearch('');
    setEventPlanFilter('all');
    setEventDateFrom('');
    setEventDateTo('');
  };

  const hasUserFilters = userSearch || userPlanFilter !== 'all';
  const hasEventFilters = eventSearch || eventPlanFilter !== 'all' || eventDateFrom || eventDateTo;

  const activeEvents = events.filter((e) => e.isActive).slice(0, 3);

  if (loading) {
    return (
      <Layout title="Admin Panel" subtitle="SYSTEM">
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#c19cff] border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Panel" subtitle="SYSTEM">
      {/* Top Stats Row */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#131313] rounded-xl p-6 border-l-4 border-[#c19cff] relative">
            <div className="text-xs text-[#adaaaa] uppercase tracking-wider mb-2 font-medium">Users</div>
            <div
              className="text-3xl font-extrabold text-white"
              style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              {stats.totalHosts}
            </div>
            <Users className="absolute right-5 top-5 w-5 h-5 text-[#c19cff]/40" />
          </div>
          <div className="bg-[#131313] rounded-xl p-6 border-l-4 border-[#ff7441] relative">
            <div className="text-xs text-[#adaaaa] uppercase tracking-wider mb-2 font-medium">Events</div>
            <div
              className="text-3xl font-extrabold text-white"
              style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              {stats.totalEvents}
            </div>
            <Calendar className="absolute right-5 top-5 w-5 h-5 text-[#ff7441]/40" />
          </div>
          <div className="bg-[#131313] rounded-xl p-6 border-l-4 border-[#ff98ae] relative">
            <div className="text-xs text-[#adaaaa] uppercase tracking-wider mb-2 font-medium">Photos</div>
            <div
              className="text-3xl font-extrabold text-white"
              style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              {stats.totalPhotos}
            </div>
            <Image className="absolute right-5 top-5 w-5 h-5 text-[#ff98ae]/40" />
          </div>
          <div className="bg-[#131313] rounded-xl p-6 border-l-4 border-[#9146ff] relative">
            <div className="text-xs text-[#adaaaa] uppercase tracking-wider mb-2 font-medium">Guests</div>
            <div
              className="text-3xl font-extrabold text-white"
              style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              {stats.totalGuests}
            </div>
            <BarChart3 className="absolute right-5 top-5 w-5 h-5 text-[#9146ff]/40" />
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Tabs Section */}
        <div className="lg:col-span-8">
          {/* Tab Bar */}
          <div className="flex gap-1 bg-[#262626] p-1 rounded-xl mb-6">
            <button
              onClick={() => setTab('users')}
              className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === 'users'
                  ? 'bg-[#2c2c2c] text-white shadow-sm'
                  : 'text-[#adaaaa] hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              Users
              <span className="text-xs opacity-60">({hosts.length})</span>
            </button>
            <button
              onClick={() => setTab('events')}
              className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === 'events'
                  ? 'bg-[#2c2c2c] text-white shadow-sm'
                  : 'text-[#adaaaa] hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Events
              <span className="text-xs opacity-60">({events.length})</span>
            </button>
            <button
              onClick={() => setTab('storage')}
              className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === 'storage'
                  ? 'bg-[#2c2c2c] text-white shadow-sm'
                  : 'text-[#adaaaa] hover:text-white'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              Storage
            </button>
          </div>

          {/* ── Users Tab ───────────────────────────────────────── */}
          {tab === 'users' && (
            <>
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adaaaa]" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#262626] border-0 border-b-2 border-[#484847] focus:border-[#c19cff] rounded-none text-sm text-white placeholder-[#adaaaa] focus:outline-none transition-colors"
                  />
                </div>
                <select
                  value={userPlanFilter}
                  onChange={(e) => setUserPlanFilter(e.target.value)}
                  className="bg-[#262626] border border-[#484847] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                >
                  <option value="all">All Plans</option>
                  {Object.values(PLANS).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {hasUserFilters && (
                  <button
                    onClick={clearUserFilters}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#adaaaa] hover:text-white border border-[#484847] rounded-xl hover:bg-[#262626] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
              </div>

              {hasUserFilters && (
                <div className="text-xs text-[#adaaaa]/60 mb-3">
                  Showing {filteredHosts.length} of {hosts.length} users
                </div>
              )}

              {/* Table */}
              <div className="bg-[#131313] rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 px-4 py-3 border-b border-[#484847]">
                  <div className="col-span-5 text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">User</div>
                  <div className="col-span-3 text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Plan</div>
                  <div className="col-span-2 text-xs font-semibold text-[#adaaaa] uppercase tracking-wider hidden sm:block">Joined</div>
                  <div className="col-span-2 text-xs font-semibold text-[#adaaaa] uppercase tracking-wider text-right">Actions</div>
                </div>

                {/* Rows */}
                {filteredHosts.length === 0 ? (
                  <div className="text-center py-12 text-[#adaaaa]">
                    {hasUserFilters ? 'No users match your filters.' : 'No users found.'}
                  </div>
                ) : (
                  filteredHosts.map((host) => (
                    <div
                      key={host.id}
                      className="grid grid-cols-12 px-4 py-3 border-b border-[#484847]/40 last:border-0 items-center hover:bg-[#0e0e0e] transition-colors"
                    >
                      {/* Avatar + Name */}
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#262626] flex items-center justify-center flex-shrink-0 text-sm font-bold text-[#c19cff]">
                          {host.displayName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm truncate">
                              {host.displayName}
                            </span>
                            {host.role === 'admin' && (
                              <span className="text-xs px-2 py-0.5 rounded-lg bg-[#ff7441]/10 text-[#ff7441] flex items-center gap-1 flex-shrink-0">
                                <ShieldCheck className="w-3 h-3" />
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#adaaaa] truncate">{host.email}</div>
                        </div>
                      </div>

                      {/* Plan */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-[#c19cff]/60 flex-shrink-0" />
                          <select
                            value={host.plan || 'free'}
                            onChange={(e) => handleChangePlan(host.id, e.target.value)}
                            disabled={actionLoading === host.id}
                            className="text-xs font-medium bg-[#262626] border border-[#484847] rounded-lg px-2 py-1.5 text-white cursor-pointer disabled:opacity-50 focus:outline-none focus:border-[#c19cff]"
                          >
                            {Object.values(PLANS).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Joined */}
                      <div className="col-span-2 text-xs text-[#adaaaa] hidden sm:block">
                        {new Date(host.createdAt).toLocaleDateString()}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleCreateEvents(host.id, host.canCreateEvents)}
                          disabled={actionLoading === host.id || host.role === 'admin'}
                          title={
                            host.role === 'admin'
                              ? 'Admins can always create events'
                              : host.canCreateEvents
                              ? 'Revoke event creation'
                              : 'Allow event creation'
                          }
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                            host.canCreateEvents || host.role === 'admin'
                              ? 'bg-[#c19cff]/10 text-[#c19cff] hover:bg-[#c19cff]/20'
                              : 'bg-[#262626] text-[#adaaaa] hover:bg-[#2c2c2c]'
                          }`}
                        >
                          {host.canCreateEvents || host.role === 'admin' ? (
                            <UserCheck className="w-3.5 h-3.5" />
                          ) : (
                            <UserX className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleToggleRole(host.id, host.role)}
                          disabled={actionLoading === host.id}
                          title={host.role === 'admin' ? 'Remove admin role' : 'Promote to admin'}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                            host.role === 'admin'
                              ? 'bg-[#ff7441]/10 text-[#ff7441] hover:bg-[#ff7441]/20'
                              : 'bg-[#262626] text-[#adaaaa] hover:bg-[#2c2c2c]'
                          }`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── Events Tab ──────────────────────────────────────── */}
          {tab === 'events' && (
            <>
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adaaaa]" />
                  <input
                    type="text"
                    placeholder="Search by title, host, or event code..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#262626] border-0 border-b-2 border-[#484847] focus:border-[#c19cff] rounded-none text-sm text-white placeholder-[#adaaaa] focus:outline-none transition-colors"
                  />
                </div>
                <select
                  value={eventPlanFilter}
                  onChange={(e) => setEventPlanFilter(e.target.value)}
                  className="bg-[#262626] border border-[#484847] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                >
                  <option value="all">All Plans</option>
                  {Object.values(PLANS).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {hasEventFilters && (
                  <button
                    onClick={clearEventFilters}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#adaaaa] hover:text-white border border-[#484847] rounded-xl hover:bg-[#262626] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
              </div>

              {/* Date range filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#adaaaa] whitespace-nowrap">From</label>
                  <input
                    type="date"
                    value={eventDateFrom}
                    onChange={(e) => setEventDateFrom(e.target.value)}
                    className="bg-[#262626] border border-[#484847] rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#adaaaa] whitespace-nowrap">To</label>
                  <input
                    type="date"
                    value={eventDateTo}
                    onChange={(e) => setEventDateTo(e.target.value)}
                    className="bg-[#262626] border border-[#484847] rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                  />
                </div>
              </div>

              {hasEventFilters && (
                <div className="text-xs text-[#adaaaa]/60 mb-3">
                  Showing {filteredEvents.length} of {events.length} events
                </div>
              )}

              {/* Table */}
              <div className="bg-[#131313] rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 px-4 py-3 border-b border-[#484847]">
                  <div className="col-span-5 text-xs font-semibold text-[#adaaaa] uppercase tracking-wider">Event</div>
                  <div className="col-span-2 text-xs font-semibold text-[#adaaaa] uppercase tracking-wider hidden sm:block">Photos</div>
                  <div className="col-span-2 text-xs font-semibold text-[#adaaaa] uppercase tracking-wider hidden sm:block">Status</div>
                  <div className="col-span-2 text-xs font-semibold text-[#adaaaa] uppercase tracking-wider hidden sm:block">Date</div>
                  <div className="col-span-1 text-xs font-semibold text-[#adaaaa] uppercase tracking-wider text-right">Del</div>
                </div>

                {filteredEvents.length === 0 ? (
                  <div className="text-center py-12 text-[#adaaaa]">
                    {hasEventFilters ? 'No events match your filters.' : 'No events yet.'}
                  </div>
                ) : (
                  filteredEvents.map((event) => (
                    <div
                      key={event.id}
                      className="grid grid-cols-12 px-4 py-3 border-b border-[#484847]/40 last:border-0 items-center hover:bg-[#0e0e0e] transition-colors"
                    >
                      {/* Event name + host */}
                      <div
                        className="col-span-5 flex items-center gap-3 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/host/events/${event.id}`)}
                      >
                        {event.iconUrl ? (
                          <img
                            src={event.iconUrl}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-[#262626] flex items-center justify-center flex-shrink-0">
                            <Camera className="w-4 h-4 text-[#adaaaa]" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-white text-sm truncate flex items-center gap-1">
                            {event.title}
                            <ChevronRight className="w-3.5 h-3.5 text-[#adaaaa]/40 flex-shrink-0" />
                          </div>
                          <div className="text-xs text-[#adaaaa] truncate">
                            {event.host.displayName}
                            {event.host.plan && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#262626] text-[#adaaaa]/70 capitalize text-[10px]">
                                {event.host.plan}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Photos */}
                      <div className="col-span-2 text-sm text-white hidden sm:block">
                        {event.photoCount}
                        <span className="text-xs text-[#adaaaa] ml-1">/ {event.guestCount} guests</span>
                      </div>

                      {/* Status */}
                      <div className="col-span-2 hidden sm:block">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                            event.isActive
                              ? 'bg-[#c19cff]/10 text-[#c19cff]'
                              : 'bg-[#262626] text-[#adaaaa]'
                          }`}
                        >
                          {event.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="col-span-2 text-xs text-[#adaaaa] hidden sm:block">
                        {new Date(event.startDatetime).toLocaleDateString()}
                      </div>

                      {/* Delete */}
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() => handleDeleteEvent(event.id, event.title)}
                          disabled={actionLoading === event.id}
                          title="Delete event"
                          className="p-1.5 rounded-lg bg-[#ff6e84]/10 text-[#ff6e84] hover:bg-[#ff6e84]/20 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ── Storage Tab ──────────────────────────────────────── */}
          {tab === 'storage' && (
            <div className="space-y-4">
              {/* Config card */}
              <div className="bg-[#131313] rounded-xl p-6">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <div
                      className="font-semibold text-white flex items-center gap-2"
                      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                    >
                      Storage configuration
                      <button
                        type="button"
                        className="text-[#adaaaa] hover:text-white transition-colors"
                        title="How to connect S3-compatible storage"
                        onClick={() => setShowStorageHelp(true)}
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xs text-[#adaaaa]">Saved in DB and applied instantly to the backend.</div>
                  </div>
                </div>

                {/* Storage type segmented control */}
                {storageConfigInitLoading ? (
                  <div className="h-10 bg-[#262626] rounded-xl animate-pulse mb-4" />
                ) : (
                  <div className="grid grid-cols-2 bg-[#262626] rounded-xl p-1 mb-6 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={() => setStorageType('filesystem')}
                      disabled={storageConfigActionLoading}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                        storageType === 'filesystem'
                          ? 'bg-[#1a1a1a] text-white shadow-sm ring-1 ring-[#c19cff]/30'
                          : 'text-[#adaaaa] hover:text-white'
                      }`}
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      Filesystem
                    </button>
                    <button
                      type="button"
                      onClick={() => setStorageType('s3')}
                      disabled={storageConfigActionLoading}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                        storageType === 's3'
                          ? 'bg-[#1a1a1a] text-white shadow-sm ring-1 ring-[#c19cff]/30'
                          : 'text-[#adaaaa] hover:text-white'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      S3-compatible
                    </button>
                  </div>
                )}

                {storageType === 'filesystem' && !storageConfigInitLoading && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-[#262626] border border-[#484847] text-sm text-[#adaaaa]">
                    Photos are stored on the server's local disk at <code className="text-white bg-[#1a1a1a] px-1.5 py-0.5 rounded text-xs">/app/uploads</code>. Switch to S3-compatible for cloud storage.
                  </div>
                )}

                {storageType === 's3' && !storageConfigInitLoading && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs text-[#adaaaa] mb-1">Bucket</label>
                      <input
                        value={s3Bucket}
                        onChange={(e) => setS3Bucket(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#262626] border border-[#484847] rounded-xl text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#adaaaa] mb-1">Region</label>
                      <input
                        value={s3Region}
                        onChange={(e) => setS3Region(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#262626] border border-[#484847] rounded-xl text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                        placeholder="us-east-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-[#adaaaa] mb-1">Public URL (base)</label>
                      <input
                        value={s3PublicUrl}
                        onChange={(e) => setS3PublicUrl(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#262626] border border-[#484847] rounded-xl text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                        placeholder="https://your-cdn-or-bucket-url"
                      />
                      <div className="text-[11px] text-[#adaaaa]/60 mt-1">
                        Used to render images in the app. Example: `https://&lt;bucket&gt;.&lt;region&gt;.amazonaws.com`
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-[#adaaaa] mb-1">Endpoint (optional)</label>
                      <input
                        value={s3Endpoint}
                        onChange={(e) => setS3Endpoint(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#262626] border border-[#484847] rounded-xl text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                        placeholder="https://s3.amazonaws.com or https://<account>.r2.cloudflarestorage.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#adaaaa] mb-1">Access key ID (optional)</label>
                      <input
                        value={s3AccessKeyId}
                        onChange={(e) => setS3AccessKeyId(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#262626] border border-[#484847] rounded-xl text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#adaaaa] mb-1">Secret access key</label>
                      <input
                        type="password"
                        value={s3SecretAccessKey}
                        onChange={(e) => setS3SecretAccessKey(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#262626] border border-[#484847] rounded-xl text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                        placeholder="Leave blank to keep unchanged"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[#adaaaa] sm:col-span-2 mt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={s3ForcePathStyle}
                        onChange={(e) => setS3ForcePathStyle(e.target.checked)}
                        className="accent-[#c19cff]"
                      />
                      Force path style
                    </label>
                  </div>
                )}

                {/* Status messages */}
                {!storageConfigInitLoading && (
                  <div className="mb-4 text-sm">
                    {storageConfigError ? (
                      <div className="text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-3 py-2">
                        {storageConfigError}
                      </div>
                    ) : storageConfigSaved ? (
                      <div className="text-[#c19cff] bg-[#c19cff]/10 border border-[#c19cff]/20 rounded-xl px-3 py-2">
                        {storageConfigSaved}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Action buttons */}
                {!storageConfigInitLoading && (
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-[#262626] text-white hover:bg-[#2c2c2c] transition-colors disabled:opacity-50"
                      onClick={handleTestStorageConfig}
                      disabled={storageConfigActionLoading || storageType !== 's3'}
                      title={storageType !== 's3' ? 'Switch to S3-compatible to test' : undefined}
                    >
                      {storageConfigActionLoading ? 'Working…' : 'Test'}
                    </button>
                    <button
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-[#9146ff] to-[#c19cff] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                      onClick={handleSaveStorageConfig}
                      disabled={storageConfigActionLoading}
                    >
                      {storageConfigActionLoading ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {/* Help modal */}
              {showStorageHelp && (
                <div
                  className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                  role="dialog"
                  aria-modal="true"
                  onClick={() => setShowStorageHelp(false)}
                >
                  <div
                    className="w-full max-w-2xl bg-[#131313] rounded-2xl border border-[#484847] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-5 py-4 border-b border-[#484847] flex items-start justify-between gap-3">
                      <div>
                        <div
                          className="font-semibold text-white"
                          style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                        >
                          Connecting an S3-compatible bucket
                        </div>
                        <div className="text-xs text-[#adaaaa] mt-0.5">
                          Works with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, etc.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-[#adaaaa] hover:text-white transition-colors"
                        onClick={() => setShowStorageHelp(false)}
                        title="Close"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="px-5 py-4 space-y-4 text-sm text-[#adaaaa]">
                      <div className="space-y-2">
                        <div className="font-medium text-white">1) Create a bucket + credentials</div>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Create a bucket (or pick an existing one).</li>
                          <li>Create an access key with permissions: <span className="font-mono text-[#c19cff]">s3:PutObject</span>, <span className="font-mono text-[#c19cff]">s3:GetObject</span>, <span className="font-mono text-[#c19cff]">s3:DeleteObject</span>, <span className="font-mono text-[#c19cff]">s3:ListBucket</span>.</li>
                          <li>For R2/MinIO/Spaces: you'll also have an <span className="font-mono text-[#c19cff]">Endpoint</span> URL.</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <div className="font-medium text-white">2) Fill in the fields</div>
                        <ul className="list-disc pl-5 space-y-1">
                          <li><b className="text-white">Bucket</b>: your bucket name.</li>
                          <li><b className="text-white">Region</b>: AWS region.</li>
                          <li><b className="text-white">Endpoint</b> (optional): provider endpoint.</li>
                          <li><b className="text-white">Access key ID</b> / <b className="text-white">Secret access key</b>: your credentials.</li>
                          <li><b className="text-white">Force path style</b>: turn on for some MinIO/self-hosted setups.</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <div className="font-medium text-white">3) Set the Public URL correctly</div>
                        <div>
                          The app builds file URLs like <span className="font-mono text-[#c19cff]">{'publicUrl + "/" + objectKey'}</span>.
                          Use a URL that can actually serve objects publicly.
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="font-medium text-white">4) Test → Save</div>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Click <b className="text-white">Test</b> to verify the bucket is reachable.</li>
                          <li>Click <b className="text-white">Save</b> to apply instantly.</li>
                        </ul>
                      </div>
                      <div className="text-xs text-[#adaaaa]/60">
                        If thumbnails don't render, it's usually a <b className="text-[#adaaaa]">Public URL/CORS</b> issue (not the upload).
                      </div>
                    </div>

                    <div className="px-5 py-4 border-t border-[#484847] flex justify-end">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-[#9146ff] to-[#c19cff] text-white hover:opacity-90 transition-opacity"
                        onClick={() => setShowStorageHelp(false)}
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Object browser */}
              <div className="bg-[#131313] rounded-xl p-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-4">
                  <div className="flex-1">
                    <label className="block text-xs text-[#adaaaa] mb-1">S3 prefix</label>
                    <input
                      value={storagePrefix}
                      onChange={(e) => setStoragePrefix(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#262626] border border-[#484847] rounded-xl text-sm text-white focus:outline-none focus:border-[#c19cff] transition-colors"
                      placeholder="hosts/<hostId>/events/<eventId>/images/"
                    />
                    <div className="text-xs text-[#adaaaa]/60 mt-1">
                      Tip: browse per event: <span className="font-mono">hosts/&lt;hostId&gt;/events/&lt;eventId&gt;/</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="px-4 py-2.5 rounded-xl text-sm font-medium bg-[#262626] text-white hover:bg-[#2c2c2c] transition-colors disabled:opacity-50"
                      onClick={() => {
                        setStorageObjects([]);
                        setStorageCursor(null);
                        loadStorage(true);
                      }}
                      disabled={storageLoading}
                    >
                      Refresh
                    </button>
                    <button
                      className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-[#9146ff] to-[#c19cff] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                      onClick={() => loadStorage(true)}
                      disabled={storageLoading}
                    >
                      {storageLoading ? 'Loading…' : 'Load'}
                    </button>
                  </div>
                </div>

                <div className="mb-4 text-sm">
                  {storageHealth?.ok ? (
                    <div className="text-[#c19cff] bg-[#c19cff]/10 border border-[#c19cff]/20 rounded-xl px-3 py-2">
                      Connected to bucket <span className="font-mono">{storageHealth.bucket}</span>
                    </div>
                  ) : storageHealth ? (
                    <div className="text-[#ff6e84] bg-[#ff6e84]/10 border border-[#ff6e84]/20 rounded-xl px-3 py-2">
                      Storage not ready: {storageHealth.error || 'unknown error'}
                    </div>
                  ) : (
                    <div className="text-[#adaaaa]">Click Load to check connection and list objects.</div>
                  )}
                </div>

                {storageObjects.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {storageObjects.map((o) => {
                      const isImage = /\.(avif|webp|png|jpg|jpeg|gif)$/i.test(o.key);
                      return (
                        <a
                          key={o.key}
                          href={o.url}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-[#262626] rounded-xl p-2 hover:bg-[#2c2c2c] transition-colors"
                          title={o.key}
                        >
                          <div className="aspect-square rounded-lg bg-[#0e0e0e] overflow-hidden flex items-center justify-center">
                            {isImage ? (
                              <img src={o.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs text-[#adaaaa] text-center px-2 break-words">
                                {o.key.split('/').pop()}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-[10px] text-[#adaaaa] truncate font-mono">{o.key}</div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 text-[#adaaaa]">No objects loaded.</div>
                )}

                {storageCursor && (
                  <div className="flex justify-center mt-4">
                    <button
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-[#262626] text-white hover:bg-[#2c2c2c] transition-colors disabled:opacity-50"
                      onClick={() => loadStorage(false)}
                      disabled={storageLoading}
                    >
                      {storageLoading ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Active Events Feed */}
        <div className="lg:col-span-4">
          <div
            className="font-bold text-white mb-4 text-sm uppercase tracking-wider"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            Active Events
          </div>
          <div className="space-y-3">
            {activeEvents.length === 0 ? (
              <div className="bg-[#131313] rounded-xl p-6 text-center text-[#adaaaa] text-sm">
                No active events.
              </div>
            ) : (
              activeEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-[#131313] rounded-xl overflow-hidden cursor-pointer hover:ring-1 hover:ring-[#484847] transition-all"
                  onClick={() => navigate(`/host/events/${event.id}`)}
                >
                  {/* Image / gradient header */}
                  <div className="relative h-24 bg-gradient-to-br from-[#9146ff]/30 to-[#c19cff]/10">
                    {event.iconUrl && (
                      <img
                        src={event.iconUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-40"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div
                        className="font-bold text-white text-sm truncate"
                        style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                      >
                        {event.title}
                      </div>
                      <div className="text-xs text-[#adaaaa]">{event.host.displayName}</div>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="text-xs px-2 py-0.5 rounded-lg bg-[#c19cff]/20 text-[#c19cff] font-medium">
                        Live
                      </span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 divide-x divide-[#484847]/40 px-0 py-0">
                    <div className="p-3 text-center">
                      <div className="text-xs text-[#adaaaa] mb-0.5">Captures</div>
                      <div className="font-bold text-white text-sm" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        {event.photoCount}
                      </div>
                    </div>
                    <div className="p-3 text-center">
                      <div className="text-xs text-[#adaaaa] mb-0.5">Guests</div>
                      <div className="font-bold text-white text-sm" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        {event.guestCount}
                      </div>
                    </div>
                    <div className="p-3 text-center">
                      <div className="text-xs text-[#adaaaa] mb-0.5">Status</div>
                      <div className="font-bold text-[#c19cff] text-sm" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        Active
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* All other events summary */}
            {events.length > 3 && (
              <button
                className="w-full py-3 rounded-xl bg-[#131313] text-[#adaaaa] text-sm hover:text-white hover:bg-[#262626] transition-colors"
                onClick={() => setTab('events')}
              >
                View all {events.length} events
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
