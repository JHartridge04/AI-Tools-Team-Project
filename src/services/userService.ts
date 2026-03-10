/**
 * userService.ts — Firestore operations for the /users collection.
 *
 * TEAMMATES: Import and call these functions anywhere you need user profile data.
 *   import { getUserProfile, updateUserProfile } from '../services/userService';
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import type { UserProfile, ServiceResult } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function userRef(uid: string) {
  return doc(db, "users", uid);
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Creates the Firestore user profile document immediately after signup.
 * Called automatically by AuthContext.signup() — you don't need to call
 * this manually unless you're handling signup outside of AuthContext.
 *
 * @param uid   - Firebase Auth UID of the new user.
 * @param email - The email address used to sign up.
 * @returns ServiceResult with the created profile or an error message.
 */
export async function createUserProfile(
  uid: string,
  email: string
): Promise<ServiceResult<UserProfile>> {
  try {
    const profile: UserProfile = {
      email,
      preferredTherapyMode: "talk",
      onboardingComplete: false,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };
    await setDoc(userRef(uid), profile);
    return { success: true, data: profile };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to create user profile." };
  }
}

/**
 * Fetches a user's profile document.
 *
 * @param uid - Firebase Auth UID.
 * @returns ServiceResult containing the UserProfile, or an error if not found.
 */
export async function getUserProfile(
  uid: string
): Promise<ServiceResult<UserProfile>> {
  try {
    const snap = await getDoc(userRef(uid));
    if (!snap.exists()) {
      return { success: false, error: "User profile not found." };
    }
    return { success: true, data: snap.data() as UserProfile };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to fetch user profile." };
  }
}

/**
 * Partially updates a user's profile (e.g., displayName or therapy preferences).
 * Only the fields you pass will be changed — all other fields are untouched.
 *
 * @param uid  - Firebase Auth UID.
 * @param data - Partial UserProfile fields to update.
 * @returns ServiceResult<void> indicating success or failure.
 *
 * @example
 *   await updateUserProfile(uid, { displayName: "Alex", preferredTherapyMode: "exploratory" });
 */
export async function updateUserProfile(
  uid: string,
  data: Partial<Omit<UserProfile, "createdAt" | "updatedAt" | "email">>
): Promise<ServiceResult<void>> {
  try {
    await updateDoc(userRef(uid), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return { success: true, data: undefined };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Failed to update user profile." };
  }
}
