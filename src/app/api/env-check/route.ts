// src/app/api/env-check/route.ts
export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  return new Response(
    JSON.stringify({ exists: !!key, length: key ? key.length : 0 }),
    { status: key ? 200 : 500 }
  );
}
