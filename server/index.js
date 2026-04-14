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
const Anthropic = require("@anthropic-ai/sdk").default;

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
 *     model: "claude-sonnet-4-6",
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
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: req.body.model || "claude-sonnet-4-6",
      system: req.body.system || "",
      messages: req.body.messages || [],
      max_tokens: req.body.max_tokens || 1024,
    });

    // Success — send the full response back to the frontend
    return res.json(message);
  } catch (err) {
    console.error("Proxy error:", err);
    // Surface Anthropic API errors with the original status code when available
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message || "Failed to reach the Anthropic API. Check your network and API key.",
    });
  }
});

// ─── DALL-E 3 image generation endpoint ──────────────────────────────────────

/**
 * POST /api/generate-image
 *
 * Generates an image via OpenAI's DALL-E 3 API, downloads the bytes from the
 * Azure CDN URL that DALL-E returns, and proxies them back to the client as a
 * base64 data URL.  This avoids DNS/network issues where the client cannot
 * resolve oaidalleapiprodscus.blob.core.windows.net directly.
 * The OPENAI_API_KEY never leaves the server.
 *
 * Request body:  { prompt: string }  — 1-1000 characters
 * Response:      { imageUrl: "data:image/png;base64,...", revisedPrompt: string }
 */
app.post("/api/generate-image", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not set in server/.env");
    return res.status(500).json({
      error: "Image generation is not configured — OPENAI_API_KEY is missing.",
    });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing required field: prompt (string)." });
  }
  if (prompt.trim().length === 0) {
    return res.status(400).json({ error: "Prompt must not be empty." });
  }
  if (prompt.length > 1000) {
    return res.status(400).json({ error: "Prompt must be 1-1000 characters." });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt.trim(),
        n: 1,
        size: "1792x1024",
        quality: "standard",
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const message = errBody?.error?.message || `OpenAI error ${response.status}`;
      console.error("DALL-E error:", message);

      if (response.status === 429) {
        return res.status(429).json({
          error: "Image generation is temporarily unavailable due to rate limits. Please try again in a moment.",
        });
      }
      if (response.status === 400) {
        return res.status(400).json({
          error: "The image prompt was rejected. Try rephrasing your description.",
        });
      }
      return res.status(500).json({
        error: "Image generation failed. Your visualization text is still available below.",
      });
    }

    const data = await response.json();
    const imageResult = data.data?.[0];
    if (!imageResult?.url) {
      return res.status(500).json({ error: "No image was returned. Please try again." });
    }

    // Download the image bytes from the Azure CDN URL.
    // The frontend may not be able to resolve the Azure hostname directly, so
    // the server proxies the bytes and returns them as a base64 data URL instead.
    const downloadController = new AbortController();
    const downloadTimeout = setTimeout(() => downloadController.abort(), 30_000);

    let imageDataUrl;
    try {
      const imgResponse = await fetch(imageResult.url, { signal: downloadController.signal });
      clearTimeout(downloadTimeout);

      if (!imgResponse.ok) {
        console.error("Image download failed:", imgResponse.status);
        return res.status(502).json({
          error: "Image was generated but could not be downloaded. Please try again.",
        });
      }

      const contentType = imgResponse.headers.get("content-type") || "image/png";
      const buffer = await imgResponse.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      // Reject unexpectedly large payloads before they hit the client
      const MAX_BASE64_BYTES = 10 * 1024 * 1024; // 10 MB
      if (base64.length > MAX_BASE64_BYTES) {
        console.error("Generated image exceeded 10 MB base64 limit:", base64.length);
        return res.status(502).json({
          error: "The generated image was too large to deliver. Please try again.",
        });
      }

      imageDataUrl = `data:${contentType};base64,${base64}`;
    } catch (dlErr) {
      clearTimeout(downloadTimeout);
      if (dlErr.name === "AbortError") {
        return res.status(504).json({
          error: "Image download timed out. Please try again.",
        });
      }
      console.error("Image download error:", dlErr);
      return res.status(502).json({
        error: "Image was generated but could not be delivered. Please try again.",
      });
    }

    return res.json({
      imageUrl: imageDataUrl,
      revisedPrompt: imageResult.revised_prompt || prompt,
    });
  } catch (err) {
    console.error("Image generation proxy error:", err);
    return res.status(500).json({
      error: "Could not reach the image generation service. Your visualization text is still available.",
    });
  }
});

