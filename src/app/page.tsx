'use client';

import { useState } from 'react';

type GenResponse = {
  uri?: string;
  requestedDurationSeconds?: number;
  durationSeconds?: number;
  note?: string;
  error?: string;
};

export default function Home() {
  const [prompt, setPrompt] = useState<string>(
    `A cozy living room with soft fall sunlight. Two WOW 1 DAY PAINTING crew members walk in wearing crisp emerald-green shirts with the white “WOW 1 DAY PAINTING” logo on the chest and matching khaki pants. They tape edges and prep the wall with quick, confident motions. Overlay text: “Fall means family — make home holiday-ready in 1 day.” CTA overlay: “Book Now → wow1day.com.” Background: warm, light acoustic beat with soft ambient sounds of brushes and laughter.`
  );
  const [aspect, setAspect] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [duration, setDuration] = useState<number>(6); // slider 4-8
  const [seed, setSeed] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<GenResponse | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setResp(null);
    try {
      const body: any = {
        prompt,
        aspectRatio: aspect,
        resolution,
        durationSeconds: duration,
        model: 'veo-3.0-generate-001', // avoid any model.name assumptions server-side
      };
      if (seed.trim() !== '' && !Number.isNaN(Number(seed))) {
        body.seed = Number(seed);
      }

      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await r.text();
      let json: any;
      try { json = JSON.parse(text); } catch { json = { error: text || `HTTP ${r.status}` }; }

      if (!r.ok) {
        setResp({
          error:
            typeof json?.error === 'string'
              ? json.error
              : JSON.stringify(json?.error ?? json),
        });
      } else {
        setResp(json);
      }
    } catch (e: any) {
      setResp({ error: e?.message || 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(60%_60%_at_50%_0%,#1d2333_0%,#0b0e14_60%,#080a0f_100%)] text-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500 shadow-lg" />
            <h1 className="text-2xl font-semibold tracking-tight">
              JAB • <span className="text-neutral-300">Video Builder</span>
            </h1>
          </div>
          <div className="text-sm text-neutral-400">Jordan &amp; Borden</div>
        </header>

        {/* Card */}
        <section className="rounded-2xl border border-white/10 bg-[#0f121a]/80 p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,.6)] backdrop-blur">
          <h2 className="mb-5 text-3xl font-bold tracking-tight">
            WOW • AI Ad Creator
          </h2>
          <p className="mb-6 max-w-3xl text-sm leading-relaxed text-neutral-300">
            Generate a short, high-energy transformation ad with synchronized audio.
            Use strong verbs, before/after cues, and end with a clear CTA (“Book Now”).
          </p>

          {/* Prompt */}
          <label className="mb-2 block text-sm font-medium text-neutral-200">
            Prompt
          </label>
          <textarea
            className="mb-6 h-44 w-full resize-vertical rounded-xl border border-white/10 bg-[#0b0e14] p-4 text-sm outline-none ring-1 ring-transparent transition focus:border-violet-400/30 focus:ring-violet-400/20"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          {/* Controls grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Aspect */}
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                Aspect Ratio
              </label>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#0b0e14] p-2 text-sm outline-none ring-1 ring-transparent focus:border-violet-400/30 focus:ring-violet-400/20"
                value={aspect}
                onChange={(e) => setAspect(e.target.value as any)}
              >
                <option value="16:9">16:9 (YouTube/X)</option>
                <option value="9:16">9:16 (Reels/Shorts)</option>
                <option value="1:1">1:1 (Square)</option>
              </select>
            </div>

            {/* Resolution */}
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                Resolution
              </label>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#0b0e14] p-2 text-sm outline-none ring-1 ring-transparent focus:border-violet-400/30 focus:ring-violet-400/20"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as any)}
              >
                <option value="720p">720p (fastest)</option>
                <option value="1080p">1080p (sharper)</option>
              </select>
            </div>

            {/* Seed */}
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-200">
                Seed (optional)
              </label>
              <input
                inputMode="numeric"
                placeholder="e.g. 42"
                className="w-full rounded-lg border border-white/10 bg-[#0b0e14] p-2 text-sm outline-none ring-1 ring-transparent focus:border-violet-400/30 focus:ring-violet-400/20"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                Same prompt + seed ≈ similar result. Leave blank for random.
              </p>
            </div>
          </div>

          {/* Duration */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-neutral-200">
                Duration
              </label>
              <span className="rounded-md border border-white/10 bg-[#0b0e14] px-2 py-0.5 text-xs text-neutral-300">
                {duration}s (range 4–8s)
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={8}
              step={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-violet-400"
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading || prompt.trim().length < 5}
              className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-violet-500/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Generate Video'}
            </button>
            <p className="text-xs text-neutral-400">
              Note: Generation may take a moment while the operation completes.
            </p>
          </div>

          {/* Output */}
          <div className="mt-6">
            {resp?.error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {resp.error}
              </div>
            )}
            {!resp?.error && resp?.uri && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                <div className="mb-1 font-medium">Video ready</div>
                <div className="break-all">
                  <a
                    className="underline hover:opacity-80"
                    href={resp.uri}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {resp.uri}
                  </a>
                </div>
                {resp.note && (
                  <div className="mt-1 text-xs text-emerald-200/80">{resp.note}</div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

  );
}
