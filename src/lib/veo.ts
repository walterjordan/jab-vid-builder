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
function resolveApiKey(explicit?: string): string {
  return (
    explicit ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    (process.env as any)._GEMINI_API_KEY ||
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

  const ai = new GoogleGenAI({ apiKey });

  // --- Call the video generation API
  const op: any = await ai.models.generateVideos({
    model,
    prompt,
    config: {
      aspectRatio,
      resolution,
      ...(typeof seed === "number" ? { seed } : {}),
      durationSeconds: clamped, // <= enforce model limit
      personGeneration: "allow_all",
      negativePrompt:
        "cartoon, drawing, low quality, watermark, text overlay",
    },
  });

  // --- Case 1: provider already returned a playable URI
  if (op?.uri && typeof op.uri === "string") {
    return {
      uri: op.uri,
      requestedDurationSeconds: requested,
      durationSeconds: clamped,
      ...(didClamp
        ? { note: "Duration limited to 4–8s by the model. Value was clamped." }
        : {}),
    };
  }

  // --- Case 2: long-running operation (poll until done)
  // Some SDK versions expose ai.operations.get; otherwise op.get() may exist.
  const operations = (ai as any).operations;
  const getOp =
    (operations && typeof operations.get === "function" && operations.get.bind(operations)) ||
    (op && typeof op.get === "function" && op.get.bind(op));

  if (op?.name && getOp) {
    // Poll every 2s up to ~4 minutes
    const maxTries = 120;
    for (let i = 0; i < maxTries; i++) {
      const cur: any = await getOp({ name: op.name });
      const uri =
        cur?.response?.video?.uri ||
        cur?.response?.uri ||
        cur?.uri;

      if (cur?.done && uri) {
        return {
          uri,
          requestedDurationSeconds: requested,
          durationSeconds: clamped,
          ...(didClamp
            ? { note: "Duration limited to 4–8s by the model. Value was clamped." }
            : {}),
        };
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Video generation timed out while polling the operation.");
  }

  // --- Unexpected response shape
  throw new Error("Unexpected response from generateVideos (no uri/operation).");
}


