import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getSessionById, getSessionMessages, addMessage } from '../services/sessionService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { Session, Message, WithId } from '../types';

const sessionTypeIcons: Record<string, string> = {
  therapy: '🧠',
  dream_visualization: '🌙',
  journal: '📝',
  meditation: '🧘',
};

const SessionDetail: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<WithId<Message>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!uid || !sessionId) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');

      const [sessionRes, messagesRes] = await Promise.all([
        getSessionById(uid, sessionId),
        getSessionMessages(uid, sessionId),
      ]);

      if (sessionRes.success) setSession(sessionRes.data);
      else setError(sessionRes.error);

      if (messagesRes.success) setMessages(messagesRes.data);

      setLoading(false);
    };

    fetchData();
  }, [uid, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!uid || !sessionId || !newMessage.trim()) return;

    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    // Add user message
    const result = await addMessage(uid, sessionId, 'user', text);

    if (result.success) {
      // Refresh messages
      const msgRes = await getSessionMessages(uid, sessionId);
      if (msgRes.success) setMessages(msgRes.data);

      // TODO: Sydney — Replace this placeholder with AI therapist response integration
      // Add placeholder system message for now
      await addMessage(uid, sessionId, 'system', 'AI therapist responses coming soon — Sydney is building this!');
      const updatedRes = await getSessionMessages(uid, sessionId);
      if (updatedRes.success) setMessages(updatedRes.data);
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!session) return <ErrorMessage error="Session not found." />;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Session Header */}
      <div className="card" style={{ marginBottom: '1rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>
            {sessionTypeIcons[session.sessionType] || '📄'}
          </span>
          <div>
            <h2 style={{ margin: 0 }}>{session.title || 'Untitled Session'}</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {session.sessionType.replace('_', ' ')} &middot;{' '}
              {session.startedAt?.toDate?.()
                ? session.startedAt.toDate().toLocaleString()
                : 'Unknown date'}
              &middot;{' '}
              <span className={`badge badge-${session.status}`}>{session.status}</span>
            </div>
          </div>
        </div>
        {(session.moodBefore != null || session.moodAfter != null) && (
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {session.moodBefore != null && <>Mood before: <strong>{session.moodBefore}/10</strong></>}
            {session.moodBefore != null && session.moodAfter != null && ' → '}
            {session.moodAfter != null && <>Mood after: <strong>{session.moodAfter}/10</strong></>}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            No messages in this session yet.
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg.data} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area (active sessions only) */}
      {session.status === 'active' && (
        <div style={{
          flexShrink: 0,
          padding: '0.75rem',
          background: 'var(--card-bg)',
          borderTop: '1px solid var(--border)',
          borderRadius: '0 0 12px 12px',
          display: 'flex',
          gap: '0.5rem',
        }}>
          <textarea
            className="input"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            style={{ resize: 'none', flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      )}

      {/* Summary (completed sessions) */}
      {session.status === 'completed' && session.summary && (
        <div style={{
          flexShrink: 0,
          padding: '1rem',
          background: 'var(--primary-bg)',
          borderRadius: 8,
          border: '1px solid var(--primary-light)',
          marginTop: '0.75rem',
        }}>
          <h4 style={{ marginBottom: '0.4rem', color: 'var(--primary)' }}>Session Summary</h4>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{session.summary}</p>
        </div>
      )}
    </div>
  );
};

/* --- Message Bubble --- */

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div style={{
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        fontStyle: 'italic',
        padding: '0.25rem 1rem',
      }}>
        {message.content}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '75%',
        padding: '0.75rem 1rem',
        borderRadius: isUser ? '12px 12px 0 12px' : '12px 12px 12px 0',
        background: isUser ? 'var(--primary)' : 'var(--bg)',
        color: isUser ? '#fff' : 'var(--text)',
        border: message.flagged ? '2px solid var(--danger)' : 'none',
      }}>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>{message.content}</p>
        <div style={{
          fontSize: '0.7rem',
          marginTop: '0.3rem',
          opacity: 0.7,
          textAlign: 'right',
        }}>
          {message.timestamp?.toDate?.()
            ? message.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''}
        </div>
      </div>
    </div>
  );
};

export default SessionDetail;
