/**
 * Login page — authenticates an existing user.
 *
 * On success, redirects to the page the user originally tried to visit
 * (stored in location.state.from by ProtectedRoute), or /dashboard.
 */

import React, { useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { friendlyAuthError } from "./authErrors";

export default function Login() {
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to where the user was trying to go, or fall back to /dashboard
  const from = location.state?.from?.pathname ?? "/dashboard";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      await login(emailRef.current.value.trim(), passwordRef.current.value);
      navigate(from, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Welcome back</h2>

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
              autoComplete="current-password"
              style={styles.input}
            />
          </label>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Signing in…" : "Log In"}
          </button>
        </form>

        <p style={styles.footer}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p style={styles.footer}>
          Don't have an account? <Link to="/signup">Sign up</Link>
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
  heading: { marginBottom: "1.25rem", fontSize: "1.5rem", fontWeight: 700 },
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
  },
  footer: { marginTop: "0.75rem", textAlign: "center", fontSize: "0.9rem" },
};
