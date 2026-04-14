/**
 * culturalMirrorService.ts — Bias detection for image prompts and therapist responses.
 *
 * Calls the backend proxy at POST /api/cultural-mirror, which in turn sends a
 * structured audit request to Claude. Returns a BiasAudit result indicating
 * whether bias was detected and, if so, a revised inclusive version of the text.
 *
 * Import example:
 *   import { checkImagePrompt, checkTherapistResponse, BiasAudit }
 *     from '../services/culturalMirrorService';
 */

import type { ServiceResult } from "../types";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BiasAudit {
  /** Whether any bias was detected in the input text. */
  biasDetected: boolean;
  /** Confidence level of the bias assessment. */
  confidence: "high" | "medium" | "low";
  /** List of bias category labels (e.g. "gender", "racial", "cultural"). Empty when no bias found. */
  biasTypes: string[];
  /** Human-readable explanation of the bias found. Empty string when no bias found. */
  explanation: string;
  /** The original input text, echoed back for comparison. */
  originalText: string;
  /** Rewritten inclusive version of the text. Equal to originalText when no bias found. */
  revisedText: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Sends a text payload to POST /api/cultural-mirror and parses the BiasAudit
 * JSON that Claude returns.
 */
async function callCulturalMirror(
  text: string,
  type: "image_prompt" | "therapist_response",
  context?: string
): Promise<ServiceResult<BiasAudit>> {
  try {
    const res = await fetch(`${API_URL}/api/cultural-mirror`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, type, context }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: (body as any).error || `Server error ${res.status}`,
      };
    }

    const data = await res.json();

    // Validate the shape — Claude occasionally wraps the object in a `result` key
    const audit: BiasAudit = data.biasDetected !== undefined ? data : data.result;

    if (!audit || typeof audit.biasDetected !== "boolean") {
      return { success: false, error: "Unexpected response shape from cultural mirror." };
    }

    return { success: true, data: audit };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to reach the cultural mirror service.",
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Audits an image generation prompt for implicit bias before it reaches an
 * image API. Returns a revised, inclusive version of the prompt if bias is found.
 *
 * @param prompt - The image prompt to audit.
 */
export async function checkImagePrompt(
  prompt: string
): Promise<ServiceResult<BiasAudit>> {
  return callCulturalMirror(prompt, "image_prompt");
}

/**
 * Audits an AI therapist response for cultural assumptions, stereotyping, or
 * non-inclusive advice. Rewrites the response if bias is detected.
 *
 * @param response - The AI-generated therapist response to audit.
 * @param context  - Optional user context (e.g. "User mentioned they are Buddhist").
 */
export async function checkTherapistResponse(
  response: string,
  context?: string
): Promise<ServiceResult<BiasAudit>> {
  return callCulturalMirror(response, "therapist_response", context);
}
