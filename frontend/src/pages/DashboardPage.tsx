import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, FileText, Trash2, Plus, Loader2 } from 'lucide-react';
import { getTranscripts, deleteTranscript, type TranscriptListItem } from '../services/api';
import './DashboardPage.css';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed': return 'badge badge-completed';
    case 'processing': return 'badge badge-processing';
    case 'pending': return 'badge badge-pending';
    case 'failed': return 'badge badge-failed';
    default: return 'badge';
  }
}

export function DashboardPage() {
  const [transcripts, setTranscripts] = useState<TranscriptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadTranscripts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTranscripts();
      setTranscripts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transcripts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTranscripts();
  }, [loadTranscripts]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this transcript?')) return;

    setDeletingId(id);
    try {
      await deleteTranscript(id);
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transcript');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpen = (transcript: TranscriptListItem) => {
    if (transcript.status === 'completed') {
      navigate(`/editor/${transcript.id}`);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard__loading">
          <Loader2 size={32} className="animate-spin" />
          <p>Loading your transcripts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h2>Your Transcripts</h2>
          <p className="text-secondary">{transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          <Plus size={18} />
          New Transcript
        </button>
      </div>

      {error && (
        <div className="dashboard__error">
          <p className="text-error">{error}</p>
          <button className="btn btn-secondary" onClick={loadTranscripts}>Retry</button>
        </div>
      )}

      {transcripts.length === 0 ? (
        <div className="dashboard__empty glass-card">
          <div className="dashboard__empty-icon">
            <FileText size={48} />
          </div>
          <h3>No transcripts yet</h3>
          <p className="text-secondary">
            Upload an audio file to get started with your first transcription.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            <Plus size={18} />
            Upload Audio
          </button>
        </div>
      ) : (
        <div className="dashboard__grid">
          {transcripts.map((transcript) => (
            <div
              key={transcript.id}
              className={`dashboard__card glass-card ${transcript.status === 'completed' ? 'dashboard__card--clickable' : ''}`}
              onClick={() => handleOpen(transcript)}
            >
              <div className="dashboard__card-header">
                <div className="dashboard__card-icon">
                  <FileText size={20} />
                </div>
                <span className={getStatusBadgeClass(transcript.status)}>
                  {transcript.status}
                </span>
              </div>

              <h3 className="dashboard__card-title" title={transcript.filename}>
                {transcript.filename}
              </h3>

              <div className="dashboard__card-meta">
                <span className="dashboard__card-meta-item">
                  <Clock size={14} />
                  {formatDuration(transcript.duration)}
                </span>
                {transcript.num_speakers > 0 && (
                  <span className="dashboard__card-meta-item">
                    {transcript.num_speakers} speaker{transcript.num_speakers !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="dashboard__card-footer">
                <span className="dashboard__card-date">{formatDate(transcript.created_at)}</span>
                <button
                  className="btn btn-ghost btn-icon dashboard__card-delete"
                  onClick={(e) => handleDelete(e, transcript.id)}
                  disabled={deletingId === transcript.id}
                  title="Delete transcript"
                >
                  {deletingId === transcript.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
