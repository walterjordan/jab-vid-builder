// src/app/page.tsx
"use client";

import React from "react";

type Meta = {
  model: string;
  aspectRatio: string;
  resolution: string;
  requestedDurationSeconds: number;
  usedDurationSeconds: number;
  note: string | null;
  service: string | null;
  revision: string | null;
};

type ApiOk = { uri: string; meta: Meta };
type ApiErr = { error: string };

const MIN_DURATION = 4;
const MAX_DURATION = 8;

function clamp(n: number, lo = MIN_DURATION, hi = MAX_DURATION) {
  return Math.max(lo, Math.min(hi, n));
}

export default function Page() {
  const [prompt, setPrompt] = React.useState<string>(
    "Watch a dull kitchen turn into a picture-perfect space in just one day with WOW 1 DAY PAINTING. This high-energy 45s before & after showcases expert cabinet painting, precision prep by our Emerald Shirt senior-pro team, and zero-VOC finishes for healthier indoor air. Fast-motion transformation, clean lines, updated hardware and minimal disruption — no mess, no stress, just WOW."
  );

  const [aspectRatio, setAspectRatio] = React.useState<"16:9" | "9:16" | "1:1">(
    "16:9"
  );
  const [resolution, setResolution] = React.useState<"720p" | "1080p">("720p");
  const [duration, setDuration] = React.useState<number>(6); // default mid-range
  const [seed, setSeed] = React.useState<string>(""); // optional

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ApiOk | null>(null);

  // Enforce provider combo rule: 1080p must be 8s.
  React.useEffect(() => {
    if (resolution === "1080p" && duration !== 8) {
      setDuration(8);
    }
  }, [resolution]); // eslint-disable-line react-hooks/exhaustive-deps

  const onResolutionChange = (v: "720p" | "1080p") => {
    setResolution(v);
    if (v === "1080p") {
      setDuration(8); // hard-lock to 8s
    }
  };

  const onDurationChange = (v: number) => {
    // If 1080p, keep at 8s
    if (resolution === "1080p") {
      setDuration(8);
    } else {
      setDuration(clamp(v));
    }
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (!prompt || prompt.trim().length < 5) {
        throw new Error("Prompt is required (min 5 characters).");
      }

      // Build payload. Seed is optional (omit if empty).
      const payload: any = {
        prompt: prompt.trim(),
        aspectRatio,
        resolution,
        durationSeconds: resolution === "1080p" ? 8 : clamp(duration),
      };
      if (seed.trim()) {
        const n = Number(seed);
        if (Number.isFinite(n)) payload.seed = n;
        else throw new Error("Seed must be a number (or leave it blank).");
      }

      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await r.json()) as ApiOk | ApiErr;

      if (!r.ok) {
        // Backend returns helpful message
        throw new Error((data as ApiErr).error || "Generation failed.");
      }

      setResult(data as ApiOk);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#111] text-white">
      <div className="max-w-5xl mx-auto px-5 py-10">
        <header className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">
            JAB • Video Builder
          </h1>
          <p className="text-zinc-400 mt-2">
            Generate a short, high-energy kitchen transformation ad with synchronized audio.
          </p>
        </header>

        <section className="bg-[#191919] rounded-xl ring-1 ring-white/10 p-6 space-y-6">
          {/* Prompt */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full min-h-[160px] rounded-lg bg-black/40 border border-white/10 p-4 text-sm outline-none focus:border-white/20"
              placeholder="Describe the video to create…"
            />
            <p className="text-xs text-zinc-500">
              Tip: Strong verbs, visual cues (before/after, fast-motion), and a clear CTA (“Book Now”) help.
            </p>
          </div>

          {/* Controls row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Aspect ratio */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Aspect Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as any)}
                className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm"
              >
                <option value="16:9">16:9 (YouTube/X)</option>
                <option value="9:16">9:16 (Reels/TikTok/Shorts)</option>
                <option value="1:1">1:1 (Square)</option>
              </select>
            </div>

            {/* Resolution */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Resolution
              </label>
              <select
                value={resolution}
                onChange={(e) => onResolutionChange(e.target.value as any)}
                className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm"
              >
                <option value="720p">720p (fastest)</option>
                <option value="1080p">1080p (8s only)</option>
              </select>
              {resolution === "1080p" ? (
                <p className="text-xs text-amber-400">
                  1080p requires exactly 8s. Duration is locked below.
                </p>
              ) : (
                <p className="text-xs text-zinc-500">Range: 4–8 seconds.</p>
              )}
            </div>

            {/* Seed (optional) */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">
                Seed (optional)
              </label>
              <input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="e.g., 42"
                className="w-full rounded-lg bg-black/40 border border-white/10 p-2.5 text-sm"
                inputMode="numeric"
              />
              <p className="text-xs text-zinc-500">
                Use the same prompt + seed to reproduce a similar result. Leave blank for random.
              </p>
            </div>
          </div>

          {/* Duration slider */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Duration: <span className="text-white">{duration}s</span>
            </label>
            <input
              type="range"
              min={MIN_DURATION}
              max={MAX_DURATION}
              step={1}
              value={resolution === "1080p" ? 8 : duration}
              onChange={(e) => onDurationChange(Number(e.target.value))}
              disabled={resolution === "1080p"}
              className="w-full"
            />
            {resolution !== "1080p" ? (
              <p className="text-xs text-zinc-500">
                Drag between {MIN_DURATION}–{MAX_DURATION} seconds.
              </p>
            ) : (
              <p className="text-xs text-amber-400">
                Locked to 8s for 1080p (provider requirement).
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={loading}
              className="rounded-lg bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90 disabled:opacity-60"
            >
              {loading ? "Generating…" : "Generate Video"}
            </button>
            <span className="text-xs text-zinc-500">
              Note: Generation may take a moment while the operation completes.
            </span>
          </div>

          {/* Messages */}
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 text-red-300 p-3 text-sm">
              {error}
            </div>
          )}
          {result && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 p-4 space-y-2">
              <div className="text-sm">
                <span className="font-semibold">Video:</span>{" "}
                <a
                  href={result.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  {result.uri}
                </a>
              </div>
              <pre className="text-xs text-emerald-300/90 overflow-auto">
                {JSON.stringify(result.meta, null, 2)}
              </pre>
              {result.meta?.note && (
                <p className="text-xs text-amber-300/90">{result.meta.note}</p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
