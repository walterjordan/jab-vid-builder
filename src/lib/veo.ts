// src/lib/veo.ts
import { GoogleGenAI } from "@google/genai";

const DEBUG = process.env.NODE_ENV !== "production";
const API_KEY =
  process.env.GENAI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error(
    "Missing API key. Set GENAI_API_KEY (or GOOGLE_API_KEY / GEMINI_API_KEY)."
  );
}
const log = (...args: any[]) => {
  if (DEBUG) console.log("[veo]", ...args);
};

function getApiKey(): string {
  const key =
    process.env.GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;
  if (!key) {
    throw new Error(
      "Missing API key. Set GENAI_API_KEY (or GOOGLE_API_KEY) in your environment."
    );
  }
  return key;
}

export type GenerateVeoRequest = {
  prompt: string;
  model?: string; // default veo-3.0-fast-generate-001
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number; // clamped 2..60
  seed?: number;
  waitForResult?: boolean;  // if true, server will poll until done (or timeout)
  timeoutMs?: number;       // total max wait (default 120_000)
  minIntervalMs?: number;   // minimum polling interval (default 2000)
  maxIntervalMs?: number;   // maximum polling interval (default 8000)
  signal?: AbortSignal;     // optional, to cancel waits from caller
};

export type GenerateVeoQueued = {
  operationName: string;
  model: string;
  config: Record<string, any>;
};

export type GenerateVeoCompleted = {
  operationName: string;
  model: string;
  config: Record<string, any>;
  done: true;
  uri: string;
  durationSeconds?: number;
};

export type GenerateVeoResponse = GenerateVeoQueued | GenerateVeoCompleted;

const DEFAULT_MODEL = "veo-3.0-fast-generate-001";
const MIN_DURATION = 2;
const MAX_DURATION = 60;

/** Clamp helper */
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Some responses nest the operation name differently; normalize it. */
function extractOperationName(x: any): string | undefined {
  return x?.name || x?.operation?.name;
}

/** Exponential backoff with jitter */
function nextIntervalMs(i: number, minMs: number, maxMs: number) {
  const base = Math.min(maxMs, minMs * Math.pow(1.6, i)); // growth factor ~1.6
  const jitter = Math.random() * (base * 0.25);
  return Math.floor(base + jitter);
}

/** Find a likely video URI anywhere in an arbitrary response payload. */
function findUriDeep(obj: any): string | undefined {
  if (!obj) return;
  if (typeof obj === "string") {
    if (obj.startsWith("http") && obj.includes(".mp4")) return obj;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const hit = findUriDeep(v);
      if (hit) return hit;
    }
  } else if (typeof obj === "object") {
    if (typeof obj.videoUri === "string") return obj.videoUri;
    if (typeof obj.uri === "string" && obj.uri.includes(".mp4")) return obj.uri;
    for (const k of Object.keys(obj)) {
      const hit = findUriDeep(obj[k]);
      if (hit) return hit;
    }
  }
}

/** Describe an operation by name via REST (Generative Language API). */
export async function describeOperation(
  operationName: string,
  apiKey = getApiKey()
): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURI(
    operationName
  )}`;

  const res = await fetch(url, {
    headers: { "x-goog-api-key": apiKey },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.error?.message ||
      `Failed to describe operation (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

/** Sleep with optional AbortSignal support. */
function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Aborted"));
    const t = setTimeout(() => {
      if (signal?.aborted) return reject(new Error("Aborted"));
      resolve();
    }, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("Aborted"));
      },
      { once: true }
    );
  });
}

