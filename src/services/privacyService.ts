/**
 * privacyService.ts — GDPR / account-deletion data erasure.
 *
 * deleteAllUserData() recursively removes every document owned by a user:
 *   • /users/{uid} (profile)
 *   • /users/{uid}/sessions/* (sessions)
 *   • /users/{uid}/sessions/{id}/messages/* (messages within each session)
 *   • /users/{uid}/moodEntries/* (mood logs)
 *   • /sharedReports/* where userId == uid
 *
 * Call this only on explicit account-deletion requests, not on logout.
 *
 * ⚠️  WARNING: This operation is IRREVERSIBLE. There is no undo.
 *     Consider adding a confirmation step in the UI before calling this.
 *
 * TEAMMATES: You should not need to call this directly. It will be wired
 * to the "Delete my account" button in the settings page.
 */

import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import type { ServiceResult } from "../types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Deletes every document in a collection reference. */
async function deleteCollection(colPath: string): Promise<void> {
  const snap = await getDocs(collection(db, colPath));
  const deletions = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletions);
}

/** Deletes all messages within a single session. */
async function deleteSessionMessages(uid: string, sessionId: string): Promise<void> {
  await deleteCollection(`users/${uid}/sessions/${sessionId}/messages`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Permanently deletes all data associated with a user account.
 *
 * This covers:
 *   1. All messages in every session (deepest level first)
 *   2. All sessions
 *   3. All mood entries
 *   4. All shared reports created by this user
 *   5. The top-level user profile document
 *
 * Does NOT delete the Firebase Auth account — call
 * `user.delete()` from Firebase Auth after this to complete the deletion.
 *
 * @param uid - Firebase Auth UID of the user to erase.
 * @returns ServiceResult<void> indicating success or describing the error.
 *
 * @example
 *   const { currentUser } = useAuth();
 *   const result = await deleteAllUserData(currentUser.uid);
 *   if (result.success) await currentUser.delete(); // remove the Auth record too
 */
export async function deleteAllUserData(uid: string): Promise<ServiceResult<void>> {
  try {
    // ── 1. Delete messages within each session ──────────────────────────────
    const sessionsSnap = await getDocs(collection(db, "users", uid, "sessions"));
    await Promise.all(
      sessionsSnap.docs.map((s) => deleteSessionMessages(uid, s.id))
    );

    // ── 2. Delete all sessions ──────────────────────────────────────────────
    await deleteCollection(`users/${uid}/sessions`);

    // ── 3. Delete all mood entries ──────────────────────────────────────────
    await deleteCollection(`users/${uid}/moodEntries`);

    // ── 4. Delete all shared reports owned by this user ─────────────────────
    //
    // NOTE: Firestore doesn't support server-side queries on delete without
    // reading first. We query sharedReports where userId == uid, then delete.
    // This requires the Firestore rules to allow the user to read their own
    // shared reports during deletion — or run via admin SDK in a Cloud Function.
    const reportsSnap = await getDocs(
      query(collection(db, "sharedReports"), where("userId", "==", uid))
    );
    await Promise.all(reportsSnap.docs.map((d) => deleteDoc(d.ref)));

    // ── 5. Delete the user profile document ────────────────────────────────
    await deleteDoc(doc(db, "users", uid));

    return { success: true, data: undefined };
  } catch (err: any) {
    return {
      success: false,
      error: err.message ?? "Failed to delete user data. Please contact support.",
    };
  }
}
