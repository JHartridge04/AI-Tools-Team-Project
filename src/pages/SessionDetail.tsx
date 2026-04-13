import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import {
  getSessionById, getSessionMessages, addMessage,
  getRecentContext, endSession,
} from '../services/sessionService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';
import { Session, Message, WithId, SessionType } from '../types';

/*
 * ============================================================================
 *  ICON MAP — Maps session types to emoji icons for the header.
 * ============================================================================
 */
const sessionTypeIcons: Record<string, string> = {
  therapy: '🧠', dream_visualization: '🌙', journal: '📝', meditation: '🧘',
};

/*
 * ============================================================================
 *  CRISIS DETECTION — Scans user messages for distress keywords.
 *
 *  If ANY of these phrases appear, we immediately show the 988 crisis banner
 *  and flag the message in Firestore. The AI still responds, but gets an
 *  extra instruction to gently encourage professional help.
 *
 *  TEAMMATES: To add/remove keywords, just edit this array.
 * ============================================================================
 */
const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'hurt myself', 'end it all',
  'want to die', 'self-harm', 'self harm', "don't want to live",
  'ending my life', 'take my own life', 'kill me',
];

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

/*
 * ============================================================================
 *  SYSTEM PROMPT — Instructions that tell Claude how to behave as a therapist.
 *
 *  This is the "personality" of the AI. It uses Cognitive Behavioral Therapy
 *  (CBT) and Motivational Interviewing (MI) techniques. It NEVER diagnoses
 *  or prescribes — it always recommends real professionals for serious issues.
 *
 *  Past session summaries are injected here so the AI has "memory" of
 *  previous conversations.
 * ============================================================================
 */
function buildSystemPrompt(
  contextSummaries: Array<{ sessionType: SessionType; summary: string; date: string }>
): string {
  let prompt = `You are a warm, empathetic wellness companion in a mental health app called "Adaptive Wellness Companion." Your approach combines:

- **Cognitive Behavioral Therapy (CBT):** Help users identify unhelpful thought patterns, challenge negative thinking, and develop healthier perspectives.
- **Motivational Interviewing (MI):** Use open-ended questions, affirmations, reflective listening, and summaries to support the user's own motivation for change.

IMPORTANT RULES:
1. NEVER diagnose any mental health condition.
2. NEVER prescribe or recommend specific medications.
3. For serious concerns (trauma, abuse, persistent depression, substance abuse), gently encourage the user to seek a licensed therapist or counselor.
4. Keep responses concise — 2 to 3 short paragraphs maximum.
5. Use a warm, conversational tone. You're a supportive companion, not a clinical robot.
6. Ask thoughtful follow-up questions to keep the conversation going.
7. Validate the user's feelings before offering any reframing.`;

  // Inject past session summaries so the AI has continuity / "memory"
  if (contextSummaries.length > 0) {
    prompt += `\n\nHere are summaries from the user's recent sessions (most recent first). Use these for context and continuity — reference past themes naturally if relevant, but don't recite them back verbatim:\n`;
    contextSummaries.forEach((s, i) => {
      prompt += `\n${i + 1}. [${s.sessionType.replace('_', ' ')} — ${s.date ? new Date(s.date).toLocaleDateString() : 'unknown date'}]: ${s.summary}`;
    });
  }

  return prompt;
}

/*
 * ============================================================================
 *  CLAUDE API CALL — Sends messages to the AI and gets a response.
 *
 *  Tries the backend proxy first (keeps the API key secret).
 *  Falls back to a direct browser call if the proxy is unavailable
 *  (only works if REACT_APP_ANTHROPIC_API_KEY is set — dev only).
 *
 *  TEAMMATES: The proxy runs at http://localhost:3001. Start it with:
 *    cd server && npm install && npm start
 * ============================================================================
 */
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

async function callTherapistAI(
  systemPrompt: string,
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  isCrisis: boolean
): Promise<string> {
  // If the user is in crisis, add a safety instruction to the system prompt
  let finalSystem = systemPrompt;
  if (isCrisis) {
    finalSystem += '\n\nIMPORTANT: The user may be in crisis. Respond with warmth and empathy. Gently encourage them to reach out to the 988 Suicide & Crisis Lifeline (call or text 988). Do not minimize their feelings. Remind them that professional help is available and that reaching out takes courage.';
  }

  const body = {
    model: 'claude-sonnet-4-6',
    system: finalSystem,
    messages: conversationMessages,
    max_tokens: 1024,
  };

  // --- Attempt 1: Backend proxy (recommended) ---
  try {
    const proxyRes = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return data.content?.[0]?.text || 'I\'m here for you. Could you tell me more about what you\'re feeling?';
    }
  } catch {
    // Proxy not running — fall through to direct call
  }

  // --- Attempt 2: Direct Anthropic API call (dev fallback) ---
  const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return 'The AI therapist is currently unavailable. Please make sure the backend proxy is running (cd server && npm start) or set REACT_APP_ANTHROPIC_API_KEY in your .env.local file.';
  }

  const directRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!directRes.ok) {
    const err = await directRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Anthropic API request failed');
  }

  const data = await directRes.json();
  return data.content?.[0]?.text || 'I\'m here for you. Could you tell me more about what you\'re feeling?';
}

