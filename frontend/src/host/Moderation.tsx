import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { api } from '../api/client';
import {
  CheckCircle,
  XCircle,
  EyeOff,
  Eye,
  AlertTriangle,
  AlertOctagon,
  Trash2,
  CheckSquare,
  Square,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Radio,
} from 'lucide-react';

const POLL_INTERVAL = 10_000;

// ── Quality score badge colours ──────────────────────────────────────────────
function qualityBadgeClass(score: number): string {
  if (score >= 70) return 'bg-primary/20 text-primary';
  if (score >= 40) return 'bg-secondary/20 text-secondary';
  return 'bg-error/20 text-error';
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, hidden }: { status: string; hidden: boolean }) {
  if (hidden)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-surface-bright text-on-surface-variant">
        Hidden
      </span>
    );
  if (status === 'PENDING')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-secondary/15 text-secondary">
        Pending
      </span>
    );
  if (status === 'APPROVED')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-primary/15 text-primary">
        Approved
      </span>
    );
  if (status === 'REJECTED')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-error/15 text-error">
        Rejected
      </span>
    );
  return null;
}

export default function Moderation() {
  const { eventId } = useParams<{ eventId: string }>();
  const { addToast } = useToast();
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Multi-select state ───────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // ── Lightbox state ──────────────────────────────────────────────────────
  const [lightboxPhoto, setLightboxPhoto] = useState<any | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  // ── Live feed hover ─────────────────────────────────────────────────────
  const [liveFeedHover, setLiveFeedHover] = useState(false);

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

  // ── Fetch ────────────────────────────────────────────────────────────────
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

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [eventId, filter]);

  useEffect(() => {
    setLoading(true);
    fetchPhotos();
  }, [fetchPhotos]);

  useEffect(() => {
    if (selectMode) return;
    const interval = setInterval(() => fetchPhotos(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPhotos, selectMode]);

  // ── Single action ────────────────────────────────────────────────────────
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

  // ── Bulk action ──────────────────────────────────────────────────────────
  const handleBulkAction = async (action: string) => {
    if (!eventId || selected.size === 0) return;

    if (action === 'delete') {
      const ok = confirm(
        `Permanently delete ${selected.size} photo${selected.size > 1 ? 's' : ''}? This cannot be undone.`
      );
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
        message: `${res.affected} photo${res.affected > 1 ? 's' : ''} ${
          action === 'delete'
            ? 'deleted'
            : action === 'approve'
            ? 'approved'
            : action === 'reject'
            ? 'rejected'
            : action === 'hide'
            ? 'hidden'
            : 'shown'
        } successfully`,
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

  // ── Filter options ───────────────────────────────────────────────────────
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

  // ── Lightbox navigation ──────────────────────────────────────────────────
  const openLightbox = (photo: any) => {
    const idx = photos.findIndex((p) => p.id === photo.id);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxPhoto(photo);
  };

  const lightboxNavigate = (dir: 1 | -1) => {
    const newIdx = lightboxIndex + dir;
    if (newIdx < 0 || newIdx >= photos.length) return;
    setLightboxIndex(newIdx);
    setLightboxPhoto(photos[newIdx]);
  };

  return (
    <Layout title="Moderation" subtitle="PHOTO REVIEW" showBack backTo={`/host/events/${eventId}`}>
      {/* ── Error banner ──────────────────────────────────────────── */}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 bg-error/10 border border-error/20 text-error px-4 py-3 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="ml-auto text-error/70 hover:text-error font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Bulk action bar (sticky) ──────────────────────────────── */}
      {selectMode && (
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6 bg-surface-container-low/90 backdrop-blur-xl border-b border-outline-variant/20 flex items-center gap-3 flex-wrap">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm font-medium text-on-surface hover:text-primary transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-on-surface-variant" />
            )}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-sm font-medium text-on-surface-variant">
            {selectedCount} selected
          </span>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('approve')}
              disabled={bulkLoading || selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-primary to-primary-dim text-white disabled:opacity-40 transition-all hover:opacity-90"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => handleBulkAction('reject')}
              disabled={bulkLoading || selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-error/15 text-error hover:bg-error/25 disabled:opacity-40 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
            <button
              onClick={() => handleBulkAction('hide')}
              disabled={bulkLoading || selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-surface-bright text-on-surface-variant hover:text-on-surface disabled:opacity-40 transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5" /> Hide
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={bulkLoading || selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-error/15 text-error hover:bg-error/25 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>

          {bulkLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary ml-1" />
          ) : (
            <button
              onClick={exitSelectMode}
              className="w-8 h-8 flex items-center justify-center hover:bg-surface-bright rounded-full transition-colors ml-1 text-on-surface-variant"
              title="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* ── Filter pills row ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1 no-scrollbar">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setFilter(opt.value);
              exitSelectMode();
            }}
            className={`px-6 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all ${
              filter === opt.value
                ? 'bg-primary text-on-primary shadow-md shadow-primary/25'
                : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface hover:bg-surface-bright'
            }`}
          >
            {opt.label}
          </button>
        ))}

        {!selectMode && photos.length > 0 && (
          <button
            onClick={() => setSelectMode(true)}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm bg-surface-container-highest text-on-surface-variant hover:text-on-surface hover:bg-surface-bright whitespace-nowrap transition-all"
          >
            <CheckSquare className="w-4 h-4" /> Select
          </button>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-on-surface-variant text-sm">Loading photos…</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-highest flex items-center justify-center">
            <Eye className="w-8 h-8 text-on-surface-variant/40" />
          </div>
          <p className="text-on-surface font-headline font-bold text-lg">No photos to review</p>
          <p className="text-on-surface-variant text-sm">
            {filter === 'all'
              ? 'Photos will appear here once guests start uploading.'
              : `No photos match the "${filterOptions.find((f) => f.value === filter)?.label}" filter.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {photos.map((photo) => {
            const isActing = actionInProgress?.startsWith(photo.id + ':');
            const isSelected = selected.has(photo.id);

            return (
              <div
                key={photo.id}
                className={`bg-surface-container-low rounded-xl overflow-hidden transition-all duration-200 hover:ring-1 hover:ring-primary/30 cursor-pointer ${
                  isActing ? 'opacity-60 pointer-events-none' : ''
                } ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''}`}
                onClick={selectMode ? () => toggleSelect(photo.id) : undefined}
              >
                {/* ── Image area ────────────────────────────────── */}
                <div className="aspect-square bg-surface-container-highest relative overflow-hidden group">
                  <img
                    src={photo.thumbUrl}
                    alt=""
                    className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                      photo.hidden ? 'grayscale opacity-50' : ''
                    }`}
                    loading="lazy"
                    onClick={(e) => {
                      if (!selectMode) {
                        e.stopPropagation();
                        openLightbox(photo);
                      }
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />

                  {/* Hidden overlay */}
                  {photo.hidden && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <EyeOff className="w-8 h-8 text-white/60" />
                    </div>
                  )}

                  {/* Top-left: select checkbox OR status badge */}
                  <div className="absolute top-3 left-3 z-10">
                    {selectMode ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(photo.id);
                        }}
                        className="w-7 h-7 flex items-center justify-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-6 h-6 text-primary drop-shadow-lg" />
                        ) : (
                          <Square className="w-6 h-6 text-white drop-shadow-lg" />
                        )}
                      </button>
                    ) : (
                      <StatusBadge status={photo.status} hidden={photo.hidden} />
                    )}
                  </div>

                  {/* Top-right: quality score pill */}
                  {!selectMode &&
                    photo.qualityScore !== null &&
                    photo.qualityScore !== undefined && (
                      <div className="absolute top-3 right-3 z-10">
                        <span
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm ${qualityBadgeClass(
                            photo.qualityScore
                          )}`}
                        >
                          {photo.qualityScore >= 70 ? null : photo.qualityScore < 40 ? (
                            <AlertOctagon className="w-2.5 h-2.5" />
                          ) : null}
                          {photo.qualityScore}
                        </span>
                      </div>
                    )}

                  {/* Bottom: quality issue tags */}
                  {!selectMode && photo.qualityIssues && (
                    <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-wrap gap-1">
                      {photo.qualityIssues
                        .split(', ')
                        .slice(0, 3)
                        .map((issue: string) => (
                          <span
                            key={issue}
                            className="px-2 py-0.5 bg-black/40 backdrop-blur-sm rounded text-[9px] text-white border border-white/10 uppercase tracking-tighter"
                          >
                            {issue}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Acting spinner */}
                  {isActing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                    </div>
                  )}
                </div>

                {/* ── Card body ─────────────────────────────────── */}
                {!selectMode && (
                  <div className="p-5">
                    {/* Name row */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-headline font-bold text-on-surface text-sm leading-tight">
                          {photo.guestName || 'Anonymous'}
                        </p>
                        <p className="text-on-surface-variant text-xs mt-0.5">
                          {new Date(photo.capturedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => openLightbox(photo)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      {photo.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleAction(photo.id, 'approve')}
                            disabled={!!isActing}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-primary to-primary-dim text-white disabled:opacity-50 transition-all hover:opacity-90"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handleAction(photo.id, 'reject')}
                            disabled={!!isActing}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-error/15 text-error hover:bg-error/25 disabled:opacity-50 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}

                      {photo.status === 'APPROVED' && (
                        <button
                          onClick={() =>
                            handleAction(photo.id, photo.hidden ? 'unhide' : 'hide')
                          }
                          disabled={!!isActing}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-surface-bright text-on-surface-variant hover:text-on-surface disabled:opacity-50 transition-colors"
                        >
                          {photo.hidden ? (
                            <><Eye className="w-3.5 h-3.5" /> Show</>
                          ) : (
                            <><EyeOff className="w-3.5 h-3.5" /> Hide</>
                          )}
                        </button>
                      )}

                      {photo.status === 'REJECTED' && (
                        <button
                          onClick={() => handleAction(photo.id, 'approve')}
                          disabled={!!isActing}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Restore
                        </button>
                      )}

                      {/* Hide/show toggle for non-pending */}
                      {photo.status !== 'PENDING' && photo.status !== 'APPROVED' && (
                        <button
                          onClick={() =>
                            handleAction(photo.id, photo.hidden ? 'unhide' : 'hide')
                          }
                          disabled={!!isActing}
                          className="w-9 flex items-center justify-center rounded-lg text-xs bg-surface-bright text-on-surface-variant hover:text-on-surface disabled:opacity-50 transition-colors"
                        >
                          {photo.hidden ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Compact row in select mode */}
                {selectMode && (
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-on-surface truncate">
                      {photo.guestName || 'Anonymous'}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {new Date(photo.capturedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Floating Live Feed button ─────────────────────────────── */}
      <button
        onMouseEnter={() => setLiveFeedHover(true)}
        onMouseLeave={() => setLiveFeedHover(false)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-secondary text-white font-bold text-sm shadow-xl shadow-secondary/30 hover:bg-secondary/90 transition-all"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        <Radio className="w-4 h-4" />
        {liveFeedHover && <span className="whitespace-nowrap">Live Feed Active</span>}
      </button>

      {/* ── Lightbox ─────────────────────────────────────────────── */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={() => setLightboxPhoto(null)}
        >
          {/* Top bar */}
          <div
            className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <p className="text-white font-headline font-bold text-sm">
                {lightboxPhoto.guestName || 'Anonymous'}
              </p>
              <StatusBadge status={lightboxPhoto.status} hidden={lightboxPhoto.hidden} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant text-xs">
                {lightboxIndex + 1} / {photos.length}
              </span>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Image + arrows */}
          <div className="flex-1 flex items-center justify-center min-h-0 relative px-16">
            {lightboxIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxNavigate(-1);
                }}
                className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={lightboxPhoto.largeUrl || lightboxPhoto.thumbUrl}
              alt=""
              className={`max-w-full max-h-full object-contain rounded-xl ${
                lightboxPhoto.hidden ? 'grayscale opacity-60' : ''
              }`}
              onClick={(e) => e.stopPropagation()}
            />

            {lightboxIndex < photos.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  lightboxNavigate(1);
                }}
                className="absolute right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom action bar */}
          <div
            className="flex-shrink-0 px-6 py-4 bg-black/40 backdrop-blur-sm flex items-center justify-center gap-3 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxPhoto.status === 'PENDING' && (
              <>
                <button
                  onClick={() => {
                    handleAction(lightboxPhoto.id, 'approve');
                    setLightboxPhoto((prev: any) =>
                      prev ? { ...prev, status: 'APPROVED' } : null
                    );
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-dim text-white text-sm font-bold transition-all hover:opacity-90"
                >
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button
                  onClick={() => {
                    handleAction(lightboxPhoto.id, 'reject');
                    setLightboxPhoto((prev: any) =>
                      prev ? { ...prev, status: 'REJECTED' } : null
                    );
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-error/20 text-error hover:bg-error/30 text-sm font-bold transition-colors"
                >
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </>
            )}

            {lightboxPhoto.status === 'REJECTED' && (
              <button
                onClick={() => {
                  handleAction(lightboxPhoto.id, 'approve');
                  setLightboxPhoto((prev: any) =>
                    prev ? { ...prev, status: 'APPROVED' } : null
                  );
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 text-sm font-bold transition-colors"
              >
                <CheckCircle className="w-4 h-4" /> Restore
              </button>
            )}

            <button
              onClick={() => {
                const act = lightboxPhoto.hidden ? 'unhide' : 'hide';
                handleAction(lightboxPhoto.id, act);
                setLightboxPhoto((prev: any) =>
                  prev ? { ...prev, hidden: !prev.hidden } : null
                );
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
            >
              {lightboxPhoto.hidden ? (
                <><Eye className="w-4 h-4" /> Show</>
              ) : (
                <><EyeOff className="w-4 h-4" /> Hide</>
              )}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
