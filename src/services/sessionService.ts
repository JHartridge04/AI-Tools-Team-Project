/**
 * sessionService.ts — Firestore operations for sessions and messages.
 *
 * TEAMMATES:
 *   • AI Therapist team: call createSession() when a chat starts, addMessage()
 *     for every turn, endSession() when the user closes the chat.
 *   • Use getRecentContext() to feed past session summaries into your AI prompt.
 *
 * Import example:
 *   import { createSession, addMessage, endSession, getRecentContext }
 *     from '../services/sessionService';
 *
 * PRIVACY NOTE: addMessage() accepts only text content. Raw audio must be
 * transcribed by the frontend (e.g., Web Speech API or Whisper) before being
 * passed here. Never pass audio buffers or file references to this function.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import type {
  Session,
  Message,
  SessionType,
  MessageRole,
  WithId,
  ServiceResult,
} from "../types";

// ─── Ref helpers ──────────────────────────────────────────────────────────────

function sessionsCol(uid: string) {
  return collection(db, "users", uid, "sessions");
}

function sessionDoc(uid: string, sessionId: string) {
  return doc(db, "users", uid, "sessions", sessionId);
}

function messagesCol(uid: string, sessionId: string) {
  return collection(db, "users", uid, "sessions", sessionId, "messages");
}

// ─── Session functions ────────────────────────────────────────────────────────

/**
 * Creates a new session document and returns its generated ID.
 *
 * Call this the moment the user starts a new therapy chat, dream visualization,
 * journal entry, or meditation.
 *
 * @param uid         - Firebase Auth UID of the current user.
 * @param sessionType - One of: "therapy" | "dream_visualization" | "journal" | "meditation"
 * @param title       - Optional title; defaults to a timestamp-based label.
 * @returns ServiceResult containing the new session ID.
 */
export async function createSession(
  uid: string,
  sessionType: SessionType,
  title?: string
): Promise<ServiceResult<string>> {
  try {
    const autoTitle = title ?? `${sessionType.replace("_", " ")} — ${new Date().toLocaleDateString()}`;
    const sessionData: Omit<Session, "endedAt"> & { endedAt: null } = {
      sessionType,
      title: autoTitle,
      summary: "",
      overallMoodScore: null,
      moodBefore: null,
      moodAfter: null,
      status: "active",
      startedAt: serverTimestamp() as any,
      endedAt: null,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };
    const ref = await addDoc(sessionsCol(uid), sessionData);
    return { success: true, data: ref.id };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to create session." };
  }
}

/**
 * Marks a session as completed and saves the AI-generated summary.
 *
 * Call this when the user closes a session or explicitly ends the conversation.
 * The AI teammate should generate `summary` from the message history before
 * calling this function.
 *
 * @param uid       - Firebase Auth UID.
 * @param sessionId - The session to close.
 * @param summary   - AI-generated summary of the session (plain text, no PHI).
 * @param moodAfter - User's self-reported mood (1–10) after the session.
 */