/*
 * ============================================================================
 *  SESSION DETAIL — The main therapy chat page.
 * ============================================================================
 */
const SessionDetail: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  // --- State ---
  const [session, setSession] = useState<WithId<Session> | null>(null);
  const [messages, setMessages] = useState<WithId<Message>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  // Crisis detection: once true, the banner stays visible for the rest of the session
  const [crisisDetected, setCrisisDetected] = useState(false);
  // "End Session" loading state
  const [endingSession, setEndingSession] = useState(false);
  // Cached past-session summaries (loaded once, reused for every AI call)
  const [recentContext, setRecentContext] = useState<
    Array<{ sessionType: SessionType; summary: string; date: string }> | null
  >(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Load session + messages on mount ---
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
      if (messagesRes.success) {
        setMessages(messagesRes.data);
        // Check if any existing messages were flagged (e.g. returning to a session)
        if (messagesRes.data.some((m) => m.data.flagged)) {
          setCrisisDetected(true);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [uid, sessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /*
   * SEND MESSAGE — The main flow when the user sends a message:
   *   1. Save user message to Firestore
   *   2. Check for crisis keywords → flag if needed
   *   3. Call the Claude API for a therapist response
   *   4. Save the AI response to Firestore
   */
  const handleSend = async () => {
    if (!uid || !sessionId || !newMessage.trim()) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    // Step 1: Save the user's message to Firestore
    const userMsgResult = await addMessage(uid, sessionId, 'user', text);
    if (!userMsgResult.success) {
      setError('Failed to send message.');
      setSending(false);
      return;
    }

    // Step 2: Crisis detection — flag the message if distress keywords found
    const isCrisis = detectCrisis(text);
    if (isCrisis) {
      setCrisisDetected(true);
      // Update the message doc to set flagged = true
      try {
        const msgDocRef = doc(db, 'users', uid, 'sessions', sessionId, 'messages', userMsgResult.data);
        await updateDoc(msgDocRef, { flagged: true });
      } catch {
        // Non-critical — the banner still shows even if the flag update fails
      }
    }

    // Refresh messages so the user's message appears immediately
    const refreshed = await getSessionMessages(uid, sessionId);
    if (refreshed.success) setMessages(refreshed.data);

    // Step 3: Load past session context (cached after first call)
    let context = recentContext;
    if (context === null) {
      const ctxResult = await getRecentContext(uid, 5);
      context = ctxResult.success ? ctxResult.data : [];
      setRecentContext(context);
    }

    // Step 4: Build the conversation history for the Claude API
    // We include current messages + the new user message
    const allMessages = refreshed.success ? refreshed.data : messages;
    const conversationForAI = allMessages
      .filter((m) => m.data.role === 'user' || m.data.role === 'assistant')
      .map((m) => ({ role: m.data.role as 'user' | 'assistant', content: m.data.content }));

    // Step 5: Call the Claude API
    const systemPrompt = buildSystemPrompt(context);
    let aiResponse: string;
    try {
      aiResponse = await callTherapistAI(systemPrompt, conversationForAI, isCrisis || crisisDetected);
    } catch {
      aiResponse = "I'm sorry, I'm having trouble connecting right now. Please try again in a moment, or reach out to a trusted person if you need support.";
    }

    // Step 6: Save the AI response to Firestore
    await addMessage(uid, sessionId, 'assistant', aiResponse);

    // Refresh messages one more time to show the AI response
    const finalRefresh = await getSessionMessages(uid, sessionId);
    if (finalRefresh.success) setMessages(finalRefresh.data);

    setSending(false);
  };

  /*
   * END SESSION — Generates a summary via the AI and closes the session.
   *   1. Ask Claude to summarize the conversation
   *   2. Save the summary and mark the session as "completed"
   */
  const handleEndSession = async () => {
    if (!uid || !sessionId || endingSession) return;
    setEndingSession(true);

    // Build conversation text for the summary prompt
    const convoForSummary = messages
      .filter((m) => m.data.role === 'user' || m.data.role === 'assistant')
      .map((m) => ({ role: m.data.role as 'user' | 'assistant', content: m.data.content }));

    // Ask Claude to summarize the session
    let summary = 'Session ended.';
    try {
      summary = await callTherapistAI(
        'Summarize this therapy session in 2-3 sentences. Focus on the key themes discussed, emotions explored, and any progress or insights the user made. Write in third person (e.g., "The user discussed..."). Be concise.',
        convoForSummary,
        false
      );
    } catch {
      summary = 'Session ended. (Summary generation failed.)';
    }

    // Close the session in Firestore
    await endSession(uid, sessionId, summary);

    // Refresh session data so the UI switches to the "completed" view
    const updated = await getSessionById(uid, sessionId);
    if (updated.success) setSession(updated.data);

    setEndingSession(false);
  };

  // Enter key sends the message (Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Render ---
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!session) return <ErrorMessage error="Session not found." />;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Crisis Banner — shown if distress keywords were detected */}
      {crisisDetected && <CrisisBanner />}

      {/* Session Header */}
      <div className="card" style={{ marginBottom: '1rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>
            {sessionTypeIcons[session.data.sessionType] || '📄'}
          </span>
          <div>
            <h2 style={{ margin: 0 }}>{session.data.title || 'Untitled Session'}</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {session.data.sessionType.replace('_', ' ')} &middot;{' '}
              {session.data.startedAt?.toDate?.()
                ? session.data.startedAt.toDate().toLocaleString()
                : 'Unknown date'}
              &middot;{' '}
              <span className={`badge badge-${session.data.status}`}>{session.data.status}</span>
            </div>
          </div>
        </div>
        {(session.data.moodBefore != null || session.data.moodAfter != null) && (
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            {session.data.moodBefore != null && <>Mood before: <strong>{session.data.moodBefore}/10</strong></>}
            {session.data.moodBefore != null && session.data.moodAfter != null && ' → '}
            {session.data.moodAfter != null && <>Mood after: <strong>{session.data.moodAfter}/10</strong></>}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            Start the conversation — say what's on your mind.
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg.data} />)
        )}
        {/* "Thinking..." indicator while the AI is generating a response */}
        {sending && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area — shown only for active sessions */}
      {session.data.status === 'active' && (
        <div style={{
          flexShrink: 0, padding: '0.75rem', background: 'var(--card-bg)',
          borderTop: '1px solid var(--border)', borderRadius: '0 0 12px 12px',
          display: 'flex', gap: '0.5rem',
        }}>
          <textarea
            className="input"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            style={{ resize: 'none', flex: 1 }}
            disabled={sending || endingSession}
          />
          <button className="btn btn-primary" onClick={handleSend} disabled={sending || !newMessage.trim() || endingSession}>
            {sending ? '...' : 'Send'}
          </button>
          {/* End Session button — generates a summary and closes the session */}
          <button
            className="btn btn-outline"
            onClick={handleEndSession}
            disabled={sending || endingSession}
            title="End this session and generate a summary"
          >
            {endingSession ? 'Ending...' : 'End'}
          </button>
        </div>
      )}

      {/* Summary — shown for completed sessions */}
      {session.data.status === 'completed' && session.data.summary && (
        <div style={{
          flexShrink: 0, padding: '1rem', background: 'var(--primary-bg)',
          borderRadius: 8, border: '1px solid var(--primary-light)', marginTop: '0.75rem',
        }}>
          <h4 style={{ marginBottom: '0.4rem', color: 'var(--primary)' }}>Session Summary</h4>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{session.data.summary}</p>
        </div>
      )}
    </div>
  );
};

