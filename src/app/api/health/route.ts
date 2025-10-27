import { NextResponse } from "next/server";

// Make sure this runs in a Node server context, not Edge/static.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const verbose = url.searchParams.get("verbose") === "1";

  const envNames = ["GEMINI_API_KEY", "GOOGLE_GENAI_API_KEY", "_GEMINI_API_KEY"];
  const keysFound = envNames.filter((k) => !!process.env[k as keyof NodeJS.ProcessEnv]);

  const payload: Record<string, any> = {
    ok: true,
    nodeProcessDefined: typeof process !== "undefined",
    hasKey: keysFound.length > 0,
    keysFound,                       // names only; no values
    service: process.env.K_SERVICE ?? null,
    revision: process.env.K_REVISION ?? null,
  };

  if (verbose) {
    payload.hints = Object.keys(process.env)
      .filter((k) => /^K_|^PORT$|^GOOGLE_|^NODE_|^HOME$/.test(k))
      .sort()
      .slice(0, 25);
  }

  return NextResponse.json(payload);
}
