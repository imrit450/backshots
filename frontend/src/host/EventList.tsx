import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import { Plus, Calendar, Users, Image, ChevronRight, Lock } from 'lucide-react';

export default function EventList() {
  const { canCreateEvents } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getEvents()
      .then((data) => setEvents(data.events))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-charcoal">My Events</h1>
          <p className="text-gray-500 mt-1 font-sans text-sm">Manage your event photo experiences</p>
        </div>
        {canCreateEvents ? (
          <Link to="/host/events/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">New Event</span>
          </Link>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded-lg">
            <Lock className="w-3.5 h-3.5" />
            Contact admin to create events
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-pine-800 border-t-transparent" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gold-50 rounded-full mb-6">
            <Calendar className="w-10 h-10 text-gold-500" />
          </div>
          <h2 className="font-display text-2xl text-charcoal mb-2">No events yet</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto font-sans text-sm">
            {canCreateEvents
              ? 'Create your first event and share a QR code with guests to start capturing photos.'
              : 'You don\'t have permission to create events yet. Ask an admin to grant you access.'}
          </p>
          {canCreateEvents && (
            <Link to="/host/events/new" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Your First Event
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/host/events/${event.id}`}
              className="card hover:shadow-md hover:border-gold-200 transition-all duration-200 group"
            >
              <div className="flex items-start gap-3 mb-3">
                {event.iconUrl ? (
                  <img src={event.iconUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-pine-50" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-pine-50 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-pine-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-xl text-charcoal group-hover:text-pine-700 transition-colors truncate">
                    {event.title}
                  </h3>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gold-400 transition-colors flex-shrink-0" />
              </div>

              <div className="flex items-center gap-1 text-sm text-gray-500 mb-4">
                <Calendar className="w-4 h-4" />
                {new Date(event.startDatetime).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-gray-500">
                  <Image className="w-4 h-4" />
                  <span>{event.photoCount || 0} photos</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <Users className="w-4 h-4" />
                  <span>{event.guestCount || 0} guests</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    event.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {event.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-pine-50 text-pine-700">
                  {event.moderationMode === 'AUTO' ? 'Auto-approve' : 'Manual approval'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
