import { NextRequest, NextResponse } from "next/server";
import { generateVeoVideo, describeOperation } from "@/lib/veo";
import { getUserFromCookie } from "@/lib/auth";
import { consumeDailyQuota } from "@/lib/usage";

/* ----------------------- Helpers ----------------------- */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: corsHeaders() });
}

/** Find the first URI anywhere in the object (handles current VEO nesting). */
function findUriDeep(obj: any): string | undefined {
  if (!obj) return;
  if (typeof obj === "string" && obj.startsWith("http")) return obj;
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const hit = findUriDeep(v);
      if (hit) return hit;
    }
  } else if (typeof obj === "object") {
    if (typeof obj.videoUri === "string") return obj.videoUri;
    if (obj.video && typeof obj.video.uri === "string") return obj.video.uri;
    if (typeof obj.uri === "string") return obj.uri;
    for (const k of Object.keys(obj)) {
      const hit = findUriDeep(obj[k]);
      if (hit) return hit;
    }
  }
}

/* ----------------------- CORS (preflight) ----------------------- */
export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

/* ----------------------- GET: describe operation ----------------------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name || !name.startsWith("models/")) {
      return jsonError("Missing or invalid 'name'. Expected 'models/.../operations/ID'.", 400);
    }

    const data = await describeOperation(name);
    const uri = findUriDeep((data as any)?.response) ?? null;

    return NextResponse.json({ ...data, videoUri: uri }, { headers: corsHeaders() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown server error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/* ----------------------- POST: start generation ----------------------- */
export async function POST(req: NextRequest) {
  try {
    // ✅ Check user session first
    const user = getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401, headers: corsHeaders() }
      );
    }

    // ✅ Enforce daily limit (3 per day)
    const quota = await consumeDailyQuota(user.sub, 3);
    if (!quota.ok) {
      return NextResponse.json(
        { error: "Daily limit reached. Try again tomorrow." },
        { status: 429, headers: corsHeaders() }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));

    // Generate the video
    const result = await generateVeoVideo({
      prompt: body?.prompt,
      model: body?.model,
      aspectRatio: body?.aspectRatio,
      resolution: body?.resolution,
      durationSeconds: body?.durationSeconds,
      seed: body?.seed,
      waitForResult: Boolean(body?.waitForResult),
      timeoutMs: body?.timeoutMs,
      minIntervalMs: body?.minIntervalMs,
      maxIntervalMs: body?.maxIntervalMs,
    });

    const isDone = (result as any)?.done === true && !!(result as any)?.uri;

    return NextResponse.json(result, {
      status: isDone ? 200 : 202,
      headers: corsHeaders(),
    });
  } catch (err: any) {
    const msg = String(err?.message || "Unknown server error");
    const status = /invalid|missing|timeout|400|INVALID_ARGUMENT/i.test(msg) ? 400 : 500;

    console.error(
      JSON.stringify(
        {
          severity: "ERROR",
          where: "api/generate",
          event: "video_generation_failed",
          message: msg,
        },
        null,
        2
      )
    );

    return NextResponse.json({ error: msg }, { status, headers: corsHeaders() });
  }
}