/** Poll an operation until done or timeout, with backoff. */
export async function pollUntilDone(opts: {
  operationName: string;
  apiKey?: string;
  timeoutMs?: number;
  minIntervalMs?: number;
  maxIntervalMs?: number;
  signal?: AbortSignal;
}): Promise<{ uri?: string; raw: any }> {
  const {
    operationName,
    apiKey = getApiKey(),
    timeoutMs = 120_000,
    minIntervalMs = 2000,
    maxIntervalMs = 8000,
    signal,
  } = opts;

  const started = Date.now();
  let attempt = 0;

  while (true) {
    if (signal?.aborted) {
      throw new Error("Polling aborted by caller.");
    }

    let desc: any;
    try {
      desc = await describeOperation(operationName, apiKey);
    } catch (e: any) {
      // tolerate brief 429/5xx with a retry
      const msg = String(e?.message || "");
      if (/(429|5\d\d|quota|unavailable|deadline)/i.test(msg)) {
        const wait = nextIntervalMs(attempt++, minIntervalMs, maxIntervalMs);
        log(`⚠️ describe failed; retrying in ${wait}ms —`, msg);
        await sleep(wait, signal);
        continue;
      }
      throw e;
    }

    const done = !!desc?.done;
    const uri = findUriDeep(desc?.response);

    if (done) {
      log("✅ Operation reports done:", operationName);
      if (uri) {
        return { uri, raw: desc };
      } else {
        // Sometimes done=true lands before URI is populated — do a few short follow-ups.
        for (let i = 0; i < 5; i++) {
          const shortWait = 800 + i * 200;
          await sleep(shortWait, signal);
          const recheck = await describeOperation(operationName, apiKey);
          const maybeUri = findUriDeep(recheck?.response);
          if (maybeUri) {
            log("🎯 URI appeared on follow-up:", maybeUri);
            return { uri: maybeUri, raw: recheck };
          }
        }
        log("⚠️ Done=true but no URI found; returning raw payload.");
        return { uri: undefined, raw: desc };
      }
    }

    // not done yet
    const wait = nextIntervalMs(attempt++, minIntervalMs, maxIntervalMs);
    const elapsed = Date.now() - started;
    if (elapsed + wait > timeoutMs) {
      throw new Error(
        `Timeout while polling operation (${operationName}) after ${elapsed}ms`
      );
    }
    await sleep(wait, signal);
  }
}

/**
 * Start a VEO job. If waitForResult=true, poll until done (or timeout) and return the URI.
 * Otherwise return just the operationName for client-side polling.
 */
export async function generateVeoVideo(req: GenerateVeoRequest): Promise<GenerateVeoResponse> {
  const {
    prompt,
    model = DEFAULT_MODEL,
    aspectRatio,
    resolution,
    seed,
    minIntervalMs,
    maxIntervalMs,
    waitForResult = false,
    timeoutMs,
    signal,
  } = req;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Missing 'prompt'.");
  }

  const durationSeconds = clamp(
    typeof req.durationSeconds === "number" && Number.isFinite(req.durationSeconds)
      ? req.durationSeconds
      : 45,
    MIN_DURATION,
    MAX_DURATION
  );

  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const config: Record<string, any> = {
    durationSeconds,
    personGeneration: "allow_all",
    negativePrompt: "cartoon, drawing, low quality, watermark, text overlay",
  };
  if (aspectRatio) config.aspectRatio = aspectRatio;
  if (resolution) config.resolution = resolution;
  if (typeof seed === "number") config.seed = seed;

  // Kick off generation; this returns an LRO (operation)
  // @ts-ignore: types for generateVideos may lag the API surface
  const op: any = await ai.models.generateVideos({
    model,
    prompt,
    config,
  });

  const opName = extractOperationName(op);
  if (!opName) {
    log("❌ No operation name on response:", op);
    throw new Error("Operation name was not returned by the API.");
    }

  // Structured log you can grep in Cloud Run logs
  console.log(
    JSON.stringify(
      {
        severity: "INFO",
        where: "lib/veo",
        event: "video_operation_created",
        operationName: opName,
        model,
        config,
      },
      null,
      2
    )
  );

  if (!waitForResult) {
    // Return immediately; let caller/UI poll
    return {
      operationName: opName,
      model,
      config,
    };
  }

  // Otherwise, block until we get a result (or timeout)
  const polled = await pollUntilDone({
    operationName: opName,
    apiKey,
    timeoutMs: timeoutMs ?? 120_000,
    minIntervalMs: minIntervalMs ?? 2000,
    maxIntervalMs: maxIntervalMs ?? 8000,
    signal,
  });

  const uri = polled.uri;
  if (!uri) {
    // Give the caller everything so they can inspect and decide
    log("⚠️ Completed without URI — returning queued shape + raw hint");
    return {
      operationName: opName,
      model,
      config,
      // not marking done unless we actually have a URI
    } as GenerateVeoQueued;
  }

  log("✅ Operation complete. URI ready:", uri);
  return {
    operationName: opName,
    model,
    config,
    done: true,
    uri,
    durationSeconds,
  } as GenerateVeoCompleted;
}

