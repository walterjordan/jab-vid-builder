[1mdiff --git a/src/lib/veo.ts b/src/lib/veo.ts[m
[1mindex d3b159f..243b2ae 100644[m
[1m--- a/src/lib/veo.ts[m
[1m+++ b/src/lib/veo.ts[m
[36m@@ -2,28 +2,18 @@[m
 import { GoogleGenAI } from "@google/genai";[m
 [m
 const DEBUG = process.env.NODE_ENV !== "production";[m
[31m-const API_KEY =[m
[31m-  process.env.GENAI_API_KEY ||[m
[31m-  process.env.GOOGLE_API_KEY ||[m
[31m-  process.env.GEMINI_API_KEY;[m
[31m-[m
[31m-if (!API_KEY) {[m
[31m-  throw new Error([m
[31m-    "Missing API key. Set GENAI_API_KEY (or GOOGLE_API_KEY / GEMINI_API_KEY)."[m
[31m-  );[m
[31m-}[m
[31m-const log = (...args: any[]) => {[m
[31m-  if (DEBUG) console.log("[veo]", ...args);[m
[31m-};[m
[32m+[m[32mconst log = (...args: any[]) => { if (DEBUG) console.log("[veo]", ...args); };[m
 [m
[32m+[m[32m/** Read the API key lazily (at request time, not at module this changed import). */[m
 function getApiKey(): string {[m
   const key =[m
     process.env.GENAI_API_KEY ||[m
     process.env.GOOGLE_API_KEY ||[m
[31m-    process.env.GOOGLE_GENAI_API_KEY;[m
[32m+[m[32m    process.env.GEMINI_API_KEY ||           // keep for compatibility[m
[32m+[m[32m    process.env.GOOGLE_GENAI_API_KEY;       // optional alt[m
   if (!key) {[m
     throw new Error([m
[31m-      "Missing API key. Set GENAI_API_KEY (or GOOGLE_API_KEY) in your environment."[m
[32m+[m[32m      "Missing API key. Set GENAI_API_KEY (or GOOGLE_API_KEY / GEMINI_API_KEY) in your environment."[m
     );[m
   }[m
   return key;[m
[36m@@ -31,16 +21,16 @@[m [mfunction getApiKey(): string {[m
 [m
 export type GenerateVeoRequest = {[m
   prompt: string;[m
[31m-  model?: string; // default veo-3.0-fast-generate-001[m
[32m+[m[32m  model?: string;[m
   aspectRatio?: string;[m
   resolution?: string;[m
[31m-  durationSeconds?: number; // clamped 2..60[m
[32m+[m[32m  durationSeconds?: number;[m
   seed?: number;[m
[31m-  waitForResult?: boolean;  // if true, server will poll until done (or timeout)[m
[31m-  timeoutMs?: number;       // total max wait (default 120_000)[m
[31m-  minIntervalMs?: number;   // minimum polling interval (default 2000)[m
[31m-  maxIntervalMs?: number;   // maximum polling interval (default 8000)[m
[31m-  signal?: AbortSignal;     // optional, to cancel waits from caller[m
[32m+[m[32m  waitForResult?: boolean;[m
[32m+[m[32m  timeoutMs?: number;[m
[32m+[m[32m  minIntervalMs?: number;[m
[32m+[m[32m  maxIntervalMs?: number;[m
[32m+[m[32m  signal?: AbortSignal;[m
 };[m
 [m
 export type GenerateVeoQueued = {[m
[36m@@ -69,14 +59,14 @@[m [mfunction clamp(n: number, lo: number, hi: number) {[m
   return Math.max(lo, Math.min(hi, n));[m
 }[m
 [m
[31m-/** Some responses nest the operation name differently; normalize it. */[m
[32m+[m[32m/** Normalize op name across response shapes. */[m
 function extractOperationName(x: any): string | undefined {[m
   return x?.name || x?.operation?.name;[m
 }[m
 [m
 /** Exponential backoff with jitter */[m
 function nextIntervalMs(i: number, minMs: number, maxMs: number) {[m
[31m-  const base = Math.min(maxMs, minMs * Math.pow(1.6, i)); // growth factor ~1.6[m
[32m+[m[32m  const base = Math.min(maxMs, minMs * Math.pow(1.6, i));[m
   const jitter = Math.random() * (base * 0.25);[m
   return Math.floor(base + jitter);[m
 }[m
[36m@@ -102,30 +92,23 @@[m [mfunction findUriDeep(obj: any): string | undefined {[m
   }[m
 }[m
 [m
[31m-/** Describe an operation by name via REST (Generative Language API). */[m
[32m+[m[32m/** Describe an operation via REST (Generative Language API). */[m
 export async function describeOperation([m
   operationName: string,[m
[31m-  apiKey = getApiKey()[m
[32m+[m[32m  apiKey = getApiKey()   // evaluated when function is called (runtime)[m
 ): Promise<any> {[m
[31m-  const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURI([m
[31m-    operationName[m
[31m-  )}`;[m
[31m-[m
[31m-  const res = await fetch(url, {[m
[31m-    headers: { "x-goog-api-key": apiKey },[m
[31m-  });[m
[32m+[m[32m  const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURI(operationName)}`;[m
 [m
[32m+[m[32m  const res = await fetch(url, { headers: { "x-goog-api-key": apiKey } });[m
   const body = await res.json().catch(() => ({}));[m
   if (!res.ok) {[m
[31m-    const msg =[m
[31m-      body?.error?.message ||[m
[31m-      `Failed to describe operation (${res.status})`;[m
[32m+[m[32m    const msg = body?.error?.message || `Failed to describe operation (${res.status})`;[m
     throw new Error(msg);[m
   }[m
   return body;[m
 }[m
 [m
[31m-/** Sleep with optional AbortSignal support. */[m
[32m+[m[32m/** Sleep with optional AbortSignal. */[m
 function sleep(ms: number, signal?: AbortSignal) {[m
   return new Promise<void>((resolve, reject) => {[m
     if (signal?.aborted) return reject(new Error("Aborted"));[m
[36m@@ -133,14 +116,10 @@[m [mfunction sleep(ms: number, signal?: AbortSignal) {[m
       if (signal?.aborted) return reject(new Error("Aborted"));[m
       resolve();[m
     }, ms);[m
[31m-    signal?.addEventListener([m
[31m-      "abort",[m
[31m-      () => {[m
[31m-        clearTimeout(t);[m
[31m-        reject(new Error("Aborted"));[m
[31m-      },[m
[31m-      { once: true }[m
[31m-    );[m
[32m+[m[32m    signal?.addEventListener("abort", () => {[m
[32m+[m[32m      clearTimeout(t);[m
[32m+[m[32m      reject(new Error("Aborted"));[m
[32m+[m[32m    }, { once: true });[m
   });[m
 }[m
 [m
[36m@@ -166,15 +145,12 @@[m [mexport async function pollUntilDone(opts: {[m
   let attempt = 0;[m
 [m
   while (true) {[m
[31m-    if (signal?.aborted) {[m
[31m-      throw new Error("Polling aborted by caller.");[m
[31m-    }[m
[32m+[m[32m    if (signal?.aborted) throw new Error("Polling aborted by caller.");[m
 [m
     let desc: any;[m
     try {[m
       desc = await describeOperation(operationName, apiKey);[m
     } catch (e: any) {[m
[31m-      // tolerate brief 429/5xx with a retry[m
       const msg = String(e?.message || "");[m
       if (/(429|5\d\d|quota|unavailable|deadline)/i.test(msg)) {[m
         const wait = nextIntervalMs(attempt++, minIntervalMs, maxIntervalMs);[m
[36m@@ -190,41 +166,30 @@[m [mexport async function pollUntilDone(opts: {[m
 [m
     if (done) {[m
       log("✅ Operation reports done:", operationName);[m
[31m-      if (uri) {[m
[31m-        return { uri, raw: desc };[m
[31m-      } else {[m
[31m-        // Sometimes done=true lands before URI is populated — do a few short follow-ups.[m
[31m-        for (let i = 0; i < 5; i++) {[m
[31m-          const shortWait = 800 + i * 200;[m
[31m-          await sleep(shortWait, signal);[m
[31m-          const recheck = await describeOperation(operationName, apiKey);[m
[31m-          const maybeUri = findUriDeep(recheck?.response);[m
[31m-          if (maybeUri) {[m
[31m-            log("🎯 URI appeared on follow-up:", maybeUri);[m
[31m-            return { uri: maybeUri, raw: recheck };[m
[31m-          }[m
[31m-        }[m
[31m-        log("⚠️ Done=true but no URI found; returning raw payload.");[m
[31m-        return { uri: undefined, raw: desc };[m
[32m+[m[32m      if (uri) return { uri, raw: desc };[m
[32m+[m
[32m+[m[32m      // Sometimes done=true arrives before URI is populated — short follow-ups.[m
[32m+[m[32m      for (let i = 0; i < 5; i++) {[m
[32m+[m[32m        const shortWait = 800 + i * 200;[m
[32m+[m[32m        await sleep(shortWait, signal);[m
[32m+[m[32m        const recheck = await describeOperation(operationName, apiKey);[m
[32m+[m[32m        const maybeUri = findUriDeep(recheck?.response);[m
[32m+[m[32m        if (maybeUri) return { uri: maybeUri, raw: recheck };[m
       }[m
[32m+[m[32m      log("⚠️ Done=true but no URI found; returning raw payload.");[m
[32m+[m[32m      return { uri: undefined, raw: desc };[m
     }[m
 [m
[31m-    // not done yet[m
     const wait = nextIntervalMs(attempt++, minIntervalMs, maxIntervalMs);[m
     const elapsed = Date.now() - started;[m
     if (elapsed + wait > timeoutMs) {[m
[31m-      throw new Error([m
[31m-        `Timeout while polling operation (${operationName}) after ${elapsed}ms`[m
[31m-      );[m
[32m+[m[32m      throw new Error(`Timeout while polling operation (${operationName}) after ${elapsed}ms`);[m
     }[m
     await sleep(wait, signal);[m
   }[m
 }[m
 [m
[31m-/**[m
[31m- * Start a VEO job. If waitForResult=true, poll until done (or timeout) and return the URI.[m
[31m- * Otherwise return just the operationName for client-side polling.[m
[31m- */[m
[32m+[m[32m/** Start a VEO job; optionally wait for completion. */[m
 export async function generateVeoVideo(req: GenerateVeoRequest): Promise<GenerateVeoResponse> {[m
   const {[m
     prompt,[m
[36m@@ -251,7 +216,7 @@[m [mexport async function generateVeoVideo(req: GenerateVeoRequest): Promise<Generat[m
     MAX_DURATION[m
   );[m
 [m
[31m-  const apiKey = getApiKey();[m
[32m+[m[32m  const apiKey = getApiKey();                   // evaluated at request time[m
   const ai = new GoogleGenAI({ apiKey });[m
 [m
   const config: Record<string, any> = {[m
[36m@@ -263,46 +228,28 @@[m [mexport async function generateVeoVideo(req: GenerateVeoRequest): Promise<Generat[m
   if (resolution) config.resolution = resolution;[m
   if (typeof seed === "number") config.seed = seed;[m
 [m
[31m-  // Kick off generation; this returns an LRO (operation)[m
[31m-  // @ts-ignore: types for generateVideos may lag the API surface[m
[31m-  const op: any = await ai.models.generateVideos({[m
[31m-    model,[m
[31m-    prompt,[m
[31m-    config,[m
[31m-  });[m
[32m+[m[32m  // @ts-ignore - API surface may lag types[m
[32m+[m[32m  const op: any = await ai.models.generateVideos({ model, prompt, config });[m
 [m
   const opName = extractOperationName(op);[m
   if (!opName) {[m
     log("❌ No operation name on response:", op);[m
     throw new Error("Operation name was not returned by the API.");[m
[31m-    }[m
[32m+[m[32m  }[m
 [m
[31m-  // Structured log you can grep in Cloud Run logs[m
[31m-  console.log([m
[31m-    JSON.stringify([m
[31m-      {[m
[31m-        severity: "INFO",[m
[31m-        where: "lib/veo",[m
[31m-        event: "video_operation_created",[m
[31m-        operationName: opName,[m
[31m-        model,[m
[31m-        config,[m
[31m-      },[m
[31m-      null,[m
[31m-      2[m
[31m-    )[m
[31m-  );[m
[32m+[m[32m  console.log(JSON.stringify({[m
[32m+[m[32m    severity: "INFO",[m
[32m+[m[32m    where: "lib/veo",[m
[32m+[m[32m    event: "video_operation_created",[m
[32m+[m[32m    operationName: opName,[m
[32m+[m[32m    model,[m
[32m+[m[32m    config,[m
[32m+[m[32m  }));[m
 [m
   if (!waitForResult) {[m
[31m-    // Return immediately; let caller/UI poll[m
[31m-    return {[m
[31m-      operationName: opName,[m
[31m-      model,[m
[31m-      config,[m
[31m-    };[m
[32m+[m[32m    return { operationName: opName, model, config };[m
   }[m
 [m
[31m-  // Otherwise, block until we get a result (or timeout)[m
   const polled = await pollUntilDone({[m
     operationName: opName,[m
     apiKey,[m
[36m@@ -314,24 +261,10 @@[m [mexport async function generateVeoVideo(req: GenerateVeoRequest): Promise<Generat[m
 [m
   const uri = polled.uri;[m
   if (!uri) {[m
[31m-    // Give the caller everything so they can inspect and decide[m
[31m-    log("⚠️ Completed without URI — returning queued shape + raw hint");[m
[31m-    return {[m
[31m-      operationName: opName,[m
[31m-      model,[m
[31m-      config,[m
[31m-      // not marking done unless we actually have a URI[m
[31m-    } as GenerateVeoQueued;[m
[32m+[m[32m    log("⚠️ Completed without URI — returning queued shape.");[m
[32m+[m[32m    return { operationName: opName, model, config } as GenerateVeoQueued;[m
   }[m
 [m
   log("✅ Operation complete. URI ready:", uri);[m
[31m-  return {[m
[31m-    operationName: opName,[m
[31m-    model,[m
[31m-    config,[m
[31m-    done: true,[m
[31m-    uri,[m
[31m-    durationSeconds,[m
[31m-  } as GenerateVeoCompleted;[m
[32m+[m[32m  return { operationName: opName, model, config, done: true, uri, durationSeconds } as GenerateVeoCompleted;[m
 }[m
[31m-[m
