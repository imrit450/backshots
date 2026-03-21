import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';
import {
  Download,
  FileArchive,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  Inbox,
} from 'lucide-react';

export default function ExportPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [exports, setExports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchExports = async () => {
    if (!eventId) return;
    try {
      const data = await api.getExports(eventId);
      setExports(data.exports);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExports();
  }, [eventId]);

  // Poll while any export is processing
  useEffect(() => {
    const processing = exports.filter((e) => e.status === 'PROCESSING');
    if (processing.length === 0) return;

    const interval = setInterval(fetchExports, 3000);
    return () => clearInterval(interval);
  }, [exports]);

  const handleCreateExport = async () => {
    if (!eventId) return;
    setCreating(true);
    try {
      await api.createExport(eventId);
      await fetchExports();
    } catch (err: any) {
      alert(err.message || 'Failed to create export');
    } finally {
      setCreating(false);
    }
  };

  const isProcessing = exports.some((e) => e.status === 'PROCESSING');

  // ── Status badge helper ────────────────────────────────────────────────
  function statusBadge(status: string) {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
            Completed
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-error/10 text-error">
            Failed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface-container-highest text-on-surface-variant">
            Pending
          </span>
        );
    }
  }

  return (
    <Layout title="Export" subtitle="MEDIA EXPORT" showBack backTo={`/host/events/${eventId}`}>
      <div className="max-w-2xl mx-auto">
        {/* ── Hero card ─────────────────────────────────────────────── */}
        <div className="bg-surface-container-low rounded-xl p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            <div className="flex-1 min-w-0">
              <h2 className="font-headline text-2xl font-bold text-on-surface leading-tight mb-2">
                Export Media Vault
              </h2>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Bundle all approved photos into a single ZIP archive for download. Large events
                may take a few moments to prepare.
              </p>

              {isProcessing && (
                <div className="mt-4 flex items-center gap-2 text-secondary text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing your export bundle…
                </div>
              )}
            </div>

            <button
              onClick={handleCreateExport}
              disabled={creating}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-dim text-white font-bold text-sm shadow-lg shadow-primary/25 hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {creating ? 'Creating…' : 'Generate New Bundle'}
            </button>
          </div>
        </div>

        {/* ── Exports list card ─────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="text-on-surface-variant text-sm">Loading exports…</p>
          </div>
        ) : exports.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl p-12 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center">
              <Inbox className="w-7 h-7 text-on-surface-variant/40" />
            </div>
            <div className="text-center">
              <p className="text-on-surface font-headline font-bold text-base">No exports yet</p>
              <p className="text-on-surface-variant text-sm mt-1">
                Generate a bundle above to download your photos.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-xl overflow-hidden">
            {/* List header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
              <p className="text-on-surface font-headline font-bold text-sm">
                Export History
              </p>
              <button className="w-8 h-8 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-bright transition-colors">
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Export rows */}
            {exports.map((exp, index) => (
              <div
                key={exp.id}
                className={`flex items-center gap-5 px-5 py-5 transition-colors hover:bg-surface-bright/30 ${
                  index < exports.length - 1 ? 'border-b border-outline-variant/10' : ''
                }`}
              >
                {/* File icon */}
                <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary flex-shrink-0">
                  <FileArchive className="w-5 h-5" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-on-surface font-bold text-sm leading-tight">
                    Export #{exports.length - index}
                  </p>
                  <p className="text-on-surface-variant text-xs mt-0.5">
                    {exp.photoCount ?? '—'} photo{exp.photoCount !== 1 ? 's' : ''} ·{' '}
                    {new Date(exp.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Status + download */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {statusBadge(exp.status)}

                  {exp.status === 'COMPLETED' && exp.fileUrl && (
                    <a
                      href={exp.fileUrl}
                      download
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title="Download ZIP"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
