/**
 * ForgotPassword page — sends a Firebase password-reset email.
 *
 * Displays a success message after submission so the user knows to check
 * their inbox, regardless of whether the address is registered (prevents
 * email enumeration attacks).
 */

import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { friendlyAuthError } from "./authErrors";

export default function ForgotPassword() {
  const emailRef = useRef(null);
  const { resetPassword } = useAuth();

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      setLoading(true);
      await resetPassword(emailRef.current.value.trim());
      // Generic success — don't reveal whether the email exists in our system
      setMessage(
        "If an account with that email exists, a reset link has been sent. Check your inbox (and spam folder)."
      );
    } catch (err) {
      setError(friendlyAuthError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Reset your password</h2>
        <p style={styles.subtext}>
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {error && <div style={styles.errorBox}>{error}</div>}
        {message && <div style={styles.successBox}>{message}</div>}

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

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
        </form>

        <p style={styles.footer}>
          Remember your password? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

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
  heading: { marginBottom: "0.5rem", fontSize: "1.5rem", fontWeight: 700 },
  subtext: { color: "#666", marginBottom: "1.25rem", fontSize: "0.95rem" },
  errorBox: {
    background: "#fff0f0",
    border: "1px solid #ffb3b3",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    color: "#c0392b",
    marginBottom: "1rem",
    fontSize: "0.9rem",
  },
  successBox: {
    background: "#f0fff4",
    border: "1px solid #b3f5cc",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    color: "#1a7a40",
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
  },
  footer: { marginTop: "1rem", textAlign: "center", fontSize: "0.9rem" },
};
