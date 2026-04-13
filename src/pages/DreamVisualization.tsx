import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getSessionById,
  getSessionMessages,
  addMessage,
  endSession,
} from '../services/sessionService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { Session, Message, WithId } from '../types';

/*
 * ============================================================================
 *  DREAM VISUALIZATION AI — System prompt for the visualization guide.
 *
 *  This instructs Claude to act as a guided meditation/visualization companion.
 *  It generates rich, sensory descriptions to help users mentally explore
 *  a dream, goal, or peaceful scene they describe.
 *
 *  TEAMMATES: Edit the prompt below if you want to adjust the AI's style or tone.
 * ============================================================================
 */
const DREAM_SYSTEM_PROMPT = `You are a gentle, imaginative guided visualization companion in a wellness app called "Adaptive Wellness Companion." Your role is to help users explore dreams, goals, and peaceful mental spaces through rich, sensory storytelling.

When the user describes a dream, a goal, or a place they want to visualize:
1. Create an immersive guided visualization — weave in colors, textures, sounds, smells, and feelings.
2. Write in second person ("You feel...", "You see...") to draw the user into the experience.
3. Keep the tone warm, calm, and encouraging. Aim for 3–4 short paragraphs.
4. End each response with a gentle grounding phrase that leaves the user feeling refreshed and motivated.
5. If the user wants to refine or continue the visualization, build naturally on what came before.

IMPORTANT RULES:
1. NEVER diagnose or interpret dreams clinically.
2. NEVER prescribe or recommend medications.
3. If the user describes recurring nightmares or deeply distressing content, gently acknowledge their feelings and suggest speaking with a licensed mental health professional.
4. You are a wellness companion — not a replacement for real therapy. Make that clear if it ever feels relevant.
5. Keep responses focused and peaceful. This is a safe, calm space.`;

/*
 * ============================================================================
 *  CLAUDE API CALL — Sends messages to the AI and gets a visualization response.
 *
 *  All requests go through the backend proxy, which holds the API key securely.
 *
 *  TEAMMATES: The proxy runs at http://localhost:3001. Start it with:
 *    cd server && npm install && npm start
 * ============================================================================
 */
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

async function callVisualizationAI(
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPromptOverride?: string
): Promise<string> {
  const body = {
    model: 'claude-sonnet-4-6',
    system: systemPromptOverride ?? DREAM_SYSTEM_PROMPT,
    messages: conversationMessages,
    max_tokens: 1024,
  };

  const proxyRes = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!proxyRes.ok) {
    const err = await proxyRes.json().catch(() => ({}));
    throw new Error((err as any).error?.message || 'Visualization guide unavailable.');
  }

  const data = await proxyRes.json();
  return data.content?.[0]?.text || 'Close your eyes and take a deep breath. Your journey begins now...';
}

/*
 * ============================================================================
 *  DREAM VISUALIZATION — Main page component.
 *
 *  The user describes a dream, goal, or peaceful place in the text box.
 *  The AI responds with a rich guided visualization. Multiple exchanges
 *  are supported so users can refine or continue their journey.
 * ============================================================================
 */
