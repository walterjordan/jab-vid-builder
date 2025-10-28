// src/lib/veo.ts
import { GoogleGenAI } from "@google/genai";

const DEBUG = process.env.NODE_ENV !== "production";
const log = (...args: any[]) => {
  if (DEBUG) console.log("[veo]", ...args);
};

// Extract operation name safely
function extractOperationName(x: any): string | undefined {
  return x?.name || x?.operation?.name;
}

// Main video generator
export async function generateVeoVideo(req: {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
  model?: string;
}) {
  const {
    prompt,
    aspectRatio = "16:9",
    resolution = "720p",
    durationSeconds = 6,
    model = "veo-3.0-fast-generate-001",
  } = req;

  if (!prompt || prompt.trim().length < 5) {
    throw new Error("Prompt is required (min 5 characters).");
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    (process.env as any)._GEMINI_API_KEY ||
    "";
  if (!apiKey) throw new Error("Missing API key.");

  log("🟢 Request initialized", {
    model,
    aspectRatio,
    resolution,
    durationSeconds,
  });

  const ai = new GoogleGenAI({ apiKey });

  let op: any;
  try {
    op = await ai.models.generateVideos({
      model,
      prompt,
      config: {
        aspectRatio,
        resolution,
        durationSeconds,
        personGeneration: "allow_all",
        negativePrompt:
          "cartoon, drawing, low quality, watermark, text overlay",
      },
    });
  } catch (err: any) {
    log("❌ API call failed:", err?.message);
    throw err;
  }

  log("🟣 Operation response received:", {
    keys: Object.keys(op || {}),
    name: op?.name,
    uri: op?.uri,
    done: op?.done,
  });

  // Case 1: immediate URI (rare)
  if (op?.uri) {
    log("✅ Immediate URI returned.");
    return {
      uri: op.uri,
      requestedDurationSeconds: durationSeconds,
      durationSeconds,
    };
  }

  // Case 2: long-running operation
  const opName = extractOperationName(op);
  const operations = (ai as any).operations;
  const getOp =
    (operations && typeof operations.get === "function" && operations.get.bind(operations)) ||
    (op && typeof op.get === "function" && op.get.bind(op));

  if (!opName || !getOp) {
    log("⚠️ Unexpected response — no operation name or getter found.");
    throw new Error("Unexpected response from generateVideos (no uri/operation).");
  }

  log("🕒 Starting poll loop for operation:", opName);

  const MAX_TRIES = 120; // ~4 minutes total
  for (let i = 0; i < MAX_TRIES; i++) {
    let cur: any;
    try {
      cur = await getOp({ name: opName });
    } catch (err: any) {
      log("⚠️ Poll error at iteration", i, err?.message);
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const uri =
      cur?.response?.video?.uri ||
      cur?.response?.uri ||
      cur?.uri;

    const done = !!cur?.done;
    log("🔁 Poll iteration", i, { done, hasUri: !!uri });

    if (done && uri) {
      log("✅ Operation complete. URI ready:", uri);
      return {
        uri,
        requestedDurationSeconds: durationSeconds,
        durationSeconds,
      };
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  log("⏰ Timeout reached. Operation did not complete in time.");
  throw new Error(`Video generation timed out while polling the operation (${opName})`);
}
