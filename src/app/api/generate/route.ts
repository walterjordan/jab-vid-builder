import { NextResponse } from "next/server";
import { generateVeoVideo, MIN_DURATION, MAX_DURATION } from "@/lib/veo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type BodyShape = {
  prompt?: unknown;
  aspectRatio?: unknown;
  resolution?: unknown;
  durationSeconds?: unknown;
  seed?: unknown;
  model?: unknown; // may arrive as string or object in some clients
};

function coerceString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "toString" in (v as any)) {
    const s = String(v);
    if (s && s !== "[object Object]") return s;
  }
  return fallback;
}

function coerceNumber(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function POST(req: Request) {
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // Extract with safe defaults
  const prompt = coerceString(body.prompt).trim();
  const aspectRatio = coerceString(body.aspectRatio, "16:9");
  const resolution = coerceString(body.resolution, "1080p");
  const model = coerceString(body.model, "veo-3.0-generate-001");
  const seed = coerceNumber(body.seed);
  const durationSeconds = coerceNumber(body.durationSeconds);

  if (!prompt || prompt.length < 5) {
    return NextResponse.json(
      { error: "Prompt is required (min 5 characters)." },
      { status: 400 }
    );
  }

  try {
    const res = await generateVeoVideo({
      prompt,
      aspectRatio,
      resolution,
      durationSeconds,
      seed,
      model, // always a string id now
      // apiKey: (optional) rely on env-injected secret
    });

    // Lightweight log line in Cloud Run for traceability
    console.log(
      JSON.stringify({
        at: "generate",
        ok: true,
        model,
        aspectRatio,
        resolution,
        requestedDurationSeconds: durationSeconds,
        usedDurationSeconds: res.durationSeconds,
      })
    );

    return NextResponse.json({
      uri: res.uri,
      meta: {
        model,
        aspectRatio,
        resolution,
        requestedDurationSeconds: res.requestedDurationSeconds,
        usedDurationSeconds: res.durationSeconds,
        note: res.note ?? null,
        service: process.env.K_SERVICE ?? null,
        revision: process.env.K_REVISION ?? null,
      },
    });
  } catch (err: any) {
    // Normalize error message
    const message =
      (err?.response?.data && JSON.stringify(err.response.data)) ||
      err?.message ||
      "Video generation failed.";

    // Helpful message if caller exceeded hard limits
    const bounds =
      message.includes("out of bound") ||
      message.match(/duration/i)
        ? ` Allowed range: ${MIN_DURATION}-${MAX_DURATION}s.`
        : "";

    console.error(
      JSON.stringify({
        at: "generate",
        ok: false,
        error: message,
      })
    );

    return NextResponse.json(
      { error: `${message}${bounds}`.trim() },
      { status: 400 }
    );
  }
}
