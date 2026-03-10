/**
 * Shared TypeScript interfaces for the Adaptive Wellness Companion.
 *
 * Import these in any service, component, or context file:
 *   import type { UserProfile, Session, Message, MoodEntry, SharedReport } from '../types';
 */

import { Timestamp } from "firebase/firestore";

// ─── Enumerations ─────────────────────────────────────────────────────────────

export type TherapyMode = "talk" | "guided_visualization" | "exploratory";
export type SessionType = "therapy" | "dream_visualization" | "journal" | "meditation";
export type SessionStatus = "active" | "completed" | "abandoned";
export type MessageRole = "user" | "assistant" | "system";
export type MoodSource = "manual" | "post_session" | "check_in";

// ─── Firestore Document Shapes ─────────────────────────────────────────────────

/**
 * /users/{uid}
 *
 * PRIVACY NOTE: displayName is a chosen alias, NOT a legal name.
 * Do NOT add fields for real name, phone, address, insurance, or diagnosis codes.
 */
export interface UserProfile {
  email: string;
  /** Optional alias chosen by the user — not their legal name. */
  displayName?: string;
  preferredTherapyMode: TherapyMode;
  onboardingComplete: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * /users/{uid}/sessions/{sessionId}
 */
export interface Session {
  sessionType: SessionType;
  title: string;
  /** Empty on creation; the AI fills this when the session ends. */
  summary: string;
  /** 1–10, set at session end by the user or derived from messages. */
  overallMoodScore: number | null;
  /** User self-reports before the session begins. */
  moodBefore: number | null;
  /** User self-reports after the session ends. */
  moodAfter: number | null;
  status: SessionStatus;
  startedAt: Timestamp;
  endedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * /users/{uid}/sessions/{sessionId}/messages/{messageId}
 *
 * PRIVACY NOTE: Only text content is stored here. Raw audio is NEVER persisted
 * to the database. Voice input must be transcribed by the frontend before being
 * passed to addMessage().
 */
export interface Message {
  role: MessageRole;
  /** The transcribed or typed text content — never raw audio. */
  content: string;
  /** Sentiment score in the range [-1, 1]. Populated by AI post-analysis. */
  sentimentScore: number | null;
  /** Set to true if crisis-detection logic flags this message. */
  flagged: boolean;
  timestamp: Timestamp;
}

/**
 * /users/{uid}/moodEntries/{entryId}
 */
export interface MoodEntry {
  /** 1–10 scale. */
  score: number;
  note?: string;
  tags: string[];
  source: MoodSource;
  /** Links back to the session that triggered this mood log, if any. */
  relatedSessionId: string | null;
  createdAt: Timestamp;
}

/**
 * /sharedReports/{reportId}
 *
 * PRIVACY NOTE: reportData contains only aggregated summaries — never raw
 * message transcripts. The owning user's UID is stored server-side for
 * authorization but is NOT included in the public-facing reportData map.
 */
export interface SharedReport {
  /** Owner's Firebase Auth UID — not exposed in the shared view. */
  userId: string;
  /** Pre-generated summary data: mood averages, session counts, themes, etc. */
  reportData: ReportData;
  expiresAt: Timestamp;
  accessCount: number;
  maxAccesses: number;
  createdAt: Timestamp;
}

/**
 * The aggregated, shareable content inside a SharedReport.
 * Contains zero raw message transcripts.
 */
export interface ReportData {
  dateRange: { start: string; end: string };
  totalSessions: number;
  sessionBreakdown: Partial<Record<SessionType, number>>;
  averageMoodScore: number | null;
  moodTrend: Array<{ date: string; averageScore: number }>;
  sessionSummaries: Array<{ sessionType: SessionType; summary: string; date: string }>;
}

// ─── Service Return Helpers ────────────────────────────────────────────────────

/** Wraps a Firestore document with its auto-generated ID. */
export interface WithId<T> {
  id: string;
  data: T;
}

/** Standard result envelope used by all service functions. */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
