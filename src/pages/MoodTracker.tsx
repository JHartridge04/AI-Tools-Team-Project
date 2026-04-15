import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addMoodEntry, getMoodTrend, getMoodEntries } from '../services/moodService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import EmptyState from '../components/common/EmptyState';
import { MoodEntry, WithId } from '../types';

const availableTags = [
  'anxious', 'calm', 'hopeful', 'tired', 'grateful',
  'stressed', 'energized', 'sad', 'content', 'restless',
];

interface MoodPoint {
  date: string;
  averageScore: number;
}

const MoodTracker: React.FC = () => {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [score, setScore] = useState<number>(5);
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [submitError, setSubmitError] = useState('');

  const [trend, setTrend] = useState<MoodPoint[]>([]);
  const [entries, setEntries] = useState<WithId<MoodEntry>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const fetchData = async () => {
    if (!uid) return;
    setLoading(true);
    setLoadError('');

    const [trendRes, entriesRes] = await Promise.all([
      getMoodTrend(uid, 30),
      getMoodEntries(uid),
    ]);

    if (trendRes.success) setTrend(trendRes.data);
    if (entriesRes.success) setEntries(entriesRes.data);
    if (!trendRes.success && !entriesRes.success) {
      setLoadError('Failed to load mood data.');
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [uid]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!uid) return;
    setSubmitting(true);
    setSubmitError('');
    setSuccessMsg('');

    const result = await addMoodEntry(uid, score, note || undefined, selectedTags, 'manual');

    if (result.success) {
      setSuccessMsg('Mood logged successfully!');
      setNote('');
      setSelectedTags([]);
      setScore(5);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchData(); // Refresh data
    } else {
      setSubmitError(result.error);
    }

    setSubmitting(false);
  };

  const moodColor = (val: number) => {
    const hue = (val / 10) * 120;
    return `hsl(${hue}, 60%, 55%)`;
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Mood Tracker</h1>

      {/* Mood Input */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>How are you feeling?</h3>

        {/* Score selector */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Low</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>High</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setScore(n)}
                style={{
                  flex: 1,
                  padding: '0.6rem 0',
                  borderRadius: 8,
                  border: score === n ? `2px solid ${moodColor(n)}` : '2px solid var(--border)',
                  background: score === n ? moodColor(n) : 'var(--card-bg)',
                  color: score === n ? '#fff' : 'var(--text)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  transition: 'all 0.15s',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Note (optional)
          </label>
          <textarea
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Tags */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Tags
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: 999,
                  border: '1px solid',
                  borderColor: selectedTags.includes(tag) ? 'var(--primary)' : 'var(--border)',
                  background: selectedTags.includes(tag) ? 'var(--primary-bg)' : 'transparent',
                  color: selectedTags.includes(tag) ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {submitError && <ErrorMessage error={submitError} />}
        {successMsg && (
          <div style={{
            background: 'var(--success-bg)',
            color: 'var(--success)',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            marginBottom: '0.75rem',
            fontSize: '0.9rem',
          }}>
            {successMsg}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
          style={{ width: '100%' }}
        >
          {submitting ? 'Logging...' : 'Log Mood'}
        </button>
      </div>

      {/* Mood History */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>30-Day Mood Trend</h3>

        {loading ? (
          <LoadingSpinner />
        ) : loadError ? (
          <ErrorMessage error={loadError} />
        ) : trend.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.3rem', height: 160, minWidth: trend.length * 28 }}>
              {trend.map((point) => {
                const heightPct = (point.averageScore / 10) * 100;
                return (
                  <div
                    key={point.date}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      minWidth: 24,
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {point.averageScore.toFixed(1)}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: 24,
                        height: `${heightPct}%`,
                        minHeight: 4,
                        borderRadius: '3px 3px 0 0',
                        background: moodColor(point.averageScore),
                        transition: 'height 0.3s',
                      }}
                    />
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {point.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
            No mood data to display yet.
          </p>
        )}
      </div>

      {/* Recent Entries */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Recent Entries</h3>

        {loading ? (
          <LoadingSpinner />
        ) : entries.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 400, overflowY: 'auto' }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: moodColor(entry.data.score),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    flexShrink: 0,
                  }}
                >
                  {entry.data.score}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {entry.data.createdAt?.toDate?.()
                      ? entry.data.createdAt.toDate().toLocaleString()
                      : 'Unknown date'}
                  </div>
                  {entry.data.note && (
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>{entry.data.note}</p>
                  )}
                  {entry.data.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {entry.data.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: 999,
                            background: 'var(--primary-bg)',
                            color: 'var(--primary)',
                            fontSize: '0.75rem',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No mood entries yet. Log your first mood above!" />
        )}
      </div>
    </div>
  );
};

export default MoodTracker;