const DreamVisualization: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  // --- State ---
  const [session, setSession] = useState<WithId<Session> | null>(null);
  const [messages, setMessages] = useState<WithId<Message>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  // "End Session" loading state — prevents double-clicks
  const [endingSession, setEndingSession] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // --- Load session and existing messages on mount ---
  useEffect(() => {
    if (!uid || !sessionId) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');

      const [sessionRes, messagesRes] = await Promise.all([
        getSessionById(uid, sessionId),
        getSessionMessages(uid, sessionId),
      ]);

      if (sessionRes.success) {
        setSession(sessionRes.data);
      } else {
        setError(sessionRes.error);
      }

      if (messagesRes.success) {
        setMessages(messagesRes.data);
      }

      setLoading(false);
    };

    fetchData();
  }, [uid, sessionId]);

  // Auto-scroll to the bottom when new messages appear
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /*
   * SUBMIT VISUALIZATION REQUEST
   *   1. Save the user's description to Firestore
   *   2. Build conversation history and call the Claude API
   *   3. Save the AI's visualization response to Firestore
   *   4. Refresh the message list
   */
  const handleSubmit = async () => {
    if (!uid || !sessionId || !inputText.trim()) return;
    setSending(true);
    const text = inputText.trim();
    setInputText('');

    // Step 1: Save the user's message to Firestore
    const userMsgResult = await addMessage(uid, sessionId, 'user', text);
    if (!userMsgResult.success) {
      setError('Failed to send your description. Please try again.');
      setSending(false);
      return;
    }

    // Refresh so the user's message appears immediately
    const refreshed = await getSessionMessages(uid, sessionId);
    if (refreshed.success) setMessages(refreshed.data);

    // Step 2: Build the conversation history for the Claude API
    const allMessages = refreshed.success ? refreshed.data : messages;
    const conversationForAI = allMessages
      .filter((m) => m.data.role === 'user' || m.data.role === 'assistant')
      .map((m) => ({ role: m.data.role as 'user' | 'assistant', content: m.data.content }));

    // Step 3: Call the Claude API for a guided visualization
    let aiResponse: string;
    try {
      aiResponse = await callVisualizationAI(conversationForAI);
    } catch {
      aiResponse =
        "I'm having trouble connecting right now. Please try again in a moment. Take a deep breath — your journey is waiting.";
    }

    // Step 4: Save the AI's visualization to Firestore
    const aiMsgResult = await addMessage(uid, sessionId, 'assistant', aiResponse);
    if (!aiMsgResult.success) {
      setError('Your visualization was generated but could not be saved. Please try again.');
      setSending(false);
      return;
    }

    // Refresh to show the AI response
    const finalRefresh = await getSessionMessages(uid, sessionId);
    if (finalRefresh.success) setMessages(finalRefresh.data);

    setSending(false);
  };

  /*
   * END SESSION
   *   Generates a short AI summary of the session, then marks it as completed.
   *   The summary is stored in Firestore and shown in Session History.
   */
  const handleEndSession = async () => {
    if (!uid || !sessionId || endingSession) return;
    setEndingSession(true);

    // Build the conversation for the summary prompt
    const convoForSummary = messages
      .filter((m) => m.data.role === 'user' || m.data.role === 'assistant')
      .map((m) => ({ role: m.data.role as 'user' | 'assistant', content: m.data.content }));

    // Ask the AI to summarize the visualization session.
    // A dedicated system prompt replaces DREAM_SYSTEM_PROMPT so the model writes
    // a plain archival summary rather than another immersive visualization.
    const SUMMARY_SYSTEM_PROMPT =
      'You are a concise session summarizer. Write exactly 2 sentences in third person ' +
      '(e.g. "The user visualized..."). Do not use second-person address, grounding phrases, ' +
      'or embellishment. Describe only what the user explored and the overall mood or theme.';

    let summary = 'Dream visualization session completed.';
    try {
      summary = await callVisualizationAI(
        [
          ...convoForSummary,
          { role: 'user', content: 'Summarize this dream visualization session.' },
        ],
        SUMMARY_SYSTEM_PROMPT
      );
    } catch {
      summary = 'Dream visualization session ended. (Summary generation failed.)';
    }

    // Save the summary and mark the session as completed
    await endSession(uid, sessionId, summary);

    // Refresh so the UI switches to the completed view
    const updated = await getSessionById(uid, sessionId);
    if (updated.success) setSession(updated.data);

    setEndingSession(false);
  };

  // Enter submits (Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // --- Render ---
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!session) return <ErrorMessage error="Session not found." />;

  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
      }}
    >
      {/* Session Header */}
      <div className="card" style={{ marginBottom: '1rem', flexShrink: 0, background: 'var(--primary-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '2rem' }}>🌙</span>
          <div>
            <h2 style={{ margin: 0 }}>{session.data.title || 'Dream Visualization'}</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {session.data.startedAt?.toDate?.()
                ? session.data.startedAt.toDate().toLocaleString()
                : 'Unknown date'}
              {' · '}
              <span className={`badge badge-${session.data.status}`}>{session.data.status}</span>
            </div>
          </div>
        </div>

        {/* Disclaimer — the AI is a wellness tool, not a therapist */}
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: 0 }}>
          ✨ Describe a dream, a goal, or a peaceful place — and your guide will paint it for you.
          This is a wellness tool and is <strong>not a replacement for professional mental health care</strong>.
        </p>
      </div>

      {/* Messages / Visualization Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* Empty state — shown before the first message */}
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              padding: '3rem 2rem',
              fontStyle: 'italic',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌌</div>
            <p>Describe a dream, a goal, or a peaceful place you'd like to explore.</p>
            <p style={{ fontSize: '0.85rem' }}>Your personalized visualization will appear here.</p>
          </div>
        )}

        {/* Render each message */}
        {messages.map((msg) => (
          <VisualizationMessage key={msg.id} message={msg.data} />
        ))}

        {/* "Visualizing..." indicator while the AI is generating */}
        {sending && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              fontSize: '0.9rem',
              padding: '1rem',
            }}
          >
            ✨ Painting your visualization...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area — shown only for active sessions */}
      {session.data.status === 'active' && (
        <div
          style={{
            flexShrink: 0,
            padding: '0.75rem',
            background: 'var(--card-bg)',
            borderTop: '1px solid var(--border)',
            borderRadius: '0 0 12px 12px',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <textarea
            className="input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your dream, goal, or a peaceful place you want to visualize..."
            rows={2}
            maxLength={2000}
            style={{ resize: 'none', flex: 1 }}
            disabled={sending || endingSession}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {/* Submit button — sends the user's description to the AI */}
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={sending || !inputText.trim() || endingSession}
              style={{ whiteSpace: 'nowrap' }}
            >
              {sending ? '...' : 'Visualize ✨'}
            </button>
            {/* End Session button — generates summary and closes the session */}
            <button
              className="btn btn-outline"
              onClick={handleEndSession}
              disabled={sending || endingSession}
              title="End this session and save a summary"
              style={{ whiteSpace: 'nowrap' }}
            >
              {endingSession ? 'Saving...' : 'End Session'}
            </button>
          </div>
        </div>
      )}

      {/* Session Summary — shown when the session is completed */}
      {session.data.status === 'completed' && session.data.summary && (
        <div
          style={{
            flexShrink: 0,
            padding: '1rem',
            background: 'var(--primary-bg)',
            borderRadius: 8,
            border: '1px solid var(--primary-light)',
            marginTop: '0.75rem',
          }}
        >
          <h4 style={{ marginBottom: '0.4rem', color: 'var(--primary)' }}>🌙 Session Summary</h4>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{session.data.summary}</p>
        </div>
      )}
    </div>
  );
};

