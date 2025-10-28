// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateVeoVideo, describeOperation } from "@/lib/veo";

// ---- CORS helpers ----
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

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

/**
 * GET /api/generate?name=models/veo-3.0-fast-generate-001/operations/OP_ID
 * Describe an existing operation (from Generative Language API).
 */
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
    return NextResponse.json(data, { headers: corsHeaders() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown server error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * POST /api/generate
 * Body:
 * {
 *   "prompt": string,                // required
 *   "model"?: string,                // default veo-3.0-fast-generate-001
 *   "aspectRatio"?: string,          // e.g., "16:9", "9:16"
 *   "resolution"?: string,           // e.g., "1080p", "4k"
 *   "durationSeconds"?: number,      // clamped 2..60
 *   "seed"?: number,
 *   "waitForResult"?: boolean,       // default false (return op name immediately)
 *   "timeoutMs"?: number,            // only used when waitForResult=true
 *   "minIntervalMs"?: number,        // poll interval lower bound
 *   "maxIntervalMs"?: number         // poll interval upper bound
 * }
 *
 * Response:
 * - 202 + { operationName, model, config } when queued (waitForResult=false)
 * - 200 + { operationName, model, config, done: true, uri } when finished (waitForResult=true and URI available)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Pass through to lib/veo (it validates/clamps; raises on missing prompt)
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

    // If we have a finished URI, return 200; otherwise 202 (accepted/queued)
    const isDone = (result as any)?.done === true && !!(result as any)?.uri;
    return NextResponse.json(result, {
      status: isDone ? 200 : 202,
      headers: corsHeaders(),
    });
  } catch (err: any) {
    // lib/veo throws clear messages (missing prompt, timeout, API errors)
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


