import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Simple health probe for Cloud Run + local dev.
 * - hasKey: whether the video API key is visible to the container
 * - envs: which env names exist (no values leaked)
 * - rev/service: Cloud Run metadata so you know which revision you’re hitting
 */
export async function GET() {
  const hasGemini =
    !!process.env.GEMINI_API_KEY ||
    !!process.env.GOOGLE_GENAI_API_KEY ||
    !!process.env._GEMINI_API_KEY;

  const keysFound = [
    "GEMINI_API_KEY",
    "GOOGLE_GENAI_API_KEY",
    "_GEMINI_API_KEY",
  ].filter((k) => !!process.env[k as keyof NodeJS.ProcessEnv]);

  // Cloud Run provides these metadata env vars
  const rev = process.env.K_REVISION || null;
  const svc = process.env.K_SERVICE || null;

  return NextResponse.json({
    ok: true,
    hasKey: hasGemini,
    keysFound,     // names only; no secrets leaked
    service: svc,  // e.g., "jab-vid-builder"
    revision: rev, // e.g., "jab-vid-builder-00019-abc"
  });
}
