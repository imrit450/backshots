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
} from 'lucide-react';
import { PLANS } from '../config/plans';

export default function Admin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'users' | 'events'>('users');
  const [hosts, setHosts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  if (loading) {
    return (
      <Layout title="Admin">
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-pine-800 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Panel" showBack backTo="/host">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <Users className="w-6 h-6 text-pine-600 mx-auto mb-1" />
            <div className="text-2xl font-display font-bold text-charcoal">{stats.totalHosts}</div>
            <div className="text-xs text-gray-500">Users</div>
          </div>
          <div className="card text-center">
            <Calendar className="w-6 h-6 text-pine-600 mx-auto mb-1" />
            <div className="text-2xl font-display font-bold text-charcoal">{stats.totalEvents}</div>
            <div className="text-xs text-gray-500">Events</div>
          </div>
          <div className="card text-center">
            <Image className="w-6 h-6 text-pine-600 mx-auto mb-1" />
            <div className="text-2xl font-display font-bold text-charcoal">{stats.totalPhotos}</div>
            <div className="text-xs text-gray-500">Photos</div>
          </div>
          <div className="card text-center">
            <BarChart3 className="w-6 h-6 text-pine-600 mx-auto mb-1" />
            <div className="text-2xl font-display font-bold text-charcoal">{stats.totalGuests}</div>
            <div className="text-xs text-gray-500">Guests</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'users'
              ? 'border-pine-700 text-pine-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5" />
          Users ({hosts.length})
        </button>
        <button
          onClick={() => setTab('events')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'events'
              ? 'border-pine-700 text-pine-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-1.5" />
          All Events ({events.length})
        </button>
      </div>

      {/* ── Users Tab ───────────────────────────────────────── */}
      {tab === 'users' && (
        <>
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine-400"
              />
            </div>
            <select
              value={userPlanFilter}
              onChange={(e) => setUserPlanFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine-400"
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
                className="flex items-center gap-1 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Result count */}
          {hasUserFilters && (
            <div className="text-xs text-gray-400 mb-3">
              Showing {filteredHosts.length} of {hosts.length} users
            </div>
          )}

          <div className="space-y-3">
            {filteredHosts.map((host) => (
              <div
                key={host.id}
                className="card flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-charcoal truncate">
                      {host.displayName}
                    </span>
                    {host.role === 'admin' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">{host.email}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{host.eventCount} events</span>
                    <span>Joined {new Date(host.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {/* Plan selector */}
                  <div className="flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-gold-500" />
                    <select
                      value={host.plan || 'free'}
                      onChange={(e) => handleChangePlan(host.id, e.target.value)}
                      disabled={actionLoading === host.id}
                      className="text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {Object.values(PLANS).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.price > 0 ? `($${p.price})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Toggle: Can Create Events */}
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                      host.canCreateEvents || host.role === 'admin'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {host.canCreateEvents || host.role === 'admin' ? (
                      <UserCheck className="w-3.5 h-3.5" />
                    ) : (
                      <UserX className="w-3.5 h-3.5" />
                    )}
                    {host.canCreateEvents || host.role === 'admin' ? 'Can Create' : 'No Create'}
                  </button>

                  {/* Toggle: Admin Role */}
                  <button
                    onClick={() => handleToggleRole(host.id, host.role)}
                    disabled={actionLoading === host.id}
                    title={host.role === 'admin' ? 'Remove admin role' : 'Promote to admin'}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                      host.role === 'admin'
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {host.role === 'admin' ? 'Admin' : 'User'}
                  </button>
                </div>
              </div>
            ))}

            {filteredHosts.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {hasUserFilters ? 'No users match your filters.' : 'No users found.'}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Events Tab ──────────────────────────────────────── */}
      {tab === 'events' && (
        <>
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, host, or event code..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine-400"
              />
            </div>
            <select
              value={eventPlanFilter}
              onChange={(e) => setEventPlanFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine-400"
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
                className="flex items-center gap-1 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Date range filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
              <input
                type="date"
                value={eventDateFrom}
                onChange={(e) => setEventDateFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
              <input
                type="date"
                value={eventDateTo}
                onChange={(e) => setEventDateTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pine-200 focus:border-pine-400"
              />
            </div>
          </div>

          {/* Result count */}
          {hasEventFilters && (
            <div className="text-xs text-gray-400 mb-3">
              Showing {filteredEvents.length} of {events.length} events
            </div>
          )}

          <div className="space-y-3">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="card flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/host/events/${event.id}`)}
                >
                  <div className="flex items-center gap-2">
                    {event.iconUrl ? (
                      <img
                        src={event.iconUrl}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-pine-50 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-pine-300" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-semibold text-charcoal truncate block">
                        {event.title}
                      </span>
                      <span className="text-xs text-gray-400">
                        by {event.host.displayName}
                        {event.host.plan && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 capitalize">
                            {event.host.plan}
                          </span>
                        )}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0 hidden sm:block" />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                    <span>{event.photoCount} photos</span>
                    <span>{event.guestCount} guests</span>
                    <span>
                      {new Date(event.startDatetime).toLocaleDateString()}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full ${
                        event.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {event.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteEvent(event.id, event.title)}
                  disabled={actionLoading === event.id}
                  title="Delete event"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            ))}

            {filteredEvents.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {hasEventFilters ? 'No events match your filters.' : 'No events yet.'}
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
