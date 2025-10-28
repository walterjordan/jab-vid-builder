"use client";

import { useState } from "react";

type GenPayload = {
  prompt: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  resolution: "720p" | "1080p";
  durationSeconds: number; // 4–8s
  seed?: number;
};

export default function Home() {
  const [prompt, setPrompt] = useState(
    `Watch a dull kitchen turn into a picture-perfect space in just one day with WOW 1 DAY PAINTING. This high-energy 8s before & after showcases expert cabinet painting, precision prep by our Emerald Shirt senior-pro team, and zero-VOC finishes for healthier indoor air. Fast-motion transformation, clean lines, updated hardware and minimal disruption — no mess, no stress, just WOW.`
  );

  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [durationSeconds, setDurationSeconds] = useState<number>(8);
  const [seed, setSeed] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    setVideoUrl(null);

    // Front-end nudge: 1080p requires 8s (provider constraint).
    const finalDuration =
      resolution === "1080p" ? 8 : Math.max(4, Math.min(8, durationSeconds));

    const body: GenPayload = {
      prompt: prompt.trim(),
      aspectRatio,
      resolution,
      durationSeconds: finalDuration,
      ...(seed.trim()
        ? { seed: Number.isFinite(Number(seed)) ? Number(seed) : undefined }
        : {}),
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        // bubble up meaningful messages if the backend passed one through
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : JSON.stringify(data?.error ?? data)
        );
      }

      if (data?.uri) setVideoUrl(data.uri);
      if (data?.note) setNote(data.note);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      {/* Top Bar */}
      <header className="topbar">
        <div className="brand">
          <span className="logoDot" /> JAB • Video Builder
        </div>
        <a className="brandLink" href="https://jordanborden.com" target="_blank" rel="noreferrer">
          Jordan &amp; Borden
        </a>
      </header>

      {/* Main Card */}
      <main className="wrap">
        <section className="card">
          <h1 className="title">WOW • AI Ad Creator</h1>
          <p className="subtitle">
            Generate a short, high-energy kitchen transformation ad with synchronized audio.
            Edit the prompt below to test your own ad concept.
          </p>

          <div className="field">
            <label className="label">Prompt</label>
            <textarea
              className="input input--textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={7}
              placeholder="Describe your fast, visual before/after with a clear CTA."
            />
          </div>

          <div className="row">
            <div className="field">
              <label className="label">Aspect Ratio</label>
              <select
                className="input"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as any)}
              >
                <option value="16:9">16:9 (YouTube/X)</option>
                <option value="9:16">9:16 (Reels/Shorts)</option>
                <option value="1:1">1:1 (Square)</option>
              </select>
            </div>

            <div className="field">
              <label className="label">Resolution</label>
              <select
                className="input"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
              >
                <option value="720p">720p (fastest)</option>
                <option value="1080p">1080p (sharpest)</option>
              </select>
              <div className="hint">
                {resolution === "1080p"
                  ? "1080p requires 8 seconds."
                  : "720p works for any 4–8s duration."}
              </div>
            </div>

            <div className="field">
              <label className="label">Seed (optional)</label>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 42"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
              <div className="hint">Same prompt + seed ≈ similar result.</div>
            </div>
          </div>

          <div className="field">
            <label className="label">
              Duration:{" "}
              <strong>
                {resolution === "1080p" ? 8 : durationSeconds}s
              </strong>{" "}
              <span className="hint-inline">(drag 4–8s)</span>
            </label>
            <input
              className="slider"
              type="range"
              min={4}
              max={8}
              step={1}
              disabled={resolution === "1080p"}
              value={resolution === "1080p" ? 8 : durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
            />
          </div>

          <div className="actions">
            <button className="btn" onClick={handleGenerate} disabled={busy}>
              {busy ? "Generating…" : "Generate Video"}
            </button>
          </div>

          {note && <div className="note">{note}</div>}
          {error && <div className="alert">{error}</div>}

          {videoUrl && (
            <div className="result">
              <a href={videoUrl} target="_blank" rel="noreferrer" className="resultLink">
                View generated video →
              </a>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

