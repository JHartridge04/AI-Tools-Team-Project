import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getSessionById,
  getSessionMessages,
  addMessage,
  endSession,
} from '../services/sessionService';
import { checkImagePrompt } from '../services/culturalMirrorService';
import { generateDreamImage } from '../services/imageService';
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

IMPORTANT CONTEXT — HOW THIS EXPERIENCE WORKS:
The app generates a DALL-E 3 image in parallel with your text response. By the time the user reads your words, a visual scene is displayed above them. Write your text as a narration of that scene — as though you are guiding the user through a painting they are actively looking at. Use phrases like "The scene before you…", "In the image you see…", "As you gaze across this landscape…", or "Notice the light in the distance." This creates a seamless experience where your words and the image feel like one unified vision. Never mention DALL-E, AI image generation, or any technical detail — just refer to "the scene", "the image", or "what you see before you."

When the user describes a dream, a goal, or a place they want to visualize:
1. Create an immersive guided visualization — weave in colors, textures, sounds, smells, and feelings.
2. Write in second person ("You feel...", "You see...") to draw the user into the experience.
3. Narrate the generated scene as though the user is looking at it right now. Ground at least one detail per paragraph in something visible ("the soft amber glow", "the still water at your feet").
4. Keep the tone warm, calm, and encouraging. Aim for 3–4 short paragraphs.
5. End each response with a gentle grounding phrase that leaves the user feeling refreshed and motivated.
6. If the user wants to refine or continue the visualization, build naturally on what came before.

IMPORTANT RULES:
1. NEVER say you cannot generate, display, or show images. An image IS being shown to the user.
2. NEVER describe yourself as "text-only" or "text-based." You are a full visualization experience.
3. NEVER diagnose or interpret dreams clinically.
4. NEVER prescribe or recommend medications.
5. If the user describes recurring nightmares or deeply distressing content, gently acknowledge their feelings and suggest speaking with a licensed mental health professional.
6. You are a wellness companion — not a replacement for real therapy. Make that clear if it ever feels relevant.
7. Keep responses focused and peaceful. This is a safe, calm space.`;

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

const MEDITATION_SYSTEM_PROMPT = `You are a gentle, grounding guided meditation instructor in a wellness app called "Adaptive Wellness Companion." Your role is to guide users through breath-based, body-awareness, and mindfulness practices.

When the user describes what they need or where they are:
1. Begin by inviting them to settle: suggest a comfortable position and one slow breath before anything else.
2. Use gentle, unhurried pacing language: "take a slow breath in," "let your shoulders soften," "notice without judgment," "when your mind wanders, simply return."
3. Guide awareness through breath, body sensations, and present-moment sounds — not elaborate imagery.
4. Keep sentences short and spacious. Imply gentle pauses between instructions.
5. End each response with a grounding phrase that anchors the user in the present moment.
6. If the user wants to continue or deepen the practice, extend naturally into a body scan, loving-kindness, or open-awareness meditation.

