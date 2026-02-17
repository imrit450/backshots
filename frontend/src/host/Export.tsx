import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api/client';
import { Download, Package, Clock, CheckCircle, AlertCircle } from 'lucide-react';

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

  // Poll processing exports
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

  const statusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'PROCESSING':
        return <Clock className="w-5 h-5 text-yellow-500 animate-spin" />;
      case 'FAILED':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <Layout title="Export" showBack backTo={`/host/events/${eventId}`}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Export Photos</h1>
            <p className="text-sm text-gray-500 mt-1">
              Download all approved photos as a ZIP file
            </p>
          </div>
          <button
            onClick={handleCreateExport}
            disabled={creating}
            className="btn-primary flex items-center gap-2"
          >
            <Package className="w-5 h-5" />
            {creating ? 'Creating...' : 'New Export'}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-pine-800 border-t-transparent" />
          </div>
        ) : exports.length === 0 ? (
          <div className="text-center py-16 card">
            <Download className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No exports yet. Create one to download your photos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {exports.map((exp) => (
              <div key={exp.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon(exp.status)}
                  <div>
                    <div className="font-medium text-gray-900">
                      {exp.photoCount} photos
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(exp.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      exp.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : exp.status === 'PROCESSING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : exp.status === 'FAILED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {exp.status}
                  </span>
                  {exp.status === 'COMPLETED' && exp.fileUrl && (
                    <a
                      href={exp.fileUrl}
                      download
                      className="btn-primary py-2 px-4 text-sm flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      Download
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
