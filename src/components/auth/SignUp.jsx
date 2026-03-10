/**
 * SignUp page — creates a new account.
 *
 * On success:
 *   • Firebase account is created
 *   • Verification email is sent
 *   • Firestore user profile is bootstrapped
 *   • User is redirected to /dashboard (or the page they originally tried to visit)
 */

import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { friendlyAuthError } from "./authErrors";

export default function SignUp() {
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const email = emailRef.current.value.trim();
    const password = passwordRef.current.value;
    const confirmPassword = confirmPasswordRef.current.value;

    // Basic client-side validation
    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }
    if (password.length < 8) {
      return setError("Password must be at least 8 characters.");
    }

    try {
      setLoading(true);
      await signup(email, password);
      setVerificationSent(true);
      // Give the user a moment to read the verification notice before moving on
      setTimeout(() => navigate("/dashboard"), 3000);
    } catch (err) {
      setError(friendlyAuthError(err.code));
    } finally {
      setLoading(false);
    }
  }

  if (verificationSent) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.heading}>Check your email</h2>
          <p style={styles.body}>
            We sent a verification link to <strong>{emailRef.current?.value}</strong>.
            Please verify your email before using the app. Redirecting you now…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Create your account</h2>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              ref={emailRef}
              type="email"
              required
              autoComplete="email"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              ref={passwordRef}
              type="password"
              required
              autoComplete="new-password"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Confirm Password
            <input
              ref={confirmPasswordRef}
              type="password"
              required
              autoComplete="new-password"
              style={styles.input}
            />
          </label>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Creating account…" : "Sign Up"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Minimal inline styles (replace with your design system / Tailwind classes) ─

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#f0f4f8",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "2rem",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  heading: { marginBottom: "1.25rem", fontSize: "1.5rem", fontWeight: 700 },
  body: { lineHeight: 1.6, color: "#444" },
  errorBox: {
    background: "#fff0f0",
    border: "1px solid #ffb3b3",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    color: "#c0392b",
    marginBottom: "1rem",
    fontSize: "0.9rem",
  },
  form: { display: "flex", flexDirection: "column", gap: "1rem" },
  label: { display: "flex", flexDirection: "column", gap: 4, fontWeight: 500, fontSize: "0.95rem" },
  input: {
    padding: "0.6rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: "1rem",
    marginTop: 2,
  },
  button: {
    padding: "0.75rem",
    borderRadius: 8,
    border: "none",
    background: "#6c63ff",
    color: "#fff",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
    opacity: 1,
  },
  footer: { marginTop: "1rem", textAlign: "center", fontSize: "0.9rem" },
};