// ─── Cultural Mirror endpoint ─────────────────────────────────────────────────

/**
 * POST /api/cultural-mirror
 *
 * Audits a piece of text for implicit bias and returns a structured JSON report.
 *
 * Request body:
 *   {
 *     text:    string,                                  // text to audit
 *     type:    "image_prompt" | "therapist_response",  // audit mode
 *     context: string (optional)                        // extra user context
 *   }
 *
 * Response — BiasAudit object:
 *   {
 *     biasDetected: boolean,
 *     confidence:   "high" | "medium" | "low",
 *     biasTypes:    string[],
 *     explanation:  string,
 *     originalText: string,
 *     revisedText:  string
 *   }
 */
app.post("/api/cultural-mirror", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set in server/.env");
    return res.status(500).json({
      error: "Server misconfigured — ANTHROPIC_API_KEY is missing.",
    });
  }

  const { text, type, context } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing required field: text (string)." });
  }

  const modeLabel =
    type === "therapist_response"
      ? "an AI therapist response"
      : "an image generation prompt";

  const contextClause =
    context && typeof context === "string" && context.trim()
      ? `\n\nAdditional user context: ${context.trim()}`
      : "";

  const systemPrompt = `You are the Cultural Mirror, a bias-detection specialist. Your job is to audit ${modeLabel} for implicit bias — including racial, gender, age, cultural, religious, and socioeconomic assumptions or stereotypes.

When you receive a text, respond ONLY with a valid JSON object matching this exact shape (no markdown, no code fences, no extra keys):
{
  "biasDetected": boolean,
  "confidence": "high" | "medium" | "low",
  "biasTypes": string[],
  "explanation": string,
  "originalText": string,
  "revisedText": string
}

Rules:
- "biasDetected" is true only if you have clear evidence of bias.
- "confidence" reflects how certain you are of your assessment.
- "biasTypes" lists short category labels (e.g. "gender", "racial", "cultural", "religious", "age", "socioeconomic"). Empty array when no bias found.
- "explanation" explains the bias in 1-2 sentences. Empty string when no bias found.
- "originalText" is the input text, copied verbatim.
- "revisedText" is an inclusive rewrite preserving original intent. Equal to "originalText" when no bias is found.
- Be precise — do not flag text that is merely specific or that names a cultural group in a neutral, accurate way.`;

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please audit the following text for bias:${contextClause}\n\n"${text}"`,
        },
      ],
      max_tokens: 1024,
    });

    // Extract the text content from Claude's response
    const rawContent =
      message.content && message.content[0] && message.content[0].type === "text"
        ? message.content[0].text
        : "";

    // Parse the JSON Claude returned — strip accidental code fences if present
    const cleaned = rawContent.replace(/```(?:json)?/gi, "").trim();
    let audit;
    try {
      audit = JSON.parse(cleaned);
    } catch {
      console.error("Cultural mirror: failed to parse Claude JSON:", rawContent);
      return res.status(500).json({
        error: "Cultural mirror returned malformed JSON. Please try again.",
      });
    }

    return res.json(audit);
  } catch (err) {
    console.error("Cultural mirror proxy error:", err);
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message || "Failed to reach the Anthropic API.",
    });
  }
});

// ─── Start server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓ Proxy server running on http://localhost:${PORT}`);
  console.log(`  POST /api/chat            → forwards to Anthropic Messages API`);
  console.log(`  POST /api/generate-image  → DALL-E 3 image generation via OpenAI`);
  console.log(`  POST /api/cultural-mirror → bias audit via Claude`);
  console.log(`  GET  /api/health          → health check`);
  console.log();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠ WARNING: ANTHROPIC_API_KEY is not set in server/.env");
    console.warn("  The /api/chat and /api/cultural-mirror endpoints will return 500 until you set it.");
  }
});
