/**
 * AuthContext — global authentication state for the Adaptive Wellness Companion.
 *
 * USAGE (in any component):
 *   import { useAuth } from '../contexts/AuthContext';
 *   const { currentUser, login, logout } = useAuth();
 *
 * Wrap your entire app with <AuthProvider> in index.tsx / App.tsx.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase/config";
import { createUserProfile } from "../services/userService";

// ─── Context Shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** The currently signed-in Firebase user, or null if not authenticated. */
  currentUser: User | null;
  /** True while Firebase is resolving the initial auth state on page load. */
  loading: boolean;
  /**
   * Create a new account, send a verification email, and create the Firestore
   * user profile document.
   */
  signup: (email: string, password: string) => Promise<void>;
  /** Sign in with email and password. */
  login: (email: string, password: string) => Promise<void>;
  /** Sign the current user out. */
  logout: () => Promise<void>;
  /** Send a password-reset email to the given address. */
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to Firebase auth state changes once on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe; // Cleanup listener on unmount
  }, []);

  async function signup(email: string, password: string): Promise<void> {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    // Send verification email so we know the address is reachable
    await sendEmailVerification(credential.user);
    // Bootstrap the Firestore user document immediately after account creation
    await createUserProfile(credential.user.uid, email);
  }

  async function login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout(): Promise<void> {
    await signOut(auth);
  }

  async function resetPassword(email: string): Promise<void> {
    // actionCodeSettings tells Firebase where to redirect after password reset.
    // This ensures the "Continue" link in the email points to the deployed app.
    const actionCodeSettings = {
      url: window.location.origin + "/login",
      handleCodeInApp: false,
    };
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
  }

  const value: AuthContextValue = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    resetPassword,
  };

  // Don't render children until auth state is known — avoids redirect flicker
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access authentication state and actions from any component.
 * Must be used inside an <AuthProvider> tree.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
