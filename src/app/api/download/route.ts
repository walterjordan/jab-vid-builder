// src/app/api/download/route.ts
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const uri = req.nextUrl.searchParams.get("uri");
  const name = req.nextUrl.searchParams.get("name") ?? "veo_result.mp4";
  if (!uri) {
    return new Response(JSON.stringify({ error: "Missing ?uri" }), { status: 400 });
  }

  const API_KEY =
    process.env.GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "Missing API key env" }), { status: 500 });
  }

  // Fetch the file from Google with the required header
  const up = await fetch(uri, {
    headers: { "x-goog-api-key": API_KEY },
  });

  if (!up.ok) {
    const text = await up.text();
    return new Response(text, { status: up.status });
  }

  // Stream it back to the browser with a friendly filename
  const headers = new Headers(up.headers);
  headers.set("Content-Disposition", `attachment; filename="${name}"`);
  return new Response(up.body, {
    status: 200,
    headers,
  });
}