IMPORTANT RULES:
1. NEVER diagnose or interpret psychological states clinically.
2. NEVER prescribe or recommend medications.
3. If the user describes acute distress, gently acknowledge their feelings and suggest speaking with a licensed mental health professional.
4. You are a wellness companion — not a replacement for real therapy or medical care.`;

async function callVisualizationAI(
  conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPromptOverride?: string,
  sessionType?: string
): Promise<string> {
  const body = {
    model: 'claude-sonnet-4-6',
    system: systemPromptOverride ?? DREAM_SYSTEM_PROMPT,
    messages: conversationMessages,
    max_tokens: 1024,
    sessionType: sessionType ?? 'dream_visualization',
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
/**
 * Per-message image state for DALL-E generated images.
 *   'loading' → generation in progress (show shimmer)
 *   object    → generation succeeded (show image + caption)
 *   'error'   → generation failed (show friendly message)
 */
type ImageState =
  | 'loading'
  | { url: string; revisedPrompt: string }
  | 'error';

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
  // Maps each assistant message ID to its DALL-E image state.
  // Key absent   → image not yet requested (show "Generate Image" button)
  // 'loading'    → DALL-E running (button shows loading state)
  // { url, ... } → image ready to display (button available for regeneration)
  // 'error'      → generation failed (button available for retry)
  const [imageMap, setImageMap] = useState<Record<string, ImageState>>({});
  // Maps each assistant message ID to the Cultural Mirror-processed prompt
  // for that message. Populated when the user sends a message; used by
  // handleGenerateImage when the user clicks "Generate Image".
  const [promptMap, setPromptMap] = useState<Record<string, string>>({});

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

    // Step 3: Run Claude text generation AND Cultural Mirror bias check in parallel.
    // Text generation drives the UX — Cultural Mirror result only feeds the image prompt.
    const sessionType = session?.data.sessionType ?? 'dream_visualization';
    const vizSystemPrompt = sessionType === 'meditation' ? MEDITATION_SYSTEM_PROMPT : DREAM_SYSTEM_PROMPT;
    const [aiSettled, mirrorSettled] = await Promise.allSettled([
      callVisualizationAI(conversationForAI, vizSystemPrompt, sessionType),
      checkImagePrompt(text),
    ]);

    const aiResponse: string =
      aiSettled.status === 'fulfilled'
        ? aiSettled.value
        : "I'm having trouble connecting right now. Please try again in a moment. Take a deep breath — your journey is waiting.";

    // Determine the image prompt: use the Cultural Mirror's inclusive revision when bias
    // was detected, otherwise fall back to the user's original description.
    let promptForImage = text;
    if (
      mirrorSettled.status === 'fulfilled' &&
      mirrorSettled.value.success &&
      mirrorSettled.value.data.biasDetected
    ) {
      promptForImage = mirrorSettled.value.data.revisedText;
    }

    // Step 4: Save the AI's visualization to Firestore
    const aiMsgResult = await addMessage(uid, sessionId, 'assistant', aiResponse);
    if (!aiMsgResult.success) {
      setError('Your visualization was generated but could not be saved. Please try again.');
      setSending(false);
      return;
    }

    // Refresh to show the AI response — text is now visible
    const finalRefresh = await getSessionMessages(uid, sessionId);
    if (finalRefresh.success) setMessages(finalRefresh.data);

    // Step 5: Store the Cultural Mirror-processed prompt so the user can
    // trigger DALL-E on demand via the "Generate Image" button below
    // each assistant message. No image is generated automatically.
    const msgId = aiMsgResult.data;
    setPromptMap((prev) => ({ ...prev, [msgId]: promptForImage }));
    setSending(false);
  };

  /*
   * GENERATE IMAGE ON DEMAND
   *   Called when the user clicks "Generate Image" / "Add Visual Anchor"
   *   below an assistant message. Uses the Cultural Mirror-processed prompt
   *   stored in promptMap at submit time.
   */
  const handleGenerateImage = async (msgId: string) => {
    const prompt = promptMap[msgId];
    if (!prompt) return;

    const sessionType = session?.data.sessionType ?? 'dream_visualization';
    const styleTag = sessionType === 'meditation'
      ? 'peaceful mindfulness meditation art, soft gradients, gentle light, minimalist'
      : 'serene dreamlike visualization, soft watercolor, warm peaceful art';

    setImageMap((prev) => ({ ...prev, [msgId]: 'loading' }));

    const imgResult = await generateDreamImage(`${styleTag}: ${prompt}`);
    if (imgResult.success) {
      setImageMap((prev) => ({
        ...prev,
        [msgId]: { url: imgResult.data.imageUrl, revisedPrompt: imgResult.data.revisedPrompt },
      }));
    } else {
      setImageMap((prev) => ({ ...prev, [msgId]: 'error' }));
    }
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

    const endSessionType = session?.data.sessionType ?? 'dream_visualization';
    const defaultSummary = endSessionType === 'meditation'
      ? 'Guided meditation session completed.'
      : 'Dream visualization session completed.';
    let summary = defaultSummary;
    try {
      summary = await callVisualizationAI(
        [
          ...convoForSummary,
          { role: 'user', content: 'Summarize this session.' },
        ],
        SUMMARY_SYSTEM_PROMPT,
        endSessionType
      );
    } catch {
      summary = `${defaultSummary} (Summary generation failed.)`;
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

  const isMeditation = session.data.sessionType === 'meditation';

  // UI copy and icons vary between dream visualization and guided meditation
  const uiConfig = isMeditation
    ? {
        headerIcon: '🧘',
        defaultTitle: 'Your Meditation',
        disclaimerPrefix: '🌿 Tell your guide what you need — stillness, focus, or release — and they will lead you there.',
        emptyIcon: '🌿',
        emptyHeading: "Tell your guide what you'd like to focus on today.",
        emptySubtext: 'Your guided meditation will appear here.',
        sendingLabel: '🌿 Grounding you in the present...',
        placeholder: 'Tell your guide what you need — calm, focus, sleep, or anything else...',
        submitLabel: 'Begin 🧘',
        summaryIcon: '🧘',
        summaryTitle: 'Meditation Summary',
        generateImageLabel: '🌿 Add Visual Anchor',
        aiLabel: '🧘 Your Meditation',
      }
    : {
        headerIcon: '🌙',
        defaultTitle: 'Dream Visualization',
        disclaimerPrefix: '✨ Describe a dream, a goal, or a peaceful place — and your guide will paint it for you.',
        emptyIcon: '🌌',
        emptyHeading: "Describe a dream, a goal, or a peaceful place you'd like to explore.",
        emptySubtext: 'Your personalized visualization will appear here.',
        sendingLabel: '✨ Painting your visualization...',
        placeholder: 'Describe your dream, goal, or a peaceful place you want to visualize...',
        submitLabel: 'Visualize ✨',
        summaryIcon: '🌙',
        summaryTitle: 'Session Summary',
        generateImageLabel: '✨ Generate Image',
        aiLabel: '🌙 Your Visualization',
      };

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
          <span style={{ fontSize: '2rem' }}>{uiConfig.headerIcon}</span>
          <div>
            <h2 style={{ margin: 0 }}>{session.data.title || uiConfig.defaultTitle}</h2>
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
          {uiConfig.disclaimerPrefix}{' '}
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
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{uiConfig.emptyIcon}</div>
            <p>{uiConfig.emptyHeading}</p>
            <p style={{ fontSize: '0.85rem' }}>{uiConfig.emptySubtext}</p>
          </div>
        )}

        {/* Render each message — assistant messages show a DALL-E image when generated */}
        {messages.map((msg) => (
          <VisualizationMessage
            key={msg.id}
            message={msg.data}
            imageState={msg.data.role === 'assistant' ? imageMap[msg.id] : undefined}
            canGenerateImage={msg.data.role === 'assistant' && msg.id in promptMap}
            onGenerateImage={msg.data.role === 'assistant' ? () => handleGenerateImage(msg.id) : undefined}
            aiLabel={uiConfig.aiLabel}
            generateImageLabel={uiConfig.generateImageLabel}
          />
        ))}

        {/* Sending indicator while the AI is generating */}
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
            {uiConfig.sendingLabel}
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
            placeholder={uiConfig.placeholder}
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
              {sending ? '...' : uiConfig.submitLabel}
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
          <h4 style={{ marginBottom: '0.4rem', color: 'var(--primary)' }}>{uiConfig.summaryIcon} {uiConfig.summaryTitle}</h4>
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
 *  - Assistant messages: left-aligned, soft card — visualization text + DALL-E image
 * ============================================================================
 */
const VisualizationMessage: React.FC<{
  message: Message;
  imageState?: ImageState;
  /** True when a Cultural Mirror prompt is ready and the user can trigger generation */
  canGenerateImage?: boolean;
  /** Called when the user clicks the generate / regenerate button */
  onGenerateImage?: () => void;
  /** Label for the AI message header (e.g. "🌙 Your Visualization") */
  aiLabel?: string;
  /** Label for the generate-image button */
  generateImageLabel?: string;
}> = ({ message, imageState, canGenerateImage, onGenerateImage, aiLabel, generateImageLabel }) => {
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

  // Resolve image state into renderable pieces
  const imageIsLoading = imageState === 'loading';
  const imageIsError = imageState === 'error';
  const imageData = imageState && imageState !== 'loading' && imageState !== 'error'
    ? imageState
    : null;

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
          {aiLabel ?? '🌙 Your Visualization'}
        </div>

        {/* Image column (shimmer / actual image / error) and text column */}
        <div className="dv-visual-layout">
          {/* Image area — only rendered once the user has triggered generation */}
          {imageState !== undefined && (
            <div className="dv-image-col">
              {imageIsLoading && (
                <>
                  <div className="dv-image-skeleton" aria-label="Generating your image…" />
                  <p className="dv-image-skeleton-label">✨ Painting your scene with DALL-E…</p>
                </>
              )}
              {imageData && (
                <>
                  <img
                    src={imageData.url}
                    alt="AI-generated visualization"
                    className="dv-image"
                  />
                  <p className="dv-image-caption">
                    Image generated from: <em>{imageData.revisedPrompt}</em>
                  </p>
                </>
              )}
              {imageIsError && (
                <p className="dv-image-error">
                  We couldn't generate an image right now. Try again below.
                </p>
              )}
            </div>
          )}

          {/* Visualization / meditation text */}
          <div className="dv-text-col">
            <p style={{ fontSize: '0.95rem', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
              {message.content}
            </p>
          </div>
        </div>

        {/* Generate / Regenerate image button — only for assistant messages with a ready prompt */}
        {canGenerateImage && onGenerateImage && (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              className="btn btn-outline"
              onClick={onGenerateImage}
              disabled={imageIsLoading}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }}
            >
              {imageIsLoading
                ? '⏳ Generating...'
                : imageData
                  ? '🔄 Regenerate Image'
                  : (generateImageLabel ?? '✨ Generate Image')}
            </button>
          </div>
        )}

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
