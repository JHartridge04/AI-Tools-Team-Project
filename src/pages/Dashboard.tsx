import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/userService';
import { getMoodTrend } from '../services/moodService';
import { getUserSessions, createSession } from '../services/sessionService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import EmptyState from '../components/common/EmptyState';
import { UserProfile, Session, WithId } from '../types';

const quotes = [
  "Every day is a fresh start. Take a deep breath and begin again.",
  "You are stronger than you think, braver than you believe.",
  "Small steps every day lead to big changes over time.",
  "Be gentle with yourself. You're doing the best you can.",
  "Your mental health is a priority. Your happiness is essential.",
];

const sessionTypeIcons: Record<string, string> = {
  therapy: '🧠',
  dream_visualization: '🌙',
  journal: '📝',
  meditation: '🧘',
};

interface MoodPoint {
  date: string;
  averageScore: number;
}

const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const uid = currentUser?.uid;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [moodTrend, setMoodTrend] = useState<MoodPoint[]>([]);
  const [sessions, setSessions] = useState<WithId<Session>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Prevents double-clicks when creating a new therapy session
  const [creatingSession, setCreatingSession] = useState(false);
  // Prevents double-clicks when creating a new dream visualization session
  const [creatingDream, setCreatingDream] = useState(false);

  useEffect(() => {
    if (!uid) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');

      const [profileRes, moodRes, sessionsRes] = await Promise.all([
        getUserProfile(uid),
        getMoodTrend(uid, 7),
        getUserSessions(uid, 5),
      ]);

      if (profileRes.success) setProfile(profileRes.data);
      if (moodRes.success) setMoodTrend(moodRes.data);
      if (sessionsRes.success) setSessions(sessionsRes.data);

      if (!profileRes.success && !moodRes.success && !sessionsRes.success) {
        setError('Failed to load dashboard data. Please try again.');
      }

      setLoading(false);
    };

    fetchData();
  }, [uid]);

  /**
   * Creates a new dream_visualization session in Firestore and navigates to it.
   * The DreamVisualization page handles all AI interaction from that point.
   * TODO: Alexa — this is your handler. Customize the title or add a mood-before
   * prompt here if you want to collect a pre-session mood score.
   */
  const handleNewDreamSession = async () => {
    if (!uid || creatingDream) return;
    setCreatingDream(true);

    const result = await createSession(uid, 'dream_visualization');

    if (result.success) {
      // Navigate to the new dream visualization session
      navigate(`/dream/${result.data}`);
    } else {
      setError('Failed to start dream visualization. Please try again.');
      setCreatingDream(false);
    }
  };

  /**
   * Creates a new therapy session in Firestore and navigates to it.
   * This kicks off the AI therapist chat — see SessionDetail.tsx for the
   * full AI integration (system prompt, Claude API call, crisis detection).
   */
  const handleNewTherapySession = async () => {
    if (!uid || creatingSession) return;
    setCreatingSession(true);

    const result = await createSession(uid, 'therapy');

    if (result.success) {
      // Navigate to the new session — SessionDetail.tsx handles the rest
      navigate(`/sessions/${result.data}`);
    } else {
      setError('Failed to create session. Please try again.');
      setCreatingSession(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  const displayName = profile?.displayName || currentUser?.displayName || 'there';
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  const today = new Date().toISOString().split('T')[0];
  const todayMood = moodTrend.find((m) => m.date === today);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Greeting */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Welcome back, {displayName}</h1>
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{quote}</p>
      </div>

      {/* Mood at a Glance */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Mood at a Glance</h2>
          <button className="btn btn-secondary" onClick={() => navigate('/mood')}>
            Log Mood
          </button>
        </div>

        {todayMood && (
          <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
            Today's average: <strong style={{ color: 'var(--primary)', fontSize: '1.3rem' }}>{todayMood.averageScore.toFixed(1)}</strong> / 10
          </p>
        )}

        {moodTrend.length > 0 ? (
          <MoodBarChart data={moodTrend} />
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
            No mood data yet. Log your first mood to see trends!
          </p>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Recent Sessions</h2>
          <button className="btn btn-secondary" onClick={() => navigate('/sessions')}>
            View All
          </button>
        </div>

        {sessions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/sessions/${s.id}`)}
                className="card"
                style={{
                  cursor: 'pointer',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  transition: 'box-shadow 0.15s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
              >
                <span style={{ fontSize: '1.5rem' }}>
                  {sessionTypeIcons[s.data.sessionType] || '📄'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{s.data.title || 'Untitled Session'}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {s.data.sessionType.replace('_', ' ')} &middot;{' '}
                    {s.data.startedAt?.toDate?.()
                      ? s.data.startedAt.toDate().toLocaleDateString()
                      : 'Unknown date'}
                    {s.data.overallMoodScore != null && ` · Mood: ${s.data.overallMoodScore}/10`}
                  </div>
                </div>
                <span className={`badge badge-${s.data.status}`}>
                  {s.data.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            message="No sessions yet. Start your wellness journey!"
            actionLabel="New Session"
            onAction={() => navigate('/sessions')}
          />
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Quick Actions</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
        }}>
          {/* Starts a new AI therapy session and navigates to the chat */}
          <QuickAction
            icon="🧠"
            label="New Therapy Session"
            subtitle={creatingSession ? 'Starting...' : undefined}
            disabled={creatingSession}
            onClick={handleNewTherapySession}
          />
          {/* Alexa — Dream Visualization launcher. Creates a session and opens the viz page. */}
          <QuickAction
            icon="🌙"
            label="Dream Visualization"
            subtitle={creatingDream ? 'Starting...' : undefined}
            disabled={creatingDream}
            onClick={handleNewDreamSession}
          />
          <QuickAction
            icon="💜"
            label="Log Mood"
            onClick={() => navigate('/mood')}
          />
          <QuickAction
            icon="📊"
            label="View Reports"
            onClick={() => navigate('/settings')}
          />
        </div>
      </div>
    </div>
  );
};

/* --- Sub-components --- */

const MoodBarChart: React.FC<{ data: MoodPoint[] }> = ({ data }) => {
  const maxScore = 10;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: 120 }}>
      {data.map((point) => {
        const heightPct = (point.averageScore / maxScore) * 100;
        const hue = (point.averageScore / maxScore) * 120; // red(0) to green(120)
        return (
          <div
            key={point.date}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {point.averageScore.toFixed(1)}
            </span>
            <div
              style={{
                width: '100%',
                maxWidth: 40,
                height: `${heightPct}%`,
                minHeight: 4,
                borderRadius: '4px 4px 0 0',
                background: `hsl(${hue}, 60%, 55%)`,
                transition: 'height 0.3s ease',
              }}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              {point.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

interface QuickActionProps {
  icon: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
  onClick?: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, label, subtitle, disabled, onClick }) => {
  return (
    <button
      className={`btn btn-outline ${disabled ? 'btn-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1rem',
        gap: '0.4rem',
        minHeight: 90,
      }}
    >
      <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{label}</span>
      {subtitle && (
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{subtitle}</span>
      )}
    </button>
  );
};

export default Dashboard;
