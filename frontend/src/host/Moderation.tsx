import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { api } from '../api/client';
import {
  CheckCircle,
  XCircle,
  EyeOff,
  Eye,
  Filter,
  RefreshCw,
  AlertTriangle,
  AlertOctagon,
  Star,
  Trash2,
  CheckSquare,
  Square,
  X,
  Loader,
} from 'lucide-react';

const POLL_INTERVAL = 10_000;

export default function Moderation() {
  const { eventId } = useParams<{ eventId: string }>();
  const { addToast } = useToast();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const lastPhotoCount = useRef<number | null>(null);

  // ── Multi-select state ───────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Lightbox state ──────────────────────────────────────────────────
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === photos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(photos.map((p) => p.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // ── Fetch ────────────────────────────────────────────────────────────
  const fetchPhotos = useCallback(async () => {
    if (!eventId) return;
    try {
      const params: Record<string, string> = {};
      if (filter === 'pending') params.status = 'PENDING';
      if (filter === 'approved') params.status = 'APPROVED';
      if (filter === 'hidden') params.hidden = 'true';
      if (filter === 'rejected') params.status = 'REJECTED';

      const data = await api.getPhotos(eventId, filter === 'low-quality' ? {} : params);
      let fetched = data.photos;
      if (filter === 'low-quality') {
        fetched = fetched.filter((p: any) => p.qualityScore !== null && p.qualityScore < 50);
      }
      setPhotos(fetched);

      const count = data.photos.length;
      if (lastPhotoCount.current !== null && count > lastPhotoCount.current) {
        const diff = count - lastPhotoCount.current;
        addToast({
          type: 'photo',
          message: `${diff} new photo${diff > 1 ? 's' : ''} just arrived!`,
          duration: 5000,
        });
      }
      lastPhotoCount.current = count;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [eventId, filter, addToast]);

  useEffect(() => {
    setLoading(true);
    fetchPhotos();
  }, [fetchPhotos]);

  useEffect(() => {
    if (selectMode) return; // pause polling while selecting
    const interval = setInterval(() => fetchPhotos(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPhotos, selectMode]);

  // ── Single action ────────────────────────────────────────────────────
  const handleAction = async (photoId: string, action: string) => {
    if (!eventId) return;
    setActionInProgress(photoId + ':' + action);
    setActionError(null);
    try {
      const data: any = {};
      if (action === 'approve') data.status = 'APPROVED';
      if (action === 'reject') data.status = 'REJECTED';
      if (action === 'hide') data.hidden = true;
      if (action === 'unhide') data.hidden = false;

      const res = await api.moderatePhoto(eventId, photoId, data);

      setPhotos((prev) =>
        prev.map((p) => {
          if (p.id !== photoId) return p;
          return {
            ...p,
            status: res.photo.status ?? p.status,
            hidden: res.photo.hidden ?? p.hidden,
            capturedAt: res.photo.capturedAt ?? p.capturedAt,
            thumbUrl: res.photo.thumbUrl ?? p.thumbUrl,
            largeUrl: res.photo.largeUrl ?? p.largeUrl,
            guestName: res.photo.guestName ?? p.guestName,
          };
        })
      );
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Action failed. Please try again.');
    } finally {
      setActionInProgress(null);
    }
  };

  // ── Bulk action ──────────────────────────────────────────────────────
  const handleBulkAction = async (action: string) => {
    if (!eventId || selected.size === 0) return;

    if (action === 'delete') {
      const ok = confirm(`Permanently delete ${selected.size} photo${selected.size > 1 ? 's' : ''}? This cannot be undone.`);
      if (!ok) return;
    }

    setBulkLoading(true);
    setActionError(null);
    try {
      const ids = Array.from(selected);
      const res = await api.bulkModeratePhotos(eventId, ids, action);

      if (action === 'delete') {
        setPhotos((prev) => prev.filter((p) => !selected.has(p.id)));
      } else {
        const updateData: any = {};
        if (action === 'approve') updateData.status = 'APPROVED';
        if (action === 'reject') updateData.status = 'REJECTED';
        if (action === 'hide') updateData.hidden = true;
        if (action === 'unhide') updateData.hidden = false;

        setPhotos((prev) =>
          prev.map((p) => (selected.has(p.id) ? { ...p, ...updateData } : p))
        );
      }

      addToast({
        type: 'success',
        message: `${res.affected} photo${res.affected > 1 ? 's' : ''} ${action === 'delete' ? 'deleted' : action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'hide' ? 'hidden' : 'shown'} successfully`,
        duration: 3000,
      });

      exitSelectMode();
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Bulk action failed. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  // ── Filters ──────────────────────────────────────────────────────────
  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'low-quality', label: 'Low Quality' },
    { value: 'hidden', label: 'Hidden' },
    { value: 'rejected', label: 'Rejected' },
  ];

  const selectedCount = selected.size;
  const allSelected = photos.length > 0 && selectedCount === photos.length;

  return (
    <Layout title="Moderation" showBack backTo={`/host/events/${eventId}`}>
      {/* Error banner */}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="ml-auto text-red-500 hover:text-red-700 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Bulk action bar (sticky) ──────────────────────────────── */}
      {selectMode && (
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 bg-pine-800 text-white flex items-center gap-2 flex-wrap shadow-lg rounded-b-xl">
          {/* Left: count + select-all */}
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-sm font-medium hover:bg-white/10 px-2 py-1 rounded-lg transition-colors"
          >
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-sm font-medium opacity-90">
            {selectedCount} selected
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleBulkAction('approve')}
              disabled={bulkLoading || selectedCount === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500 hover:bg-green-400 disabled:opacity-40 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => handleBulkAction('reject')}
              disabled={bulkLoading || selectedCount === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-400 disabled:opacity-40 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
            <button
              onClick={() => handleBulkAction('hide')}
              disabled={bulkLoading || selectedCount === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 disabled:opacity-40 transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5" /> Hide
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={bulkLoading || selectedCount === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>

          {/* Close / loading */}
          {bulkLoading ? (
            <Loader className="w-5 h-5 animate-spin ml-1" />
          ) : (
            <button
              onClick={exitSelectMode}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors ml-1"
              title="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* ── Filter bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setFilter(opt.value); exitSelectMode(); }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === opt.value
                ? 'bg-pine-800 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          {!selectMode && photos.length > 0 && (
            <button
              onClick={() => setSelectMode(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
              title="Select multiple"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => { setLoading(true); fetchPhotos(); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-pine-800 border-t-transparent" />
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No photos to moderate</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo) => {
            const isActing = actionInProgress?.startsWith(photo.id + ':');
            const isSelected = selected.has(photo.id);

            return (
              <div
                key={photo.id}
                className={`card p-0 overflow-hidden transition-all duration-200 ${
                  isActing ? 'opacity-60 pointer-events-none' : ''
                } ${isSelected ? 'ring-3 ring-gold-300 ring-offset-2' : ''}`}
                onClick={selectMode ? () => toggleSelect(photo.id) : undefined}
              >
                <div className="aspect-square bg-gray-100 relative">
                  {/* Select checkbox overlay */}
                  {selectMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(photo.id); }}
                      className="absolute top-3 right-3 z-20 w-7 h-7 flex items-center justify-center"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-6 h-6 text-gold-300 drop-shadow-md" />
                      ) : (
                        <Square className="w-6 h-6 text-white drop-shadow-md" />
                      )}
                    </button>
                  )}

                  <img
                    src={photo.thumbUrl}
                    alt=""
                    className={`w-full h-full object-cover cursor-pointer ${photo.hidden ? 'opacity-40 grayscale' : ''}`}
                    loading="lazy"
                    onClick={(e) => {
                      if (!selectMode) {
                        e.stopPropagation();
                        setLightboxPhoto(photo);
                      }
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                      (e.target as HTMLImageElement).classList.add('bg-gray-200');
                    }}
                  />

                  {/* Status badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[calc(100%-3.5rem)]">
                    {photo.status === 'PENDING' && (
                      <span className="badge-warning">Pending</span>
                    )}
                    {photo.status === 'APPROVED' && (
                      <span className="badge-success">Approved</span>
                    )}
                    {photo.status === 'REJECTED' && (
                      <span className="badge-danger">Rejected</span>
                    )}
                    {photo.hidden && (
                      <span className="badge bg-gray-800 text-white">Hidden</span>
                    )}
                  </div>

                  {/* Quality score (only when NOT in select mode to avoid overlap) */}
                  {!selectMode && photo.qualityScore !== null && photo.qualityScore !== undefined && (
                    <div className="absolute top-3 right-3">
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm ${
                          photo.qualityScore >= 70
                            ? 'bg-green-500 text-white'
                            : photo.qualityScore >= 40
                              ? 'bg-yellow-500 text-white'
                              : 'bg-red-500 text-white'
                        }`}
                        title={photo.qualityIssues || 'No issues detected'}
                      >
                        {photo.qualityScore >= 70 ? (
                          <Star className="w-3 h-3" />
                        ) : photo.qualityScore < 40 ? (
                          <AlertOctagon className="w-3 h-3" />
                        ) : null}
                        {photo.qualityScore}
                      </div>
                    </div>
                  )}

                  {/* Loading spinner overlay */}
                  {isActing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
                    </div>
                  )}
                </div>

                {/* Card info — hide individual actions when in select mode */}
                {!selectMode && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-600">
                        {photo.guestName || 'Anonymous'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(photo.capturedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Quality issues */}
                    {photo.qualityIssues && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {photo.qualityIssues.split(', ').map((issue: string) => (
                          <span
                            key={issue}
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100"
                          >
                            <AlertOctagon className="w-2.5 h-2.5" />
                            {issue}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Title/description */}
                    {(photo.title || photo.description) && (
                      <div className="mb-3 text-sm">
                        {photo.title && (
                          <p className="font-medium text-gray-800">{photo.title}</p>
                        )}
                        {photo.description && (
                          <p className="text-gray-500 line-clamp-2">{photo.description}</p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      {photo.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleAction(photo.id, 'approve')}
                            disabled={!!isActing}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" /> Approve
                          </button>
                          <button
                            onClick={() => handleAction(photo.id, 'reject')}
                            disabled={!!isActing}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleAction(photo.id, photo.hidden ? 'unhide' : 'hide')}
                        disabled={!!isActing}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                          photo.hidden
                            ? 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        {photo.hidden ? (
                          <><Eye className="w-4 h-4" /> Show</>
                        ) : (
                          <><EyeOff className="w-4 h-4" /> Hide</>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Compact info in select mode */}
                {selectMode && (
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500 truncate">
                      {photo.guestName || 'Anonymous'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(photo.capturedAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* ── Lightbox modal ─────────────────────────────────────── */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setLightboxPhoto(null)}
        >
          {/* Top bar */}
          <div className="flex-shrink-0 flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-medium">
                {lightboxPhoto.guestName || 'Anonymous'}
              </span>
              {lightboxPhoto.status === 'PENDING' && (
                <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">Pending</span>
              )}
              {lightboxPhoto.status === 'APPROVED' && (
                <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">Approved</span>
              )}
              {lightboxPhoto.status === 'REJECTED' && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">Rejected</span>
              )}
              {lightboxPhoto.hidden && (
                <span className="bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">Hidden</span>
              )}
            </div>
            <button
              onClick={() => setLightboxPhoto(null)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center min-h-0 p-4">
            <img
              src={lightboxPhoto.largeUrl || lightboxPhoto.thumbUrl}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Bottom bar — quick actions */}
          <div className="flex-shrink-0 p-4 flex items-center justify-center gap-3">
            {lightboxPhoto.status === 'PENDING' && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(lightboxPhoto.id, 'approve');
                    setLightboxPhoto((prev: any) => prev ? { ...prev, status: 'APPROVED' } : null);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-white text-sm font-semibold transition-colors"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(lightboxPhoto.id, 'reject');
                    setLightboxPhoto((prev: any) => prev ? { ...prev, status: 'REJECTED' } : null);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const act = lightboxPhoto.hidden ? 'unhide' : 'hide';
                handleAction(lightboxPhoto.id, act);
                setLightboxPhoto((prev: any) => prev ? { ...prev, hidden: !prev.hidden } : null);
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
            >
              {lightboxPhoto.hidden ? (
                <><Eye className="w-4 h-4" /> Show</>
              ) : (
                <><EyeOff className="w-4 h-4" /> Hide</>
              )}
            </button>
          </div>

          {/* Title/description overlay */}
          {(lightboxPhoto.title || lightboxPhoto.description) && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur rounded-xl px-4 py-2 max-w-md text-center" onClick={(e) => e.stopPropagation()}>
              {lightboxPhoto.title && (
                <p className="text-white text-sm font-medium">{lightboxPhoto.title}</p>
              )}
              {lightboxPhoto.description && (
                <p className="text-white/70 text-xs mt-0.5">{lightboxPhoto.description}</p>
              )}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
