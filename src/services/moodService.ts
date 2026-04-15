/**
 * moodService.ts — Firestore operations for mood tracking.
 *
 * TEAMMATES (mood tracking feature):
 *   • Call addMoodEntry() to log a mood from any source (manual, post-session, check-in).
 *   • Call getMoodTrend() to get averaged data for charts.
 *
 * Import example:
 *   import { addMoodEntry, getMoodTrend } from '../services/moodService';
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import type { MoodEntry, MoodSource, WithId, ServiceResult } from "../types";

// ─── Ref helper ───────────────────────────────────────────────────────────────

function moodCol(uid: string) {
  return collection(db, "users", uid, "moodEntries");
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Logs a mood entry for the user.
 *
 * @param uid              - Firebase Auth UID.
 * @param score            - Mood score 1–10.
 * @param note             - Optional free-text note from the user.
 * @param tags             - Optional descriptive tags e.g. ["anxious", "hopeful"].
 * @param source           - Where the entry came from: "manual" | "post_session" | "check_in".
 * @param relatedSessionId - Optional session ID if mood was logged after a session.
 * @returns ServiceResult containing the new mood entry ID.
 */
export async function addMoodEntry(
  uid: string,
  score: number,
  note?: string,
  tags?: string[],
  source?: MoodSource,
  relatedSessionId?: string
): Promise<ServiceResult<string>> {
  try {
    if (score < 1 || score > 10) {
      return { success: false, error: "Mood score must be between 1 and 10." };
    }
    const entry: MoodEntry = {
      score,
      ...(note ? { note } : {}),
      tags: tags ?? [],
      source: source ?? "manual",
      relatedSessionId: relatedSessionId ?? null,
      createdAt: serverTimestamp() as any,
    };
    const ref = await addDoc(moodCol(uid), entry);
    return { success: true, data: ref.id };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to log mood entry." };
  }
}

/**
 * Fetches mood entries within an optional date range, newest first.
 *
 * @param uid       - Firebase Auth UID.
 * @param startDate - Optional start of the date range.
 * @param endDate   - Optional end of the date range.
 */
export async function getMoodEntries(
  uid: string,
  startDate?: Date,
  endDate?: Date
): Promise<ServiceResult<WithId<MoodEntry>[]>> {
  try {
    let q = query(moodCol(uid), orderBy("createdAt", "desc"));

    if (startDate && endDate) {
      q = query(
        moodCol(uid),
        where("createdAt", ">=", Timestamp.fromDate(startDate)),
        where("createdAt", "<=", Timestamp.fromDate(endDate)),
        orderBy("createdAt", "desc")
      );
    } else if (startDate) {
      q = query(
        moodCol(uid),
        where("createdAt", ">=", Timestamp.fromDate(startDate)),
        orderBy("createdAt", "desc")
      );
    }

    const snap = await getDocs(q);
    const entries = snap.docs.map((d) => ({ id: d.id, data: d.data() as MoodEntry }));
    return { success: true, data: entries };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to fetch mood entries." };
  }
}

/**
 * Calculates average mood per day over the last N days.
 * Useful for rendering trend charts.
 *
 * @param uid  - Firebase Auth UID.
 * @param days - Number of days to look back (default 7). Common values: 7, 14, 30.
 * @returns Array of { date: "YYYY-MM-DD", averageScore: number } sorted oldest → newest.
 *
 * @example
 *   const trend = await getMoodTrend(uid, 30);
 *   // Pass trend.data to your charting library.
 */
export async function getMoodTrend(
  uid: string,
  days: number = 7
): Promise<ServiceResult<Array<{ date: string; averageScore: number }>>> {
  try {
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const result = await getMoodEntries(uid, start, new Date());
    if (!result.success) return result;

    // Group scores by calendar date
    const byDate: Record<string, number[]> = {};
    for (const { data } of result.data) {
      const dateKey = data.createdAt?.toDate?.()?.toISOString().split("T")[0];
      if (!dateKey) continue;
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(data.score);
    }

    // Average each date's scores and sort chronologically
    const trend = Object.entries(byDate)
      .map(([date, scores]) => ({
        date,
        averageScore: parseFloat(
          (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data: trend };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to calculate mood trend." };
  }
}
