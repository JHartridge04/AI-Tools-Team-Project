import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserSessions, createSession } from '../services/sessionService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import EmptyState from '../components/common/EmptyState';
import { Session, SessionType, WithId } from '../types';

const sessionTypeIcons: Record<string, string> = {
  therapy: '🧠',
  dream_visualization: '🌙',
  journal: '📝',
  meditation: '🧘',
};

const filterTabs: { label: string; value: SessionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Therapy', value: 'therapy' },
  { label: 'Dreams', value: 'dream_visualization' },
  { label: 'Journal', value: 'journal' },
  { label: 'Meditation', value: 'meditation' },
];

const SessionHistory: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const uid = currentUser?.uid;

  const [sessions, setSessions] = useState<WithId<Session>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<SessionType | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!uid) return;

    const fetchSessions = async () => {
      setLoading(true);
      setError('');

      const result = await getUserSessions(uid, 50);

      if (result.success) {
        setSessions(result.data);
      } else {
        setError(result.error);
      }

      setLoading(false);
    };

    fetchSessions();
  }, [uid]);

  const filtered = filter === 'all'
    ? sessions
    : sessions.filter((s) => s.data.sessionType === filter);

  /**
   * Creates a new session matching the active filter tab and navigates to it.
   * all/therapy  → therapy session  → /sessions/:id
   * dream_visualization → dream_visualization → /dream/:id
   * journal      → journal session  → /sessions/:id  (uses chat UI)
   * meditation   → meditation session → /dream/:id   (uses visualization UI)
   */
  const handleNewSession = async () => {
    if (!uid || creating) return;
    setCreating(true);
    setCreateError('');

    const sessionType: SessionType =
      filter === 'dream_visualization' ? 'dream_visualization'
      : filter === 'journal'           ? 'journal'
      : filter === 'meditation'        ? 'meditation'
      : 'therapy';

    const usesVizPage = sessionType === 'dream_visualization' || sessionType === 'meditation';

    const result = await createSession(uid, sessionType);
    if (result.success) {
      navigate(usesVizPage ? `/dream/${result.data}` : `/sessions/${result.data}`);
    } else {
      setCreateError(result.error);
      setCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Session History</h1>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '0.25rem',
      }}>
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 999,
              border: '1px solid',
              borderColor: filter === tab.value ? 'var(--primary)' : 'var(--border)',
              background: filter === tab.value ? 'var(--primary)' : 'var(--card-bg)',
              color: filter === tab.value ? '#fff' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Session List */}
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage error={error} />
      ) : filtered.length > 0 ? (
        <>
          {createError && (
            <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              {createError}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/session/${s.id}`)}
              className="card"
              style={{
                cursor: 'pointer',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow)')}
            >
              <span style={{ fontSize: '1.5rem' }}>
                {sessionTypeIcons[s.data.sessionType] || '📄'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: '0.2rem' }}>
                  {s.data.title || 'Untitled Session'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {s.data.sessionType.replace('_', ' ')} &middot;{' '}
                  {s.data.startedAt?.toDate?.()
                    ? s.data.startedAt.toDate().toLocaleDateString()
                    : 'Unknown date'}
                  {s.data.moodBefore != null && s.data.moodAfter != null && (
                    <> &middot; Mood: {s.data.moodBefore} → {s.data.moodAfter}</>
                  )}
                </div>
              </div>
              <span className={`badge badge-${s.data.status}`}>
                {s.data.status}
              </span>
            </div>
          ))}
          </div>
        </>
      ) : (
        <>
          {createError && (
            <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '0.75rem', textAlign: 'center' }}>
              {createError}
            </p>
          )}
          <EmptyState
            message={
              filter === 'all'
                ? 'No sessions yet. Start your first one!'
                : `No ${filter.replace('_', ' ')} sessions found.`
            }
            actionLabel={creating ? 'Starting...' : 'New Session'}
            onAction={handleNewSession}
            actionDisabled={creating}
          />
        </>
      )}
    </div>
  );
};

export default SessionHistory;
