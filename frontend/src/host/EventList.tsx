import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { Plus, Calendar, Users, Image, Lock } from 'lucide-react';
import { getPlan } from '../config/plans';

export default function EventList() {
  const { host, isAdmin, canCreateEvents, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const effectivePlan = getPlan(host?.plan || 'free');
  const canCreateByPlan = effectivePlan.maxEvents !== 0;
  const canCreate = isAdmin || canCreateEvents || canCreateByPlan;

  // Wait for auth to fully resolve (Clerk→backend exchange) before fetching,
  // so the host token is set and the request isn't rejected with 401.
  useEffect(() => {
    if (authLoading) return;
    api
      .getEvents()
      .then((data) => setEvents(data.events))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading]);

  return (
    <Layout title="My Events" subtitle="EVENT MANAGEMENT">
      {/* Page header row */}
      <div className="flex items-center justify-between mb-8">
        <div />
        {canCreate ? (
          <Link
            to="/host/events/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-tr from-primary to-primary-dim text-on-primary font-semibold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:opacity-90 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Event</span>
          </Link>
        ) : (
          <span
            title="Contact your admin to create events"
            className="flex items-center gap-1.5 text-xs text-on-surface-variant bg-surface-container-highest px-3 py-2 rounded-xl cursor-not-allowed opacity-60"
          >
            <Lock className="w-3.5 h-3.5" />
            Contact admin to create events
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-full max-w-sm border-2 border-dashed border-outline-variant/40 rounded-xl p-12 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4">add_a_photo</span>
            <h2 className="font-headline text-xl font-bold text-on-surface mb-2">No events yet</h2>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              {canCreate
                ? 'Create your first event and share a QR code with guests to start capturing photos.'
                : "You don't have permission to create events yet. Ask an admin to grant you access."}
            </p>
            {canCreate && (
              <Link
                to="/host/events/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-tr from-primary to-primary-dim text-on-primary font-semibold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                Create Your First Event
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div
              key={event.id}
              onClick={() => navigate(`/host/events/${event.id}`)}
              className="bg-surface-container-low rounded-xl overflow-hidden group hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              {/* Card image area */}
              <div className="relative h-48">
                {event.iconUrl ? (
                  <img
                    src={event.iconUrl}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary-dim/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary/40 text-6xl">photo_camera</span>
                  </div>
                )}

                {/* Status badge */}
                <div className="absolute top-3 right-3">
                  {event.isActive ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-container/20 text-tertiary border border-tertiary/20 text-xs font-semibold backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-highest/80 text-on-surface-variant text-xs font-semibold backdrop-blur-sm">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Card body */}
              <div className="p-6">
                <h3 className="font-headline font-bold text-on-surface text-lg leading-snug truncate mb-1">
                  {event.title}
                </h3>

                <div className="flex items-center gap-1.5 text-on-surface-variant text-sm mb-4">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {new Date(event.startDatetime).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1 text-on-surface-variant text-xs">
                    <Image className="w-3.5 h-3.5" />
                    <span>{event.photoCount || 0} photos</span>
                  </div>
                  <div className="flex items-center gap-1 text-on-surface-variant text-xs">
                    <Users className="w-3.5 h-3.5" />
                    <span>{event.guestCount || 0} guests</span>
                  </div>
                </div>

                {/* Moderation tag */}
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                  {event.moderationMode === 'AUTO' ? 'Auto-approve' : 'Manual approval'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
