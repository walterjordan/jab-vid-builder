import { NextRequest, NextResponse } from "next/server";
import { generateVeoVideo, describeOperation } from "@/lib/veo";
import { getUserFromCookie } from "@/lib/auth";
import { consumeDailyQuota } from "@/lib/usage";

/* ----------------------- Helpers ----------------------- */

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: corsHeaders() }
  );
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
      return jsonError(
        "Missing or invalid 'name'. Expected 'models/.../operations/ID'.",
        400
      );
    }

    const data = await describeOperation(name);
    const uri = findUriDeep((data as any)?.response) ?? null;

    return NextResponse.json(
      { ...data, videoUri: uri },
      { headers: corsHeaders() }
    );
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

    const contentType = req.headers.get("content-type") || "";

    let prompt: string | undefined;
    let model: string | undefined;
    let aspectRatio: string | undefined;
    let resolution: string | undefined;
    // default to a Veo-valid duration
    let durationSeconds: number = 6;
    let seed: number | undefined;
    let waitForResult = false;
    let timeoutMs: number | undefined;
    let minIntervalMs: number | undefined;
    let maxIntervalMs: number | undefined;

    // media
    const referenceImages: { mimeType: string; bytes: Buffer }[] = [];
    let baseVideo:
      | { mimeType: string; bytes: Buffer }
      | undefined = undefined;

    if (contentType.includes("multipart/form-data")) {
      // 🔸 form-data: prompt + options + attached files
      const form = await req.formData();

      prompt = (form.get("prompt") as string) || "";
      model = (form.get("model") as string) || undefined;
      aspectRatio = (form.get("aspectRatio") as string) || undefined;
      resolution = (form.get("resolution") as string) || undefined;

      // durationSeconds from form
      const durRaw = form.get("durationSeconds") as string | null;
      const durNum =
        durRaw !== null && durRaw !== undefined ? Number(durRaw) : NaN;
      if (!Number.isNaN(durNum)) {
        durationSeconds = durNum;
      }

      // seed from form
      const seedRaw = form.get("seed") as string | null;
      const seedNum =
        seedRaw !== null && seedRaw !== undefined ? Number(seedRaw) : NaN;
      if (!Number.isNaN(seedNum)) {
        seed = seedNum;
      }

      waitForResult = (form.get("waitForResult") as string) === "true";
      timeoutMs = form.get("timeoutMs")
        ? Number(form.get("timeoutMs") as string)
        : undefined;
      minIntervalMs = form.get("minIntervalMs")
        ? Number(form.get("minIntervalMs") as string)
        : undefined;
      maxIntervalMs = form.get("maxIntervalMs")
        ? Number(form.get("maxIntervalMs") as string)
        : undefined;

      const files = form.getAll("files") as File[];
      for (const file of files) {
        const bytes = Buffer.from(await file.arrayBuffer());

        if (file.type.startsWith("image/")) {
          referenceImages.push({
            mimeType: file.type,
            bytes,
          });
        } else if (file.type.startsWith("video/") && !baseVideo) {
          baseVideo = {
            mimeType: file.type,
            bytes,
          };
        }
      }
    } else {
      // 🔸 JSON body fallback (no files)
      const body = (await req.json().catch(() => ({}))) as any;

      prompt = body?.prompt;
      model = body?.model;
      aspectRatio = body?.aspectRatio;
      resolution = body?.resolution;

      const durJsonNum =
        body?.durationSeconds !== undefined && body?.durationSeconds !== null
          ? Number(body.durationSeconds)
          : NaN;
      if (!Number.isNaN(durJsonNum)) {
        durationSeconds = durJsonNum;
      }

      const seedJsonNum =
        body?.seed !== undefined && body?.seed !== null
          ? Number(body.seed)
          : NaN;
      if (!Number.isNaN(seedJsonNum)) {
        seed = seedJsonNum;
      }

      waitForResult = Boolean(body?.waitForResult);
      timeoutMs = body?.timeoutMs;
      minIntervalMs = body?.minIntervalMs;
      maxIntervalMs = body?.maxIntervalMs;
    }

    const result = await generateVeoVideo({
      prompt,
      model,
      aspectRatio,
      resolution,
      durationSeconds,
      seed,
      waitForResult,
      timeoutMs,
      minIntervalMs,
      maxIntervalMs,
      referenceImages,
      baseVideo,
    } as any);

    const isDone = (result as any)?.done === true && !!(result as any)?.uri;

    return NextResponse.json(result, {
      status: isDone ? 200 : 202,
      headers: corsHeaders(),
    });
  } catch (err: any) {
    const msg = String(err?.message || "Unknown server error");
    const status = /invalid|missing|timeout|400|INVALID_ARGUMENT/i.test(msg)
      ? 400
      : 500;

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

    return NextResponse.json(
      { error: msg },
      { status, headers: corsHeaders() }
    );
  }
}



