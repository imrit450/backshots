import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PhotoGrid from '../components/PhotoGrid';
import { api } from '../api/client';

export default function HostGallery() {
  const { eventId } = useParams<{ eventId: string }>();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    api
      .getPhotos(eventId)
      .then((data) => setPhotos(data.photos))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [eventId]);

  const handlePhotoAction = async (photoId: string, action: string) => {
    if (!eventId) return;
    try {
      let data: any = {};
      if (action === 'hide') data.hidden = true;
      if (action === 'unhide') data.hidden = false;
      if (action === 'approve') data.status = 'APPROVED';
      if (action === 'reject') data.status = 'REJECTED';

      const res = await api.moderatePhoto(eventId, photoId, data);
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, ...res.photo } : p)));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredPhotos = showHidden ? photos : photos.filter((p) => !p.hidden);

  return (
    <Layout title="Gallery" showBack backTo={`/host/events/${eventId}`}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-charcoal">
          All Photos ({filteredPhotos.length})
        </h1>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="w-4 h-4 text-pine-700 rounded"
          />
          Show hidden
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-pine-800 border-t-transparent" />
        </div>
      ) : (
        <PhotoGrid
          photos={filteredPhotos}
          onPhotoAction={handlePhotoAction}
          showActions
        />
      )}
    </Layout>
  );
}