export async function endSession(
  uid: string,
  sessionId: string,
  summary: string,
  moodAfter?: number
): Promise<ServiceResult<void>> {
  try {
    await updateDoc(sessionDoc(uid, sessionId), {
      status: "completed",
      summary,
      moodAfter: moodAfter ?? null,
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to end session." };
  }
}

/**
 * Fetches a user's sessions, ordered newest first.
 *
 * @param uid         - Firebase Auth UID.
 * @param limitCount  - Max number of sessions to return (default 20).
 * @param sessionType - Optional filter (e.g., only "therapy" sessions).
 */
export async function getUserSessions(
  uid: string,
  limitCount: number = 20,
  sessionType?: SessionType
): Promise<ServiceResult<WithId<Session>[]>> {
  try {
    let q = query(sessionsCol(uid), orderBy("startedAt", "desc"), limit(limitCount));
    if (sessionType) {
      q = query(
        sessionsCol(uid),
        where("sessionType", "==", sessionType),
        orderBy("startedAt", "desc"),
        limit(limitCount)
      );
    }
    const snap = await getDocs(q);
    const sessions = snap.docs.map((d) => ({ id: d.id, data: d.data() as Session }));
    return { success: true, data: sessions };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to fetch sessions." };
  }
}

/**
 * Fetches a single session by ID.
 *
 * @param uid       - Firebase Auth UID.
 * @param sessionId - The session document ID.
 */
export async function getSessionById(
  uid: string,
  sessionId: string
): Promise<ServiceResult<WithId<Session>>> {
  try {
    const snap = await getDoc(sessionDoc(uid, sessionId));
    if (!snap.exists()) {
      return { success: false, error: "Session not found." };
    }
    return { success: true, data: { id: snap.id, data: snap.data() as Session } };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to fetch session." };
  }
}

// ─── Message functions ────────────────────────────────────────────────────────

/**
 * Appends a message to a session's messages subcollection.
 *
 * PRIVACY: Only pass transcribed text in `content`. Raw audio must be
 * converted to text by the frontend before calling this function.
 *
 * @param uid            - Firebase Auth UID.
 * @param sessionId      - The session to append the message to.
 * @param role           - "user" | "assistant" | "system"
 * @param content        - Transcribed or typed message text.
 * @param sentimentScore - Optional AI-derived sentiment [-1, 1].
 * @returns ServiceResult containing the new message ID.
 */
export async function addMessage(
  uid: string,
  sessionId: string,
  role: MessageRole,
  content: string,
  sentimentScore?: number
): Promise<ServiceResult<string>> {
  try {
    const message: Message = {
      role,
      content,
      sentimentScore: sentimentScore ?? null,
      flagged: false,
      timestamp: serverTimestamp() as any,
    };
    const ref = await addDoc(messagesCol(uid, sessionId), message);
    return { success: true, data: ref.id };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to add message." };
  }
}

/**
 * Fetches all messages for a session, ordered chronologically.
 *
 * @param uid       - Firebase Auth UID.
 * @param sessionId - The session whose messages to retrieve.
 */
export async function getSessionMessages(
  uid: string,
  sessionId: string
): Promise<ServiceResult<WithId<Message>[]>> {
  try {
    const q = query(messagesCol(uid, sessionId), orderBy("timestamp", "asc"));
    const snap = await getDocs(q);
    const messages = snap.docs.map((d) => ({ id: d.id, data: d.data() as Message }));
    return { success: true, data: messages };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to fetch messages." };
  }
}

/**
 * Fetches summaries from the most recent N completed sessions to use as
 * long-term memory context for the AI. Pass the returned array directly into
 * your AI prompt as system context.
 *
 * @param uid         - Firebase Auth UID.
 * @param numSessions - Number of past sessions to retrieve (default 5).
 * @returns Array of { sessionType, summary, date } objects, newest first.
 *
 * @example
 *   const context = await getRecentContext(uid, 5);
 *   // Inject context[].summary into your AI system prompt.
 */
export async function getRecentContext(
  uid: string,
  numSessions: number = 5
): Promise<ServiceResult<Array<{ sessionType: SessionType; summary: string; date: string }>>> {
  try {
    // Fetch more than needed and filter empty summaries in memory.
    // Avoid where("summary", "!=", "") because Firestore then requires
    // orderBy("summary") as the FIRST sort, which sorts alphabetically
    // instead of by date — breaking the "most recent N sessions" intent.
    const q = query(
      sessionsCol(uid),
      where("status", "==", "completed"),
      orderBy("startedAt", "desc"),
      limit(numSessions * 3)
    );
    const snap = await getDocs(q);
    const context = snap.docs
      .map((d): Session => d.data() as Session)
      .filter((s: Session) => s.summary && s.summary.trim() !== "")
      .slice(0, numSessions)
      .map((s: Session) => ({
        sessionType: s.sessionType,
        summary: s.summary,
        date: s.startedAt?.toDate?.()?.toISOString() ?? "",
      }));
    return { success: true, data: context };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to fetch recent context." };
  }
}
