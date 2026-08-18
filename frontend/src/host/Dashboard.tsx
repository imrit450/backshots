import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { CalendarDays, Images, Clock, Plus, ArrowRight } from 'lucide-react';
import { getPlan } from '../config/plans';

export default function Dashboard() {
  const { host, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    api
      .getEvents()
      .then((data) => setEvents(data.events || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading]);

  const plan = getPlan(host?.plan || 'free');
  const activeEvents = events.filter((e) => e.isActive);
  const totalPhotos = events.reduce((sum: number, e: any) => sum + (e.photoCount ?? 0), 0);
  const recentEvents = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  const stats = [
    {
      label: 'Total Events',
      value: loading ? '—' : events.length,
      icon: <CalendarDays className="w-5 h-5" />,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Active Now',
      value: loading ? '—' : activeEvents.length,
      icon: <Clock className="w-5 h-5" />,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
    },
    {
      label: 'Total Photos',
      value: loading ? '—' : totalPhotos,
      icon: <Images className="w-5 h-5" />,
      color: 'text-tertiary',
      bg: 'bg-tertiary/10',
    },
  ];

  return (
    <Layout title="Dashboard">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black font-headline tracking-tight text-on-surface">
              Welcome back{host?.displayName ? `, ${host.displayName.split(' ')[0]}` : ''}.
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              {plan.name} plan · {loading ? '…' : `${events.length} event${events.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link
            to="/host/events/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-on-primary"
            style={{ background: 'linear-gradient(135deg, #c19cff, #9146ff)' }}
          >
            <Plus className="w-4 h-4" />
            New Event
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map(({ label, value, icon, color, bg }) => (
            <div
              key={label}
              className="bg-surface-container rounded-xl p-5 border border-outline-variant/20 flex flex-col gap-3"
            >
              <div className={`w-9 h-9 rounded-lg ${bg} ${color} flex items-center justify-center`}>
                {icon}
              </div>
              <div>
                <p className="text-2xl font-black font-headline tracking-tight text-on-surface">{value}</p>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Recent events */}
        <div className="bg-surface-container rounded-xl border border-outline-variant/20 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
            <h3 className="font-bold text-sm text-on-surface">Recent Events</h3>
            <Link to="/host/events" className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-on-surface-variant text-sm">Loading…</div>
          ) : recentEvents.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-on-surface-variant text-sm mb-4">No events yet.</p>
              <Link
                to="/host/events/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-on-primary"
                style={{ background: 'linear-gradient(135deg, #c19cff, #9146ff)' }}
              >
                <Plus className="w-4 h-4" /> Create your first event
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/20">
              {recentEvents.map((event) => (
                <li key={event.id}>
                  <Link
                    to={`/host/events/${event.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-container-high transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${event.isActive ? 'bg-secondary' : 'bg-outline'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-on-surface truncate">{event.title}</p>
                        <p className="text-xs text-on-surface-variant">
                          {event.photoCount ?? 0} photos · {new Date(event.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-outline group-hover:text-primary transition-colors flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
