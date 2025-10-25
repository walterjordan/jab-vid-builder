import { NextRequest } from "next/server";
import { generateVeoVideo } from "@/lib/veo";

export const runtime = "nodejs";

export async function POST(req: NextRequest){
  try {
    const { aspectRatio, resolution, seed, prompt } = await req.json();
    const result = await generateVeoVideo({ aspectRatio, resolution, seed, prompt });
    const { uri } = result; // ensure we destructure from the object, not void

    const res = await fetch(uri, {
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY as string }
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": "attachment; filename=wow-fall-ad.mp4"
      }
    });
  } catch (err: any) {
    console.error("/api/generate error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), { status: 500 });
  }
}