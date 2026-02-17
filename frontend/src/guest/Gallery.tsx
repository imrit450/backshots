import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import PhotoGrid from '../components/PhotoGrid';
import { Camera, ChevronLeft, ArrowUpDown } from 'lucide-react';
import { getTheme } from '../config/themes';
import Footer from '../components/Footer';

export default function GuestGallery() {
  const { eventCode } = useParams<{ eventCode: string }>();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest');
  const event = JSON.parse(sessionStorage.getItem('guestEvent') || '{}');
  const theme = useMemo(() => getTheme(event.theme), [event.theme]);

  useEffect(() => {
    if (!eventCode) return;
    api
      .getGuestGallery(eventCode, { sort })
      .then((data) => setPhotos(data.photos))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventCode, sort]);

  return (
    <div className="min-h-screen bg-ivory">
      {/* Header */}
      <header className="sticky top-0 z-50 shadow-md" style={{ backgroundColor: theme.headerBg }}>
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/e/${eventCode}/camera`)}
              className="p-2 hover:bg-white/10 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            {event.iconUrl && (
              <img src={event.iconUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-white/20" />
            )}
            <div>
              <h1 className="font-display text-white text-sm">{event.title || 'Gallery'}</h1>
              <p className="text-xs text-white/50">{photos.length} photos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSort(sort === 'latest' ? 'oldest' : 'latest')}
              className="p-2 hover:bg-white/10 rounded-lg text-white/60 flex items-center gap-1 text-sm"
            >
              <ArrowUpDown className="w-4 h-4" />
              {sort === 'latest' ? 'Newest' : 'Oldest'}
            </button>
            <button
              onClick={() => navigate(`/e/${eventCode}/camera`)}
              className="p-2 bg-pine-800 hover:bg-pine-800 rounded-lg text-white"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Gallery */}
      <div className="max-w-4xl mx-auto p-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-pine-800 border-t-transparent" />
          </div>
        ) : (
          <PhotoGrid photos={photos} />
        )}
      </div>

      <Footer className="py-6" variant="light" />
    </div>
  );
}
