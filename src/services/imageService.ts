/**
 * imageService.ts — DALL-E 3 image generation via the backend proxy.
 *
 * The OpenAI API key lives only in server/.env — this service never touches it
 * directly. All requests go through POST /api/generate-image.
 *
 * Import example:
 *   import { generateDreamImage } from '../services/imageService';
 */

import type { ServiceResult } from "../types";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

/** Shape returned by the /api/generate-image proxy endpoint. */
export interface GeneratedImage {
  /** The CDN URL of the generated image (valid for ~1 hour from generation). */
  imageUrl: string;
  /**
   * The prompt DALL-E actually used. DALL-E 3 auto-revises prompts for safety
   * and clarity — this may differ from what was sent.
   */
  revisedPrompt: string;
}

/**
 * Generates a dream visualization image via DALL-E 3.
 *
 * The prompt should be pre-screened by the Cultural Mirror before calling this
 * function so that inclusive language reaches the image API.
 *
 * Image generation typically takes 10–30 seconds. This function uses a 60-second
 * timeout before returning an error.
 *
 * @param prompt - The image prompt (1-1000 characters).
 */
export async function generateDreamImage(
  prompt: string
): Promise<ServiceResult<GeneratedImage>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(`${API_URL}/api/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error:
          (body as any).error ||
          "We couldn't generate an image right now. Your visualization text is still available.",
      };
    }

    const data = (await res.json()) as GeneratedImage;
    if (!data.imageUrl) {
      return { success: false, error: "No image was returned. Please try again." };
    }

    return { success: true, data };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return {
        success: false,
        error: "Image generation timed out. Your visualization text is still available.",
      };
    }
    return {
      success: false,
      error:
        err.message ||
        "We couldn't generate an image right now. Your visualization text is still available.",
    };
  }
}