/*
 * ============================================================================
 *  VISUALIZATION MESSAGE — Renders a single exchange in the session.
 *
 *  - User messages: right-aligned, pill style — the "prompt" they gave
 *  - Assistant messages: left-aligned, soft card style — the visualization itself
 * ============================================================================
 */
const VisualizationMessage: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // System messages (rare in this flow) appear as centered italics
  if (isSystem) {
    return (
      <div
        style={{
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          padding: '0.25rem 1rem',
        }}
      >
        {message.content}
      </div>
    );
  }

  // User message — right-aligned, compact, shows what they asked for
  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            maxWidth: '70%',
            padding: '0.6rem 1rem',
            borderRadius: '12px 12px 0 12px',
            background: 'var(--primary)',
            color: '#fff',
          }}
        >
          <p style={{ fontSize: '0.9rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
            {message.content}
          </p>
          <div style={{ fontSize: '0.7rem', marginTop: '0.3rem', opacity: 0.75, textAlign: 'right' }}>
            {message.timestamp?.toDate?.()
              ? message.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message — left-aligned, larger card for the rich visualization text
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '1rem 1.25rem',
          borderRadius: '12px 12px 12px 0',
          background: 'var(--primary-bg)',
          border: '1px solid var(--primary-light)',
          lineHeight: 1.75,
        }}
      >
        <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.5rem' }}>
          🌙 Your Visualization
        </div>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
          {message.content}
        </p>
        <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', opacity: 0.6, textAlign: 'right' }}>
          {message.timestamp?.toDate?.()
            ? message.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''}
        </div>
      </div>
    </div>
  );
};

export default DreamVisualization;
