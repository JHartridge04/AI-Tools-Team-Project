/**
 * Converts Firebase Auth error codes into user-friendly messages.
 *
 * @param code - The Firebase error code (e.g., "auth/email-already-in-use")
 * @returns A human-readable error string safe to display in the UI.
 */
export function friendlyAuthError(code: string): string {
  const map: Record<string, string> = {
    "auth/email-already-in-use":
      "An account with this email already exists. Try logging in instead.",
    "auth/invalid-email": "That doesn't look like a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found":
      "No account found with that email. Check the address or sign up.",
    "auth/wrong-password": "Incorrect password. Try again or reset your password.",
    "auth/too-many-requests":
      "Too many failed attempts. Please wait a few minutes and try again.",
    "auth/user-disabled":
      "This account has been disabled. Please contact support.",
    "auth/network-request-failed":
      "Network error. Check your connection and try again.",
    "auth/popup-closed-by-user": "The sign-in popup was closed. Please try again.",
    "auth/requires-recent-login":
      "For security, please log out and log back in before making this change.",
    "auth/invalid-credential":
      "Incorrect email or password. Please try again.",
  };

  return map[code] ?? "Something went wrong. Please try again.";
}
