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
  model?: unknown; // may be string or object; we coerce to string below
};

function coerceString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    // If someone passes { name: "veo-..." } or something odd, try common props:
    const maybeName = (v as any)?.name;
    if (typeof maybeName === "string" && maybeName.trim()) return maybeName;
    try {
      const s = String(v);
      if (s && s !== "[object Object]") return s;
    } catch {}
  }
  return fallback;
}

function coerceNumber(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Provider-specific compatibility: 1080p must be exactly 8s.
function resolveCompatibleDuration(resolution: string, requested?: number) {
  const req = Number.isFinite(requested as number) ? (requested as number) : 8;
  if (resolution.toLowerCase() === "1080p") {
    return { used: 8, note: "1080p requires exactly 8s; duration adjusted." };
  }
  const used = Math.max(MIN_DURATION, Math.min(MAX_DURATION, req));
  const note = used !== req ? "Duration limited to 4–8s; value was clamped." : undefined;
  return { used, note };
}

export async function POST(req: Request) {
  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const prompt = coerceString(body.prompt).trim();
  const aspectRatio = coerceString(body.aspectRatio, "16:9");
  const resolution = coerceString(body.resolution, "1080p");
  const model = coerceString(body.model, "veo-3.0-generate-001"); // ✅ always a string id
  const seed = coerceNumber(body.seed);
  const requestedDuration = coerceNumber(body.durationSeconds);

  if (!prompt || prompt.length < 5) {
    return NextResponse.json(
      { error: "Prompt is required (min 5 characters)." },
      { status: 400 }
    );
  }

  // Enforce compatible duration for the selected resolution
  const { used: compatibleDuration, note: compatNote } = resolveCompatibleDuration(
    resolution,
    requestedDuration
  );

  try {
    // Call Veo with safe, coerced values
    const res = await generateVeoVideo({
      prompt,
      aspectRatio,
      resolution,
      durationSeconds: compatibleDuration,
      seed,
      model, // ✅ string, never an object -> no .name anywhere
    });

    // Compact success log for Cloud Run
    console.log(
      JSON.stringify({
        at: "generate",
        ok: true,
        model,
        aspectRatio,
        resolution,
        requestedDurationSeconds: requestedDuration,
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
        note: compatNote ?? res.note ?? null,
        service: process.env.K_SERVICE ?? null,
        revision: process.env.K_REVISION ?? null,
      },
    });
  } catch (err: any) {
    const message =
      (err?.response?.data && JSON.stringify(err.response.data)) ||
      err?.message ||
      "Video generation failed.";

    const bounds =
      /out of bound|duration/i.test(message)
        ? ` Allowed range: ${MIN_DURATION}-${MAX_DURATION}s.`
        : "";

    console.error(
      JSON.stringify({
        at: "generate",
        ok: false,
        error: message,
        modelType: typeof body?.model, // helpful to catch future model objects
      })
    );

    return NextResponse.json({ error: `${message}${bounds}`.trim() }, { status: 400 });
  }
}

