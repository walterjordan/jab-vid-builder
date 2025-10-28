// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateVeoVideo } from "@/lib/veo";

/** Accept either a plain string id or an object with { name } and return a model id. */
function coerceModel(v: unknown, fallback = "veo-3.0-fast-generate-001"): string {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v && typeof v === "object" && "name" in (v as any)) {
    const n = (v as any).name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  return fallback;
}

function coerceString(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function coerceNumber(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Simple health check: confirms the route is reachable. */
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    // Required
    const prompt = coerceString(body?.prompt);
    if (!prompt || prompt.length < 5) {
      return NextResponse.json(
        { error: "Prompt is required (min 5 characters)." },
        { status: 400 }
      );
    }

    // Optional / defaults
    const aspectRatio = coerceString(body?.aspectRatio, "16:9") || "16:9";
    const resolution = coerceString(body?.resolution, "720p") || "720p";

    // Duration: clamp 4–8s
    const requestedDuration = coerceNumber(body?.durationSeconds) ?? 6;
    const durationSeconds = Math.max(4, Math.min(8, requestedDuration));

    // Model: accept string or { name }, default to fast 3.0
    const modelId = coerceModel(body?.model, "veo-3.0-fast-generate-001");

    // Seed: Veo currently ignores seed; do NOT send it (prevents API errors).
    // const seed = coerceNumber(body?.seed); // intentionally unused

    // Call generator (no seed passed)
    const result: any = await generateVeoVideo({
      prompt,
      aspectRatio,
      resolution,
      durationSeconds,
      model: modelId,
    });

    // Build response payload safely without relying on a typed `note` field
    const payload: any = {
      uri: result?.uri,
      requestedDurationSeconds: requestedDuration,
      durationSeconds: durationSeconds,
      model: modelId,
      aspectRatio,
      resolution,
    };
    if (result && typeof result === "object" && "note" in result) {
      payload.note = (result as any).note;
    }

    if (!payload.uri) {
      // Defensive: if provider returned no URI
      return NextResponse.json(
        { error: "Generation finished without a playable URI." },
        { status: 502 }
      );
    }

    return NextResponse.json(payload);
  } catch (err: any) {
    // Normalize common GoogleGenAI errors where message may contain a wrapped JSON
    const msg = typeof err?.message === "string" ? err.message : "Unknown error";
    const isInvalidArg = /INVALID_ARGUMENT|400/.test(msg);
    const status = isInvalidArg ? 400 : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}

