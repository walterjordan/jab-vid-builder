// src/lib/veo.ts
import { GoogleGenAI } from "@google/genai";

/** Current model hard limits for video duration (seconds). */
export const MIN_DURATION = 4;
export const MAX_DURATION = 8;

export type VeoRequest = {
  prompt: string;
  /** "16:9" | "9:16" | "1:1" */
  aspectRatio?: string;
  /** "720p" | "1080p" | "4k" */
  resolution?: string;
  /** Desired seconds (will be clamped to 4–8 inclusive). */
  durationSeconds?: number;
  /** Optional seed for reproducibility. */
  seed?: number;
  /** Model id, default "veo-3.0-generate-001" */
  model?: string;
  /** Optional explicit API key (otherwise resolved from env). */
  apiKey?: string;
};

export type VeoResult = {
  uri: string;
  /** What caller asked for. */
  requestedDurationSeconds: number;
  /** What we actually sent to the provider (after clamping). */
  durationSeconds: number;
  /** Present if we had to clamp to the model's limits. */
  note?: string;
};

/** Resolve the API key from common env names. */
function resolveApiKey(explicit?: string) {
  return (
    explicit ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env._GEMINI_API_KEY ||
    ""
  );
}

/** Normalize + clamp a possibly-invalid duration to model limits. */
function normalizeDuration(value: unknown, fallback = 8) {
  const n = Number(value);
  const requested = Number.isFinite(n) ? n : fallback;
  const clamped = Math.max(MIN_DURATION, Math.min(MAX_DURATION, requested));
  const didClamp = requested !== clamped;
  return { requested, clamped, didClamp };
}

/**
 * Generate a video via Gemini (Veo).
 * Handles immediate-URI responses and long-running-operations (polling).
 */
export async function generateVeoVideo(req: VeoRequest): Promise<VeoResult> {
  const {
    prompt,
    aspectRatio = "16:9",
    resolution = "1080p",
    durationSeconds,
    seed,
    model = "veo-3.0-generate-001",
    apiKey: explicitKey,
  } = req;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    throw new Error("Prompt is required (min 5 characters).");
  }

  const apiKey = resolveApiKey(explicitKey);
  if (!apiKey) {
    throw new Error(
      "Missing API key (set GEMINI_API_KEY / GOOGLE_GENAI_API_KEY / _GEMINI_API_KEY)."
    );
  }

  const { requested, clamped, didClamp } = normalizeDuration(durationSeconds, 8);

  const ai = new GoogleGenAI({ apiKey