/*
 * ============================================================================
 *  MESSAGE BUBBLE — Renders a single chat message.
 *
 *  - User messages: aligned RIGHT, purple background
 *  - Assistant messages: aligned LEFT, gray background
 *  - System messages: centered, italic, muted
 *  - Flagged messages (crisis): red border as a visual indicator
 * ============================================================================
 */
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.25rem 1rem' }}>
        {message.content}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '75%', padding: '0.75rem 1rem',
        borderRadius: isUser ? '12px 12px 0 12px' : '12px 12px 12px 0',
        background: isUser ? 'var(--primary)' : 'var(--bg)',
        color: isUser ? '#fff' : 'var(--text)',
        border: message.flagged ? '2px solid var(--danger)' : 'none',
      }}>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
        <div style={{ fontSize: '0.7rem', marginTop: '0.3rem', opacity: 0.7, textAlign: 'right' }}>
          {message.timestamp?.toDate?.()
            ? message.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''}
        </div>
      </div>
    </div>
  );
};

/*
 * ============================================================================
 *  CRISIS BANNER — Shown when distress keywords are detected.
 *
 *  Displays the 988 Suicide & Crisis Lifeline and Crisis Text Line.
 *  This banner stays visible for the rest of the session once triggered.
 * ============================================================================
 */
const CrisisBanner: React.FC = () => (
  <div style={{
    background: '#fff5f5', border: '2px solid #e53e3e', borderRadius: 12,
    padding: '1rem 1.25rem', marginBottom: '1rem', flexShrink: 0,
  }}>
    <p style={{ fontWeight: 700, color: '#c53030', fontSize: '1rem', marginBottom: '0.5rem' }}>
      If you're in crisis, please reach out for help.
    </p>
    <p style={{ fontSize: '0.95rem', marginBottom: '0.4rem' }}>
      <strong>988 Suicide &amp; Crisis Lifeline:</strong>{' '}
      <a href="tel:988" style={{ color: '#c53030', fontWeight: 600 }}>Call or text 988</a>
    </p>
    <p style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
      <strong>Crisis Text Line:</strong> Text <strong>HOME</strong> to{' '}
      <a href="sms:741741" style={{ color: '#c53030', fontWeight: 600 }}>741741</a>
    </p>
    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
      You are not alone. Professional help is available 24/7.
    </p>
  </div>
);

export default SessionDetail;
