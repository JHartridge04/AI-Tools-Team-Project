/**
 * server/index.js — Backend proxy for the Anthropic Claude API.
 *
 * WHY THIS EXISTS:
 *   Calling the Anthropic API directly from the browser would expose your
 *   secret API key in network requests (anyone could open DevTools and see it).
 *   This tiny Express server sits between the React frontend and the Anthropic
 *   API. The secret key lives only on the server — the browser never sees it.
 *
 * HOW IT WORKS:
 *   1. The React app sends a POST to http://localhost:3001/api/chat
 *      with { model, system, messages, max_tokens } in the body.
 *   2. This server attaches the real API key and forwards the request
 *      to https://api.anthropic.com/v1/messages.
 *   3. The Anthropic response is relayed back to the React app.
 *
 * SETUP:
 *   1. cd server
 *   2. npm install
 *   3. Create a .env file in this folder with:
 *        ANTHROPIC_API_KEY=sk-ant-...your-key-here...
 *   4. npm start
 *   5. The proxy runs on http://localhost:3001
 *
 * The React app's proxy setting (in the root package.json) or the
 * REACT_APP_API_URL env var tells the frontend where to find this server.
 *
 * TEAMMATES: You don't need to touch this file unless you're changing the
 * API model or adding new endpoints. Just make sure it's running when you
 * test the AI therapist feature locally.
 */

const express = require("express");
const cors = require("cors");

// Load environment variables from server/.env
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

// Allow requests from the React dev server (http://localhost:3000)
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "http://localhost:3000",
  })
);

// Parse JSON request bodies (Claude API messages can be large)
app.use(express.json({ limit: "1mb" }));

// ─── Health check ────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ─── Main proxy endpoint ─────────────────────────────────────────────────────

/**
 * POST /api/chat
 *
 * Expects a JSON body with the same shape the Anthropic Messages API accepts:
 *   {
 *     model: "claude-sonnet-4-20250514",
 *     system: "You are a therapist...",
 *     messages: [{ role: "user", content: "Hello" }, ...],
 *     max_tokens: 1024
 *   }
 *
 * Returns the Anthropic API response as-is, or an error object.
 */
app.post("/api/chat", async (req, res) => {
  // Make sure the API key is configured
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set in server/.env");
    return res.status(500).json({
      error: "Server misconfigured — ANTHROPIC_API_KEY is missing.",
    });
  }

  try {
    // Forward the request to Anthropic's Messages API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: req.body.model || "claude-sonnet-4-20250514",
        system: req.body.system || "",
        messages: req.body.messages || [],
        max_tokens: req.body.max_tokens || 1024,
      }),
    });

    // Parse the Anthropic response
    const data = await response.json();

    // If Anthropic returned an error, pass it through with the right status
    if (!response.ok) {
      console.error("Anthropic API error:", data);
      return res.status(response.status).json(data);
    }

    // Success — send the full response back to the frontend
    return res.json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({
      error: "Failed to reach the Anthropic API. Check your network and API key.",
    });
  }
});

// ─── Start server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓ Proxy server running on http://localhost:${PORT}`);
  console.log(`  POST /api/chat   → forwards to Anthropic Messages API`);
  console.log(`  GET  /api/health → health check`);
  console.log();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠ WARNING: ANTHROPIC_API_KEY is not set in server/.env");
    console.warn("  The /api/chat endpoint will return 500 until you set it.");
  }
});
