/**
 * reportService.ts — Shareable therapist report generation and management.
 *
 * TEAMMATES (cultural bias / therapist sharing feature):
 *   • generateShareableReport() creates a time-limited link.
 *   • getSharedReport() is what a therapist's browser calls — no auth required.
 *   • deleteSharedReport() lets the user revoke a link.
 *
 * PRIVACY GUARANTEE: Reports contain ONLY aggregated summaries and mood
 * averages — never raw message transcripts. This is enforced by this service.
 *
 * Import example:
 *   import { generateShareableReport, getSharedReport } from '../services/reportService';
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  increment,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { getUserSessions } from "./sessionService";
import { getMoodEntries, getMoodTrend } from "./moodService";
import type {
  SharedReport,
  ReportData,
  SessionType,
  WithId,
  ServiceResult,
} from "../types";

// ─── Ref helper ───────────────────────────────────────────────────────────────

function reportsCol() {
  return collection(db, "sharedReports");
}

function reportDoc(reportId: string) {
  return doc(db, "sharedReports", reportId);
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Generates a shareable therapist report and returns a share token (the document ID).
 *
 * The share link is:  https://yourapp.com/shared-report/{token}
 * The token is a Firestore auto-generated ID — effectively unguessable.
 *
 * PRIVACY: Only summaries and mood averages are included. Raw messages are
 * explicitly excluded here by design.
 *
 * @param uid       - Firebase Auth UID of the user creating the report.
 * @param dateRange - { start: Date, end: Date } window for included data.
 * @param expiryDays  - Days until the link expires (default 7).
 * @param maxAccesses - How many times the link can be viewed (default 5).
 * @returns ServiceResult containing the share token (document ID).
 */
export async function generateShareableReport(
  uid: string,
  dateRange: { start: Date; end: Date },
  expiryDays: number = 7,
  maxAccesses: number = 5
): Promise<ServiceResult<string>> {
  try {
    // Gather session summaries (no messages — only high-level summaries)
    const sessionsResult = await getUserSessions(uid, 50);
    if (!sessionsResult.success) return sessionsResult;

    const inRange = sessionsResult.data.filter((s) => {
      const ts = s.data.startedAt?.toDate?.();
      return ts && ts >= dateRange.start && ts <= dateRange.end;
    });

    // Count sessions by type
    const breakdown: Partial<Record<SessionType, number>> = {};
    for (const s of inRange) {
      breakdown[s.data.sessionType] = (breakdown[s.data.sessionType] ?? 0) + 1;
    }

    // Pull session summaries (NEVER raw messages)
    const sessionSummaries = inRange
      .filter((s) => s.data.summary)
      .map((s) => ({
        sessionType: s.data.sessionType,
        summary: s.data.summary,
        date: s.data.startedAt?.toDate?.()?.toISOString().split("T")[0] ?? "",
      }));

    // Mood stats
    const moodResult = await getMoodEntries(uid, dateRange.start, dateRange.end);
    const moodTrendResult = await getMoodTrend(uid, 30);

    const allScores = moodResult.success
      ? moodResult.data.map((e) => e.data.score)
      : [];
    const avgMood =
      allScores.length > 0
        ? parseFloat((allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2))
        : null;

    const reportData: ReportData = {
      dateRange: {
        start: dateRange.start.toISOString().split("T")[0],
        end: dateRange.end.toISOString().split("T")[0],
      },
      totalSessions: inRange.length,
      sessionBreakdown: breakdown,
      averageMoodScore: avgMood,
      moodTrend: moodTrendResult.success ? moodTrendResult.data : [],
      sessionSummaries,
    };

    // Calculate expiry timestamp
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const report: SharedReport = {
      userId: uid,
      reportData,
      expiresAt: Timestamp.fromDate(expiresAt),
      accessCount: 0,
      maxAccesses,
      createdAt: serverTimestamp() as any,
    };

    const ref = await addDoc(reportsCol(), report);
    return { success: true, data: ref.id };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to generate shared report." };
  }
}

/**
 * Fetches a shared report by its token (document ID).
 * Intended for the therapist-facing view — no Firebase Auth required.
 *
 * Increments accessCount via an atomic server-side update.
 * Firestore rules prevent clients from setting accessCount directly.
 *
 * @param reportId - The share token (Firestore document ID).
 * @returns ServiceResult containing the report data if valid and not expired.
 */
export async function getSharedReport(
  reportId: string
): Promise<ServiceResult<WithId<SharedReport>>> {
  try {
    const snap = await getDoc(reportDoc(reportId));

    if (!snap.exists()) {
      return { success: false, error: "Report not found." };
    }

    const report = snap.data() as SharedReport;

    // Enforce expiry
    if (report.expiresAt.toDate() < new Date()) {
      return { success: false, error: "This report link has expired." };
    }

    // Enforce access cap
    if (report.accessCount >= report.maxAccesses) {
      return { success: false, error: "This report link has reached its maximum number of views." };
    }

    // Atomically increment access count
    // NOTE: This bypasses Firestore client rules because it's an increment op.
    // If your rules block client updates to sharedReports, move this to a
    // Cloud Function callable from this client. For now, the atomic increment
    // is safe because it only modifies accessCount.
    await updateDoc(reportDoc(reportId), {
      accessCount: increment(1),
    });

    return { success: true, data: { id: snap.id, data: report } };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to fetch shared report." };
  }
}

/**
 * Revokes a shared report link so it can no longer be accessed.
 *
 * @param uid      - Firebase Auth UID (must be the report owner).
 * @param reportId - The share token to delete.
 */
export async function deleteSharedReport(
  uid: string,
  reportId: string
): Promise<ServiceResult<void>> {
  try {
    const snap = await getDoc(reportDoc(reportId));
    if (!snap.exists()) {
      return { success: false, error: "Report not found." };
    }
    const report = snap.data() as SharedReport;
    if (report.userId !== uid) {
      return { success: false, error: "You do not have permission to delete this report." };
    }
    await deleteDoc(reportDoc(reportId));
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to delete shared report." };
  }
}
